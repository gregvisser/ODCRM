import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { normalizeTaxonomyLabel } from '../utils/taxonomyLabel.js'

const router = Router()

const createSchema = z.object({
  label: z.string().min(1),
})

router.get('/', async (_req, res) => {
  try {
    const sectors = await prisma.industrySector.findMany({
      orderBy: { label: 'asc' },
    })
    return res.json(sectors)
  } catch (error) {
    console.error('Error fetching industry sectors:', error)
    return res.status(500).json({ error: 'Failed to fetch industry sectors' })
  }
})

router.post('/', async (req, res) => {
  try {
    const validated = createSchema.parse(req.body)
    const normalizedLabel = normalizeTaxonomyLabel(validated.label)
    if (!normalizedLabel) {
      return res.status(400).json({ error: 'Invalid input', details: [{ message: 'label is empty after normalization' }] })
    }

    const existing = await prisma.industrySector.findFirst({
      where: { label: { equals: normalizedLabel, mode: 'insensitive' } },
    })

    if (existing) {
      return res.json(existing)
    }

    const sector = await prisma.industrySector.create({
      data: {
        id: `industry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        label: normalizedLabel,
      },
    })

    return res.status(201).json(sector)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors })
    }
    console.error('Error creating industry sector:', error)
    return res.status(500).json({ error: 'Failed to create industry sector' })
  }
})

export default router
