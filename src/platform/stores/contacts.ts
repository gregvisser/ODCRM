import { emit, on } from '../events'
import { OdcrmStorageKeys } from '../keys'
import { getJson, setJson } from '../storage'

export function getContacts<T = unknown>(): T[] {
  const data = getJson<unknown>(OdcrmStorageKeys.contacts)
  return Array.isArray(data) ? (data as T[]) : []
}

export function setContacts<T = unknown>(contacts: T[]): void {
  setJson(OdcrmStorageKeys.contacts, contacts)
  emit('contactsUpdated', contacts)
}

export function onContactsUpdated<T = unknown>(handler: (contacts: T[]) => void): () => void {
  return on<T[]>('contactsUpdated', (detail) => handler(Array.isArray(detail) ? detail : []))
}


