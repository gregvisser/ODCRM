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
    const contacts = await prisma.contacts.findMany({
      where: { customerId },
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

// Bulk upsert contacts by (customerId, email)
router.post('/bulk-upsert', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const data = upsertInputSchema.parse(req.body)

    let created = 0
    let updated = 0

    for (const c of data.contacts) {
      const existing = await prisma.contacts.findFirst({
        where: { customerId, email: c.email },
        select: { id: true },
      })

      if (existing) {
        await prisma.contacts.update({
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
        await prisma.contacts.create({
          data: {
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

    const contacts = await prisma.contacts.findMany({
      where: { customerId, email: { in: data.contacts.map((c) => c.email) } },
      select: { id: true, email: true },
    })

    res.json({ created, updated, contacts })
  } catch (error) {
    next(error)
  }
})

export default router


