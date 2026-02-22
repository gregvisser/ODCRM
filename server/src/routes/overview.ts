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

    // Get per-employee stats for today and this week
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
      // Raw SQL: quote mixed-case column names for Postgres (unquoted identifiers are lowercased)
      const employeeStatsResult = await prisma.$queryRaw<
        Array<{
          senderIdentityId: string
          emailAddress: string
          displayName: string | null
          emailsSentToday: number
          emailsSentWeek: number
          repliesToday: number
          repliesWeek: number
        }>
      >`
      SELECT
        ei.id as "senderIdentityId",
        ei."emailAddress",
        ei."displayName",
        COALESCE(sent_today.count, 0)::int as "emailsSentToday",
        COALESCE(sent_week.count, 0)::int as "emailsSentWeek",
        COALESCE(replies_today.count, 0)::int as "repliesToday",
        COALESCE(replies_week.count, 0)::int as "repliesWeek"
      FROM email_identities ei
      LEFT JOIN (
        SELECT ee."campaignId", COUNT(*) as count
        FROM email_events ee
        WHERE ee.type = 'sent'
          AND ee."occurredAt" >= ${today}
          AND ee."occurredAt" < ${tomorrow}
        GROUP BY ee."campaignId"
      ) sent_today ON sent_today."campaignId" IN (
        SELECT ec.id FROM email_campaigns ec WHERE ec."senderIdentityId" = ei.id
      )
      LEFT JOIN (
        SELECT ee."campaignId", COUNT(*) as count
        FROM email_events ee
        WHERE ee.type = 'sent'
          AND ee."occurredAt" >= ${weekStart}
        GROUP BY ee."campaignId"
      ) sent_week ON sent_week."campaignId" IN (
        SELECT ec.id FROM email_campaigns ec WHERE ec."senderIdentityId" = ei.id
      )
      LEFT JOIN (
        SELECT ee."campaignId", COUNT(*) as count
        FROM email_events ee
        WHERE ee.type = 'replied'
          AND ee."occurredAt" >= ${today}
          AND ee."occurredAt" < ${tomorrow}
        GROUP BY ee."campaignId"
      ) replies_today ON replies_today."campaignId" IN (
        SELECT ec.id FROM email_campaigns ec WHERE ec."senderIdentityId" = ei.id
      )
      LEFT JOIN (
        SELECT ee."campaignId", COUNT(*) as count
        FROM email_events ee
        WHERE ee.type = 'replied'
          AND ee."occurredAt" >= ${weekStart}
        GROUP BY ee."campaignId"
      ) replies_week ON replies_week."campaignId" IN (
        SELECT ec.id FROM email_campaigns ec WHERE ec."senderIdentityId" = ei.id
      )
      WHERE ei."customerId" = ${customerId}
        AND ei."isActive" = true
      ORDER BY "emailsSentToday" DESC
      `
      employeeStats = employeeStatsResult.map(stat => ({
        employeeId: stat.senderIdentityId,
        employeeName: stat.displayName || stat.emailAddress.split('@')[0],
        emailAddress: stat.emailAddress,
        emailsSentToday: Number(stat.emailsSentToday),
        emailsSentWeek: Number(stat.emailsSentWeek),
        repliesToday: Number(stat.repliesToday),
        repliesWeek: Number(stat.repliesWeek),
      }))
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