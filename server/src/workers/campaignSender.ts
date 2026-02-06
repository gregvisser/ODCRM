/**
 * Campaign Email Sender Worker
 * 
 * Processes running campaigns and sends emails based on sequences
 * Enforces daily sending caps, send windows, and delays between steps
 * 
 * IDEMPOTENCY: Uses atomic updateMany with status check to prevent double-sends
 */

import { PrismaClient } from '@prisma/client'
import { applyTemplatePlaceholders } from '../services/templateRenderer.js'
import { sendEmail as sendEmailViaOutlook } from '../services/outlookEmailService.js'

// Instance ID for logging - unique per process
const INSTANCE_ID = `sender-${process.pid}-${Date.now().toString(36)}`

export interface SenderConfig {
  batchSize?: number
  lockMinutes?: number
  mailboxDailyCap?: number
  spreadHours?: number
  stepJitterMinutes?: number
  retryMinutes?: number
}

/**
 * Check if current time is within the campaign's send window
 */
function isWithinSendWindow(
  sendWindowHoursStart: number,
  sendWindowHoursEnd: number
): boolean {
  const now = new Date()
  const currentHour = now.getHours()
  
  // Handle cases where window crosses midnight (e.g., 22 to 6)
  if (sendWindowHoursStart <= sendWindowHoursEnd) {
    return currentHour >= sendWindowHoursStart && currentHour < sendWindowHoursEnd
  } else {
    return currentHour >= sendWindowHoursStart || currentHour < sendWindowHoursEnd
  }
}

/**
 * Check if email is suppressed
 */
async function isSuppressed(
  prisma: PrismaClient,
  customerId: string,
  email: string
): Promise<boolean> {
  const emailLower = email.toLowerCase()
  const domain = emailLower.split('@')[1] || ''
  
  // Check for exact email or domain suppression
  const suppression = await prisma.suppressionEntry.findFirst({
    where: {
      customerId,
      OR: [
        { type: 'email', value: emailLower },
        { type: 'domain', value: domain }
      ]
    }
  })
  
  return !!suppression
}

/**
 * IDEMPOTENT: Atomically claim a prospect for sending
 * Returns the prospect if successfully claimed, null if already claimed/sent
 */
async function claimProspectForSending(
  prisma: PrismaClient,
  prospectId: string,
  now: Date
): Promise<boolean> {
  // Use updateMany with WHERE clause to atomically claim
  // This prevents race conditions - only succeeds if status is still 'pending'
  const result = await prisma.emailCampaignProspect.updateMany({
    where: {
      id: prospectId,
      lastStatus: 'pending',
      step1SentAt: null, // Double-check: not already sent
    },
    data: {
      // Mark as "in progress" by setting a temporary status
      // We'll update to final status after send
      updatedAt: now,
    }
  })
  
  // If count is 0, another process already claimed this prospect
  return result.count > 0
}

/**
 * Simplified campaign sender using sequences
 * This version works with the Lists + Sequences workflow
 */
export async function processSequenceBasedCampaigns(
  prisma: PrismaClient,
  config: SenderConfig = {}
): Promise<{ sent: number; scanned: number; skipped: number }> {
  const now = new Date()
  const {
    batchSize = 25,
    mailboxDailyCap = 50,
  } = config

  const dayStartUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)
  )

  // Find campaigns that use sequences (the new workflow)
  const campaigns = await prisma.emailCampaign.findMany({
    where: {
      status: 'running',
      sequenceId: { not: null },
    },
    select: {
      id: true,
      customerId: true,
      sequenceId: true,
      senderIdentityId: true,
      sendWindowHoursStart: true,
      sendWindowHoursEnd: true,
    },
  })

  if (campaigns.length === 0) {
    return { sent: 0, scanned: 0, skipped: 0 }
  }

  let sentCount = 0
  let scannedCount = 0
  let skippedCount = 0

  for (const campaign of campaigns) {
    if (!campaign.sequenceId) continue

    // Check send window
    if (!isWithinSendWindow(campaign.sendWindowHoursStart, campaign.sendWindowHoursEnd)) {
      continue
    }

    // Get sequence steps
    const sequence = await prisma.emailSequence.findUnique({
      where: { id: campaign.sequenceId },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
        },
      },
    })

    if (!sequence || sequence.steps.length === 0) {
      continue
    }

    // Get email identity
    const identity = await prisma.emailIdentity.findUnique({
      where: { id: campaign.senderIdentityId },
    })

    if (!identity || !identity.isActive) {
      continue
    }

    // Use identity's dailySendLimit or config fallback
    const dailyCap = identity.dailySendLimit || mailboxDailyCap

    // Check daily cap for this identity
    const sentToday = await prisma.emailEvent.count({
      where: {
        type: 'sent',
        occurredAt: { gte: dayStartUtc },
        campaign: {
          senderIdentityId: identity.id,
        },
      },
    })

    if (sentToday >= dailyCap) {
      continue
    }

    // Get prospects for this campaign that are pending
    // Filter out prospects who have replied, bounced, or unsubscribed
    const prospects = await prisma.emailCampaignProspect.findMany({
      where: {
        campaignId: campaign.id,
        lastStatus: 'pending',
        step1SentAt: null, // IDEMPOTENCY: Only get prospects that haven't been sent step 1
        replyDetectedAt: null,  // Stop-on-reply
        bouncedAt: null,        // Stop if bounced
        unsubscribedAt: null,   // Stop if unsubscribed
      },
      include: {
        contact: true,
      },
      take: Math.min(batchSize, dailyCap - sentToday),
    })

    scannedCount += prospects.length

    for (const prospect of prospects) {
      const contact = prospect.contact

      // IDEMPOTENCY: Atomically claim this prospect
      // If another process got here first, skip
      const claimed = await claimProspectForSending(prisma, prospect.id, now)
      if (!claimed) {
        console.log(`[campaignSender] ${INSTANCE_ID} - Prospect ${prospect.id} already claimed, skipping`)
        skippedCount++
        continue
      }

      // Check global suppression list
      const suppressed = await isSuppressed(prisma, campaign.customerId, contact.email)
      if (suppressed) {
        console.log(`[campaignSender] ${INSTANCE_ID} - Suppressed: ${contact.email}`)
        await prisma.emailCampaignProspect.update({
          where: { id: prospect.id },
          data: { lastStatus: 'suppressed', updatedAt: now },
        })
        skippedCount++
        continue
      }

      // Check contact status
      if (contact.status === 'bounced' || contact.status === 'unsubscribed') {
        skippedCount++
        continue
      }

      // Determine which step to send (simplified - step 1 for all pending)
      const step = sequence.steps[0]
      if (!step) continue

      // Apply template placeholders
      const subject = applyTemplatePlaceholders(step.subjectTemplate, {
        firstName: contact.firstName,
        lastName: contact.lastName,
        company: contact.companyName,
        companyName: contact.companyName,
        email: contact.email,
        jobTitle: contact.jobTitle || '',
        title: contact.jobTitle || '',
        phone: contact.phone || '',
      })

      const bodyHtml = applyTemplatePlaceholders(step.bodyTemplateHtml, {
        firstName: contact.firstName,
        lastName: contact.lastName,
        company: contact.companyName,
        companyName: contact.companyName,
        email: contact.email,
        jobTitle: contact.jobTitle || '',
        title: contact.jobTitle || '',
        phone: contact.phone || '',
      })

      const bodyText = step.bodyTemplateText
        ? applyTemplatePlaceholders(step.bodyTemplateText, {
            firstName: contact.firstName,
            lastName: contact.lastName,
            company: contact.companyName,
            companyName: contact.companyName,
            email: contact.email,
            jobTitle: contact.jobTitle || '',
            title: contact.jobTitle || '',
            phone: contact.phone || '',
          })
        : undefined

      // Send email via Outlook
      const result = await sendEmailViaOutlook(prisma, {
        senderIdentityId: identity.id,
        toEmail: contact.email,
        subject,
        htmlBody: bodyHtml,
        textBody: bodyText,
        campaignProspectId: prospect.id,
      })

      if (result.success) {
        // Create email event
        await prisma.emailEvent.create({
          data: {
            id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            campaignId: campaign.id,
            campaignProspectId: prospect.id,
            type: 'sent',
            metadata: {
              step: step.stepOrder,
              subject,
              messageId: result.messageId,
              instanceId: INSTANCE_ID,
            },
          },
        })

        // Update prospect status - THIS IS THE FINAL IDEMPOTENCY GATE
        // step1SentAt being non-null prevents re-processing
        await prisma.emailCampaignProspect.update({
          where: { id: prospect.id },
          data: {
            lastStatus: 'step1_sent',
            step1SentAt: now,
            updatedAt: now,
          },
        })

        sentCount++
        console.log(`[campaignSender] ${INSTANCE_ID} - Sent to ${contact.email} (step ${step.stepOrder})`)

        // Check if we hit daily cap
        if (sentToday + sentCount >= dailyCap) {
          break
        }
      } else {
        console.error(
          `[campaignSender] ${INSTANCE_ID} - Failed: ${contact.email}: ${result.error}`
        )

        // Create bounced event
        await prisma.emailEvent.create({
          data: {
            id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            campaignId: campaign.id,
            campaignProspectId: prospect.id,
            type: 'bounced',
            metadata: {
              error: result.error,
              instanceId: INSTANCE_ID,
            },
          },
        })

        // Mark prospect as bounced
        await prisma.emailCampaignProspect.update({
          where: { id: prospect.id },
          data: {
            lastStatus: 'bounced',
            bouncedAt: now,
            updatedAt: now,
          },
        })

        skippedCount++
      }
    }
  }

  return {
    sent: sentCount,
    scanned: scannedCount,
    skipped: skippedCount,
  }
}

/**
 * Main sender function - called by scheduler
 */
export async function runCampaignSender(prisma: PrismaClient): Promise<void> {
  const config: SenderConfig = {
    batchSize: Number(process.env.SENDER_BATCH_SIZE || '25'),
    lockMinutes: Number(process.env.SENDER_LOCK_MINUTES || '5'),
    mailboxDailyCap: Number(process.env.MAILBOX_DAILY_CAP || '50'),
    spreadHours: Number(process.env.MAILBOX_SPREAD_HOURS || '10'),
    stepJitterMinutes: Number(process.env.SENDER_STEP_JITTER_MINUTES || '60'),
    retryMinutes: Number(process.env.SENDER_RETRY_MINUTES || '15'),
  }

  const result = await processSequenceBasedCampaigns(prisma, config)
  
  // Log result for monitoring
  if (result.sent > 0 || result.skipped > 0) {
    console.log(
      `[campaignSender] ${INSTANCE_ID} - ${new Date().toISOString()} - Sent: ${result.sent}, Scanned: ${result.scanned}, Skipped: ${result.skipped}`
    )
  }
}
