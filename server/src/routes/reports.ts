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

// GET /api/reports/customer?customerId=X&dateRange=today|week|month
router.get('/customer', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const dateRange = (req.query.dateRange as string) || 'today'

    // Calculate date range (UTC)
    const now = new Date()
    let startDate: Date
    let endDate: Date = new Date(now)

    switch (dateRange) {
      case 'today':
        startDate = new Date(now)
        startDate.setUTCHours(0, 0, 0, 0)
        endDate.setUTCHours(23, 59, 59, 999)
        break
      case 'week':
        startDate = new Date(now)
        startDate.setUTCDate(startDate.getUTCDate() - 7)
        startDate.setUTCHours(0, 0, 0, 0)
        endDate.setUTCHours(23, 59, 59, 999)
        break
      case 'month':
        startDate = new Date(now)
        startDate.setUTCMonth(startDate.getUTCMonth() - 1)
        startDate.setUTCHours(0, 0, 0, 0)
        endDate.setUTCHours(23, 59, 59, 999)
        break
      default:
        startDate = new Date(now)
        startDate.setUTCHours(0, 0, 0, 0)
        endDate.setUTCHours(23, 59, 59, 999)
    }

    // Get all event counts for the customer and date range
    const eventCounts = await prisma.emailEvent.groupBy({
      by: ['type'],
      where: {
        customerId,
        occurredAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: {
        id: true,
      },
    })

    // Convert to a map for easy access
    const counts: Record<string, number> = {}
    eventCounts.forEach(event => {
      counts[event.type] = event._count.id
    })

    // Calculate metrics
    const sent = counts.sent || 0
    const delivered = counts.delivered || 0
    const opened = counts.opened || 0
    const clicked = counts.clicked || 0
    const replied = counts.replied || 0
    const bounced = counts.bounced || 0
    const optedOut = counts.opted_out || 0
    const spamComplaints = counts.spam_complaint || 0
    const failed = counts.failed || 0
    const notReached = counts.not_reached || 0

    // Rate calculations (all as percentages, rounded to 1 decimal)
    const deliveryRate = sent > 0 ? (delivered / sent) * 100 : 0
    const openRate = delivered > 0 ? (opened / delivered) * 100 : 0
    const clickRate = delivered > 0 ? (clicked / delivered) * 100 : 0
    const replyRate = delivered > 0 ? (replied / delivered) * 100 : 0
    const bounceRate = sent > 0 ? (bounced / sent) * 100 : 0
    const optOutRate = delivered > 0 ? (optedOut / delivered) * 100 : 0
    const notReachedRate = sent > 0 ? ((failed + notReached) / sent) * 100 : 0

    // Get total sequences completed (sequences with enrollments that have status 'completed')
    const sequencesCompleted = await prisma.sequenceEnrollment.count({
      where: {
        sequence: {
          customerId,
        },
        status: 'completed',
      },
    })

    // Get unique senders for this period
    const uniqueSenders = await prisma.emailEvent.findMany({
      where: {
        customerId,
        type: 'sent',
        occurredAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        senderIdentityId: true,
        senderIdentity: {
          select: {
            emailAddress: true,
            displayName: true,
          },
        },
      },
      distinct: ['senderIdentityId'],
    })

    res.json({
      customerId,
      dateRange,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      timezone: 'UTC',

      // Data source metadata (for transparency)
      _metadata: {
        dataSource: 'email_events table',
        eventTypes: ['sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'opted_out', 'failed', 'not_reached'],
        calculationMethod: 'Event-based aggregation',
        accuracy: 'Depends on email provider webhooks and tracking pixels',
        notes: [
          'Delivery rate = delivered / sent * 100',
          'Open rate = opened / delivered * 100 (tracking pixel required)',
          'Click rate = clicked / delivered * 100 (link tracking required)',
          'Reply rate = replied / delivered * 100',
          'Bounce rate = bounced / sent * 100',
          'Opt-out rate = opted_out / delivered * 100',
          'Not reached rate = (failed + not_reached) / sent * 100',
        ],
      },

      // Raw counts
      sent,
      delivered,
      opened,
      clicked,
      replied,
      bounced,
      optedOut,
      spamComplaints,
      failed,
      notReached,

      // Calculated metrics
      sequencesCompleted,
      deliveryRate: Math.round(deliveryRate * 10) / 10,
      openRate: Math.round(openRate * 10) / 10,
      clickRate: Math.round(clickRate * 10) / 10,
      replyRate: Math.round(replyRate * 10) / 10,
      bounceRate: Math.round(bounceRate * 10) / 10,
      optOutRate: Math.round(optOutRate * 10) / 10,
      notReachedRate: Math.round(notReachedRate * 10) / 10,

      // Employee breakdown
      uniqueSenders: uniqueSenders.length,
      senders: uniqueSenders.map(s => ({
        identityId: s.senderIdentityId,
        email: s.senderIdentity?.emailAddress,
        name: s.senderIdentity?.displayName,
      })),

      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/reports/customers - List all customers for dropdown
router.get('/customers', async (req, res, next) => {
  try {
    const customers = await prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            emailEvents: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    res.json({
      customers: customers.map(c => ({
        id: c.id,
        name: c.name,
        totalEvents: c._count.emailEvents,
      })),
    })
  } catch (error) {
    next(error)
  }
})

export default router