/**
 * Aggregate lead metrics across customers for "All Accounts Combined" view.
 * Uses GET /api/leads/metrics?customerId=... per customer (no unscoped endpoint).
 */
import { api } from './api'
import { getCustomerHeaders } from './leadsApi'

const API_BASE = import.meta.env.VITE_API_URL || ''
const CONCURRENCY = 4

export type CustomerForAggregate = { id: string; name: string; leadsReportingUrl?: string | null }

export type LeadMetricsResponse = {
  customerId: string
  timezone?: string
  counts: { today: number; week: number; month: number; total: number }
  breakdownBySource: Record<string, number>
  breakdownByOwner: Record<string, number>
  lastSync?: {
    lastSyncAt: string | null
    lastSuccessAt: string | null
    lastError: string | null
    isPaused: boolean
    isRunning: boolean
    rowCount: number | null
  } | null
}

export type PerCustomerMetrics = {
  customerId: string
  name: string
  counts: LeadMetricsResponse['counts']
  breakdownBySource: Record<string, number>
  breakdownByOwner: Record<string, number>
  lastSync: LeadMetricsResponse['lastSync']
  fetchError?: string
}

export type AggregateMetricsResult = {
  totals: { today: number; week: number; month: number; total: number }
  breakdownBySource: Record<string, number>
  breakdownByOwner: Record<string, number>
  perCustomer: PerCustomerMetrics[]
  lastSyncNewest: string | null
  lastSyncOldest: string | null
  errors: Array<{ customerId: string; name: string; message: string }>
}

async function fetchMetricsForOne(customerId: string, name: string): Promise<PerCustomerMetrics | { customerId: string; name: string; fetchError: string }> {
  try {
    const url = `${API_BASE}/api/leads/metrics?customerId=${encodeURIComponent(customerId)}`
    const res = await fetch(url, { headers: getCustomerHeaders(customerId) })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { customerId, name, fetchError: (err as any).error || `HTTP ${res.status}` }
    }
    const data: LeadMetricsResponse = await res.json()
    return {
      customerId,
      name,
      counts: data.counts,
      breakdownBySource: data.breakdownBySource || {},
      breakdownByOwner: data.breakdownByOwner || {},
      lastSync: data.lastSync ?? null,
    }
  } catch (e: any) {
    return { customerId, name, fetchError: e?.message || 'Network error' }
  }
}

function runWithConcurrency<T, R>(items: T[], fn: (item: T) => Promise<R>, concurrency: number): Promise<R[]> {
  const results: R[] = []
  let index = 0
  async function worker(): Promise<void> {
    while (index < items.length) {
      const i = index++
      const r = await fn(items[i])
      results[i] = r
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  return Promise.all(workers).then(() => results)
}

/** Fetch customers from API (same list as rest of app). */
export async function fetchAllCustomers(): Promise<CustomerForAggregate[]> {
  const { data, error } = await api.get<Array<{ id: string; name: string; leadsReportingUrl?: string | null }>>('/api/customers')
  if (error || !data) return []
  return data.map((c) => ({ id: c.id, name: c.name, leadsReportingUrl: c.leadsReportingUrl }))
}

/**
 * Fetch metrics for each customer (max CONCURRENCY in flight), then aggregate.
 * Only includes customers that have leadsReportingUrl (backend metrics require it).
 */
export async function fetchMetricsForCustomers(customers: CustomerForAggregate[]): Promise<AggregateMetricsResult> {
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
    (c) => fetchMetricsForOne(c.id, c.name),
    CONCURRENCY
  )

  const totals = { today: 0, week: 0, month: 0, total: 0 }
  const breakdownBySource: Record<string, number> = {}
  const breakdownByOwner: Record<string, number> = {}
  const perCustomer: PerCustomerMetrics[] = []
  const errors: Array<{ customerId: string; name: string; message: string }> = []
  let lastSyncNewest: string | null = null
  let lastSyncOldest: string | null = null

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
    const at = r.lastSync?.lastSuccessAt ?? r.lastSync?.lastSyncAt ?? null
    if (at) {
      if (!lastSyncNewest || at > lastSyncNewest) lastSyncNewest = at
      if (!lastSyncOldest || at < lastSyncOldest) lastSyncOldest = at
    }
    if (r.lastSync?.lastError) {
      errors.push({ customerId: r.customerId, name: r.name, message: r.lastSync.lastError })
    }
  }

  return {
    totals,
    breakdownBySource,
    breakdownByOwner,
    perCustomer,
    lastSyncNewest,
    lastSyncOldest,
    errors,
  }
}
