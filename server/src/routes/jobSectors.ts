import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const router = Router()

const createSchema = z.object({
  label: z.string().min(1),
})

router.get('/', async (_req, res) => {
  try {
    const sectors = await prisma.jobSector.findMany({
      orderBy: { label: 'asc' },
    })
    return res.json(sectors)
  } catch (error) {
    console.error('Error fetching job sectors:', error)
    return res.status(500).json({ error: 'Failed to fetch job sectors' })
  }
})

router.post('/', async (req, res) => {
  try {
    const validated = createSchema.parse(req.body)
    const normalizedLabel = validated.label.trim()

    const existing = await prisma.jobSector.findFirst({
      where: { label: { equals: normalizedLabel, mode: 'insensitive' } },
    })

    if (existing) {
      return res.json(existing)
    }

    const sector = await prisma.jobSector.create({
      data: {
        id: `sector_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        label: normalizedLabel,
      },
    })

    return res.status(201).json(sector)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors })
    }
    console.error('Error creating job sector:', error)
    return res.status(500).json({ error: 'Failed to create job sector' })
  }
})

export default router
