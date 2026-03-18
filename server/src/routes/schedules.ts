import express from 'express'
import { prisma } from '../lib/prisma.js'
import { requireMarketingMutationAuth } from '../middleware/marketingMutationAuth.js'
import { z } from 'zod'
import { clampDailySendLimit, MAX_DAILY_SEND_LIMIT_PER_IDENTITY } from '../utils/emailIdentityLimits.js'

const router = express.Router()
const CampaignStatusValues = ['draft', 'running', 'paused', 'completed'] as const

const createScheduleSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  senderIdentity: z.object({
    id: z.string().min(1),
  }).optional().nullable(),
  senderIdentityId: z.string().optional().nullable(),
  status: z.enum(CampaignStatusValues).optional(),
  timeWindows: z.array(z.object({
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    maxEmails: z.number().int().min(1).max(MAX_DAILY_SEND_LIMIT_PER_IDENTITY).optional(),
  })).optional(),
  maxEmailsPerDay: z.number().int().min(1).max(MAX_DAILY_SEND_LIMIT_PER_IDENTITY).optional(),
})

const updateScheduleSchema = createScheduleSchema.partial().extend({
  status: z.enum(CampaignStatusValues).optional(),
})

const getCustomerId = (req: express.Request): string => {
  const customerId = (req.headers['x-customer-id'] as string) || (req.query.customerId as string)
  if (!customerId) {
    const err = new Error('Customer ID required') as Error & { status?: number }
    err.status = 400
    throw err
  }
  return customerId
}

async function assertCustomerExists(customerId: string): Promise<boolean> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true },
  })
  return !!customer
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
        sequence: {
          select: {
            id: true,
            name: true,
            senderIdentityId: true,
            senderIdentity: {
              select: {
                id: true,
                emailAddress: true,
                displayName: true,
                dailySendLimit: true,
              },
            },
          },
        },
        list: {
          select: { name: true },
        },
        _count: {
          select: {
            prospects: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const campaignIds = campaigns.map((campaign) => campaign.id)
    const nextScheduledAtByCampaign = new Map<string, string>()
    if (campaignIds.length > 0) {
      try {
        const upcomingRows = await (prisma as any).emailCampaignProspectStep.findMany({
          where: {
            campaignId: { in: campaignIds },
            sentAt: null,
            scheduledAt: { gte: new Date() },
          },
          select: {
            campaignId: true,
            scheduledAt: true,
          },
          orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
        })
        for (const row of Array.isArray(upcomingRows) ? upcomingRows : []) {
          if (!row?.campaignId || !row?.scheduledAt || nextScheduledAtByCampaign.has(row.campaignId)) continue
          nextScheduledAtByCampaign.set(row.campaignId, row.scheduledAt.toISOString())
        }
      } catch (queryError) {
        console.error('[schedules:/] next scheduled send query failed', {
          customerId,
          message: queryError instanceof Error ? queryError.message : String(queryError),
        })
      }
    }

    const schedules = campaigns.map((campaign) => ({
      id: campaign.id,
      customerId: campaign.customerId,
      name: campaign.name,
      description: campaign.description ?? null,
      status: campaign.status,
      sequenceId: campaign.sequenceId ?? null,
      sequenceName: campaign.sequence?.name ?? null,
      listName: campaign.list?.name ?? null,
      senderIdentity: campaign.senderIdentity
        ? {
            ...campaign.senderIdentity,
            dailySendLimit: clampDailySendLimit(campaign.senderIdentity.dailySendLimit),
          }
        : null,
      sequenceSenderIdentity: campaign.sequence?.senderIdentity
        ? {
            ...campaign.sequence.senderIdentity,
            dailySendLimit: clampDailySendLimit(campaign.sequence.senderIdentity.dailySendLimit),
          }
        : null,
      mailboxMismatch:
        Boolean(campaign.senderIdentityId) &&
        Boolean(campaign.sequence?.senderIdentityId) &&
        campaign.senderIdentityId !== campaign.sequence?.senderIdentityId,
      nextScheduledAt: nextScheduledAtByCampaign.get(campaign.id) ?? null,
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

    let upcomingSends: any[] = []
    try {
      upcomingSends = await (prisma as any).emailCampaignProspectStep.findMany({
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
          campaignProspect: {
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
    } catch (queryError) {
      console.error('[schedules:/emails] query failed', {
        customerId,
        message: queryError instanceof Error ? queryError.message : String(queryError),
      })
      return res.status(500).json({ error: 'Failed to load scheduled emails' })
    }

    const scheduledEmails = Array.isArray(upcomingSends)
      ? upcomingSends.map((send: any) => ({
          id: send.id,
          campaignId: send.campaignId,
          campaignName: send.campaign?.name || 'Unknown Campaign',
          prospectEmail: send.campaignProspect?.contact?.email || '',
          prospectName:
            `${send.campaignProspect?.contact?.firstName || ''} ${send.campaignProspect?.contact?.lastName || ''}`.trim() ||
            'Unknown',
          scheduledFor: send.scheduledAt ? send.scheduledAt.toISOString() : null,
          status: 'scheduled' as const,
          senderIdentity: send.campaign?.senderIdentity,
          stepNumber: typeof send.stepNumber === 'number' ? send.stepNumber : 0,
        }))
      : []

    res.json(scheduledEmails)
  } catch (error) {
    next(error)
  }
})

// POST /api/schedules/:id/pause
router.post('/:id/pause', requireMarketingMutationAuth, async (req, res, next) => {
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
router.post('/:id/resume', requireMarketingMutationAuth, async (req, res, next) => {
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
        sequence: {
          select: {
            id: true,
            name: true,
          },
        },
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
    let nextScheduledAt: string | null = null
    try {
      upcomingCount = await (prisma as any).emailCampaignProspectStep.count({
        where: {
          campaignId: id,
          scheduledAt: { gte: new Date() },
          sentAt: null,
        },
      })
      const nextStep = await (prisma as any).emailCampaignProspectStep.findFirst({
        where: {
          campaignId: id,
          scheduledAt: { gte: new Date() },
          sentAt: null,
        },
        select: {
          scheduledAt: true,
        },
        orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
      })
      nextScheduledAt = nextStep?.scheduledAt ? nextStep.scheduledAt.toISOString() : null
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
      sequenceId: campaign.sequence?.id ?? campaign.sequenceId ?? null,
      sequenceName: campaign.sequence?.name ?? null,
      totalProspects: campaign._count.prospects,
      upcomingSends: upcomingCount,
      nextScheduledAt,
      sentSends: sentCount,
      todaySent: todaySentCount,
      dailyLimit: clampDailySendLimit(campaign.senderIdentity?.dailySendLimit),
      senderIdentity: campaign.senderIdentity,
    })
  } catch (error) {
    next(error)
  }
})

// POST /api/schedules — create a campaign schedule record
router.post('/', requireMarketingMutationAuth, async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    if (!(await assertCustomerExists(customerId))) {
      return res.status(404).json({ error: 'customer_not_found' })
    }
    const data = createScheduleSchema.parse(req.body || {})
    const senderIdentityId = data.senderIdentityId || data.senderIdentity?.id || null
    if (senderIdentityId) {
      const identity = await prisma.emailIdentity.findFirst({
        where: { id: senderIdentityId, customerId },
        select: { id: true },
      })
      if (!identity) return res.status(400).json({ error: 'sender_identity_not_found_for_customer' })
    }

    const firstWindow = data.timeWindows?.[0]
    const windowStart = firstWindow ? parseInt(firstWindow.startTime.slice(0, 2), 10) : undefined
    const windowEnd = firstWindow ? parseInt(firstWindow.endTime.slice(0, 2), 10) : undefined
    const status = data.status && data.status !== 'draft' ? data.status : 'paused'

    const campaign = await prisma.emailCampaign.create({
      data: {
        customerId,
        name: data.name,
        description: data.description || null,
        senderIdentityId,
        status,
        ...(windowStart != null ? { sendWindowHoursStart: windowStart } : {}),
        ...(windowEnd != null ? { sendWindowHoursEnd: windowEnd } : {}),
      },
    })

    if (senderIdentityId && data.maxEmailsPerDay != null) {
      await prisma.emailIdentity.updateMany({
        where: { id: senderIdentityId, customerId },
        data: { dailySendLimit: clampDailySendLimit(data.maxEmailsPerDay) },
      })
    }

    res.status(201).json({
      id: campaign.id,
      status: campaign.status,
    })
  } catch (error) {
    next(error)
  }
})

// PUT /api/schedules/:id — update schedule metadata
router.put('/:id', requireMarketingMutationAuth, async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { id } = req.params
    const data = updateScheduleSchema.parse(req.body || {})
    const existing = await prisma.emailCampaign.findFirst({
      where: { id, customerId },
      select: { id: true, senderIdentityId: true },
    })
    if (!existing) return res.status(404).json({ error: 'Schedule not found' })

    const senderIdentityId = data.senderIdentityId || data.senderIdentity?.id || existing.senderIdentityId || null
    if (senderIdentityId) {
      const identity = await prisma.emailIdentity.findFirst({
        where: { id: senderIdentityId, customerId },
        select: { id: true },
      })
      if (!identity) return res.status(400).json({ error: 'sender_identity_not_found_for_customer' })
    }

    const firstWindow = data.timeWindows?.[0]
    const windowStart = firstWindow ? parseInt(firstWindow.startTime.slice(0, 2), 10) : undefined
    const windowEnd = firstWindow ? parseInt(firstWindow.endTime.slice(0, 2), 10) : undefined
    const updated = await prisma.emailCampaign.update({
      where: { id },
      data: {
        ...(data.name != null ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description || null } : {}),
        ...(data.status != null ? { status: data.status } : {}),
        ...(data.senderIdentityId !== undefined || data.senderIdentity !== undefined ? { senderIdentityId } : {}),
        ...(windowStart != null ? { sendWindowHoursStart: windowStart } : {}),
        ...(windowEnd != null ? { sendWindowHoursEnd: windowEnd } : {}),
      },
    })

    if (senderIdentityId && data.maxEmailsPerDay != null) {
      await prisma.emailIdentity.updateMany({
        where: { id: senderIdentityId, customerId },
        data: { dailySendLimit: clampDailySendLimit(data.maxEmailsPerDay) },
      })
    }

    res.json({ success: true, campaign: updated })
  } catch (error) {
    next(error)
  }
})

// PATCH /api/schedules/:id — quick toggle/status updates from UI
router.patch('/:id', requireMarketingMutationAuth, async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { id } = req.params
    const isActive = req.body?.isActive
    const status = req.body?.status
    const existing = await prisma.emailCampaign.findFirst({
      where: { id, customerId },
      select: { id: true, status: true },
    })
    if (!existing) return res.status(404).json({ error: 'Schedule not found' })

    const nextStatus =
      typeof isActive === 'boolean'
        ? (isActive ? 'running' : 'paused')
        : (typeof status === 'string' ? status : null)

    if (!nextStatus || !CampaignStatusValues.includes(nextStatus as any)) {
      return res.status(400).json({ error: 'invalid_status_update' })
    }

    const updated = await prisma.emailCampaign.update({
      where: { id },
      data: { status: nextStatus as any },
    })

    res.json({ success: true, campaign: updated })
  } catch (error) {
    next(error)
  }
})

// DELETE /api/schedules/:id — cancel a campaign (sets to completed)
router.delete('/:id', requireMarketingMutationAuth, async (req, res, next) => {
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
