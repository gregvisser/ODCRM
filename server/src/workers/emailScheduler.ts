// @ts-nocheck
import cron from 'node-cron'
import { PrismaClient } from '@prisma/client'
import { sendEmail } from '../services/outlookEmailService.js'
import { applyTemplatePlaceholders } from '../services/templateRenderer.js'

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
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)

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

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }

  const getScheduleNow = (timeZone: string) => {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      hour: '2-digit',
      hour12: false,
    })
    const parts = dtf.formatToParts(now)
    const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon'
    const hourStr = parts.find((p) => p.type === 'hour')?.value ?? '00'
    const hour = parseInt(hourStr, 10)
    const day = weekdayMap[weekday] ?? 1
    return { day, hour }
  }

  for (const campaign of runningCampaigns) {
    // Check if we're within send window (using campaign's sendWindowHoursStart/End)
    const currentHour = now.getHours()
    if (currentHour < campaign.sendWindowHoursStart || currentHour >= campaign.sendWindowHoursEnd) {
      continue
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

    // Customer-level safety: hard cap total sends per 24h (rolling).
    // This reduces blacklist/domain risk when multiple identities/campaigns run.
    const customerSentLast24h = await prisma.emailEvent.count({
      where: {
        type: 'sent',
        occurredAt: { gte: since24h },
        campaign: { customerId: campaign.customerId }
      }
    })
    if (customerSentLast24h >= 160) {
      console.log(`⚠️ Customer 24h send cap reached (${customerSentLast24h}/160) for customer ${campaign.customerId}`)
      continue
    }

    // Preferred path: N-step sequences via EmailCampaignProspectStep.
    // If schema/client isn't migrated yet, fall back to legacy 2-step columns.
    let usedNewStepScheduling = false
    try {
      const dueSteps = await (prisma as any).emailCampaignProspectStep.findMany({
        where: {
          campaignId: campaign.id,
          scheduledAt: { lte: now },
          sentAt: null,
          prospect: {
            unsubscribedAt: null,
            bouncedAt: null,
            replyDetectedAt: null,
          }
        },
        include: {
          prospect: { include: { contact: true } }
        },
        orderBy: { scheduledAt: 'asc' },
        take: 10
      })

      if (Array.isArray(dueSteps)) {
        usedNewStepScheduling = true
        for (const row of dueSteps) {
          if (emailsSentToday >= campaign.senderIdentity.dailySendLimit) break

          // Re-check customer cap as we send in batches
          const customerSent = await prisma.emailEvent.count({
            where: {
              type: 'sent',
              occurredAt: { gte: since24h },
              campaign: { customerId: campaign.customerId }
            }
          })
          if (customerSent >= 160) break

          const prospect = row.prospect
          const stepNumber = row.stepNumber
          await sendCampaignEmail(prisma, campaign, prospect, stepNumber)

          // Mark row as sent (best-effort)
          await (prisma as any).emailCampaignProspectStep.update({
            where: { id: row.id },
            data: { sentAt: new Date() } as any })

          // Schedule next step if it exists
          const nextStepNumber = stepNumber + 1
          const nextTemplate = campaign.email_campaign_templates.find((t: any) => t.stepNumber === nextStepNumber)
          if (nextTemplate) {
            const min = Number.isFinite(nextTemplate.delayDaysMin) ? nextTemplate.delayDaysMin : campaign.followUpDelayDaysMin
            const max = Number.isFinite(nextTemplate.delayDaysMax) ? nextTemplate.delayDaysMax : campaign.followUpDelayDaysMax
            const delayDays = min + Math.random() * Math.max(0, (max - min))
            const scheduledAt = new Date(Date.now() + delayDays * 24 * 60 * 60 * 1000)

            await (prisma as any).emailCampaignProspectStep.upsert({
              where: {
                campaignProspectId_stepNumber: {
                  campaignProspectId: prospect.id,
                  stepNumber: nextStepNumber
                }
              },
              update: { scheduledAt },
              create: {
                campaignId: campaign.id,
                campaignProspectId: prospect.id,
                stepNumber: nextStepNumber,
                scheduledAt
              }
            })
          } else {
            // No next template; consider sequence done.
            await prisma.emailCampaignProspect.update({
              where: { id: prospect.id },
              data: { lastStatus: 'completed' } as any })
          }

          emailsSentToday++
        }
      }
    } catch {
      // ignored; fallback below
    }

    if (usedNewStepScheduling) continue

    // Legacy fallback: 2-step campaigns using fixed columns.
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

    for (const prospect of step1Ready) {
      if (emailsSentToday >= campaign.senderIdentity.dailySendLimit) break
      await sendCampaignEmail(prisma, campaign, prospect, 1)
      emailsSentToday++
    }

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

    for (const prospect of step2Ready) {
      if (emailsSentToday >= campaign.senderIdentity.dailySendLimit) break
      await sendCampaignEmail(prisma, campaign, prospect, 2)
      emailsSentToday++
    }
  }
}

async function sendCampaignEmail(
  prisma: PrismaClient,
  campaign: any,
  prospect: any,
  stepNumber: number
) {
  try {
    const template = campaign.email_campaign_templates.find((t: any) => t.stepNumber === stepNumber)
    if (!template) {
      console.error(`Template for step ${stepNumber} not found for campaign ${campaign.id}`)
      return
    }

    // Render template
    const variables = {
      firstName: prospect.contacts.firstName,
      lastName: prospect.contacts.lastName,
      companyName: prospect.contacts.companyName,
      email: prospect.contacts.email,
      jobTitle: prospect.contacts.jobTitle,
    }
    
    const renderedHtml = applyTemplatePlaceholders(template.bodyTemplateHtml, variables)
    const renderedSubject = applyTemplatePlaceholders(template.subjectTemplate, variables)

    // Inject tracking
    const trackingDomain = process.env.EMAIL_TRACKING_DOMAIN || 'http://localhost:3001'

    // Send email
    const result = await sendEmail(prisma, {
      senderIdentityId: campaign.senderIdentityId,
      toEmail: prospect.contacts.email,
      subject: renderedSubject,
      htmlBody: renderedHtml,
      textBody: template.bodyTemplateText || renderedHtml,
      campaignProspectId: prospect.id
    })

    if (result.success) {
      // Record sent event
      await prisma.emailEvent.create({ data: {
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
        lastStatus: stepNumber === 1 ? 'step1_sent' : (`step${Math.min(stepNumber, 10)}_sent`)
      }

      await prisma.emailCampaignProspect.update({
        where: { id: prospect.id },
        data: updateData
      })

      // Legacy: If step 1, schedule step 2 using fixed columns
      if (stepNumber === 1) {
        const delayDays = campaign.followUpDelayDaysMin +
          Math.random() * (campaign.followUpDelayDaysMax - campaign.followUpDelayDaysMin)
        const step2ScheduledAt = new Date(Date.now() + delayDays * 24 * 60 * 60 * 1000)

        await prisma.emailCampaignProspect.update({
          where: { id: prospect.id },
          data: { step2ScheduledAt } as any })
      } else if (stepNumber === 2) {
        // Legacy: Step 2 sent, mark as completed
        await prisma.emailCampaignProspect.update({
          where: { id: prospect.id },
          data: { lastStatus: 'completed' } as any })
      }

      console.log(`✅ Sent step ${stepNumber} email to ${prospect.contacts.email}`)
    } else {
      // Handle failure
      console.error(`❌ Failed to send email to ${prospect.contacts.email}:`, result.error)

      // Check if it's a bounce
      if (result.error?.toLowerCase().includes('bounce') || 
          result.error?.toLowerCase().includes('rejected')) {
        await prisma.emailEvent.create({ data: {
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
          } as any })
      }
    }
  } catch (error) {
    console.error(`Error sending email for prospect ${prospect.id}:`, error)
  }
}
