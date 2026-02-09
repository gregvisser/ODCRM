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
    const fullUrl = `${API_BASE_URL}${endpoint}`
    
    console.log(`[API] ${options.method || 'GET'} ${fullUrl}`)
    
    const response = await fetch(fullUrl, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(customerId ? { 'X-Customer-Id': customerId } : {}),
        ...options.headers
      }
    })

    console.log(`[API] ${options.method || 'GET'} ${fullUrl} -> ${response.status}`)

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }))
      console.error(`[API ERROR] ${fullUrl}:`, error)
      return { error: error.error || `HTTP ${response.status}` }
    }

    const data = await response.json()
    console.log(`[API SUCCESS] ${fullUrl}:`, data)
    return { data }
  } catch (error: any) {
    console.error(`[API EXCEPTION] ${endpoint}:`, error)
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
