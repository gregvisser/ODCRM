/**
 * Live leads API — reads from Google Sheets (published CSV). No DB writes.
 * Uses /api/live/leads and /api/live/leads/metrics with x-customer-id header.
 */

const API_BASE = import.meta.env.VITE_API_URL || ''

function getCustomerHeaders(customerId: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-customer-id': customerId,
  }
}

export type LiveLeadRow = {
  occurredAt: string | null
  source: string | null
  owner: string | null
  company: string | null
  name: string | null
  raw: Record<string, string>
}

export type LiveLeadsResponse = {
  customerId: string
  customerName?: string
  rowCount: number
  leads: LiveLeadRow[]
  queriedAt: string
  sourceUrl: string
}

export type LiveLeadMetricsResponse = {
  customerId: string
  totalLeads: number
  todayLeads: number
  weekLeads: number
  monthLeads: number
  counts?: { today: number; week: number; month: number; total: number }
  breakdownBySource: Record<string, number>
  breakdownByOwner: Record<string, number>
  rowCount: number
  queriedAt: string
  sourceUrl: string
}

export async function getLiveLeads(customerId: string): Promise<LiveLeadsResponse> {
  const res = await fetch(`${API_BASE}/api/live/leads?customerId=${encodeURIComponent(customerId)}`, {
    headers: getCustomerHeaders(customerId),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function getLiveLeadMetrics(customerId: string): Promise<LiveLeadMetricsResponse> {
  const res = await fetch(`${API_BASE}/api/live/leads/metrics?customerId=${encodeURIComponent(customerId)}`, {
    headers: getCustomerHeaders(customerId),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`)
  }
  return res.json()
}

/** Same shape as leadsAggregate.AggregateMetricsResult for drop-in use. */
export type AggregateMetricsResult = {
  totals: { today: number; week: number; month: number; total: number }
  breakdownBySource: Record<string, number>
  breakdownByOwner: Record<string, number>
  perCustomer: Array<{
    customerId: string
    name: string
    counts: { today: number; week: number; month: number; total: number }
    breakdownBySource: Record<string, number>
    breakdownByOwner: Record<string, number>
    lastSync: null
    fetchError?: string
  }>
  lastSyncNewest: string | null
  lastSyncOldest: string | null
  errors: Array<{ customerId: string; name: string; message: string }>
}

const CONCURRENCY = 4

function runWithConcurrency<T, R>(items: T[], fn: (item: T) => Promise<R>, concurrency: number): Promise<R[]> {
  const results: R[] = []
  let index = 0
  async function worker(): Promise<void> {
    while (index < items.length) {
      const i = index++
      results[i] = await fn(items[i])
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  return Promise.all(workers).then(() => results)
}

/**
 * Fetch live metrics for each customer (max CONCURRENCY). For "All Accounts Combined".
 * Only includes customers with leadsReportingUrl.
 */
export async function fetchLiveMetricsForCustomers(
  customers: Array<{ id: string; name: string; leadsReportingUrl?: string | null }>
): Promise<AggregateMetricsResult> {
  const withSheets = customers.filter((c) => c.leadsReportingUrl != null && String(c.leadsReportingUrl).trim() !== '')
  if (withSheets.length === 0) {
    return {
      totals: { today: 0, week: 0, month: 0, total: 0 },
      breakdownBySource: {},
      breakdownByOwner: {},
      perCustomer: [],
      lastSyncNewest: null,
      lastSyncOldest: null,
      errors: [],
    }
  }

  const results = await runWithConcurrency(
    withSheets,
    async (c) => {
      try {
        const data = await getLiveLeadMetrics(c.id)
        const counts = data.counts ?? {
          today: data.todayLeads,
          week: data.weekLeads,
          month: data.monthLeads,
          total: data.totalLeads,
        }
        return {
          customerId: c.id,
          name: c.name,
          counts,
          breakdownBySource: data.breakdownBySource || {},
          breakdownByOwner: data.breakdownByOwner || {},
          lastSync: null as const,
        }
      } catch (e) {
        return { customerId: c.id, name: c.name, fetchError: e instanceof Error ? e.message : 'Network error' }
      }
    },
    CONCURRENCY
  )

  const totals = { today: 0, week: 0, month: 0, total: 0 }
  const breakdownBySource: Record<string, number> = {}
  const breakdownByOwner: Record<string, number> = {}
  const perCustomer: AggregateMetricsResult['perCustomer'] = []
  const errors: Array<{ customerId: string; name: string; message: string }> = []

  for (const r of results) {
    if ('fetchError' in r) {
      errors.push({ customerId: r.customerId, name: r.name, message: r.fetchError })
      continue
    }
    perCustomer.push(r)
    totals.today += r.counts.today
    totals.week += r.counts.week
    totals.month += r.counts.month
    totals.total += r.counts.total
    Object.entries(r.breakdownBySource || {}).forEach(([k, v]) => {
      breakdownBySource[k] = (breakdownBySource[k] || 0) + v
    })
    Object.entries(r.breakdownByOwner || {}).forEach(([k, v]) => {
      breakdownByOwner[k] = (breakdownByOwner[k] || 0) + v
    })
  }

  return {
    totals,
    breakdownBySource,
    breakdownByOwner,
    perCustomer,
    lastSyncNewest: null,
    lastSyncOldest: null,
    errors,
  }
}
