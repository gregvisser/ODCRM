import { emit, on } from '../events'
import { OdcrmStorageKeys } from '../keys'
import { getItem, removeItem, setItem } from '../storage'

// Audit P1-3 (2026-02-22): removed write-back of fallback to localStorage.
// Previously, passing fallback='prod-customer-1' would persist that value into
// localStorage, causing all subsequent API calls to use a non-existent customer ID
// instead of requiring the user to select a real customer. Callers that pass their
// own explicit fallback still receive it as a return value but it is no longer stored.
export function getCurrentCustomerId(fallback = ''): string {
  const v = getItem(OdcrmStorageKeys.currentCustomerId)
  if (v && String(v).trim()) {
    return String(v).trim()
  }
  return fallback
}

export function setCurrentCustomerId(customerId: string): void {
  setItem(OdcrmStorageKeys.currentCustomerId, String(customerId || '').trim())
  emit('settingsUpdated', { currentCustomerId: String(customerId || '').trim() })
}

export function clearCurrentCustomerId(): void {
  removeItem(OdcrmStorageKeys.currentCustomerId)
  emit('settingsUpdated', { currentCustomerId: null })
}

export function onSettingsUpdated(handler: (detail: unknown) => void): () => void {
  return on('settingsUpdated', (detail) => handler(detail))
}


