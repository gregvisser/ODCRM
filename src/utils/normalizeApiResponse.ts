/**
 * Canonical API response normalizer
 * 
 * Backend currently returns { customers: [...] } (wrapped format)
 * Legacy code may have expected [...] (direct array)
 * 
 * This function provides ONE place to handle both formats.
 * DO NOT silently return [] - throw errors so failures surface in UI.
 */

import type { DatabaseCustomer } from '../hooks/useCustomersFromDatabase'

/**
 * Normalize GET /api/customers response
 * 
 * @throws Error if response shape is unexpected (surfaces as UI error, not silent empty list)
 */
export function normalizeCustomersListResponse(data: unknown): DatabaseCustomer[] {
  // Handle null/undefined from API errors
  if (data === null || data === undefined) {
    throw new Error('Customers API returned null/undefined. Check server logs.')
  }

  // Legacy format: direct array
  if (Array.isArray(data)) {
    return data as DatabaseCustomer[]
  }

  // Current production format: { customers: [...] }
  if (
    typeof data === 'object' &&
    'customers' in data &&
    Array.isArray((data as any).customers)
  ) {
    return (data as any).customers as DatabaseCustomer[]
  }

  // Unexpected shape - fail loudly
  console.error('❌ Unexpected customers API response shape:', data)
  throw new Error(
    'Unexpected customers API response format. Expected array or { customers: array }. ' +
    'Server may have returned error HTML or invalid JSON.'
  )
}
