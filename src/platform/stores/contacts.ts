/**
 * Contacts store: CACHE ONLY. Database (API) is the source of truth.
 * Do not use getContacts() as the authority; load contacts from /api/customers (customerContacts).
 */
import { emit, on } from '../events'
import { OdcrmStorageKeys } from '../keys'
import { getJson, setItem, setJson } from '../storage'

export function getContacts<T = unknown>(): T[] {
  const data = getJson<unknown>(OdcrmStorageKeys.contacts)
  return Array.isArray(data) ? (data as T[]) : []
}

export function setContacts<T = unknown>(contacts: T[]): void {
  setJson(OdcrmStorageKeys.contacts, contacts)
  setItem(OdcrmStorageKeys.contactsLastUpdated, new Date().toISOString())
  emit('contactsUpdated', contacts)
}

export function onContactsUpdated<T = unknown>(handler: (contacts: T[]) => void): () => void {
  return on<T[]>('contactsUpdated', (detail) => handler(Array.isArray(detail) ? detail : []))
}


