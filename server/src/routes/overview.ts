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

// GET /api/overview - Get overview stats for a customer
router.get('/', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)

    // Get total contacts (active only, deduped by email)
    const totalContacts = await prisma.contact.count({
      where: {
        customerId,
        status: 'active',
      },
    })

    // Get contacts breakdown by source (Cognism + Apollo + Social/Blackbook)
    const contactsBySourceResult = await prisma.contact.groupBy({
      by: ['source'],
      where: {
        customerId,
        status: 'active',
      },
      _count: {
        id: true,
      },
    })

    // Map source names (blackbook → social for display)
    const contactsBySource = contactsBySourceResult.reduce((acc, item) => {
      const sourceName = item.source === 'blackbook' ? 'social' : item.source
      acc[sourceName] = item._count.id
      return acc
    }, {} as Record<string, number>)

    // Get active sequences (sequences with at least one active enrollment) — use Prisma to avoid raw SQL identifier casing in Postgres
    let activeSequences = 0
    try {
      const activeEnrollments = await prisma.sequenceEnrollment.findMany({
        where: {
          status: 'active',
          sequence: { customerId },
        },
        select: { sequenceId: true },
        distinct: ['sequenceId'],
      })
      activeSequences = activeEnrollments.length
    } catch (err: any) {
      console.warn('[overview] activeSequences query failed:', err?.message || err)
    }

    // Get emails sent today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const emailsSentToday = await prisma.emailEvent.count({
      where: {
        type: 'sent',
        occurredAt: {
          gte: today,
          lt: tomorrow,
        },
        campaign: {
          customerId,
        },
      },
    })

    // Get per-employee stats (Prisma-only: no raw SQL)
    const weekStart = new Date(today)
    weekStart.setDate(weekStart.getDate() - 7)

    let employeeStats: Array<{
      employeeId: string
      employeeName: string
      emailAddress: string
      emailsSentToday: number
      emailsSentWeek: number
      repliesToday: number
      repliesWeek: number
    }> = []
    try {
      const identities = await prisma.emailIdentity.findMany({
        where: { customerId, isActive: true },
        select: { id: true, emailAddress: true, displayName: true },
      })
      const campaigns = await prisma.emailCampaign.findMany({
        where: { customerId },
        select: { id: true, senderIdentityId: true },
      })
      const campaignIds = campaigns.map(c => c.id)
      const campaignToIdentity = new Map(campaigns.map(c => [c.id, c.senderIdentityId]))

      const [sentTodayRows, sentWeekRows, repliesTodayRows, repliesWeekRows] = await Promise.all([
        campaignIds.length > 0
          ? prisma.emailEvent.findMany({
              where: {
                campaignId: { in: campaignIds },
                type: 'sent',
                occurredAt: { gte: today, lt: tomorrow },
              },
              select: { campaignId: true },
            })
          : [],
        campaignIds.length > 0
          ? prisma.emailEvent.findMany({
              where: {
                campaignId: { in: campaignIds },
                type: 'sent',
                occurredAt: { gte: weekStart },
              },
              select: { campaignId: true },
            })
          : [],
        campaignIds.length > 0
          ? prisma.emailEvent.findMany({
              where: {
                campaignId: { in: campaignIds },
                type: 'replied',
                occurredAt: { gte: today, lt: tomorrow },
              },
              select: { campaignId: true },
            })
          : [],
        campaignIds.length > 0
          ? prisma.emailEvent.findMany({
              where: {
                campaignId: { in: campaignIds },
                type: 'replied',
                occurredAt: { gte: weekStart },
              },
              select: { campaignId: true },
            })
          : [],
      ])

      const countByIdentity = (rows: { campaignId: string }[]) => {
        const m = new Map<string, number>()
        for (const r of rows) {
          const id = campaignToIdentity.get(r.campaignId)
          if (id) m.set(id, (m.get(id) ?? 0) + 1)
        }
        return m
      }
      const sentTodayByIdentity = countByIdentity(sentTodayRows)
      const sentWeekByIdentity = countByIdentity(sentWeekRows)
      const repliesTodayByIdentity = countByIdentity(repliesTodayRows)
      const repliesWeekByIdentity = countByIdentity(repliesWeekRows)

      employeeStats = identities.map(id => ({
        employeeId: id.id,
        employeeName: id.displayName || id.emailAddress.split('@')[0],
        emailAddress: id.emailAddress,
        emailsSentToday: sentTodayByIdentity.get(id.id) ?? 0,
        emailsSentWeek: sentWeekByIdentity.get(id.id) ?? 0,
        repliesToday: repliesTodayByIdentity.get(id.id) ?? 0,
        repliesWeek: repliesWeekByIdentity.get(id.id) ?? 0,
      })).sort((a, b) => b.emailsSentToday - a.emailsSentToday)
    } catch (err: any) {
      console.warn('[overview] employeeStats query failed:', err?.message || err)
    }

    res.setHeader('x-odcrm-customer-id', customerId)
    res.json({
      data: {
        customerId,
        totalContacts,
        contactsBySource,
        activeSequences,
        emailsSentToday,
        employeeStats,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    next(error)
  }
})

export default router