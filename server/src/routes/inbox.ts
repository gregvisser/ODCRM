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

const listRepliesSchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
  campaignId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
})

function parseRange(start?: string, end?: string) {
  const now = new Date()
  const endDate = end ? new Date(end) : now
  const startDate = start ? new Date(start) : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000)
  return { startDate, endDate }
}

// Reply.io-style “Inbox”: list prospects with detected replies
router.get('/replies', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { start, end, campaignId, limit } = listRepliesSchema.parse(req.query)
    const { startDate, endDate } = parseRange(start, end)

    const rows = await prisma.email_campaign_prospects.findMany({
      where: {
        email_campaigns: { customerId },
        ...(campaignId ? { campaignId } : {}),
        replyDetectedAt: { not: null, gte: startDate, lte: endDate },
      },
      include: {
        contacts: true,
        email_campaigns: {
          select: {
            id: true,
            name: true,
            email_identities: { select: { emailAddress: true, displayName: true } },
          },
        },
      },
      orderBy: { replyDetectedAt: 'desc' },
      take: limit || 100,
    })

    res.json({
      range: { start: startDate.toISOString(), end: endDate.toISOString() },
      items: rows.map((p) => ({
        prospectId: p.id,
        campaignId: p.campaignId,
        campaignName: p.email_campaigns?.name,
        senderEmail: p.email_campaigns?.email_identities?.emailAddress,
        senderName: p.email_campaigns?.email_identities?.displayName,
        contacts: {
          id: p.contacts.id,
          firstName: p.contacts.firstName,
          lastName: p.contacts.lastName,
          companyName: p.contacts.companyName,
          email: p.contacts.email,
        },
        replyDetectedAt: p.replyDetectedAt,
        replyCount: p.replyCount,
        lastReplySnippet: p.lastReplySnippet,
      })),
    })
  } catch (error) {
    next(error)
  }
})

export default router

