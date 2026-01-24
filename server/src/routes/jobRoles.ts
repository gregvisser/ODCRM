import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const router = Router()

const createSchema = z.object({
  label: z.string().min(1),
})

router.get('/', async (_req, res) => {
  try {
    const roles = await prisma.jobRole.findMany({
      orderBy: { label: 'asc' },
    })
    return res.json(roles)
  } catch (error) {
    console.error('Error fetching job roles:', error)
    return res.status(500).json({ error: 'Failed to fetch job roles' })
  }
})

router.post('/', async (req, res) => {
  try {
    const validated = createSchema.parse(req.body)
    const normalizedLabel = validated.label.trim()

    const existing = await prisma.jobRole.findFirst({
      where: { label: { equals: normalizedLabel, mode: 'insensitive' } },
    })

    if (existing) {
      return res.json(existing)
    }

    const role = await prisma.jobRole.create({
      data: {
        id: `role_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        label: normalizedLabel,
      },
    })

    return res.status(201).json(role)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors })
    }
    console.error('Error creating job role:', error)
    return res.status(500).json({ error: 'Failed to create job role' })
  }
})

export default router
