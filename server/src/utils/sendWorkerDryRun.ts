import { OutboundSendAttemptDecision, OutboundSendQueueStatus, PrismaClient } from '@prisma/client'

export const DRY_RUN_BATCH_SIZE_DEFAULT = 20

function getSuppressionReason(
  suppressionEntries: Array<{ type: string; value: string; emailNormalized: string | null; reason: string | null }>,
  email: string
): string | null {
  const recipientEmailNormalized = email.trim().toLowerCase()
  const at = recipientEmailNormalized.lastIndexOf('@')
  const recipientDomainNormalized = at >= 0 ? recipientEmailNormalized.slice(at + 1) : ''
  const emailEntry = suppressionEntries.find((s) => s.type === 'email' && (s.emailNormalized ?? s.value) === recipientEmailNormalized)
  if (emailEntry) return emailEntry.reason ?? 'suppressed'
  const domainEntry = suppressionEntries.find((s) => s.type === 'domain' && (s.value ?? '').trim().toLowerCase() === recipientDomainNormalized)
  if (domainEntry) return domainEntry.reason ?? 'suppressed'
  return null
}

async function writeAudit(
  prisma: PrismaClient,
  queueItemId: string,
  customerId: string,
  decision: OutboundSendAttemptDecision,
  reason: string | null,
  snapshot: { recipientEmail: string | null }
) {
  await prisma.outboundSendAttemptAudit.create({
    data: {
      customerId,
      queueItemId,
      decision,
      reason,
      snapshot,
    },
  })
}

export async function runSendWorkerDryRunBatch(
  prisma: PrismaClient,
  opts?: { limit?: number; customerId?: string | null }
): Promise<{ processedCount: number; auditsCreated: number }> {
  const now = new Date()
  const limit = Math.max(1, Math.min(200, opts?.limit ?? DRY_RUN_BATCH_SIZE_DEFAULT))
  const customerIdFilter = opts?.customerId?.trim() || null

  const items = await prisma.outboundSendQueueItem.findMany({
    where: {
      status: OutboundSendQueueStatus.QUEUED,
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
      ...(customerIdFilter ? { customerId: customerIdFilter } : {}),
    },
    orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'asc' }],
    take: limit,
    select: {
      id: true,
      customerId: true,
      recipientEmail: true,
      attemptCount: true,
    },
  })

  let auditsCreated = 0

  for (const item of items) {
    const customerId = item.customerId
    const recipientEmail = (item.recipientEmail ?? '').trim()
    const recipientEmailNormalized = recipientEmail.toLowerCase()

    if (!customerId) {
      await writeAudit(prisma, item.id, customerId, OutboundSendAttemptDecision.ERROR, 'missing_customer_id', { recipientEmail })
      await prisma.outboundSendQueueItem.update({
        where: { id: item.id },
        data: { status: OutboundSendQueueStatus.FAILED, lastError: 'missing_customer_id', attemptCount: item.attemptCount + 1 },
      })
      auditsCreated += 1
      continue
    }

    if (!recipientEmail) {
      await writeAudit(prisma, item.id, customerId, OutboundSendAttemptDecision.SKIP_INVALID, 'missing_recipient_email', {
        recipientEmail: item.recipientEmail ?? null,
      })
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
      await writeAudit(prisma, item.id, customerId, OutboundSendAttemptDecision.SKIP_NO_IDENTITY, 'no_active_identity', { recipientEmail })
      await prisma.outboundSendQueueItem.update({
        where: { id: item.id },
        data: { status: OutboundSendQueueStatus.SKIPPED, lastError: 'no_active_identity', attemptCount: item.attemptCount + 1 },
      })
      auditsCreated += 1
      continue
    }

    const suppressionReason = getSuppressionReason(suppressionEntries, recipientEmailNormalized)
    if (suppressionReason) {
      await writeAudit(prisma, item.id, customerId, OutboundSendAttemptDecision.SKIP_SUPPRESSED, suppressionReason, { recipientEmail })
      await prisma.outboundSendQueueItem.update({
        where: { id: item.id },
        data: { status: OutboundSendQueueStatus.SKIPPED, lastError: suppressionReason, attemptCount: item.attemptCount + 1 },
      })
      auditsCreated += 1
      continue
    }

    await writeAudit(prisma, item.id, customerId, OutboundSendAttemptDecision.WOULD_SEND, null, { recipientEmail })
    await prisma.outboundSendQueueItem.update({
      where: { id: item.id },
      data: { attemptCount: item.attemptCount + 1, lastError: null },
    })
    auditsCreated += 1
  }

  return {
    processedCount: items.length,
    auditsCreated,
  }
}
