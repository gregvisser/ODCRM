// @ts-nocheck
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const router = Router()

// Schema validation
const createSequenceSchema = z.object({
  customerId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  steps: z.array(
    z.object({
      stepOrder: z.number().int().min(1),
      delayDaysFromPrevious: z.number().int().min(0).default(0),
      subjectTemplate: z.string().min(1),
      bodyTemplateHtml: z.string().min(1),
      bodyTemplateText: z.string().optional(),
    })
  ).optional(),
})

const updateSequenceSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
})

const createStepSchema = z.object({
  stepOrder: z.number().int().min(1),
  delayDaysFromPrevious: z.number().int().min(0).default(0),
  subjectTemplate: z.string().min(1),
  bodyTemplateHtml: z.string().min(1),
  bodyTemplateText: z.string().optional(),
})

// GET /api/sequences - Get all sequences for a customer
router.get('/', async (req, res) => {
  try {
    const { customerId } = req.query

    if (!customerId || typeof customerId !== 'string') {
      return res.status(400).json({ error: 'customerId is required' })
    }

    const sequences = await prisma.email_sequences.findMany({
      where: { customerId },
      include: {
        _count: {
          select: { steps: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Transform to include stepCount
    const sequencesWithCount = sequences.map((seq) => ({
      id: seq.id,
      customerId: seq.customerId,
      name: seq.name,
      description: seq.description,
      stepCount: seq._count.email_sequence_steps,
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

    const sequence = await prisma.email_sequences.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
        },
      },
    })

    if (!sequence) {
      return res.status(404).json({ error: 'Sequence not found' })
    }

    return res.json({
      id: sequence.id,
      customerId: sequence.customerId,
      name: sequence.name,
      description: sequence.description,
      createdAt: sequence.createdAt.toISOString(),
      updatedAt: sequence.updatedAt.toISOString(),
      steps: sequence.steps_data.map((step) => ({
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
    const validated = createSequenceSchema.parse(req.body)

    const sequence = await prisma.email_sequences.create({ data: {
        id: `seq_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        customerId: validated.customerId,
        name: validated.name,
        description: validated.description,
        updatedAt: new Date(),
        steps: validated.email_sequence_steps
          ? {
              create: validated.email_sequence_steps.map((step) => ({
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
      },
    })

    return res.status(201).json({
      id: sequence.id,
      customerId: sequence.customerId,
      name: sequence.name,
      description: sequence.description,
      stepCount: sequence.steps_data.length,
      createdAt: sequence.createdAt.toISOString(),
      updatedAt: sequence.updatedAt.toISOString(),
      steps: sequence.steps_data.map((step) => ({
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
      return res.status(400).json({ error: 'Invalid input', details: error.errors })
    }
    console.error('Error creating sequence:', error)
    return res.status(500).json({ error: 'Failed to create sequence' })
  }
})

// PUT /api/sequences/:id - Update a sequence (metadata only, not steps)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const validated = updateSequenceSchema.parse(req.body)

    const sequence = await prisma.email_sequences.update({
      where: { id },
      data: {
        ...validated,
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
      stepCount: sequence._count.email_sequence_steps,
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
    const { id } = req.params

    // Check if sequence is used by any campaigns
    const campaignsUsingSequence = await prisma.email_campaigns.count({
      where: { sequenceId: id },
    })

    if (campaignsUsingSequence > 0) {
      return res.status(400).json({
        error: `Cannot delete sequence. It is used by ${campaignsUsingSequence} campaign(s).`,
      })
    }

    await prisma.email_sequences.delete({
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
    const { id } = req.params
    const validated = createStepSchema.parse(req.body)

    // Verify sequence exists
    const sequence = await prisma.email_sequences.findUnique({ where: { id } })
    if (!sequence) {
      return res.status(404).json({ error: 'Sequence not found' })
    }

    // Check if stepOrder already exists
    const existingStep = await prisma.email_sequence_steps.findUnique({
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

    const step = await prisma.email_sequence_steps.create({ data: {
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
    await prisma.email_sequences.update({
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
    const { id, stepId } = req.params
    const validated = createStepSchema.partial().parse(req.body)

    const step = await prisma.email_sequence_steps.update({
      where: { id: stepId },
      data: {
        ...validated,
        updatedAt: new Date(),
      },
    })

    // Update sequence's updatedAt
    await prisma.email_sequences.update({
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
    const { id, stepId } = req.params

    await prisma.email_sequence_steps.delete({
      where: { id: stepId },
    })

    // Update sequence's updatedAt
    await prisma.email_sequences.update({
      where: { id },
      data: { updatedAt: new Date() },
    })

    return res.json({ success: true })
  } catch (error) {
    console.error('Error deleting step:', error)
    return res.status(500).json({ error: 'Failed to delete step' })
  }
})

export default router
