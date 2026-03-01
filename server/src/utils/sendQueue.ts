/**
 * Shared send-queue helpers (Stage 1D/1E/1F).
 * Used by worker and by admin tick endpoint for consistent dry-run requeue and send-failure behavior.
 */
import type { PrismaClient } from '@prisma/client'
import { OutboundSendQueueStatus } from '@prisma/client'

const DRY_RUN_REASON_MAX = 500
const SEND_FAILED_PREFIX = 'SEND_FAILED: '

/** Default max live sends per tick/iteration (Stage 1F). */
export const LIVE_SEND_CAP = Math.min(
  Math.max(1, Number(process.env.LIVE_SEND_CAP) || 10),
  100
)

/**
 * Requeue a single queue item as dry-run: set status=QUEUED, clear lock, set lastError.
 * Non-destructive; does not set FAILED or sentAt.
 */
export async function requeueDryRun(
  prisma: PrismaClient,
  itemId: string,
  reason: string
): Promise<void> {
  const truncated = reason.slice(0, DRY_RUN_REASON_MAX)
  await prisma.outboundSendQueueItem.update({
    where: { id: itemId },
    data: {
      status: OutboundSendQueueStatus.QUEUED,
      lockedAt: null,
      lockedBy: null,
      lastError: truncated,
    },
  })
}

/**
 * Requeue after send failure (Stage 1F): status=QUEUED, clear lock, lastError = "SEND_FAILED: <msg>" (truncate 500).
 * Never leave item LOCKED or FAILED for send failures.
 */
export async function requeueAfterSendFailure(
  prisma: PrismaClient,
  itemId: string,
  message: string
): Promise<void> {
  const truncated = (SEND_FAILED_PREFIX + message).slice(0, DRY_RUN_REASON_MAX)
  await prisma.outboundSendQueueItem.update({
    where: { id: itemId },
    data: {
      status: OutboundSendQueueStatus.QUEUED,
      lockedAt: null,
      lockedBy: null,
      lastError: truncated,
    },
  })
}

/**
 * Canary gates for live send (Stage 1F).
 * Live send allowed only when: ENABLE_SEND_QUEUE_SENDING, ENABLE_LIVE_SENDING,
 * SEND_CANARY_CUSTOMER_ID set and equals customerId; if SEND_CANARY_IDENTITY_ID set, identityId must match.
 */
export function canaryGatesAllowLiveSend(customerId: string, identityId?: string | null): boolean {
  if (process.env.ENABLE_SEND_QUEUE_SENDING !== 'true') return false
  if (process.env.ENABLE_LIVE_SENDING !== 'true') return false
  const canaryCustomer = process.env.SEND_CANARY_CUSTOMER_ID?.trim() || null
  if (canaryCustomer == null || customerId !== canaryCustomer) return false
  const canaryIdentity = process.env.SEND_CANARY_IDENTITY_ID?.trim() || null
  if (canaryIdentity != null && identityId !== canaryIdentity) return false
  return true
}

export const DRY_RUN_DEFAULT_REASON = 'DRY_RUN: sending disabled'
