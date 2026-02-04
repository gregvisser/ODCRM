/**
 * Accounts store: CACHE ONLY. Database (API) is the source of truth.
 * Do not use getAccounts() as the authority for business data; use useCustomersFromDatabase or API.
 */
import { emit, on } from '../events'
import { OdcrmStorageKeys } from '../keys'
import { getJson, setItem, setJson } from '../storage'

export function getAccounts<T = unknown>(): T[] {
  const data = getJson<unknown>(OdcrmStorageKeys.accounts)
  return Array.isArray(data) ? (data as T[]) : []
}

export function setAccounts<T = unknown>(accounts: T[]): void {
  setJson(OdcrmStorageKeys.accounts, accounts)
  setItem(OdcrmStorageKeys.accountsLastUpdated, new Date().toISOString())
  emit('accountsUpdated', accounts)
}

export function onAccountsUpdated<T = unknown>(handler: (accounts: T[]) => void): () => void {
  return on<T[]>('accountsUpdated', (detail) => handler(Array.isArray(detail) ? detail : []))
}


