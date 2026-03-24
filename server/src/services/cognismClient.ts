/**
 * Cognism HTTP API client (server-side only).
 * Contract: documented Search / Redeem flow — POST https://app.cognism.com/api/search/contact/search and .../redeem
 * (see Cognism API docs / Postman). Do not use web-app HTML routes for API validation.
 */

const DEFAULT_BASE_URL = 'https://app.cognism.com'
const DEFAULT_TIMEOUT_MS = 25_000

/** Small page size for connect-time validation only (limits payload; same API as import). */
export const COGNISM_VALIDATE_SEARCH_INDEX_SIZE = 1

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

/** True when the body looks like an HTML document (SPA shell / login page), not API JSON. */
export function cognismResponseLooksLikeHtml(bodyText: string): boolean {
  const s = bodyText.trimStart().slice(0, 800)
  if (!s) return false
  const lower = s.toLowerCase()
  return (
    lower.startsWith('<!doctype html') ||
    lower.startsWith('<html') ||
    (lower.includes('<html') && lower.includes('</'))
  )
}

function parseCognismJsonPayload<T>(bodyText: string, operation: string): T {
  if (cognismResponseLooksLikeHtml(bodyText)) {
    throw new Error(
      `Cognism returned HTML instead of API JSON (${operation}). Confirm requests use the documented Search API (POST /api/search/contact/search) and base URL https://app.cognism.com (or set COGNISM_API_BASE_URL correctly).`
    )
  }
  try {
    return JSON.parse(bodyText) as T
  } catch {
    throw new Error(`Cognism returned non-JSON for ${operation}.`)
  }
}

function parseCognismErrorMessage(status: number, bodyText: string): string {
  if (cognismResponseLooksLikeHtml(bodyText)) {
    return `Cognism returned a web page (HTTP ${status}) instead of API JSON — the request did not receive a Search API response. Use the documented contact Search endpoint (POST /api/search/contact/search) with base https://app.cognism.com.`
  }
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
    // fall through
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

/**
 * Validates the API key with the same documented Search API used for imports:
 * POST /api/search/contact/search?lastReturnedKey=&indexSize=
 * Does not call redeem or persist anything.
 */
export async function cognismValidateApiKey(
  apiKey: string,
  searchBody: Record<string, unknown> = {}
): Promise<void> {
  await cognismSearchContacts(apiKey, searchBody, {
    lastReturnedKey: '',
    indexSize: COGNISM_VALIDATE_SEARCH_INDEX_SIZE,
  })
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
  return parseCognismJsonPayload<CognismSearchResponse>(text, 'contact search')
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
  return parseCognismJsonPayload<CognismRedeemResponse>(text, 'contact redeem')
}
