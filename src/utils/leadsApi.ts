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
  const { data, error } = await api.get<LeadsApiResponse>('/api/leads')
  if (error) {
    throw new Error(error)
  }
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
