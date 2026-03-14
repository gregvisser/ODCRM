/**
 * Live leads truth surface (normalized Stage 1 foundation).
 * - ODCRM reads from normalized lead_records for all clients.
 * - For sheet-backed clients, Google Sheets is supported as external sync source via importer.
 */
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { triggerManualSync } from '../workers/leadsSync.js'
import { buildManualLeadCreatePayload } from '../services/leadCreateContract.js'
import { retryLeadOutboundSync, syncManualLeadEditOutbound, syncManualLeadOutbound } from '../services/leadOutboundSync.js'
import { requireCustomerId } from '../utils/tenantId.js'

const router = Router()
const METRICS_TIMEZONE = process.env.LEADS_METRICS_TIMEZONE || 'Europe/London'

type TruthSource = 'google_sheets' | 'db'
type Freshness = 'live' | 'diagnostic_stale'
type LiveLeadErrorCode =
  | 'missing_sheet_url'
  | 'never_synced'
  | 'stale_sync'
  | 'sync_failed'
  | 'zero_rows_imported'
  | 'unreadable_sheet'

type SyncMeta = {
  mode: 'sheet_backed' | 'db_backed'
  status: string | null
  lastSyncAt: string | null
  lastSuccessAt: string | null
  lastInboundSyncAt: string | null
  lastOutboundSyncAt: string | null
  lastError: string | null
  rowCount: number
}

const SHEET_METRICS_FRESH_MS = 15 * 60 * 1000

function parsePositiveInt(value: unknown, fallback: number, opts?: { min?: number; max?: number }) {
  const min = opts?.min ?? 1
  const max = opts?.max ?? Number.MAX_SAFE_INTEGER
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function classifySheetSyncError(message: string | null | undefined): LiveLeadErrorCode | null {
  const text = String(message || '').toLowerCase()
  if (!text) return null
  if (
    text.includes('invalid google sheets url') ||
    text.includes('sheet is not publicly accessible') ||
    text.includes('sheet not found') ||
    text.includes('html instead of csv') ||
    text.includes('url did not return csv')
  ) {
    return 'unreadable_sheet'
  }
  if (text.includes('0 rows')) return 'zero_rows_imported'
  return 'sync_failed'
}

function buildSheetTruthStatus(params: {
  sourceOfTruth: TruthSource
  configuredSheetUrl: string
  sync: SyncMeta
  rowCount: number
  bootstrap: { started: boolean; error: string | null }
}): {
  authoritative: boolean
  dataFreshness: Freshness
  warning?: string
  hint?: string
  errorCode?: LiveLeadErrorCode
} {
  const { sourceOfTruth, configuredSheetUrl, sync, rowCount, bootstrap } = params
  const syncHasFailedWithoutStatus = sync.status === 'syncing' && !sync.lastSuccessAt && Boolean(sync.lastError)
  const emptySheetState =
    rowCount === 0 &&
    (
      (sync.lastSuccessAt && sync.status === 'success') ||
      classifySheetSyncError(sync.lastError) === 'zero_rows_imported'
    )

  if (sourceOfTruth === 'db') {
    return { authoritative: true, dataFreshness: 'live' }
  }

  if (!configuredSheetUrl.trim()) {
    return {
      authoritative: false,
      dataFreshness: 'diagnostic_stale',
      warning: 'This customer has no leads reporting sheet configured.',
      errorCode: 'missing_sheet_url',
    }
  }

  if (bootstrap.error) {
    const errorCode = classifySheetSyncError(bootstrap.error) ?? 'sync_failed'
    return {
      authoritative: false,
      dataFreshness: 'diagnostic_stale',
      warning: `Initial sheet sync failed: ${bootstrap.error}`,
      errorCode,
    }
  }

  if (emptySheetState) {
    return {
      authoritative: true,
      dataFreshness: 'live',
      hint: 'The linked Google Sheet is connected and currently empty.',
    }
  }

  if (sync.status === 'error' || syncHasFailedWithoutStatus) {
    const errorCode = classifySheetSyncError(sync.lastError) ?? 'sync_failed'
    return {
      authoritative: false,
      dataFreshness: 'diagnostic_stale',
      warning: sync.lastError || 'The most recent sheet sync failed.',
      errorCode,
    }
  }

  if (!sync.lastSuccessAt) {
    if (bootstrap.started && rowCount === 0) {
      return {
        authoritative: true,
        dataFreshness: 'live',
        hint: 'The linked Google Sheet is connected and currently empty.',
      }
    }

    return {
      authoritative: false,
      dataFreshness: 'diagnostic_stale',
      warning: 'This sheet-backed client has not completed a successful lead sync yet.',
      errorCode: 'never_synced',
    }
  }

  const lastSuccessMs = Date.parse(sync.lastSuccessAt)
  if (!Number.isFinite(lastSuccessMs) || (Date.now() - lastSuccessMs) > SHEET_METRICS_FRESH_MS) {
    return {
      authoritative: false,
      dataFreshness: 'diagnostic_stale',
      warning: 'Live sheet-backed lead metrics are stale and need a refresh.',
      errorCode: 'stale_sync',
    }
  }

  return {
    authoritative: true,
    dataFreshness: 'live',
  }
}

type LeadResponse = {
  id: string
  customerId: string
  occurredAt: string | null
  source: string | null
  owner: string | null
  fullName: string | null
  email: string | null
  phone: string | null
  company: string | null
  jobTitle: string | null
  location: string | null
  status: string | null
  notes: string | null
  syncStatus: string | null
  createdAt: string
}

function mapLeadResponse(lead: {
  id: string
  customerId: string
  occurredAt: Date | null
  source: string | null
  owner: string | null
  fullName: string | null
  email: string | null
  phone: string | null
  company: string | null
  jobTitle: string | null
  location: string | null
  status: string | null
  notes: string | null
  syncStatus: string | null
  createdAt: Date
}): LeadResponse {
  return {
    id: lead.id,
    customerId: lead.customerId,
    occurredAt: lead.occurredAt ? lead.occurredAt.toISOString() : null,
    source: lead.source,
    owner: lead.owner,
    fullName: lead.fullName,
    email: lead.email,
    phone: lead.phone,
    company: lead.company,
    jobTitle: lead.jobTitle,
    location: lead.location,
    status: lead.status,
    notes: lead.notes,
    syncStatus: lead.syncStatus,
    createdAt: lead.createdAt.toISOString(),
  }
}

function formatDateInMetricsTz(date: Date): string {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: METRICS_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
  const parts = fmt.formatToParts(date)
  const get = (type: string) => parts.find(p => p.type === type)?.value || '0'
  return `${get('year')}-${get('month')}-${get('day')}`
}

function getHourInMetricsTz(date: Date): number {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: METRICS_TIMEZONE, hour: '2-digit', hour12: false })
  return parseInt(fmt.format(date), 10)
}

function midnightInMetricsTzUtc(y: number, m: number, d: number): Date {
  for (let hourUtc = -2; hourUtc <= 2; hourUtc++) {
    const t = new Date(Date.UTC(y, m, d, hourUtc, 0, 0, 0))
    if (formatDateInMetricsTz(t) === `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` && getHourInMetricsTz(t) === 0) {
      return t
    }
  }
  const t = new Date(Date.UTC(y, m, d, 0, 0, 0, 0))
  const inLondon = formatDateInMetricsTz(t)
  const [ly, lm, ld] = inLondon.split('-').map(Number)
  if (ly === y && lm === m + 1 && ld === d && getHourInMetricsTz(t) === 1) {
    return new Date(Date.UTC(y, m, d, -1, 0, 0, 0))
  }
  if (ly === y && lm === m + 1 && ld === d - 1 && getHourInMetricsTz(t) === 23) {
    return new Date(Date.UTC(y, m, d, 1, 0, 0, 0))
  }
  return t
}

function getMetricsTimeRangesUtc(): {
  todayStart: Date
  todayEnd: Date
  weekStart: Date
  weekEnd: Date
  monthStart: Date
  monthEnd: Date
} {
  const now = new Date()
  const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: METRICS_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
  const weekdayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: METRICS_TIMEZONE, weekday: 'short' })
  const parts = dateFmt.formatToParts(now)
  const get = (type: string) => parts.find(p => p.type === type)?.value || '0'
  const y = parseInt(get('year'), 10)
  const m = parseInt(get('month'), 10) - 1
  const d = parseInt(get('day'), 10)

  const todayStart = midnightInMetricsTzUtc(y, m, d)
  const todayEnd = midnightInMetricsTzUtc(y, m, d + 1)

  const weekdayShort = weekdayFmt.format(now)
  const WEEKDAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
  const dow = WEEKDAY_ORDER.indexOf(weekdayShort as (typeof WEEKDAY_ORDER)[number])
  const mondayOffset = dow < 0 ? 0 : -dow
  const mondayD = d + mondayOffset
  const weekStart = midnightInMetricsTzUtc(y, m, mondayD)
  const nextMonday = new Date(Date.UTC(y, m, mondayD + 7, 12, 0, 0))
  const weekEnd = midnightInMetricsTzUtc(nextMonday.getUTCFullYear(), nextMonday.getUTCMonth(), nextMonday.getUTCDate())

  const monthStart = midnightInMetricsTzUtc(y, m, 1)
  const monthEnd = midnightInMetricsTzUtc(y, m + 1, 1)

  return { todayStart, todayEnd, weekStart, weekEnd, monthStart, monthEnd }
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value
  if (value == null) return ''
  return String(value)
}

function asRawMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {}
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>((acc, [k, v]) => {
    acc[k] = asString(v)
    return acc
  }, {})
}

function isBlank(value: unknown): boolean {
  if (value == null) return true
  return String(value).trim() === ''
}

function deriveDisplayColumns(rows: Array<{ occurredAt: string | null; source: string | null; owner: string | null; syncStatus: string | null; raw: Record<string, string>; fullName: string | null; email: string | null; phone: string | null; company: string | null; jobTitle: string | null; location: string | null; status: string | null; notes: string | null }>): string[] {
  const canonicalCandidates: Array<{ label: string; getter: (row: (typeof rows)[number]) => unknown }> = [
    { label: 'Date', getter: (row) => row.occurredAt },
    { label: 'Name', getter: (row) => row.fullName },
    { label: 'Email', getter: (row) => row.email },
    { label: 'Phone', getter: (row) => row.phone },
    { label: 'Company', getter: (row) => row.company },
    { label: 'Job Title', getter: (row) => row.jobTitle },
    { label: 'Location', getter: (row) => row.location },
    { label: 'Channel', getter: (row) => row.source },
    { label: 'Owner', getter: (row) => row.owner },
    { label: 'Status', getter: (row) => row.status },
    { label: 'Sync Status', getter: (row) => row.syncStatus },
    { label: 'Notes', getter: (row) => row.notes },
  ]

  const canonical = canonicalCandidates
    .filter((col) => rows.some((row) => !isBlank(col.getter(row))))
    .map((col) => col.label)

  const rawKeys = new Set<string>()
  for (const row of rows) {
    Object.entries(row.raw).forEach(([key, value]) => {
      if (!isBlank(value)) rawKeys.add(key)
    })
  }

  const canonicalRawAliases = new Set(['Date', 'Name', 'Email', 'Phone', 'Company', 'Job Title', 'Location', 'Channel', 'Owner', 'Status', 'Sync Status', 'Notes'])
  const raw = Array.from(rawKeys).filter((key) => !canonicalRawAliases.has(key)).sort((a, b) => a.localeCompare(b))
  return [...canonical, ...raw]
}

function mapDbLeadRows(rows: Array<{
  id: string
  occurredAt: Date | null
  createdAt: Date
  externalSourceType?: string | null
  source: string | null
  owner: string | null
  company: string | null
  fullName: string | null
  email: string | null
  phone: string | null
  jobTitle: string | null
  location: string | null
  status: string | null
  syncStatus: string | null
  notes: string | null
  accountName: string
  data: unknown
}>): Array<{
  id: string
  occurredAt: string | null
  source: string | null
  owner: string | null
  company: string | null
  name: string | null
  fullName: string | null
  email: string | null
  phone: string | null
  jobTitle: string | null
  location: string | null
  status: string | null
  syncStatus: string | null
  notes: string | null
  raw: Record<string, string>
}> {
  return rows.map((row) => {
    const raw = asRawMap(row.data)
    const occurredAt = row.occurredAt ? row.occurredAt.toISOString() : null
    const source = row.source ?? (raw['Channel of Lead'] || raw['channel'] || raw['Source'] || null)
    const owner = row.owner ?? (raw['OD Team Member'] || raw['Owner'] || raw['owner'] || null)
    const company = row.company ?? (raw['Company'] || raw['company'] || row.accountName || null)
    const fullName = row.fullName ?? (raw['Name'] || raw['name'] || null)
    const email = row.email ?? (raw['Email'] || raw['email'] || null)
    const phone = row.phone ?? (raw['Phone'] || raw['phone'] || raw['Mobile'] || raw['mobile'] || null)
    const jobTitle = row.jobTitle ?? (raw['Job Title'] || raw['jobTitle'] || raw['Title'] || null)
    const location = row.location ?? (raw['Location'] || raw['location'] || null)
    const notes = row.notes ?? (raw['Notes'] || raw['notes'] || null)

    return {
      id: row.id,
      occurredAt,
      source,
      owner,
      company,
      name: fullName,
      fullName,
      email,
      phone,
      jobTitle,
      location,
      status: row.status,
      syncStatus: row.syncStatus,
      notes,
      raw,
    }
  })
}

function getLeadChannelValue(row: {
  source: string | null
  raw: Record<string, string>
}): string {
  return String(row.source ?? row.raw['Channel of Lead'] ?? row.raw['Channel'] ?? '').trim()
}

async function getCustomerTruthContext(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, name: true, leadsReportingUrl: true },
  })
  if (!customer) return null
  const configuredSheetUrl = (customer.leadsReportingUrl || '').trim()
  const sourceOfTruth: TruthSource = configuredSheetUrl ? 'google_sheets' : 'db'
  return {
    customer,
    configuredSheetUrl,
    sourceOfTruth,
  }
}

async function getSyncMeta(customerId: string, sourceOfTruth: TruthSource): Promise<SyncMeta> {
  const state = await prisma.leadSyncState.findUnique({ where: { customerId } })
  return {
    mode: sourceOfTruth === 'google_sheets' ? 'sheet_backed' : 'db_backed',
    status: state?.syncStatus ?? null,
    lastSyncAt: state?.lastSyncAt ? state.lastSyncAt.toISOString() : null,
    lastSuccessAt: state?.lastSuccessAt ? state.lastSuccessAt.toISOString() : null,
    lastInboundSyncAt: state?.lastInboundSyncAt ? state.lastInboundSyncAt.toISOString() : null,
    lastOutboundSyncAt: state?.lastOutboundSyncAt ? state.lastOutboundSyncAt.toISOString() : null,
    lastError: state?.lastError ?? null,
    rowCount: state?.rowCount ?? 0,
  }
}

async function maybeBootstrapSheetBackedLeads(params: {
  customerId: string
  sourceOfTruth: TruthSource
  rowCount: number
  sync: SyncMeta
}): Promise<{ started: boolean; error: string | null }> {
  const { customerId, sourceOfTruth, rowCount, sync } = params
  if (sourceOfTruth !== 'google_sheets') return { started: false, error: null }
  if (rowCount > 0) return { started: false, error: null }
  if (sync.lastSyncAt || sync.lastInboundSyncAt || sync.lastSuccessAt) return { started: false, error: null }

  try {
    // First-access bootstrap for sheet-backed clients that have never synced.
    await triggerManualSync(prisma, customerId)
    return { started: true, error: null }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to bootstrap sheet sync'
    return { started: false, error: message }
  }
}

const createLeadSchema = z.object({
  occurredAt: z.string().optional().nullable(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  fullName: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  jobTitle: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  owner: z.string().optional().nullable(),
  status: z.enum(['new', 'qualified', 'nurturing', 'closed', 'converted']).optional().nullable(),
  notes: z.string().optional().nullable(),
})

function normalizeText(value: unknown): string | null {
  if (value == null) return null
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

function parseOptionalDate(value: unknown): Date | null {
  const text = normalizeText(value)
  if (!text) return null
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function asMutableMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {}
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>((acc, [k, v]) => {
    acc[k] = asString(v)
    return acc
  }, {})
}

/**
 * POST /api/live/leads
 * Create normalized lead in ODCRM operational DB layer.
 */
router.post('/leads', async (req, res) => {
  const customerId = requireCustomerId(req, res)
  if (!customerId) return

  const parsed = createLeadSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid lead payload', details: parsed.error.flatten() })
  }

  try {
    const context = await getCustomerTruthContext(customerId)
    if (!context) return res.status(404).json({ error: 'Customer not found' })

    const values = parsed.data
    const hasIdentity = [values.fullName, values.email, values.company, values.phone].some((v) => typeof v === 'string' && v.trim() !== '')
    if (!hasIdentity) {
      return res.status(400).json({ error: 'At least one of fullName, email, company, or phone is required' })
    }

    const payload = buildManualLeadCreatePayload({
      customerId,
      accountName: context.customer.name || '',
      sourceOfTruth: context.sourceOfTruth,
      values,
    })

    const created = await prisma.leadRecord.create({
      data: {
        customerId,
        accountName: context.customer.name || '',
        data: payload.rawData,
        normalizedData: payload.normalizedData,
        sourceUrl: context.sourceOfTruth === 'google_sheets' ? context.configuredSheetUrl : null,
        sheetGid: null,
        externalSourceType: payload.externalSourceType,
        externalId: payload.externalId,
        externalRowFingerprint: null,
        occurredAt: payload.occurredAt,
        source: payload.source,
        owner: payload.owner,
        firstName: payload.firstName,
        lastName: payload.lastName,
        fullName: payload.fullName,
        email: payload.email,
        phone: payload.phone,
        company: payload.company,
        jobTitle: payload.jobTitle,
        location: payload.location,
        status: payload.leadStatus,
        notes: payload.notes,
        syncStatus: payload.syncStatus,
        syncError: payload.syncError,
        lastInboundSyncAt: payload.lastInboundSyncAt,
        lastOutboundSyncAt: payload.lastOutboundSyncAt,
      },
      select: {
        id: true,
        customerId: true,
        occurredAt: true,
        source: true,
        owner: true,
        fullName: true,
        email: true,
        phone: true,
        company: true,
        jobTitle: true,
        location: true,
        status: true,
        notes: true,
        syncStatus: true,
        createdAt: true,
      },
    })
    let outboundSync = {
      required: context.sourceOfTruth === 'google_sheets',
      status: payload.syncStatus,
      note:
        context.sourceOfTruth === 'google_sheets'
          ? 'Saved in ODCRM. Outbound Google Sheets sync is pending.'
          : 'No outbound sheet sync required for DB-backed client.',
      error: null as string | null,
      rowReference: null as string | null,
      rowNumber: null as number | null,
      operation: 'create' as 'create' | 'update',
    }

    let leadForResponse: LeadResponse = mapLeadResponse(created)
    if (context.sourceOfTruth === 'google_sheets') {
      const outbound = await syncManualLeadOutbound({
        prisma,
        customerId,
        leadId: created.id,
      })
      outboundSync = {
        required: true,
        status: outbound.status,
        note: outbound.note,
        error: outbound.error,
        rowReference: outbound.rowReference,
        rowNumber: outbound.rowNumber,
        operation: outbound.operation,
      }
      leadForResponse = outbound.lead
    }

    return res.status(201).json({
      lead: leadForResponse,
      sourceOfTruth: context.sourceOfTruth,
      outboundSync,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create lead'
    return res.status(500).json({ error: message })
  }
})

/**
 * PUT /api/live/leads/:leadId
 * Update normalized lead in ODCRM; for sheet-backed clients, DB update first then outbound row update.
 */
router.put('/leads/:leadId', async (req, res) => {
  const customerId = requireCustomerId(req, res)
  if (!customerId) return

  const parsed = createLeadSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid lead payload', details: parsed.error.flatten() })
  }

  try {
    const context = await getCustomerTruthContext(customerId)
    if (!context) return res.status(404).json({ error: 'Customer not found' })

    const leadId = String(req.params.leadId || '').trim()
    if (!leadId) return res.status(400).json({ error: 'Lead id is required' })

    const existing = await prisma.leadRecord.findFirst({
      where: { id: leadId, customerId },
      select: {
        id: true,
        customerId: true,
        sourceUrl: true,
        sheetGid: true,
        externalId: true,
        externalSourceType: true,
        externalRowFingerprint: true,
        occurredAt: true,
        source: true,
        owner: true,
        firstName: true,
        lastName: true,
        fullName: true,
        email: true,
        phone: true,
        company: true,
        jobTitle: true,
        location: true,
        status: true,
        notes: true,
        syncStatus: true,
        syncError: true,
        lastInboundSyncAt: true,
        lastOutboundSyncAt: true,
        createdAt: true,
        accountName: true,
        data: true,
        normalizedData: true,
      },
    })
    if (!existing) return res.status(404).json({ error: 'Lead not found for customer' })

    const values = parsed.data
    const resolveText = (incoming: unknown, current: string | null): string | null => {
      if (incoming === undefined) return current
      return normalizeText(incoming)
    }

    const occurredAt = values.occurredAt === undefined ? existing.occurredAt : parseOptionalDate(values.occurredAt)
    const fullName = resolveText(values.fullName, existing.fullName)
    const firstName = resolveText(values.firstName, existing.firstName)
    const lastName = resolveText(values.lastName, existing.lastName)
    const email = resolveText(values.email, existing.email)?.toLowerCase() || null
    const phone = resolveText(values.phone, existing.phone)
    const company = resolveText(values.company, existing.company)
    const jobTitle = resolveText(values.jobTitle, existing.jobTitle)
    const location = resolveText(values.location, existing.location)
    const source = resolveText(values.source, existing.source)
    const owner = resolveText(values.owner, existing.owner)
    const notes = resolveText(values.notes, existing.notes)
    const status = values.status === undefined ? existing.status : values.status

    const hasIdentity = [fullName, email, company, phone].some((v) => typeof v === 'string' && v.trim() !== '')
    if (!hasIdentity) {
      return res.status(400).json({ error: 'At least one of fullName, email, company, or phone is required' })
    }

    const raw = asMutableMap(existing.data)
    raw.Date = occurredAt ? occurredAt.toISOString().slice(0, 10) : ''
    raw.Name = fullName || ''
    raw['First Name'] = firstName || ''
    raw['Last Name'] = lastName || ''
    raw.Email = email || ''
    raw.Phone = phone || ''
    raw.Company = company || ''
    raw['Job Title'] = jobTitle || ''
    raw.Location = location || ''
    raw.Source = source || ''
    raw.Owner = owner || ''
    raw.Status = status || ''
    raw.Notes = notes || ''

    const normalizedBase =
      typeof existing.normalizedData === 'object' && existing.normalizedData != null
        ? (existing.normalizedData as Record<string, unknown>)
        : {}
    const previousSync =
      normalizedBase.sync && typeof normalizedBase.sync === 'object'
        ? (normalizedBase.sync as Record<string, unknown>)
        : {}
    const nowIso = new Date().toISOString()
    const pendingStatus = context.sourceOfTruth === 'google_sheets' ? 'pending_outbound' : 'synced'
    const normalizedData = {
      ...normalizedBase,
      canonical: {
        occurredAt: occurredAt ? occurredAt.toISOString() : null,
        source,
        owner,
        fullName,
        firstName,
        lastName,
        email,
        phone,
        company,
        jobTitle,
        location,
        status: status || 'new',
        notes,
      },
      sync: {
        ...previousSync,
        sourceType: 'odcrm_manual',
        status: pendingStatus,
        error: null,
        pendingOperation: context.sourceOfTruth === 'google_sheets' ? 'update' : null,
        lastOperation: 'update',
        lastEditOrigin: 'odcrm',
        lastEditAt: nowIso,
      },
    }

    const edited = await prisma.leadRecord.update({
      where: { id: existing.id },
      data: {
        data: raw,
        normalizedData,
        occurredAt,
        source,
        owner,
        firstName,
        lastName,
        fullName,
        email,
        phone,
        company,
        jobTitle,
        location,
        status,
        notes,
        syncStatus: pendingStatus,
        syncError: null,
      },
      select: {
        id: true,
        customerId: true,
        occurredAt: true,
        source: true,
        owner: true,
        fullName: true,
        email: true,
        phone: true,
        company: true,
        jobTitle: true,
        location: true,
        status: true,
        notes: true,
        syncStatus: true,
        createdAt: true,
      },
    })

    let outboundSync = {
      required: context.sourceOfTruth === 'google_sheets',
      status: pendingStatus,
      note:
        context.sourceOfTruth === 'google_sheets'
          ? 'Lead updated in ODCRM. Outbound Google Sheets row sync is pending.'
          : 'No outbound sheet sync required for DB-backed client.',
      error: null as string | null,
      rowReference: null as string | null,
      rowNumber: null as number | null,
      operation: 'update' as 'create' | 'update',
    }

    let leadForResponse: LeadResponse = mapLeadResponse(edited)
    if (context.sourceOfTruth === 'google_sheets') {
      const outbound = await syncManualLeadEditOutbound({
        prisma,
        customerId,
        leadId: existing.id,
      })
      outboundSync = {
        required: true,
        status: outbound.status,
        note: outbound.note,
        error: outbound.error,
        rowReference: outbound.rowReference,
        rowNumber: outbound.rowNumber,
        operation: outbound.operation,
      }
      leadForResponse = outbound.lead
    }

    return res.json({
      lead: leadForResponse,
      sourceOfTruth: context.sourceOfTruth,
      outboundSync,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update lead'
    return res.status(500).json({ error: message })
  }
})

/**
 * POST /api/live/leads/:leadId/retry-outbound
 * Retry outbound Google Sheets sync for one lead.
 */
router.post('/leads/:leadId/retry-outbound', async (req, res) => {
  const customerId = requireCustomerId(req, res)
  if (!customerId) return

  try {
    const context = await getCustomerTruthContext(customerId)
    if (!context) return res.status(404).json({ error: 'Customer not found' })
    if (context.sourceOfTruth !== 'google_sheets') {
      return res.status(400).json({ error: 'Outbound sheet sync retry is only available for sheet-backed clients' })
    }

    const leadId = String(req.params.leadId || '').trim()
    if (!leadId) return res.status(400).json({ error: 'Lead id is required' })

    const outbound = await retryLeadOutboundSync({
      prisma,
      customerId,
      leadId,
    })

    return res.json({
      lead: outbound.lead,
      sourceOfTruth: context.sourceOfTruth,
      outboundSync: {
        required: true,
        status: outbound.status,
        note: outbound.note,
        error: outbound.error,
        rowReference: outbound.rowReference,
        rowNumber: outbound.rowNumber,
        operation: outbound.operation,
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to retry outbound lead sync'
    return res.status(500).json({ error: message })
  }
})

/**
 * POST /api/live/leads/import
 * Trigger inbound Google Sheets -> normalized ODCRM lead mirror sync for sheet-backed clients.
 */
router.post('/leads/import', async (req, res) => {
  const customerId = requireCustomerId(req, res)
  if (!customerId) return

  try {
    const context = await getCustomerTruthContext(customerId)
    if (!context) return res.status(404).json({ error: 'Customer not found' })

    if (context.sourceOfTruth !== 'google_sheets') {
      return res.status(400).json({ error: 'Inbound sheet import is only available for sheet-backed clients' })
    }

    await triggerManualSync(prisma, customerId)
    const sync = await getSyncMeta(customerId, context.sourceOfTruth)
    return res.json({
      customerId,
      sourceOfTruth: context.sourceOfTruth,
      sync,
      importedAt: new Date().toISOString(),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to import leads'
    return res.status(500).json({ error: message })
  }
})

/**
 * GET /api/live/leads
 */
router.get('/leads', async (req, res) => {
  const customerId = requireCustomerId(req, res)
  if (!customerId) return

  try {
    const requestedPage = parsePositiveInt(req.query.page, 1, { min: 1 })
    const pageSize = parsePositiveInt(req.query.pageSize, 50, { min: 1, max: 200 })
    const channelFilter = String(req.query.channel || '').trim().toLowerCase()
    const paginationRequested = req.query.page != null || req.query.pageSize != null
    const context = await getCustomerTruthContext(customerId)
    if (!context) {
      return res.status(404).json({ error: 'Customer not found' })
    }

    const { customer, configuredSheetUrl, sourceOfTruth } = context

    let dbRows = await prisma.leadRecord.findMany({
      where: { customerId },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        occurredAt: true,
        createdAt: true,
        source: true,
        owner: true,
        company: true,
        fullName: true,
        email: true,
        phone: true,
        jobTitle: true,
        location: true,
        status: true,
        syncStatus: true,
        notes: true,
        accountName: true,
        data: true,
      },
    })

    let leads = mapDbLeadRows(dbRows)
    let sync = await getSyncMeta(customerId, sourceOfTruth)
    const bootstrap = await maybeBootstrapSheetBackedLeads({
      customerId,
      sourceOfTruth,
      rowCount: leads.length,
      sync,
    })
    if (bootstrap.started) {
      dbRows = await prisma.leadRecord.findMany({
        where: { customerId },
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          occurredAt: true,
          createdAt: true,
          source: true,
          owner: true,
          company: true,
          fullName: true,
          email: true,
          phone: true,
          jobTitle: true,
          location: true,
          status: true,
          syncStatus: true,
          notes: true,
          accountName: true,
          data: true,
        },
      })
      leads = mapDbLeadRows(dbRows)
      sync = await getSyncMeta(customerId, sourceOfTruth)
    }
    const availableChannels = Array.from(
      new Set(
        leads
          .map((lead) => getLeadChannelValue(lead))
          .filter((value) => value.length > 0),
      ),
    ).sort((a, b) => a.localeCompare(b))

    const filteredLeads = channelFilter
      ? leads.filter((lead) => getLeadChannelValue(lead).toLowerCase().includes(channelFilter))
      : leads

    const total = filteredLeads.length
    const totalPages = paginationRequested ? Math.max(1, Math.ceil(total / pageSize)) : 1
    const page = paginationRequested ? Math.min(requestedPage, totalPages) : 1
    const pageSlice = paginationRequested
      ? filteredLeads.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize)
      : filteredLeads

    const displayColumns = deriveDisplayColumns(filteredLeads)

    const truth = buildSheetTruthStatus({
      sourceOfTruth,
      configuredSheetUrl,
      sync,
      rowCount: leads.length,
      bootstrap,
    })

    return res.json({
      customerId,
      customerName: customer.name || '',
      rowCount: leads.length,
      total,
      totalPages,
      page,
      pageSize,
      leads: pageSlice,
      availableChannels,
      displayColumns,
      queriedAt: new Date().toISOString(),
      sourceUrl: sourceOfTruth === 'google_sheets' ? configuredSheetUrl : null,
      sourceOfTruth,
      authoritative: truth.authoritative,
      dataFreshness: truth.dataFreshness,
      staleFallbackUsed: false,
      warning: truth.warning,
      hint: truth.hint,
      errorCode: truth.errorCode,
      sync,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to fetch leads'
    return res.status(500).json({ error: message })
  }
})

/**
 * GET /api/live/leads/metrics
 */
router.get('/leads/metrics', async (req, res) => {
  const customerId = requireCustomerId(req, res)
  if (!customerId) return

  try {
    const context = await getCustomerTruthContext(customerId)
    if (!context) {
      return res.status(404).json({ error: 'Customer not found' })
    }

    const { sourceOfTruth, configuredSheetUrl } = context
    const { todayStart, todayEnd, weekStart, weekEnd, monthStart, monthEnd } = getMetricsTimeRangesUtc()

    let dbRows = await prisma.leadRecord.findMany({
      where: { customerId },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        occurredAt: true,
        createdAt: true,
        externalSourceType: true,
        source: true,
        owner: true,
        accountName: true,
        company: true,
        fullName: true,
        email: true,
        phone: true,
        jobTitle: true,
        location: true,
        status: true,
        syncStatus: true,
        notes: true,
        data: true,
      },
    })

    let leads = mapDbLeadRows(dbRows).map((lead, idx) => {
      if (lead.occurredAt) return lead
      const createdAt = dbRows[idx]?.createdAt
      const allowCreatedAtFallback = dbRows[idx]?.externalSourceType === 'odcrm_manual'
      return {
        ...lead,
        occurredAt: allowCreatedAtFallback && createdAt ? createdAt.toISOString() : null,
      }
    })

    let sync = await getSyncMeta(customerId, sourceOfTruth)
    const bootstrap = await maybeBootstrapSheetBackedLeads({
      customerId,
      sourceOfTruth,
      rowCount: leads.length,
      sync,
    })
    if (bootstrap.started) {
      dbRows = await prisma.leadRecord.findMany({
        where: { customerId },
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          occurredAt: true,
          createdAt: true,
          externalSourceType: true,
          source: true,
          owner: true,
          accountName: true,
          company: true,
          fullName: true,
          email: true,
          phone: true,
          jobTitle: true,
          location: true,
          status: true,
          syncStatus: true,
          notes: true,
          data: true,
        },
      })
      leads = mapDbLeadRows(dbRows).map((lead, idx) => {
        if (lead.occurredAt) return lead
        const createdAt = dbRows[idx]?.createdAt
        const allowCreatedAtFallback = dbRows[idx]?.externalSourceType === 'odcrm_manual'
        return {
          ...lead,
          occurredAt: allowCreatedAtFallback && createdAt ? createdAt.toISOString() : null,
        }
      })
      sync = await getSyncMeta(customerId, sourceOfTruth)
    }

    let todayLeads = 0
    let weekLeads = 0
    let monthLeads = 0
    const breakdownBySource: Record<string, number> = {}
    const breakdownByOwner: Record<string, number> = {}

    for (const row of leads) {
      const at = row.occurredAt ? new Date(row.occurredAt) : null
      if (at && at >= todayStart && at < todayEnd) todayLeads++
      if (at && at >= weekStart && at < weekEnd) weekLeads++
      if (at && at >= monthStart && at < monthEnd) monthLeads++
      if (at && at >= weekStart && at < weekEnd) {
        const source = row.source && String(row.source).trim() ? String(row.source).trim() : '(none)'
        const owner = row.owner && String(row.owner).trim() ? String(row.owner).trim() : '(none)'
        breakdownBySource[source] = (breakdownBySource[source] || 0) + 1
        breakdownByOwner[owner] = (breakdownByOwner[owner] || 0) + 1
      }
    }

    const truth = buildSheetTruthStatus({
      sourceOfTruth,
      configuredSheetUrl,
      sync,
      rowCount: leads.length,
      bootstrap,
    })

    return res.json({
      customerId,
      totalLeads: leads.length,
      todayLeads,
      weekLeads,
      monthLeads,
      counts: { today: todayLeads, week: weekLeads, month: monthLeads, total: leads.length },
      breakdownBySource,
      breakdownByOwner,
      rowCount: leads.length,
      queriedAt: new Date().toISOString(),
      sourceUrl: sourceOfTruth === 'google_sheets' ? configuredSheetUrl : null,
      sourceOfTruth,
      authoritative: truth.authoritative,
      dataFreshness: truth.dataFreshness,
      staleFallbackUsed: false,
      warning: truth.warning,
      hint: truth.hint,
      errorCode: truth.errorCode,
      sync,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to fetch lead metrics'
    return res.status(500).json({ error: message })
  }
})

export default router
