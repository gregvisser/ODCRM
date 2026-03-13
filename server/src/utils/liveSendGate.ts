import { isLiveSendingEnabled, isSendQueueSendingEnabled } from './liveSendRuntime.js'

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
  const { customerId: _customerId, identityId: _identityId, trigger: _trigger } = opts

  if (!isSendQueueSendingEnabled()) {
    return { allowed: false, reason: 'live_send_disabled_env' }
  }
  if (!isLiveSendingEnabled()) {
    return { allowed: false, reason: 'live_send_disabled_env' }
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
