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
import { OutboundSendQueueStatus, OutboundSendAttemptDecision, LeadSourceType, LeadSourceAppliesTo } from '@prisma/client'
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
const LEAD_SOURCE_TYPES: LeadSourceType[] = ['COGNISM', 'APOLLO', 'SOCIAL', 'BLACKBOOK']

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

const BLOCKED_DUE_ERROR_MARKERS = [
  'outside_window',
  'canary',
  'daily_cap_reached',
  'per_minute_cap_reached',
  'no_sender_identity',
  'kill_switch',
  'live_send_disabled',
  'replied_stop',
  'suppressed',
]

function buildBlockedErrorClauses() {
  return BLOCKED_DUE_ERROR_MARKERS.map((marker) => ({
    lastError: { contains: marker, mode: 'insensitive' as const },
  }))
}

type QueueShapeRow = {
  id: string
  enrollmentId: string
  recipientEmail: string
  status: OutboundSendQueueStatus
  scheduledFor: Date | null
  lastError: string | null
  stepIndex: number
  updatedAt: Date
}

function isDueNow(row: QueueShapeRow, now: Date): boolean {
  return !row.scheduledFor || row.scheduledFor <= now
}

function errorHasAny(lastError: string | null | undefined, markers: string[]): boolean {
  const normalized = String(lastError || '').toLowerCase()
  if (!normalized) return false
  return markers.some((marker) => normalized.includes(marker))
}

function classifyRecipientGroup(
  rows: QueueShapeRow[],
  now: Date
): { bucket: 'eligible' | 'excluded' | 'blocked'; reason: string; row: QueueShapeRow } {
  const sorted = [...rows].sort((a, b) => {
    const aTime = a.scheduledFor ? a.scheduledFor.getTime() : 0
    const bTime = b.scheduledFor ? b.scheduledFor.getTime() : 0
    return aTime - bTime || a.stepIndex - b.stepIndex
  })

  const eligible = sorted.find((row) =>
    row.status === OutboundSendQueueStatus.QUEUED &&
    isDueNow(row, now) &&
    !errorHasAny(row.lastError, BLOCKED_DUE_ERROR_MARKERS)
  )
  if (eligible) return { bucket: 'eligible', reason: 'eligible_now', row: eligible }

  const suppressed = sorted.find((row) =>
    errorHasAny(row.lastError, ['suppressed', 'unsubscribe'])
  )
  if (suppressed) return { bucket: 'excluded', reason: 'suppressed', row: suppressed }

  const replyStopped = sorted.find((row) =>
    errorHasAny(row.lastError, ['replied_stop'])
  )
  if (replyStopped) return { bucket: 'excluded', reason: 'reply_stopped', row: replyStopped }

  const invalidRecipient = sorted.find((row) =>
    errorHasAny(row.lastError, ['hard_bounce_invalid_recipient', 'invalid_recipient', 'mailbox_not_found', 'recipient_not_found'])
  )
  if (invalidRecipient) return { bucket: 'excluded', reason: 'invalid_recipient', row: invalidRecipient }

  const noIdentity = sorted.find((row) =>
    errorHasAny(row.lastError, ['no_sender_identity'])
  )
  if (noIdentity) return { bucket: 'blocked', reason: 'no_active_identity', row: noIdentity }

  const scheduledLater = sorted.find((row) =>
    row.status === OutboundSendQueueStatus.QUEUED && !!row.scheduledFor && row.scheduledFor > now
  )
  if (scheduledLater) return { bucket: 'blocked', reason: 'scheduled_later', row: scheduledLater }

  const blockedOther = sorted.find((row) =>
    row.status === OutboundSendQueueStatus.QUEUED && isDueNow(row, now) && errorHasAny(row.lastError, BLOCKED_DUE_ERROR_MARKERS)
  )
  if (blockedOther) return { bucket: 'blocked', reason: 'blocked_other', row: blockedOther }

  const failed = sorted.find((row) => row.status === OutboundSendQueueStatus.FAILED)
  if (failed) return { bucket: 'blocked', reason: 'failed_recently', row: failed }

  return { bucket: 'blocked', reason: 'blocked_other', row: sorted[0] }
}

function deriveQueueReason(status: OutboundSendQueueStatus, scheduledFor: Date | null, lastError: string | null, now: Date): string {
  const normalized = String(lastError || '').toLowerCase()
  if (normalized.includes('replied_stop')) return 'reply_stopped'
  if (normalized.includes('suppress') || normalized.includes('unsubscribe')) return 'suppressed'
  if (normalized.includes('hard_bounce_invalid_recipient') || normalized.includes('invalid_recipient')) return 'invalid_recipient'
  if (normalized.includes('no_sender_identity')) return 'no_active_identity'
  if (normalized.includes('outside_window')) return 'outside_window'
  if (normalized.includes('canary')) return 'canary_blocked'
  if (normalized.includes('daily_cap_reached') || normalized.includes('per_minute_cap_reached')) return 'rate_limited'
  if (status === OutboundSendQueueStatus.SENT) return 'sent'
  if (status === OutboundSendQueueStatus.FAILED) return 'send_failed'
  if (status === OutboundSendQueueStatus.SKIPPED) return normalized || 'skipped'
  if (status === OutboundSendQueueStatus.QUEUED && scheduledFor && scheduledFor > now) return 'scheduled_later'
  return normalized || 'ready'
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

async function getLeadSourceHealthSnapshot(customerId: string) {
  const [exactConfigs, globalConfigs] = await Promise.all([
    prisma.leadSourceSheetConfig.findMany({
      where: { customerId, sourceType: { in: LEAD_SOURCE_TYPES } },
      select: { sourceType: true, spreadsheetId: true, lastError: true, lastFetchAt: true },
    }),
    prisma.leadSourceSheetConfig.findMany({
      where: { appliesTo: LeadSourceAppliesTo.ALL_ACCOUNTS, sourceType: { in: LEAD_SOURCE_TYPES } },
      select: { sourceType: true, spreadsheetId: true, lastError: true, lastFetchAt: true },
      orderBy: [{ updatedAt: 'desc' }],
    }),
  ])
  const exactByType = new Map(exactConfigs.map((row) => [row.sourceType, row]))
  const globalByType = new Map(globalConfigs.map((row) => [row.sourceType, row]))
  const rows = LEAD_SOURCE_TYPES.map((sourceType) => {
    const row = exactByType.get(sourceType) ?? globalByType.get(sourceType) ?? null
    return {
      sourceType,
      configured: Boolean(row?.spreadsheetId),
      hasError: Boolean(row?.lastError),
      lastError: row?.lastError ?? null,
      lastFetchAt: row?.lastFetchAt?.toISOString() ?? null,
    }
  })
  const configuredCount = rows.filter((row) => row.configured).length
  const erroredCount = rows.filter((row) => row.hasError).length
  return {
    total: LEAD_SOURCE_TYPES.length,
    configuredCount,
    unconfiguredCount: LEAD_SOURCE_TYPES.length - configuredCount,
    erroredCount,
    rows,
  }
}

async function getSuppressionHealthSnapshot(customerId: string) {
  const [customer, emailCount, domainCount] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId }, select: { accountData: true } }),
    prisma.suppressionEntry.count({ where: { customerId, type: 'email' } }),
    prisma.suppressionEntry.count({ where: { customerId, type: 'domain' } }),
  ])
  const accountData =
    customer?.accountData && typeof customer.accountData === 'object'
      ? (customer.accountData as Record<string, unknown>)
      : {}
  const dncSheetSources =
    accountData.dncSheetSources && typeof accountData.dncSheetSources === 'object'
      ? (accountData.dncSheetSources as Record<string, unknown>)
      : {}
  const emailMeta = dncSheetSources.email && typeof dncSheetSources.email === 'object' ? (dncSheetSources.email as Record<string, unknown>) : {}
  const domainMeta = dncSheetSources.domain && typeof dncSheetSources.domain === 'object' ? (dncSheetSources.domain as Record<string, unknown>) : {}
  const emailConfigured = typeof emailMeta.sheetUrl === 'string' && emailMeta.sheetUrl.trim().length > 0
  const domainConfigured = typeof domainMeta.sheetUrl === 'string' && domainMeta.sheetUrl.trim().length > 0
  const emailError = typeof emailMeta.lastError === 'string' && emailMeta.lastError.trim().length > 0 ? emailMeta.lastError.trim() : null
  const domainError = typeof domainMeta.lastError === 'string' && domainMeta.lastError.trim().length > 0 ? domainMeta.lastError.trim() : null
  const emailStatus = typeof emailMeta.lastImportStatus === 'string' ? emailMeta.lastImportStatus : null
  const domainStatus = typeof domainMeta.lastImportStatus === 'string' ? domainMeta.lastImportStatus : null
  return {
    emailConfigured,
    domainConfigured,
    configuredCount: Number(emailConfigured) + Number(domainConfigured),
    erroredCount: Number(Boolean(emailError || emailStatus === 'error')) + Number(Boolean(domainError || domainStatus === 'error')),
    emailEntries: emailCount,
    domainEntries: domainCount,
    emailError,
    domainError,
    emailStatus,
    domainStatus,
  }
}

async function getSequenceReadinessSnapshot(customerId: string, sequenceId: string, sinceHours: number) {
  const sequence = await prisma.emailSequence.findFirst({
    where: { id: sequenceId, customerId },
    select: { id: true, name: true },
  })
  if (!sequence) return null

  const enrollmentRows = await prisma.enrollment.findMany({
    where: { customerId, sequenceId: sequence.id },
    select: { id: true },
  })
  const enrollmentIds = enrollmentRows.map((row) => row.id)
  const now = new Date()
  const sinceDate = new Date(Date.now() - sinceHours * 60 * 60 * 1000)

  if (enrollmentIds.length === 0) {
    return {
      sequenceId: sequence.id,
      sequenceName: sequence.name ?? null,
      summary: {
        enrollmentCount: 0,
        totalRecipients: 0,
        queueItemsTotal: 0,
        eligibleCount: 0,
        excludedCount: 0,
        blockedCount: 0,
        failedRecently: 0,
        sentRecently: 0,
      },
      breakdown: {
        eligible_now: 0,
        suppressed: 0,
        reply_stopped: 0,
        invalid_recipient: 0,
        no_active_identity: 0,
        scheduled_later: 0,
        blocked_other: 0,
        failed_recently: 0,
      },
      lastUpdatedAt: new Date().toISOString(),
    }
  }

  const [totalRecipients, queueRows, failedRecently, sentRecently] = await Promise.all([
    prisma.enrollmentRecipient.count({ where: { enrollmentId: { in: enrollmentIds } } }),
    prisma.outboundSendQueueItem.findMany({
      where: { customerId, enrollmentId: { in: enrollmentIds } },
      select: {
        id: true,
        enrollmentId: true,
        recipientEmail: true,
        status: true,
        scheduledFor: true,
        lastError: true,
        stepIndex: true,
        updatedAt: true,
      },
    }),
    prisma.outboundSendQueueItem.count({
      where: {
        customerId,
        enrollmentId: { in: enrollmentIds },
        status: OutboundSendQueueStatus.FAILED,
        updatedAt: { gte: sinceDate },
      },
    }),
    prisma.outboundSendQueueItem.count({
      where: {
        customerId,
        enrollmentId: { in: enrollmentIds },
        status: OutboundSendQueueStatus.SENT,
        sentAt: { gte: sinceDate },
      },
    }),
  ])

  const byRecipient = new Map<string, QueueShapeRow[]>()
  for (const row of queueRows) {
    const recipientEmailNorm = row.recipientEmail.trim().toLowerCase()
    const key = `${row.enrollmentId}::${recipientEmailNorm}`
    const existing = byRecipient.get(key)
    const normalizedRow: QueueShapeRow = { ...row, recipientEmail: recipientEmailNorm }
    if (existing) existing.push(normalizedRow)
    else byRecipient.set(key, [normalizedRow])
  }

  const breakdown = {
    eligible_now: 0,
    suppressed: 0,
    reply_stopped: 0,
    invalid_recipient: 0,
    no_active_identity: 0,
    scheduled_later: 0,
    blocked_other: 0,
    failed_recently: 0,
  }
  let eligibleCount = 0
  let excludedCount = 0
  let blockedCount = 0

  for (const rows of byRecipient.values()) {
    const classified = classifyRecipientGroup(rows, now)
    if (classified.bucket === 'eligible') eligibleCount += 1
    else if (classified.bucket === 'excluded') excludedCount += 1
    else blockedCount += 1
    if (Object.prototype.hasOwnProperty.call(breakdown, classified.reason)) {
      ;(breakdown as Record<string, number>)[classified.reason] += 1
    } else {
      breakdown.blocked_other += 1
    }
  }
  breakdown.failed_recently = failedRecently

  return {
    sequenceId: sequence.id,
    sequenceName: sequence.name ?? null,
    summary: {
      enrollmentCount: enrollmentIds.length,
      totalRecipients,
      queueItemsTotal: queueRows.length,
      eligibleCount,
      excludedCount,
      blockedCount,
      failedRecently,
      sentRecently,
    },
    breakdown,
    lastUpdatedAt: new Date().toISOString(),
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
    const blockedErrorClauses = buildBlockedErrorClauses()
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
          dryRunTickRoute: '/api/send-worker/dry-run',
          dryRunTickRequiresAdminSecret: true,
          liveCanaryTickRoute: '/api/send-worker/live-tick',
          liveCanaryTickRequiresAdminSecret: true,
          liveCanaryTickAllowed: manualLiveGate.allowed,
          liveCanaryTickReason: manualLiveGate.allowed ? null : manualLiveGate.reason ?? 'manual_live_tick_not_allowed',
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
 * GET /api/send-worker/sequence-readiness — sequence-level eligibility/exclusion breakdown.
 * Tenant-scoped, read-only.
 */
router.get('/sequence-readiness', async (req: Request, res: Response) => {
  const customerId = requireCustomerId(req, res)
  if (!customerId) return

  const sequenceId = typeof req.query.sequenceId === 'string' ? req.query.sequenceId.trim() : ''
  if (!sequenceId) {
    res.status(400).json({ success: false, error: 'sequenceId is required' })
    return
  }

  try {
    const sequence = await prisma.emailSequence.findFirst({
      where: { id: sequenceId, customerId },
      select: { id: true, name: true },
    })
    if (!sequence) {
      res.status(404).json({ success: false, error: 'sequence_not_found' })
      return
    }

    const enrollmentRows = await prisma.enrollment.findMany({
      where: { customerId, sequenceId: sequence.id },
      select: { id: true, status: true },
    })
    const enrollmentIds = enrollmentRows.map((row) => row.id)
    const now = new Date()
    const sinceHours = parseSinceHours(req.query.sinceHours)
    const sinceDate = new Date(Date.now() - sinceHours * 60 * 60 * 1000)

    if (enrollmentIds.length === 0) {
      res.json({
        success: true,
        data: {
          sequenceId: sequence.id,
          sequenceName: sequence.name ?? null,
          summary: {
            enrollmentCount: 0,
            totalRecipients: 0,
            queueItemsTotal: 0,
            eligibleCount: 0,
            excludedCount: 0,
            blockedCount: 0,
          },
          breakdown: {
            eligible_now: 0,
            suppressed: 0,
            reply_stopped: 0,
            invalid_recipient: 0,
            no_active_identity: 0,
            scheduled_later: 0,
            blocked_other: 0,
            failed_recently: 0,
          },
          samples: {
            eligible: [],
            excluded: [],
            blocked: [],
          },
          windowHours: sinceHours,
          lastUpdatedAt: new Date().toISOString(),
        },
      })
      return
    }

    const [totalRecipients, queueRows, failedRecently, sentRecently] = await Promise.all([
      prisma.enrollmentRecipient.count({
        where: { enrollmentId: { in: enrollmentIds } },
      }),
      prisma.outboundSendQueueItem.findMany({
        where: { customerId, enrollmentId: { in: enrollmentIds } },
        select: {
          id: true,
          enrollmentId: true,
          recipientEmail: true,
          status: true,
          scheduledFor: true,
          lastError: true,
          stepIndex: true,
          updatedAt: true,
        },
      }),
      prisma.outboundSendQueueItem.count({
        where: {
          customerId,
          enrollmentId: { in: enrollmentIds },
          status: OutboundSendQueueStatus.FAILED,
          updatedAt: { gte: sinceDate },
        },
      }),
      prisma.outboundSendQueueItem.count({
        where: {
          customerId,
          enrollmentId: { in: enrollmentIds },
          status: OutboundSendQueueStatus.SENT,
          sentAt: { gte: sinceDate },
        },
      }),
    ])

    const byRecipient = new Map<string, QueueShapeRow[]>()
    for (const row of queueRows) {
      const recipientEmailNorm = row.recipientEmail.trim().toLowerCase()
      const key = `${row.enrollmentId}::${recipientEmailNorm}`
      const existing = byRecipient.get(key)
      const normalizedRow: QueueShapeRow = { ...row, recipientEmail: recipientEmailNorm }
      if (existing) existing.push(normalizedRow)
      else byRecipient.set(key, [normalizedRow])
    }

    const breakdown = {
      eligible_now: 0,
      suppressed: 0,
      reply_stopped: 0,
      invalid_recipient: 0,
      no_active_identity: 0,
      scheduled_later: 0,
      blocked_other: 0,
      failed_recently: 0,
    }

    const samples = {
      eligible: [] as Array<{ queueItemId: string; enrollmentId: string; recipientEmail: string; status: string; scheduledFor: string | null; lastError: string | null; reason: string }>,
      excluded: [] as Array<{ queueItemId: string; enrollmentId: string; recipientEmail: string; status: string; scheduledFor: string | null; lastError: string | null; reason: string }>,
      blocked: [] as Array<{ queueItemId: string; enrollmentId: string; recipientEmail: string; status: string; scheduledFor: string | null; lastError: string | null; reason: string }>,
    }

    let eligibleCount = 0
    let excludedCount = 0
    let blockedCount = 0

    for (const rows of byRecipient.values()) {
      const classified = classifyRecipientGroup(rows, now)
      if (classified.bucket === 'eligible') eligibleCount += 1
      else if (classified.bucket === 'excluded') excludedCount += 1
      else blockedCount += 1

      if (Object.prototype.hasOwnProperty.call(breakdown, classified.reason)) {
        ;(breakdown as Record<string, number>)[classified.reason] += 1
      } else {
        breakdown.blocked_other += 1
      }

      const target =
        classified.bucket === 'eligible'
          ? samples.eligible
          : classified.bucket === 'excluded'
            ? samples.excluded
            : samples.blocked
      if (target.length < 5) {
        target.push({
          queueItemId: classified.row.id,
          enrollmentId: classified.row.enrollmentId,
          recipientEmail: classified.row.recipientEmail,
          status: classified.row.status,
          scheduledFor: classified.row.scheduledFor?.toISOString() ?? null,
          lastError: classified.row.lastError ?? null,
          reason: classified.reason,
        })
      }
    }

    breakdown.failed_recently = failedRecently

    res.json({
      success: true,
      data: {
        sequenceId: sequence.id,
        sequenceName: sequence.name ?? null,
        summary: {
          enrollmentCount: enrollmentIds.length,
          totalRecipients,
          queueItemsTotal: queueRows.length,
          eligibleCount,
          excludedCount,
          blockedCount,
          failedRecently,
          sentRecently,
        },
        breakdown,
        samples,
        windowHours: sinceHours,
        lastUpdatedAt: new Date().toISOString(),
      },
    })
  } catch (err) {
    console.error('[send-worker/sequence-readiness] error:', err)
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Sequence readiness failed' })
  }
})

/**
 * GET /api/send-worker/sequence-preflight — launch guard summary for one sequence.
 * Tenant-scoped, read-only. Combines sequence readiness, data-health dependencies, and live gate status.
 */
router.get('/sequence-preflight', async (req: Request, res: Response) => {
  const customerId = requireCustomerId(req, res)
  if (!customerId) return

  const sequenceId = typeof req.query.sequenceId === 'string' ? req.query.sequenceId.trim() : ''
  if (!sequenceId) {
    res.status(400).json({ success: false, error: 'sequenceId is required' })
    return
  }

  try {
    const sinceHours = parseSinceHours(req.query.sinceHours)
    const [gateData, readiness, leadSourceHealth, suppressionHealth] = await Promise.all([
      getLiveGatesSnapshot(customerId, sinceHours),
      getSequenceReadinessSnapshot(customerId, sequenceId, sinceHours),
      getLeadSourceHealthSnapshot(customerId),
      getSuppressionHealthSnapshot(customerId),
    ])
    if (!readiness) {
      res.status(404).json({ success: false, error: 'sequence_not_found' })
      return
    }

    const manualLiveGate = assertLiveSendAllowed({ customerId, trigger: 'manual' })
    const blockers: string[] = []
    const warnings: string[] = []

    if ((gateData.currentCount.activeIdentities ?? 0) < 1) blockers.push('No active sender identity for this tenant.')
    if ((readiness.summary.enrollmentCount ?? 0) < 1) blockers.push('Sequence has no enrollments yet.')
    if ((readiness.summary.eligibleCount ?? 0) < 1) blockers.push('No eligible recipients are sendable now.')

    if (leadSourceHealth.configuredCount < 1) warnings.push('No lead source sheet is connected for this tenant.')
    if (leadSourceHealth.erroredCount > 0) warnings.push(`${leadSourceHealth.erroredCount} lead source(s) currently report sync/config errors.`)
    if (suppressionHealth.configuredCount < 1) warnings.push('No suppression sheet source is configured.')
    if (suppressionHealth.erroredCount > 0) warnings.push('Suppression sheet health reports import/config errors.')
    if ((readiness.breakdown.suppressed ?? 0) > 0) warnings.push(`${readiness.breakdown.suppressed} recipients currently suppressed.`)
    if ((readiness.breakdown.reply_stopped ?? 0) > 0) warnings.push(`${readiness.breakdown.reply_stopped} recipients are reply-stopped.`)
    if ((readiness.breakdown.invalid_recipient ?? 0) > 0) warnings.push(`${readiness.breakdown.invalid_recipient} recipients are invalid/hard-bounced.`)
    if (!manualLiveGate.allowed) warnings.push(`Live canary currently blocked: ${manualLiveGate.reason ?? 'manual_live_tick_not_allowed'}`)
    if ((gateData.recent.counts.SEND_FAILED ?? 0) > 0) warnings.push(`Recent SEND_FAILED events in window (${sinceHours}h): ${gateData.recent.counts.SEND_FAILED}`)

    const overallStatus: 'GO' | 'WARNING' | 'NO_GO' =
      blockers.length > 0
        ? 'NO_GO'
        : warnings.length > 0
          ? 'WARNING'
          : 'GO'

    res.json({
      success: true,
      data: {
        sequenceId: readiness.sequenceId,
        sequenceName: readiness.sequenceName,
        overallStatus,
        blockers,
        warnings,
        checks: {
          sequenceExists: true,
          activeIdentityReady: (gateData.currentCount.activeIdentities ?? 0) > 0,
          leadSourcesConfigured: leadSourceHealth.configuredCount > 0,
          suppressionSourceConfigured: suppressionHealth.configuredCount > 0,
          recipientsEligibleNow: (readiness.summary.eligibleCount ?? 0) > 0,
          liveCanaryAllowed: manualLiveGate.allowed,
        },
        counts: {
          enrollmentCount: readiness.summary.enrollmentCount ?? 0,
          totalRecipients: readiness.summary.totalRecipients ?? 0,
          queueItemsTotal: readiness.summary.queueItemsTotal ?? 0,
          eligible: readiness.summary.eligibleCount ?? 0,
          excluded: readiness.summary.excludedCount ?? 0,
          blocked: readiness.summary.blockedCount ?? 0,
          suppressed: readiness.breakdown.suppressed ?? 0,
          replyStopped: readiness.breakdown.reply_stopped ?? 0,
          invalidRecipient: readiness.breakdown.invalid_recipient ?? 0,
          failedRecently: readiness.summary.failedRecently ?? 0,
          sentRecently: readiness.summary.sentRecently ?? 0,
        },
        actions: {
          canDryRun: true,
          dryRunRoute: '/api/send-worker/dry-run',
          dryRunRequiresAdminSecret: true,
          canLiveCanary: manualLiveGate.allowed,
          liveCanaryRoute: '/api/send-worker/live-tick',
          liveCanaryRequiresAdminSecret: true,
          liveCanaryReason: manualLiveGate.allowed ? null : manualLiveGate.reason ?? 'manual_live_tick_not_allowed',
          nextSafeAction:
            blockers.length > 0
              ? 'Resolve blockers, then run Dry-Run Tick.'
              : manualLiveGate.allowed
                ? 'Run Live Canary Tick from the Sending Console.'
                : 'Run Dry-Run Tick and monitor readiness/reporting.',
        },
        dependencies: {
          leadSources: leadSourceHealth,
          suppression: suppressionHealth,
          liveGates: {
            scheduledEngineMode: gateData.mode.scheduledEngineMode,
            scheduledEnabled: gateData.flags.enableScheduledSendingEngine,
            scheduledLiveAllowed: gateData.mode.scheduledLiveAllowed,
            scheduledLiveReason: gateData.mode.scheduledLiveReason ?? null,
            manualLiveTickAllowed: manualLiveGate.allowed,
            manualLiveTickReason: manualLiveGate.allowed ? null : manualLiveGate.reason ?? 'manual_live_tick_not_allowed',
            activeIdentityCount: gateData.currentCount.activeIdentities ?? 0,
            dueNowCount: gateData.currentCount.queuedDueNow ?? 0,
            liveSendCap: gateData.caps.liveSendCap,
            cron: gateData.caps.scheduledEngineCron,
            reasons: Array.isArray(gateData.reasons) ? gateData.reasons : [],
          },
          recent: gateData.recent,
        },
        lastUpdatedAt: new Date().toISOString(),
      },
    })
  } catch (err) {
    console.error('[send-worker/sequence-preflight] error:', err)
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Sequence preflight failed' })
  }
})

/**
 * GET /api/send-worker/queue-workbench — tenant-scoped queue triage rows for operator workbench.
 * Query: state=ready|blocked|failed|scheduled|sent, limit<=100, search(recipient email contains), sinceHours
 */
router.get('/queue-workbench', async (req: Request, res: Response) => {
  const customerId = requireCustomerId(req, res)
  if (!customerId) return

  try {
    const now = new Date()
    const sinceHours = parseSinceHours(req.query.sinceHours)
    const sinceDate = new Date(Date.now() - sinceHours * 60 * 60 * 1000)
    const rawState = typeof req.query.state === 'string' ? req.query.state.trim().toLowerCase() : 'ready'
    const state: 'ready' | 'blocked' | 'failed' | 'scheduled' | 'sent' =
      rawState === 'blocked' || rawState === 'failed' || rawState === 'scheduled' || rawState === 'sent'
        ? rawState
        : 'ready'
    const rawLimit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 25
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 25
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : ''

    const blockedErrorClauses = buildBlockedErrorClauses()
    const baseWhere: Record<string, unknown> = { customerId }
    if (search) {
      baseWhere.recipientEmail = { contains: search, mode: 'insensitive' }
    }

    let where: Record<string, unknown>
    if (state === 'ready') {
      where = {
        ...baseWhere,
        status: OutboundSendQueueStatus.QUEUED,
        OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
        NOT: { OR: blockedErrorClauses },
      }
    } else if (state === 'blocked') {
      where = {
        ...baseWhere,
        OR: [
          {
            status: OutboundSendQueueStatus.QUEUED,
            AND: [{ OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }] }, { OR: blockedErrorClauses }],
          },
          {
            status: OutboundSendQueueStatus.SKIPPED,
            OR: [
              { lastError: { contains: 'suppressed', mode: 'insensitive' as const } },
              { lastError: { contains: 'unsubscribe', mode: 'insensitive' as const } },
              { lastError: { contains: 'replied_stop', mode: 'insensitive' as const } },
              { lastError: { contains: 'hard_bounce_invalid_recipient', mode: 'insensitive' as const } },
              { lastError: { contains: 'invalid_recipient', mode: 'insensitive' as const } },
            ],
          },
        ],
      }
    } else if (state === 'failed') {
      where = {
        ...baseWhere,
        status: OutboundSendQueueStatus.FAILED,
        updatedAt: { gte: sinceDate },
      }
    } else if (state === 'scheduled') {
      where = {
        ...baseWhere,
        status: OutboundSendQueueStatus.QUEUED,
        scheduledFor: { gt: now },
      }
    } else {
      where = {
        ...baseWhere,
        status: OutboundSendQueueStatus.SENT,
        sentAt: { gte: sinceDate },
      }
    }

    const rows = await prisma.outboundSendQueueItem.findMany({
      where,
      orderBy: [
        { scheduledFor: 'asc' },
        { sentAt: 'desc' },
        { updatedAt: 'desc' },
      ],
      take: limit,
      select: {
        id: true,
        enrollmentId: true,
        recipientEmail: true,
        status: true,
        scheduledFor: true,
        sentAt: true,
        updatedAt: true,
        stepIndex: true,
        attemptCount: true,
        lastError: true,
      },
    })

    const enrollmentIds = Array.from(new Set(rows.map((r) => r.enrollmentId).filter(Boolean)))
    const enrollments = enrollmentIds.length
      ? await prisma.enrollment.findMany({
          where: { id: { in: enrollmentIds }, customerId },
          select: { id: true, sequenceId: true, name: true },
        })
      : []
    const sequenceIds = Array.from(new Set(enrollments.map((e) => e.sequenceId).filter(Boolean)))
    const sequences = sequenceIds.length
      ? await prisma.emailSequence.findMany({
          where: { id: { in: sequenceIds }, customerId },
          select: { id: true, name: true, senderIdentityId: true },
        })
      : []
    const identityIds = Array.from(new Set(sequences.map((s) => s.senderIdentityId).filter((v): v is string => !!v)))
    const identities = identityIds.length
      ? await prisma.emailIdentity.findMany({
          where: { id: { in: identityIds }, customerId },
          select: { id: true, emailAddress: true },
        })
      : []

    const enrollmentById = new Map(enrollments.map((e) => [e.id, e]))
    const sequenceById = new Map(sequences.map((s) => [s.id, s]))
    const identityById = new Map(identities.map((i) => [i.id, i]))

    const triageRows = rows.map((row) => {
      const enrollment = enrollmentById.get(row.enrollmentId)
      const sequence = enrollment?.sequenceId ? sequenceById.get(enrollment.sequenceId) : null
      const identity = sequence?.senderIdentityId ? identityById.get(sequence.senderIdentityId) : null
      return {
        queueItemId: row.id,
        enrollmentId: row.enrollmentId,
        enrollmentName: enrollment?.name ?? null,
        sequenceId: sequence?.id ?? null,
        sequenceName: sequence?.name ?? null,
        recipientEmail: row.recipientEmail,
        identityEmail: identity?.emailAddress ?? null,
        status: row.status,
        triageState: state,
        reason: deriveQueueReason(row.status, row.scheduledFor, row.lastError, now),
        scheduledFor: row.scheduledFor?.toISOString() ?? null,
        sentAt: row.sentAt?.toISOString() ?? null,
        updatedAt: row.updatedAt.toISOString(),
        stepIndex: row.stepIndex,
        attemptCount: row.attemptCount,
        lastError: row.lastError ?? null,
      }
    })

    res.json({
      success: true,
      data: {
        state,
        sinceHours,
        totalReturned: triageRows.length,
        lastUpdatedAt: new Date().toISOString(),
        rows: triageRows,
      },
    })
  } catch (err) {
    console.error('[send-worker/queue-workbench] error:', err)
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Queue workbench failed' })
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
