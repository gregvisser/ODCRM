import { emit, on } from '../events'
import { OdcrmStorageKeys } from '../keys'
import { getJson, setItem, setJson } from '../storage'

export type StoredUser = Record<string, unknown>

export function getUsers<T = StoredUser>(): T[] {
  const data = getJson<unknown>(OdcrmStorageKeys.users)
  return Array.isArray(data) ? (data as T[]) : []
}

export function setUsers<T = StoredUser>(users: T[]): void {
  setJson(OdcrmStorageKeys.users, users)
  setItem(OdcrmStorageKeys.usersLastUpdated, new Date().toISOString())
  emit('usersUpdated', users)
}

export function onUsersUpdated<T = StoredUser>(handler: (users: T[]) => void): () => void {
  return on<T[]>('usersUpdated', (detail) => handler(Array.isArray(detail) ? detail : []))
}


