/**
 * Stage 2B: Send-queue worker with optional live sending.
 * - Locks QUEUED OutboundSendQueueItems with a lease (no double-processing).
 * - Enforces kill-switch (ENABLE_LIVE_SENDING default false) and canary gating.
 * - When ENABLE_LIVE_SENDING and canary vars are set, sends via Outlook (Graph).
 * - Writes append-only EnrollmentAuditEvent entries for every decision/send.
 */
import cron from 'node-cron'
import os from 'node:os'
import { PrismaClient } from '@prisma/client'
import { OutboundSendQueueStatus } from '@prisma/client'
import { sendEmail } from '../services/outlookEmailService.js'
import { applyTemplatePlaceholders } from '../services/templateRenderer.js'
import { requeueDryRun, DRY_RUN_DEFAULT_REASON } from '../utils/sendQueue.js'

const WORKER_ID = `sq-${os.hostname()}-${process.pid}`
const LEASE_MS = Number(process.env.SEND_QUEUE_LEASE_MS) || 5 * 60 * 1000 // 5 min
const BATCH_SIZE = Math.min(Math.max(1, Number(process.env.SEND_QUEUE_BATCH_SIZE) || 10), 50)

const ENABLE_LIVE_SENDING = process.env.ENABLE_LIVE_SENDING === 'true'
// Stage 1B/1D: explicit sending gate; default false = dry-run (non-destructive: leave QUEUED, no FAILED)
const ENABLE_SEND_QUEUE_SENDING = process.env.ENABLE_SEND_QUEUE_SENDING === 'true'
const SEND_CANARY_CUSTOMER_ID = process.env.SEND_CANARY_CUSTOMER_ID?.trim() || null
const SEND_CANARY_IDENTITY_ID = process.env.SEND_CANARY_IDENTITY_ID?.trim() || null

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

function inSendWindow(identity: { sendWindowTimeZone?: string | null; sendWindowHoursStart?: number; sendWindowHoursEnd?: number }): boolean {
  const timeZone = identity.sendWindowTimeZone || 'Europe/London'
  const now = new Date()
  const dtf = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hour12: false })
  const hourStr = dtf.format(now)
  const currentHour = parseInt(hourStr, 10)
  const start = identity.sendWindowHoursStart ?? 9
  const end = identity.sendWindowHoursEnd ?? 17
  return currentHour >= start && currentHour < end
}

export function startSendQueueWorker(prisma: PrismaClient) {
  if (process.env.ENABLE_SEND_QUEUE_WORKER !== 'true') {
    return
  }

  cron.schedule('* * * * *', async () => {
    const now = new Date()
    const leaseExpiry = new Date(now.getTime() - LEASE_MS)
    try {
      await tick(prisma, now, leaseExpiry)
    } catch (err) {
      console.error(`[sendQueueWorker] ${WORKER_ID} tick error:`, err)
    }
  })

  console.log(`✅ [sendQueueWorker] ${WORKER_ID} started (ENABLE_SEND_QUEUE_SENDING=${ENABLE_SEND_QUEUE_SENDING}, ENABLE_LIVE_SENDING=${ENABLE_LIVE_SENDING})`)
}

async function tick(prisma: PrismaClient, now: Date, leaseExpiry: Date) {
  const candidates = await prisma.outboundSendQueueItem.findMany({
    where: {
      status: OutboundSendQueueStatus.QUEUED,
      AND: [
        {
          OR: [
            { scheduledFor: null },
            { scheduledFor: { lte: now } },
          ],
        },
        {
          OR: [
            { lockedAt: null },
            { lockedAt: { lt: leaseExpiry } },
          ],
        },
      ],
    },
    orderBy: { scheduledFor: 'asc' },
    take: BATCH_SIZE,
  })

  if (candidates.length === 0) return

  const lockedIds: string[] = []
  for (const item of candidates) {
    const updated = await prisma.outboundSendQueueItem.updateMany({
      where: { id: item.id, status: OutboundSendQueueStatus.QUEUED },
      data: {
        status: OutboundSendQueueStatus.LOCKED,
        lockedAt: now,
        lockedBy: WORKER_ID,
        attemptCount: item.attemptCount + 1,
      },
    })
    if (updated.count > 0) lockedIds.push(item.id)
  }

  const locked = await prisma.outboundSendQueueItem.findMany({
    where: { id: { in: lockedIds } },
    orderBy: { createdAt: 'asc' },
  })

  for (const item of locked) {
    try {
      await processOne(prisma, item, now)
    } catch (err) {
      console.error(`[sendQueueWorker] ${WORKER_ID} item=${item.id} enrollment=${item.enrollmentId} recipient=${item.recipientEmail} step=${item.stepIndex}:`, err)
      await unlockItem(prisma, item.id, OutboundSendQueueStatus.FAILED, (err as Error)?.message?.slice(0, 500) ?? 'unknown error')
    }
  }
}

async function unlockItem(
  prisma: PrismaClient,
  id: string,
  status: OutboundSendQueueStatus,
  lastError?: string | null
) {
  await prisma.outboundSendQueueItem.update({
    where: { id },
    data: {
      status,
      lockedAt: null,
      lockedBy: null,
      ...(lastError != null && { lastError }),
    },
  })
}

async function processOne(prisma: PrismaClient, item: { id: string; customerId: string; enrollmentId: string; recipientEmail: string; stepIndex: number }, now: Date) {
  const { customerId, enrollmentId, recipientEmail, stepIndex } = item

  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, customerId },
    include: {
      recipients: { where: { email: recipientEmail } },
      sequence: {
        select: {
          senderIdentityId: true,
          senderIdentity: {
            select: {
              id: true,
              sendWindowTimeZone: true,
              sendWindowHoursStart: true,
              sendWindowHoursEnd: true,
            },
          },
        },
      },
    },
  })

  if (!enrollment) {
    await prisma.enrollmentAuditEvent.create({
      data: {
        customerId,
        enrollmentId,
        recipientEmail,
        eventType: 'send_skipped',
        message: 'validation_failed',
        meta: { reason: 'enrollment_not_found', stepIndex },
      },
    })
    await unlockItem(prisma, item.id, OutboundSendQueueStatus.FAILED, 'enrollment_not_found')
    return
  }

  if (enrollment.recipients.length === 0) {
    await prisma.enrollmentAuditEvent.create({
      data: {
        customerId,
        enrollmentId,
        recipientEmail,
        eventType: 'send_skipped',
        message: 'validation_failed',
        meta: { reason: 'recipient_not_on_enrollment', stepIndex },
      },
    })
    await unlockItem(prisma, item.id, OutboundSendQueueStatus.FAILED, 'recipient_not_on_enrollment')
    return
  }

  // Stage 1D: sending disabled = non-destructive dry-run: requeue (QUEUED), do NOT mark FAILED
  if (!ENABLE_SEND_QUEUE_SENDING) {
    await requeueDryRun(prisma, item.id, DRY_RUN_DEFAULT_REASON)
    console.log(`[sendQueueWorker] ${WORKER_ID} dry-run (sending disabled) item=${item.id} enrollment=${item.enrollmentId}`)
    return
  }

  if (!ENABLE_LIVE_SENDING) {
    await prisma.enrollmentAuditEvent.create({
      data: {
        customerId,
        enrollmentId,
        recipientEmail,
        eventType: 'send_skipped',
        message: 'SKIPPED_KILL_SWITCH',
        meta: { reason: 'kill_switch', stepIndex },
      },
    })
    await unlockItem(prisma, item.id, OutboundSendQueueStatus.QUEUED, null)
    return
  }

  if (ENABLE_LIVE_SENDING && (SEND_CANARY_CUSTOMER_ID == null || SEND_CANARY_IDENTITY_ID == null)) {
    await prisma.enrollmentAuditEvent.create({
      data: {
        customerId,
        enrollmentId,
        recipientEmail,
        eventType: 'send_skipped',
        message: 'SEND_BLOCKED_CANARY_MISCONFIG',
        meta: { reason: 'canary_required_when_live_sending', stepIndex },
      },
    })
    await unlockItem(prisma, item.id, OutboundSendQueueStatus.QUEUED, 'canary_required')
    return
  }

  if (ENABLE_LIVE_SENDING && SEND_CANARY_CUSTOMER_ID != null && SEND_CANARY_IDENTITY_ID != null) {
    if (customerId !== SEND_CANARY_CUSTOMER_ID) {
      await prisma.enrollmentAuditEvent.create({
        data: {
          customerId,
          enrollmentId,
          recipientEmail,
          eventType: 'send_skipped',
          message: 'canary_blocked',
          meta: { reason: 'customer_not_in_canary', stepIndex },
        },
      })
      await unlockItem(prisma, item.id, OutboundSendQueueStatus.QUEUED, 'canary_blocked')
      return
    }
    const identityId = enrollment.sequence?.senderIdentityId ?? null
    if (identityId !== SEND_CANARY_IDENTITY_ID) {
      await prisma.enrollmentAuditEvent.create({
        data: {
          customerId,
          enrollmentId,
          recipientEmail,
          eventType: 'send_skipped',
          message: 'canary_blocked',
          meta: { reason: 'identity_not_in_canary', stepIndex },
        },
      })
      await unlockItem(prisma, item.id, OutboundSendQueueStatus.QUEUED, 'canary_blocked')
      return
    }
  }

  const suppressionEntries = await prisma.suppressionEntry.findMany({
    where: { customerId },
    select: { type: true, value: true, emailNormalized: true, reason: true },
  })
  const suppressionReason = getSuppressionReason(suppressionEntries, recipientEmail)
  if (suppressionReason) {
    await prisma.enrollmentAuditEvent.create({
      data: {
        customerId,
        enrollmentId,
        recipientEmail,
        eventType: 'send_skipped',
        message: 'suppression',
        meta: { reason: 'suppressed', stepIndex },
      },
    })
    await unlockItem(prisma, item.id, OutboundSendQueueStatus.SKIPPED, 'suppressed')
    return
  }

  const identity = enrollment.sequence?.senderIdentity ?? null
  if (!identity) {
    await prisma.enrollmentAuditEvent.create({
      data: {
        customerId,
        enrollmentId,
        recipientEmail,
        eventType: 'send_skipped',
        message: 'validation_failed',
        meta: { reason: 'no_sender_identity', stepIndex },
      },
    })
    await unlockItem(prisma, item.id, OutboundSendQueueStatus.FAILED, 'no_sender_identity')
    return
  }
  if (!inSendWindow(identity)) {
    await prisma.enrollmentAuditEvent.create({
      data: {
        customerId,
        enrollmentId,
        recipientEmail,
        eventType: 'send_skipped',
        message: 'outside_window',
        meta: { reason: 'outside_send_window', stepIndex },
      },
    })
    await unlockItem(prisma, item.id, OutboundSendQueueStatus.QUEUED, 'outside_window')
    return
  }

  // Load sequence step (stepOrder is 1-based; queue stepIndex 0 = first step)
  const step = await prisma.emailSequenceStep.findFirst({
    where: { sequenceId: enrollment.sequenceId, stepOrder: stepIndex + 1 },
  })
  let subject: string
  let htmlBody: string
  let textBody: string | undefined
  if (step?.subjectTemplate != null && step?.bodyTemplateHtml != null) {
    const recipientRow = await prisma.enrollmentRecipient.findFirst({
      where: { enrollmentId, email: recipientEmail },
      select: { firstName: true, lastName: true, company: true, email: true },
    })
    const vars = {
      firstName: recipientRow?.firstName ?? '',
      lastName: recipientRow?.lastName ?? '',
      companyName: recipientRow?.company ?? '',
      company: recipientRow?.company ?? '',
      email: recipientEmail,
      jobTitle: '',
      title: '',
      phone: '',
    }
    subject = applyTemplatePlaceholders(step.subjectTemplate, vars)
    htmlBody = applyTemplatePlaceholders(step.bodyTemplateHtml, vars)
    textBody = step.bodyTemplateText ? applyTemplatePlaceholders(step.bodyTemplateText, vars) : undefined
  } else {
    subject = `[Canary] Stage 2B test — ${enrollmentId} step ${stepIndex}`
    htmlBody = `<p>Canary test email. Enrollment: ${enrollmentId}, step: ${stepIndex}, recipient: ${recipientEmail}.</p>`
  }

  await prisma.enrollmentAuditEvent.create({
    data: {
      customerId,
      enrollmentId,
      recipientEmail,
      eventType: 'send_attempted',
      message: 'send_started',
      meta: { stepIndex, identityId: identity.id },
    },
  })

  const result = await sendEmail(prisma, {
    senderIdentityId: identity.id,
    toEmail: recipientEmail,
    subject,
    htmlBody,
    textBody,
  })

  if (result.success) {
    await prisma.outboundSendQueueItem.update({
      where: { id: item.id },
      data: {
        status: OutboundSendQueueStatus.SENT,
        sentAt: now,
        lockedAt: null,
        lockedBy: null,
      },
    })
    await prisma.enrollmentAuditEvent.create({
      data: {
        customerId,
        enrollmentId,
        recipientEmail,
        eventType: 'send_succeeded',
        message: 'send_succeeded',
        meta: { stepIndex, identityId: identity.id, messageId: result.messageId ?? undefined },
      },
    })
    return
  }

  const errMsg = (result.error ?? 'Unknown error').slice(0, 500)
  await prisma.enrollmentAuditEvent.create({
    data: {
      customerId,
      enrollmentId,
      recipientEmail,
      eventType: 'send_failed',
      message: 'send_failed',
      meta: { stepIndex, identityId: identity.id, error: errMsg },
    },
  })
  await unlockItem(prisma, item.id, OutboundSendQueueStatus.FAILED, errMsg)
}
