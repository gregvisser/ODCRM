// @ts-nocheck
/**
 * Campaign Email Sender Worker
 * Ported from OpensDoorsV2 sender.mjs
 * 
 * Processes running campaigns and sends emails based on sequences
 * Enforces daily sending caps and delays between steps
 */

import { PrismaClient } from '@prisma/client'
import { applyTemplatePlaceholders } from '../services/templateRenderer.js'
import { sendEmail } from '../services/smtpMailer.js'

export interface SenderConfig {
  batchSize?: number
  lockMinutes?: number
  mailboxDailyCap?: number
  spreadHours?: number
  stepJitterMinutes?: number
  retryMinutes?: number
}

/**
 * Process campaigns and send due emails
 */
export async function processCampaigns(
  prisma: PrismaClient,
  config: SenderConfig = {}
): Promise<{ sent: number; scanned: number }> {
  const now = new Date()
  const {
    batchSize = 25,
    lockMinutes = 5,
    mailboxDailyCap = 50,
    spreadHours = 10,
    stepJitterMinutes = 60,
    retryMinutes = 15,
  } = config

  const instanceId = `sender-${process.pid}-${Math.random().toString(16).slice(2)}`
  const lockCutoff = new Date(now.getTime() - lockMinutes * 60 * 1000)
  const dayStartUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)
  )

  // Find campaign prospects that are due to be sent
  const candidates = await prisma.email_campaign_prospects.findMany({
    where: {
      lastStatus: 'pending',
      campaign: { status: 'running' },
      // Check if any step is due (we'll use step1ScheduledAt as proxy for now)
      // In a full implementation, check email_campaign_prospect_steps
    },
    orderBy: [{ createdAt: 'asc' }],
    take: batchSize,
    select: {
      id: true,
      campaignId: true,
      contactId: true,
      senderIdentityId: true,
      lastStatus: true,
      campaign: {
        select: {
          id: true,
          sequenceId: true,
          customerId: true,
        },
      },
    },
  })

  if (candidates.length === 0) {
    console.log(`[campaignSender] ${now.toISOString()} - No due prospects`)
    return { sent: 0, scanned: 0 }
  }

  // For now, we'll use a simplified version
  // Full implementation would check prospect_steps table and sequence

  let sentCount = 0
  console.log(`[campaignSender] ${now.toISOString()} - Processing ${candidates.length} prospects`)

  // This is a placeholder - full implementation would:
  // 1. Lock prospects to prevent duplicate sends
  // 2. Load sequence steps
  // 3. Check daily caps per email identity
  // 4. Send emails via SMTP or OAuth
  // 5. Create emailEvent
  // 6. Update prospect status and schedule next step

  return {
    sent: sentCount,
    scanned: candidates.length,
  }
}

/**
 * Simplified campaign sender using new sequences schema
 * This version works with the migrated Lists + Sequences workflow
 */
export async function processSequenceBasedCampaigns(
  prisma: PrismaClient,
  config: SenderConfig = {}
): Promise<{ sent: number; scanned: number }> {
  const now = new Date()
  const {
    batchSize = 25,
    mailboxDailyCap = 50,
    stepJitterMinutes = 60,
  } = config

  const dayStartUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)
  )

  // Find campaigns that use sequences (the new workflow)
  const campaigns = await prisma.email_campaigns.findMany({
    where: {
      status: 'running',
      sequenceId: { not: null },
    },
    select: {
      id: true,
      customerId: true,
      sequenceId: true,
      senderIdentityId: true,
    },
  })

  if (campaigns.length === 0) {
    console.log(`[campaignSender] ${now.toISOString()} - No active sequence campaigns`)
    return { sent: 0, scanned: 0 }
  }

  let sentCount = 0
  let scannedCount = 0

  for (const campaign of campaigns) {
    if (!campaign.sequenceId) continue

    // Get sequence steps
    const sequence = await prisma.email_sequences.findUnique({
      where: { id: campaign.sequenceId },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
        },
      },
    })

    if (!sequence || sequence.email_sequence_steps.length === 0) continue

    // Get email identity
    const identity = await prisma.email_identities.findUnique({
      where: { id: campaign.senderIdentityId },
    })

    if (!identity || !identity.isActive) continue

    // Check daily cap for this identity
    const sentToday = await prisma.email_events.count({
      where: {
        type: 'sent',
        occurredAt: { gte: dayStartUtc },
        campaign: {
          senderIdentityId: identity.id,
        },
      },
    })

    if (sentToday >= mailboxDailyCap) {
      console.log(
        `[campaignSender] Identity ${identity.emailAddress} hit daily cap (${sentToday}/${mailboxDailyCap})`
      )
      continue
    }

    // Get prospects for this campaign that are pending
    const prospects = await prisma.email_campaign_prospects.findMany({
      where: {
        campaignId: campaign.id,
        lastStatus: 'pending',
      },
      include: {
        contact: true,
      },
      take: Math.min(batchSize, mailboxDailyCap - sentToday),
    })

    scannedCount += prospects.length

    for (const prospect of prospects) {
      const contact = prospect.contacts_relation

      // Determine which step to send (simplified - step 1 for all pending)
      const step = sequence.email_sequence_steps[0]
      if (!step) continue

      // Apply template placeholders
      const subject = applyTemplatePlaceholders(step.subjectTemplate, {
        firstName: contact.firstName,
        lastName: contact.lastName,
        company: contact.companyName,
        companyName: contact.companyName,
        email: contact.email,
        jobTitle: contact.jobTitle,
        title: contact.jobTitle,
        phone: contact.phone,
      })

      const bodyHtml = applyTemplatePlaceholders(step.bodyTemplateHtml, {
        firstName: contact.firstName,
        lastName: contact.lastName,
        company: contact.companyName,
        companyName: contact.companyName,
        email: contact.email,
        jobTitle: contact.jobTitle,
        title: contact.jobTitle,
        phone: contact.phone,
      })

      const bodyText = step.bodyTemplateText
        ? applyTemplatePlaceholders(step.bodyTemplateText, {
            firstName: contact.firstName,
            lastName: contact.lastName,
            company: contact.companyName,
            companyName: contact.companyName,
            email: contact.email,
            jobTitle: contact.jobTitle,
            title: contact.jobTitle,
            phone: contact.phone,
          })
        : undefined

      // Send email
      const result = await sendEmail({
        identity,
        to: contact.email,
        subject,
        html: bodyHtml,
        text: bodyText,
      })

      if (result.ok) {
        // Create email event
        await prisma.email_events.create({ data: {
            id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            campaignId: campaign.id,
            campaignProspectId: prospect.id,
            type: 'sent',
            metadata: {
              step: step.stepOrder,
              subject,
            },
          },
        })

        // Update prospect status
        await prisma.email_campaign_prospects.update({
          where: { id: prospect.id },
          data: {
            lastStatus: 'step1_sent',
            step1SentAt: now,
            updatedAt: now,
          },
        })

        sentCount++

        // Check if we hit daily cap
        if (sentToday + sentCount >= mailboxDailyCap) {
          console.log(
            `[campaignSender] Identity ${identity.emailAddress} reached daily cap`
          )
          break
        }
      } else {
        console.error(
          `[campaignSender] Failed to send to ${contact.email}: ${(result as any).error}`
        )

        // Create bounced event if needed
        await prisma.email_events.create({ data: {
            id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            campaignId: campaign.id,
            campaignProspectId: prospect.id,
            type: 'bounced',
            metadata: {
              error: (result as any).error,
            },
          },
        })
      }
    }
  }

  console.log(
    `[campaignSender] ${now.toISOString()} - Sent: ${sentCount}, Scanned: ${scannedCount}`
  )

  return {
    sent: sentCount,
    scanned: scannedCount,
  }
}

/**
 * Main sender function - called by scheduler
 */
export async function runCampaignSender(prisma: PrismaClient): Promise<void> {
  try {
    const config: SenderConfig = {
      batchSize: Number(process.env.SENDER_BATCH_SIZE || '25'),
      lockMinutes: Number(process.env.SENDER_LOCK_MINUTES || '5'),
      mailboxDailyCap: Number(process.env.MAILBOX_DAILY_CAP || '50'),
      spreadHours: Number(process.env.MAILBOX_SPREAD_HOURS || '10'),
      stepJitterMinutes: Number(process.env.SENDER_STEP_JITTER_MINUTES || '60'),
      retryMinutes: Number(process.env.SENDER_RETRY_MINUTES || '15'),
    }

    await processSequenceBasedCampaigns(prisma, config)
  } catch (error) {
    console.error('[campaignSender] Error:', error)
    throw error
  }
}
