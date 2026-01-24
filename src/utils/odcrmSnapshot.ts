import { ODCRM_STORAGE_PREFIX, SIDEBAR_STORAGE_PREFIX } from '../platform/keys'
import * as platformStorage from '../platform/storage'
import { stringifyForDownload, triggerDownload } from './download'

export type OdcrmSnapshotV1 = {
  version: 1
  createdAt: string
  origin: string
  /**
   * Key/value dump of localStorage entries (parsed if JSON, otherwise raw string).
   * Only includes ODCRM-owned keys to avoid exporting unrelated app/browser data.
   */
  storage: Record<string, unknown>
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

export function createOdcrmSnapshot(): OdcrmSnapshotV1 {
  const storage: Record<string, unknown> = {}
  for (const key of platformStorage.keys()) {
    if (
      !key.startsWith(ODCRM_STORAGE_PREFIX) &&
      !key.startsWith(SIDEBAR_STORAGE_PREFIX)
    )
      continue
    const value = platformStorage.getItem(key)
    if (value === null) continue
    storage[key] = safeJsonParse(value)
  }

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    origin: window.location.origin,
    storage,
  }
}

export async function downloadOdcrmSnapshot(snapshot: OdcrmSnapshotV1) {
  const json = await stringifyForDownload(snapshot, true)
  const filename = `odcrm-snapshot-${new Date().toISOString().split('T')[0]}.json`
  triggerDownload(json, filename, 'application/json')
}

export function importOdcrmSnapshot(snapshot: unknown, options?: { replace?: boolean }) {
  if (!snapshot || typeof snapshot !== 'object') throw new Error('Invalid snapshot format')
  const s = snapshot as Partial<OdcrmSnapshotV1>
  if (s.version !== 1) throw new Error('Unsupported snapshot version')
  if (!s.storage || typeof s.storage !== 'object') throw new Error('Invalid snapshot payload')

  const replace = options?.replace ?? true
  const entries = Object.entries(s.storage as Record<string, unknown>)

  for (const [key, value] of entries) {
    if (!key.startsWith(ODCRM_STORAGE_PREFIX) && !key.startsWith(SIDEBAR_STORAGE_PREFIX)) continue
    if (!replace && platformStorage.getItem(key) !== null) continue
    platformStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
  }
}


