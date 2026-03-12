/**
 * Stage 2B: Send-queue worker with optional live sending.
 * - Locks QUEUED OutboundSendQueueItems with a lease (no double-processing).
 * - Enforces kill-switch (ENABLE_LIVE_SENDING default false) and canary gating.
 * - When ENABLE_LIVE_SENDING and canary vars are set, sends via Outlook (Graph).
 * - Writes append-only EnrollmentAuditEvent entries for every decision/send.
 */
import cron from 'node-cron'
import os from 'node:os'
import { OutboundSendAttemptDecision, OutboundSendQueueStatus, PrismaClient } from '@prisma/client'
import { sendEmail } from '../services/outlookEmailService.js'
import { applyTemplatePlaceholders, enforceUnsubscribeFooter } from '../services/templateRenderer.js'
import { requeueDryRun, requeueAfterSendFailure, DRY_RUN_DEFAULT_REASON, LIVE_SEND_CAP } from '../utils/sendQueue.js'
import { runSendWorkerDryRunBatch } from '../utils/sendWorkerDryRun.js'
import { assertLiveSendAllowed } from '../utils/liveSendGate.js'
import { clampDailySendLimit } from '../utils/emailIdentityLimits.js'

const WORKER_ID = `sq-${os.hostname()}-${process.pid}`
const LEASE_MS = Number(process.env.SEND_QUEUE_LEASE_MS) || 5 * 60 * 1000 // 5 min
const BATCH_SIZE = Math.min(Math.max(1, Number(process.env.SEND_QUEUE_BATCH_SIZE) || 10), 50)
const SCHEDULED_SENDING_CRON = process.env.SCHEDULED_SENDING_CRON || '*/2 * * * *'

const ENABLE_LIVE_SENDING = process.env.ENABLE_LIVE_SENDING === 'true'
// Stage 1B/1D: explicit sending gate; default false = dry-run (non-destructive: leave QUEUED, no FAILED)
const ENABLE_SEND_QUEUE_SENDING = process.env.ENABLE_SEND_QUEUE_SENDING === 'true'
const SEND_CANARY_CUSTOMER_ID = process.env.SEND_CANARY_CUSTOMER_ID?.trim() || null
const SEND_CANARY_IDENTITY_ID = process.env.SEND_CANARY_IDENTITY_ID?.trim() || null
const SEND_QUEUE_PER_MINUTE_CAP = Number(process.env.SEND_QUEUE_PER_MINUTE_CAP) || 0
const HARD_BOUNCE_REASON = 'hard_bounce_invalid_recipient'
const ENABLE_SCHEDULED_SENDING_LIVE = process.env.ENABLE_SCHEDULED_SENDING_LIVE === 'true'

type ScheduledEngineMode = 'OFF' | 'DRY_RUN' | 'LIVE_CANARY'

function resolveScheduledEngineMode(): {
  mode: ScheduledEngineMode
  liveAllowed: boolean
  reason?: string
  customerId: string | null
} {
  const customerId = SEND_CANARY_CUSTOMER_ID
  const scheduledEnabled = process.env.ENABLE_SCHEDULED_SENDING_ENGINE === 'true'
  if (!scheduledEnabled) return { mode: 'OFF', liveAllowed: false, reason: 'scheduled_engine_disabled', customerId }
  if (!ENABLE_SCHEDULED_SENDING_LIVE) {
    return { mode: 'DRY_RUN', liveAllowed: false, reason: 'scheduled_live_not_enabled', customerId }
  }
  if (!customerId) {
    return { mode: 'DRY_RUN', liveAllowed: false, reason: 'canary_customer_missing', customerId }
  }
  const gate = assertLiveSendAllowed({ customerId, trigger: 'worker' })
  if (!gate.allowed) {
    return { mode: 'DRY_RUN', liveAllowed: false, reason: gate.reason ?? 'live_gate_blocked', customerId }
  }
  return { mode: 'LIVE_CANARY', liveAllowed: true, customerId }
}

function isHardInvalidRecipientFailure(errorMessage: string): boolean {
  const e = String(errorMessage || '').trim().toLowerCase()
  if (!e) return false
  const patterns = [
    'errorinvalidrecipients',
    'recipientnotfound',
    'recipient not found',
    'invalid recipient',
    'mailbox not found',
    'does not have a mailbox',
    'invalid smtp address',
    'address rejected',
    '550 5.1.1',
  ]
  return patterns.some((p) => e.includes(p))
}

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

function getTrackingBaseUrl(): string {
  const raw =
    process.env.EMAIL_TRACKING_DOMAIN ||
    process.env.FRONTDOOR_URL ||
    process.env.FRONTEND_URL ||
    'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net'
  const trimmed = String(raw).trim()
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed.replace(/\/$/, '')
  return `https://${trimmed.replace(/\/$/, '')}`
}

function buildEnrollmentUnsubscribeUrl(enrollmentId: string, recipientEmailNorm: string): string {
  const base = getTrackingBaseUrl()
  return `${base}/api/email/unsubscribe?enrollmentId=${encodeURIComponent(enrollmentId)}&email=${encodeURIComponent(recipientEmailNorm)}`
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
  const scheduledEngineEnabled = process.env.ENABLE_SCHEDULED_SENDING_ENGINE === 'true'
  const legacyWorkerEnabled = process.env.ENABLE_SEND_QUEUE_WORKER === 'true'
  const scheduledResolution = resolveScheduledEngineMode()
  if (!scheduledEngineEnabled && !legacyWorkerEnabled) {
    return
  }

  console.log(
    `[sendQueueWorker] config: scheduledEngine=${scheduledEngineEnabled} legacyWorker=${legacyWorkerEnabled} mode=${scheduledResolution.mode} scheduledLiveAllowed=${scheduledResolution.liveAllowed} cron=${SCHEDULED_SENDING_CRON} canaryCustomerId=${scheduledResolution.customerId ?? 'unset'} liveSendEnv=${ENABLE_LIVE_SENDING} queueSendEnv=${ENABLE_SEND_QUEUE_SENDING} reason=${scheduledResolution.reason ?? 'ready'}`
  )

  cron.schedule(SCHEDULED_SENDING_CRON, async () => {
    const now = new Date()
    const leaseExpiry = new Date(now.getTime() - LEASE_MS)
    try {
      if (scheduledEngineEnabled) {
        const resolution = resolveScheduledEngineMode()
        if (resolution.mode === 'LIVE_CANARY') {
          await runScheduledLiveCanaryTick(prisma, now, leaseExpiry, resolution.customerId)
        } else {
          await runScheduledDryRunTick(prisma, resolution.customerId, resolution.reason)
        }
      } else if (legacyWorkerEnabled) {
        await tick(prisma, now, leaseExpiry)
      }
    } catch (err) {
      console.error(`[sendQueueWorker] ${WORKER_ID} tick error:`, err)
    }
  })

  console.log(
    `✅ [sendQueueWorker] ${WORKER_ID} started (scheduledEngine=${scheduledEngineEnabled}, legacyWorker=${legacyWorkerEnabled}, mode=${scheduledResolution.mode}, cron=${SCHEDULED_SENDING_CRON}, ENABLE_SEND_QUEUE_SENDING=${ENABLE_SEND_QUEUE_SENDING}, ENABLE_LIVE_SENDING=${ENABLE_LIVE_SENDING})`
  )
}

async function runScheduledDryRunTick(prisma: PrismaClient, canaryCustomerId: string | null, reason?: string) {
  if (!canaryCustomerId) {
    console.log(
      `[sendQueueWorker] ${WORKER_ID} scheduled tick skipped mode=DRY_RUN reason=${reason ?? 'canary_customer_missing'}`
    )
    return
  }
  const startedAt = Date.now()
  console.log(
    `[sendQueueWorker] ${WORKER_ID} scheduled tick start mode=DRY_RUN customerId=${canaryCustomerId} reason=${reason ?? 'dry_run'}`
  )
  const result = await runSendWorkerDryRunBatch(prisma, {
    customerId: canaryCustomerId,
    limit: BATCH_SIZE,
  })
  const elapsedMs = Date.now() - startedAt
  console.log(
    `[sendQueueWorker] ${WORKER_ID} scheduled tick end mode=DRY_RUN customerId=${canaryCustomerId} processed=${result.processedCount} audits=${result.auditsCreated} elapsedMs=${elapsedMs}`
  )
}

async function runScheduledLiveCanaryTick(
  prisma: PrismaClient,
  now: Date,
  leaseExpiry: Date,
  canaryCustomerId: string | null
) {
  if (!canaryCustomerId) {
    console.log(`[sendQueueWorker] ${WORKER_ID} scheduled tick skipped mode=LIVE_CANARY reason=canary_customer_missing`)
    return
  }
  const startedAt = Date.now()
  console.log(`[sendQueueWorker] ${WORKER_ID} scheduled tick start mode=LIVE_CANARY customerId=${canaryCustomerId}`)
  await tick(prisma, now, leaseExpiry, { customerId: canaryCustomerId })
  const elapsedMs = Date.now() - startedAt
  console.log(
    `[sendQueueWorker] ${WORKER_ID} scheduled tick end mode=LIVE_CANARY customerId=${canaryCustomerId} elapsedMs=${elapsedMs}`
  )
}

async function tick(prisma: PrismaClient, now: Date, leaseExpiry: Date, opts?: { customerId?: string }) {
  const candidates = await prisma.outboundSendQueueItem.findMany({
    where: {
      status: OutboundSendQueueStatus.QUEUED,
      ...(opts?.customerId ? { customerId: opts.customerId } : {}),
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
        attemptCount: { increment: 1 },
      },
    })
    if (updated.count > 0) lockedIds.push(item.id)
  }

  const locked = await prisma.outboundSendQueueItem.findMany({
    where: { id: { in: lockedIds } },
    orderBy: { createdAt: 'asc' },
  })

  // Stage 1F: only send stepIndex 0; cap live sends per iteration
  const step0 = locked.filter((i) => i.stepIndex === 0)
  const toSend = step0.slice(0, LIVE_SEND_CAP)
  const toRequeue = [
    ...locked.filter((i) => i.stepIndex !== 0),
    ...step0.slice(LIVE_SEND_CAP),
  ]
  for (const item of toRequeue) {
    try {
      await requeueDryRun(
        prisma,
        item.id,
        item.stepIndex !== 0 ? 'Step 0 only (Stage 1F)' : DRY_RUN_DEFAULT_REASON
      )
    } catch (err) {
      console.error(`[sendQueueWorker] ${WORKER_ID} requeue item=${item.id}:`, err)
      await requeueAfterSendFailure(prisma, item.id, (err as Error)?.message ?? 'unknown error')
    }
  }
  for (const item of toSend) {
    try {
      await processOne(prisma, item, now)
    } catch (err) {
      console.error(`[sendQueueWorker] ${WORKER_ID} item=${item.id} enrollment=${item.enrollmentId} recipient=${item.recipientEmail} step=${item.stepIndex}:`, err)
      await requeueAfterSendFailure(prisma, item.id, (err as Error)?.message?.slice(0, 500) ?? 'unknown error')
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

async function propagateReplyStopToSiblingQueuedItems(
  prisma: PrismaClient,
  args: {
    customerId: string
    enrollmentId: string
    currentQueueItemId: string
    recipientEmailNorm: string
    identityEmailNorm: string
    identityId: string
    replyCount: number
    firstOutboundAt: Date
  }
): Promise<{ siblingQueuedCount: number; siblingAuditsCreated: number }> {
  const siblingItems = await prisma.outboundSendQueueItem.findMany({
    where: {
      customerId: args.customerId,
      enrollmentId: args.enrollmentId,
      status: OutboundSendQueueStatus.QUEUED,
      id: { not: args.currentQueueItemId },
      recipientEmail: { equals: args.recipientEmailNorm, mode: 'insensitive' },
    },
    select: { id: true, stepIndex: true, recipientEmail: true },
  })
  if (siblingItems.length === 0) return { siblingQueuedCount: 0, siblingAuditsCreated: 0 }

  const siblingIds = siblingItems.map((row) => row.id)
  await prisma.outboundSendQueueItem.updateMany({
    where: {
      id: { in: siblingIds },
      customerId: args.customerId,
      enrollmentId: args.enrollmentId,
      status: OutboundSendQueueStatus.QUEUED,
    },
    data: {
      status: OutboundSendQueueStatus.SKIPPED,
      lockedAt: null,
      lockedBy: null,
      lastError: 'replied_stop',
    },
  })

  let siblingAuditsCreated = 0
  for (const sibling of siblingItems) {
    await prisma.outboundSendAttemptAudit.create({
      data: {
        customerId: args.customerId,
        queueItemId: sibling.id,
        decision: OutboundSendAttemptDecision.SKIP_INVALID,
        reason: 'SKIP_REPLIED_STOP',
        snapshot: {
          enrollmentId: args.enrollmentId,
          recipientEmailNorm: args.recipientEmailNorm,
          identityEmailNorm: args.identityEmailNorm,
          stepIndex: sibling.stepIndex,
          identityId: args.identityId,
          replyCount: args.replyCount,
          firstOutboundAt: args.firstOutboundAt.toISOString(),
          propagatedFromQueueItemId: args.currentQueueItemId,
          propagated: true,
        },
      },
    })
    siblingAuditsCreated += 1
  }

  return { siblingQueuedCount: siblingItems.length, siblingAuditsCreated }
}

/** Options for processOne (Stage 1G: ignoreWindow only from tick when env gate set). */
export type ProcessOneOptions = { ignoreWindow?: boolean }
export type ProcessOneResult = 'sent' | 'requeued' | 'skipped' | 'failed_terminal'

/** Stage 1F: only step 0 is sent; exported for tick route live path. */
export async function processOne(
  prisma: PrismaClient,
  item: { id: string; customerId: string; enrollmentId: string; recipientEmail: string; stepIndex: number },
  now: Date,
  options?: ProcessOneOptions
): Promise<ProcessOneResult> {
  const { customerId, enrollmentId, recipientEmail, stepIndex } = item

  if (stepIndex !== 0) {
    await requeueDryRun(prisma, item.id, 'Step 0 only (Stage 1F)')
    return 'requeued'
  }

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
              emailAddress: true,
              displayName: true,
              signatureHtml: true,
              sendWindowTimeZone: true,
              sendWindowHoursStart: true,
              sendWindowHoursEnd: true,
              dailySendLimit: true,
            },
          },
        },
      },
      customer: {
        select: {
          name: true,
          website: true,
          domain: true,
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
    return 'failed_terminal'
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
    return 'failed_terminal'
  }

  // Stage 1D: sending disabled = non-destructive dry-run: requeue (QUEUED), do NOT mark FAILED
  if (!ENABLE_SEND_QUEUE_SENDING) {
    await requeueDryRun(prisma, item.id, DRY_RUN_DEFAULT_REASON)
    console.log(`[sendQueueWorker] ${WORKER_ID} dry-run (sending disabled) item=${item.id} enrollment=${item.enrollmentId}`)
    return 'requeued'
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
    return 'requeued'
  }

  // Stage 1F: canary — SEND_CANARY_CUSTOMER_ID required; SEND_CANARY_IDENTITY_ID optional (if set, must match)
  if (ENABLE_LIVE_SENDING && SEND_CANARY_CUSTOMER_ID == null) {
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
    return 'requeued'
  }

  if (ENABLE_LIVE_SENDING && SEND_CANARY_CUSTOMER_ID != null && customerId !== SEND_CANARY_CUSTOMER_ID) {
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
    return 'requeued'
  }

  const identityId = enrollment.sequence?.senderIdentityId ?? null
  if (ENABLE_LIVE_SENDING && SEND_CANARY_IDENTITY_ID != null && identityId !== SEND_CANARY_IDENTITY_ID) {
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
    return 'requeued'
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
    return 'skipped'
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
    await requeueAfterSendFailure(prisma, item.id, 'no_sender_identity')
    return 'requeued'
  }
  const recipientEmailNorm = String(recipientEmail || '').trim().toLowerCase()
  const identityEmailNorm = String(identity.emailAddress || '').trim().toLowerCase()

  const firstOutbound = await prisma.emailMessageMetadata.findFirst({
    where: {
      senderIdentityId: identity.id,
      direction: 'outbound',
      toAddress: { equals: recipientEmailNorm, mode: 'insensitive' },
    },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  })
  if (firstOutbound) {
    const replyCount = await prisma.emailMessageMetadata.count({
      where: {
        senderIdentityId: identity.id,
        direction: 'inbound',
        fromAddress: { equals: recipientEmailNorm, mode: 'insensitive' },
        toAddress: { equals: identityEmailNorm, mode: 'insensitive' },
        createdAt: { gte: firstOutbound.createdAt },
      },
    })
    if (replyCount > 0) {
      const propagation = await propagateReplyStopToSiblingQueuedItems(prisma, {
        customerId,
        enrollmentId,
        currentQueueItemId: item.id,
        recipientEmailNorm,
        identityEmailNorm,
        identityId: identity.id,
        replyCount,
        firstOutboundAt: firstOutbound.createdAt,
      })

      await prisma.enrollmentAuditEvent.create({
        data: {
          customerId,
          enrollmentId,
          recipientEmail,
          eventType: 'send_skipped',
          message: 'reply_stop',
          meta: {
            reason: 'SKIP_REPLIED_STOP',
            stepIndex,
            identityId: identity.id,
            replyCount,
            siblingQueuedStoppedCount: propagation.siblingQueuedCount,
            siblingAuditsCreated: propagation.siblingAuditsCreated,
          },
        },
      })
      await prisma.outboundSendAttemptAudit.create({
        data: {
          customerId,
          queueItemId: item.id,
          // Existing enum does not include SKIP_REPLIED_STOP; keep backward-compatible decision + explicit reason marker.
          decision: OutboundSendAttemptDecision.SKIP_INVALID,
          reason: 'SKIP_REPLIED_STOP',
          snapshot: {
            enrollmentId,
            recipientEmailNorm,
            identityEmailNorm,
            stepIndex,
            identityId: identity.id,
            replyCount,
            siblingQueuedStoppedCount: propagation.siblingQueuedCount,
            firstOutboundAt: firstOutbound.createdAt.toISOString(),
          },
        },
      })
      await unlockItem(prisma, item.id, OutboundSendQueueStatus.SKIPPED, 'replied_stop')
      return 'skipped'
    }
  }
  // Stage 1G: ignoreWindow only when tick passes option (env ODCRM_ALLOW_LIVE_TICK_IGNORE_WINDOW); worker never sets it
  if (!options?.ignoreWindow && !inSendWindow(identity)) {
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
    return 'requeued'
  }
  if (options?.ignoreWindow) {
    await prisma.enrollmentAuditEvent.create({
      data: {
        customerId,
        enrollmentId,
        recipientEmail,
        eventType: 'send_window_bypass',
        message: 'SEND_WINDOW_BYPASS',
        meta: { stepIndex, identityId: identity.id },
      },
    })
  }

  // Respect mailbox throughput guardrails before attempting a live send.
  const dailyLimit = clampDailySendLimit((enrollment.sequence?.senderIdentity as any)?.dailySendLimit)
  const nowUtc = now
  if (dailyLimit > 0) {
    const startOfUtcDay = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate(), 0, 0, 0, 0))
    const sentToday = await prisma.emailMessageMetadata.count({
      where: {
        senderIdentityId: identity.id,
        direction: 'outbound',
        createdAt: { gte: startOfUtcDay },
      },
    })
    if (sentToday >= dailyLimit) {
      await prisma.enrollmentAuditEvent.create({
        data: {
          customerId,
          enrollmentId,
          recipientEmail,
          eventType: 'send_skipped',
          message: 'rate_limited',
          meta: { reason: 'daily_cap_reached', stepIndex, identityId: identity.id, sentToday, dailyLimit },
        },
      })
      await unlockItem(prisma, item.id, OutboundSendQueueStatus.QUEUED, 'daily_cap_reached')
      return 'requeued'
    }
  }
  if (SEND_QUEUE_PER_MINUTE_CAP > 0) {
    const oneMinuteAgo = new Date(nowUtc.getTime() - 60_000)
    const sentLastMinute = await prisma.emailMessageMetadata.count({
      where: {
        senderIdentityId: identity.id,
        direction: 'outbound',
        createdAt: { gte: oneMinuteAgo },
      },
    })
    if (sentLastMinute >= SEND_QUEUE_PER_MINUTE_CAP) {
      await prisma.enrollmentAuditEvent.create({
        data: {
          customerId,
          enrollmentId,
          recipientEmail,
          eventType: 'send_skipped',
          message: 'rate_limited',
          meta: {
            reason: 'per_minute_cap_reached',
            stepIndex,
            identityId: identity.id,
            sentLastMinute,
            perMinuteCap: SEND_QUEUE_PER_MINUTE_CAP,
          },
        },
      })
      await unlockItem(prisma, item.id, OutboundSendQueueStatus.QUEUED, 'per_minute_cap_reached')
      return 'requeued'
    }
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
    const unsubscribeUrl = buildEnrollmentUnsubscribeUrl(enrollmentId, recipientEmailNorm)
    const vars = {
      firstName: recipientRow?.firstName ?? '',
      lastName: recipientRow?.lastName ?? '',
      companyName: recipientRow?.company ?? '',
      company: recipientRow?.company ?? '',
      accountName: recipientRow?.company ?? enrollment.customer?.name ?? '',
      email: recipientEmail,
      role: '',
      jobTitle: '',
      title: '',
      phone: '',
      website: enrollment.customer?.website ?? enrollment.customer?.domain ?? '',
      senderName: enrollment.sequence?.senderIdentity?.displayName ?? enrollment.sequence?.senderIdentity?.emailAddress ?? '',
      senderEmail: enrollment.sequence?.senderIdentity?.emailAddress ?? '',
      unsubscribeLink: unsubscribeUrl,
      emailSignature: enrollment.sequence?.senderIdentity?.signatureHtml ?? '',
    }
    const textVars = { ...vars, emailSignature: '', senderSignature: '' }
    subject = applyTemplatePlaceholders(step.subjectTemplate, vars)
    htmlBody = applyTemplatePlaceholders(step.bodyTemplateHtml, vars)
    textBody = step.bodyTemplateText ? applyTemplatePlaceholders(step.bodyTemplateText, textVars) : undefined
    const enforced = enforceUnsubscribeFooter(htmlBody, textBody, unsubscribeUrl)
    htmlBody = enforced.htmlBody
    textBody = enforced.textBody
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
        lastError: null,
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
    return 'sent'
  }

  const errMsg = (result.error ?? 'Unknown error').slice(0, 500)
  const hardInvalidRecipient = isHardInvalidRecipientFailure(errMsg)
  if (hardInvalidRecipient) {
    const suppressionValue = recipientEmailNorm
    const suppressionReason = HARD_BOUNCE_REASON
    await prisma.suppressionEntry.upsert({
      where: {
        customerId_type_value: {
          customerId,
          type: 'email',
          value: suppressionValue,
        },
      },
      update: {
        reason: suppressionReason,
        source: 'send_worker',
        emailNormalized: suppressionValue,
      },
      create: {
        customerId,
        type: 'email',
        value: suppressionValue,
        emailNormalized: suppressionValue,
        reason: suppressionReason,
        source: 'send_worker',
      },
    })
    await prisma.enrollmentAuditEvent.create({
      data: {
        customerId,
        enrollmentId,
        recipientEmail: recipientEmailNorm,
        eventType: 'send_skipped',
        message: 'hard_bounce_invalid_recipient',
        meta: {
          reason: suppressionReason,
          stepIndex,
          identityId: identity.id,
          error: errMsg,
          suppressionApplied: true,
        },
      },
    })
    await prisma.outboundSendAttemptAudit.create({
      data: {
        customerId,
        queueItemId: item.id,
        decision: OutboundSendAttemptDecision.SEND_FAILED,
        reason: suppressionReason,
        snapshot: {
          enrollmentId,
          recipientEmailNorm,
          identityEmailNorm,
          stepIndex,
          identityId: identity.id,
          error: errMsg,
          suppressionApplied: true,
        },
      },
    })
    await unlockItem(prisma, item.id, OutboundSendQueueStatus.SKIPPED, suppressionReason)
    return 'skipped'
  }

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
  await requeueAfterSendFailure(prisma, item.id, errMsg)
  return 'requeued'
}
