import { emit, on } from '../events'
import { OdcrmStorageKeys } from '../keys'
import { getItem, removeItem, setItem } from '../storage'

export function getCurrentCustomerId(fallback = 'test-customer-1'): string {
  const v = getItem(OdcrmStorageKeys.currentCustomerId)
  return v && String(v).trim() ? String(v) : fallback
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


