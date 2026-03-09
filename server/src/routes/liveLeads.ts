/**
 * Live leads truth surface (normalized Stage 1 foundation).
 * - ODCRM reads from normalized lead_records for all clients.
 * - For sheet-backed clients, Google Sheets is supported as external sync source via importer.
 */
import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { triggerManualSync } from '../workers/leadsSync.js'
import { requireCustomerId } from '../utils/tenantId.js'

const router = Router()
const METRICS_TIMEZONE = process.env.LEADS_METRICS_TIMEZONE || 'Europe/London'

type TruthSource = 'google_sheets' | 'db'
type Freshness = 'live' | 'diagnostic_stale'

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

function deriveDisplayColumns(rows: Array<{ occurredAt: string | null; source: string | null; owner: string | null; raw: Record<string, string>; fullName: string | null; email: string | null; phone: string | null; company: string | null; jobTitle: string | null; location: string | null; status: string | null; notes: string | null }>): string[] {
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

  const canonicalRawAliases = new Set(['Date', 'Name', 'Email', 'Phone', 'Company', 'Job Title', 'Location', 'Channel', 'Owner', 'Status', 'Notes'])
  const raw = Array.from(rawKeys).filter((key) => !canonicalRawAliases.has(key)).sort((a, b) => a.localeCompare(b))
  return [...canonical, ...raw]
}

function mapDbLeadRows(rows: Array<{
  id: string
  occurredAt: Date | null
  createdAt: Date
  source: string | null
  owner: string | null
  company: string | null
  fullName: string | null
  email: string | null
  phone: string | null
  jobTitle: string | null
  location: string | null
  status: string | null
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
      notes,
      raw,
    }
  })
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
    const context = await getCustomerTruthContext(customerId)
    if (!context) {
      return res.status(404).json({ error: 'Customer not found' })
    }

    const { customer, configuredSheetUrl, sourceOfTruth } = context

    const dbRows = await prisma.leadRecord.findMany({
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
        notes: true,
        accountName: true,
        data: true,
      },
    })

    const leads = mapDbLeadRows(dbRows)
    const sync = await getSyncMeta(customerId, sourceOfTruth)
    const displayColumns = deriveDisplayColumns(leads)

    const authoritative = sourceOfTruth === 'db' ? true : Boolean(sync.lastInboundSyncAt || sync.lastSuccessAt)

    return res.json({
      customerId,
      customerName: customer.name || '',
      rowCount: leads.length,
      leads,
      displayColumns,
      queriedAt: new Date().toISOString(),
      sourceUrl: sourceOfTruth === 'google_sheets' ? configuredSheetUrl : null,
      sourceOfTruth,
      authoritative,
      dataFreshness: 'live' as Freshness,
      staleFallbackUsed: false,
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

    const dbRows = await prisma.leadRecord.findMany({
      where: { customerId },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        occurredAt: true,
        createdAt: true,
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
        notes: true,
        data: true,
      },
    })

    const leads = mapDbLeadRows(dbRows).map((lead, idx) => {
      if (lead.occurredAt) return lead
      const createdAt = dbRows[idx]?.createdAt
      return {
        ...lead,
        occurredAt: createdAt ? createdAt.toISOString() : null,
      }
    })

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
      const source = row.source && String(row.source).trim() ? String(row.source).trim() : '(none)'
      const owner = row.owner && String(row.owner).trim() ? String(row.owner).trim() : '(none)'
      breakdownBySource[source] = (breakdownBySource[source] || 0) + 1
      breakdownByOwner[owner] = (breakdownByOwner[owner] || 0) + 1
    }

    const sync = await getSyncMeta(customerId, sourceOfTruth)
    const authoritative = sourceOfTruth === 'db' ? true : Boolean(sync.lastInboundSyncAt || sync.lastSuccessAt)

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
      authoritative,
      dataFreshness: 'live' as Freshness,
      staleFallbackUsed: false,
      sync,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to fetch lead metrics'
    return res.status(500).json({ error: message })
  }
})

export default router
