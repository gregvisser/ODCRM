/**
 * Cognism HTTP API client (server-side only).
 * Contract: Postman collection "Cognism API" (developers.cognism.com), base https://app.cognism.com
 */

const DEFAULT_BASE_URL = 'https://app.cognism.com'
const DEFAULT_TIMEOUT_MS = 25_000

export interface CognismSearchResponse {
  lastReturnedKey?: string
  totalResults?: number
  results?: CognismSearchResultPreview[]
}

export interface CognismSearchResultPreview {
  id: string
  redeemId: string
  firstName?: string
  lastName?: string
  fullName?: string
  jobTitle?: string
  account?: { id?: string; name?: string }
  [key: string]: unknown
}

export interface CognismRedeemResponse {
  totalResults?: number
  results?: unknown[]
}

function parseCognismErrorMessage(status: number, bodyText: string): string {
  if (status === 401 || status === 403) {
    return 'Cognism rejected the API key (unauthorized). Check the token is valid and not expired.'
  }
  if (status === 429) {
    return 'Cognism rate limit reached. Wait and try again, or reduce poll frequency.'
  }
  if (status >= 500) {
    return 'Cognism service is temporarily unavailable. Try again later.'
  }
  try {
    const j = JSON.parse(bodyText) as { message?: string; error?: string; title?: string }
    const msg = j.message || j.error || j.title
    if (typeof msg === 'string' && msg.trim()) return `Cognism: ${msg.trim()}`
  } catch {
    // ignore
  }
  const t = bodyText.trim().slice(0, 400)
  return t ? `Cognism error (HTTP ${status}): ${t}` : `Cognism request failed (HTTP ${status})`
}

async function cognismFetch(
  apiKey: string,
  path: string,
  init: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const base = (process.env.COGNISM_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '')
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`
  const timeoutMs = init.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
        ...(init.headers ?? {}),
      },
    })
    return res
  } finally {
    clearTimeout(t)
  }
}

/** GET /api/search/entitlement/contactEntitlementSubscription — validate API key. */
export async function cognismValidateApiKey(apiKey: string): Promise<void> {
  const res = await cognismFetch(apiKey, '/api/search/entitlement/contactEntitlementSubscription', {
    method: 'GET',
    timeoutMs: 15_000,
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(parseCognismErrorMessage(res.status, text))
  }
}

/**
 * POST /api/search/contact/search?lastReturnedKey=&indexSize=
 * Body: Cognism search criteria (see official docs / Postman collection).
 */
export async function cognismSearchContacts(
  apiKey: string,
  body: Record<string, unknown>,
  pagination: { lastReturnedKey?: string; indexSize: number }
): Promise<CognismSearchResponse> {
  const params = new URLSearchParams()
  params.set('lastReturnedKey', pagination.lastReturnedKey ?? '')
  params.set('indexSize', String(pagination.indexSize))
  const res = await cognismFetch(apiKey, `/api/search/contact/search?${params.toString()}`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
    timeoutMs: DEFAULT_TIMEOUT_MS,
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(parseCognismErrorMessage(res.status, text))
  }
  try {
    return JSON.parse(text) as CognismSearchResponse
  } catch {
    throw new Error('Cognism search returned invalid JSON')
  }
}

/**
 * POST /api/search/contact/redeem?mergePhonesAndLocations=
 */
export async function cognismRedeemContacts(
  apiKey: string,
  redeemIds: string[],
  mergePhonesAndLocations?: boolean
): Promise<CognismRedeemResponse> {
  const q = new URLSearchParams()
  if (mergePhonesAndLocations !== undefined) {
    q.set('mergePhonesAndLocations', mergePhonesAndLocations ? 'true' : 'false')
  }
  const path = `/api/search/contact/redeem${q.toString() ? `?${q.toString()}` : ''}`
  const res = await cognismFetch(apiKey, path, {
    method: 'POST',
    body: JSON.stringify({ redeemIds }),
    timeoutMs: DEFAULT_TIMEOUT_MS,
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(parseCognismErrorMessage(res.status, text))
  }
  try {
    return JSON.parse(text) as CognismRedeemResponse
  } catch {
    throw new Error('Cognism redeem returned invalid JSON')
  }
}
