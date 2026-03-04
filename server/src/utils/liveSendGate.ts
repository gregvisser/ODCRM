/**
 * Stage 4-min: single gate for all live-sending entrypoints.
 * Returns { allowed, reason? }. No logging of secrets. Reason strings are safe for logs.
 */

export interface AssertLiveSendAllowedOpts {
  customerId: string
  identityId?: string | null
  trigger: 'worker' | 'manual'
}

export function assertLiveSendAllowed(opts: AssertLiveSendAllowedOpts): { allowed: boolean; reason?: string } {
  const { customerId, identityId, trigger: _trigger } = opts

  if (process.env.ENABLE_SEND_QUEUE_SENDING !== 'true') {
    return { allowed: false, reason: 'live_send_disabled_env' }
  }
  if (process.env.ENABLE_LIVE_SENDING !== 'true') {
    return { allowed: false, reason: 'live_send_disabled_env' }
  }

  const canaryCustomerId = process.env.SEND_CANARY_CUSTOMER_ID
  if (!canaryCustomerId || canaryCustomerId.trim() === '') {
    return { allowed: false, reason: 'canary_customer_not_configured' }
  }
  if (canaryCustomerId.trim() !== customerId) {
    return { allowed: false, reason: 'customer_not_in_canary' }
  }

  const canaryIdentityId = process.env.SEND_CANARY_IDENTITY_ID?.trim()
  if (canaryIdentityId) {
    if (identityId == null || identityId === '') {
      return { allowed: false, reason: 'canary_identity_required_but_missing' }
    }
    if (identityId !== canaryIdentityId) {
      return { allowed: false, reason: 'identity_not_in_canary' }
    }
  }

  return { allowed: true }
}

const LIVE_SEND_CAP_DEFAULT = 10

/**
 * Returns the max number of items allowed per live-tick (or similar). Does not count sends.
 */
export function getLiveSendCap(): number {
  const raw = process.env.LIVE_SEND_CAP
  if (raw == null || raw === '') return LIVE_SEND_CAP_DEFAULT
  const n = parseInt(raw, 10)
  if (Number.isNaN(n) || n < 1) return LIVE_SEND_CAP_DEFAULT
  return n
}
