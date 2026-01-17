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

const dateRangeSchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
})

function parseRange(input: z.infer<typeof dateRangeSchema>) {
  const now = new Date()
  const end = input.end ? new Date(input.end) : now
  const start = input.start ? new Date(input.start) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)
  return { start, end }
}

// Email events summary (Reply.io-style “Reports → Emails”)
router.get('/emails', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { start, end } = parseRange(dateRangeSchema.parse(req.query))

    // Totals by type in range
    const byType = await prisma.emailEvent.groupBy({
      by: ['type'],
      where: {
        occurredAt: { gte: start, lte: end },
        campaign: { customerId },
      },
      _count: { _all: true },
    })

    const totals = byType.reduce<Record<string, number>>((acc, row) => {
      acc[row.type] = row._count._all
      return acc
    }, {})

    // By campaign + type
    const byCampaignType = await prisma.emailEvent.groupBy({
      by: ['campaignId', 'type'],
      where: {
        occurredAt: { gte: start, lte: end },
        campaign: { customerId },
      },
      _count: { _all: true },
    })

    const campaignIds = Array.from(new Set(byCampaignType.map((r) => r.campaignId)))
    const campaigns = campaignIds.length
      ? await prisma.emailCampaign.findMany({
          where: { id: { in: campaignIds }, customerId },
          select: {
            id: true,
            name: true,
            senderIdentity: { select: { id: true, emailAddress: true, displayName: true } },
          },
        })
      : []

    const campaignMap = new Map(campaigns.map((c) => [c.id, c]))

    const byCampaign = campaignIds
      .map((id) => {
        const rows = byCampaignType.filter((r) => r.campaignId === id)
        const counts = rows.reduce<Record<string, number>>((acc, r) => {
          acc[r.type] = r._count._all
          return acc
        }, {})
        const c = campaignMap.get(id)
        return {
          campaignId: id,
          campaignName: c?.name || '(unknown)',
          senderIdentity: c?.senderIdentity || null,
          counts,
        }
      })
      .sort((a, b) => (b.counts.sent || 0) - (a.counts.sent || 0))

    res.json({
      range: { start: start.toISOString(), end: end.toISOString() },
      totals,
      byCampaign,
    })
  } catch (error) {
    next(error)
  }
})

// Team performance (Reply.io-style “Reports → Team Performance”)
router.get('/team-performance', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { start, end } = parseRange(dateRangeSchema.parse(req.query))

    // Count sent/replied grouped by sender identity via campaigns.
    const sentByCampaign = await prisma.emailEvent.groupBy({
      by: ['campaignId'],
      where: {
        occurredAt: { gte: start, lte: end },
        type: 'sent',
        campaign: { customerId },
      },
      _count: { _all: true },
    })

    const repliedByCampaign = await prisma.emailEvent.groupBy({
      by: ['campaignId'],
      where: {
        occurredAt: { gte: start, lte: end },
        type: 'replied',
        campaign: { customerId },
      },
      _count: { _all: true },
    })

    const campaignIds = Array.from(new Set([...sentByCampaign.map((r) => r.campaignId), ...repliedByCampaign.map((r) => r.campaignId)]))
    const campaigns = campaignIds.length
      ? await prisma.emailCampaign.findMany({
          where: { id: { in: campaignIds }, customerId },
          select: {
            id: true,
            senderIdentity: { select: { id: true, emailAddress: true, displayName: true } },
          },
        })
      : []

    const sentMap = new Map(sentByCampaign.map((r) => [r.campaignId, r._count._all]))
    const replyMap = new Map(repliedByCampaign.map((r) => [r.campaignId, r._count._all]))

    const byIdentity = new Map<
      string,
      { identityId: string; emailAddress: string; displayName?: string; sent: number; replied: number }
    >()

    for (const c of campaigns) {
      const identity = c.senderIdentity
      const key = identity.id
      const prev = byIdentity.get(key) || {
        identityId: identity.id,
        emailAddress: identity.emailAddress,
        displayName: identity.displayName || undefined,
        sent: 0,
        replied: 0,
      }
      prev.sent += sentMap.get(c.id) || 0
      prev.replied += replyMap.get(c.id) || 0
      byIdentity.set(key, prev)
    }

    const rows = Array.from(byIdentity.values())
      .map((r) => ({
        ...r,
        replyRate: r.sent > 0 ? (r.replied / r.sent) * 100 : 0,
      }))
      .sort((a, b) => b.sent - a.sent)

    res.json({
      range: { start: start.toISOString(), end: end.toISOString() },
      rows,
    })
  } catch (error) {
    next(error)
  }
})

export default router

