/**
 * Lead Sources API — 4 sheets (Cognism, Apollo, Social, Blackbook) as immutable source of truth.
 * Metadata only in DB; contacts are NOT persisted. All scoped by x-customer-id.
 */

import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { LeadSourceType, LeadSourceAppliesTo } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { csvToMappedRows, detectDelimiter } from '../services/leadSourcesCanonicalMapping.js'
import { computeFingerprint } from '../services/leadSourcesFingerprint.js'
import { buildBatchKey, parseBatchKey } from '../services/leadSourcesBatch.js'

const router = Router()

const CACHE_TTL_MS = 45 * 1000 // 30–60s in-memory cache for CSV-derived contacts
const FETCH_TIMEOUT_MS = 15 * 1000

const SOURCE_TYPES: LeadSourceType[] = [
  'COGNISM',
  'APOLLO',
  'SOCIAL',
  'BLACKBOOK',
]

function isValidSourceType(value: string): value is LeadSourceType {
  return SOURCE_TYPES.includes(value as LeadSourceType)
}

function getCustomerId(req: Request): string {
  const id = (req.headers['x-customer-id'] as string) || (req.query.customerId as string)
  if (!id?.trim()) {
    const err = new Error('Customer ID required') as Error & { status?: number }
    err.status = 400
    throw err
  }
  return id.trim()
}

const PUBLISHED_LINK_REJECT_MESSAGE =
  'Please paste the normal Google Sheets URL (…/spreadsheets/d/<ID>/edit). Do not use published CSV (/pub?output=csv) links.'

/** True if URL is a published CSV link (/d/e/..., /pub, or output=csv). */
function isPublishedCsvUrl(url: string): boolean {
  const u = url.toLowerCase()
  return u.includes('/spreadsheets/d/e/') || u.includes('/pub') || u.includes('output=csv')
}

/** Build CSV export URL. spreadsheetId is always a sheet ID (not a full URL). */
function getCsvExportUrl(spreadsheetId: string, gid?: string | null): string {
  const g = gid && /^\d+$/.test(gid) ? gid : '0'
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${g}`
}

const HTML_ERROR_MSG =
  'Sheet URL returned HTML. This usually means the sheet is not published / not accessible, or the URL format is unsupported. If you are using a published link, it must contain output=csv.'

/** Fetches CSV from external URL only (Google Sheets export). No self-fetch; frontend calls POST /poll explicitly. */
async function fetchCsvFromUrl(url: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: { Accept: 'text/csv, text/plain, */*', 'User-Agent': 'ODCRM-LeadSources/1.0' },
      signal: controller.signal,
    })
    clearTimeout(timeout)
    const text = await res.text()
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    const contentType = (res.headers.get('content-type') || '').toLowerCase()
    if (contentType.includes('text/html') || text.trim().toLowerCase().includes('<html')) {
      throw new Error(HTML_ERROR_MSG)
    }
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

/** Resolve sheet config: exact customer first, then any config with appliesTo ALL_ACCOUNTS for this sourceType. */
async function resolveLeadSourceConfig(
  customerId: string,
  sourceType: LeadSourceType
): Promise<{ id: string; customerId: string; sourceType: LeadSourceType; spreadsheetId: string; gid: string | null; displayName: string; isLocked: boolean; lastFetchAt: Date | null; lastError: string | null } | null> {
  const exact = await prisma.leadSourceSheetConfig.findUnique({
    where: { customerId_sourceType: { customerId, sourceType } },
  })
  if (exact?.spreadsheetId) return exact
  const fallback = await prisma.leadSourceSheetConfig.findFirst({
    where: { sourceType, appliesTo: LeadSourceAppliesTo.ALL_ACCOUNTS },
  })
  return fallback?.spreadsheetId ? fallback : null
}

/** Resolve configs for all source types (for list endpoint). */
async function resolveAllLeadSourceConfigs(customerId: string): Promise<Array<{ sourceType: LeadSourceType; config: Awaited<ReturnType<typeof resolveLeadSourceConfig>> }>> {
  const results = await Promise.all(
    SOURCE_TYPES.map(async (sourceType) => ({
      sourceType,
      config: await resolveLeadSourceConfig(customerId, sourceType),
    }))
  )
  return results
}

// GET /api/lead-sources — list 4 source configs (respects inheritance)
router.get('/', async (req: Request, res: Response) => {
  try {
    const customerId = getCustomerId(req)
    const resolved = await resolveAllLeadSourceConfigs(customerId)
    const sources = SOURCE_TYPES.map((sourceType) => {
      const r = resolved.find((x) => x.sourceType === sourceType)
      const c = r?.config
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

// POST /api/lead-sources/:sourceType/connect — set spreadsheetId + displayName
// TODO: In production, guard with admin/auth middleware; customerId is from getCustomerId(req) only.
const connectSchema = z.object({
  sheetUrl: z.string().url(),
  displayName: z.string().trim().min(1),
  applyToAllAccounts: z.boolean().optional().default(false),
})
router.post('/:sourceType/connect', async (req: Request, res: Response) => {
  try {
    const { sheetUrl, displayName, applyToAllAccounts } = connectSchema.parse(req.body)

    if (isPublishedCsvUrl(sheetUrl)) {
      return res.status(400).json({ error: PUBLISHED_LINK_REJECT_MESSAGE })
    }

    const customerId = getCustomerId(req)
    const { sourceType: sourceTypeRaw } = req.params
    if (!isValidSourceType(sourceTypeRaw)) {
      return res.status(400).json({ error: `Invalid sourceType. Must be one of: ${SOURCE_TYPES.join(', ')}` })
    }
    const sourceType = sourceTypeRaw

    const idMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    if (!idMatch) return res.status(400).json({ error: 'Invalid Google Sheets URL' })
    const spreadsheetId = idMatch[1]
    let gid: string | null = null
    try {
      const parsed = new URL(sheetUrl)
      const fromQuery = parsed.searchParams.get('gid')
      const fromHash = parsed.hash ? /gid=(\d+)/.exec(parsed.hash)?.[1] : null
      const gidVal = fromQuery || fromHash
      if (gidVal && /^\d+$/.test(gidVal)) gid = gidVal
    } catch {
      const gidMatch = sheetUrl.match(/gid=(\d+)/)
      gid = gidMatch ? gidMatch[1] : null
    }

    const csvUrl = getCsvExportUrl(spreadsheetId, gid)
    await fetchCsvFromUrl(csvUrl)
    const appliesTo = applyToAllAccounts ? LeadSourceAppliesTo.ALL_ACCOUNTS : LeadSourceAppliesTo.CUSTOMER_ONLY
    const config = await prisma.leadSourceSheetConfig.upsert({
      where: { customerId_sourceType: { customerId, sourceType } },
      create: {
        customerId,
        sourceType,
        spreadsheetId,
        gid,
        displayName,
        isLocked: true,
        appliesTo,
      },
      update: { spreadsheetId, gid, displayName, lastError: null, appliesTo },
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
    const { sourceType: sourceTypeRaw } = req.params
    if (!isValidSourceType(sourceTypeRaw)) {
      return res.status(400).json({ error: `Invalid sourceType. Must be one of: ${SOURCE_TYPES.join(', ')}` })
    }
    const sourceType = sourceTypeRaw
    const config = await resolveLeadSourceConfig(customerId, sourceType)
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
        sourceType,
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
    const sourceTypeRaw = req.params.sourceType
    if (isValidSourceType(sourceTypeRaw)) {
      await prisma.leadSourceSheetConfig.updateMany({
        where: { customerId, sourceType: sourceTypeRaw },
        data: { lastError: (e as Error).message },
      }).catch(() => {})
    }
    const err = e as Error & { status?: number }
    res.status(err.status ?? 500).json({ error: err.message ?? 'Poll failed' })
  }
})

// GET /api/lead-sources/:sourceType/batches?date=YYYY-MM-DD — distinct batches (groupBy), never raw row_seen rows
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const BATCHES_NO_DATE_TAKE = 200

router.get('/:sourceType/batches', async (req: Request, res: Response) => {
  try {
    const customerId = getCustomerId(req)
    const { sourceType: sourceTypeRaw } = req.params
    const dateRaw = String(req.query.date ?? '').trim()
    const isIsoDate = ISO_DATE_REGEX.test(dateRaw)
    if (!isValidSourceType(sourceTypeRaw)) {
      return res.status(400).json({ error: `Invalid sourceType. Must be one of: ${SOURCE_TYPES.join(', ')}` })
    }
    const sourceType = sourceTypeRaw
    const config = await resolveLeadSourceConfig(customerId, sourceType)
    if (!config?.spreadsheetId) {
      res.set('x-odcrm-lead-sources-batches', 'groupBy-v1')
      return res.json({ batches: [] })
    }
    const baseWhere = { customerId, sourceType }
    type GroupRow = { batchKey: string; _count: { _all: number }; _max: { firstSeenAt: Date | null } }
    let grouped: GroupRow[]
    let fallback = false

    if (isIsoDate) {
      const r1 = await prisma.leadSourceRowSeen.groupBy({
        by: ['batchKey'],
        where: { ...baseWhere, batchKey: { startsWith: dateRaw } },
        _count: { _all: true },
        _max: { firstSeenAt: true },
      })
      grouped = r1 as GroupRow[]
      if (grouped.length === 0) {
        const r2 = await prisma.leadSourceRowSeen.groupBy({
          by: ['batchKey'],
          where: baseWhere,
          _count: { _all: true },
          _max: { firstSeenAt: true },
        })
        grouped = (r2 as GroupRow[])
          .sort((a, b) => (b._max.firstSeenAt?.getTime() ?? 0) - (a._max.firstSeenAt?.getTime() ?? 0))
          .slice(0, BATCHES_NO_DATE_TAKE)
        fallback = true
      }
    } else {
      const r3 = await prisma.leadSourceRowSeen.groupBy({
        by: ['batchKey'],
        where: baseWhere,
        _count: { _all: true },
        _max: { firstSeenAt: true },
      })
      grouped = (r3 as GroupRow[])
        .sort((a, b) => (b._max.firstSeenAt?.getTime() ?? 0) - (a._max.firstSeenAt?.getTime() ?? 0))
        .slice(0, BATCHES_NO_DATE_TAKE)
    }

    const batches = grouped
      .sort((a, b) => (b._max.firstSeenAt?.getTime() ?? 0) - (a._max.firstSeenAt?.getTime() ?? 0))
      .map((g) => {
        const parsed = parseBatchKey(g.batchKey)
        return {
          batchKey: g.batchKey,
          client: parsed.client && parsed.client.trim() !== '' ? parsed.client : '(none)',
          jobTitle: parsed.jobTitle && parsed.jobTitle.trim() !== '' ? parsed.jobTitle : '(none)',
          count: g._count._all,
          lastSeenAt: g._max.firstSeenAt?.toISOString() ?? '',
        }
      })

    res.set('x-odcrm-lead-sources-batches', 'groupBy-v1')
    res.set('x-odcrm-batches-fallback', fallback ? '1' : '0')
    res.json({ batches })
  } catch (e) {
    const err = e as Error & { status?: number }
    res.status(err.status ?? 500).json({ error: err.message ?? 'Failed to load batches' })
  }
})

// GET /api/lead-sources/:sourceType/open-sheet — redirect to sheet (spreadsheetId is always an ID)
router.get('/:sourceType/open-sheet', async (req: Request, res: Response) => {
  try {
    const customerId = getCustomerId(req)
    const { sourceType: sourceTypeRaw } = req.params
    if (!isValidSourceType(sourceTypeRaw)) {
      return res.status(400).json({ error: `Invalid sourceType. Must be one of: ${SOURCE_TYPES.join(', ')}` })
    }
    const sourceType = sourceTypeRaw
    const config = await resolveLeadSourceConfig(customerId, sourceType)
    if (!config?.spreadsheetId) {
      return res.status(404).json({ error: 'Source not connected' })
    }
    const g = config.gid && /^\d+$/.test(config.gid) ? config.gid : '0'
    const redirectUrl = `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/edit#gid=${g}`
    res.redirect(302, redirectUrl)
  } catch (e) {
    const err = e as Error & { status?: number }
    res.status(err.status ?? 500).json({ error: err.message ?? 'Failed' })
  }
})

/** Ensure every row has every column key (empty string if missing). Stops downstream from collapsing to 1 column. */
function normalizeRowKeepKeys(
  row: Record<string, string>,
  columns: string[]
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const col of columns) {
    const v = row[col]
    out[col] = v === null || v === undefined ? '' : String(v)
  }
  return out
}

// GET /api/lead-sources/:sourceType/contacts?batchKey=...&page=1&pageSize=50
router.get('/:sourceType/contacts', async (req: Request, res: Response) => {
  try {
    const customerId = getCustomerId(req)
    const { sourceType: sourceTypeRaw } = req.params
    const batchKey = (req.query.batchKey as string)?.trim()
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string, 10) || 50))
    if (!isValidSourceType(sourceTypeRaw)) {
      return res.status(400).json({ error: `Invalid sourceType. Must be one of: ${SOURCE_TYPES.join(', ')}` })
    }
    const sourceType = sourceTypeRaw
    if (!batchKey) return res.status(400).json({ error: 'batchKey is required' })
    const config = await resolveLeadSourceConfig(customerId, sourceType)
    if (!config?.spreadsheetId) {
      return res.status(404).json({ error: 'Source not connected' })
    }
    const fingerprintsInBatch = await prisma.leadSourceRowSeen.findMany({
      where: {
        customerId,
        sourceType,
        spreadsheetId: config.spreadsheetId,
        batchKey,
      },
      select: { fingerprint: true },
    })
    const fpSet = new Set(fingerprintsInBatch.map((r) => r.fingerprint))
    const rowSeenCount = fingerprintsInBatch.length
    let cached = getCachedContacts(customerId, sourceType)
    if (!cached) {
      const csvUrl = getCsvExportUrl(config.spreadsheetId, config.gid)
      const csvText = await fetchCsvFromUrl(csvUrl)
      if (process.env.DEBUG_LEAD_SOURCES === '1') {
        const firstThreeLines = csvText.split(/\r?\n/).slice(0, 3).map((l) => l.slice(0, 200))
        const firstLine = firstThreeLines[0] ?? ''
        const commaCount = (firstLine.match(/,/g) || []).length
        const tabCount = (firstLine.match(/\t/g) || []).length
        const semicolonCount = (firstLine.match(/;/g) || []).length
        const inferred = detectDelimiter(firstLine)
        console.debug('[lead-sources contacts] raw CSV', {
          firstLineSample: firstLine.slice(0, 120),
          firstThreeLinesTruncated: firstThreeLines,
          commaCount,
          tabCount,
          semicolonCount,
          inferredDelimiter: inferred === '\t' ? 'TAB' : inferred === ';' ? 'SEMICOLON' : 'COMMA',
        })
      }
      const { columnKeys, rows } = csvToMappedRows(csvText)
      if (process.env.DEBUG_LEAD_SOURCES === '1') {
        console.debug('[lead-sources contacts] parsed header', {
          headerArrayLength: columnKeys.length,
          first10ColumnNames: columnKeys.slice(0, 10),
        })
      }
      const flat = rows.map((r) => {
        const canonical = { ...r.canonical }
        const fingerprint = computeFingerprint(canonical)
        return { ...canonical, ...r.extraFields, __fp: fingerprint }
      })
      setCachedContacts(customerId, sourceType, columnKeys, flat)
      cached = { columnKeys, rows: flat }
    }
    const filtered = cached.rows.filter((r: Record<string, string>) => {
      const fp = r['__fp']
      return typeof fp === 'string' && fpSet.has(fp)
    })
    const total = filtered.length
    let returnedColumns = cached.columnKeys.filter((k) => k !== '__fp')
    if (returnedColumns.length === 0 && cached.rows.length > 0) {
      const keySet = new Set<string>()
      for (const row of cached.rows.slice(0, 200)) {
        for (const k of Object.keys(row)) if (k && k !== '__fp') keySet.add(k)
      }
      returnedColumns = Array.from(keySet)
    }
    if (process.env.DEBUG_LEAD_SOURCES === '1') {
      const firstRow = cached.rows[0] as Record<string, string> | undefined
      const firstRowKeys = firstRow ? Object.keys(firstRow).filter((k) => k !== '__fp') : []
      console.debug('[lead-sources contacts]', {
        cachedColumnsLength: cached.columnKeys.length,
        cachedColumnsFirst10: cached.columnKeys.filter((k) => k !== '__fp').slice(0, 10),
        firstRowKeysLength: firstRowKeys.length,
        firstRowKeysFirst10: firstRowKeys.slice(0, 10),
        returnedColumnsLength: returnedColumns.length,
        returnedColumnsFirst10: returnedColumns.slice(0, 10),
        customerId,
        sourceType,
        batchKey,
        rowSeenCount,
        cachedRowCount: cached.rows.length,
        filteredRowCount: filtered.length,
      })
    }
    const start = (page - 1) * pageSize
    const slice = filtered.slice(start, start + pageSize).map((r: Record<string, string>) => {
      const { __fp, ...rest } = r
      return normalizeRowKeepKeys(rest as Record<string, string>, returnedColumns)
    })
    res.json({
      columns: returnedColumns,
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
