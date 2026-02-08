// @ts-nocheck
import express from 'express'
import { prisma } from '../lib/prisma.js'
import { z } from 'zod'

const router = express.Router()

// Middleware to get customerId from context (in production, get from auth)
// For now, we'll accept it as a query param or header
const getCustomerId = (req: express.Request): string => {
  // In production, extract from JWT or session
  const customerId = req.headers['x-customer-id'] as string || req.query.customerId as string
  if (!customerId) {
    const err = new Error('Customer ID required') as Error & { status?: number }
    err.status = 400
    throw err
  }
  return customerId
}

// Create campaign (allow minimal draft creation)
const createCampaignSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.string().optional(),
  senderIdentityId: z.string().optional(),
  // sendScheduleId: z.string().optional(),
  sendWindowHoursStart: z.number().int().min(0).max(23).optional(),
  sendWindowHoursEnd: z.number().int().min(0).max(23).optional(),
  randomizeWithinHours: z.number().int().positive().optional(),
  followUpDelayDaysMin: z.number().int().positive().optional(),
  followUpDelayDaysMax: z.number().int().positive().optional(),
})

router.post('/', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { id: _ignoredId, ...safeBody } = (req.body || {}) as Record<string, unknown>
    const data = createCampaignSchema.parse(safeBody)
    const status = data.status || 'draft'

    if (status !== 'draft') {
      if (!data.senderIdentityId) {
        return res.status(400).json({ error: 'senderIdentityId is required when status is not draft' })
      }
      if (data.sendWindowHoursStart === undefined || data.sendWindowHoursEnd === undefined) {
        return res.status(400).json({ error: 'sendWindowHoursStart and sendWindowHoursEnd are required when status is not draft' })
      }
      if (data.randomizeWithinHours === undefined) {
        return res.status(400).json({ error: 'randomizeWithinHours is required when status is not draft' })
      }
      if (data.followUpDelayDaysMin === undefined || data.followUpDelayDaysMax === undefined) {
        return res.status(400).json({ error: 'followUpDelayDaysMin and followUpDelayDaysMax are required when status is not draft' })
      }
    }

    if (data.senderIdentityId) {
      const identity = await prisma.emailIdentity.findFirst({
        where: {
          id: data.senderIdentityId,
          customerId
        }
      })

      if (!identity) {
        return res.status(404).json({ error: 'Sender identity not found' })
      }
    }

    const campaign = await prisma.emailCampaign.create({
      data: {
        name: data.name,
        description: data.description,
        status,
        senderIdentityId: data.senderIdentityId,
        sendWindowHoursStart: data.sendWindowHoursStart,
        sendWindowHoursEnd: data.sendWindowHoursEnd,
        randomizeWithinHours: data.randomizeWithinHours,
        followUpDelayDaysMin: data.followUpDelayDaysMin,
        followUpDelayDaysMax: data.followUpDelayDaysMax,
        customerId,
      } as any,
      include: {
        email_identities: true
      }
    })

    res.json(campaign)
  } catch (error) {
    next(error)
  }
})

// List campaigns
router.get('/', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)

    const campaigns = await prisma.emailCampaign.findMany({
      where: { customerId },
      include: {
        senderIdentity: {
          select: {
            id: true,
            emailAddress: true,
            displayName: true
          }
        },
        prospects: {
          select: {
            lastStatus: true,
            openCount: true,
            replyDetectedAt: true,
            bouncedAt: true,
            unsubscribedAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Calculate metrics for each campaign
    const campaignsWithMetrics = await Promise.all(campaigns.map(async (campaign) => {
      const prospects = campaign.prospects
      const totalProspects = prospects.length
      const opened = prospects.filter(p => p.openCount > 0).length
      const bounced = prospects.filter(p => p.bouncedAt).length
      const unsubscribed = prospects.filter(p => p.unsubscribedAt).length
      const replied = prospects.filter(p => p.replyDetectedAt).length

      // Supports N-step sequences: use events to count total emails sent.
      const emailsSent = await prisma.emailEvent.count({
        where: { campaignId: campaign.id, type: 'sent' }
      })

      return {
        ...campaign,
        metrics: {
          totalProspects,
          emailsSent,
          opened,
          bounced,
          unsubscribed,
          replied,
          openRate: emailsSent > 0 ? (opened / emailsSent) * 100 : 0,
          bounceRate: emailsSent > 0 ? (bounced / emailsSent) * 100 : 0,
          unsubscribeRate: emailsSent > 0 ? (unsubscribed / emailsSent) * 100 : 0,
          replyRate: emailsSent > 0 ? (replied / emailsSent) * 100 : 0
        }
      }
    }))

    res.json(campaignsWithMetrics)
  } catch (error) {
    next(error)
  }
})

// Get campaign by ID
router.get('/:id', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { id } = req.params

    const campaign = await prisma.emailCampaign.findFirst({
      where: {
        id,
        customerId
      },
      include: {
        email_identities: true,
        email_campaign_templates: {
          orderBy: { stepNumber: 'asc' }
        },
        email_campaign_prospects: {
          include: {
            contacts: true
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' })
    }

    res.json(campaign)
  } catch (error) {
    next(error)
  }
})

// Update campaign
router.patch('/:id', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { id } = req.params
    const data = req.body

    // Verify campaign belongs to customer
    const existing = await prisma.emailCampaign.findFirst({
      where: { id, customerId }
    })

    if (!existing) {
      return res.status(404).json({ error: 'Campaign not found' })
    }

    const campaign = await prisma.emailCampaign.update({
      where: { id },
      data
    })

    res.json(campaign)
  } catch (error) {
    next(error)
  }
})

// Save templates (supports N steps, max 10)
const saveTemplateStepSchema = z.object({
  stepNumber: z.number().int().min(1).max(10),
  subjectTemplate: z.string(),
  bodyTemplateHtml: z.string(),
  bodyTemplateText: z.string().optional(),
  delayDaysMin: z.number().int().min(0).max(365).optional(),
  delayDaysMax: z.number().int().min(0).max(365).optional(),
})

const saveTemplatesSchemaV2 = z.object({
  steps: z.array(saveTemplateStepSchema).min(1).max(10),
})

// Legacy schema (2 fixed steps)
const saveTemplatesSchemaV1 = z.object({
  step1: z.object({
    subjectTemplate: z.string(),
    bodyTemplateHtml: z.string(),
    bodyTemplateText: z.string().optional()
  }),
  step2: z.object({
    subjectTemplate: z.string(),
    bodyTemplateHtml: z.string(),
    bodyTemplateText: z.string().optional()
  })
})

router.post('/:id/templates', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { id } = req.params
    const body = req.body as any

    // Verify campaign belongs to customer
    const campaign = await prisma.emailCampaign.findFirst({
      where: { id, customerId }
    })

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' })
    }

    // Resolve steps (v2 or v1)
    let steps: Array<z.infer<typeof saveTemplateStepSchema>> = []
    if (body && Array.isArray(body.steps)) {
      steps = saveTemplatesSchemaV2.parse(body).steps
    } else {
      const v1 = saveTemplatesSchemaV1.parse(body)
      steps = [
        {
          stepNumber: 1,
          subjectTemplate: v1.step1.subjectTemplate,
          bodyTemplateHtml: v1.step1.bodyTemplateHtml,
          bodyTemplateText: v1.step1.bodyTemplateText,
          delayDaysMin: 0,
          delayDaysMax: 0,
        },
        {
          stepNumber: 2,
          subjectTemplate: v1.step2.subjectTemplate,
          bodyTemplateHtml: v1.step2.bodyTemplateHtml,
          bodyTemplateText: v1.step2.bodyTemplateText,
          // Leave delays undefined to fall back to campaign-level follow-up settings.
        },
      ]
    }

    // Validate unique step numbers and presence of step 1
    const nums = steps.map((s) => s.stepNumber)
    const unique = new Set(nums)
    if (unique.size !== nums.length) {
      return res.status(400).json({ error: 'Duplicate stepNumber values are not allowed' })
    }
    if (!unique.has(1)) {
      return res.status(400).json({ error: 'Step 1 template is required' })
    }

    // Delete existing templates
    await prisma.emailCampaignTemplate.deleteMany({
      where: { campaignId: id }
    })

    // Create new templates
    await prisma.emailCampaignTemplate.createMany({
      data: steps.map((s) => ({
        campaignId: id,
        stepNumber: s.stepNumber,
        subjectTemplate: s.subjectTemplate,
        bodyTemplateHtml: s.bodyTemplateHtml,
        bodyTemplateText: s.bodyTemplateText,
        // New fields (requires Prisma generate + migration); keep TS compile-safe until then.
        delayDaysMin: s.delayDaysMin,
        delayDaysMax: s.delayDaysMax,
      })) as any
    })

    const templates = await prisma.emailCampaignTemplate.findMany({
      where: { campaignId: id },
      orderBy: { stepNumber: 'asc' }
    })

    res.json(templates)
  } catch (error) {
    next(error)
  }
})

// Attach prospects
router.post('/:id/prospects', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { id } = req.params
    const { contactIds } = req.body

    if (!Array.isArray(contactIds)) {
      return res.status(400).json({ error: 'contactIds must be an array' })
    }

    // Verify campaign belongs to customer
    const campaign = await prisma.emailCampaign.findFirst({
      where: { id, customerId }
    })

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' })
    }

    // Verify all contacts belong to customer
    const contacts = await prisma.contact.findMany({
      where: {
        id: { in: contactIds },
        customerId
      }
    })

    if (contacts.length !== contactIds.length) {
      return res.status(400).json({ error: 'Some contacts not found or do not belong to customer' })
    }

    // Create prospect entries (skip if already exists)
    const existing = await prisma.emailCampaignProspect.findMany({
      where: {
        campaignId: id,
        contactId: { in: contactIds }
      },
      select: { contactId: true }
    })

    const existingContactIds = new Set(existing.map(e => e.contactId))
    const newContactIds = contactIds.filter(cid => !existingContactIds.has(cid))

    if (newContactIds.length > 0) {
      await prisma.emailCampaignProspect.createMany({
        data: newContactIds.map(contactId => ({
          campaignId: id,
          contactId,
          senderIdentityId: campaign.senderIdentityId,
          lastStatus: 'pending'
        }))
      })
    }

    const prospects = await prisma.emailCampaignProspect.findMany({
      where: { campaignId: id },
      include: { contacts: true }
    })

    res.json({ attached: newContactIds.length, total: prospects.length })
  } catch (error) {
    next(error)
  }
})

// Start campaign
router.post('/:id/start', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { id } = req.params

    const campaign = await prisma.emailCampaign.findFirst({
      where: { id, customerId },
      include: { email_campaign_templates: true }
    })

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' })
    }

    const hasStep1 = campaign.email_campaign_templates.some((t) => t.stepNumber === 1)
    if (!hasStep1) {
      return res.status(400).json({ error: 'Campaign must have a Step 1 template before starting' })
    }

    if (!campaign.senderIdentityId) {
      return res.status(400).json({ error: 'Campaign must have a sender identity before starting' })
    }
    if (campaign.sendWindowHoursStart === null || campaign.sendWindowHoursEnd === null) {
      return res.status(400).json({ error: 'Campaign must have send window hours configured before starting' })
    }
    if (!campaign.randomizeWithinHours) {
      return res.status(400).json({ error: 'Campaign must have randomizeWithinHours configured before starting' })
    }
    if (!campaign.followUpDelayDaysMin || !campaign.followUpDelayDaysMax) {
      return res.status(400).json({ error: 'Campaign must have follow-up delays configured before starting' })
    }

    // Update status
    await prisma.emailCampaign.update({
      where: { id },
      data: { status: 'running' }
    })

    // Schedule step 1 emails for pending prospects
    const pendingProspects = await prisma.emailCampaignProspect.findMany({
      where: {
        campaignId: id,
        lastStatus: 'pending',
        step1SentAt: null
      }
    })

    const now = new Date()

    // Best-effort: prefer new prospect-step scheduling table, fall back to legacy columns.
    try {
      // Clear any previously scheduled (unsent) steps in case of restart.
      await (prisma as any).emailCampaignProspectStep.deleteMany({
        where: { campaignId: id, sentAt: null }
      })

      await (prisma as any).emailCampaignProspectStep.createMany({
        data: pendingProspects.map((prospect) => {
          const randomHours = Math.random() * campaign.randomizeWithinHours
          const scheduledAt = new Date(now.getTime() + randomHours * 60 * 60 * 1000)
          return {
            campaignId: id,
            campaignProspectId: prospect.id,
            stepNumber: 1,
            scheduledAt,
          }
        }),
      })
    } catch (e) {
      for (const prospect of pendingProspects) {
        const randomHours = Math.random() * campaign.randomizeWithinHours
        const scheduledAt = new Date(now.getTime() + randomHours * 60 * 60 * 1000)

        await prisma.emailCampaignProspect.update({
          where: { id: prospect.id },
          data: { step1ScheduledAt: scheduledAt }
        })
      }
    }

    res.json({ message: 'Campaign started', scheduled: pendingProspects.length })
  } catch (error) {
    next(error)
  }
})

// Pause campaign
router.post('/:id/pause', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { id } = req.params

    await prisma.emailCampaign.updateMany({
      where: { id, customerId },
      data: { status: 'paused' }
    })

    res.json({ message: 'Campaign paused' })
  } catch (error) {
    next(error)
  }
})

// Complete campaign
router.post('/:id/complete', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { id } = req.params

    await prisma.emailCampaign.updateMany({
      where: { id, customerId },
      data: { status: 'completed' }
    })

    res.json({ message: 'Campaign completed' })
  } catch (error) {
    next(error)
  }
})

// Delete campaign
router.delete('/:id', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { id } = req.params

    // Verify campaign belongs to customer
    const campaign = await prisma.emailCampaign.findFirst({
      where: { id, customerId }
    })

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' })
    }

    // Delete related records first (due to foreign key constraints)
    // Delete events
    await prisma.emailEvent.deleteMany({
      where: { campaignId: id }
    })

    // Delete message metadata
    await prisma.emailMessageMetadata.deleteMany({
      where: {
        campaignProspect: {
          campaignId: id
        }
      }
    })

    // Delete prospects
    await prisma.emailCampaignProspect.deleteMany({
      where: { campaignId: id }
    })

    // Delete templates
    await prisma.emailCampaignTemplate.deleteMany({
      where: { campaignId: id }
    })

    // Finally, delete the campaign
    await prisma.emailCampaign.delete({
      where: { id }
    })

    res.json({ message: 'Campaign deleted successfully' })
  } catch (error) {
    next(error)
  }
})

export default router
