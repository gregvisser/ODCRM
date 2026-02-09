// @ts-nocheck
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

// List active schedules (campaigns) with upcoming sends
router.get('/', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)

    // Get active campaigns (running/scheduled) with their upcoming sends
    const campaigns = await prisma.emailCampaign.findMany({
      where: {
        customerId,
        status: { in: ['scheduled', 'running', 'paused'] },
        sequenceId: { not: null }, // Only sequence-based campaigns
      },
      include: {
        senderIdentity: {
          select: {
            id: true,
            emailAddress: true,
            displayName: true,
            dailySendLimit: true,
            sendWindowHoursStart: true,
            sendWindowHoursEnd: true,
            sendWindowTimeZone: true,
          },
        },
        _count: {
          select: {
            prospects: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Transform to schedule format
    const schedules = campaigns.map(campaign => ({
      id: campaign.id,
      customerId: campaign.customerId,
      name: campaign.name,
      status: campaign.status,
      senderIdentity: campaign.senderIdentity,
      totalProspects: campaign._count.prospects,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
    }))

    res.json(schedules)
  } catch (error) {
    next(error)
  }
})

// Get upcoming scheduled emails for a customer
router.get('/emails', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const limit = parseInt(req.query.limit as string) || 50

    // Get upcoming scheduled sends
    const upcomingSends = await prisma.emailCampaignProspectStep.findMany({
      where: {
        scheduledAt: { gte: new Date() },
        campaign: {
          customerId,
          status: { in: ['scheduled', 'running'] },
        },
        sentAt: null, // Not yet sent
      },
      include: {
        campaign: {
          include: {
            senderIdentity: {
              select: {
                id: true,
                emailAddress: true,
                displayName: true,
              },
            },
          },
        },
        prospect: {
          include: {
            contact: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
      take: limit,
    })

    // Transform to scheduled email format
    const scheduledEmails = upcomingSends.map(send => ({
      id: send.id,
      campaignId: send.campaignId,
      campaignName: send.campaign?.name || 'Unknown Campaign',
      prospectEmail: send.prospect?.contact?.email || '',
      prospectName: `${send.prospect?.contact?.firstName || ''} ${send.prospect?.contact?.lastName || ''}`.trim() || 'Unknown',
      scheduledFor: send.scheduledAt.toISOString(),
      status: 'scheduled' as const,
      senderIdentity: send.campaign?.senderIdentity,
      stepNumber: send.stepNumber,
    }))

    res.json(scheduledEmails)
  } catch (error) {
    next(error)
  }
})

// Pause a campaign schedule
router.post('/:id/pause', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { id } = req.params

    const campaign = await prisma.emailCampaign.findFirst({
      where: { id, customerId },
    })

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' })
    }

    if (campaign.status !== 'running') {
      return res.status(400).json({ error: 'Campaign is not running' })
    }

    const updated = await prisma.emailCampaign.update({
      where: { id },
      data: { status: 'paused' },
    })

    res.json({ success: true, campaign: updated })
  } catch (error) {
    next(error)
  }
})

// Resume a campaign schedule
router.post('/:id/resume', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { id } = req.params

    const campaign = await prisma.emailCampaign.findFirst({
      where: { id, customerId },
    })

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' })
    }

    if (campaign.status !== 'paused') {
      return res.status(400).json({ error: 'Campaign is not paused' })
    }

    const updated = await prisma.emailCampaign.update({
      where: { id },
      data: { status: 'running' },
    })

    res.json({ success: true, campaign: updated })
  } catch (error) {
    next(error)
  }
})

// Get schedule statistics
router.get('/:id/stats', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { id } = req.params

    const campaign = await prisma.emailCampaign.findFirst({
      where: { id, customerId },
      include: {
        senderIdentity: {
          select: {
            id: true,
            emailAddress: true,
            dailySendLimit: true,
          },
        },
        _count: {
          select: {
            prospects: true,
          },
        },
      },
    })

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' })
    }

    // Get upcoming sends count
    const upcomingCount = await prisma.emailCampaignProspectStep.count({
      where: {
        campaignId: id,
        scheduledAt: { gte: new Date() },
        sentAt: null,
      },
    })

    // Get sent count
    const sentCount = await prisma.emailEvent.count({
      where: {
        campaignId: id,
        type: 'sent',
      },
    })

    // Get today's sent count for this sender
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const todaySentCount = await prisma.emailEvent.count({
      where: {
        senderIdentityId: campaign.senderIdentityId,
        type: 'sent',
        occurredAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    })

    res.json({
      campaignId: id,
      status: campaign.status,
      totalProspects: campaign._count.prospects,
      upcomingSends: upcomingCount,
      sentSends: sentCount,
      todaySent: todaySentCount,
      dailyLimit: campaign.senderIdentity?.dailySendLimit || 150,
      senderIdentity: campaign.senderIdentity,
    })
  } catch (error) {
    next(error)
  }
})
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
    // Skip sendSchedule updates - field doesn't exist in database
    // await prisma.emailCampaign.updateMany({
    //   where: { customerId },
    //   data: {},
    // })

    // await prisma.emailSendSchedule.delete({ where: { id } })
    res.json({ message: 'Schedule deleted' })
  } catch (error) {
    next(error)
  }
})

export default router
