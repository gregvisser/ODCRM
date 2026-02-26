/**
 * Central tenant id resolution with client-mode enforcement.
 * When ODCRM_UI_MODE=client and ODCRM_FIXED_CUSTOMER_ID is set:
 * - If request sends X-Customer-Id that does not match fixed id → 403 (blocked).
 * - Otherwise effective customerId is the fixed id (header may be absent).
 * When not in client mode, behavior is unchanged: id from header or query, no silent default.
 */
import { Request, Response } from 'express'

const UI_MODE = (process.env.ODCRM_UI_MODE || 'agency').trim().toLowerCase()
const FIXED_CUSTOMER_ID = process.env.ODCRM_FIXED_CUSTOMER_ID?.trim() || null
const IS_CLIENT_MODE = UI_MODE === 'client' && !!FIXED_CUSTOMER_ID

export type RequiredCustomerIdResult =
  | { customerId: string }
  | { blocked: true }
  | { missing: true }

/**
 * Get effective tenant id for routes that require it. Sets response headers for client mode.
 * - blocked: caller must return 403 (tenant not allowed in client mode).
 * - missing: caller must return 400 (customerId required).
 * - customerId: use for DB/scope.
 */
export function getRequiredCustomerId(req: Request, res: Response): RequiredCustomerIdResult {
  if (IS_CLIENT_MODE && FIXED_CUSTOMER_ID) {
    const headerId = (req.headers['x-customer-id'] as string)?.trim()
    if (headerId && headerId !== FIXED_CUSTOMER_ID) {
      res.setHeader('x-odcrm-client-mode', 'blocked')
      return { blocked: true }
    }
    res.setHeader('x-odcrm-client-mode', 'true')
    return { customerId: FIXED_CUSTOMER_ID }
  }

  const id = (
    (req.headers['x-customer-id'] as string) ||
    (req.query.customerId as string) ||
    (req.body?.customerId as string)
  )
  const trimmed = typeof id === 'string' ? id.trim() : ''
  if (trimmed) return { customerId: trimmed }
  return { missing: true }
}

export function isClientMode(): boolean {
  return IS_CLIENT_MODE
}

export function getFixedCustomerId(): string | null {
  return IS_CLIENT_MODE ? FIXED_CUSTOMER_ID : null
}

/**
 * Helper for route handlers: returns effective customerId or sends 403/400 and returns null.
 * Use: const customerId = requireCustomerId(req, res); if (!customerId) return;
 */
export function requireCustomerId(req: Request, res: Response): string | null {
  const r = getRequiredCustomerId(req, res)
  if ('blocked' in r && r.blocked) {
    res.status(403).json({ error: 'Tenant not allowed in client mode' })
    return null
  }
  if ('missing' in r && r.missing) {
    res.status(400).json({ error: 'Customer ID required (X-Customer-Id header)' })
    return null
  }
  return (r as { customerId: string }).customerId
}
