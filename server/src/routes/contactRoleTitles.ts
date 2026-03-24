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
    const rows = await prisma.contactRoleTitle.findMany({
      orderBy: { label: 'asc' },
    })
    return res.json(rows)
  } catch (error) {
    console.error('Error fetching contact role titles:', error)
    return res.status(500).json({ error: 'Failed to fetch contact role titles' })
  }
})

router.post('/', async (req, res) => {
  try {
    const validated = createSchema.parse(req.body)
    const normalizedLabel = normalizeTaxonomyLabel(validated.label)
    if (!normalizedLabel) {
      return res.status(400).json({ error: 'Invalid input', details: [{ message: 'label is empty after normalization' }] })
    }

    const existing = await prisma.contactRoleTitle.findFirst({
      where: { label: { equals: normalizedLabel, mode: 'insensitive' } },
    })

    if (existing) {
      return res.json(existing)
    }

    const row = await prisma.contactRoleTitle.create({
      data: {
        id: `crtitle_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        label: normalizedLabel,
      },
    })

    return res.status(201).json(row)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors })
    }
    console.error('Error creating contact role title:', error)
    return res.status(500).json({ error: 'Failed to create contact role title' })
  }
})

export default router
