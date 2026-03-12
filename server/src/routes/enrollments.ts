/**
 * Stage 1A + 1B: Enrollment batch persistence (no sending).
 * - POST /api/sequences/:sequenceId/enrollments (mounted in sequences)
 * - GET /api/sequences/:sequenceId/enrollments (mounted in sequences)
 * - GET /api/enrollments (Stage 1B: list by customer, optional ?sequenceId= & ?status=)
 * - GET /api/enrollments/:enrollmentId
 * - POST /api/enrollments/:enrollmentId/pause (Stage 1B)
 * - POST /api/enrollments/:enrollmentId/resume (Stage 1B)
 * - POST /api/enrollments/:enrollmentId/cancel (Stage 1B)
 * Stage 2A: dry-run + audit (no send)
 * - POST /api/enrollments/:enrollmentId/dry-run
 * - GET /api/enrollments/:enrollmentId/audit
 * Stage 2B: send queue primitives (no send)
 * - POST /api/enrollments/:enrollmentId/queue
 * - GET /api/enrollments/:enrollmentId/queue
 */
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireCustomerId } from '../utils/tenantId.js'
import { applyTemplatePlaceholders } from '../services/templateRenderer.js'
import { EnrollmentStatus, OutboundSendQueueStatus, Prisma } from '@prisma/client'
import { requireMarketingMutationAuth } from '../middleware/marketingMutationAuth.js'

const router = Router()

type EnrollmentSourceMeta = {
  recipientSource?: 'manual' | 'snapshot'
  sourceListId?: string | null
  sourceListName?: string | null
}

/** Serialize enrollment for list/detail responses (tenant-safe shape) */
function toEnrollmentListItem(
  e: {
    id: string
    sequenceId: string
    customerId: string
    name: string | null
    status: string
    createdAt: Date
    updatedAt: Date
    _count?: { recipients: number }
    recipients?: unknown[]
  },
  sourceMeta?: EnrollmentSourceMeta | null
) {
  return {
    id: e.id,
    sequenceId: e.sequenceId,
    customerId: e.customerId,
    name: e.name,
    status: e.status,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    recipientCount: e._count?.recipients ?? (Array.isArray(e.recipients) ? e.recipients.length : 0),
    recipientSource: sourceMeta?.recipientSource ?? null,
    sourceListId: sourceMeta?.sourceListId ?? null,
    sourceListName: sourceMeta?.sourceListName ?? null,
  }
}

function readEnrollmentSourceMeta(meta: Prisma.JsonValue | null | undefined): EnrollmentSourceMeta | null {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null
  const record = meta as Record<string, unknown>
  const recipientSourceRaw = record.recipientSource
  const recipientSource =
    recipientSourceRaw === 'manual' || recipientSourceRaw === 'snapshot' ? recipientSourceRaw : undefined
  const sourceListId = typeof record.sourceListId === 'string' && record.sourceListId.trim() ? record.sourceListId.trim() : null
  const sourceListName = typeof record.sourceListName === 'string' && record.sourceListName.trim() ? record.sourceListName.trim() : null
  if (!recipientSource && !sourceListId && !sourceListName) return null
  return { recipientSource, sourceListId, sourceListName }
}

const ENROLLMENTS_UNAVAILABLE_MSG = {
  error: 'Enrollments storage is not available in this environment',
  hint: 'Stage 1A migration may not be applied',
}

/** GET /api/sequences/:id/enrollments — list enrollments for sequence (mount in sequences) */
export async function listEnrollmentsForSequence(req: Request, res: Response): Promise<void> {
  const customerId = requireCustomerId(req, res)
  if (!customerId) return
  const sequenceId = req.params.id
  if (!sequenceId) {
    res.status(400).json({ error: 'sequenceId required' })
    return
  }
  try {
    const sequence = await prisma.emailSequence.findFirst({
      where: { id: sequenceId, customerId },
      select: { id: true },
    })
    if (!sequence) {
      res.status(404).json({ error: 'Sequence not found' })
      return
    }
    const enrollments = await prisma.enrollment.findMany({
      where: { sequenceId, customerId },
      include: {
        _count: { select: { recipients: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    const sourceEvents = enrollments.length
      ? await prisma.enrollmentAuditEvent.findMany({
          where: {
            customerId,
            enrollmentId: { in: enrollments.map((row) => row.id) },
            eventType: 'enrollment_created',
          },
          orderBy: { createdAt: 'desc' },
        })
      : []
    const sourceMetaByEnrollmentId = new Map<string, EnrollmentSourceMeta>()
    for (const event of sourceEvents) {
      if (sourceMetaByEnrollmentId.has(event.enrollmentId)) continue
      const meta = readEnrollmentSourceMeta(event.meta)
      if (meta) sourceMetaByEnrollmentId.set(event.enrollmentId, meta)
    }
    res.setHeader('x-odcrm-customer-id', customerId)
    res.json({
      data: enrollments.map((e) => toEnrollmentListItem(e, sourceMetaByEnrollmentId.get(e.id))),
    })
  } catch (err) {
    console.error('GET /api/sequences/:id/enrollments error:', err)
    res.status(400).json(ENROLLMENTS_UNAVAILABLE_MSG)
  }
}

const MAX_SNAPSHOT_RECIPIENTS = 500

function isValidEmail(email: string): boolean {
  const e = email.trim().toLowerCase()
  return e.length > 0 && e.includes('@') && e.includes('.', e.indexOf('@'))
}

/** POST /api/sequences/:id/enrollments — create enrollment + recipients (mount in sequences). Supports recipientSource: 'manual' | 'snapshot'. */
export async function createEnrollmentForSequence(req: Request, res: Response): Promise<void> {
  const customerId = requireCustomerId(req, res)
  if (!customerId) return
  const sequenceId = req.params.id
  if (!sequenceId) {
    res.status(400).json({ error: 'sequenceId required' })
    return
  }
  try {
    const sequence = await prisma.emailSequence.findFirst({
      where: { id: sequenceId, customerId },
      select: { id: true },
    })
    if (!sequence) {
      res.status(404).json({ error: 'Sequence not found' })
      return
    }
    const body = (req.body || {}) as {
      name?: string
      recipients?: Array<{ email: string; firstName?: string; lastName?: string; company?: string; externalId?: string }>
      recipientSource?: 'manual' | 'snapshot'
    }
    const recipientSource = body.recipientSource === 'snapshot' ? 'snapshot' : body.recipientSource === 'manual' ? 'manual' : undefined
    const manualRecipients = Array.isArray(body.recipients) ? body.recipients : []
    const name = typeof body.name === 'string' ? body.name.trim() || null : null

    let normalized: Array<{ email: string; firstName: string | null; lastName: string | null; company: string | null; externalId: string | null }>
    let resolvedSource: 'manual' | 'snapshot'
    let invalidCount = 0
    let dedupedCount = 0
    let sourceListId: string | null = null
    let sourceListName: string | null = null

    if (recipientSource === 'snapshot' || (!recipientSource && manualRecipients.length === 0)) {
      resolvedSource = 'snapshot'
      const campaign = await prisma.emailCampaign.findFirst({
        where: { customerId, sequenceId, listId: { not: null } },
        select: { listId: true },
      })
      const listId = campaign?.listId ?? null
      if (!listId) {
        res.status(400).json({ success: false, error: 'No Leads Snapshot selected for this sequence' })
        return
      }
      const list = await prisma.contactList.findFirst({
        where: { id: listId, customerId },
        select: { id: true, name: true },
      })
      if (!list) {
        res.status(404).json({ success: false, error: 'Leads Snapshot list not found' })
        return
      }
      sourceListId = list.id
      sourceListName = list.name ?? null
      const members = await prisma.contactListMember.findMany({
        where: { listId: list.id },
        include: { contact: { select: { email: true, firstName: true, lastName: true, companyName: true } } },
      })
      const rawEmails = members.map((m) => ({
        email: String(m.contact?.email ?? '').trim().toLowerCase(),
        firstName: typeof m.contact?.firstName === 'string' ? m.contact.firstName.trim() || null : null,
        lastName: typeof m.contact?.lastName === 'string' ? m.contact.lastName.trim() || null : null,
        company: typeof m.contact?.companyName === 'string' ? m.contact.companyName.trim() || null : null,
      }))
      invalidCount = rawEmails.filter((r) => !isValidEmail(r.email)).length
      const valid = rawEmails.filter((r) => isValidEmail(r.email))
      const seen = new Set<string>()
      const deduped: typeof normalized = []
      for (const r of valid) {
        if (seen.has(r.email)) continue
        seen.add(r.email)
        deduped.push({ ...r, externalId: null })
      }
      dedupedCount = valid.length - deduped.length
      if (deduped.length > MAX_SNAPSHOT_RECIPIENTS) {
        res.status(400).json({
          success: false,
          error: `Snapshot has ${deduped.length} valid recipients; maximum is ${MAX_SNAPSHOT_RECIPIENTS}. Reduce the list or use manual paste.`,
        })
        return
      }
      if (deduped.length === 0) {
        res.status(400).json({
          success: false,
          error: 'No valid emails in the selected Leads Snapshot. Add contacts with valid email addresses.',
        })
        return
      }
      normalized = deduped
    } else {
      resolvedSource = 'manual'
      if (manualRecipients.length === 0) {
        res.status(400).json({ error: 'recipients must be a non-empty array when using manual source' })
        return
      }
      normalized = manualRecipients.map((r) => ({
        email: String(r?.email ?? '').trim().toLowerCase(),
        firstName: typeof r?.firstName === 'string' ? r.firstName.trim() || null : null,
        lastName: typeof r?.lastName === 'string' ? r.lastName.trim() || null : null,
        company: typeof r?.company === 'string' ? r.company.trim() || null : null,
        externalId: typeof r?.externalId === 'string' ? r.externalId.trim() || null : null,
      }))
      const invalid = normalized.find((r) => !r.email || !isValidEmail(r.email))
      if (invalid) {
        res.status(400).json({ error: 'Every recipient must have a valid email' })
        return
      }
      const seen = new Set<string>()
      const deduped: typeof normalized = []
      for (const r of normalized) {
        if (seen.has(r.email)) continue
        seen.add(r.email)
        deduped.push(r)
      }
      dedupedCount = normalized.length - deduped.length
      normalized = deduped
    }

    const now = new Date()
    const enrollment = await prisma.$transaction(async (tx) => {
      const e = await tx.enrollment.create({
        data: {
          sequenceId,
          customerId,
          name,
          status: EnrollmentStatus.ACTIVE,
        },
      })
      await tx.enrollmentRecipient.createMany({
        data: normalized.map((r) => ({
          enrollmentId: e.id,
          email: r.email,
          firstName: r.firstName,
          lastName: r.lastName,
          company: r.company,
          externalId: r.externalId,
        })),
      })
      await tx.outboundSendQueueItem.createMany({
        data: normalized.map((r) => ({
          customerId,
          enrollmentId: e.id,
          recipientEmail: r.email,
          stepIndex: 0,
          status: OutboundSendQueueStatus.QUEUED,
          scheduledFor: now,
        })),
        skipDuplicates: true,
      })
      await tx.enrollmentAuditEvent.create({
        data: {
          customerId,
          enrollmentId: e.id,
          eventType: 'enrollment_created',
          message:
            resolvedSource === 'snapshot'
              ? `Enrollment created from linked lead batch${sourceListName ? `: ${sourceListName}` : ''}`
              : 'Enrollment created from manual recipients',
          meta: {
            recipientSource: resolvedSource,
            sourceListId: resolvedSource === 'snapshot' ? sourceListId : null,
            sourceListName: resolvedSource === 'snapshot' ? sourceListName : null,
            recipientCount: normalized.length,
            invalidCount: resolvedSource === 'snapshot' ? invalidCount : 0,
            dedupedCount,
          },
        },
      })
      const count = await tx.enrollmentRecipient.count({ where: { enrollmentId: e.id } })
      return { enrollment: e, recipientCount: count }
    })
    res.setHeader('x-odcrm-customer-id', customerId)
    res.status(201).json({
      success: true,
      data: {
        enrollmentId: enrollment.enrollment.id,
        id: enrollment.enrollment.id,
        sequenceId: enrollment.enrollment.sequenceId,
        customerId: enrollment.enrollment.customerId,
        name: enrollment.enrollment.name,
        status: enrollment.enrollment.status,
        createdAt: enrollment.enrollment.createdAt.toISOString(),
        updatedAt: enrollment.enrollment.updatedAt.toISOString(),
        recipientCount: enrollment.recipientCount,
        recipientSource: resolvedSource,
        invalidCount: resolvedSource === 'snapshot' ? invalidCount : undefined,
        dedupedCount,
      },
    })
  } catch (err) {
    console.error('POST /api/sequences/:id/enrollments error:', err)
    res.status(400).json(ENROLLMENTS_UNAVAILABLE_MSG)
  }
}

/** GET /api/enrollments — list enrollments for current tenant (Stage 1B). Optional ?sequenceId= & ?status=, order newest first. */
router.get('/', async (req: Request, res: Response) => {
  try {
    const customerId = requireCustomerId(req, res)
    if (!customerId) return
    const sequenceId = typeof req.query.sequenceId === 'string' ? req.query.sequenceId.trim() || null : null
    const status = typeof req.query.status === 'string' ? req.query.status.trim() || null : null
    const where: { customerId: string; sequenceId?: string; status?: EnrollmentStatus } = { customerId }
    if (sequenceId) where.sequenceId = sequenceId
    if (status) {
      const valid = Object.values(EnrollmentStatus).includes(status as EnrollmentStatus)
      if (valid) where.status = status as EnrollmentStatus
    }
    const enrollments = await prisma.enrollment.findMany({
      where,
      include: { _count: { select: { recipients: true } } },
      orderBy: { createdAt: 'desc' },
    })
    const sourceEvents = enrollments.length
      ? await prisma.enrollmentAuditEvent.findMany({
          where: {
            customerId,
            enrollmentId: { in: enrollments.map((row) => row.id) },
            eventType: 'enrollment_created',
          },
          orderBy: { createdAt: 'desc' },
        })
      : []
    const sourceMetaByEnrollmentId = new Map<string, EnrollmentSourceMeta>()
    for (const event of sourceEvents) {
      if (sourceMetaByEnrollmentId.has(event.enrollmentId)) continue
      const meta = readEnrollmentSourceMeta(event.meta)
      if (meta) sourceMetaByEnrollmentId.set(event.enrollmentId, meta)
    }
    res.setHeader('x-odcrm-customer-id', customerId)
    res.json({ data: enrollments.map((row) => toEnrollmentListItem(row, sourceMetaByEnrollmentId.get(row.id))) })
  } catch (err) {
    console.error('GET /api/enrollments error:', err)
    res.status(400).json({ error: 'An error occurred' })
  }
})

// ---------------------------------------------------------------------------
// Stage 2A: dry-run + audit (no send; tenant-safe; contract-aligned)
// ---------------------------------------------------------------------------

/** POST /api/enrollments/:enrollmentId/dry-run — plan what would be sent; persist audit events; no send */
router.post('/:enrollmentId/dry-run', requireMarketingMutationAuth, async (req: Request, res: Response) => {
  try {
    const customerId = requireCustomerId(req, res)
    if (!customerId) return
    const enrollmentId = req.params.enrollmentId
    if (!enrollmentId) {
      res.status(400).json({ error: 'enrollmentId required' })
      return
    }
    const enrollment = await prisma.enrollment.findFirst({
      where: { id: enrollmentId, customerId },
      include: {
        recipients: true,
        sequence: {
          select: {
            id: true,
            senderIdentityId: true,
            steps: { orderBy: { stepOrder: 'asc' } },
          },
        },
      },
    })
    if (!enrollment) {
      res.status(404).json({ error: 'Enrollment not found' })
      return
    }
    const plannedAt = new Date()
    const tx = prisma

    // Active identity check (sequence has senderIdentityId; verify identity exists and is active)
    const hasActiveIdentity = enrollment.sequence.senderIdentityId
      ? await prisma.emailIdentity.findFirst({
          where: {
            id: enrollment.sequence.senderIdentityId,
            customerId,
            isActive: true,
          },
          select: { id: true },
        })
      : null

    // Load suppression (emails + domains) for customer
    const suppressionEntries = await tx.suppressionEntry.findMany({
      where: { customerId },
      select: { type: true, value: true, emailNormalized: true, reason: true },
    })
    const getSuppressionReason = (email: string): string | null => {
      const normalized = email.toLowerCase().trim()
      const domain = email.includes('@') ? email.split('@')[1] : ''
      const emailEntry = suppressionEntries.find(
        (s) => s.type === 'email' && (s.emailNormalized ?? s.value) === normalized
      )
      if (emailEntry) return emailEntry.reason ?? 'suppressed'
      const domainEntry = suppressionEntries.find((s) => s.type === 'domain' && s.value === domain)
      if (domainEntry) return domainEntry.reason ?? 'suppressed'
      return null
    }

    const templateId = enrollment.sequence.steps[0]?.id ?? null
    const identityId = enrollment.sequence.senderIdentityId ?? null
    const stepOrder = 1

    const items: Array<{
      recipientId: string
      email: string
      stepOrder: number
      status: 'WouldSend' | 'Skipped'
      templateId?: string | null
      identityId?: string | null
      suppressionResult?: string
      reason?: string
    }> = []

    for (const r of enrollment.recipients) {
      if (!hasActiveIdentity) {
        items.push({
          recipientId: r.id,
          email: r.email,
          stepOrder,
          status: 'Skipped',
          reason: 'SKIP_NO_IDENTITY',
        })
        continue
      }
      const suppressionReason = getSuppressionReason(r.email)
      if (suppressionReason) {
        items.push({
          recipientId: r.id,
          email: r.email,
          stepOrder,
          status: 'Skipped',
          reason: 'suppressed',
        })
        continue
      }
      items.push({
        recipientId: r.id,
        email: r.email,
        stepOrder,
        status: 'WouldSend',
        templateId: templateId ?? undefined,
        identityId: identityId ?? undefined,
        suppressionResult: 'allowed',
      })
    }

    // Persist audit events (append-only; no secrets in meta)
    await tx.enrollmentAuditEvent.create({
      data: {
        customerId,
        enrollmentId,
        eventType: 'dry_run_started',
        message: `Dry run started; ${enrollment.recipients.length} recipient(s)`,
        meta: { recipientCount: enrollment.recipients.length },
      },
    })
    const wouldSendCount = items.filter((i) => i.status === 'WouldSend').length
    const skippedCount = items.filter((i) => i.status === 'Skipped').length
    for (const item of items) {
      await tx.enrollmentAuditEvent.create({
        data: {
          customerId,
          enrollmentId,
          recipientEmail: item.email,
          eventType: 'dry_run_recipient',
          message: item.status === 'Skipped' ? item.reason : 'would_send',
          meta: {
            recipientId: item.recipientId,
            stepOrder: item.stepOrder,
            status: item.status,
            ...(item.reason && { reason: item.reason }),
          },
        },
      })
    }
    await tx.enrollmentAuditEvent.create({
      data: {
        customerId,
        enrollmentId,
        eventType: 'dry_run_completed',
        message: `Dry run completed; wouldSend=${wouldSendCount}, skipped=${skippedCount}`,
        meta: { wouldSendCount, skippedCount, totalItems: items.length },
      },
    })

    res.setHeader('x-odcrm-customer-id', customerId)
    res.json({
      data: {
        enrollmentId: enrollment.id,
        plannedAt: plannedAt.toISOString(),
        items,
      },
    })
  } catch (err) {
    console.error('POST /api/enrollments/:enrollmentId/dry-run error:', err)
    res.status(500).json({ error: 'An error occurred' })
  }
})

/** GET /api/enrollments/:enrollmentId/audit — audit log entries for enrollment (most recent first) */
router.get('/:enrollmentId/audit', async (req: Request, res: Response) => {
  try {
    const customerId = requireCustomerId(req, res)
    if (!customerId) return
    const enrollmentId = req.params.enrollmentId
    if (!enrollmentId) {
      res.status(400).json({ error: 'enrollmentId required' })
      return
    }
    const enrollment = await prisma.enrollment.findFirst({
      where: { id: enrollmentId, customerId },
      select: { id: true },
    })
    if (!enrollment) {
      res.status(404).json({ error: 'Enrollment not found' })
      return
    }
    const limit = Math.min(Math.max(1, Number(req.query.limit) || 50), 200)
    const events = await prisma.enrollmentAuditEvent.findMany({
      where: { enrollmentId, customerId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    const entries = events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      timestamp: e.createdAt.toISOString(),
      customerId: e.customerId,
      payload: (e.meta as Record<string, unknown>) ?? {},
    }))
    res.setHeader('x-odcrm-customer-id', customerId)
    res.json({
      data: {
        enrollmentId,
        entries,
      },
    })
  } catch (err) {
    console.error('GET /api/enrollments/:enrollmentId/audit error:', err)
    res.status(500).json({ error: 'An error occurred' })
  }
})

// ---------------------------------------------------------------------------
// Stage 2B / Stage 1B: queue list, refresh (idempotent rebuild), enqueue (step 0)
// ---------------------------------------------------------------------------

/** POST /api/enrollments/:enrollmentId/queue/refresh — idempotent rebuild queue for all recipients and all steps; do not delete SENT */
router.post('/:enrollmentId/queue/refresh', requireMarketingMutationAuth, async (req: Request, res: Response) => {
  try {
    const customerId = requireCustomerId(req, res)
    if (!customerId) return
    const enrollmentId = req.params.enrollmentId
    if (!enrollmentId) {
      res.status(400).json({ error: 'enrollmentId required' })
      return
    }
    const enrollment = await prisma.enrollment.findFirst({
      where: { id: enrollmentId, customerId },
      include: {
        recipients: true,
        sequence: {
          select: {
            id: true,
            steps: { orderBy: { stepOrder: 'asc' } },
          },
        },
      },
    })
    if (!enrollment) {
      res.status(404).json({ error: 'Enrollment not found' })
      return
    }
    const steps = enrollment.sequence?.steps ?? []
    const now = new Date()
    let created = 0
    let updated = 0
    let skipped = 0

    for (const r of enrollment.recipients) {
      let dueOffsetMs = 0
      for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
        const step = steps[stepIndex]
        if (stepIndex > 0 && step) {
          dueOffsetMs += (step.delayDaysFromPrevious ?? 0) * 24 * 60 * 60 * 1000
        }
        const scheduledFor = new Date(now.getTime() + dueOffsetMs)
        const existing = await prisma.outboundSendQueueItem.findUnique({
          where: {
            customerId_enrollmentId_recipientEmail_stepIndex: {
              customerId,
              enrollmentId,
              recipientEmail: r.email,
              stepIndex,
            },
          },
        })
        if (existing) {
          if (existing.status === OutboundSendQueueStatus.SENT) {
            skipped++
            continue
          }
          await prisma.outboundSendQueueItem.update({
            where: { id: existing.id },
            data: { scheduledFor, updatedAt: now },
          })
          updated++
        } else {
          await prisma.outboundSendQueueItem.create({
            data: {
              customerId,
              enrollmentId,
              recipientEmail: r.email,
              stepIndex,
              status: OutboundSendQueueStatus.QUEUED,
              scheduledFor,
            },
          })
          created++
        }
      }
    }

    res.setHeader('x-odcrm-customer-id', customerId)
    res.json({
      data: { created, updated, skipped },
    })
  } catch (err) {
    console.error('POST /api/enrollments/:enrollmentId/queue/refresh error:', err)
    res.status(500).json({ error: 'An error occurred' })
  }
})

/** POST /api/enrollments/:enrollmentId/queue — enqueue stepIndex=0 only; no sending */
router.post('/:enrollmentId/queue', requireMarketingMutationAuth, async (req: Request, res: Response) => {
  try {
    const customerId = requireCustomerId(req, res)
    if (!customerId) return
    const enrollmentId = req.params.enrollmentId
    if (!enrollmentId) {
      res.status(400).json({ error: 'enrollmentId required' })
      return
    }
    const enrollment = await prisma.enrollment.findFirst({
      where: { id: enrollmentId, customerId },
      include: { recipients: true },
    })
    if (!enrollment) {
      res.status(404).json({ error: 'Enrollment not found' })
      return
    }
    const totalRecipients = enrollment.recipients.length
    const now = new Date()

    await prisma.enrollmentAuditEvent.create({
      data: {
        customerId,
        enrollmentId,
        eventType: 'QUEUE_ENQUEUE_STARTED',
        message: `Enqueue started; ${totalRecipients} recipient(s)`,
        meta: { recipientCount: totalRecipients },
      },
    })

    const stepIndex = 0
    const { count: enqueuedCount } = await prisma.outboundSendQueueItem.createMany({
      data: enrollment.recipients.map((r) => ({
        customerId,
        enrollmentId,
        recipientEmail: r.email,
        stepIndex,
        status: OutboundSendQueueStatus.QUEUED,
        scheduledFor: now,
      })),
      skipDuplicates: true,
    })
    const alreadyQueuedCount = totalRecipients - enqueuedCount

    await prisma.enrollmentAuditEvent.create({
      data: {
        customerId,
        enrollmentId,
        eventType: 'QUEUE_ENQUEUE_COMPLETED',
        message: `Enqueue completed; enqueued=${enqueuedCount}, alreadyQueued=${alreadyQueuedCount}`,
        meta: { enqueuedCount, alreadyQueuedCount, totalRecipients },
      },
    })

    res.setHeader('x-odcrm-customer-id', customerId)
    res.json({
      enrollmentId,
      totalRecipients,
      enqueuedCount,
      alreadyQueuedCount,
    })
  } catch (err) {
    console.error('POST /api/enrollments/:enrollmentId/queue error:', err)
    res.status(500).json({ error: 'An error occurred' })
  }
})

/** GET /api/enrollments/:enrollmentId/queue — list queue items by dueAt (scheduledFor) asc, then createdAt asc; include meta.countsByStatus */
router.get('/:enrollmentId/queue', async (req: Request, res: Response) => {
  try {
    const customerId = requireCustomerId(req, res)
    if (!customerId) return
    const enrollmentId = req.params.enrollmentId
    if (!enrollmentId) {
      res.status(400).json({ error: 'enrollmentId required' })
      return
    }
    const enrollment = await prisma.enrollment.findFirst({
      where: { id: enrollmentId, customerId },
      select: { id: true },
    })
    if (!enrollment) {
      res.status(404).json({ error: 'Enrollment not found' })
      return
    }
    const items = await prisma.outboundSendQueueItem.findMany({
      where: { enrollmentId, customerId },
      orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'asc' }],
    })
    const countsByStatus: Record<string, number> = {}
    for (const item of items) {
      countsByStatus[item.status] = (countsByStatus[item.status] ?? 0) + 1
    }
    const data = items.map((item) => ({
      id: item.id,
      customerId: item.customerId,
      enrollmentId: item.enrollmentId,
      recipientEmail: item.recipientEmail,
      stepIndex: item.stepIndex,
      status: item.status,
      scheduledFor: item.scheduledFor?.toISOString() ?? null,
      lockedAt: item.lockedAt?.toISOString() ?? null,
      lockedBy: item.lockedBy ?? null,
      attemptCount: item.attemptCount,
      lastError: item.lastError ?? null,
      sentAt: item.sentAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
    }))
    res.setHeader('x-odcrm-customer-id', customerId)
    res.json({ data, meta: { countsByStatus } })
  } catch (err) {
    console.error('GET /api/enrollments/:enrollmentId/queue error:', err)
    res.status(500).json({ error: 'An error occurred' })
  }
})

/** GET /api/enrollments/:enrollmentId/steps/:stepIndex/render — Stage 3F: dry-run render subject + bodyHtml for a step. Read-only; no sends/locks. */
router.get('/:enrollmentId/steps/:stepIndex/render', async (req: Request, res: Response) => {
  try {
    const customerId = requireCustomerId(req, res)
    if (!customerId) return
    if (!customerId.startsWith('cust_')) {
      res.status(400).json({ error: 'Customer ID must be a valid tenant id (X-Customer-Id header, cust_...)' })
      return
    }
    const enrollmentId = req.params.enrollmentId
    const stepIndexParam = req.params.stepIndex
    const recipientEmail = typeof req.query.recipientEmail === 'string' ? req.query.recipientEmail.trim() : ''
    if (!enrollmentId) {
      res.status(400).json({ error: 'enrollmentId required' })
      return
    }
    const stepIndex = parseInt(stepIndexParam, 10)
    if (Number.isNaN(stepIndex) || stepIndex < 0) {
      res.status(400).json({ error: 'stepIndex must be a non-negative integer' })
      return
    }
    const enrollment = await prisma.enrollment.findFirst({
      where: { id: enrollmentId, customerId },
      select: {
        id: true,
        sequenceId: true,
        customer: {
          select: {
            name: true,
            website: true,
            domain: true,
          },
        },
        sequence: {
          select: {
            senderIdentity: {
              select: {
                emailAddress: true,
                displayName: true,
                signatureHtml: true,
              },
            },
          },
        },
      },
    })
    if (!enrollment) {
      res.status(404).json({ error: 'Enrollment not found' })
      return
    }
    const step = await prisma.emailSequenceStep.findFirst({
      where: { sequenceId: enrollment.sequenceId, stepOrder: stepIndex + 1 },
      select: { subjectTemplate: true, bodyTemplateHtml: true },
    })
    let subject = ''
    let bodyHtml = ''
    if (step?.subjectTemplate != null && step?.bodyTemplateHtml != null) {
      const recipientRow = recipientEmail
        ? await prisma.enrollmentRecipient.findFirst({
            where: { enrollmentId, email: recipientEmail },
            select: { firstName: true, lastName: true, company: true, email: true },
          })
        : null
      const vars = {
        firstName: recipientRow?.firstName ?? '',
        lastName: recipientRow?.lastName ?? '',
        company: recipientRow?.company ?? '',
        companyName: recipientRow?.company ?? '',
        accountName: recipientRow?.company ?? enrollment.customer?.name ?? '',
        email: recipientEmail,
        role: '',
        jobTitle: '',
        title: '',
        phone: '',
        website: enrollment.customer?.website ?? enrollment.customer?.domain ?? '',
        senderName: enrollment.sequence?.senderIdentity?.displayName ?? enrollment.sequence?.senderIdentity?.emailAddress ?? '',
        senderEmail: enrollment.sequence?.senderIdentity?.emailAddress ?? '',
        emailSignature: enrollment.sequence?.senderIdentity?.signatureHtml ?? '',
      }
      subject = applyTemplatePlaceholders(step.subjectTemplate, vars)
      bodyHtml = applyTemplatePlaceholders(step.bodyTemplateHtml, vars)
    }
    res.setHeader('x-odcrm-customer-id', customerId)
    res.json({
      data: { subject, bodyHtml, stepIndex, enrollmentId },
    })
  } catch (err) {
    console.error('GET /api/enrollments/:enrollmentId/steps/:stepIndex/render error:', err)
    res.status(500).json({ error: 'An error occurred' })
  }
})

/** GET /api/enrollments/:enrollmentId — detail + recipients */
router.get('/:enrollmentId', async (req: Request, res: Response) => {
  try {
    const customerId = requireCustomerId(req, res)
    if (!customerId) return
    const enrollmentId = req.params.enrollmentId
    if (!enrollmentId) {
      res.status(400).json({ error: 'enrollmentId required' })
      return
    }
    const enrollment = await prisma.enrollment.findFirst({
      where: { id: enrollmentId, customerId },
      include: {
        recipients: true,
        sequence: { select: { id: true, name: true } },
      },
    })
    if (!enrollment) {
      res.status(404).json({ error: 'Enrollment not found' })
      return
    }
    res.setHeader('x-odcrm-customer-id', customerId)
    res.json({
      data: {
        id: enrollment.id,
        sequenceId: enrollment.sequenceId,
        customerId: enrollment.customerId,
        name: enrollment.name,
        status: enrollment.status,
        createdAt: enrollment.createdAt.toISOString(),
        updatedAt: enrollment.updatedAt.toISOString(),
        sequence: enrollment.sequence,
        recipients: enrollment.recipients.map((r) => ({
          id: r.id,
          email: r.email,
          firstName: r.firstName,
          lastName: r.lastName,
          company: r.company,
          externalId: r.externalId,
          createdAt: r.createdAt.toISOString(),
        })),
        recipientCount: enrollment.recipients.length,
      },
    })
  } catch (err) {
    console.error('GET /api/enrollments/:enrollmentId error:', err)
    res.status(400).json({ error: 'An error occurred' })
  }
})

const PAUSABLE_STATUSES: EnrollmentStatus[] = [EnrollmentStatus.DRAFT, EnrollmentStatus.ACTIVE]
const RESUMABLE_STATUS = EnrollmentStatus.PAUSED
const CANCELLABLE_STATUSES: EnrollmentStatus[] = [EnrollmentStatus.ACTIVE, EnrollmentStatus.PAUSED]

function lifecycleResponse(enrollment: { id: string; status: string; updatedAt: Date }) {
  return { success: true as const, data: { id: enrollment.id, status: enrollment.status, updatedAt: enrollment.updatedAt.toISOString() } }
}

/** POST /api/enrollments/:enrollmentId/pause — atomic: PAUSED only when status in DRAFT|ACTIVE */
router.post('/:enrollmentId/pause', requireMarketingMutationAuth, async (req: Request, res: Response) => {
  try {
    const customerId = requireCustomerId(req, res)
    if (!customerId) return
    const enrollmentId = req.params.enrollmentId
    if (!enrollmentId) {
      res.status(400).json({ error: 'enrollmentId required' })
      return
    }
    const { count } = await prisma.enrollment.updateMany({
      where: { id: enrollmentId, customerId, status: { in: PAUSABLE_STATUSES } },
      data: { status: EnrollmentStatus.PAUSED },
    })
    if (count === 1) {
      const row = await prisma.enrollment.findFirst({
        where: { id: enrollmentId, customerId },
        select: { id: true, status: true, updatedAt: true },
      })
      if (row) {
        res.setHeader('x-odcrm-customer-id', customerId)
        res.json(lifecycleResponse(row))
        return
      }
    }
    const existing = await prisma.enrollment.findFirst({
      where: { id: enrollmentId, customerId },
      select: { id: true, status: true },
    })
    if (!existing) {
      res.status(404).json({ success: false, error: 'Not found' })
      return
    }
    res.status(409).json({ success: false, error: `Invalid status transition for pause`, status: existing.status })
  } catch (err) {
    console.error('POST /api/enrollments/:enrollmentId/pause error:', err)
    res.status(400).json({ error: 'An error occurred' })
  }
})

/** POST /api/enrollments/:enrollmentId/resume — atomic: ACTIVE only when status is PAUSED */
router.post('/:enrollmentId/resume', requireMarketingMutationAuth, async (req: Request, res: Response) => {
  try {
    const customerId = requireCustomerId(req, res)
    if (!customerId) return
    const enrollmentId = req.params.enrollmentId
    if (!enrollmentId) {
      res.status(400).json({ error: 'enrollmentId required' })
      return
    }
    const { count } = await prisma.enrollment.updateMany({
      where: { id: enrollmentId, customerId, status: RESUMABLE_STATUS },
      data: { status: EnrollmentStatus.ACTIVE },
    })
    if (count === 1) {
      const row = await prisma.enrollment.findFirst({
        where: { id: enrollmentId, customerId },
        select: { id: true, status: true, updatedAt: true },
      })
      if (row) {
        res.setHeader('x-odcrm-customer-id', customerId)
        res.json(lifecycleResponse(row))
        return
      }
    }
    const existing = await prisma.enrollment.findFirst({
      where: { id: enrollmentId, customerId },
      select: { id: true, status: true },
    })
    if (!existing) {
      res.status(404).json({ success: false, error: 'Not found' })
      return
    }
    res.status(409).json({ success: false, error: `Invalid status transition for resume`, status: existing.status })
  } catch (err) {
    console.error('POST /api/enrollments/:enrollmentId/resume error:', err)
    res.status(400).json({ error: 'An error occurred' })
  }
})

/** POST /api/enrollments/:enrollmentId/cancel — atomic: CANCELLED only when status in ACTIVE|PAUSED */
router.post('/:enrollmentId/cancel', requireMarketingMutationAuth, async (req: Request, res: Response) => {
  try {
    const customerId = requireCustomerId(req, res)
    if (!customerId) return
    const enrollmentId = req.params.enrollmentId
    if (!enrollmentId) {
      res.status(400).json({ error: 'enrollmentId required' })
      return
    }
    const { count } = await prisma.enrollment.updateMany({
      where: { id: enrollmentId, customerId, status: { in: CANCELLABLE_STATUSES } },
      data: { status: EnrollmentStatus.CANCELLED },
    })
    if (count === 1) {
      const row = await prisma.enrollment.findFirst({
        where: { id: enrollmentId, customerId },
        select: { id: true, status: true, updatedAt: true },
      })
      if (row) {
        res.setHeader('x-odcrm-customer-id', customerId)
        res.json(lifecycleResponse(row))
        return
      }
    }
    const existing = await prisma.enrollment.findFirst({
      where: { id: enrollmentId, customerId },
      select: { id: true, status: true },
    })
    if (!existing) {
      res.status(404).json({ success: false, error: 'Not found' })
      return
    }
    res.status(409).json({ success: false, error: `Invalid status transition for cancel`, status: existing.status })
  } catch (err) {
    console.error('POST /api/enrollments/:enrollmentId/cancel error:', err)
    res.status(400).json({ error: 'An error occurred' })
  }
})

export default router
