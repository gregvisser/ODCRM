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
import { requireCustomerId } from '../utils/tenantId.js'

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
    const customerId = requireCustomerId(req, res)
    if (!customerId) return
    const resolved = await resolveAllLeadSourceConfigs(customerId)
    const sources = SOURCE_TYPES.map((sourceType) => {
      const r = resolved.find((x) => x.sourceType === sourceType)
      const c = r?.config
      const usingGlobalConfig = !!(c && c.customerId !== customerId)
      return {
        sourceType,
        displayName: c?.displayName ?? sourceType,
        connected: !!c?.spreadsheetId,
        usingGlobalConfig,
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

/** Verify customer exists; throw if missing/invalid (400). */
async function ensureCustomerExists(customerId: string): Promise<void> {
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } })
  if (!customer) {
    const err = new Error('Invalid customer context') as Error & { status?: number }
    err.status = 400
    throw err
  }
}

// GET /api/lead-sources/batches — all batches across source types for this customer (for Sequences Leads Snapshot)
const BATCHES_AGGREGATE_TAKE = 200
router.get('/batches', async (req: Request, res: Response) => {
  try {
    const customerId = requireCustomerId(req, res)
    if (!customerId) return
    await ensureCustomerExists(customerId)

    type GroupRow = { batchKey: string; _count: { _all: number }; _max: { firstSeenAt: Date | null } }
    const allBatches: Array<GroupRow & { sourceType: LeadSourceType }> = []

    for (const sourceType of SOURCE_TYPES) {
      const config = await resolveLeadSourceConfig(customerId, sourceType)
      if (!config?.spreadsheetId) continue
      const grouped = await prisma.leadSourceRowSeen.groupBy({
        by: ['batchKey'],
        where: { customerId, sourceType },
        _count: { _all: true },
        _max: { firstSeenAt: true },
      })
      const typed = grouped as unknown as GroupRow[]
      for (const g of typed) allBatches.push({ ...g, sourceType })
    }

    const sorted = allBatches
      .sort((a, b) => (b._max.firstSeenAt?.getTime() ?? 0) - (a._max.firstSeenAt?.getTime() ?? 0))
      .slice(0, BATCHES_AGGREGATE_TAKE)
      .map((g) => {
        const parsed = parseBatchKey(g.batchKey)
        const label = `${g.sourceType} — ${parsed.date}${parsed.client ? ` · ${parsed.client}` : ''}${parsed.jobTitle ? ` · ${parsed.jobTitle}` : ''}`
        return {
          batchKey: g.batchKey,
          sourceType: g.sourceType,
          displayLabel: label.trim(),
          count: g._count._all,
        }
      })

    res.json(sorted)
  } catch (e) {
    const err = e as Error & { status?: number }
    res.status(err.status ?? 500).json({ error: err.message ?? 'Failed to load batches' })
  }
})

// POST /api/lead-sources/batches/:batchKey/materialize-list — create or reuse list from lead batch (idempotent)
router.post('/batches/:batchKey/materialize-list', async (req: Request, res: Response) => {
  try {
    const customerId = requireCustomerId(req, res)
    if (!customerId) return
    await ensureCustomerExists(customerId)
    const batchKey = (req.params.batchKey ?? '').trim()
    if (!batchKey) return res.status(400).json({ error: 'batchKey is required' })

    // Resolve which source type this batch belongs to (batchKey is unique per customer+sourceType in row_seen)
    const anyRow = await prisma.leadSourceRowSeen.findFirst({
      where: { customerId, batchKey },
      select: { sourceType: true, spreadsheetId: true },
    })
    if (!anyRow) return res.status(404).json({ error: 'Batch not found' })
    const sourceType = anyRow.sourceType
    const config = await resolveLeadSourceConfig(customerId, sourceType)
    if (!config?.spreadsheetId) return res.status(404).json({ error: 'Source not connected' })

    const listName = `Lead batch: ${sourceType} — ${batchKey.slice(0, 120)}`
    let list = await prisma.contactList.findFirst({
      where: { customerId, name: listName },
      select: { id: true, name: true },
    })
    if (list) {
      return res.json({ listId: list.id, name: list.name })
    }

    // Get all rows in this batch (fingerprints)
    const fingerprintsInBatch = await prisma.leadSourceRowSeen.findMany({
      where: { customerId, sourceType, spreadsheetId: config.spreadsheetId, batchKey },
      select: { fingerprint: true },
    })
    const fpSet = new Set(fingerprintsInBatch.map((r) => r.fingerprint))
    if (fpSet.size === 0) return res.status(400).json({ error: 'Batch has no contacts' })

    // Load CSV-derived rows (same as contacts endpoint)
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
    const filtered = cached.rows.filter((r: Record<string, string>) => {
      const fp = r['__fp']
      return typeof fp === 'string' && fpSet.has(fp)
    }) as Array<Record<string, string>>

    list = await prisma.contactList.create({
      data: {
        id: `list_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        customerId,
        name: listName,
        description: `Materialized from ${sourceType} batch`,
        updatedAt: new Date(),
      },
      select: { id: true, name: true },
    })

    const sourceValue = sourceType.toLowerCase()
    for (const row of filtered) {
      const email = (row.email ?? row.Email ?? '').toString().trim()
      if (!email) continue
      const firstName = (row.firstName ?? row.first_name ?? '').toString().trim() || 'Unknown'
      const lastName = (row.lastName ?? row.last_name ?? '').toString().trim() || 'Unknown'
      const companyName = (row.companyName ?? row.company_name ?? '').toString().trim() || 'Unknown'
      const jobTitle = (row.jobTitle ?? row.job_title ?? '').toString().trim() || null
      const phone = (row.mobile ?? row.phone ?? row.directPhone ?? row.officePhone ?? '').toString().trim() || null

      let contact = await prisma.contact.findFirst({
        where: { customerId, email },
        select: { id: true },
      })
      if (!contact) {
        contact = await prisma.contact.create({
          data: {
            customerId,
            email,
            firstName,
            lastName,
            companyName,
            jobTitle: jobTitle ?? undefined,
            phone: phone ?? undefined,
            source: sourceValue,
            updatedAt: new Date(),
          },
          select: { id: true },
        })
      }
      await prisma.contactListMember.upsert({
        where: {
          listId_contactId: { listId: list!.id, contactId: contact.id },
        },
        create: {
          id: `member_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          listId: list!.id,
          contactId: contact.id,
        },
        update: {},
      })
    }

    res.status(201).json({ listId: list.id, name: list.name })
  } catch (e) {
    const err = e as Error & { status?: number }
    res.status(err.status ?? 500).json({ error: err.message ?? 'Failed to materialize list' })
  }
})

// POST /api/lead-sources/:sourceType/connect — set spreadsheetId + displayName
// TODO: In production, guard with admin/auth middleware; customerId is from requireCustomerId(req, res) only.
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

    const customerId = requireCustomerId(req, res)
    if (!customerId) return
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
    const csvText = await fetchCsvFromUrl(csvUrl)
    const { columnKeys } = csvToMappedRows(csvText)
    if (columnKeys.length < 2) {
      return res.status(400).json({
        error:
          'Sheet export appears to have only 1 column. Check the header row has multiple columns, no merged cells in row 1, and the correct sheet tab (gid).',
      })
    }
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
    const customerId = requireCustomerId(req, res)
    if (!customerId) return
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
    const customerId = requireCustomerId(req, res)
    if (!customerId) return
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
    const customerId = requireCustomerId(req, res)
    if (!customerId) return
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
    const customerId = requireCustomerId(req, res)
    if (!customerId) return
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
    const customerId = requireCustomerId(req, res)
    if (!customerId) return
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
    const configScope = config.customerId === customerId ? 'customer' : 'all_accounts'
    res.set('x-odcrm-leadsource-config-scope', configScope)
    res.set('x-odcrm-leadsource-spreadsheet-id', config.spreadsheetId)
    res.set('x-odcrm-leadsource-sheet-gid', config.gid ?? '')
    if (process.env.DEBUG_LEAD_SOURCES === '1') {
      console.debug('[lead-sources contacts] resolved config', {
        source: configScope === 'customer' ? 'exact customer match' : 'ALL_ACCOUNTS fallback',
        customerIdRequested: customerId,
        configCustomerId: config.customerId,
        sourceType,
        spreadsheetId: config.spreadsheetId,
        sheetGid: config.gid ?? '',
        appliesTo: (config as { appliesTo?: string }).appliesTo,
      })
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
      const firstLine = csvText.split(/\r?\n/)[0] ?? ''
      if (process.env.DEBUG_LEAD_SOURCES === '1') {
        const commaCount = (firstLine.match(/,/g) || []).length
        const tabCount = (firstLine.match(/\t/g) || []).length
        const semicolonCount = (firstLine.match(/;/g) || []).length
        const inferred = detectDelimiter(firstLine)
        console.debug('[lead-sources contacts] raw CSV', {
          csvUrl,
          firstLineTrunc500: firstLine.slice(0, 500),
          commaCount,
          tabCount,
          semicolonCount,
          inferredDelimiter: inferred === '\t' ? 'TAB' : inferred === ';' ? 'SEMICOLON' : 'COMMA',
        })
      }
      const { columnKeys, rows } = csvToMappedRows(csvText)
      if (process.env.DEBUG_LEAD_SOURCES === '1') {
        const firstRowKeys = rows[0] ? Object.keys({ ...rows[0].canonical, ...rows[0].extraFields }) : []
        console.debug('[lead-sources contacts] parser output', {
          parsedHeadersLength: columnKeys.length,
          first30Headers: columnKeys.slice(0, 30),
          firstRowKeysCount: firstRowKeys.length,
          firstRowKeysList: firstRowKeys.slice(0, 30),
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
