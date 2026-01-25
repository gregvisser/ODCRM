import express from 'express'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { prisma } from '../lib/prisma.js'

const router = express.Router()

const getCustomerId = (req: express.Request): string => {
  const customerId = (req.headers['x-customer-id'] as string) || (req.query.customerId as string)
  if (!customerId) {
    const err = new Error('Customer ID required') as Error & { status?: number }
    err.status = 400
    throw err
  }
  return customerId
}

const createSchema = z.object({
  type: z.enum(['domain', 'email']),
  value: z.string().min(1),
  reason: z.string().optional(),
  source: z.string().optional(),
})

const isValidDomain = (value: string) => {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed || trimmed.includes('@')) return false
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return false
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(trimmed)
}

router.get('/', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const type = req.query.type as string | undefined
    const q = (req.query.q as string | undefined)?.trim().toLowerCase()

    const where: any = { customerId }
    if (type === 'domain' || type === 'email') {
      where.type = type
    }
    if (q) {
      where.value = { contains: q, mode: 'insensitive' }
    }

    const entries = await prisma.suppressionEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    res.json(entries)
  } catch (error) {
    next(error)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const data = createSchema.parse(req.body)
    const value = data.value.trim().toLowerCase()

    if (data.type === 'domain' && !isValidDomain(value)) {
      return res.status(400).json({ error: 'Invalid domain format' })
    }
    if (data.type === 'email' && !z.string().email().safeParse(value).success) {
      return res.status(400).json({ error: 'Invalid email format' })
    }

    const entry = await prisma.suppressionEntry.upsert({
      where: {
        customerId_type_value: {
          customerId,
          type: data.type,
          value,
        },
      },
      update: {
        reason: data.reason || null,
        source: data.source || null,
      },
      create: {
        id: randomUUID(),
        customerId,
        type: data.type,
        value,
        reason: data.reason || null,
        source: data.source || 'manual',
      },
    })

    res.status(201).json(entry)
  } catch (error) {
    next(error)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { id } = req.params

    const existing = await prisma.suppressionEntry.findFirst({
      where: { id, customerId },
      select: { id: true },
    })
    if (!existing) {
      return res.status(404).json({ error: 'Suppression entry not found' })
    }

    await prisma.suppressionEntry.delete({ where: { id } })
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

export default router
