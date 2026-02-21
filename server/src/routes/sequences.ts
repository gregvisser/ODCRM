// @ts-nocheck
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const router = Router()

const getCustomerId = (req: any): string => {
  const customerId = (req.headers['x-customer-id'] as string) || (req.query.customerId as string)
  if (!customerId) {
    const err = new Error('customerId is required') as Error & { status?: number }
    err.status = 400
    throw err
  }
  return customerId
}

// Schema validation
const MAX_SEQUENCE_STEPS = 8

const createSequenceSchema = z.object({
  senderIdentityId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  steps: z.array(
    z.object({
      stepOrder: z.number().int().min(1).max(MAX_SEQUENCE_STEPS),
      delayDaysFromPrevious: z.number().int().min(0).default(0),
      subjectTemplate: z.string().min(1),
      bodyTemplateHtml: z.string().min(1),
      bodyTemplateText: z.string().optional(),
    })
  ).max(MAX_SEQUENCE_STEPS, `Maximum ${MAX_SEQUENCE_STEPS} steps allowed per sequence`).optional(),
})

const updateSequenceSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
})

const createStepSchema = z.object({
  stepOrder: z.number().int().min(1).max(MAX_SEQUENCE_STEPS),
  delayDaysFromPrevious: z.number().int().min(0).default(0),
  subjectTemplate: z.string().min(1),
  bodyTemplateHtml: z.string().min(1),
  bodyTemplateText: z.string().optional(),
})

// GET /api/sequences - Get all sequences for a customer
router.get('/', async (req, res) => {
  try {
    const customerId = getCustomerId(req)

    const sequences = await prisma.emailSequence.findMany({
      where: { customerId },
      include: {
        _count: {
          select: { steps: true },
        },
        senderIdentity: {
          select: {
            id: true,
            emailAddress: true,
            displayName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Transform to include stepCount
    const sequencesWithCount = sequences.map((seq) => ({
      id: seq.id,
      customerId: seq.customerId,
      senderIdentityId: seq.senderIdentityId,
      senderIdentity: seq.senderIdentity,
      name: seq.name,
      description: seq.description,
      stepCount: seq._count.steps,
      createdAt: seq.createdAt.toISOString(),
      updatedAt: seq.updatedAt.toISOString(),
    }))

    return res.json(sequencesWithCount)
  } catch (error) {
    console.error('Error fetching sequences:', error)
    return res.status(500).json({ error: 'Failed to fetch sequences' })
  }
})

// GET /api/sequences/:id - Get a single sequence with steps
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const sequence = await prisma.emailSequence.findFirst({
      where: { id, customerId: getCustomerId(req) },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
        },
        senderIdentity: {
          select: {
            id: true,
            emailAddress: true,
            displayName: true,
          },
        },
      },
    })

    if (!sequence) {
      return res.status(404).json({ error: 'Sequence not found' })
    }

    return res.json({
      id: sequence.id,
      customerId: sequence.customerId,
      senderIdentityId: sequence.senderIdentityId,
      senderIdentity: sequence.senderIdentity,
      name: sequence.name,
      description: sequence.description,
      createdAt: sequence.createdAt.toISOString(),
      updatedAt: sequence.updatedAt.toISOString(),
      steps: sequence.steps.map((step) => ({
        id: step.id,
        stepOrder: step.stepOrder,
        delayDaysFromPrevious: step.delayDaysFromPrevious,
        subjectTemplate: step.subjectTemplate,
        bodyTemplateHtml: step.bodyTemplateHtml,
        bodyTemplateText: step.bodyTemplateText,
        createdAt: step.createdAt.toISOString(),
        updatedAt: step.updatedAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('Error fetching sequence:', error)
    return res.status(500).json({ error: 'Failed to fetch sequence' })
  }
})

// POST /api/sequences - Create a new sequence (with optional steps)
router.post('/', async (req, res) => {
  try {
    const customerId = getCustomerId(req)
    const existingCustomer = await prisma.customer.findUnique({ where: { id: customerId } })
    if (!existingCustomer) {
      return res.status(400).json({ error: 'Invalid customer context' })
    }

    const validated = createSequenceSchema.parse(req.body)

    // Verify senderIdentityId belongs to customer
    const senderIdentity = await prisma.emailIdentity.findFirst({
      where: {
        id: validated.senderIdentityId,
        customerId,
        isActive: true,
      },
    })

    if (!senderIdentity) {
      return res.status(400).json({
        error: 'Invalid sender identity - must belong to customer and be active',
        field: 'senderIdentityId',
        value: validated.senderIdentityId,
      })
    }

    const sequence = await prisma.emailSequence.create({
      data: {
        id: `seq_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        customerId,
        senderIdentityId: validated.senderIdentityId,
        name: validated.name,
        description: validated.description,
        updatedAt: new Date(),
        steps: validated.steps
          ? {
              create: validated.steps.map((step) => ({
                id: `step_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                stepOrder: step.stepOrder,
                delayDaysFromPrevious: step.delayDaysFromPrevious,
                subjectTemplate: step.subjectTemplate,
                bodyTemplateHtml: step.bodyTemplateHtml,
                bodyTemplateText: step.bodyTemplateText,
                updatedAt: new Date(),
              })),
            }
          : undefined,
      },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
        },
        senderIdentity: {
          select: {
            id: true,
            emailAddress: true,
            displayName: true,
          },
        },
      },
    })

    return res.status(201).json({
      id: sequence.id,
      customerId: sequence.customerId,
      senderIdentityId: sequence.senderIdentityId,
      senderIdentity: sequence.senderIdentity,
      name: sequence.name,
      description: sequence.description,
      stepCount: sequence.steps.length,
      createdAt: sequence.createdAt.toISOString(),
      updatedAt: sequence.updatedAt.toISOString(),
      steps: sequence.steps.map((step) => ({
        id: step.id,
        stepOrder: step.stepOrder,
        delayDaysFromPrevious: step.delayDaysFromPrevious,
        subjectTemplate: step.subjectTemplate,
        bodyTemplateHtml: step.bodyTemplateHtml,
        bodyTemplateText: step.bodyTemplateText,
        createdAt: step.createdAt.toISOString(),
        updatedAt: step.updatedAt.toISOString(),
      })),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Format Zod errors into user-friendly messages
      const fieldErrors = error.errors.map(err => {
        const field = err.path.join('.')
        return `${field}: ${err.message}`
      }).join(', ')
      
      return res.status(400).json({ 
        error: `Invalid input: ${fieldErrors}`,
        validationErrors: error.errors,
        receivedFields: Object.keys(req.body),
      })
    }
    
    if (error instanceof Error && error.message === 'customerId is required') {
      return res.status(400).json({
        error: 'Customer ID is required (X-Customer-Id header)',
        details: 'Ensure X-Customer-Id header is sent with the request',
      })
    }
    console.error('[sequences] Error creating sequence:', error)
    return res.status(500).json({ error: 'Failed to create sequence' })
  }
})

// PUT /api/sequences/:id - Update a sequence (metadata only, not steps)
router.put('/:id', async (req, res) => {
  try {
    const customerId = getCustomerId(req)
    const { id } = req.params
    const validated = updateSequenceSchema.parse(req.body)

    const existing = await prisma.emailSequence.findFirst({
      where: { id, customerId },
    })
    if (!existing) {
      return res.status(404).json({ error: 'Sequence not found' })
    }

    const sequence = await prisma.emailSequence.update({
      where: { id },
      data: {
        name: validated.name ?? existing.name,
        description: validated.description !== undefined ? validated.description : existing.description,
        updatedAt: new Date(),
      },
      include: {
        _count: {
          select: { steps: true },
        },
      },
    })

    return res.json({
      id: sequence.id,
      customerId: sequence.customerId,
      name: sequence.name,
      description: sequence.description,
      stepCount: sequence._count.steps,
      createdAt: sequence.createdAt.toISOString(),
      updatedAt: sequence.updatedAt.toISOString(),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors })
    }
    console.error('Error updating sequence:', error)
    return res.status(500).json({ error: 'Failed to update sequence' })
  }
})

// DELETE /api/sequences/:id - Delete a sequence
router.delete('/:id', async (req, res) => {
  try {
    const customerId = getCustomerId(req)
    const { id } = req.params

    const existing = await prisma.emailSequence.findFirst({
      where: { id, customerId },
    })
    if (!existing) {
      return res.status(404).json({ error: 'Sequence not found' })
    }

    const campaignsUsingSequence = await prisma.emailCampaign.count({
      where: { sequenceId: id },
    })
    if (campaignsUsingSequence > 0) {
      return res.status(400).json({
        error: `Cannot delete sequence. It is used by ${campaignsUsingSequence} campaign(s).`,
      })
    }

    await prisma.emailSequence.delete({
      where: { id },
    })
    return res.json({ success: true })
  } catch (error) {
    console.error('Error deleting sequence:', error)
    return res.status(500).json({ error: 'Failed to delete sequence' })
  }
})

// POST /api/sequences/:id/steps - Add a step to a sequence
router.post('/:id/steps', async (req, res) => {
  try {
    const customerId = getCustomerId(req)
    const { id } = req.params
    const validated = createStepSchema.parse(req.body)

    const sequence = await prisma.emailSequence.findFirst({
      where: { id, customerId },
      include: {
        _count: {
          select: { steps: true },
        },
      },
    })
    if (!sequence) {
      return res.status(404).json({ error: 'Sequence not found' })
    }

    // Enforce max 8 steps per sequence
    if (sequence._count.steps >= MAX_SEQUENCE_STEPS) {
      return res.status(400).json({
        error: `Maximum ${MAX_SEQUENCE_STEPS} steps allowed per sequence`,
        currentSteps: sequence._count.steps,
        maxSteps: MAX_SEQUENCE_STEPS,
      })
    }

    // Check if stepOrder already exists
    const existingStep = await prisma.emailSequenceStep.findUnique({
      where: {
        sequenceId_stepOrder: {
          sequenceId: id,
          stepOrder: validated.stepOrder,
        },
      },
    })

    if (existingStep) {
      return res.status(400).json({ error: `Step ${validated.stepOrder} already exists` })
    }

    const step = await prisma.emailSequenceStep.create({ data: {
        id: `step_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        sequenceId: id,
        stepOrder: validated.stepOrder,
        delayDaysFromPrevious: validated.delayDaysFromPrevious,
        subjectTemplate: validated.subjectTemplate,
        bodyTemplateHtml: validated.bodyTemplateHtml,
        bodyTemplateText: validated.bodyTemplateText,
        updatedAt: new Date(),
      },
    })

    // Update sequence's updatedAt
    await prisma.emailSequence.update({
      where: { id },
      data: { updatedAt: new Date() },
    })

    return res.status(201).json({
      id: step.id,
      stepOrder: step.stepOrder,
      delayDaysFromPrevious: step.delayDaysFromPrevious,
      subjectTemplate: step.subjectTemplate,
      bodyTemplateHtml: step.bodyTemplateHtml,
      bodyTemplateText: step.bodyTemplateText,
      createdAt: step.createdAt.toISOString(),
      updatedAt: step.updatedAt.toISOString(),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors })
    }
    console.error('Error adding step:', error)
    return res.status(500).json({ error: 'Failed to add step' })
  }
})

// PUT /api/sequences/:id/steps/:stepId - Update a step
router.put('/:id/steps/:stepId', async (req, res) => {
  try {
    const customerId = getCustomerId(req)
    const { id, stepId } = req.params
    const validated = createStepSchema.partial().parse(req.body)

    const sequence = await prisma.emailSequence.findFirst({
      where: { id, customerId },
    })
    if (!sequence) {
      return res.status(404).json({ error: 'Sequence not found' })
    }

    const stepData: Record<string, unknown> = { updatedAt: new Date() }
    if (validated.stepOrder !== undefined) stepData.stepOrder = validated.stepOrder
    if (validated.delayDaysFromPrevious !== undefined) stepData.delayDaysFromPrevious = validated.delayDaysFromPrevious
    if (validated.subjectTemplate !== undefined) stepData.subjectTemplate = validated.subjectTemplate
    if (validated.bodyTemplateHtml !== undefined) stepData.bodyTemplateHtml = validated.bodyTemplateHtml
    if (validated.bodyTemplateText !== undefined) stepData.bodyTemplateText = validated.bodyTemplateText

    const step = await prisma.emailSequenceStep.update({
      where: { id: stepId, sequenceId: id },
      data: stepData as any,
    })

    await prisma.emailSequence.update({
      where: { id },
      data: { updatedAt: new Date() },
    })

    return res.json({
      id: step.id,
      stepOrder: step.stepOrder,
      delayDaysFromPrevious: step.delayDaysFromPrevious,
      subjectTemplate: step.subjectTemplate,
      bodyTemplateHtml: step.bodyTemplateHtml,
      bodyTemplateText: step.bodyTemplateText,
      createdAt: step.createdAt.toISOString(),
      updatedAt: step.updatedAt.toISOString(),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors })
    }
    console.error('Error updating step:', error)
    return res.status(500).json({ error: 'Failed to update step' })
  }
})

// DELETE /api/sequences/:id/steps/:stepId - Delete a step
router.delete('/:id/steps/:stepId', async (req, res) => {
  try {
    const customerId = getCustomerId(req)
    const { id, stepId } = req.params

    const sequence = await prisma.emailSequence.findFirst({
      where: { id, customerId },
    })
    if (!sequence) {
      return res.status(404).json({ error: 'Sequence not found' })
    }

    await prisma.emailSequenceStep.deleteMany({
      where: { id: stepId, sequenceId: id },
    })
    await prisma.emailSequence.update({
      where: { id },
      data: { updatedAt: new Date() },
    })
    return res.json({ success: true })
  } catch (error) {
    console.error('Error deleting step:', error)
    return res.status(500).json({ error: 'Failed to delete step' })
  }
})

// POST /api/sequences/:id/enroll - Enroll contacts in a sequence
router.post('/:id/enroll', async (req, res) => {
  try {
    const { id } = req.params
    const { contactIds } = req.body
    const customerId = getCustomerId(req)

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({ error: 'contactIds must be a non-empty array' })
    }

    // Verify sequence exists and belongs to customer
    const sequence = await prisma.emailSequence.findFirst({
      where: {
        id,
        customerId,
      },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
        },
      },
    })

    if (!sequence) {
      return res.status(404).json({ error: 'Sequence not found' })
    }

    // Verify all contacts belong to customer
    const contacts = await prisma.contact.findMany({
      where: {
        id: { in: contactIds },
        customerId,
      },
      select: {
        id: true,
        email: true,
      },
    })

    if (contacts.length !== contactIds.length) {
      return res.status(400).json({ error: 'Some contacts not found or do not belong to customer' })
    }

    // Check for suppressed emails
    const contactEmails = contacts.map(c => c.email).filter(Boolean)
    const suppressedEmails = await prisma.suppressionEntry.findMany({
      where: {
        customerId,
        OR: [
          {
            type: 'email',
            emailNormalized: { in: contactEmails.map(e => e!.toLowerCase().trim()) },
          },
          {
            type: 'domain',
            value: {
              in: contactEmails.map(e => e!.split('@')[1]).filter(Boolean),
            },
          },
        ],
      },
      select: {
        type: true,
        value: true,
        reason: true,
      },
    })

    const suppressedContacts = new Set<string>()
    const suppressionDetails: Array<{ contactId: string; email: string; reason: string }> = []

    for (const contact of contacts) {
      if (!contact.email) continue

      const normalizedEmail = contact.email.toLowerCase().trim()
      const domain = contact.email.split('@')[1]

      // Check email suppression
      const emailSuppressed = suppressedEmails.find(
        s => s.type === 'email' && s.value === normalizedEmail
      )

      // Check domain suppression
      const domainSuppressed = suppressedEmails.find(
        s => s.type === 'domain' && s.value === domain
      )

      if (emailSuppressed || domainSuppressed) {
        suppressedContacts.add(contact.id)
        suppressionDetails.push({
          contactId: contact.id,
          email: contact.email,
          reason: emailSuppressed?.reason || domainSuppressed?.reason || 'Suppressed',
        })
      }
    }

    const validContactIds = contactIds.filter(id => !suppressedContacts.has(id))

    // Get first step for scheduling
    const firstStep = sequence.steps[0]
    const nextStepScheduledAt = firstStep
      ? new Date(Date.now() + (firstStep.delayDaysFromPrevious || 0) * 24 * 60 * 60 * 1000)
      : new Date()

    // Check existing enrollments among valid contacts
    const existing = await prisma.sequenceEnrollment.findMany({
      where: {
        sequenceId: id,
        contactId: { in: validContactIds },
      },
      select: { contactId: true },
    })

    const existingContactIds = new Set(existing.map(e => e.contactId))
    const newContactIds = validContactIds.filter(cid => !existingContactIds.has(cid))

    // Create enrollments
    if (newContactIds.length > 0) {
      await prisma.sequenceEnrollment.createMany({
        data: newContactIds.map(contactId => ({
          id: `enroll_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          sequenceId: id,
          contactId,
          status: 'active',
          nextStepScheduledAt,
          enrolledAt: new Date(),
        })),
      })
    }

    // Update sequence enrollment count
    await prisma.emailSequence.update({
      where: { id },
      data: {
        // Note: This would ideally be calculated, but for now we'll update it
      },
    })

    res.json({
      enrolled: newContactIds.length,
      skipped: existingContactIds.size,
      suppressed: suppressionDetails.length,
      total: contactIds.length,
      suppressionDetails: suppressionDetails.length > 0 ? suppressionDetails : undefined,
    })
  } catch (error) {
    console.error('Error enrolling contacts:', error)
    return res.status(500).json({ error: 'Failed to enroll contacts' })
  }
})

export default router
