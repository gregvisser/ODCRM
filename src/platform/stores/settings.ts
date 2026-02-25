import { emit, on } from '../events'
import { OdcrmStorageKeys } from '../keys'
import { getItem, removeItem, setItem } from '../storage'

/**
 * Returns the currently selected client (tenant) id, or null if none selected.
 * No silent fallback. Only setCurrentCustomerId / user selection establishes active client.
 */
export function getCurrentCustomerId(): string | null {
  const v = getItem(OdcrmStorageKeys.currentCustomerId)
  if (v && String(v).trim()) return String(v).trim()
  return null
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


