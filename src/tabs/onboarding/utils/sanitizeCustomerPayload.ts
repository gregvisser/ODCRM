/**
 * Sanitize Customer Update Payload
 * 
 * Removes null/undefined values from customer update payloads to prevent
 * backend validation errors. Backend schemas use z.string().optional() which
 * accepts string | undefined, but NOT null.
 * 
 * CRITICAL: This prevents errors like "domain: Expected string, received null"
 */

/**
 * Recursively remove null and undefined values from an object
 * 
 * @param obj - Object to sanitize
 * @returns New object with null/undefined values removed
 * 
 * @example
 * sanitize({ name: "X", domain: null, website: undefined })
 * // Returns: { name: "X" }
 */
function removeNullish(obj: any): any {
  if (obj === null || obj === undefined) {
    return undefined
  }

  if (Array.isArray(obj)) {
    return obj
      .map(item => removeNullish(item))
      .filter(item => item !== undefined)
  }

  if (typeof obj === 'object') {
    const result: any = {}
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedValue = removeNullish(value)
      if (sanitizedValue !== undefined) {
        result[key] = sanitizedValue
      }
    }
    return result
  }

  return obj
}

/**
 * Sanitize customer update payload for PUT /api/customers/:id
 * 
 * Removes null/undefined fields to prevent backend validation errors.
 * Preserves accountData and other nested objects.
 * 
 * @param payload - Customer update payload
 * @returns Sanitized payload with null/undefined removed
 * 
 * @example
 * const payload = {
 *   name: "Company X",
 *   domain: null,          // ❌ Would cause validation error
 *   accountData: { ... }
 * }
 * const sanitized = sanitizeCustomerPayload(payload)
 * // Returns: { name: "Company X", accountData: { ... } }
 * // domain is omitted (not sent as null)
 */
export function sanitizeCustomerPayload(payload: Record<string, any>): Record<string, any> {
  // Start with required fields
  const sanitized: Record<string, any> = {
    name: payload.name, // Required by backend
  }

  // Add optional fields only if they have valid (non-null) values
  const optionalFields = [
    'domain',
    'website',
    'whatTheyDo',
    'accreditations',
    'keyLeaders',
    'companyProfile',
    'recentNews',
    'companySize',
    'headquarters',
    'foundingYear',
    'socialPresence',
    'leadsReportingUrl',
    'leadsGoogleSheetLabel',
    'sector',
    'clientStatus',
    'targetJobTitle',
    'prospectingLocation',
    'monthlyIntakeGBP',
    'monthlyRevenueFromCustomer',
    'defcon',
    'weeklyLeadTarget',
    'weeklyLeadActual',
    'monthlyLeadTarget',
    'monthlyLeadActual',
  ]

  for (const field of optionalFields) {
    const value = payload[field]
    if (value !== null && value !== undefined) {
      sanitized[field] = value
    }
  }

  // Always include accountData (can be null/object)
  // Backend accepts accountData as z.unknown().optional().nullable()
  if ('accountData' in payload) {
    sanitized.accountData = payload.accountData
  }

  return sanitized
}

/**
 * Validate that required fields are present before sending
 * Throws error if required fields are missing to prevent silent data loss
 */
export function validateCustomerPayload(payload: Record<string, any>): void {
  if (!payload.name || typeof payload.name !== 'string') {
    throw new Error('Customer payload missing required field: name (string)')
  }
}
