/**
 * Stage 2A: Dry-run send worker — process queue items into audited decisions without sending.
 * Stage 2B-min: GET /api/send-worker/audits — read-only audit list (tenant-scoped).
 * Stage 4-min: POST /api/send-worker/live-tick — admin + canary gated real send of N items.
 */
import { Router, Request, Response } from 'express'
import { randomUUID } from 'node:crypto'
import { prisma } from '../lib/prisma.js'
import { validateAdminSecret } from './admin.js'
import { requireCustomerId } from '../utils/tenantId.js'
import { OutboundSendQueueStatus, OutboundSendAttemptDecision } from '@prisma/client'
import { assertLiveSendAllowed, getLiveSendCap } from '../utils/liveSendGate.js'
import { runSendWorkerDryRunBatch } from '../utils/sendWorkerDryRun.js'
import { sendEmail } from '../services/outlookEmailService.js'
import { applyTemplatePlaceholders } from '../services/templateRenderer.js'

const router = Router()
const AUDITS_LIMIT_DEFAULT = 50
const AUDITS_LIMIT_MAX = 200
const AUDITS_CSV_MAX = 2000
const SUMMARY_SINCE_HOURS_DEFAULT = 24
const SUMMARY_SINCE_HOURS_MAX = 168
const LIVE_TICK_LOCK_PREFIX = 'live_tick_'

const VALID_DECISIONS = new Set<string>(Object.values(OutboundSendAttemptDecision))

function buildAuditWhere(
  customerId: string,
  opts: { queueItemId?: string; decision?: OutboundSendAttemptDecision; sinceHours?: number }
): { customerId: string; queueItemId?: string; decision?: OutboundSendAttemptDecision; decidedAt?: { gte: Date } } {
  const where: { customerId: string; queueItemId?: string; decision?: OutboundSendAttemptDecision; decidedAt?: { gte: Date } } = { customerId }
  if (opts.queueItemId) where.queueItemId = opts.queueItemId
  if (opts.decision) where.decision = opts.decision
  if (opts.sinceHours != null && opts.sinceHours > 0) {
    const since = new Date(Date.now() - opts.sinceHours * 60 * 60 * 1000)
    where.decidedAt = { gte: since }
  }
  return where
}

function escapeCsvField(val: string | null | undefined): string {
  const s = val == null ? '' : String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

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

function parseSinceHours(raw: unknown): number {
  if (typeof raw !== 'string') return SUMMARY_SINCE_HOURS_DEFAULT
  const n = parseInt(raw, 10)
  if (Number.isNaN(n) || n < 1) return SUMMARY_SINCE_HOURS_DEFAULT
  return Math.min(n, SUMMARY_SINCE_HOURS_MAX)
}

function buildBlockedQueuedWhere(now: Date) {
  return {
    status: OutboundSendQueueStatus.QUEUED,
    AND: [
      { OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }] },
      {
        OR: [
          { lastError: { contains: 'outside_window', mode: 'insensitive' as const } },
          { lastError: { contains: 'canary', mode: 'insensitive' as const } },
          { lastError: { contains: 'daily_cap_reached', mode: 'insensitive' as const } },
          { lastError: { contains: 'per_minute_cap_reached', mode: 'insensitive' as const } },
          { lastError: { contains: 'no_sender_identity', mode: 'insensitive' as const } },
          { lastError: { contains: 'kill_switch', mode: 'insensitive' as const } },
          { lastError: { contains: 'live_send_disabled', mode: 'insensitive' as const } },
          { lastError: { contains: 'replied_stop', mode: 'insensitive' as const } },
          { lastError: { contains: 'suppressed', mode: 'insensitive' as const } },
        ],
      },
    ],
  }
}

async function getLiveGatesSnapshot(customerId: string, sinceHours: number) {
  const cap = getLiveSendCap()
  const queueGateEnabled = process.env.ENABLE_SEND_QUEUE_SENDING === 'true'
  const liveGateEnabled = process.env.ENABLE_LIVE_SENDING === 'true'
  const canaryCustomerId = process.env.SEND_CANARY_CUSTOMER_ID?.trim() || null
  const canaryIdentityId = process.env.SEND_CANARY_IDENTITY_ID?.trim() || null
  const allowLiveTick = process.env.ODCRM_ALLOW_LIVE_TICK === 'true'
  const allowLiveTickIgnoreWindow = process.env.ODCRM_ALLOW_LIVE_TICK_IGNORE_WINDOW === 'true'
  const scheduledEngineEnabled = process.env.ENABLE_SCHEDULED_SENDING_ENGINE === 'true'
  const scheduledLiveEnabled = process.env.ENABLE_SCHEDULED_SENDING_LIVE === 'true'
  const legacyWorkerEnabled = process.env.ENABLE_SEND_QUEUE_WORKER === 'true'
  const scheduledCron = process.env.SCHEDULED_SENDING_CRON || '*/2 * * * *'
  const sinceDate = new Date(Date.now() - sinceHours * 60 * 60 * 1000)

  const [activeIdentityCount, dueNowCount, auditByDecision, auditByReason, auditTotal] = await Promise.all([
    prisma.emailIdentity.count({
      where: { customerId, isActive: true },
    }),
    prisma.outboundSendQueueItem.count({
      where: {
        customerId,
        status: OutboundSendQueueStatus.QUEUED,
        OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }],
      },
    }),
    prisma.outboundSendAttemptAudit.groupBy({
      by: ['decision'],
      where: { customerId, decidedAt: { gte: sinceDate } },
      _count: { id: true },
    }),
    prisma.outboundSendAttemptAudit.groupBy({
      by: ['reason'],
      where: { customerId, decidedAt: { gte: sinceDate } },
      _count: { id: true },
    }),
    prisma.outboundSendAttemptAudit.count({
      where: { customerId, decidedAt: { gte: sinceDate } },
    }),
  ])

  const reasons: string[] = []
  if (!queueGateEnabled) reasons.push('ENABLE_SEND_QUEUE_SENDING is not true')
  if (!liveGateEnabled) reasons.push('ENABLE_LIVE_SENDING is not true')
  if (!canaryCustomerId) reasons.push('SEND_CANARY_CUSTOMER_ID is not configured')
  if (canaryCustomerId && canaryCustomerId !== customerId) reasons.push('tenant is not in canary (customer mismatch)')
  if (activeIdentityCount < 1) reasons.push('no active sender identity for tenant')
  if (canaryIdentityId) {
    const canaryIdentity = await prisma.emailIdentity.findFirst({
      where: { id: canaryIdentityId, customerId, isActive: true },
      select: { id: true },
    })
    if (!canaryIdentity) reasons.push('SEND_CANARY_IDENTITY_ID is not active for tenant')
  }
  const scheduledLiveGate = canaryCustomerId
    ? assertLiveSendAllowed({ customerId, trigger: 'worker' })
    : { allowed: false, reason: 'canary_customer_not_configured' }
  const scheduledMode =
    !scheduledEngineEnabled
      ? 'OFF'
      : scheduledLiveEnabled && scheduledLiveGate.allowed
        ? 'LIVE_CANARY'
        : 'DRY_RUN'

  const byDecision: Record<string, number> = {}
  for (const row of auditByDecision) {
    byDecision[row.decision] = row._count.id
  }
  const byReason: Record<string, number> = {}
  for (const row of auditByReason) {
    if (row.reason) byReason[row.reason] = row._count.id
  }

  return {
    enabled: reasons.length === 0,
    reasons,
    caps: {
      liveSendCap: cap,
      scheduledEngineCron: scheduledCron,
    },
    flags: {
      enableSendQueueSending: queueGateEnabled,
      enableLiveSending: liveGateEnabled,
      enableScheduledSendingEngine: scheduledEngineEnabled,
      enableScheduledSendingLive: scheduledLiveEnabled,
      enableSendQueueWorkerLegacy: legacyWorkerEnabled,
      odcrmAllowLiveTick: allowLiveTick,
      odcrmAllowLiveTickIgnoreWindow: allowLiveTickIgnoreWindow,
    },
    mode: {
      scheduledEngineMode: scheduledMode,
      scheduledLiveAllowed: scheduledMode === 'LIVE_CANARY',
      scheduledLiveReason: scheduledMode === 'LIVE_CANARY' ? null : scheduledLiveGate.reason ?? 'scheduled_live_not_enabled',
    },
    canary: {
      customerIdPresent: Boolean(canaryCustomerId),
      identityIdPresent: Boolean(canaryIdentityId),
      customerId: canaryCustomerId,
      identityId: canaryIdentityId,
    },
    canaryCustomerId,
    canaryIdentityId,
    currentCount: {
      queuedDueNow: dueNowCount,
      activeIdentities: activeIdentityCount,
    },
    recent: {
      windowHours: sinceHours,
      total: auditTotal,
      counts: {
        WOULD_SEND: byDecision.WOULD_SEND ?? 0,
        SENT: byDecision.SENT ?? 0,
        SEND_FAILED: byDecision.SEND_FAILED ?? 0,
        SKIP_SUPPRESSED: byDecision.SKIP_SUPPRESSED ?? 0,
        SKIP_REPLIED_STOP: byReason.SKIP_REPLIED_STOP ?? 0,
        hard_bounce_invalid_recipient: byReason.hard_bounce_invalid_recipient ?? 0,
      },
    },
  }
}

/**
 * POST /api/send-worker/dry-run — process one batch of QUEUED items; write audit per item; no real send.
 */
router.post('/dry-run', validateAdminSecret, async (req: Request, res: Response) => {
  try {
    const result = await runSendWorkerDryRunBatch(prisma)

    res.json({
      success: true,
      data: result,
    })
  } catch (err) {
    console.error('[send-worker/dry-run] error:', err)
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Dry-run failed' })
  }
})

/**
 * POST /api/send-worker/live-tick — Stage 4-min: real send of up to N QUEUED items (admin + canary gated).
 * Body: { limit?: number } (default 5, max getLiveSendCap()). Requires X-Customer-Id and X-Admin-Secret.
 */
router.post('/live-tick', validateAdminSecret, async (req: Request, res: Response) => {
  const customerId = requireCustomerId(req, res)
  if (!customerId) return

  try {
    const cap = getLiveSendCap()
    let limit = typeof req.body?.limit === 'number' ? Math.min(Math.max(1, req.body.limit), cap) : 5
    if (Number.isNaN(limit) || limit < 1) limit = 5
    limit = Math.min(limit, cap)

    const canaryIdentityId = process.env.SEND_CANARY_IDENTITY_ID?.trim()
    let identity: { id: string } | null = null
    if (canaryIdentityId) {
      const row = await prisma.emailIdentity.findFirst({
        where: { id: canaryIdentityId, customerId, isActive: true },
        select: { id: true },
      })
      if (!row) {
        res.status(400).json({ success: false, error: 'canary_identity_not_found_or_inactive' })
        return
      }
      identity = row
    } else {
      const row = await prisma.emailIdentity.findFirst({
        where: { customerId, isActive: true },
        orderBy: { id: 'asc' },
        select: { id: true },
      })
      if (!row) {
        res.status(400).json({ success: false, error: 'no_active_identity' })
        return
      }
      identity = row
    }

    const gate = assertLiveSendAllowed({ customerId, identityId: identity.id, trigger: 'manual' })
    if (!gate.allowed) {
      res.status(403).json({ success: false, error: gate.reason ?? 'live_send_not_allowed' })
      return
    }

    const items = await prisma.outboundSendQueueItem.findMany({
      where: {
        customerId,
        status: OutboundSendQueueStatus.QUEUED,
        OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }],
      },
      orderBy: [{ scheduledFor: 'asc' }, { id: 'asc' }],
      take: limit,
      select: {
        id: true,
        enrollmentId: true,
        stepIndex: true,
        recipientEmail: true,
      },
    })

    const lockId = `${LIVE_TICK_LOCK_PREFIX}${randomUUID()}`
    const lockAt = new Date()
    const lockedIds: string[] = []
    for (const item of items) {
      const updated = await prisma.outboundSendQueueItem.updateMany({
        where: {
          id: item.id,
          customerId,
          status: OutboundSendQueueStatus.QUEUED,
          OR: [{ scheduledFor: null }, { scheduledFor: { lte: lockAt } }],
        },
        data: {
          status: OutboundSendQueueStatus.LOCKED,
          lockedAt: lockAt,
          lockedBy: lockId,
          attemptCount: { increment: 1 },
        },
      })
      if (updated.count > 0) lockedIds.push(item.id)
    }

    const lockedItems = lockedIds.length
      ? await prisma.outboundSendQueueItem.findMany({
          where: { id: { in: lockedIds }, customerId, status: OutboundSendQueueStatus.LOCKED, lockedBy: lockId },
          orderBy: [{ scheduledFor: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            enrollmentId: true,
            stepIndex: true,
            recipientEmail: true,
          },
        })
      : []

    const suppressionEntries = await prisma.suppressionEntry.findMany({
      where: { customerId },
      select: { type: true, value: true, emailNormalized: true, reason: true },
    })

    let processed = 0
    let sent = 0
    let failed = 0
    let skipped = 0
    const reasons: Record<string, number> = {}

    const now = new Date()

    for (const item of lockedItems) {
      processed += 1
      const recipientEmail = (item.recipientEmail ?? '').trim()
      const recipientEmailNormalized = recipientEmail.toLowerCase()
      if (!recipientEmail) {
        await prisma.outboundSendQueueItem.update({
          where: { id: item.id },
          data: {
            status: OutboundSendQueueStatus.SKIPPED,
            lastError: 'missing_recipient_email',
            lockedAt: null,
            lockedBy: null,
          },
        })
        await prisma.outboundSendAttemptAudit.create({
          data: {
            customerId,
            queueItemId: item.id,
            decision: OutboundSendAttemptDecision.SKIP_INVALID,
            reason: 'missing_recipient_email',
            snapshot: { recipientEmail: item.recipientEmail ?? null },
          },
        })
        skipped += 1
        reasons['skip_invalid'] = (reasons['skip_invalid'] ?? 0) + 1
        continue
      }

      const suppressionReason = getSuppressionReason(suppressionEntries, recipientEmailNormalized)
      if (suppressionReason) {
        await prisma.outboundSendQueueItem.update({
          where: { id: item.id },
          data: {
            status: OutboundSendQueueStatus.SKIPPED,
            lastError: suppressionReason,
            lockedAt: null,
            lockedBy: null,
          },
        })
        await prisma.outboundSendAttemptAudit.create({
          data: {
            customerId,
            queueItemId: item.id,
            decision: OutboundSendAttemptDecision.SKIP_SUPPRESSED,
            reason: suppressionReason,
            snapshot: { recipientEmail },
          },
        })
        skipped += 1
        reasons['skip_suppressed'] = (reasons['skip_suppressed'] ?? 0) + 1
        continue
      }

      const enrollment = await prisma.enrollment.findFirst({
        where: { id: item.enrollmentId, customerId },
        select: { id: true, sequenceId: true },
      })
      if (!enrollment) {
        await prisma.outboundSendQueueItem.update({
          where: { id: item.id },
          data: {
            status: OutboundSendQueueStatus.FAILED,
            lastError: 'enrollment_not_found',
            lockedAt: null,
            lockedBy: null,
          },
        })
        await prisma.outboundSendAttemptAudit.create({
          data: {
            customerId,
            queueItemId: item.id,
            decision: OutboundSendAttemptDecision.SEND_FAILED,
            reason: 'enrollment_not_found',
            snapshot: { recipientEmail },
          },
        })
        failed += 1
        reasons['fail_enrollment'] = (reasons['fail_enrollment'] ?? 0) + 1
        continue
      }

      const step = await prisma.emailSequenceStep.findFirst({
        where: { sequenceId: enrollment.sequenceId, stepOrder: item.stepIndex + 1 },
        select: { subjectTemplate: true, bodyTemplateHtml: true, bodyTemplateText: true },
      })
      let subject: string
      let htmlBody: string
      let textBody: string | undefined
      if (step?.subjectTemplate != null && step?.bodyTemplateHtml != null) {
        const recipientRow = await prisma.enrollmentRecipient.findFirst({
          where: { enrollmentId: item.enrollmentId, email: recipientEmailNormalized },
          select: { firstName: true, lastName: true, company: true, email: true },
        })
        const vars = {
          firstName: recipientRow?.firstName ?? '',
          lastName: recipientRow?.lastName ?? '',
          company: recipientRow?.company ?? '',
          companyName: recipientRow?.company ?? '',
          email: recipientEmail,
          jobTitle: '',
          title: '',
          phone: '',
        }
        subject = applyTemplatePlaceholders(step.subjectTemplate, vars)
        htmlBody = applyTemplatePlaceholders(step.bodyTemplateHtml, vars)
        textBody = step.bodyTemplateText ? applyTemplatePlaceholders(step.bodyTemplateText, vars) : undefined
      } else {
        subject = `[ODCRM] Step ${item.stepIndex + 1}`
        htmlBody = `<p>Email from sequence. Recipient: ${recipientEmail}</p>`
      }

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
            lastError: null,
            lockedAt: null,
            lockedBy: null,
          },
        })
        await prisma.outboundSendAttemptAudit.create({
          data: {
            customerId,
            queueItemId: item.id,
            decision: OutboundSendAttemptDecision.SENT,
            reason: null,
            snapshot: { recipientEmail },
          },
        })
        sent += 1
      } else {
        const errMsg = result.error ?? 'send_failed'
        await prisma.outboundSendQueueItem.update({
          where: { id: item.id },
          data: {
            status: OutboundSendQueueStatus.FAILED,
            lastError: errMsg,
            lockedAt: null,
            lockedBy: null,
          },
        })
        await prisma.outboundSendAttemptAudit.create({
          data: {
            customerId,
            queueItemId: item.id,
            decision: OutboundSendAttemptDecision.SEND_FAILED,
            reason: errMsg,
            snapshot: { recipientEmail },
          },
        })
        failed += 1
        reasons['send_failed'] = (reasons['send_failed'] ?? 0) + 1
      }
    }

    res.json({
      success: true,
      data: {
        processed,
        sent,
        failed,
        skipped,
        reasons: Object.keys(reasons).length > 0 ? reasons : undefined,
      },
    })
  } catch (err) {
    console.error('[send-worker/live-tick] error:', err)
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Live-tick failed' })
  }
})

/**
 * GET /api/send-worker/live-gates — read-only tenant-scoped live-send gate status.
 * Requires X-Customer-Id. No mutations, no sending.
 */
router.get('/live-gates', async (req: Request, res: Response) => {
  const customerId = requireCustomerId(req, res)
  if (!customerId) return

  try {
    const sinceHours = parseSinceHours(req.query.sinceHours)
    const gateData = await getLiveGatesSnapshot(customerId, sinceHours)

    res.json({
      success: true,
      data: gateData,
    })
  } catch (err) {
    console.error('[send-worker/live-gates] error:', err)
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Live gates check failed' })
  }
})

/**
 * GET /api/send-worker/console — operator-focused queue health + outcomes summary.
 * Tenant-scoped, read-only.
 */
router.get('/console', async (req: Request, res: Response) => {
  const customerId = requireCustomerId(req, res)
  if (!customerId) return

  try {
    const sinceHours = parseSinceHours(req.query.sinceHours)
    const gateData = await getLiveGatesSnapshot(customerId, sinceHours)
    const manualLiveGate = assertLiveSendAllowed({ customerId, trigger: 'manual' })
    const now = new Date()
    const sinceDate = new Date(Date.now() - sinceHours * 60 * 60 * 1000)
    const blockedDueWhere = {
      customerId,
      ...buildBlockedQueuedWhere(now),
    }
    const blockedErrorClauses = [
      { lastError: { contains: 'outside_window', mode: 'insensitive' as const } },
      { lastError: { contains: 'canary', mode: 'insensitive' as const } },
      { lastError: { contains: 'daily_cap_reached', mode: 'insensitive' as const } },
      { lastError: { contains: 'per_minute_cap_reached', mode: 'insensitive' as const } },
      { lastError: { contains: 'no_sender_identity', mode: 'insensitive' as const } },
      { lastError: { contains: 'kill_switch', mode: 'insensitive' as const } },
      { lastError: { contains: 'live_send_disabled', mode: 'insensitive' as const } },
      { lastError: { contains: 'replied_stop', mode: 'insensitive' as const } },
      { lastError: { contains: 'suppressed', mode: 'insensitive' as const } },
    ]
    const readyDueWhere = {
      customerId,
      status: OutboundSendQueueStatus.QUEUED,
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
      NOT: { OR: blockedErrorClauses },
    }

    const [totalQueued, scheduledLater, blocked, readyNow, suppressed, replyStopped, failedRecently, sentRecently, readyNowRows, failedRows, blockedRows] = await Promise.all([
      prisma.outboundSendQueueItem.count({
        where: { customerId, status: OutboundSendQueueStatus.QUEUED },
      }),
      prisma.outboundSendQueueItem.count({
        where: { customerId, status: OutboundSendQueueStatus.QUEUED, scheduledFor: { gt: now } },
      }),
      prisma.outboundSendQueueItem.count({ where: blockedDueWhere }),
      prisma.outboundSendQueueItem.count({ where: readyDueWhere }),
      prisma.outboundSendQueueItem.count({
        where: {
          customerId,
          status: OutboundSendQueueStatus.SKIPPED,
          OR: [
            { lastError: { contains: 'suppress', mode: 'insensitive' } },
            { lastError: { contains: 'unsubscribe', mode: 'insensitive' } },
            { lastError: { contains: 'hard_bounce_invalid_recipient', mode: 'insensitive' } },
          ],
        },
      }),
      prisma.outboundSendQueueItem.count({
        where: {
          customerId,
          status: OutboundSendQueueStatus.SKIPPED,
          lastError: { contains: 'replied_stop', mode: 'insensitive' },
        },
      }),
      prisma.outboundSendQueueItem.count({
        where: { customerId, status: OutboundSendQueueStatus.FAILED, updatedAt: { gte: sinceDate } },
      }),
      prisma.outboundSendQueueItem.count({
        where: { customerId, status: OutboundSendQueueStatus.SENT, sentAt: { gte: sinceDate } },
      }),
      prisma.outboundSendQueueItem.findMany({
        where: readyDueWhere,
        orderBy: [{ scheduledFor: 'asc' }, { updatedAt: 'desc' }],
        take: 5,
        select: { id: true, enrollmentId: true, recipientEmail: true, status: true, scheduledFor: true, lastError: true },
      }),
      prisma.outboundSendQueueItem.findMany({
        where: { customerId, status: OutboundSendQueueStatus.FAILED, updatedAt: { gte: sinceDate } },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: { id: true, enrollmentId: true, recipientEmail: true, status: true, scheduledFor: true, lastError: true },
      }),
      prisma.outboundSendQueueItem.findMany({
        where: blockedDueWhere,
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: { id: true, enrollmentId: true, recipientEmail: true, status: true, scheduledFor: true, lastError: true },
      }),
    ])

    const mapSample = (
      rows: Array<{ id: string; enrollmentId: string; recipientEmail: string; status: OutboundSendQueueStatus; scheduledFor: Date | null; lastError: string | null }>
    ) =>
      rows.map((row) => ({
        queueItemId: row.id,
        enrollmentId: row.enrollmentId,
        recipientEmail: row.recipientEmail,
        status: row.status,
        scheduledFor: row.scheduledFor?.toISOString() ?? null,
        lastError: row.lastError ?? null,
      }))

    res.json({
      success: true,
      data: {
        lastUpdatedAt: new Date().toISOString(),
        status: {
          scheduledEngineMode: gateData.mode.scheduledEngineMode,
          scheduledEnabled: gateData.flags.enableScheduledSendingEngine,
          scheduledLiveAllowed: gateData.mode.scheduledLiveAllowed,
          scheduledLiveReason: gateData.mode.scheduledLiveReason ?? null,
          liveGateReasons: Array.isArray(gateData.reasons) ? gateData.reasons : [],
          manualLiveTickAllowed: manualLiveGate.allowed,
          manualLiveTickReason: manualLiveGate.allowed ? null : manualLiveGate.reason ?? 'manual_live_tick_not_allowed',
          activeIdentityCount: gateData.currentCount.activeIdentities,
          dueNowCount: gateData.currentCount.queuedDueNow,
          cron: gateData.caps.scheduledEngineCron,
          canaryCustomerIdPresent: gateData.canary.customerIdPresent,
          liveSendCap: gateData.caps.liveSendCap,
        },
        queue: {
          totalQueued,
          readyNow,
          scheduledLater,
          suppressed,
          replyStopped,
          failedRecently,
          sentRecently,
          blocked,
        },
        recent: gateData.recent,
        samples: {
          readyNow: mapSample(readyNowRows),
          failedRecently: mapSample(failedRows),
          blocked: mapSample(blockedRows),
        },
      },
    })
  } catch (err) {
    console.error('[send-worker/console] error:', err)
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Operator console failed' })
  }
})

/**
 * GET /api/send-worker/audits — read-only list of OutboundSendAttemptAudit (tenant-scoped).
 * Query: queueItemId?, decision?, limit (default 50, max 200), cursor? (id for stable pagination).
 * Order: decidedAt desc, id desc.
 */
router.get('/audits', async (req: Request, res: Response) => {
  const customerId = requireCustomerId(req, res)
  if (!customerId) return

  try {
    const queueItemId = typeof req.query.queueItemId === 'string' ? req.query.queueItemId.trim() || undefined : undefined
    const decisionParam = typeof req.query.decision === 'string' ? req.query.decision.trim() : undefined
    const decision = decisionParam && VALID_DECISIONS.has(decisionParam) ? decisionParam : undefined
    let limit = AUDITS_LIMIT_DEFAULT
    if (typeof req.query.limit === 'string') {
      const n = parseInt(req.query.limit, 10)
      if (!Number.isNaN(n) && n >= 1) limit = Math.min(n, AUDITS_LIMIT_MAX)
    }
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor.trim() || undefined : undefined

    const where: { customerId: string; queueItemId?: string; decision?: OutboundSendAttemptDecision } = { customerId }
    if (queueItemId) where.queueItemId = queueItemId
    if (decision) where.decision = decision as OutboundSendAttemptDecision

    const take = limit + 1
    const orderBy = [{ decidedAt: 'desc' as const }, { id: 'desc' as const }]
    const select = {
      id: true,
      decidedAt: true,
      decision: true,
      reason: true,
      queueItemId: true,
      snapshot: true,
    }

    const items = cursor
      ? await prisma.outboundSendAttemptAudit.findMany({
          where,
          orderBy,
          take,
          cursor: { id: cursor },
          skip: 1,
          select,
        })
      : await prisma.outboundSendAttemptAudit.findMany({
          where,
          orderBy,
          take,
          select,
        })

    const hasMore = items.length > limit
    const slice = hasMore ? items.slice(0, limit) : items
    const nextCursor = hasMore && slice.length > 0 ? slice[slice.length - 1].id : null

    res.json({
      success: true,
      data: {
        items: slice,
        nextCursor,
      },
    })
  } catch (err) {
    console.error('[send-worker/audits] error:', err)
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Audits list failed' })
  }
})

/**
 * GET /api/send-worker/audits/summary — tenant-scoped audit summary (total + byDecision).
 * Query: queueItemId?, decision?, sinceHours (default 24, max 168).
 */
router.get('/audits/summary', async (req: Request, res: Response) => {
  const customerId = requireCustomerId(req, res)
  if (!customerId) return

  try {
    const queueItemId = typeof req.query.queueItemId === 'string' ? req.query.queueItemId.trim() || undefined : undefined
    const decisionParam = typeof req.query.decision === 'string' ? req.query.decision.trim() : undefined
    const decision = decisionParam && VALID_DECISIONS.has(decisionParam) ? (decisionParam as OutboundSendAttemptDecision) : undefined
    let sinceHours = SUMMARY_SINCE_HOURS_DEFAULT
    if (typeof req.query.sinceHours === 'string') {
      const n = parseInt(req.query.sinceHours, 10)
      if (!Number.isNaN(n) && n >= 1) sinceHours = Math.min(n, SUMMARY_SINCE_HOURS_MAX)
    }

    const where = buildAuditWhere(customerId, { queueItemId, decision, sinceHours })

    const [total, groups] = await Promise.all([
      prisma.outboundSendAttemptAudit.count({ where }),
      prisma.outboundSendAttemptAudit.groupBy({
        by: ['decision'],
        where,
        _count: { id: true },
      }),
    ])

    const byDecision: Record<string, number> = {}
    for (const g of groups) {
      byDecision[g.decision] = g._count.id
    }

    res.json({
      success: true,
      data: {
        sinceHours,
        total,
        byDecision,
      },
    })
  } catch (err) {
    console.error('[send-worker/audits/summary] error:', err)
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Summary failed' })
  }
})

/**
 * GET /api/send-worker/audits.csv — tenant-scoped CSV export (read-only).
 * Query: queueItemId?, decision?, sinceHours (default 24). Hard cap 2000 rows.
 */
router.get('/audits.csv', async (req: Request, res: Response) => {
  const customerId = requireCustomerId(req, res)
  if (!customerId) return

  try {
    const queueItemId = typeof req.query.queueItemId === 'string' ? req.query.queueItemId.trim() || undefined : undefined
    const decisionParam = typeof req.query.decision === 'string' ? req.query.decision.trim() : undefined
    const decision = decisionParam && VALID_DECISIONS.has(decisionParam) ? (decisionParam as OutboundSendAttemptDecision) : undefined
    let sinceHours = SUMMARY_SINCE_HOURS_DEFAULT
    if (typeof req.query.sinceHours === 'string') {
      const n = parseInt(req.query.sinceHours, 10)
      if (!Number.isNaN(n) && n >= 1) sinceHours = Math.min(n, SUMMARY_SINCE_HOURS_MAX)
    }

    const where = buildAuditWhere(customerId, { queueItemId, decision, sinceHours })

    const rows = await prisma.outboundSendAttemptAudit.findMany({
      where,
      orderBy: [{ decidedAt: 'desc' as const }, { id: 'desc' as const }],
      take: AUDITS_CSV_MAX,
      select: {
        decidedAt: true,
        decision: true,
        reason: true,
        queueItemId: true,
      },
    })

    const header = 'decidedAt,decision,reason,queueItemId'
    const lines = [header]
    for (const r of rows) {
      const decidedAt = r.decidedAt instanceof Date ? r.decidedAt.toISOString() : String(r.decidedAt ?? '')
      lines.push([escapeCsvField(decidedAt), escapeCsvField(r.decision), escapeCsvField(r.reason), escapeCsvField(r.queueItemId)].join(','))
    }
    const csv = lines.join('\r\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename=send_attempt_audits.csv')
    res.send(csv)
  } catch (err) {
    console.error('[send-worker/audits.csv] error:', err)
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'CSV export failed' })
  }
})

export default router
