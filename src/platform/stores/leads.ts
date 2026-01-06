import { emit, on } from '../events'
import { OdcrmStorageKeys } from '../keys'
import { getJson, setItem, setJson } from '../storage'

export function getLeads<T = unknown>(): T[] {
  const data = getJson<unknown>(OdcrmStorageKeys.leads)
  return Array.isArray(data) ? (data as T[]) : []
}

export function setLeads<T = unknown>(leads: T[]): void {
  setJson(OdcrmStorageKeys.leads, leads)
  setItem(OdcrmStorageKeys.leadsLastRefresh, new Date().toISOString())
  emit('leadsUpdated', leads)
}

export function onLeadsUpdated(handler: () => void): () => void {
  return on('leadsUpdated', () => handler())
}


