/**
 * Stage 2A: Dry-run send worker — process queue items into audited decisions without sending.
 * POST /api/send-worker/dry-run — admin-only; one batch of QUEUED items; writes OutboundSendAttemptAudit per item.
 */
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma.js'
import { validateAdminSecret } from './admin.js'
import { OutboundSendQueueStatus, OutboundSendAttemptDecision } from '@prisma/client'

const router = Router()
const DRY_RUN_BATCH_SIZE = 20

function getSuppressionReason(
  suppressionEntries: Array<{ type: string; value: string; emailNormalized: string | null; reason: string | null }>,
  email: string
): string | null {
  const normalized = email.toLowerCase().trim()
  const domain = email.includes('@') ? email.split('@')[1] : ''
  const emailEntry = suppressionEntries.find((s) => s.type === 'email' && (s.emailNormalized ?? s.value) === normalized)
  if (emailEntry) return emailEntry.reason ?? 'suppressed'
  const domainEntry = suppressionEntries.find((s) => s.type === 'domain' && s.value === domain)
  if (domainEntry) return domainEntry.reason ?? 'suppressed'
  return null
}

/**
 * POST /api/send-worker/dry-run — process one batch of QUEUED items; write audit per item; no real send.
 */
router.post('/dry-run', validateAdminSecret, async (req: Request, res: Response) => {
  try {
    const now = new Date()
    const items = await prisma.outboundSendQueueItem.findMany({
      where: {
        status: OutboundSendQueueStatus.QUEUED,
        OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
      },
      orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'asc' }],
      take: DRY_RUN_BATCH_SIZE,
      select: {
        id: true,
        customerId: true,
        enrollmentId: true,
        recipientEmail: true,
        stepIndex: true,
        attemptCount: true,
      },
    })

    let auditsCreated = 0

    for (const item of items) {
      const customerId = item.customerId
      const recipientEmail = (item.recipientEmail ?? '').trim()

      if (!customerId) {
        await writeAuditAndUpdate(prisma, item.id, customerId, OutboundSendAttemptDecision.ERROR, 'missing_customer_id', { recipientEmail })
        await prisma.outboundSendQueueItem.update({
          where: { id: item.id },
          data: { status: OutboundSendQueueStatus.FAILED, lastError: 'missing_customer_id', attemptCount: item.attemptCount + 1 },
        })
        auditsCreated += 1
        continue
      }

      if (!recipientEmail) {
        await writeAuditAndUpdate(prisma, item.id, customerId, OutboundSendAttemptDecision.SKIP_INVALID, 'missing_recipient_email', { recipientEmail: item.recipientEmail ?? null })
        await prisma.outboundSendQueueItem.update({
          where: { id: item.id },
          data: { status: OutboundSendQueueStatus.SKIPPED, lastError: 'missing_recipient_email', attemptCount: item.attemptCount + 1 },
        })
        auditsCreated += 1
        continue
      }

      const [identityCount, suppressionEntries] = await Promise.all([
        prisma.emailIdentity.count({ where: { customerId, isActive: true } }),
        prisma.suppressionEntry.findMany({
          where: { customerId },
          select: { type: true, value: true, emailNormalized: true, reason: true },
        }),
      ])

      if (identityCount === 0) {
        await writeAuditAndUpdate(prisma, item.id, customerId, OutboundSendAttemptDecision.SKIP_NO_IDENTITY, 'no_active_identity', { recipientEmail })
        await prisma.outboundSendQueueItem.update({
          where: { id: item.id },
          data: { status: OutboundSendQueueStatus.SKIPPED, lastError: 'no_active_identity', attemptCount: item.attemptCount + 1 },
        })
        auditsCreated += 1
        continue
      }

      const suppressionReason = getSuppressionReason(suppressionEntries, recipientEmail)
      if (suppressionReason) {
        await writeAuditAndUpdate(prisma, item.id, customerId, OutboundSendAttemptDecision.SKIP_SUPPRESSED, suppressionReason, { recipientEmail })
        await prisma.outboundSendQueueItem.update({
          where: { id: item.id },
          data: { status: OutboundSendQueueStatus.SKIPPED, lastError: suppressionReason, attemptCount: item.attemptCount + 1 },
        })
        auditsCreated += 1
        continue
      }

      await writeAuditAndUpdate(prisma, item.id, customerId, OutboundSendAttemptDecision.WOULD_SEND, null, { recipientEmail })
      await prisma.outboundSendQueueItem.update({
        where: { id: item.id },
        data: { attemptCount: item.attemptCount + 1, lastError: null },
      })
      auditsCreated += 1
    }

    res.json({
      success: true,
      data: { processedCount: items.length, auditsCreated },
    })
  } catch (err) {
    console.error('[send-worker/dry-run] error:', err)
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Dry-run failed' })
  }
})

async function writeAuditAndUpdate(
  prismaInstance: typeof prisma,
  queueItemId: string,
  customerId: string,
  decision: OutboundSendAttemptDecision,
  reason: string | null,
  snapshot: { recipientEmail: string }
) {
  await prismaInstance.outboundSendAttemptAudit.create({
    data: {
      customerId,
      queueItemId,
      decision,
      reason,
      snapshot,
    },
  })
}

export default router
