const API_AUTH_TOKEN_KEY = 'odcrm_api_bearer_token'

let cachedToken: string | null = null

export function getApiAuthToken(): string | null {
  if (cachedToken) return cachedToken
  if (typeof window === 'undefined') return null
  try {
    const token = window.sessionStorage.getItem(API_AUTH_TOKEN_KEY)
    cachedToken = token && token.trim() ? token.trim() : null
    return cachedToken
  } catch {
    return null
  }
}

export function setApiAuthToken(token: string | null | undefined): void {
  const next = token && token.trim() ? token.trim() : null
  cachedToken = next
  if (typeof window === 'undefined') return
  try {
    if (next) window.sessionStorage.setItem(API_AUTH_TOKEN_KEY, next)
    else window.sessionStorage.removeItem(API_AUTH_TOKEN_KEY)
  } catch {
    // Ignore storage failures; in-memory cache still helps for the current tab.
  }
}

export function clearApiAuthToken(): void {
  setApiAuthToken(null)
}
