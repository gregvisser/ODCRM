import express from 'express'
import { prisma } from '../lib/prisma.js'

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

// GET /api/schedules — active campaigns with sender identity (used as "schedules")
router.get('/', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)

    const campaigns = await prisma.emailCampaign.findMany({
      where: {
        customerId,
        status: { in: ['running', 'paused'] },
        sequenceId: { not: null },
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

    const schedules = campaigns.map((campaign) => ({
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

// GET /api/schedules/emails — upcoming scheduled sends
router.get('/emails', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200)

    const upcomingSends = await (prisma as any).emailCampaignProspectStep.findMany({
      where: {
        scheduledAt: { gte: new Date() },
        campaign: {
          customerId,
          status: { in: ['running', 'paused'] },
        },
        sentAt: null,
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

    const scheduledEmails = Array.isArray(upcomingSends)
      ? upcomingSends.map((send: any) => ({
          id: send.id,
          campaignId: send.campaignId,
          campaignName: send.campaign?.name || 'Unknown Campaign',
          prospectEmail: send.prospect?.contact?.email || '',
          prospectName:
            `${send.prospect?.contact?.firstName || ''} ${send.prospect?.contact?.lastName || ''}`.trim() ||
            'Unknown',
          scheduledFor: send.scheduledAt?.toISOString(),
          status: 'scheduled' as const,
          senderIdentity: send.campaign?.senderIdentity,
          stepNumber: send.stepNumber,
        }))
      : []

    res.json(scheduledEmails)
  } catch (error) {
    next(error)
  }
})

// POST /api/schedules/:id/pause
router.post('/:id/pause', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { id } = req.params

    const campaign = await prisma.emailCampaign.findFirst({
      where: { id, customerId },
    })

    if (!campaign) return res.status(404).json({ error: 'Campaign not found' })
    if (campaign.status !== 'running') return res.status(400).json({ error: 'Campaign is not running' })

    const updated = await prisma.emailCampaign.update({
      where: { id },
      data: { status: 'paused' },
    })

    res.json({ success: true, campaign: updated })
  } catch (error) {
    next(error)
  }
})

// POST /api/schedules/:id/resume
router.post('/:id/resume', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { id } = req.params

    const campaign = await prisma.emailCampaign.findFirst({
      where: { id, customerId },
    })

    if (!campaign) return res.status(404).json({ error: 'Campaign not found' })
    if (campaign.status !== 'paused') return res.status(400).json({ error: 'Campaign is not paused' })

    const updated = await prisma.emailCampaign.update({
      where: { id },
      data: { status: 'running' },
    })

    res.json({ success: true, campaign: updated })
  } catch (error) {
    next(error)
  }
})

// GET /api/schedules/:id/stats
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
          select: { prospects: true },
        },
      },
    })

    if (!campaign) return res.status(404).json({ error: 'Campaign not found' })

    let upcomingCount = 0
    try {
      upcomingCount = await (prisma as any).emailCampaignProspectStep.count({
        where: {
          campaignId: id,
          scheduledAt: { gte: new Date() },
          sentAt: null,
        },
      })
    } catch {
      // ignore if table not migrated
    }

    const sentCount = await prisma.emailEvent.count({
      where: { campaignId: id, type: 'sent' },
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const todaySentCount = campaign.senderIdentityId
      ? await prisma.emailEvent.count({
          where: {
            senderIdentityId: campaign.senderIdentityId,
            type: 'sent',
            occurredAt: { gte: today, lt: tomorrow },
          },
        })
      : 0

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

// DELETE /api/schedules/:id — cancel a campaign (sets to completed)
router.delete('/:id', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { id } = req.params

    const existing = await prisma.emailCampaign.findFirst({
      where: { id, customerId },
    })
    if (!existing) return res.status(404).json({ error: 'Schedule not found' })

    // Cancel by setting status to completed (never delete — preserve history)
    await prisma.emailCampaign.update({
      where: { id },
      data: { status: 'completed' },
    })

    res.json({ success: true, message: 'Schedule cancelled' })
  } catch (error) {
    next(error)
  }
})

export default router
