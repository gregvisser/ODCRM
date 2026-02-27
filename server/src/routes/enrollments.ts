/**
 * Stage 1A + 1B: Enrollment batch persistence (no sending).
 * - POST /api/sequences/:sequenceId/enrollments (mounted in sequences)
 * - GET /api/sequences/:sequenceId/enrollments (mounted in sequences)
 * - GET /api/enrollments (Stage 1B: list by customer, optional ?sequenceId= & ?status=)
 * - GET /api/enrollments/:enrollmentId
 * - POST /api/enrollments/:enrollmentId/pause (Stage 1B)
 * - POST /api/enrollments/:enrollmentId/resume (Stage 1B)
 * Stage 2A: dry-run + audit (no send)
 * - POST /api/enrollments/:enrollmentId/dry-run
 * - GET /api/enrollments/:enrollmentId/audit
 */
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireCustomerId } from '../utils/tenantId.js'
import { EnrollmentStatus } from '@prisma/client'

const router = Router()

/** Serialize enrollment for list/detail responses (tenant-safe shape) */
function toEnrollmentListItem(e: { id: string; sequenceId: string; customerId: string; name: string | null; status: string; createdAt: Date; updatedAt: Date; _count?: { recipients: number }; recipients?: unknown[] }) {
  return {
    id: e.id,
    sequenceId: e.sequenceId,
    customerId: e.customerId,
    name: e.name,
    status: e.status,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    recipientCount: e._count?.recipients ?? (Array.isArray(e.recipients) ? e.recipients.length : 0),
  }
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
    res.setHeader('x-odcrm-customer-id', customerId)
    res.json({
      data: enrollments.map((e) => ({
        id: e.id,
        sequenceId: e.sequenceId,
        customerId: e.customerId,
        name: e.name,
        status: e.status,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
        recipientCount: e._count.recipients,
      })),
    })
  } catch (err) {
    console.error('GET /api/sequences/:id/enrollments error:', err)
    res.status(400).json(ENROLLMENTS_UNAVAILABLE_MSG)
  }
}

/** POST /api/sequences/:id/enrollments — create enrollment + recipients (mount in sequences) */
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
    const body = (req.body || {}) as { name?: string; recipients?: Array<{ email: string; firstName?: string; lastName?: string; company?: string; externalId?: string }> }
    const recipients = Array.isArray(body.recipients) ? body.recipients : []
    if (recipients.length === 0) {
      res.status(400).json({ error: 'recipients must be a non-empty array' })
      return
    }
    const name = typeof body.name === 'string' ? body.name.trim() || null : null
    const normalized = recipients.map((r) => ({
      email: String(r?.email ?? '').trim().toLowerCase(),
      firstName: typeof r?.firstName === 'string' ? r.firstName.trim() || null : null,
      lastName: typeof r?.lastName === 'string' ? r.lastName.trim() || null : null,
      company: typeof r?.company === 'string' ? r.company.trim() || null : null,
      externalId: typeof r?.externalId === 'string' ? r.externalId.trim() || null : null,
    }))
    const invalid = normalized.find((r) => !r.email)
    if (invalid) {
      res.status(400).json({ error: 'Every recipient must have an email' })
      return
    }
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
      const count = await tx.enrollmentRecipient.count({ where: { enrollmentId: e.id } })
      return { enrollment: e, recipientCount: count }
    })
    res.setHeader('x-odcrm-customer-id', customerId)
    res.status(201).json({
      data: {
        id: enrollment.enrollment.id,
        sequenceId: enrollment.enrollment.sequenceId,
        customerId: enrollment.enrollment.customerId,
        name: enrollment.enrollment.name,
        status: enrollment.enrollment.status,
        createdAt: enrollment.enrollment.createdAt.toISOString(),
        updatedAt: enrollment.enrollment.updatedAt.toISOString(),
        recipientCount: enrollment.recipientCount,
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
    res.setHeader('x-odcrm-customer-id', customerId)
    res.json({ data: enrollments.map(toEnrollmentListItem) })
  } catch (err) {
    console.error('GET /api/enrollments error:', err)
    res.status(400).json({ error: 'An error occurred' })
  }
})

// ---------------------------------------------------------------------------
// Stage 2A: dry-run + audit (no send; tenant-safe; contract-aligned)
// ---------------------------------------------------------------------------

/** POST /api/enrollments/:enrollmentId/dry-run — plan what would be sent; persist audit events; no send */
router.post('/:enrollmentId/dry-run', async (req: Request, res: Response) => {
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

/** POST /api/enrollments/:enrollmentId/pause — set status to PAUSED (only when DRAFT or ACTIVE) */
router.post('/:enrollmentId/pause', async (req: Request, res: Response) => {
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
    if (count === 0) {
      const existing = await prisma.enrollment.findFirst({
        where: { id: enrollmentId, customerId },
        select: { status: true },
      })
      if (!existing) {
        res.status(404).json({ error: 'Enrollment not found' })
        return
      }
      res.status(400).json({ error: 'Enrollment can only be paused when status is DRAFT or ACTIVE', currentStatus: existing.status })
      return
    }
    const updated = await prisma.enrollment.findFirst({
      where: { id: enrollmentId, customerId },
      include: { _count: { select: { recipients: true } } },
    })
    if (!updated) {
      res.status(400).json({ error: 'An error occurred' })
      return
    }
    res.setHeader('x-odcrm-customer-id', customerId)
    res.json({ data: toEnrollmentListItem(updated) })
  } catch (err) {
    console.error('POST /api/enrollments/:enrollmentId/pause error:', err)
    res.status(400).json({ error: 'An error occurred' })
  }
})

/** POST /api/enrollments/:enrollmentId/resume — set status to ACTIVE (only when PAUSED) */
router.post('/:enrollmentId/resume', async (req: Request, res: Response) => {
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
    if (count === 0) {
      const existing = await prisma.enrollment.findFirst({
        where: { id: enrollmentId, customerId },
        select: { status: true },
      })
      if (!existing) {
        res.status(404).json({ error: 'Enrollment not found' })
        return
      }
      res.status(400).json({ error: 'Enrollment can only be resumed when status is PAUSED', currentStatus: existing.status })
      return
    }
    const updated = await prisma.enrollment.findFirst({
      where: { id: enrollmentId, customerId },
      include: { _count: { select: { recipients: true } } },
    })
    if (!updated) {
      res.status(400).json({ error: 'An error occurred' })
      return
    }
    res.setHeader('x-odcrm-customer-id', customerId)
    res.json({ data: toEnrollmentListItem(updated) })
  } catch (err) {
    console.error('POST /api/enrollments/:enrollmentId/resume error:', err)
    res.status(400).json({ error: 'An error occurred' })
  }
})

export default router
