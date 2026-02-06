import { settingsStore } from '../platform'

// API utility for making requests to backend
// VITE_API_URL MUST be set. In production, Azure SWA proxy handles /api/* routing.
// In development, it points to localhost:3001
const API_BASE_URL = import.meta.env.VITE_API_URL || ''

// Warn if API_BASE_URL is empty - in production this relies on Azure SWA proxy
if (!API_BASE_URL && typeof window !== 'undefined') {
  console.warn(
    '[API] VITE_API_URL is not set. Requests will use relative URLs (/api/*). ' +
    'This works in production via Azure SWA proxy, but may fail if proxy is misconfigured.'
  )
}

export interface ApiResponse<T> {
  data?: T
  error?: string
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const customerId = settingsStore.getCurrentCustomerId('prod-customer-1')
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(customerId ? { 'X-Customer-Id': customerId } : {}),
        ...options.headers
      }
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }))
      return { error: error.error || `HTTP ${response.status}` }
    }

    const data = await response.json()
    return { data }
  } catch (error: any) {
    return { error: error.message || 'Network error' }
  }
}

export const api = {
  get: <T>(endpoint: string) => apiRequest<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body: any) => 
    apiRequest<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(endpoint: string, body: any) =>
    apiRequest<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(endpoint: string, body: any) =>
    apiRequest<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(endpoint: string) => apiRequest<T>(endpoint, { method: 'DELETE' })
}
