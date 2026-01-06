import { emit, on } from '../events'
import { OdcrmStorageKeys } from '../keys'
import { getItem, removeItem, setItem } from '../storage'

export function getHeaderImageDataUrl(storageKey: string = OdcrmStorageKeys.headerImageDataUrl): string | null {
  const raw = getItem(storageKey)
  return raw ? String(raw) : null
}

export function setHeaderImageDataUrl(
  dataUrl: string,
  storageKey: string = OdcrmStorageKeys.headerImageDataUrl
): void {
  setItem(storageKey, dataUrl)
  emit('headerImageUpdated', { storageKey, dataUrl })
}

export function clearHeaderImageDataUrl(storageKey: string = OdcrmStorageKeys.headerImageDataUrl): void {
  removeItem(storageKey)
  emit('headerImageUpdated', { storageKey, dataUrl: null })
}

export function onHeaderImageUpdated(
  handler: (detail: { storageKey?: string; dataUrl?: string | null }) => void
): () => void {
  return on('headerImageUpdated', (detail) => handler((detail || {}) as any))
}


