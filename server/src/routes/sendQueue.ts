/**
 * Stage 1E/1F: Admin send-queue tick endpoint.
 * POST /api/send-queue/tick — requires X-Admin-Secret.
 * dryRun=true (default): dry-run only. dryRun=false: live send only when ODCRM_ALLOW_LIVE_TICK and canary gates pass.
 * Stage 2A: GET /api/send-queue/metrics?customerId=... — requires X-Admin-Secret; returns operational metrics for one customer.
 * Stage 3A: GET /api/send-queue/preview — tenant-scoped (X-Customer-Id), read-only; returns WAIT/SKIP/SEND + reasons.
 */
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma.js'
import { OutboundSendQueueStatus } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { validateAdminSecret } from './admin.js'
import { requireCustomerId } from '../utils/tenantId.js'
import { applyTemplatePlaceholders } from '../services/templateRenderer.js'
import { requeueDryRun, requeueAfterSendFailure, DRY_RUN_DEFAULT_REASON, LIVE_SEND_CAP } from '../utils/sendQueue.js'
import { processOne } from '../workers/sendQueueWorker.js'

const router = Router()
const TICK_LOCK_PREFIX = 'tick_'

type TickBody = {
  customerId?: string
  limit?: number
  dryRun?: boolean
  ignoreWindow?: boolean
}

function liveTickAllowed(customerId: string): { allowed: boolean; reason?: string } {
  if (process.env.ODCRM_ALLOW_LIVE_TICK !== 'true') {
    return { allowed: false, reason: 'ODCRM_ALLOW_LIVE_TICK must be true for live tick' }
  }
  if (process.env.ENABLE_SEND_QUEUE_SENDING !== 'true') {
    return { allowed: false, reason: 'ENABLE_SEND_QUEUE_SENDING must be true' }
  }
  if (process.env.ENABLE_LIVE_SENDING !== 'true') {
    return { allowed: false, reason: 'ENABLE_LIVE_SENDING must be true' }
  }
  const canaryCustomer = process.env.SEND_CANARY_CUSTOMER_ID?.trim() || null
  if (canaryCustomer == null || customerId !== canaryCustomer) {
    return { allowed: false, reason: 'customerId must equal SEND_CANARY_CUSTOMER_ID for live tick' }
  }
  return { allowed: true }
}

const STUCK_LOCKED_THRESHOLD_MINUTES = 15

/** Stage 3A: Compute action and reasons for preview (read-only, no send). */
function previewActionAndReasons(
  item: { status: string; scheduledFor: Date | null; recipientEmail: string },
  now: Date,
  customerHasIdentity: boolean
): { action: 'WAIT' | 'SKIP' | 'SEND'; reasons: string[] } {
  if (item.status === 'SENT') {
    return { action: 'SKIP', reasons: ['already_sent'] }
  }
  if (item.status === 'LOCKED') {
    return { action: 'WAIT', reasons: ['locked'] }
  }
  if (item.status === 'FAILED' || item.status === 'SKIPPED') {
    return { action: 'SKIP', reasons: ['unknown'] }
  }
  // QUEUED
  if (item.scheduledFor && item.scheduledFor > now) {
    return { action: 'WAIT', reasons: ['not_due_yet'] }
  }
  if (!item.recipientEmail?.trim()) {
    return { action: 'SKIP', reasons: ['missing_recipient_email'] }
  }
  if (!customerHasIdentity) {
    return { action: 'SKIP', reasons: ['missing_identity'] }
  }
  return { action: 'SEND', reasons: [] }
}

/** Stage 3D: Human-readable text for a reason code (no extra DB). */
function humanizeReason(
  reason: string,
  item: { scheduledFor: Date | null; status: string; recipientEmail: string },
  _now: Date,
  _customerHasIdentity: boolean
): string | null {
  switch (reason) {
    case 'not_due_yet':
      return item.scheduledFor ? `Scheduled for ${item.scheduledFor.toISOString()}` : 'Not due yet'
    case 'missing_identity':
      return 'No active email identity configured for this client'
    case 'missing_recipient_email':
      return 'Recipient email missing'
    case 'already_sent':
      return 'Already sent'
    case 'locked':
      return 'Queue item locked'
    case 'unknown':
      return 'Unknown reason'
    default:
      return reason || null
  }
}

/**
 * GET /api/send-queue/preview?enrollmentId=<optional>&limit=<optional>
 * Stage 3A: Read-only dry-run preview. Requires X-Customer-Id. No admin secret. No DB mutations.
 */
router.get('/preview', async (req: Request, res: Response) => {
  const customerId = (req.headers['x-customer-id'] as string)?.trim() || (req.headers['X-Customer-Id'] as string)?.trim() || ''
  if (!customerId) {
    res.status(400).json({ error: 'Customer ID is required (X-Customer-Id header)' })
    return
  }
  const enrollmentIdParam = typeof req.query.enrollmentId === 'string' ? req.query.enrollmentId.trim() : ''
  let limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 20
  if (Number.isNaN(limit) || limit < 1) limit = 20
  if (limit > 100) limit = 100

  const now = new Date()
  try {
    const where: { customerId: string; enrollmentId?: string } = { customerId }
    if (enrollmentIdParam) where.enrollmentId = enrollmentIdParam

    const [items, identityCount] = await Promise.all([
      prisma.outboundSendQueueItem.findMany({
        where,
        orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'asc' }],
        take: limit,
        select: { id: true, enrollmentId: true, stepIndex: true, scheduledFor: true, status: true, recipientEmail: true },
      }),
      prisma.emailIdentity.count({ where: { customerId } }),
    ])
    const customerHasIdentity = identityCount > 0

    const rawItemShape = (item: { status: string; scheduledFor: Date | null; recipientEmail: string | null }) => ({
      status: item.status,
      scheduledFor: item.scheduledFor,
      recipientEmail: item.recipientEmail ?? '',
    })
    const data = items.map((item) => {
      const shape = rawItemShape(item)
      const { action, reasons } = previewActionAndReasons(shape, now, customerHasIdentity)
      const reasonDetails = reasons
        .map((r) => humanizeReason(r, shape, now, customerHasIdentity))
        .filter((s): s is string => s != null)
      return {
        id: item.id,
        enrollmentId: item.enrollmentId,
        stepIndex: item.stepIndex,
        scheduledFor: item.scheduledFor?.toISOString() ?? null,
        status: item.status,
        action,
        reasons,
        reasonDetails,
        recipientEmail: item.recipientEmail ?? '',
        renderPreview: null as { subject: string; bodyHtml: string } | null,
      }
    })
    const countsByAction = data.reduce(
      (acc, i) => {
        acc[i.action] = (acc[i.action] ?? 0) + 1
        return acc
      },
      { SEND: 0, WAIT: 0, SKIP: 0 } as { SEND: number; WAIT: number; SKIP: number }
    )
    const countsByReason: Record<string, number> = {}
    for (const i of data) {
      for (const r of i.reasons) {
        countsByReason[r] = (countsByReason[r] ?? 0) + 1
      }
    }
    res.json({
      data: {
        items: data,
        summary: {
          totalReturned: data.length,
          countsByAction,
          countsByReason,
        },
      },
    })
  } catch (err) {
    console.error('[send-queue/preview] error:', err)
    res.status(500).json({ error: err instanceof Error ? err.message : 'Preview failed' })
  }
})

/**
 * GET /api/send-queue/items/:itemId — Stage 3I: tenant-scoped item detail (read-only).
 * Requires X-Customer-Id. Returns minimal fields; 404 when not found or wrong tenant.
 */
router.get('/items/:itemId', async (req: Request, res: Response) => {
  try {
    const customerId = requireCustomerId(req, res)
    if (!customerId) return
    const itemId = (req.params.itemId ?? '').trim()
    if (!itemId) {
      res.status(400).json({ success: false, error: 'itemId is required' })
      return
    }
    const item = await prisma.outboundSendQueueItem.findFirst({
      where: { id: itemId, customerId },
      select: {
        id: true,
        status: true,
        scheduledFor: true,
        attemptCount: true,
        lastError: true,
        sentAt: true,
        recipientEmail: true,
        stepIndex: true,
        enrollmentId: true,
        createdAt: true,
      },
    })
    if (!item) {
      res.status(404).json({ success: false, error: 'Not found' })
      return
    }
    res.setHeader('x-odcrm-customer-id', customerId)
    res.json({
      success: true,
      data: {
        id: item.id,
        status: item.status,
        scheduledFor: item.scheduledFor?.toISOString() ?? null,
        attemptCount: item.attemptCount,
        lastError: item.lastError ?? null,
        sentAt: item.sentAt?.toISOString() ?? null,
        recipientEmail: item.recipientEmail,
        stepIndex: item.stepIndex,
        enrollmentId: item.enrollmentId,
        createdAt: item.createdAt.toISOString(),
      },
    })
  } catch (err) {
    console.error('[send-queue/items/:itemId] error:', err)
    res.status(500).json({ success: false, error: 'An error occurred' })
  }
})

/**
 * GET /api/send-queue/items/:itemId/render — Stage 3G: dry-run render by queue item id. Read-only; no DB mutations.
 * Requires X-Customer-Id. Returns subject + bodyHtml from sequence step templates. No querystring enrollmentId/stepIndex/recipientEmail.
 */
router.get('/items/:itemId/render', async (req: Request, res: Response) => {
  try {
    const customerId = requireCustomerId(req, res)
    if (!customerId) return
    const itemId = req.params.itemId
    if (!itemId?.trim()) {
      res.status(400).json({ error: 'itemId is required' })
      return
    }
    const item = await prisma.outboundSendQueueItem.findFirst({
      where: { id: itemId.trim(), customerId },
      select: { id: true, enrollmentId: true, stepIndex: true, recipientEmail: true },
    })
    if (!item) {
      res.status(404).json({ error: 'Queue item not found' })
      return
    }
    const recipientEmail = (item.recipientEmail ?? '').trim()
    if (!recipientEmail) {
      res.status(400).json({ error: 'Recipient email missing for queue item' })
      return
    }
    const enrollment = await prisma.enrollment.findFirst({
      where: { id: item.enrollmentId, customerId },
      select: { id: true, sequenceId: true },
    })
    if (!enrollment) {
      res.status(404).json({ error: 'Enrollment not found' })
      return
    }
    const step = await prisma.emailSequenceStep.findFirst({
      where: { sequenceId: enrollment.sequenceId, stepOrder: item.stepIndex + 1 },
      select: { subjectTemplate: true, bodyTemplateHtml: true },
    })
    let subject = ''
    let bodyHtml = ''
    if (step?.subjectTemplate != null && step?.bodyTemplateHtml != null) {
      const recipientRow = await prisma.enrollmentRecipient.findFirst({
        where: { enrollmentId: item.enrollmentId, email: recipientEmail },
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
      bodyHtml = applyTemplatePlaceholders(step.bodyTemplateHtml, vars)
    }
    res.setHeader('x-odcrm-customer-id', customerId)
    res.json({
      data: {
        queueItemId: item.id,
        enrollmentId: item.enrollmentId,
        stepIndex: item.stepIndex,
        recipientEmail,
        subject,
        bodyHtml,
      },
    })
  } catch (err) {
    console.error('[send-queue/items/:itemId/render] error:', err)
    res.status(500).json({ error: 'An error occurred' })
  }
})

/**
 * POST /api/send-queue/items/:itemId/retry — Stage 3H: requeue item (tenant + admin).
 * Requires X-Customer-Id and X-Admin-Secret. Rejects if item is SENT.
 */
router.post('/items/:itemId/retry', validateAdminSecret, async (req: Request, res: Response) => {
  try {
    const customerId = requireCustomerId(req, res)
    if (!customerId) return
    const itemId = (req.params.itemId ?? '').trim()
    if (!itemId) {
      res.status(400).json({ error: 'itemId is required' })
      return
    }
    const item = await prisma.outboundSendQueueItem.findFirst({
      where: { id: itemId },
      select: { id: true, customerId: true, status: true, sentAt: true },
    })
    if (!item || item.customerId !== customerId) {
      res.status(404).json({ error: 'Queue item not found' })
      return
    }
    if (item.status === OutboundSendQueueStatus.SENT || item.sentAt != null) {
      res.status(400).json({ error: 'Cannot retry a SENT item' })
      return
    }
    const scheduledFor = new Date(Date.now() + 60_000)
    const updated = await prisma.outboundSendQueueItem.update({
      where: { id: itemId },
      data: {
        status: OutboundSendQueueStatus.QUEUED,
        scheduledFor,
        lockedAt: null,
        lockedBy: null,
        lastError: null,
      },
      select: { id: true, status: true, scheduledFor: true, lastError: true, lockedAt: true, lockedBy: true },
    })
    res.json({ ok: true, item: updated })
  } catch (err) {
    console.error('[send-queue/items/:itemId/retry] error:', err)
    res.status(500).json({ error: 'An error occurred' })
  }
})

/**
 * POST /api/send-queue/items/:itemId/skip — Stage 3H: mark item skipped (tenant + admin).
 * Requires X-Customer-Id and X-Admin-Secret. Body optional { reason?: string } (trimmed, max 200).
 */
router.post('/items/:itemId/skip', validateAdminSecret, async (req: Request, res: Response) => {
  try {
    const customerId = requireCustomerId(req, res)
    if (!customerId) return
    const itemId = (req.params.itemId ?? '').trim()
    if (!itemId) {
      res.status(400).json({ error: 'itemId is required' })
      return
    }
    let reason: string | null = null
    if (req.body && typeof req.body === 'object' && typeof req.body.reason === 'string') {
      reason = req.body.reason.trim().slice(0, 200) || null
    }
    const item = await prisma.outboundSendQueueItem.findFirst({
      where: { id: itemId },
      select: { id: true, customerId: true, status: true, sentAt: true },
    })
    if (!item || item.customerId !== customerId) {
      res.status(404).json({ error: 'Queue item not found' })
      return
    }
    if (item.status === OutboundSendQueueStatus.SENT || item.sentAt != null) {
      res.status(400).json({ error: 'Cannot skip a SENT item' })
      return
    }
    const lastError = reason ? `skipped: ${reason}` : 'skipped_by_admin'
    const updated = await prisma.outboundSendQueueItem.update({
      where: { id: itemId },
      data: {
        status: OutboundSendQueueStatus.SKIPPED,
        scheduledFor: null,
        lockedAt: null,
        lockedBy: null,
        lastError,
      },
      select: { id: true, status: true, scheduledFor: true, lastError: true, lockedAt: true, lockedBy: true },
    })
    res.json({ ok: true, item: updated })
  } catch (err) {
    console.error('[send-queue/items/:itemId/skip] error:', err)
    res.status(500).json({ error: 'An error occurred' })
  }
})

/**
 * GET /api/send-queue/metrics?customerId=<cust_...>
 * Stage 2A: Admin-only (X-Admin-Secret). Returns operational metrics for a single customerId.
 * customerId required (no default). Safe when no rows: zeros/nulls.
 */
router.get('/metrics', validateAdminSecret, async (req: Request, res: Response) => {
  const customerId = typeof req.query.customerId === 'string' ? req.query.customerId.trim() : ''
  if (!customerId) {
    res.status(400).json({ error: 'customerId is required (query param)' })
    return
  }

  const now = new Date()
  const stuckThreshold = new Date(now.getTime() - STUCK_LOCKED_THRESHOLD_MINUTES * 60 * 1000)

  try {
    const baseWhere = { customerId }

    const [groupByResult, dueNowCount, scheduledAgg, lockedCount, stuckLockedCount, sentAgg, lastErrorItem] = await Promise.all([
      prisma.outboundSendQueueItem.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { id: true },
      }),
      prisma.outboundSendQueueItem.count({
        where: {
          ...baseWhere,
          status: OutboundSendQueueStatus.QUEUED,
          OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
        },
      }),
      prisma.outboundSendQueueItem.aggregate({
        where: { ...baseWhere, scheduledFor: { not: null } },
        _min: { scheduledFor: true },
        _max: { scheduledFor: true },
      }),
      prisma.outboundSendQueueItem.count({
        where: { ...baseWhere, status: OutboundSendQueueStatus.LOCKED },
      }),
      prisma.outboundSendQueueItem.count({
        where: {
          ...baseWhere,
          status: OutboundSendQueueStatus.LOCKED,
          lockedAt: { lte: stuckThreshold },
        },
      }),
      prisma.outboundSendQueueItem.aggregate({
        where: { ...baseWhere, status: OutboundSendQueueStatus.SENT },
        _max: { sentAt: true },
      }),
      prisma.outboundSendQueueItem.findFirst({
        where: { ...baseWhere, lastError: { not: null } },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, status: true, lastError: true, updatedAt: true },
      }),
    ])

    const countsByStatus: Record<string, number> = {
      QUEUED: 0,
      LOCKED: 0,
      SENT: 0,
      FAILED: 0,
      SKIPPED: 0,
    }
    for (const row of groupByResult) {
      countsByStatus[row.status] = row._count.id
    }

    const lastSentAt = sentAgg._max.sentAt ?? null
    const lastErrorSample = lastErrorItem
      ? {
          itemId: lastErrorItem.id,
          status: lastErrorItem.status,
          lastError: lastErrorItem.lastError,
          updatedAt: lastErrorItem.updatedAt.toISOString(),
        }
      : null

    res.json({
      data: {
        customerId,
        countsByStatus,
        dueNow: dueNowCount,
        oldestScheduledFor: scheduledAgg._min.scheduledFor?.toISOString() ?? null,
        newestScheduledFor: scheduledAgg._max.scheduledFor?.toISOString() ?? null,
        lockedCount,
        stuckLocked: stuckLockedCount,
        stuckLockedThresholdMinutes: STUCK_LOCKED_THRESHOLD_MINUTES,
        lastSentAt: lastSentAt?.toISOString() ?? null,
        lastErrorSample,
      },
    })
  } catch (err) {
    console.error('[send-queue/metrics] error:', err)
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Metrics failed',
    })
  }
})

/**
 * POST /api/send-queue/tick
 * Body: { customerId: string, limit?: number (default 25, max 100), dryRun?: boolean (default true), ignoreWindow?: boolean (Stage 1G) }
 * When dryRun=false: live send only if ODCRM_ALLOW_LIVE_TICK + canary gates pass; step 0 only; cap LIVE_SEND_CAP.
 * When ignoreWindow=true (and dryRun=false): requires ODCRM_ALLOW_LIVE_TICK_IGNORE_WINDOW=true; bypasses send-window check for one controlled send.
 * Returns: { data: { customerId, limit, lockedBy, scanned, locked, processed, requeued, sent, errors } }
 */
router.post('/tick', validateAdminSecret, async (req: Request, res: Response) => {
  const body = (req.body || {}) as TickBody
  const customerId = typeof body.customerId === 'string' ? body.customerId.trim() : ''
  if (!customerId) {
    res.status(400).json({ error: 'customerId is required in request body' })
    return
  }
  let limit = typeof body.limit === 'number' ? body.limit : 25
  if (Number.isNaN(limit) || limit < 1) limit = 25
  if (limit > 100) limit = 100
  const dryRun = body.dryRun !== false
  const ignoreWindow = body.ignoreWindow === true
  if (!dryRun) {
    const gate = liveTickAllowed(customerId)
    if (!gate.allowed) {
      res.status(400).json({ error: gate.reason ?? 'Live tick not allowed' })
      return
    }
    if (ignoreWindow && process.env.ODCRM_ALLOW_LIVE_TICK_IGNORE_WINDOW !== 'true') {
      res.status(400).json({ error: 'ODCRM_ALLOW_LIVE_TICK_IGNORE_WINDOW must be true to use ignoreWindow' })
      return
    }
  }

  const now = new Date()
  const lockedBy = `${TICK_LOCK_PREFIX}${randomUUID()}`

  let scanned = 0
  let locked = 0
  let processed = 0
  let requeued = 0
  let sent = 0
  let errors = 0

  try {
    const candidates = await prisma.outboundSendQueueItem.findMany({
      where: {
        customerId,
        status: OutboundSendQueueStatus.QUEUED,
        OR: [
          { scheduledFor: null },
          { scheduledFor: { lte: now } },
        ],
      },
      orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'asc' }],
      take: limit,
    })
    scanned = candidates.length
    if (scanned === 0) {
      res.json({
        data: {
          customerId,
          limit,
          lockedBy,
          scanned: 0,
          locked: 0,
          processed: 0,
          requeued: 0,
          sent: 0,
          errors: 0,
        },
      })
      return
    }

    const lockedIds: string[] = []
    for (const item of candidates) {
      const updated = await prisma.outboundSendQueueItem.updateMany({
        where: { id: item.id, status: OutboundSendQueueStatus.QUEUED },
        data: {
          status: OutboundSendQueueStatus.LOCKED,
          lockedAt: now,
          lockedBy,
          attemptCount: item.attemptCount + 1,
        },
      })
      if (updated.count > 0) lockedIds.push(item.id)
    }
    locked = lockedIds.length

    const lockedItems = await prisma.outboundSendQueueItem.findMany({
      where: { id: { in: lockedIds } },
      orderBy: { createdAt: 'asc' },
    })
    processed = lockedItems.length

    if (dryRun) {
      for (const item of lockedItems) {
        try {
          await requeueDryRun(prisma, item.id, DRY_RUN_DEFAULT_REASON)
          requeued += 1
        } catch (err) {
          errors += 1
          const msg = (err as Error)?.message?.slice(0, 500) ?? 'unknown error'
          try {
            await requeueDryRun(prisma, item.id, msg)
            requeued += 1
          } catch {
            await prisma.outboundSendQueueItem.update({
              where: { id: item.id },
              data: {
                status: OutboundSendQueueStatus.QUEUED,
                lockedAt: null,
                lockedBy: null,
                lastError: msg.slice(0, 500),
              },
            })
            requeued += 1
          }
        }
      }
    } else {
      // Stage 1F: live send — step 0 only, cap LIVE_SEND_CAP
      const step0 = lockedItems.filter((i) => i.stepIndex === 0)
      const toSend = step0.slice(0, LIVE_SEND_CAP)
      const toRequeue = [
        ...lockedItems.filter((i) => i.stepIndex !== 0),
        ...step0.slice(LIVE_SEND_CAP),
      ]
      for (const item of toRequeue) {
        try {
          await requeueDryRun(
            prisma,
            item.id,
            item.stepIndex !== 0 ? 'Step 0 only (Stage 1F)' : DRY_RUN_DEFAULT_REASON
          )
          requeued += 1
        } catch (err) {
          errors += 1
          await requeueAfterSendFailure(prisma, item.id, (err as Error)?.message ?? 'unknown error')
          requeued += 1
        }
      }
      const processOptions = ignoreWindow ? { ignoreWindow: true as const } : undefined
      for (const item of toSend) {
        try {
          if (processOptions?.ignoreWindow) {
            console.log(`[sendQueueTick] live send window bypass used customerId=${item.customerId} enrollmentId=${item.enrollmentId} item=${item.id}`)
          }
          await processOne(prisma, item, now, processOptions)
          sent += 1
        } catch (err) {
          errors += 1
          await requeueAfterSendFailure(prisma, item.id, (err as Error)?.message?.slice(0, 500) ?? 'unknown error')
          requeued += 1
        }
      }
    }

    res.json({
      data: {
        customerId,
        limit,
        lockedBy,
        scanned,
        locked,
        processed,
        requeued,
        sent,
        errors,
      },
    })
  } catch (err) {
    console.error('[send-queue/tick] error:', err)
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Tick failed',
    })
  }
})

export default router
