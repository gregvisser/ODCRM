/**
 * Lead Sources API — 4 sheets (Cognism, Apollo, Social, Blackbook) as immutable source of truth.
 * Metadata only in DB; contacts are NOT persisted. All scoped by x-customer-id.
 */

import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { LeadSourceType, LeadSourceAppliesTo, LeadSourceProviderMode, Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { csvToMappedRows, detectDelimiter } from '../services/leadSourcesCanonicalMapping.js'
import { computeFingerprint } from '../services/leadSourcesFingerprint.js'
import { buildBatchKey, parseBatchKey } from '../services/leadSourcesBatch.js'
import { requireCustomerId } from '../utils/tenantId.js'
import { requireMarketingMutationAuth } from '../middleware/marketingMutationAuth.js'
import { encryptLeadSourceSecret, decryptLeadSourceSecret, isLeadSourceSecretEncryptionConfigured } from '../utils/leadSourceTokenCrypto.js'
import {
  cognismValidateApiKey,
  cognismSearchContacts,
  cognismRedeemContacts,
  type CognismSearchResultPreview,
} from '../services/cognismClient.js'
import { cognismNormalizedToFlatRow, normalizeCognismRedeemedContact } from '../services/cognismNormalizer.js'

const router = Router()

/** Stable spreadsheetId for Cognism API-backed configs (not a Google Sheet). */
const COGNISM_API_SPREADSHEET_SENTINEL = 'COGNISM_API'

const CACHE_TTL_MS = 45 * 1000 // 30–60s in-memory cache for CSV-derived contacts
const FETCH_TIMEOUT_MS = 15 * 1000

const COGNISM_POLL_INDEX_SIZE = Math.min(
  100,
  Math.max(1, parseInt(process.env.COGNISM_POLL_INDEX_SIZE || '50', 10) || 50)
)
const COGNISM_POLL_MAX_PAGES = Math.min(
  20,
  Math.max(1, parseInt(process.env.COGNISM_POLL_MAX_PAGES || '5', 10) || 5)
)
const COGNISM_REDEEM_CHUNK = Math.min(
  50,
  Math.max(1, parseInt(process.env.COGNISM_REDEEM_CHUNK || '25', 10) || 25)
)

const SOURCE_TYPES: LeadSourceType[] = [
  'COGNISM',
  'APOLLO',
  'SOCIAL',
  'BLACKBOOK',
]

function isValidSourceType(value: string): value is LeadSourceType {
  return SOURCE_TYPES.includes(value as LeadSourceType)
}

type LeadSourceSheetConfigRow = {
  id: string
  customerId: string
  sourceType: LeadSourceType
  spreadsheetId: string
  gid: string | null
  displayName: string
  isLocked: boolean
  lastFetchAt: Date | null
  lastError: string | null
  appliesTo: LeadSourceAppliesTo
  providerMode: LeadSourceProviderMode
  cognismApiTokenEncrypted: string | null
  cognismApiTokenLast4: string | null
  cognismSearchDefaults: unknown | null
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

type ResolvedLeadSourceConfig = NonNullable<Awaited<ReturnType<typeof resolveLeadSourceConfig>>>

// Shared ALL_ACCOUNTS configs store row-seen state once on the owning config customer.
// Any client inheriting that config reads and writes through the same scope.
function getLeadSourceDataScope(
  config: Pick<LeadSourceSheetConfigRow, 'customerId' | 'sourceType' | 'spreadsheetId' | 'gid'>
): {
  configCustomerId: string
  sourceType: LeadSourceType
  spreadsheetId: string
  gid: string | null
} {
  return {
    configCustomerId: config.customerId,
    sourceType: config.sourceType,
    spreadsheetId: config.spreadsheetId,
    gid: config.gid ?? null,
  }
}

type LeadSourceDataScope = ReturnType<typeof getLeadSourceDataScope>
type LeadSourceBatchGroupRow = { batchKey: string; _count: { _all: number }; _max: { firstSeenAt: Date | null } }

const MAX_OPERATOR_BATCH_NAME_LENGTH = 120
const BATCHES_NO_DATE_TAKE = 200
const BATCHES_AGGREGATE_TAKE = 200

const updateLeadSourceBatchNameSchema = z.object({
  operatorName: z.string().trim().max(MAX_OPERATOR_BATCH_NAME_LENGTH).nullable().optional(),
})

function getBatchMetadataKey(
  scope: Pick<LeadSourceDataScope, 'configCustomerId' | 'sourceType' | 'spreadsheetId'>,
  batchKey: string
): string {
  return `${scope.configCustomerId}|${scope.sourceType}|${scope.spreadsheetId}|${batchKey}`
}

/** Omit placeholder segments so labels do not show misleading "(none)" as real data. */
function batchKeySegmentForLabel(value: string | undefined): string | null {
  const t = (value ?? '').trim()
  if (!t || t.toLowerCase() === '(none)') return null
  return t
}

function buildFallbackBatchLabel(sourceType: LeadSourceType, batchKey: string): string {
  const parsed = parseBatchKey(batchKey)
  const clientSeg = batchKeySegmentForLabel(parsed.client)
  const jobSeg = batchKeySegmentForLabel(parsed.jobTitle)
  return `${sourceType} — ${parsed.date}${clientSeg ? ` · ${clientSeg}` : ''}${jobSeg ? ` · ${jobSeg}` : ''}`.trim()
}

function buildBatchDisplayLabel(sourceType: LeadSourceType, batchKey: string, operatorName?: string | null): string {
  const fallbackLabel = buildFallbackBatchLabel(sourceType, batchKey)
  const normalizedName = typeof operatorName === 'string' ? operatorName.trim() : ''
  return normalizedName ? `${normalizedName} · ${fallbackLabel}` : fallbackLabel
}

/** Batches list JSON: omit misleading placeholder when batchKey segment is empty or "(none)". */
function normalizeBatchKeySegmentForResponse(segment: string | undefined): string | null {
  return batchKeySegmentForLabel(segment)
}

function buildMaterializedLeadBatchListName(
  sourceType: LeadSourceType,
  batchKey: string,
  operatorName?: string | null
): string {
  const normalizedName = typeof operatorName === 'string' ? operatorName.trim() : ''
  return normalizedName ? `Lead batch: ${normalizedName}` : `Lead batch: ${sourceType} — ${batchKey.slice(0, 120)}`
}

function buildMaterializedLeadBatchListMarker(scope: LeadSourceDataScope, batchKey: string): string {
  return `lead-source-batch:${scope.configCustomerId}:${scope.sourceType}:${scope.spreadsheetId}:${batchKey}`
}

function buildMaterializedLeadBatchListDescription(
  scope: LeadSourceDataScope,
  batchKey: string,
  displayLabel: string
): string {
  return `${buildMaterializedLeadBatchListMarker(scope, batchKey)}\nMaterialized from ${displayLabel}`
}

async function loadBatchMetadataMap(
  entries: Array<{ scope: LeadSourceDataScope; batchKey: string }>
): Promise<Map<string, string | null>> {
  const uniqueEntries = Array.from(
    new Map(entries.map((entry) => [`${getBatchMetadataKey(entry.scope, entry.batchKey)}`, entry])).values()
  )
  if (uniqueEntries.length === 0) return new Map()

  const rows = await prisma.leadSourceBatchMetadata.findMany({
    where: {
      OR: uniqueEntries.map((entry) => ({
        customerId: entry.scope.configCustomerId,
        sourceType: entry.scope.sourceType,
        spreadsheetId: entry.scope.spreadsheetId,
        batchKey: entry.batchKey,
      })),
    },
    select: {
      customerId: true,
      sourceType: true,
      spreadsheetId: true,
      batchKey: true,
      operatorName: true,
    },
  })

  const byKey = new Map<string, string | null>()
  for (const row of rows) {
    byKey.set(
      getBatchMetadataKey(
        {
          configCustomerId: row.customerId,
          sourceType: row.sourceType,
          spreadsheetId: row.spreadsheetId,
        },
        row.batchKey
      ),
      row.operatorName ?? null
    )
  }
  return byKey
}

function getContactsCacheKey(scope: {
  configCustomerId: string
  sourceType: LeadSourceType
  spreadsheetId: string
  gid: string | null
}): string {
  return `${scope.configCustomerId}|${scope.sourceType}|${scope.spreadsheetId}|${scope.gid ?? ''}`
}

// In-memory cache for GET contacts: key = config owner + source + sheet identity, value = { data, at }
const contactsCache = new Map<string, { columnKeys: string[]; rows: Array<Record<string, string>>; at: number }>()

function getCachedContacts(scope: {
  configCustomerId: string
  sourceType: LeadSourceType
  spreadsheetId: string
  gid: string | null
}): { columnKeys: string[]; rows: Array<Record<string, string>> } | null {
  const key = getContactsCacheKey(scope)
  const entry = contactsCache.get(key)
  if (!entry || Date.now() - entry.at > CACHE_TTL_MS) return null
  return { columnKeys: entry.columnKeys, rows: entry.rows }
}

function setCachedContacts(
  scope: {
    configCustomerId: string
    sourceType: LeadSourceType
    spreadsheetId: string
    gid: string | null
  },
  columnKeys: string[],
  rows: Array<Record<string, string>>
): void {
  contactsCache.set(getContactsCacheKey(scope), { columnKeys, rows, at: Date.now() })
}

function deleteCachedContacts(scope: {
  configCustomerId: string
  sourceType: LeadSourceType
  spreadsheetId: string
  gid: string | null
}): void {
  contactsCache.delete(getContactsCacheKey(scope))
}

/** Canonical field on each contact row: ISO time from LeadSourceRowSeen.firstSeenAt (not from the sheet). */
const LEAD_SOURCE_CONTACT_META_FIRST_SEEN_KEY = 'odcrmFirstSeenAt'

/** Resolve sheet config: exact customer first, then any config with appliesTo ALL_ACCOUNTS for this sourceType. */
async function resolveLeadSourceConfig(
  customerId: string,
  sourceType: LeadSourceType
): Promise<LeadSourceSheetConfigRow | null> {
  const exact = await prisma.leadSourceSheetConfig.findUnique({
    where: { customerId_sourceType: { customerId, sourceType } },
  })
  if (exact?.spreadsheetId) return exact as LeadSourceSheetConfigRow
  const fallback = await prisma.leadSourceSheetConfig.findFirst({
    where: { sourceType, appliesTo: LeadSourceAppliesTo.ALL_ACCOUNTS },
  })
  return fallback?.spreadsheetId ? (fallback as LeadSourceSheetConfigRow) : null
}

function isCognismApiMode(config: LeadSourceSheetConfigRow): boolean {
  return config.sourceType === 'COGNISM' && config.providerMode === LeadSourceProviderMode.COGNISM_API
}

function buildCognismSearchBody(defaults: unknown): Record<string, unknown> {
  if (defaults && typeof defaults === 'object' && !Array.isArray(defaults)) {
    return { ...(defaults as Record<string, unknown>) }
  }
  return {}
}

function mergeCognismContactCache(
  dataScope: LeadSourceDataScope,
  columnKeys: string[],
  newFlatRows: Array<Record<string, string>>
): { columnKeys: string[]; rows: Array<Record<string, string>> } {
  const hit = getCachedContacts(dataScope)
  const keySet = new Set<string>(columnKeys)
  const byFp = new Map<string, Record<string, string>>()
  if (hit) {
    for (const r of hit.rows) {
      const fp = r['__fp']
      if (typeof fp === 'string') byFp.set(fp, r)
    }
    for (const k of hit.columnKeys) keySet.add(k)
  }
  for (const r of newFlatRows) {
    const fp = r['__fp']
    if (typeof fp === 'string') byFp.set(fp, r)
    for (const k of Object.keys(r)) {
      if (k && k !== '__fp') keySet.add(k)
    }
  }
  const merged = [...byFp.values()]
  const mergedColumns = [...keySet].filter((k) => k !== '__fp')
  setCachedContacts(dataScope, mergedColumns, merged)
  return { columnKeys: mergedColumns, rows: merged }
}

/**
 * Load the current sheet export, map to canonical rows + fingerprints, and optionally refresh the in-memory cache.
 */
async function loadLeadSourceContactsCsvIntoCache(
  config: ResolvedLeadSourceConfig,
  dataScope: LeadSourceDataScope,
  options?: { forceRefresh?: boolean }
): Promise<{ columnKeys: string[]; rows: Array<Record<string, string>> }> {
  if (options?.forceRefresh) {
    deleteCachedContacts(dataScope)
  }
  const hit = getCachedContacts(dataScope)
  if (hit && !options?.forceRefresh) {
    return { columnKeys: hit.columnKeys, rows: hit.rows }
  }
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
  setCachedContacts(dataScope, columnKeys, flat)
  return { columnKeys, rows: flat }
}

/**
 * Contacts cache: Google Sheets CSV or merged Cognism API rows (same downstream shape).
 */
async function loadLeadSourceContactsIntoCache(
  config: ResolvedLeadSourceConfig,
  dataScope: LeadSourceDataScope,
  options?: { forceRefresh?: boolean }
): Promise<{ columnKeys: string[]; rows: Array<Record<string, string>> }> {
  if (isCognismApiMode(config)) {
    if (options?.forceRefresh) {
      deleteCachedContacts(dataScope)
    }
    const hit = getCachedContacts(dataScope)
    if (hit) return { columnKeys: hit.columnKeys, rows: hit.rows }
    return { columnKeys: [], rows: [] }
  }
  return loadLeadSourceContactsCsvIntoCache(config, dataScope, options)
}

async function runCognismApiPoll(
  config: ResolvedLeadSourceConfig,
  dataScope: LeadSourceDataScope,
  now: Date
): Promise<{ totalRows: number; newRowsDetected: number }> {
  if (!config.cognismApiTokenEncrypted) {
    throw Object.assign(new Error('Cognism API token is not configured. Connect a token first.'), { status: 400 })
  }
  const apiKey = decryptLeadSourceSecret(config.cognismApiTokenEncrypted)
  const searchBody = buildCognismSearchBody(config.cognismSearchDefaults)
  let lastKey: string | undefined
  const previews: CognismSearchResultPreview[] = []
  for (let page = 0; page < COGNISM_POLL_MAX_PAGES; page++) {
    const pageRes = await cognismSearchContacts(apiKey, searchBody, {
      lastReturnedKey: lastKey,
      indexSize: COGNISM_POLL_INDEX_SIZE,
    })
    const chunk = pageRes.results ?? []
    previews.push(...chunk)
    if (!pageRes.lastReturnedKey || chunk.length === 0) break
    lastKey = pageRes.lastReturnedKey
  }
  const redeemIds = previews.map((p) => p.redeemId).filter((id): id is string => typeof id === 'string' && id.length > 0)
  const redeemedRaw: unknown[] = []
  for (let i = 0; i < redeemIds.length; i += COGNISM_REDEEM_CHUNK) {
    const slice = redeemIds.slice(i, i + COGNISM_REDEEM_CHUNK)
    const r = await cognismRedeemContacts(apiKey, slice)
    redeemedRaw.push(...(r.results ?? []))
  }
  const toCreate: Array<{
    customerId: string
    sourceType: LeadSourceType
    spreadsheetId: string
    fingerprint: string
    batchKey: string
  }> = []
  const seen = new Set<string>()
  const newFlatRows: Array<Record<string, string>> = []
  for (const raw of redeemedRaw) {
    if (!raw || typeof raw !== 'object') continue
    const row = normalizeCognismRedeemedContact(raw as Record<string, unknown>)
    const flat = cognismNormalizedToFlatRow(row)
    const canonical = { ...row.canonical }
    const fingerprint = computeFingerprint(canonical)
    if (seen.has(fingerprint)) continue
    seen.add(fingerprint)
    const client = canonical.client ?? ''
    const jobTitle = canonical.jobTitle ?? ''
    const batchKey = buildBatchKey(now, client, jobTitle)
    flat['__fp'] = fingerprint
    newFlatRows.push(flat)
    toCreate.push({
      customerId: dataScope.configCustomerId,
      sourceType: 'COGNISM',
      spreadsheetId: dataScope.spreadsheetId,
      fingerprint,
      batchKey,
    })
  }
  const result = await prisma.leadSourceRowSeen.createMany({
    data: toCreate,
    skipDuplicates: true,
  })
  const newRowsDetected = result.count
  const columnKeys = Object.keys(newFlatRows[0] ?? {}).filter((k) => k !== '__fp')
  if (newFlatRows.length > 0) {
    mergeCognismContactCache(dataScope, columnKeys, newFlatRows)
  }
  return { totalRows: redeemedRaw.length, newRowsDetected }
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
      const cognismApi =
        c && c.sourceType === 'COGNISM' && c.providerMode === LeadSourceProviderMode.COGNISM_API
      const connected = cognismApi
        ? !!c?.cognismApiTokenEncrypted
        : !!c?.spreadsheetId
      return {
        sourceType,
        displayName: c?.displayName ?? sourceType,
        connected,
        providerMode: c?.providerMode ?? (sourceType === 'COGNISM' ? LeadSourceProviderMode.SHEET : LeadSourceProviderMode.SHEET),
        cognismTokenLast4: cognismApi ? c?.cognismApiTokenLast4 ?? null : null,
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
router.get('/batches', async (req: Request, res: Response) => {
  try {
    const customerId = requireCustomerId(req, res)
    if (!customerId) return
    await ensureCustomerExists(customerId)

    const allBatches: Array<LeadSourceBatchGroupRow & { sourceType: LeadSourceType; scope: LeadSourceDataScope }> = []

    for (const sourceType of SOURCE_TYPES) {
      const config = await resolveLeadSourceConfig(customerId, sourceType)
      if (!config?.spreadsheetId) continue
      const dataScope = getLeadSourceDataScope(config)
      const grouped = await prisma.leadSourceRowSeen.groupBy({
        by: ['batchKey'],
        where: {
          customerId: dataScope.configCustomerId,
          sourceType,
          spreadsheetId: dataScope.spreadsheetId,
        },
        _count: { _all: true },
        _max: { firstSeenAt: true },
      })
      const typed = grouped as unknown as LeadSourceBatchGroupRow[]
      for (const g of typed) allBatches.push({ ...g, sourceType, scope: dataScope })
    }

    const topBatches = allBatches
      .sort((a, b) => (b._max.firstSeenAt?.getTime() ?? 0) - (a._max.firstSeenAt?.getTime() ?? 0))
      .slice(0, BATCHES_AGGREGATE_TAKE)
    const metadataByKey = await loadBatchMetadataMap(
      topBatches.map((batch) => ({ scope: batch.scope, batchKey: batch.batchKey }))
    )
    const sorted = topBatches.map((g) => {
      const batchName = metadataByKey.get(getBatchMetadataKey(g.scope, g.batchKey)) ?? null
      const fallbackLabel = buildFallbackBatchLabel(g.sourceType, g.batchKey)
      return {
        batchKey: g.batchKey,
        sourceType: g.sourceType,
        batchName,
        fallbackLabel,
        displayLabel: buildBatchDisplayLabel(g.sourceType, g.batchKey, batchName),
        count: g._count._all,
      }
    })

    res.json(sorted)
  } catch (e) {
    const err = e as Error & { status?: number }
    res.status(err.status ?? 500).json({ error: err.message ?? 'Failed to load batches' })
  }
})

async function materializeLeadSourceBatchList(
  customerId: string,
  sourceType: LeadSourceType,
  batchKey: string
): Promise<{ listId: string; name: string }> {
  const config = await resolveLeadSourceConfig(customerId, sourceType)
  if (!config) throw Object.assign(new Error('Source not connected'), { status: 404 })
  if (isCognismApiMode(config) && !config.cognismApiTokenEncrypted) {
    throw Object.assign(new Error('Source not connected'), { status: 404 })
  }
  if (!isCognismApiMode(config) && !config.spreadsheetId) {
    throw Object.assign(new Error('Source not connected'), { status: 404 })
  }
  const dataScope = getLeadSourceDataScope(config)

  const metadataRow = await prisma.leadSourceBatchMetadata.findUnique({
    where: {
      customerId_sourceType_spreadsheetId_batchKey: {
        customerId: dataScope.configCustomerId,
        sourceType: dataScope.sourceType,
        spreadsheetId: dataScope.spreadsheetId,
        batchKey,
      },
    },
    select: { operatorName: true },
  })
  const operatorName = metadataRow?.operatorName ?? null
  const displayLabel = buildBatchDisplayLabel(sourceType, batchKey, operatorName)
  const listName = buildMaterializedLeadBatchListName(sourceType, batchKey, operatorName)
  const marker = buildMaterializedLeadBatchListMarker(dataScope, batchKey)
  const legacyListName = `Lead batch: ${sourceType} — ${batchKey.slice(0, 120)}`

  let list = await prisma.contactList.findFirst({
    where: {
      customerId,
      OR: [
        { description: { contains: marker } },
        { name: legacyListName },
      ],
    },
    select: { id: true, name: true },
  })
  if (list) return { listId: list.id, name: list.name }

  const fingerprintsInBatch = await prisma.leadSourceRowSeen.findMany({
    where: {
      customerId: dataScope.configCustomerId,
      sourceType,
      spreadsheetId: dataScope.spreadsheetId,
      batchKey,
    },
    select: { fingerprint: true },
  })
  const fpSet = new Set(fingerprintsInBatch.map((r) => r.fingerprint))
  if (fpSet.size === 0) throw Object.assign(new Error('Batch has no contacts'), { status: 400 })

  let cached = getCachedContacts(dataScope)
  if (!cached) {
    cached = await loadLeadSourceContactsIntoCache(config, dataScope)
  }
  if (cached.rows.length === 0 && isCognismApiMode(config)) {
    throw Object.assign(
      new Error('No Cognism contacts in memory. Run Poll on this source again, then materialize.'),
      { status: 400 }
    )
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
      description: buildMaterializedLeadBatchListDescription(dataScope, batchKey, displayLabel),
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
  return { listId: list!.id, name: list!.name }
}

// POST /api/lead-sources/:sourceType/batches/:batchKey/materialize-list — source-aware materialize (preferred)
router.post(
  '/:sourceType/batches/:batchKey/materialize-list',
  requireMarketingMutationAuth,
  async (req: Request, res: Response) => {
    try {
      const customerId = requireCustomerId(req, res)
      if (!customerId) return
      await ensureCustomerExists(customerId)
      const sourceTypeRaw = (req.params.sourceType ?? '').trim()
      const batchKey = (req.params.batchKey ?? '').trim()
      if (!batchKey) return res.status(400).json({ error: 'batchKey is required' })
      if (!isValidSourceType(sourceTypeRaw)) {
        return res.status(400).json({ error: `Invalid sourceType. Must be one of: ${SOURCE_TYPES.join(', ')}` })
      }
      const sourceType = sourceTypeRaw
      const result = await materializeLeadSourceBatchList(customerId, sourceType, batchKey)
      res.status(201).json({ listId: result.listId, name: result.name })
    } catch (e) {
      const err = e as Error & { status?: number }
      res.status(err.status ?? 500).json({ error: err.message ?? 'Failed to materialize list' })
    }
  }
)

// POST /api/lead-sources/batches/:batchKey/materialize-list — legacy: resolve source from batchKey, then materialize.
// When the same batchKey exists under multiple source types, findFirst picks one arbitrarily. Prefer the source-aware
// POST /:sourceType/batches/:batchKey/materialize-list when sourceType is known.
router.post('/batches/:batchKey/materialize-list', requireMarketingMutationAuth, async (req: Request, res: Response) => {
  try {
    const customerId = requireCustomerId(req, res)
    if (!customerId) return
    await ensureCustomerExists(customerId)
    const batchKey = (req.params.batchKey ?? '').trim()
    if (!batchKey) return res.status(400).json({ error: 'batchKey is required' })

    const resolvedConfigs = (
      await Promise.all(SOURCE_TYPES.map(async (sourceType) => await resolveLeadSourceConfig(customerId, sourceType)))
    ).filter((config): config is ResolvedLeadSourceConfig => Boolean(config?.spreadsheetId))
    if (resolvedConfigs.length === 0) return res.status(404).json({ error: 'No lead source batches available' })
    const anyRow = await prisma.leadSourceRowSeen.findFirst({
      where: {
        batchKey,
        OR: resolvedConfigs.map((config) => ({
          customerId: config.customerId,
          sourceType: config.sourceType,
          spreadsheetId: config.spreadsheetId,
        })),
      },
      select: { sourceType: true },
    })
    if (!anyRow) return res.status(404).json({ error: 'Batch not found' })
    const result = await materializeLeadSourceBatchList(customerId, anyRow.sourceType, batchKey)
    res.status(201).json({ listId: result.listId, name: result.name })
  } catch (e) {
    const err = e as Error & { status?: number }
    res.status(err.status ?? 500).json({ error: err.message ?? 'Failed to materialize list' })
  }
})

// POST /api/lead-sources/cognism/connect — native Cognism API (token stored server-side only)
const cognismConnectSchema = z.object({
  apiToken: z.string().min(8),
  displayName: z.string().trim().min(1),
  applyToAllAccounts: z.boolean().optional().default(false),
  /** Cognism POST /api/search/contact/search JSON body (see Cognism API docs). */
  searchDefaults: z.record(z.unknown()).optional(),
})
router.post('/cognism/connect', requireMarketingMutationAuth, async (req: Request, res: Response) => {
  try {
    if (!isLeadSourceSecretEncryptionConfigured()) {
      return res.status(503).json({
        error:
          'Server is not configured to store API tokens securely (LEAD_SOURCE_SECRETS_KEY). Ask an administrator to set a 32-byte base64 key.',
      })
    }
    const parsed = cognismConnectSchema.parse(req.body)
    const customerId = requireCustomerId(req, res)
    if (!customerId) return
    await ensureCustomerExists(customerId)
    await cognismValidateApiKey(parsed.apiToken.trim())
    const enc = encryptLeadSourceSecret(parsed.apiToken.trim())
    const last4 = parsed.apiToken.trim().slice(-4)
    const appliesTo = parsed.applyToAllAccounts ? LeadSourceAppliesTo.ALL_ACCOUNTS : LeadSourceAppliesTo.CUSTOMER_ONLY
    const searchDefaults = parsed.searchDefaults
    const createData: Prisma.LeadSourceSheetConfigUncheckedCreateInput = {
      customerId,
      sourceType: 'COGNISM',
      spreadsheetId: COGNISM_API_SPREADSHEET_SENTINEL,
      gid: null,
      displayName: parsed.displayName,
      isLocked: true,
      appliesTo,
      providerMode: LeadSourceProviderMode.COGNISM_API,
      cognismApiTokenEncrypted: enc,
      cognismApiTokenLast4: last4,
      lastError: null,
    }
    if (searchDefaults !== undefined) {
      createData.cognismSearchDefaults = searchDefaults as Prisma.InputJsonValue
    }
    const updateData: Prisma.LeadSourceSheetConfigUncheckedUpdateInput = {
      displayName: parsed.displayName,
      appliesTo,
      spreadsheetId: COGNISM_API_SPREADSHEET_SENTINEL,
      gid: null,
      providerMode: LeadSourceProviderMode.COGNISM_API,
      cognismApiTokenEncrypted: enc,
      cognismApiTokenLast4: last4,
      lastError: null,
    }
    if (searchDefaults !== undefined) {
      updateData.cognismSearchDefaults = searchDefaults as Prisma.InputJsonValue
    }
    const config = await prisma.leadSourceSheetConfig.upsert({
      where: { customerId_sourceType: { customerId, sourceType: 'COGNISM' } },
      create: createData,
      update: updateData,
    })
    deleteCachedContacts(
      getLeadSourceDataScope({
        customerId: config.customerId,
        sourceType: 'COGNISM',
        spreadsheetId: COGNISM_API_SPREADSHEET_SENTINEL,
        gid: null,
      })
    )
    res.json({
      success: true,
      sourceType: config.sourceType,
      displayName: config.displayName,
      isLocked: config.isLocked,
      providerMode: config.providerMode,
      cognismTokenLast4: last4,
    })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: e.errors })
    }
    const err = e as Error & { status?: number }
    res.status(err.status ?? 500).json({ error: err.message ?? 'Cognism connect failed' })
  }
})

// POST /api/lead-sources/:sourceType/connect — set spreadsheetId + displayName
const connectSchema = z.object({
  sheetUrl: z.string().url(),
  displayName: z.string().trim().min(1),
  applyToAllAccounts: z.boolean().optional().default(false),
})
router.post('/:sourceType/connect', requireMarketingMutationAuth, async (req: Request, res: Response) => {
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
        providerMode: LeadSourceProviderMode.SHEET,
        cognismApiTokenEncrypted: null,
        cognismApiTokenLast4: null,
        cognismSearchDefaults: Prisma.JsonNull,
      },
      update: {
        spreadsheetId,
        gid,
        displayName,
        lastError: null,
        appliesTo,
        providerMode: LeadSourceProviderMode.SHEET,
        cognismApiTokenEncrypted: null,
        cognismApiTokenLast4: null,
        cognismSearchDefaults: Prisma.JsonNull,
      },
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
router.post('/:sourceType/poll', requireMarketingMutationAuth, async (req: Request, res: Response) => {
  let configForError: ResolvedLeadSourceConfig | null = null
  try {
    const customerId = requireCustomerId(req, res)
    if (!customerId) return
    const { sourceType: sourceTypeRaw } = req.params
    if (!isValidSourceType(sourceTypeRaw)) {
      return res.status(400).json({ error: `Invalid sourceType. Must be one of: ${SOURCE_TYPES.join(', ')}` })
    }
    const sourceType = sourceTypeRaw
    const config = await resolveLeadSourceConfig(customerId, sourceType)
    if (!config) {
      return res.status(404).json({ error: 'Source not connected. Connect a sheet first.' })
    }
    if (isCognismApiMode(config)) {
      if (!config.cognismApiTokenEncrypted) {
        return res.status(404).json({ error: 'Cognism API not connected. Connect an API token first.' })
      }
    } else if (!config.spreadsheetId) {
      return res.status(404).json({ error: 'Source not connected. Connect a sheet first.' })
    }
    configForError = config
    const dataScope = getLeadSourceDataScope(config)
    const now = new Date()

    if (isCognismApiMode(config)) {
      const { totalRows, newRowsDetected } = await runCognismApiPoll(config, dataScope, now)
      await prisma.leadSourceSheetConfig.update({
        where: { id: config.id },
        data: { lastFetchAt: now, lastError: null },
      })
      return res.json({
        totalRows,
        newRowsDetected,
        lastFetchAt: now.toISOString(),
      })
    }

    const csvUrl = getCsvExportUrl(config.spreadsheetId, config.gid)
    const csvText = await fetchCsvFromUrl(csvUrl)
    const { columnKeys, rows } = csvToMappedRows(csvText)
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
        customerId: dataScope.configCustomerId,
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
    deleteCachedContacts(dataScope)
    const flatRows = rows.map((r) => {
      const canonical = { ...r.canonical }
      return { ...canonical, ...r.extraFields, __fp: computeFingerprint(canonical) }
    })
    setCachedContacts(dataScope, columnKeys, flatRows)
    res.json({
      totalRows: rows.length,
      newRowsDetected,
      lastFetchAt: now.toISOString(),
    })
  } catch (e) {
    if (configForError) {
      await prisma.leadSourceSheetConfig.updateMany({
        where: { id: configForError.id },
        data: { lastError: (e as Error).message },
      }).catch(() => {})
    }
    const err = e as Error & { status?: number }
    res.status(err.status ?? 500).json({ error: err.message ?? 'Poll failed' })
  }
})

// GET /api/lead-sources/:sourceType/batches?date=YYYY-MM-DD — distinct batches (groupBy), with batch name metadata
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

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
    const dataScope = getLeadSourceDataScope(config)
    const baseWhere = {
      customerId: dataScope.configCustomerId,
      sourceType,
      spreadsheetId: dataScope.spreadsheetId,
    }
    let grouped: LeadSourceBatchGroupRow[]
    let fallback = false

    if (isIsoDate) {
      const r1 = await prisma.leadSourceRowSeen.groupBy({
        by: ['batchKey'],
        where: { ...baseWhere, batchKey: { startsWith: dateRaw } },
        _count: { _all: true },
        _max: { firstSeenAt: true },
      })
      grouped = r1 as LeadSourceBatchGroupRow[]
      if (grouped.length === 0) {
        const r2 = await prisma.leadSourceRowSeen.groupBy({
          by: ['batchKey'],
          where: baseWhere,
          _count: { _all: true },
          _max: { firstSeenAt: true },
        })
        grouped = (r2 as LeadSourceBatchGroupRow[])
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
      grouped = (r3 as LeadSourceBatchGroupRow[])
        .sort((a, b) => (b._max.firstSeenAt?.getTime() ?? 0) - (a._max.firstSeenAt?.getTime() ?? 0))
        .slice(0, BATCHES_NO_DATE_TAKE)
    }

    const metadataByKey = await loadBatchMetadataMap(
      grouped.map((g) => ({ scope: dataScope, batchKey: g.batchKey }))
    )
    const batches = grouped
      .sort((a, b) => (b._max.firstSeenAt?.getTime() ?? 0) - (a._max.firstSeenAt?.getTime() ?? 0))
      .map((g) => {
        const parsed = parseBatchKey(g.batchKey)
        const batchName = metadataByKey.get(getBatchMetadataKey(dataScope, g.batchKey)) ?? null
        const fallbackLabel = buildFallbackBatchLabel(sourceType, g.batchKey)
        return {
          batchKey: g.batchKey,
          sourceType,
          batchName,
          fallbackLabel,
          displayLabel: buildBatchDisplayLabel(sourceType, g.batchKey, batchName),
          /** Europe/London date bucket from batchKey; always present for valid keys. */
          dateBucket: parsed.date || null,
          client: normalizeBatchKeySegmentForResponse(parsed.client),
          jobTitle: normalizeBatchKeySegmentForResponse(parsed.jobTitle),
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

// PATCH /api/lead-sources/:sourceType/batches/:batchKey — set or clear operator batch name
router.patch(
  '/:sourceType/batches/:batchKey',
  requireMarketingMutationAuth,
  async (req: Request, res: Response) => {
    try {
      const customerId = requireCustomerId(req, res)
      if (!customerId) return
      const sourceTypeRaw = (req.params.sourceType ?? '').trim()
      const batchKey = (req.params.batchKey ?? '').trim()
      if (!batchKey) return res.status(400).json({ error: 'batchKey is required' })
      if (!isValidSourceType(sourceTypeRaw)) {
        return res.status(400).json({ error: `Invalid sourceType. Must be one of: ${SOURCE_TYPES.join(', ')}` })
      }
      const sourceType = sourceTypeRaw
      const body = updateLeadSourceBatchNameSchema.safeParse(req.body)
      if (!body.success) {
        return res.status(400).json({ error: 'Invalid input', details: body.error.flatten() })
      }
      const operatorName = body.data.operatorName !== undefined ? body.data.operatorName : undefined

      const config = await resolveLeadSourceConfig(customerId, sourceType)
      if (!config?.spreadsheetId) return res.status(404).json({ error: 'Source not connected' })
      const dataScope = getLeadSourceDataScope(config)

      const exists = await prisma.leadSourceRowSeen.findFirst({
        where: {
          customerId: dataScope.configCustomerId,
          sourceType,
          spreadsheetId: dataScope.spreadsheetId,
          batchKey,
        },
        select: { batchKey: true },
      })
      if (!exists) return res.status(404).json({ error: 'Batch not found' })

      const meta = await prisma.leadSourceBatchMetadata.upsert({
        where: {
          customerId_sourceType_spreadsheetId_batchKey: {
            customerId: dataScope.configCustomerId,
            sourceType,
            spreadsheetId: dataScope.spreadsheetId,
            batchKey,
          },
        },
        create: {
          customerId: dataScope.configCustomerId,
          sourceType,
          spreadsheetId: dataScope.spreadsheetId,
          batchKey,
          operatorName: operatorName ?? null,
        },
        update: { operatorName: operatorName ?? null },
        select: { operatorName: true },
      })
      const displayLabel = buildBatchDisplayLabel(sourceType, batchKey, meta.operatorName)
      res.json({ operatorName: meta.operatorName, displayLabel })
    } catch (e) {
      const err = e as Error & { status?: number }
      res.status(err.status ?? 500).json({ error: err.message ?? 'Failed to update batch name' })
    }
  }
)

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
    if (isCognismApiMode(config)) {
      return res.status(400).json({
        error: 'This Cognism source uses the API. There is no Google Sheet to open.',
      })
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
    const searchQuery = String(req.query.q ?? '').trim().toLowerCase()
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
    const dataScope = getLeadSourceDataScope(config)
    const fingerprintsInBatch = await prisma.leadSourceRowSeen.findMany({
      where: {
        customerId: dataScope.configCustomerId,
        sourceType,
        spreadsheetId: dataScope.spreadsheetId,
        batchKey,
      },
      select: { fingerprint: true, firstSeenAt: true },
    })
    const fpSet = new Set(fingerprintsInBatch.map((r) => r.fingerprint))
    const firstSeenByFingerprint = new Map(
      fingerprintsInBatch.map((row) => [row.fingerprint, row.firstSeenAt.getTime()] as const)
    )
    const rowSeenCount = fingerprintsInBatch.length
    let cached = await loadLeadSourceContactsIntoCache(config, dataScope)
    let filtered = cached.rows.filter((r: Record<string, string>) => {
      const fp = r['__fp']
      return typeof fp === 'string' && fpSet.has(fp)
    })
    // Stale in-memory CSV vs current sheet: fingerprints from DB don't match cached export (e.g. sheet edited).
    if (filtered.length === 0 && fpSet.size > 0 && !isCognismApiMode(config)) {
      cached = await loadLeadSourceContactsIntoCache(config, dataScope, { forceRefresh: true })
      filtered = cached.rows.filter((r: Record<string, string>) => {
        const fp = r['__fp']
        return typeof fp === 'string' && fpSet.has(fp)
      })
    }
    filtered.sort((a, b) => {
      const aTs = typeof a.__fp === 'string' ? firstSeenByFingerprint.get(a.__fp) ?? 0 : 0
      const bTs = typeof b.__fp === 'string' ? firstSeenByFingerprint.get(b.__fp) ?? 0 : 0
      return bTs - aTs
    })
    const metaKey = LEAD_SOURCE_CONTACT_META_FIRST_SEEN_KEY
    let returnedColumns = cached.columnKeys.filter((k) => k !== '__fp' && k !== metaKey)
    if (returnedColumns.length === 0 && cached.rows.length > 0) {
      const keySet = new Set<string>()
      for (const row of cached.rows.slice(0, 200)) {
        for (const k of Object.keys(row)) if (k && k !== '__fp' && k !== metaKey) keySet.add(k)
      }
      returnedColumns = Array.from(keySet)
    }
    const searchFiltered = searchQuery
      ? filtered.filter((row) => {
          const fp = typeof row.__fp === 'string' ? row.__fp : ''
          const ts = fp ? firstSeenByFingerprint.get(fp) : undefined
          const meta = ts ? new Date(ts).toISOString().toLowerCase() : ''
          if (meta.includes(searchQuery)) return true
          return returnedColumns.some((column) =>
            String(row[column] ?? '')
              .toLowerCase()
              .includes(searchQuery)
          )
        })
      : filtered
    const total = searchFiltered.length
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
        searchQuery,
        rowSeenCount,
        cachedRowCount: cached.rows.length,
        filteredRowCount: searchFiltered.length,
      })
    }
    const start = (page - 1) * pageSize
    const slice = searchFiltered.slice(start, start + pageSize).map((r: Record<string, string>) => {
      const { __fp, ...rest } = r
      const fp = typeof __fp === 'string' ? __fp : ''
      const ts = fp ? firstSeenByFingerprint.get(fp) : undefined
      const base = normalizeRowKeepKeys(rest as Record<string, string>, returnedColumns)
      return {
        ...base,
        [metaKey]: ts ? new Date(ts).toISOString() : '',
      }
    })
    res.json({
      columns: [metaKey, ...returnedColumns],
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
