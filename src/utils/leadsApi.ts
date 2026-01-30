import { emit } from '../platform/events'
import { OdcrmStorageKeys } from '../platform/keys'
import { setItem, setJson } from '../platform/storage'
import { api } from './api'

export type LeadRecord = {
  [key: string]: string
  accountName: string
  customerId?: string
}

export type LeadsApiResponse = {
  leads: LeadRecord[]
  lastSyncAt?: string | null
}

export async function fetchLeadsFromApi(): Promise<LeadsApiResponse> {
  // For leads, we want to fetch from all customers with reporting URLs
  // So we make a direct fetch without the customer ID header
  const API_BASE_URL = import.meta.env.VITE_API_URL || ''
  const response = await fetch(`${API_BASE_URL}/api/leads`, {
    headers: {
      'Content-Type': 'application/json',
    },
  })

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

  emit('leadsUpdated')
  return refreshTime
}
