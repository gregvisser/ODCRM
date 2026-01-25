import express from 'express'
import { prisma } from '../lib/prisma.js'
import { z } from 'zod'
import { randomUUID } from 'crypto'

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

// List contacts for customer
router.get('/', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const source = req.query.source as string | undefined
    const contacts = await prisma.contact.findMany({
      where: {
        customerId,
        ...(source ? { source } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    })
    res.json(contacts)
  } catch (error) {
    next(error)
  }
})

const upsertInputSchema = z.object({
  contacts: z.array(
    z.object({
      firstName: z.string().default(''),
      lastName: z.string().default(''),
      jobTitle: z.string().optional(),
      companyName: z.string().min(1),
      email: z.string().email(),
      phone: z.string().optional(),
      source: z.string().optional().default('cognism'),
    })
  ),
})

const createContactSchema = z.object({
  firstName: z.string().default(''),
  lastName: z.string().default(''),
  jobTitle: z.string().optional(),
  companyName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  source: z.string().optional().default('manual'),
})

// Create a single contact
router.post('/', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const data = createContactSchema.parse(req.body)

    const existing = await prisma.contact.findFirst({
      where: { customerId, email: data.email },
      select: { id: true },
    })

    if (existing) {
      return res.status(409).json({ error: 'Contact already exists for this email.' })
    }

    const contact = await prisma.contact.create({
      data: {
        id: randomUUID(),
        customerId,
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        jobTitle: data.jobTitle || null,
        companyName: data.companyName,
        email: data.email,
        phone: data.phone || null,
        source: data.source || 'manual',
        updatedAt: new Date(),
      },
    })

    res.status(201).json(contact)
  } catch (error) {
    next(error)
  }
})

// Update a contact
router.put('/:id', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const data = createContactSchema.partial().parse(req.body)

    const existing = await prisma.contact.findFirst({
      where: { id: req.params.id, customerId },
      select: { id: true },
    })

    if (!existing) {
      return res.status(404).json({ error: 'Contact not found' })
    }

    const contact = await prisma.contact.update({
      where: { id: req.params.id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    })

    res.json(contact)
  } catch (error) {
    next(error)
  }
})

// Delete a contact
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.contact.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

// Bulk upsert contacts by (customerId, email)
router.post('/bulk-upsert', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const data = upsertInputSchema.parse(req.body)

    let created = 0
    let updated = 0

    for (const c of data.contacts) {
      const existing = await prisma.contact.findFirst({
        where: { customerId, email: c.email },
        select: { id: true },
      })

      if (existing) {
        await prisma.contact.update({
          where: { id: existing.id },
          data: {
            firstName: c.firstName || '',
            lastName: c.lastName || '',
            jobTitle: c.jobTitle || null,
            companyName: c.companyName,
            phone: c.phone || null,
            source: c.source || 'cognism',
            updatedAt: new Date(),
          },
        })
        updated++
      } else {
        await prisma.contact.create({ data: {
            id: randomUUID(),
            customerId,
            firstName: c.firstName || '',
            lastName: c.lastName || '',
            jobTitle: c.jobTitle || null,
            companyName: c.companyName,
            email: c.email,
            phone: c.phone || null,
            source: c.source || 'cognism',
            updatedAt: new Date(),
          },
        })
        created++
      }
    }

    const contacts = await prisma.contact.findMany({
      where: { customerId, email: { in: data.contacts.map((c) => c.email) } },
      select: { id: true, email: true },
    })

    res.json({ created, updated, contacts })
  } catch (error) {
    next(error)
  }
})

// Delete contacts by source (e.g., cognism imports)
router.delete('/by-source', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const source = req.query.source as string | undefined
    if (!source) return res.status(400).json({ error: 'source is required' })

    const result = await prisma.contact.deleteMany({
      where: { customerId, source },
    })
    res.json({ deleted: result.count })
  } catch (error) {
    next(error)
  }
})

export default router


