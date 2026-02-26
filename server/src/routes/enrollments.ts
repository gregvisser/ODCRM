/**
 * Stage 1A + 1B: Enrollment batch persistence (no sending).
 * - POST /api/sequences/:sequenceId/enrollments (mounted in sequences)
 * - GET /api/sequences/:sequenceId/enrollments (mounted in sequences)
 * - GET /api/enrollments (Stage 1B: list by customer, optional ?sequenceId= & ?status=)
 * - GET /api/enrollments/:enrollmentId
 * - POST /api/enrollments/:enrollmentId/pause (Stage 1B)
 * - POST /api/enrollments/:enrollmentId/resume (Stage 1B)
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
      where: { sequenceId },
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
  try {
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

/** POST /api/enrollments/:enrollmentId/pause — set status to PAUSED (only when PENDING or ACTIVE) */
router.post('/:enrollmentId/pause', async (req: Request, res: Response) => {
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
      select: { id: true, status: true, sequenceId: true, customerId: true, name: true, createdAt: true, updatedAt: true, _count: { select: { recipients: true } } },
    })
    if (!enrollment) {
      res.status(404).json({ error: 'Enrollment not found' })
      return
    }
    if (!PAUSABLE_STATUSES.includes(enrollment.status as EnrollmentStatus)) {
      res.status(400).json({ error: 'Enrollment can only be paused when status is DRAFT or ACTIVE', currentStatus: enrollment.status })
      return
    }
    const updated = await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { status: EnrollmentStatus.PAUSED },
      include: { _count: { select: { recipients: true } } },
    })
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
    const enrollment = await prisma.enrollment.findFirst({
      where: { id: enrollmentId, customerId },
      select: { id: true, status: true },
    })
    if (!enrollment) {
      res.status(404).json({ error: 'Enrollment not found' })
      return
    }
    if ((enrollment.status as EnrollmentStatus) !== RESUMABLE_STATUS) {
      res.status(400).json({ error: 'Enrollment can only be resumed when status is PAUSED', currentStatus: enrollment.status })
      return
    }
    const updated = await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { status: EnrollmentStatus.ACTIVE },
      include: { _count: { select: { recipients: true } } },
    })
    res.setHeader('x-odcrm-customer-id', customerId)
    res.json({ data: toEnrollmentListItem(updated) })
  } catch (err) {
    console.error('POST /api/enrollments/:enrollmentId/resume error:', err)
    res.status(400).json({ error: 'An error occurred' })
  }
})

export default router
