import express from 'express'
import { prisma } from '../lib/prisma.js'
import { z } from 'zod'

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

const scheduleSchema = z.object({
  name: z.string().min(1).max(80),
  timezone: z.string().min(1).max(80).default('UTC'),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  startHour: z.number().int().min(0).max(23),
  endHour: z.number().int().min(0).max(23),
})

async function ensureDefaultSchedule(customerId: string) {
  const existing = await prisma.emailSendSchedule.findFirst({
    where: { customerId },
    orderBy: { createdAt: 'asc' },
  })
  if (existing) return existing
  return prisma.emailSendSchedule.create({
    data: {
      customerId,
      name: 'Default',
      timezone: 'UTC',
      daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
      startHour: 9,
      endHour: 17,
    },
  })
}

// List schedules
router.get('/', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    await ensureDefaultSchedule(customerId)
    const schedules = await prisma.emailSendSchedule.findMany({
      where: { customerId },
      orderBy: { createdAt: 'asc' },
    })
    res.json(schedules)
  } catch (error) {
    next(error)
  }
})

// Create schedule
router.post('/', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const data = scheduleSchema.parse(req.body)
    if (data.startHour === data.endHour) {
      return res.status(400).json({ error: 'startHour and endHour cannot be the same' })
    }

    const created = await prisma.emailSendSchedule.create({
      data: { ...data, customerId } as any,
    })
    res.json(created)
  } catch (error) {
    next(error)
  }
})

// Update schedule
router.patch('/:id', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { id } = req.params
    const data = scheduleSchema.partial().parse(req.body)

    const existing = await prisma.emailSendSchedule.findFirst({ where: { id, customerId } })
    if (!existing) return res.status(404).json({ error: 'Schedule not found' })

    if (data.startHour !== undefined && data.endHour !== undefined && data.startHour === data.endHour) {
      return res.status(400).json({ error: 'startHour and endHour cannot be the same' })
    }

    const updated = await prisma.emailSendSchedule.update({
      where: { id },
      data,
    })
    res.json(updated)
  } catch (error) {
    next(error)
  }
})

// Delete schedule
router.delete('/:id', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { id } = req.params

    const existing = await prisma.emailSendSchedule.findFirst({ where: { id, customerId } })
    if (!existing) return res.status(404).json({ error: 'Schedule not found' })

    // Set scheduleId null on any campaigns using it (safety).
    await prisma.email_campaigns.updateMany({
      where: { customerId, // sendScheduleId: id },
      data: { // sendScheduleId: null },
    })

    await prisma.emailSendSchedule.delete({ where: { id } })
    res.json({ message: 'Schedule deleted' })
  } catch (error) {
    next(error)
  }
})

export default router

