import { emit } from '../platform/events'
import { OdcrmStorageKeys } from '../platform/keys'
import { setItem, setJson } from '../platform/storage'
import { api } from './api'

/** Headers for leads API requests. customerId is required – no "ALL" mode. */
export function getCustomerHeaders (customerId?: string | null): Record<string, string> {
  if (!customerId || String(customerId).trim() === '') {
    console.warn('Missing customerId – leads request blocked')
    throw new Error('Missing customerId')
  }
  return {
    'Content-Type': 'application/json',
    'x-customer-id': String(customerId).trim(),
  }
}

export type LeadRecord = {
  [key: string]: string
  id?: string
  accountName: string
  customerId?: string
  status?: 'new' | 'qualified' | 'nurturing' | 'closed' | 'converted'
  score?: number | null
  convertedToContactId?: string | null
  convertedAt?: string | null
  qualifiedAt?: string | null
  enrolledInSequenceId?: string | null
}

export type LeadsApiResponse = {
  leads: LeadRecord[]
  lastSyncAt?: string | null
}

export type ConvertLeadResponse = {
  success: boolean
  contactId: string
  isNewContact: boolean
  enrollmentId?: string | null
  message: string
}

export type BulkConvertResponse = {
  converted: number
  skipped: number
  errorCount: number
  contactsCreated: number
  contactsExisting: number
  enrollments: number
  errors: string[]
}

export type ScoreLeadResponse = {
  score: number
  status: string
}

export async function fetchLeadsFromApi(customerId: string): Promise<LeadsApiResponse> {
  if (!customerId || String(customerId).trim() === '') {
    console.warn('Missing customerId – leads fetch blocked')
    throw new Error('Missing customerId')
  }
  const API_BASE_URL = import.meta.env.VITE_API_URL || ''
  const id = String(customerId).trim()
  const url = `${API_BASE_URL}/api/leads?customerId=${encodeURIComponent(id)}`
  const response = await fetch(url, { headers: getCustomerHeaders(id) })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(errorData.error || `HTTP ${response.status}`)
  }

  const data = await response.json()
  return data || { leads: [], lastSyncAt: null }
}

export function persistLeadsToStorage(leads: LeadRecord[], lastSyncAt?: string | null): Date {
  setJson(OdcrmStorageKeys.leads, leads)
  setJson(OdcrmStorageKeys.marketingLeads, leads)

  const refreshTime = lastSyncAt ? new Date(lastSyncAt) : new Date()
  const refreshIso = refreshTime.toISOString()
  setItem(OdcrmStorageKeys.leadsLastRefresh, refreshIso)
  setItem(OdcrmStorageKeys.marketingLeadsLastRefresh, refreshIso)

  emit('leadsUpdated', leads)
  return refreshTime
}

// Convert a lead to a contact
export async function convertLeadToContact(
  leadId: string,
  sequenceId?: string,
  customerId?: string
): Promise<{ data?: ConvertLeadResponse; error?: string }> {
  const API_BASE_URL = import.meta.env.VITE_API_URL || ''
  const id = customerId || localStorage.getItem('currentCustomerId') || ''
  try {
    const headers = getCustomerHeaders(id)
    const response = await fetch(`${API_BASE_URL}/api/leads/${leadId}/convert?customerId=${encodeURIComponent(id)}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sequenceId }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }))
      return { error: error.error || `HTTP ${response.status}` }
    }

    const data = await response.json()
    return { data }
  } catch (error: any) {
    return { error: error.message || 'Network error' }
  }
}

// Bulk convert leads to contacts
export async function bulkConvertLeads(
  leadIds: string[],
  sequenceId?: string,
  customerId?: string
): Promise<{ data?: BulkConvertResponse; error?: string }> {
  const API_BASE_URL = import.meta.env.VITE_API_URL || ''
  const id = customerId || localStorage.getItem('currentCustomerId') || ''
  try {
    const headers = getCustomerHeaders(id)
    const response = await fetch(`${API_BASE_URL}/api/leads/bulk-convert?customerId=${encodeURIComponent(id)}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ leadIds, sequenceId }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }))
      return { error: error.error || `HTTP ${response.status}` }
    }

    const data = await response.json()
    return { data }
  } catch (error: any) {
    return { error: error.message || 'Network error' }
  }
}

// Score a lead
export async function scoreLead(leadId: string, customerId?: string): Promise<{ data?: ScoreLeadResponse; error?: string }> {
  const API_BASE_URL = import.meta.env.VITE_API_URL || ''
  const id = customerId || localStorage.getItem('currentCustomerId') || ''
  try {
    const headers = getCustomerHeaders(id)
    const response = await fetch(`${API_BASE_URL}/api/leads/${leadId}/score?customerId=${encodeURIComponent(id)}`, {
      method: 'POST',
      headers,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }))
      return { error: error.error || `HTTP ${response.status}` }
    }

    const data = await response.json()
    return { data }
  } catch (error: any) {
    return { error: error.message || 'Network error' }
  }
}

// Update lead status
export async function updateLeadStatus(
  leadId: string,
  status: 'new' | 'qualified' | 'nurturing' | 'closed' | 'converted',
  customerId?: string
): Promise<{ data?: LeadRecord; error?: string }> {
  const API_BASE_URL = import.meta.env.VITE_API_URL || ''
  const id = customerId || localStorage.getItem('currentCustomerId') || ''
  try {
    const headers = getCustomerHeaders(id)
    const response = await fetch(`${API_BASE_URL}/api/leads/${leadId}/status?customerId=${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }))
      return { error: error.error || `HTTP ${response.status}` }
    }

    const data = await response.json()
    return { data }
  } catch (error: any) {
    return { error: error.message || 'Network error' }
  }
}

// Export leads to CSV
export async function exportLeadsToCSV(customerId?: string): Promise<{ data?: Blob; error?: string }> {
  const API_BASE_URL = import.meta.env.VITE_API_URL || ''
  const id = customerId || localStorage.getItem('currentCustomerId') || ''
  try {
    const headers = getCustomerHeaders(id)
    const response = await fetch(`${API_BASE_URL}/api/leads/export/csv?customerId=${encodeURIComponent(id)}`, {
      headers,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }))
      return { error: error.error || `HTTP ${response.status}` }
    }

    const blob = await response.blob()
    return { data: blob }
  } catch (error: any) {
    return { error: error.message || 'Network error' }
  }
}

// Get sequences for enrollment
export async function getSequences(): Promise<{ data?: Array<{ id: string; name: string; description?: string }>; error?: string }> {
  const API_BASE_URL = import.meta.env.VITE_API_URL || ''
  const customerId = localStorage.getItem('currentCustomerId') || ''
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/sequences?customerId=${customerId}`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Customer-Id': customerId,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }))
      return { error: error.error || `HTTP ${response.status}` }
    }

    const data = await response.json()
    return { data }
  } catch (error: any) {
    return { error: error.message || 'Network error' }
  }
}

// Sync management types
export type SyncStatus = {
  customerId: string
  status: 'never_synced' | 'success' | 'error'
  isPaused: boolean
  isRunning: boolean
  lastSyncAt: string | null
  lastSuccessAt: string | null
  lastError: string | null
  metrics: {
    rowCount: number
    syncDuration: number | null
    rowsProcessed: number
    rowsInserted: number
    rowsUpdated: number
    rowsDeleted: number
    errorCount: number
    retryCount: number
  }
  progress: {
    percent: number
    message: string
  }
  customer?: {
    id: string
    name: string
    leadsReportingUrl: string | null
  }
}

export type SyncMetrics = {
  timestamp: string
  customerId: string
  summary: {
    totalSyncs: number
    successfulSyncs: number
    failedSyncs: number
    successRate: number
    avgDuration: number
  }
  metrics: {
    totalRowsProcessed: number
    totalRowsInserted: number
    totalRowsUpdated: number
    totalRowsDeleted: number
    totalErrors: number
    totalRetries: number
    errorRate: number
  }
  details: Array<{
    customerId: string
    syncDuration: number | null
    rowsProcessed: number | null
    rowsInserted: number | null
    rowsUpdated: number | null
    rowsDeleted: number | null
    errorCount: number
    retryCount: number
    lastSuccessAt: Date | null
    lastSyncAt: Date | null
  }>
}

// Get sync status
export async function getSyncStatus(customerId?: string): Promise<{ data?: SyncStatus; error?: string }> {
  const API_BASE_URL = import.meta.env.VITE_API_URL || ''
  const id = (customerId || localStorage.getItem('currentCustomerId') || '').trim()
  if (!id) {
    console.warn('Missing customerId – getSyncStatus blocked')
    return { error: 'Missing customerId' }
  }
  try {
    const response = await fetch(`${API_BASE_URL}/api/leads/sync/status?customerId=${encodeURIComponent(id)}`, {
      headers: getCustomerHeaders(id),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }))
      return { error: error.error || `HTTP ${response.status}` }
    }

    const data = await response.json()
    return { data }
  } catch (error: any) {
    return { error: error.message || 'Network error' }
  }
}

export type ValidateSheetResult = {
  ok: boolean
  error?: string
  hint?: string
  rowCount?: number
  headerKeys?: string[]
  detected?: { occurredAtKey: string | null; sourceKey: string | null; ownerKey: string | null; externalIdKey: string | null }
  sampleRow?: Record<string, string>
}

/** Validate customer's leads sheet URL (no DB writes). Used to explain "why 0 leads". */
export async function getValidateSheetResult(customerId?: string): Promise<{ data?: ValidateSheetResult; error?: string }> {
  const API_BASE_URL = import.meta.env.VITE_API_URL || ''
  const id = (customerId || localStorage.getItem('currentCustomerId') || '').trim()
  if (!id) return { error: 'Missing customerId' }
  try {
    const response = await fetch(`${API_BASE_URL}/api/leads/sync/validate?customerId=${encodeURIComponent(id)}`, {
      headers: getCustomerHeaders(id),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return { data: { ok: false, error: data.error || response.statusText, hint: data.hint }, error: data.error }
    }
    return { data: data as ValidateSheetResult }
  } catch (error: any) {
    return { error: error.message || 'Network error' }
  }
}

// Get all sync statuses
export async function getAllSyncStatuses(): Promise<{ data?: { total: number; statuses: SyncStatus[] }; error?: string }> {
  const API_BASE_URL = import.meta.env.VITE_API_URL || ''
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/leads/sync/status/all`, {
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }))
      return { error: error.error || `HTTP ${response.status}` }
    }

    const data = await response.json()
    return { data }
  } catch (error: any) {
    return { error: error.message || 'Network error' }
  }
}

// Trigger manual sync
export async function triggerSync(customerId?: string): Promise<{ data?: { success: boolean; message: string; customerId: string }; error?: string }> {
  const API_BASE_URL = import.meta.env.VITE_API_URL || ''
  const id = (customerId || localStorage.getItem('currentCustomerId') || '').trim()
  if (!id) {
    console.warn('Missing customerId – triggerSync blocked')
    return { error: 'Missing customerId' }
  }
  try {
    const response = await fetch(`${API_BASE_URL}/api/leads/sync/trigger?customerId=${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: getCustomerHeaders(id),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }))
      return { error: error.error || `HTTP ${response.status}` }
    }

    const data = await response.json()
    return { data }
  } catch (error: any) {
    return { error: error.message || 'Network error' }
  }
}

// Pause sync
export async function pauseSync(customerId?: string): Promise<{ data?: { success: boolean; message: string; customerId: string }; error?: string }> {
  const API_BASE_URL = import.meta.env.VITE_API_URL || ''
  const id = (customerId || localStorage.getItem('currentCustomerId') || '').trim()
  if (!id) {
    console.warn('Missing customerId – pauseSync blocked')
    return { error: 'Missing customerId' }
  }
  try {
    const response = await fetch(`${API_BASE_URL}/api/leads/sync/pause?customerId=${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: getCustomerHeaders(id),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }))
      return { error: error.error || `HTTP ${response.status}` }
    }

    const data = await response.json()
    return { data }
  } catch (error: any) {
    return { error: error.message || 'Network error' }
  }
}

// Resume sync
export async function resumeSync(customerId?: string): Promise<{ data?: { success: boolean; message: string; customerId: string }; error?: string }> {
  const API_BASE_URL = import.meta.env.VITE_API_URL || ''
  const id = (customerId || localStorage.getItem('currentCustomerId') || '').trim()
  if (!id) {
    console.warn('Missing customerId – resumeSync blocked')
    return { error: 'Missing customerId' }
  }
  try {
    const response = await fetch(`${API_BASE_URL}/api/leads/sync/resume?customerId=${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: getCustomerHeaders(id),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }))
      return { error: error.error || `HTTP ${response.status}` }
    }

    const data = await response.json()
    return { data }
  } catch (error: any) {
    return { error: error.message || 'Network error' }
  }
}

// Get sync metrics
export async function getSyncMetrics(customerId?: string): Promise<{ data?: SyncMetrics; error?: string }> {
  const API_BASE_URL = import.meta.env.VITE_API_URL || ''
  const id = (customerId || localStorage.getItem('currentCustomerId') || '').trim()
  if (!id) {
    console.warn('Missing customerId – getSyncMetrics blocked')
    return { error: 'Missing customerId' }
  }
  try {
    const url = `${API_BASE_URL}/api/leads/sync/metrics?customerId=${encodeURIComponent(id)}`
    const response = await fetch(url, {
      headers: getCustomerHeaders(id),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }))
      return { error: error.error || `HTTP ${response.status}` }
    }

    const data = await response.json()
    return { data }
  } catch (error: any) {
    return { error: error.message || 'Network error' }
  }
}

// Simple in-memory cache for lead counts (5 minute TTL)
const cache = new Map<string, { data: any; expires: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function getCached<T>(key: string): T | null {
  const cached = cache.get(key)
  if (cached && cached.expires > Date.now()) {
    return cached.data as T
  }
  cache.delete(key)
  return null
}

function setCached<T>(key: string, data: T): void {
  cache.set(key, {
    data,
    expires: Date.now() + CACHE_TTL,
  })
}

// Cached lead count fetch (requires customerId)
export async function fetchLeadsFromApiCached(customerId: string, forceRefresh: boolean = false): Promise<LeadsApiResponse> {
  if (!customerId || String(customerId).trim() === '') {
    console.warn('Missing customerId – fetchLeadsFromApiCached blocked')
    throw new Error('Missing customerId')
  }
  const id = String(customerId).trim()
  const cacheKey = `leads_${id}`

  if (!forceRefresh) {
    const cached = getCached<LeadsApiResponse>(cacheKey)
    if (cached) {
      return cached
    }
  }

  const result = await fetchLeadsFromApi(id)
  if (result.leads) {
    setCached(cacheKey, result)
  }

  return result
}
