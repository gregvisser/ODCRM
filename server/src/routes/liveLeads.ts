/**
 * Live leads truth surface.
 * - Sheet-backed clients: Google Sheets is authoritative.
 * - Non-sheet-backed clients: DB lead records are authoritative.
 *
 * Diagnostic stale cache can be requested explicitly via ?diagnosticFallback=1
 * but is never returned as authoritative live truth by default.
 */
import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { fetchAndParseLiveLeads, getStaleCachedLeads, resolveCsvUrl, type LiveLeadRow } from '../utils/liveSheets.js'
import { requireCustomerId } from '../utils/tenantId.js'

const router = Router()
const METRICS_TIMEZONE = process.env.LEADS_METRICS_TIMEZONE || 'Europe/London'

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

type TruthSource = 'google_sheets' | 'db'
type Freshness = 'live' | 'diagnostic_stale'

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

function mapDbLeadRows(rows: Array<{
  occurredAt: Date | null
  createdAt: Date
  source: string | null
  owner: string | null
  accountName: string
  data: unknown
}>): LiveLeadRow[] {
  return rows.map((row) => {
    const raw = asRawMap(row.data)
    const occurredAt = row.occurredAt ? row.occurredAt.toISOString() : null
    const source = row.source ?? (raw['Channel of Lead'] || raw['channel'] || raw['Source'] || null)
    const owner = row.owner ?? (raw['OD Team Member'] || raw['Owner'] || raw['owner'] || null)
    const company = raw['Company'] || raw['company'] || row.accountName || null
    const name = raw['Name'] || raw['name'] || null
    return { occurredAt, source, owner, company, name, raw }
  })
}

function classifySheetError(sheetUrl: string, message: string): { code: string; hint: string } {
  const normalizedUrl = sheetUrl.trim()
  const lowered = message.toLowerCase()

  if (!normalizedUrl) {
    return {
      code: 'SHEET_URL_MISSING',
      hint: 'Add a Google Sheet URL in Clients > Accounts before loading sheet-backed leads.',
    }
  }

  if (!/^https?:\/\//i.test(normalizedUrl)) {
    return {
      code: 'SHEET_URL_INVALID',
      hint: 'Use a full Google Sheets URL such as https://docs.google.com/spreadsheets/d/<ID>/edit#gid=0.',
    }
  }

  if (lowered.includes('http 401') || lowered.includes('http 403')) {
    return {
      code: 'SHEET_ACCESS_DENIED',
      hint: 'The sheet is not accessible. Share it for view access or publish the sheet so ODCRM can read it.',
    }
  }

  if (lowered.includes('http 404')) {
    return {
      code: 'SHEET_NOT_FOUND',
      hint: 'The configured sheet URL could not be found. Verify the sheet ID and gid in Clients > Accounts.',
    }
  }

  if (lowered.includes('html instead of csv')) {
    return {
      code: 'SHEET_NOT_FETCHABLE_AS_CSV',
      hint: 'Use a normal Google Sheets URL. ODCRM normalizes it to export CSV internally. Ensure the linked sheet is readable by ODCRM.',
    }
  }

  if (lowered.includes('aborted') || lowered.includes('timeout')) {
    return {
      code: 'SHEET_TIMEOUT',
      hint: 'The sheet request timed out. Verify URL accessibility and retry after confirming the sheet is reachable.',
    }
  }

  return {
    code: 'SHEET_FETCH_FAILED',
    hint: 'Unable to read this Google Sheet right now. Verify URL format and sheet access permissions for this client.',
  }
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

/**
 * GET /api/live/leads?customerId=...
 */
router.get('/leads', async (req, res) => {
  const customerId = requireCustomerId(req, res)
  if (!customerId) return

  const diagnosticsFallbackRequested = String(req.query.diagnosticFallback || '') === '1'

  try {
    const context = await getCustomerTruthContext(customerId)
    if (!context) {
      return res.status(404).json({ error: 'Customer not found' })
    }

    const { customer, configuredSheetUrl, sourceOfTruth } = context

    if (sourceOfTruth === 'db') {
      const dbRows = await prisma.leadRecord.findMany({
        where: { customerId },
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        select: {
          occurredAt: true,
          createdAt: true,
          source: true,
          owner: true,
          accountName: true,
          data: true,
        },
      })
      const leads = mapDbLeadRows(dbRows)
      return res.json({
        customerId,
        customerName: customer.name || '',
        rowCount: leads.length,
        leads,
        queriedAt: new Date().toISOString(),
        sourceUrl: null,
        sourceOfTruth,
        authoritative: true,
        dataFreshness: 'live' as Freshness,
        staleFallbackUsed: false,
      })
    }

    const sourceUrl = resolveCsvUrl(configuredSheetUrl)
    try {
      const leads = await fetchAndParseLiveLeads(customerId, configuredSheetUrl)
      return res.json({
        customerId,
        customerName: customer.name || '',
        rowCount: leads.length,
        leads,
        queriedAt: new Date().toISOString(),
        sourceUrl,
        sourceOfTruth,
        authoritative: true,
        dataFreshness: 'live' as Freshness,
        staleFallbackUsed: false,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch live leads'
      const issue = classifySheetError(configuredSheetUrl, message)
      const stale = getStaleCachedLeads(customerId, configuredSheetUrl)

      if (diagnosticsFallbackRequested && stale) {
        return res.json({
          customerId,
          customerName: customer.name || '',
          rowCount: stale.data.length,
          leads: stale.data,
          queriedAt: new Date().toISOString(),
          sourceUrl,
          sourceOfTruth,
          authoritative: false,
          dataFreshness: 'diagnostic_stale' as Freshness,
          staleFallbackUsed: true,
          warning: `Diagnostic fallback only. Last known cached rows returned because live sheet fetch failed: ${message}`,
          hint: issue.hint,
          errorCode: issue.code,
        })
      }

      return res.status(502).json({
        error: message,
        hint: issue.hint,
        errorCode: issue.code,
        sourceOfTruth,
        sourceUrl,
        staleFallbackAvailable: !!stale,
      })
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to fetch live leads'
    return res.status(500).json({ error: message })
  }
})

/**
 * GET /api/live/leads/metrics?customerId=...
 */
router.get('/leads/metrics', async (req, res) => {
  const customerId = requireCustomerId(req, res)
  if (!customerId) return

  const diagnosticsFallbackRequested = String(req.query.diagnosticFallback || '') === '1'

  try {
    const context = await getCustomerTruthContext(customerId)
    if (!context) {
      return res.status(404).json({ error: 'Customer not found' })
    }

    const { customer, configuredSheetUrl, sourceOfTruth } = context
    const { todayStart, todayEnd, weekStart, weekEnd, monthStart, monthEnd } = getMetricsTimeRangesUtc()

    const buildMetricsResponse = (
      leads: LiveLeadRow[],
      sourceUrl: string | null,
      authoritative: boolean,
      dataFreshness: Freshness,
      staleFallbackUsed: boolean,
      warning?: string,
      hint?: string,
      errorCode?: string
    ) => {
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

      return {
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
        sourceUrl,
        sourceOfTruth,
        authoritative,
        dataFreshness,
        staleFallbackUsed,
        warning,
        hint,
        errorCode,
      }
    }

    if (sourceOfTruth === 'db') {
      const dbRows = await prisma.leadRecord.findMany({
        where: { customerId },
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        select: {
          occurredAt: true,
          createdAt: true,
          source: true,
          owner: true,
          accountName: true,
          data: true,
        },
      })
      const leads = mapDbLeadRows(dbRows).map((lead, idx) => {
        if (lead.occurredAt) return lead
        // Use createdAt fallback from DB rows for metrics when occurredAt is absent.
        const createdAt = dbRows[idx]?.createdAt
        return {
          ...lead,
          occurredAt: createdAt ? createdAt.toISOString() : null,
        }
      })
      return res.json(buildMetricsResponse(leads, null, true, 'live', false))
    }

    const sourceUrl = resolveCsvUrl(configuredSheetUrl)
    try {
      const leads = await fetchAndParseLiveLeads(customerId, configuredSheetUrl)
      return res.json(buildMetricsResponse(leads, sourceUrl, true, 'live', false))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch live lead metrics'
      const issue = classifySheetError(configuredSheetUrl, message)
      const stale = getStaleCachedLeads(customerId, configuredSheetUrl)

      if (diagnosticsFallbackRequested && stale) {
        return res.json(
          buildMetricsResponse(
            stale.data,
            sourceUrl,
            false,
            'diagnostic_stale',
            true,
            `Diagnostic fallback only. Cached metrics returned because live sheet fetch failed: ${message}`,
            issue.hint,
            issue.code
          )
        )
      }

      return res.status(502).json({
        error: message,
        hint: issue.hint,
        errorCode: issue.code,
        sourceOfTruth,
        sourceUrl,
        staleFallbackAvailable: !!stale,
      })
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to fetch live lead metrics'
    return res.status(500).json({ error: message })
  }
})

export default router
