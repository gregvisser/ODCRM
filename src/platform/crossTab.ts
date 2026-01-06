// Cross-tab event bus for ODCRM.
// - BroadcastChannel when available (modern browsers)
// - localStorage "poke" fallback otherwise
//
// IMPORTANT:
// - localStorage `storage` event only fires in *other* tabs (not the same tab)
// - BroadcastChannel fires in all tabs, including sender (we filter by source id)

import { isStorageAvailable, setItem } from './storage'

type CrossTabMessage = {
  v: 1
  sourceId: string
  name: string
  detail?: unknown
  ts: number
}

const CHANNEL_NAME = 'odcrm:events:v1'
const STORAGE_FALLBACK_KEY = 'odcrm__cross_tab_event'

const sourceId =
  (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function'
    ? (crypto as any).randomUUID()
    : `odcrm_${Math.random().toString(16).slice(2)}_${Date.now()}`) as string

let channel: BroadcastChannel | null = null
function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null
  if (channel) return channel
  try {
    if (typeof BroadcastChannel === 'function') {
      channel = new BroadcastChannel(CHANNEL_NAME)
      return channel
    }
  } catch {
    // ignore
  }
  return null
}

export function publishCrossTab(name: string, detail?: unknown): void {
  if (typeof window === 'undefined') return
  const msg: CrossTabMessage = { v: 1, sourceId, name, detail, ts: Date.now() }

  const bc = getChannel()
  if (bc) {
    try {
      bc.postMessage(msg)
      return
    } catch {
      // fall through to localStorage
    }
  }

  if (!isStorageAvailable()) return
  try {
    // storage event in other tabs
    setItem(STORAGE_FALLBACK_KEY, JSON.stringify(msg))
  } catch {
    // ignore
  }
}

export function subscribeCrossTab(
  name: string,
  handler: (detail: unknown) => void
): () => void {
  if (typeof window === 'undefined') return () => {}

  const bc = getChannel()
  const onBc = (ev: MessageEvent) => {
    const msg = ev.data as CrossTabMessage
    if (!msg || msg.v !== 1) return
    if (msg.sourceId === sourceId) return
    if (msg.name !== name) return
    handler(msg.detail)
  }

  if (bc) {
    bc.addEventListener('message', onBc)
  }

  const onStorage = (ev: StorageEvent) => {
    if (ev.key !== STORAGE_FALLBACK_KEY) return
    if (!ev.newValue) return
    try {
      const msg = JSON.parse(ev.newValue) as CrossTabMessage
      if (!msg || msg.v !== 1) return
      if (msg.sourceId === sourceId) return
      if (msg.name !== name) return
      handler(msg.detail)
    } catch {
      // ignore
    }
  }
  window.addEventListener('storage', onStorage)

  return () => {
    if (bc) bc.removeEventListener('message', onBc)
    window.removeEventListener('storage', onStorage)
  }
}


