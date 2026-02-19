/**
 * Lead Sources API — 4 sheets (Cognism, Apollo, Social, Blackbook) as immutable source of truth.
 * Metadata only in DB; contacts are NOT persisted. All scoped by x-customer-id.
 */

import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma as prismaTyped } from '../lib/prisma.js'

/** Local type alias when Prisma LeadSourceType enum is not generated (no schema change). */
type LeadSourceType = string

const prisma = prismaTyped as any
import { csvToMappedRows } from '../services/leadSourcesCanonicalMapping.js'
import { computeFingerprint } from '../services/leadSourcesFingerprint.js'
import { buildBatchKey, formatDateBucketEuropeLondon, parseBatchKey } from '../services/leadSourcesBatch.js'

const router = Router()
const SOURCE_TYPES: LeadSourceType[] = ['COGNISM', 'APOLLO', 'SOCIAL', 'BLACKBOOK']
const CACHE_TTL_MS = 45 * 1000 // 30–60s in-memory cache for CSV-derived contacts
const FETCH_TIMEOUT_MS = 15 * 1000

function getCustomerId(req: Request): string {
  const id = (req.headers['x-customer-id'] as string) || (req.query.customerId as string)
  if (!id?.trim()) {
    const err = new Error('Customer ID required') as Error & { status?: number }
    err.status = 400
    throw err
  }
  return id.trim()
}

function isValidSourceType(source: string): source is LeadSourceType {
  return SOURCE_TYPES.includes(source as LeadSourceType)
}

function getCsvExportUrl(spreadsheetId: string, gid?: string | null): string {
  const g = gid && /^\d+$/.test(gid) ? gid : '0'
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${g}`
}

async function fetchCsvFromUrl(url: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: { Accept: 'text/csv, text/plain, */*', 'User-Agent': 'ODCRM-LeadSources/1.0' },
      signal: controller.signal,
    })
    clearTimeout(timeout)
    const contentType = (res.headers.get('content-type') || '').toLowerCase()
    if (contentType.includes('text/html')) throw new Error('URL returned HTML instead of CSV')
    const text = await res.text()
    if (text.trim().toLowerCase().includes('<html')) throw new Error('URL returned HTML instead of CSV')
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    return text
  } catch (e) {
    clearTimeout(timeout)
    throw e instanceof Error ? e : new Error(String(e))
  }
}

// In-memory cache for GET contacts: key = customerId|sourceType, value = { data, at }
const contactsCache = new Map<string, { columnKeys: string[]; rows: Array<Record<string, string>>; at: number }>()

function getCachedContacts(customerId: string, sourceType: string): { columnKeys: string[]; rows: Array<Record<string, string>> } | null {
  const key = `${customerId}|${sourceType}`
  const entry = contactsCache.get(key)
  if (!entry || Date.now() - entry.at > CACHE_TTL_MS) return null
  return { columnKeys: entry.columnKeys, rows: entry.rows }
}

function setCachedContacts(customerId: string, sourceType: string, columnKeys: string[], rows: Array<Record<string, string>>): void {
  contactsCache.set(`${customerId}|${sourceType}`, { columnKeys, rows, at: Date.now() })
}

// GET /api/lead-sources — list 4 source configs
router.get('/', async (req: Request, res: Response) => {
  try {
    const customerId = getCustomerId(req)
    const configs = await prisma.leadSourceSheetConfig.findMany({
      where: { customerId },
    })
    const sources = SOURCE_TYPES.map((sourceType) => {
      const c = configs.find((x) => x.sourceType === sourceType)
      return {
        sourceType,
        displayName: c?.displayName ?? sourceType,
        connected: !!c?.spreadsheetId,
        lastFetchAt: c?.lastFetchAt?.toISOString() ?? null,
        lastError: c?.lastError ?? null,
        isLocked: c?.isLocked ?? true,
      }
    })
    res.json({ sources })
  } catch (e) {
    const err = e as Error & { status?: number }
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' })
  }
})

// POST /api/lead-sources/:sourceType/connect — set spreadsheetId + displayName (guard with admin/auth in production)
const connectSchema = z.object({
  sheetUrl: z.string().url(),
  displayName: z.string().trim().min(1),
})
router.post('/:sourceType/connect', async (req: Request, res: Response) => {
  try {
    const customerId = getCustomerId(req)
    const { sourceType } = req.params
    if (!isValidSourceType(sourceType)) {
      return res.status(400).json({ error: `Invalid sourceType. Must be one of: ${SOURCE_TYPES.join(', ')}` })
    }
    const { sheetUrl, displayName } = connectSchema.parse(req.body)
    const idMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    if (!idMatch) return res.status(400).json({ error: 'Invalid Google Sheets URL' })
    const spreadsheetId = idMatch[1]
    const gidMatch = sheetUrl.match(/gid=(\d+)/)
    const gid = gidMatch ? gidMatch[1] : null
    const csvUrl = getCsvExportUrl(spreadsheetId, gid)
    await fetchCsvFromUrl(csvUrl)
    const config = await prisma.leadSourceSheetConfig.upsert({
      where: { customerId_sourceType: { customerId, sourceType: sourceType as LeadSourceType } },
      create: {
        customerId,
        sourceType: sourceType as LeadSourceType,
        spreadsheetId,
        gid,
        displayName,
        isLocked: true,
      },
      update: { spreadsheetId, gid, displayName, lastError: null },
    })
    res.json({
      success: true,
      sourceType: config.sourceType,
      displayName: config.displayName,
      isLocked: config.isLocked,
    })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: e.errors })
    }
    const err = e as Error & { status?: number }
    res.status(err.status ?? 500).json({ error: err.message ?? 'Invalid Google Sheets URL or sheet not accessible' })
  }
})

// POST /api/lead-sources/:sourceType/poll — fetch sheet, normalize, upsert LeadSourceRowSeen
router.post('/:sourceType/poll', async (req: Request, res: Response) => {
  try {
    const customerId = getCustomerId(req)
    const { sourceType } = req.params
    if (!isValidSourceType(sourceType)) {
      return res.status(400).json({ error: `Invalid sourceType. Must be one of: ${SOURCE_TYPES.join(', ')}` })
    }
    const config = await prisma.leadSourceSheetConfig.findUnique({
      where: { customerId_sourceType: { customerId, sourceType: sourceType as LeadSourceType } },
    })
    if (!config?.spreadsheetId) {
      return res.status(404).json({ error: 'Source not connected. Connect a sheet first.' })
    }
    const csvUrl = getCsvExportUrl(config.spreadsheetId, config.gid)
    const csvText = await fetchCsvFromUrl(csvUrl)
    const { columnKeys, rows } = csvToMappedRows(csvText)
    const now = new Date()
    const toCreate: Array<{ customerId: string; sourceType: LeadSourceType; spreadsheetId: string; fingerprint: string; batchKey: string }> = []
    const seen = new Set<string>()
    for (const row of rows) {
      const canonical = { ...row.canonical }
      const fingerprint = computeFingerprint(canonical)
      if (seen.has(fingerprint)) continue
      seen.add(fingerprint)
      const client = canonical.client ?? row.extraFields?.client ?? ''
      const jobTitle = canonical.jobTitle ?? row.extraFields?.jobTitle ?? ''
      const batchKey = buildBatchKey(now, client, jobTitle)
      toCreate.push({
        customerId,
        sourceType: sourceType as LeadSourceType,
        spreadsheetId: config.spreadsheetId,
        fingerprint,
        batchKey,
      })
    }
    const result = await prisma.leadSourceRowSeen.createMany({
      data: toCreate,
      skipDuplicates: true,
    })
    const newRowsDetected = result.count
    await prisma.leadSourceSheetConfig.update({
      where: { id: config.id },
      data: { lastFetchAt: now, lastError: null },
    })
    contactsCache.delete(`${customerId}|${sourceType}`)
    const flatRows = rows.map((r) => {
      const canonical = { ...r.canonical }
      return { ...canonical, ...r.extraFields, __fp: computeFingerprint(canonical) }
    })
    setCachedContacts(customerId, sourceType, columnKeys, flatRows)
    res.json({
      totalRows: rows.length,
      newRowsDetected,
      lastFetchAt: now.toISOString(),
    })
  } catch (e) {
    const customerId = getCustomerId(req)
    const sourceType = req.params.sourceType
    if (isValidSourceType(sourceType)) {
      await prisma.leadSourceSheetConfig.updateMany({
        where: { customerId, sourceType: sourceType as LeadSourceType },
        data: { lastError: (e as Error).message },
      }).catch(() => {})
    }
    const err = e as Error & { status?: number }
    res.status(err.status ?? 500).json({ error: err.message ?? 'Poll failed' })
  }
})

// GET /api/lead-sources/:sourceType/batches?date=YYYY-MM-DD
router.get('/:sourceType/batches', async (req: Request, res: Response) => {
  try {
    const customerId = getCustomerId(req)
    const { sourceType } = req.params
    const date = (req.query.date as string) || formatDateBucketEuropeLondon(new Date())
    if (!isValidSourceType(sourceType)) {
      return res.status(400).json({ error: `Invalid sourceType. Must be one of: ${SOURCE_TYPES.join(', ')}` })
    }
    const config = await prisma.leadSourceSheetConfig.findUnique({
      where: { customerId_sourceType: { customerId, sourceType: sourceType as LeadSourceType } },
    })
    if (!config?.spreadsheetId) {
      return res.json({ batches: [] })
    }
    const rows = await prisma.leadSourceRowSeen.findMany({
      where: {
        customerId,
        sourceType: sourceType as LeadSourceType,
        spreadsheetId: config.spreadsheetId,
        batchKey: { startsWith: date },
      },
      select: { batchKey: true, firstSeenAt: true },
    })
    const byBatch = new Map<string, { firstSeenMin: Date; firstSeenMax: Date; count: number }>()
    for (const r of rows) {
      const existing = byBatch.get(r.batchKey)
      if (!existing) {
        byBatch.set(r.batchKey, { firstSeenMin: r.firstSeenAt, firstSeenMax: r.firstSeenAt, count: 1 })
      } else {
        existing.count += 1
        if (r.firstSeenAt < existing.firstSeenMin) existing.firstSeenMin = r.firstSeenAt
        if (r.firstSeenAt > existing.firstSeenMax) existing.firstSeenMax = r.firstSeenAt
      }
    }
    const batches = Array.from(byBatch.entries()).map(([batchKey, v]) => {
      const parsed = parseBatchKey(batchKey)
      return {
        batchKey,
        date: parsed.date,
        client: parsed.client,
        jobTitle: parsed.jobTitle,
        count: v.count,
        firstSeenMin: v.firstSeenMin.toISOString(),
        firstSeenMax: v.firstSeenMax.toISOString(),
      }
    })
    res.json({ batches })
  } catch (e) {
    const err = e as Error & { status?: number }
    res.status(err.status ?? 500).json({ error: err.message ?? 'Failed to load batches' })
  }
})

// GET /api/lead-sources/:sourceType/open-sheet — redirect to sheet (no spreadsheetId in client)
router.get('/:sourceType/open-sheet', async (req: Request, res: Response) => {
  try {
    const customerId = getCustomerId(req)
    const { sourceType } = req.params
    if (!isValidSourceType(sourceType)) {
      return res.status(400).json({ error: 'Invalid sourceType' })
    }
    const config = await prisma.leadSourceSheetConfig.findUnique({
      where: { customerId_sourceType: { customerId, sourceType: sourceType as LeadSourceType } },
    })
    if (!config?.spreadsheetId) {
      return res.status(404).json({ error: 'Source not connected' })
    }
    const g = config.gid && /^\d+$/.test(config.gid) ? config.gid : '0'
    const url = `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/edit#gid=${g}`
    res.redirect(302, url)
  } catch (e) {
    const err = e as Error & { status?: number }
    res.status(err.status ?? 500).json({ error: err.message ?? 'Failed' })
  }
})

// GET /api/lead-sources/:sourceType/contacts?batchKey=...&page=1&pageSize=50
router.get('/:sourceType/contacts', async (req: Request, res: Response) => {
  try {
    const customerId = getCustomerId(req)
    const { sourceType } = req.params
    const batchKey = (req.query.batchKey as string)?.trim()
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string, 10) || 50))
    if (!isValidSourceType(sourceType)) {
      return res.status(400).json({ error: `Invalid sourceType. Must be one of: ${SOURCE_TYPES.join(', ')}` })
    }
    if (!batchKey) return res.status(400).json({ error: 'batchKey is required' })
    const config = await prisma.leadSourceSheetConfig.findUnique({
      where: { customerId_sourceType: { customerId, sourceType: sourceType as LeadSourceType } },
    })
    if (!config?.spreadsheetId) {
      return res.status(404).json({ error: 'Source not connected' })
    }
    const fingerprintsInBatch = await prisma.leadSourceRowSeen.findMany({
      where: {
        customerId,
        sourceType: sourceType as LeadSourceType,
        spreadsheetId: config.spreadsheetId,
        batchKey,
      },
      select: { fingerprint: true },
    })
    const fpSet = new Set(fingerprintsInBatch.map((r) => r.fingerprint))
    let cached = getCachedContacts(customerId, sourceType)
    if (!cached) {
      const csvUrl = getCsvExportUrl(config.spreadsheetId, config.gid)
      const csvText = await fetchCsvFromUrl(csvUrl)
      const { columnKeys, rows } = csvToMappedRows(csvText)
      const flat = rows.map((r) => {
        const canonical = { ...r.canonical }
        const fingerprint = computeFingerprint(canonical)
        return { ...canonical, ...r.extraFields, __fp: fingerprint }
      })
      setCachedContacts(customerId, sourceType, columnKeys, flat)
      cached = { columnKeys, rows: flat }
    }
    const filtered = cached.rows.filter((r: Record<string, string>) => fpSet.has((r as any).__fp))
    const total = filtered.length
    const start = (page - 1) * pageSize
    const slice = filtered.slice(start, start + pageSize).map((r: Record<string, string>) => {
      const { __fp, ...rest } = r
      return rest
    })
    res.json({
      columns: cached.columnKeys.filter((k) => k !== '__fp'),
      contacts: slice,
      page,
      pageSize,
      total,
    })
  } catch (e) {
    const err = e as Error & { status?: number }
    res.status(err.status ?? 500).json({ error: err.message ?? 'Failed to load contacts' })
  }
})

export default router
