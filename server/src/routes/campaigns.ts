import express from 'express'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const router = express.Router()
const prisma = new PrismaClient()

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

// Create campaign
const createCampaignSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  senderIdentityId: z.string(),
  sendWindowHoursStart: z.number().int().min(0).max(23),
  sendWindowHoursEnd: z.number().int().min(0).max(23),
  randomizeWithinHours: z.number().int().positive().default(24),
  followUpDelayDaysMin: z.number().int().positive(),
  followUpDelayDaysMax: z.number().int().positive()
})

router.post('/', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const data = createCampaignSchema.parse(req.body)

    // Verify sender identity belongs to customer
    const identity = await prisma.emailIdentity.findFirst({
      where: {
        id: data.senderIdentityId,
        customerId
      }
    })

    if (!identity) {
      return res.status(404).json({ error: 'Sender identity not found' })
    }

    const campaign = await prisma.emailCampaign.create({
      data: {
        ...data,
        customerId,
        status: 'draft'
      },
      include: {
        senderIdentity: true
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
            step1SentAt: true,
            step2SentAt: true,
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
    const campaignsWithMetrics = campaigns.map(campaign => {
      const prospects = campaign.prospects
      const totalProspects = prospects.length
      const step1Sent = prospects.filter(p => p.step1SentAt).length
      const step2Sent = prospects.filter(p => p.step2SentAt).length
      const totalSent = step1Sent + step2Sent
      const opened = prospects.filter(p => p.openCount > 0).length
      const bounced = prospects.filter(p => p.bouncedAt).length
      const unsubscribed = prospects.filter(p => p.unsubscribedAt).length
      const replied = prospects.filter(p => p.replyDetectedAt).length

      return {
        ...campaign,
        metrics: {
          totalProspects,
          emailsSent: totalSent,
          opened,
          bounced,
          unsubscribed,
          replied,
          openRate: totalSent > 0 ? (opened / totalSent) * 100 : 0,
          bounceRate: totalSent > 0 ? (bounced / totalSent) * 100 : 0,
          unsubscribeRate: totalSent > 0 ? (unsubscribed / totalSent) * 100 : 0,
          replyRate: totalSent > 0 ? (replied / totalSent) * 100 : 0
        }
      }
    })

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
        senderIdentity: true,
        templates: {
          orderBy: { stepNumber: 'asc' }
        },
        prospects: {
          include: {
            contact: true
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

// Save templates
const saveTemplatesSchema = z.object({
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
    const data = saveTemplatesSchema.parse(req.body)

    // Verify campaign belongs to customer
    const campaign = await prisma.emailCampaign.findFirst({
      where: { id, customerId }
    })

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' })
    }

    // Delete existing templates
    await prisma.emailCampaignTemplate.deleteMany({
      where: { campaignId: id }
    })

    // Create new templates
    await prisma.emailCampaignTemplate.createMany({
      data: [
        {
          campaignId: id,
          stepNumber: 1,
          subjectTemplate: data.step1.subjectTemplate,
          bodyTemplateHtml: data.step1.bodyTemplateHtml,
          bodyTemplateText: data.step1.bodyTemplateText
        },
        {
          campaignId: id,
          stepNumber: 2,
          subjectTemplate: data.step2.subjectTemplate,
          bodyTemplateHtml: data.step2.bodyTemplateHtml,
          bodyTemplateText: data.step2.bodyTemplateText
        }
      ]
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
      include: { contact: true }
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
      include: { templates: true }
    })

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' })
    }

    if (campaign.templates.length < 2) {
      return res.status(400).json({ error: 'Campaign must have 2 templates before starting' })
    }

    // Update status
    await prisma.emailCampaign.update({
      where: { id },
      data: { status: 'running' }
    })

    // Schedule step1 emails for pending prospects
    const pendingProspects = await prisma.emailCampaignProspect.findMany({
      where: {
        campaignId: id,
        lastStatus: 'pending',
        step1SentAt: null
      }
    })

    const now = new Date()
    for (const prospect of pendingProspects) {
      // Randomize send time within randomizeWithinHours
      const randomHours = Math.random() * campaign.randomizeWithinHours
      const scheduledAt = new Date(now.getTime() + randomHours * 60 * 60 * 1000)

      await prisma.emailCampaignProspect.update({
        where: { id: prospect.id },
        data: { step1ScheduledAt: scheduledAt }
      })
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
