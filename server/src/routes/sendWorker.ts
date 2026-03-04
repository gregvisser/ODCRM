/**
 * Stage 2A: Dry-run send worker — process queue items into audited decisions without sending.
 * Stage 2B-min: GET /api/send-worker/audits — read-only audit list (tenant-scoped).
 * Stage 4-min: POST /api/send-worker/live-tick — admin + canary gated real send of N items.
 */
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma.js'
import { validateAdminSecret } from './admin.js'
import { requireCustomerId } from '../utils/tenantId.js'
import { OutboundSendQueueStatus, OutboundSendAttemptDecision } from '@prisma/client'
import { assertLiveSendAllowed, getLiveSendCap } from '../utils/liveSendGate.js'
import { sendEmail } from '../services/outlookEmailService.js'
import { applyTemplatePlaceholders } from '../services/templateRenderer.js'

const router = Router()
const DRY_RUN_BATCH_SIZE = 20
const AUDITS_LIMIT_DEFAULT = 50
const AUDITS_LIMIT_MAX = 200
const AUDITS_CSV_MAX = 2000
const SUMMARY_SINCE_HOURS_DEFAULT = 24
const SUMMARY_SINCE_HOURS_MAX = 168

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
  const normalized = email.toLowerCase().trim()
  const domain = normalized.includes('@') ? normalized.split('@')[1] : ''
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
      where: { customerId, status: OutboundSendQueueStatus.QUEUED },
      orderBy: [{ scheduledFor: 'asc' }, { id: 'asc' }],
      take: limit,
      select: {
        id: true,
        enrollmentId: true,
        stepIndex: true,
        recipientEmail: true,
        attemptCount: true,
      },
    })

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

    for (const item of items) {
      processed += 1
      const recipientEmail = (item.recipientEmail ?? '').trim()
      if (!recipientEmail) {
        await prisma.outboundSendQueueItem.update({
          where: { id: item.id },
          data: {
            status: OutboundSendQueueStatus.SKIPPED,
            lastError: 'missing_recipient_email',
            attemptCount: item.attemptCount + 1,
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

      const suppressionReason = getSuppressionReason(suppressionEntries, recipientEmail)
      if (suppressionReason) {
        await prisma.outboundSendQueueItem.update({
          where: { id: item.id },
          data: {
            status: OutboundSendQueueStatus.SKIPPED,
            lastError: suppressionReason,
            attemptCount: item.attemptCount + 1,
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
            attemptCount: item.attemptCount + 1,
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
          where: { enrollmentId: item.enrollmentId, email: recipientEmail.toLowerCase().trim() },
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
            attemptCount: item.attemptCount + 1,
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
            attemptCount: item.attemptCount + 1,
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
