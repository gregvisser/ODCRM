/**
 * Shared send-queue helpers (Stage 1D/1E).
 * Used by worker and by admin tick endpoint for consistent dry-run requeue behavior.
 */
import type { PrismaClient } from '@prisma/client'
import { OutboundSendQueueStatus } from '@prisma/client'

const DRY_RUN_REASON_MAX = 500

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

export const DRY_RUN_DEFAULT_REASON = 'DRY_RUN: sending disabled'
