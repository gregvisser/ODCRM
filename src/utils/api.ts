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
  errorDetails?: {
    status: number
    message: string
    requestId?: string
    prismaCode?: string
    details?: any
  }
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const customerId = settingsStore.getCurrentCustomerId('prod-customer-1')
    const fullUrl = `${API_BASE_URL}${endpoint}`
    
    console.log(`[API] ${options.method || 'GET'} ${fullUrl}`)
    
    const method = (options.method || 'GET').toUpperCase()

    // CRITICAL: Avoid cached 304 responses with empty bodies (breaks response.json()).
    // - Force no-store caching mode in fetch
    // - Add explicit no-cache request headers (helps with some proxies/CDNs)
    const buildRequestInit = (override?: Partial<RequestInit>): RequestInit => {
      // Use Headers() to safely merge all supported header shapes (object, array, Headers)
      const headers = new Headers(options.headers)
      if (override?.headers) {
        new Headers(override.headers).forEach((value, key) => headers.set(key, value))
      }

      // Only set Content-Type for methods that actually send our JSON bodies.
      // Setting Content-Type on methods without a body (e.g. DELETE) is misleading and
      // can trigger unnecessary CORS preflights.
      if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
        headers.set('Content-Type', 'application/json')
      }

      // Always request fresh responses (API should never be cached).
      // Server CORS explicitly allows these headers.
      if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'no-cache')
      if (!headers.has('Pragma')) headers.set('Pragma', 'no-cache')

      // Caller-provided X-Customer-Id wins (e.g. Templates tab dropdown); only fall back to store when not set.
      if (!headers.has('X-Customer-Id') && customerId) headers.set('X-Customer-Id', customerId)

      return {
        ...options,
        ...override,
        cache: 'no-store',
        headers
      }
    }

    let response = await fetch(fullUrl, buildRequestInit())

    // Defensive: If a proxy still returns 304 (no body), retry once with same no-store settings.
    if (response.status === 304 && method === 'GET') {
      console.warn(`[API] ${method} ${fullUrl} -> 304 (no body). Retrying with no-store...`)
      response = await fetch(fullUrl, buildRequestInit())
    }

    console.log(`[API] ${options.method || 'GET'} ${fullUrl} -> ${response.status}`)

    if (!response.ok) {
      // Try to parse JSON error response with detailed structure
      let errorResponse: any
      const contentType = response.headers.get('content-type')
      
      if (contentType?.includes('application/json')) {
        try {
          errorResponse = await response.json()
        } catch (parseErr) {
          errorResponse = { error: response.statusText }
        }
      } else {
        // Non-JSON response (e.g., HTML error page)
        const text = await response.text()
        errorResponse = { 
          error: `HTTP ${response.status}: ${response.statusText}`,
          details: text.substring(0, 200) // First 200 chars for context
        }
      }
      
      // Build detailed error message for user
      let errorMessage = errorResponse.error || `HTTP ${response.status}`
      if (errorResponse.message && errorResponse.message !== errorResponse.error) {
        errorMessage = errorResponse.message
      }
      
      // Add requestId if present
      if (errorResponse.requestId) {
        errorMessage += ` (requestId: ${errorResponse.requestId})`
      }
      
      // Add prismaCode if present
      if (errorResponse.prismaCode) {
        errorMessage += ` [${errorResponse.prismaCode}]`
      }
      
      if (errorResponse.details) {
        // If details is an array (validation errors), format nicely
        if (Array.isArray(errorResponse.details)) {
          const detailsStr = errorResponse.details
            .map((d: any) => `${d.path?.join('.') || 'field'}: ${d.message}`)
            .join(', ')
          errorMessage += ` - ${detailsStr}`
        }
      }
      
      console.error(`[API ERROR] ${fullUrl} [${response.status}]:`, {
        status: response.status,
        errorMessage,
        requestId: errorResponse.requestId,
        prismaCode: errorResponse.prismaCode,
        fullResponse: errorResponse
      })
      
      return { 
        error: errorMessage,
        errorDetails: {
          status: response.status,
          message: errorResponse.message || errorMessage,
          requestId: errorResponse.requestId,
          prismaCode: errorResponse.prismaCode,
          details: errorResponse.details
        }
      }
    }

    // CRITICAL: Some intermediaries can still respond 304 with empty body.
    // Avoid crashing on response.json() and keep the app stable.
    if (response.status === 304) {
      // Safe fallback for the customer LIST endpoint (prevents crashes).
      // Backend should prevent this, but keep frontend resilient.
      if (endpoint === '/api/customers' || endpoint.startsWith('/api/customers?')) {
        return { data: ([] as unknown) as T }
      }

      // For other endpoints, return null rather than throwing.
      return { data: (null as unknown) as T }
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
  get: <T>(endpoint: string, options?: RequestInit) => apiRequest<T>(endpoint, { ...(options || {}), method: 'GET' }),
  post: <T>(endpoint: string, body: any, options?: RequestInit) =>
    apiRequest<T>(endpoint, { ...(options || {}), method: 'POST', body: JSON.stringify(body) }),
  put: <T>(endpoint: string, body: any, options?: RequestInit) =>
    apiRequest<T>(endpoint, { ...(options || {}), method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(endpoint: string, body: any, options?: RequestInit) =>
    apiRequest<T>(endpoint, { ...(options || {}), method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(endpoint: string, options?: RequestInit) =>
    apiRequest<T>(endpoint, { ...(options || {}), method: 'DELETE' }),
}
