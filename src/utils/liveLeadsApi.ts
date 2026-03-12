/**
 * Live leads API — reads normalized ODCRM lead records.
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
  id: string
  occurredAt: string | null
  source: string | null
  owner: string | null
  company: string | null
  name: string | null
  fullName?: string | null
  email?: string | null
  phone?: string | null
  jobTitle?: string | null
  location?: string | null
  status?: string | null
  notes?: string | null
  syncStatus?: string | null
  raw: Record<string, string>
}

export type LiveLeadSyncMeta = {
  mode: 'sheet_backed' | 'db_backed'
  status: string | null
  lastSyncAt: string | null
  lastSuccessAt: string | null
  lastInboundSyncAt: string | null
  lastOutboundSyncAt: string | null
  lastError: string | null
  rowCount: number
}

export type LiveLeadsResponse = {
  customerId: string
  customerName?: string
  rowCount: number
  leads: LiveLeadRow[]
  displayColumns?: string[]
  queriedAt: string
  sourceUrl: string | null
  sourceOfTruth?: 'google_sheets' | 'db'
  authoritative?: boolean
  dataFreshness?: 'live' | 'diagnostic_stale'
  staleFallbackUsed?: boolean
  warning?: string
  hint?: string
  errorCode?: string
  sync?: LiveLeadSyncMeta
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
  sourceUrl: string | null
  sourceOfTruth?: 'google_sheets' | 'db'
  authoritative?: boolean
  dataFreshness?: 'live' | 'diagnostic_stale'
  staleFallbackUsed?: boolean
  warning?: string
  hint?: string
  errorCode?: string
  sync?: LiveLeadSyncMeta
}

export type ImportLiveLeadsResponse = {
  customerId: string
  sourceOfTruth: 'google_sheets'
  sync: LiveLeadSyncMeta
  importedAt: string
}

type ApiErrorResponse = {
  error?: string
  hint?: string
}

export type CreateLiveLeadInput = {
  occurredAt?: string | null
  firstName?: string | null
  lastName?: string | null
  fullName?: string | null
  email?: string | null
  phone?: string | null
  company?: string | null
  jobTitle?: string | null
  location?: string | null
  source?: string | null
  owner?: string | null
  status?: 'new' | 'qualified' | 'nurturing' | 'closed' | 'converted' | null
  notes?: string | null
}

export type CreateLiveLeadResponse = {
  lead: {
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
  sourceOfTruth: 'google_sheets' | 'db'
  outboundSync: {
    required: boolean
    status: string
    note: string
    error?: string | null
    rowReference?: string | null
    rowNumber?: number | null
    operation?: 'create' | 'update'
  }
}

export type RetryLiveLeadOutboundResponse = CreateLiveLeadResponse
export type UpdateLiveLeadInput = CreateLiveLeadInput
export type UpdateLiveLeadResponse = CreateLiveLeadResponse

export async function getLiveLeads(customerId: string): Promise<LiveLeadsResponse> {
  const res = await fetch(`${API_BASE}/api/live/leads?customerId=${encodeURIComponent(customerId)}`, {
    headers: getCustomerHeaders(customerId),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as ApiErrorResponse
    const message = [err.error, err.hint].filter(Boolean).join(' ')
    throw new Error(message || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function getLiveLeadMetrics(customerId: string): Promise<LiveLeadMetricsResponse> {
  const res = await fetch(`${API_BASE}/api/live/leads/metrics?customerId=${encodeURIComponent(customerId)}`, {
    headers: getCustomerHeaders(customerId),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as ApiErrorResponse
    const message = [err.error, err.hint].filter(Boolean).join(' ')
    throw new Error(message || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function importLiveLeads(customerId: string): Promise<ImportLiveLeadsResponse> {
  const res = await fetch(`${API_BASE}/api/live/leads/import?customerId=${encodeURIComponent(customerId)}`, {
    method: 'POST',
    headers: getCustomerHeaders(customerId),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as ApiErrorResponse
    const message = [err.error, err.hint].filter(Boolean).join(' ')
    throw new Error(message || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function createLiveLead(customerId: string, payload: CreateLiveLeadInput): Promise<CreateLiveLeadResponse> {
  const res = await fetch(`${API_BASE}/api/live/leads?customerId=${encodeURIComponent(customerId)}`, {
    method: 'POST',
    headers: getCustomerHeaders(customerId),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as ApiErrorResponse
    const message = [err.error, err.hint].filter(Boolean).join(' ')
    throw new Error(message || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function retryLiveLeadOutboundSync(customerId: string, leadId: string): Promise<RetryLiveLeadOutboundResponse> {
  const res = await fetch(`${API_BASE}/api/live/leads/${encodeURIComponent(leadId)}/retry-outbound?customerId=${encodeURIComponent(customerId)}`, {
    method: 'POST',
    headers: getCustomerHeaders(customerId),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as ApiErrorResponse
    const message = [err.error, err.hint].filter(Boolean).join(' ')
    throw new Error(message || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function updateLiveLead(customerId: string, leadId: string, payload: UpdateLiveLeadInput): Promise<UpdateLiveLeadResponse> {
  const res = await fetch(`${API_BASE}/api/live/leads/${encodeURIComponent(leadId)}?customerId=${encodeURIComponent(customerId)}`, {
    method: 'PUT',
    headers: getCustomerHeaders(customerId),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as ApiErrorResponse
    const message = [err.error, err.hint].filter(Boolean).join(' ')
    throw new Error(message || `HTTP ${res.status}`)
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
    errorCode?: string
    fetchError?: string
  }>
  lastSyncNewest: string | null
  lastSyncOldest: string | null
  errors: Array<{ customerId: string; name: string; message: string; errorCode?: string }>
}

const CONCURRENCY = 4

function isSheetBackedCustomer(customer: { leadsReportingUrl?: string | null }): boolean {
  return Boolean(customer.leadsReportingUrl && customer.leadsReportingUrl.trim())
}

function isActiveSheetSync(sync: LiveLeadSyncMeta | undefined): boolean {
  if (sync?.status !== 'syncing') return false
  if (sync.lastError) return false
  if (!sync.lastSyncAt) return true
  const lastSyncMs = Date.parse(sync.lastSyncAt)
  if (!Number.isFinite(lastSyncMs)) return true
  return Date.now() - lastSyncMs < 2 * 60 * 1000
}

function shouldRefreshSheetMetrics(
  customer: { leadsReportingUrl?: string | null },
  data: LiveLeadMetricsResponse
): boolean {
  if (!isSheetBackedCustomer(customer)) return false
  if (isActiveSheetSync(data.sync)) return false
  if (data.errorCode === 'missing_sheet_url' || data.errorCode === 'unreadable_sheet') return false
  return (
    data.errorCode === 'never_synced' ||
    data.errorCode === 'stale_sync' ||
    data.errorCode === 'sync_failed' ||
    data.errorCode === 'zero_rows_imported'
  )
}

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
 * Includes both sheet-backed and DB-backed customers.
 */
export async function fetchLiveMetricsForCustomers(
  customers: Array<{ id: string; name: string; leadsReportingUrl?: string | null }>
): Promise<AggregateMetricsResult> {
  const scopedCustomers = customers.filter((c) => c.id && c.name)
  if (scopedCustomers.length === 0) {
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
    scopedCustomers,
    async (c) => {
      try {
        let data = await getLiveLeadMetrics(c.id)
        if (shouldRefreshSheetMetrics(c, data)) {
          try {
            await importLiveLeads(c.id)
            data = await getLiveLeadMetrics(c.id)
          } catch (e) {
            return {
              customerId: c.id,
              name: c.name,
              errorCode: data.errorCode,
              fetchError: e instanceof Error ? `Lead metrics refresh failed: ${e.message}` : 'Lead metrics refresh failed',
            }
          }
          if (shouldRefreshSheetMetrics(c, data)) {
            return {
              customerId: c.id,
              name: c.name,
              errorCode: data.errorCode,
              fetchError: data.warning || data.hint || 'Lead metrics are still unavailable after refresh',
            }
          }
        }
        if (data.authoritative === false || data.dataFreshness === 'diagnostic_stale') {
          return {
            customerId: c.id,
            name: c.name,
            errorCode: data.errorCode,
            fetchError: data.warning || data.hint || 'Metrics are not currently authoritative for this customer',
          }
        }
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
  const errors: Array<{ customerId: string; name: string; message: string; errorCode?: string }> = []

  for (const r of results) {
    if ('fetchError' in r) {
      errors.push({ customerId: r.customerId, name: r.name, message: r.fetchError, errorCode: r.errorCode })
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
