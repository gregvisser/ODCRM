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
      if (errorResponse.details) {
        // If details is an array (validation errors), format nicely
        if (Array.isArray(errorResponse.details)) {
          const detailsStr = errorResponse.details
            .map((d: any) => `${d.path?.join('.') || 'field'}: ${d.message}`)
            .join(', ')
          errorMessage += ` (${detailsStr})`
        } else if (typeof errorResponse.details === 'string') {
          errorMessage += ` (${errorResponse.details})`
        }
      }
      
      console.error(`[API ERROR] ${fullUrl} [${response.status}]:`, {
        status: response.status,
        error: errorResponse,
        fullResponse: errorResponse
      })
      
      return { error: errorMessage }
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
