/**
 * GET /api/me — UI mode and fixed tenant for client mode.
 * Cached in memory for the session. Used by App to block when client mode is not configured,
 * and by api layer to set X-Customer-Id in client UI.
 */
const API_BASE = typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL
  ? String((import.meta as any).env.VITE_API_URL).trim()
  : ''

export interface MeResponse {
  uiMode: 'agency' | 'client'
  role: 'agency' | 'client'
  fixedCustomerId: string | null
}

let cached: MeResponse | null = null

export async function getMe(): Promise<MeResponse> {
  if (cached) return cached
  const url = `${API_BASE}/api/me`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GET /api/me failed: ${res.status} ${text}`)
  }
  const data = (await res.json()) as MeResponse
  cached = data
  return data
}

/** Returns fixed customer id when in client mode and configured; otherwise null. */
export function getFixedCustomerIdOrNull(): string | null {
  return cached?.uiMode === 'client' && cached?.fixedCustomerId
    ? cached.fixedCustomerId
    : null
}
