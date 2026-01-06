import { settingsStore } from '../platform'

// API utility for making requests to backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export interface ApiResponse<T> {
  data?: T
  error?: string
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const customerId = settingsStore.getCurrentCustomerId('test-customer-1')
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Customer-Id': customerId,
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
  patch: <T>(endpoint: string, body: any) =>
    apiRequest<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(endpoint: string) => apiRequest<T>(endpoint, { method: 'DELETE' })
}
