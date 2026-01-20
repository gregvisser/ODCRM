// @ts-nocheck
import { Router } from 'express'
import { prisma } from '../lib/prisma.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const queryCustomerId = req.query.customerId as string | undefined
    const headerCustomerId = req.header('x-customer-id') || undefined
    let customerId = queryCustomerId

    if (!customerId && headerCustomerId) {
      const exists = await prisma.customer.findUnique({
        where: { id: headerCustomerId },
        select: { id: true },
      })
      if (exists) {
        customerId = headerCustomerId
      }
    }
    const since = req.query.since ? new Date(String(req.query.since)) : null

    const where: any = {}
    if (customerId) {
      where.customerId = customerId
    }
    if (since && !isNaN(since.getTime())) {
      where.updatedAt = { gte: since }
    }

    const leadRows = await prisma.leadRecord.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    })

    let lastSyncAt: Date | null = null
    if (customerId) {
      const state = await prisma.leadSyncState.findUnique({ where: { customerId } })
      lastSyncAt = state?.lastSuccessAt || state?.lastSyncAt || null
    } else {
      const latest = await prisma.leadSyncState.findFirst({
        orderBy: { lastSuccessAt: 'desc' },
      })
      lastSyncAt = latest?.lastSuccessAt || latest?.lastSyncAt || null
    }

    const leads = leadRows.map((lead) => ({
      ...(lead.data || {}),
      accountName: lead.accountName,
      customerId: lead.customerId,
    }))

    return res.json({
      leads,
      lastSyncAt: lastSyncAt ? lastSyncAt.toISOString() : null,
    })
  } catch (error) {
    console.error('Error fetching leads:', error)
    return res.status(500).json({ error: 'Failed to fetch leads' })
  }
})

export default router
