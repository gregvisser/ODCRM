/**
 * Live leads from Google Sheets. No DB writes. Read-only CSV fetch + in-memory cache.
 * GET /api/live/leads
 * GET /api/live/leads/metrics
 */
import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { fetchAndParseLiveLeads, resolveCsvUrl } from '../utils/liveSheets.js'

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

function getCustomerId(req: { query: Record<string, unknown>; header: (name: string) => string | undefined }): string | null {
  const header = (req.header('x-customer-id') || '').trim()
  const query = typeof req.query.customerId === 'string' ? req.query.customerId.trim() : ''
  const id = header || query
  return id || null
}

/**
 * GET /api/live/leads?customerId=...
 * Requires customerId (query or x-customer-id). Returns leads from customer's leadsReportingUrl CSV. No DB writes.
 */
router.get('/leads', async (req, res) => {
  const customerId = getCustomerId(req)
  if (!customerId) {
    return res.status(400).json({ error: 'customerId is required (query or x-customer-id header)' })
  }

  try {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true, leadsReportingUrl: true },
    })
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' })
    }
    const url = (customer.leadsReportingUrl || '').trim()
    if (!url) {
      return res.status(400).json({ error: 'Customer has no leads reporting URL configured' })
    }

    const leads = await fetchAndParseLiveLeads(customerId, url)
    const sourceUrl = resolveCsvUrl(url)
    const queriedAt = new Date().toISOString()

    res.json({
      customerId,
      customerName: customer.name || '',
      rowCount: leads.length,
      leads,
      queriedAt,
      sourceUrl,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to fetch live leads'
    return res.status(500).json({ error: message })
  }
})

/**
 * GET /api/live/leads/metrics?customerId=...
 * Same validation. Computes totalLeads, todayLeads, weekLeads, monthLeads, breakdownBySource, breakdownByOwner (Europe/London).
 */
router.get('/leads/metrics', async (req, res) => {
  const customerId = getCustomerId(req)
  if (!customerId) {
    return res.status(400).json({ error: 'customerId is required (query or x-customer-id header)' })
  }

  try {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, leadsReportingUrl: true },
    })
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' })
    }
    const url = (customer.leadsReportingUrl || '').trim()
    if (!url) {
      return res.status(400).json({ error: 'Customer has no leads reporting URL configured' })
    }

    const leads = await fetchAndParseLiveLeads(customerId, url)
    const sourceUrl = resolveCsvUrl(url)
    const queriedAt = new Date().toISOString()

    const { todayStart, todayEnd, weekStart, weekEnd, monthStart, monthEnd } = getMetricsTimeRangesUtc()

    let totalLeads = leads.length
    let todayLeads = 0
    let weekLeads = 0
    let monthLeads = 0
    const breakdownBySource: Record<string, number> = {}
    const breakdownByOwner: Record<string, number> = {}

    for (const row of leads) {
      const at = row.occurredAt ? new Date(row.occurredAt) : null
      const inToday = at && at >= todayStart && at < todayEnd
      const inWeek = at && at >= weekStart && at < weekEnd
      const inMonth = at && at >= monthStart && at < monthEnd
      if (inToday) todayLeads++
      if (inWeek) weekLeads++
      if (inMonth) monthLeads++

      const source = (row.source != null && String(row.source).trim() !== '') ? String(row.source).trim() : '(none)'
      breakdownBySource[source] = (breakdownBySource[source] || 0) + 1
      const owner = (row.owner != null && String(row.owner).trim() !== '') ? String(row.owner).trim() : '(none)'
      breakdownByOwner[owner] = (breakdownByOwner[owner] || 0) + 1
    }

    res.json({
      customerId,
      totalLeads,
      todayLeads,
      weekLeads,
      monthLeads,
      counts: { today: todayLeads, week: weekLeads, month: monthLeads, total: totalLeads },
      breakdownBySource,
      breakdownByOwner,
      rowCount: leads.length,
      queriedAt,
      sourceUrl,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to fetch live lead metrics'
    return res.status(500).json({ error: message })
  }
})

export default router
