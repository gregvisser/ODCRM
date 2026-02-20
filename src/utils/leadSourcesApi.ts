/**
 * Lead Sources API client — 4 sheets (Cognism, Apollo, Social, Blackbook).
 * All requests use x-customer-id from api or explicit header.
 */

const API_BASE = import.meta.env.VITE_API_URL || ''

export type LeadSourceType = 'COGNISM' | 'APOLLO' | 'SOCIAL' | 'BLACKBOOK'

export interface LeadSourceConfig {
  sourceType: LeadSourceType
  displayName: string
  connected: boolean
  lastFetchAt: string | null
  lastError: string | null
  isLocked: boolean
}

export interface LeadSourcesListResponse {
  sources: LeadSourceConfig[]
}

export interface LeadSourcePollResponse {
  totalRows: number
  newRowsDetected: number
  lastFetchAt: string
}

export interface LeadSourceBatch {
  batchKey: string
  date?: string
  client: string
  jobTitle: string
  count: number
  firstSeenMin?: string
  firstSeenMax?: string
  lastSeenAt?: string
}

export interface LeadSourceBatchesResponse {
  batches: LeadSourceBatch[]
}

export interface LeadSourceContactsResponse {
  columns: string[]
  contacts: Record<string, string>[]
  page: number
  pageSize: number
  total: number
}

function headers(customerId: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-customer-id': customerId,
  }
}

export async function getLeadSources(customerId: string): Promise<LeadSourcesListResponse> {
  const res = await fetch(`${API_BASE}/api/lead-sources`, { headers: headers(customerId) })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`)
  return res.json()
}

export async function connectLeadSource(
  customerId: string,
  sourceType: LeadSourceType,
  sheetUrl: string,
  displayName: string,
  applyToAllAccounts?: boolean
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/lead-sources/${sourceType}/connect`, {
    method: 'POST',
    headers: headers(customerId),
    body: JSON.stringify({ sheetUrl, displayName, applyToAllAccounts: !!applyToAllAccounts }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function pollLeadSource(
  customerId: string,
  sourceType: LeadSourceType
): Promise<LeadSourcePollResponse> {
  const res = await fetch(`${API_BASE}/api/lead-sources/${sourceType}/poll`, {
    method: 'POST',
    headers: headers(customerId),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export type LeadSourceBatchesResult = LeadSourceBatchesResponse & { batchesFallback?: boolean }

export async function getLeadSourceBatches(
  customerId: string,
  sourceType: LeadSourceType,
  date: string
): Promise<LeadSourceBatchesResult> {
  const res = await fetch(
    `${API_BASE}/api/lead-sources/${sourceType}/batches?date=${encodeURIComponent(date)}`,
    { headers: headers(customerId) }
  )
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`)
  const data = await res.json() as LeadSourceBatchesResponse
  const batchesFallback = res.headers.get('x-odcrm-batches-fallback') === '1'
  return { ...data, batchesFallback }
}

export async function getLeadSourceContacts(
  customerId: string,
  sourceType: LeadSourceType,
  batchKey: string,
  page: number,
  pageSize: number
): Promise<LeadSourceContactsResponse> {
  const params = new URLSearchParams({ batchKey, page: String(page), pageSize: String(pageSize) })
  const res = await fetch(
    `${API_BASE}/api/lead-sources/${sourceType}/contacts?${params}`,
    { headers: headers(customerId) }
  )
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`)
  return res.json()
}

/** Build URL for "Open Sheet" — backend redirect (never exposes spreadsheetId to client). */
export function buildOpenSheetUrl(apiBase: string, sourceType: LeadSourceType, customerId: string): string {
  const base = apiBase.replace(/\/$/, '')
  return `${base}/api/lead-sources/${sourceType}/open-sheet?customerId=${encodeURIComponent(customerId)}`
}
