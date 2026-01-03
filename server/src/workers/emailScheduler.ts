import cron from 'node-cron'
import { PrismaClient } from '@prisma/client'
import { sendEmail } from '../services/outlookEmailService.js'
import { renderTemplate, injectTracking } from '../services/templateRenderer.js'

/**
 * Background worker that runs every minute to send scheduled emails
 */
export function startEmailScheduler(prisma: PrismaClient) {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      await processScheduledEmails(prisma)
    } catch (error) {
      console.error('Error in email scheduler:', error)
    }
  })

  console.log('✅ Email scheduler started (runs every minute)')
}

async function processScheduledEmails(prisma: PrismaClient) {
  const now = new Date()
  const currentHour = now.getHours()

  // Find all running campaigns
  const runningCampaigns = await prisma.emailCampaign.findMany({
    where: { status: 'running' },
    include: {
      senderIdentity: true,
      templates: {
        orderBy: { stepNumber: 'asc' }
      }
    }
  })

  for (const campaign of runningCampaigns) {
    // Check if we're within send window
    if (currentHour < campaign.sendWindowHoursStart || currentHour >= campaign.sendWindowHoursEnd) {
      continue // Skip if outside send window
    }

    // Check daily send limit for this identity
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)

    let emailsSentToday = await prisma.emailEvent.count({
      where: {
        campaign: {
          senderIdentityId: campaign.senderIdentityId
        },
        type: 'sent',
        occurredAt: {
          gte: todayStart
        }
      }
    })

    if (emailsSentToday >= campaign.senderIdentity.dailySendLimit) {
      console.log(`⚠️ Daily send limit reached for identity ${campaign.senderIdentityId}`)
      continue
    }

    // Find prospects ready for step 1 (initial email)
    const step1Ready = await prisma.emailCampaignProspect.findMany({
      where: {
        campaignId: campaign.id,
        lastStatus: 'pending',
        step1ScheduledAt: { lte: now },
        step1SentAt: null,
        unsubscribedAt: null,
        bouncedAt: null,
        replyDetectedAt: null
      },
      include: {
        contact: true
      },
      take: 10 // Process in batches
    })

    // Process step 1 emails
    for (const prospect of step1Ready) {
      if (emailsSentToday >= campaign.senderIdentity.dailySendLimit) {
        break
      }

      await sendCampaignEmail(prisma, campaign, prospect, 1)
      emailsSentToday++
    }

    // Find prospects ready for step 2 (follow-up)
    const step2Ready = await prisma.emailCampaignProspect.findMany({
      where: {
        campaignId: campaign.id,
        lastStatus: 'step1_sent',
        step2ScheduledAt: { lte: now },
        step2SentAt: null,
        unsubscribedAt: null,
        bouncedAt: null,
        replyDetectedAt: null
      },
      include: {
        contact: true
      },
      take: 10 // Process in batches
    })

    // Process step 2 emails
    for (const prospect of step2Ready) {
      if (emailsSentToday >= campaign.senderIdentity.dailySendLimit) {
        break
      }

      await sendCampaignEmail(prisma, campaign, prospect, 2)
      emailsSentToday++
    }
  }
}

async function sendCampaignEmail(
  prisma: PrismaClient,
  campaign: any,
  prospect: any,
  stepNumber: 1 | 2
) {
  try {
    const template = campaign.templates.find((t: any) => t.stepNumber === stepNumber)
    if (!template) {
      console.error(`Template for step ${stepNumber} not found for campaign ${campaign.id}`)
      return
    }

    // Render template
    const rendered = renderTemplate(template, prospect.contact)

    // Inject tracking
    const trackingDomain = process.env.EMAIL_TRACKING_DOMAIN || 'http://localhost:3001'
    const htmlBody = injectTracking(rendered.htmlBody, prospect.id, trackingDomain)

    // Send email
    const result = await sendEmail(prisma, {
      senderIdentityId: campaign.senderIdentityId,
      toEmail: prospect.contact.email,
      subject: rendered.subject,
      htmlBody,
      textBody: rendered.textBody,
      campaignProspectId: prospect.id
    })

    if (result.success) {
      // Record sent event
      await prisma.emailEvent.create({
        data: {
          campaignId: campaign.id,
          campaignProspectId: prospect.id,
          type: 'sent',
          metadata: {
            step: stepNumber,
            messageId: result.messageId,
            threadId: result.threadId
          },
          occurredAt: new Date()
        }
      })

      // Update prospect
      const updateData: any = {
        [`step${stepNumber}SentAt`]: new Date(),
        lastStatus: stepNumber === 1 ? 'step1_sent' : 'step2_sent'
      }

      await prisma.emailCampaignProspect.update({
        where: { id: prospect.id },
        data: updateData
      })

      // If step 1, schedule step 2
      if (stepNumber === 1) {
        const delayDays = campaign.followUpDelayDaysMin + 
          Math.random() * (campaign.followUpDelayDaysMax - campaign.followUpDelayDaysMin)
        const step2ScheduledAt = new Date(Date.now() + delayDays * 24 * 60 * 60 * 1000)

        await prisma.emailCampaignProspect.update({
          where: { id: prospect.id },
          data: { step2ScheduledAt }
        })
      } else {
        // Step 2 sent, mark as completed
        await prisma.emailCampaignProspect.update({
          where: { id: prospect.id },
          data: { lastStatus: 'completed' }
        })
      }

      console.log(`✅ Sent step ${stepNumber} email to ${prospect.contact.email}`)
    } else {
      // Handle failure
      console.error(`❌ Failed to send email to ${prospect.contact.email}:`, result.error)

      // Check if it's a bounce
      if (result.error?.toLowerCase().includes('bounce') || 
          result.error?.toLowerCase().includes('rejected')) {
        await prisma.emailEvent.create({
          data: {
            campaignId: campaign.id,
            campaignProspectId: prospect.id,
            type: 'bounced',
            metadata: { error: result.error },
            occurredAt: new Date()
          }
        })

        await prisma.emailCampaignProspect.update({
          where: { id: prospect.id },
          data: {
            bouncedAt: new Date(),
            lastStatus: 'bounced'
          }
        })
      }
    }
  } catch (error) {
    console.error(`Error sending email for prospect ${prospect.id}:`, error)
  }
}
