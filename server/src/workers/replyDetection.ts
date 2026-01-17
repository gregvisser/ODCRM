import cron from 'node-cron'
import { PrismaClient } from '@prisma/client'
import { fetchRecentInboxMessages } from '../services/outlookEmailService.js'

// Simple reply snippet extractor
function extractReplySnippet(body: string): string {
  return body.substring(0, 200).trim()
}

/**
 * Background worker that runs every 5 minutes to detect email replies
 */
export function startReplyDetectionWorker(prisma: PrismaClient) {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      await detectReplies(prisma)
    } catch (error) {
      console.error('Error in reply detection worker:', error)
    }
  })

  console.log('✅ Reply detection worker started (runs every 5 minutes)')
}

async function detectReplies(prisma: PrismaClient) {
  // Find all active email identities
  const identities = await prisma.email_identities.findMany({
    where: { isActive: true }
  })

  for (const identity of identities) {
    try {
      // Fetch recent messages (last 72 hours)
      const messages = await fetchRecentInboxMessages(prisma, identity.id, 72)

      for (const message of messages) {
        await processInboundMessage(prisma, identity.id, message)
      }

      // Update last checked timestamp
      await prisma.email_identities.update({
        where: { id: identity.id },
        data: { lastCheckedAt: new Date() }
      })
    } catch (error) {
      console.error(`Error processing identity ${identity.id}:`, error)
    }
  }
}

async function processInboundMessage(
  prisma: PrismaClient,
  identityId: string,
  message: any
) {
  // Check if we've already processed this message
  const existing = await prisma.email_message_metadata.findUnique({
    where: { providerMessageId: message.messageId }
  })

  if (existing) {
    return // Already processed
  }

  // Method 1: Check for custom header (preferred)
  let campaignProspectId: string | null = null

  if (message.headers && message.headers['X-CRM-CampaignProspect-Id']) {
    campaignProspectId = message.headers['X-CRM-CampaignProspect-Id']
  } else if (message.internetMessageHeaders) {
    const header = message.internetMessageHeaders.find(
      (h: any) => h.name === 'X-CRM-CampaignProspect-Id'
    )
    if (header) {
      campaignProspectId = header.value
    }
  }

  // Method 2: Try thread/message linkage
  if (!campaignProspectId && message.threadId) {
    const threadMetadata = await prisma.email_message_metadata.findFirst({
      where: {
        threadId: message.threadId,
        direction: 'outbound',
        senderIdentityId: identityId
      },
      orderBy: { createdAt: 'desc' }
    })

    if (threadMetadata && threadMetadata.campaignProspectId) {
      campaignProspectId = threadMetadata.campaignProspectId
    }
  }

  // Method 3: Fallback - match by email and subject
  if (!campaignProspectId) {
    // Check if subject starts with "Re:" or contains original subject
    const subject = message.subject.toLowerCase()
    const isReply = subject.startsWith('re:') || subject.startsWith('re :')

    if (isReply) {
      // Try to find matching outbound message by to/from addresses
      const matchingMetadata = await prisma.email_message_metadata.findFirst({
        where: {
          senderIdentityId: identityId,
          direction: 'outbound',
          toAddress: message.fromAddress.toLowerCase(),
          fromAddress: { contains: '@' } // Ensure we have a from address
        },
        orderBy: { createdAt: 'desc' },
        take: 1
      })

      if (matchingMetadata && matchingMetadata.campaignProspectId) {
        campaignProspectId = matchingMetadata.campaignProspectId
      }
    }
  }

  // Store inbound message metadata
  await prisma.email_message_metadata.create({
    data: {
      campaignProspectId,
      senderIdentityId: identityId,
      providerMessageId: message.messageId,
      threadId: message.threadId,
      direction: 'inbound',
      fromAddress: message.fromAddress,
      toAddress: message.toAddress,
      subject: message.subject,
      rawHeaders: message.headers
    }
  })

  // If we found a matching campaign prospect, process the reply
  if (campaignProspectId) {
    await processReply(prisma, campaignProspectId, message)
  }
}

async function processReply(
  prisma: PrismaClient,
  campaignProspectId: string,
  message: any
) {
  try {
    const prospect = await prisma.email_campaign_prospects.findUnique({
      where: { id: campaignProspectId },
      include: { campaign: true }
    })

    if (!prospect) {
      return
    }

    // Skip if already marked as replied
    if (prospect.replyDetectedAt) {
      // Still record the event if this is a new reply
      const existingEvent = await prisma.email_events.findFirst({
        where: {
          campaignProspectId,
          type: 'replied',
          metadata: {
            path: ['messageId'],
            equals: message.messageId
          }
        }
      })

      if (!existingEvent) {
        await prisma.email_events.create({
          data: {
            campaignId: prospect.campaignId,
            campaignProspectId,
            type: 'replied',
            metadata: {
              messageId: message.messageId,
              subject: message.subject,
              fromAddress: message.fromAddress,
              snippet: extractReplySnippet(message.bodyPreview)
            },
            occurredAt: message.receivedDateTime
          }
        })

        await prisma.email_campaign_prospects.update({
          where: { id: campaignProspectId },
          data: {
            replyCount: { increment: 1 },
            lastReplySnippet: extractReplySnippet(message.bodyPreview)
          }
        })
      }

      return
    }

    // First reply detected
    const snippet = extractReplySnippet(message.bodyPreview)

    // Record event
    await prisma.email_events.create({
      data: {
        campaignId: prospect.campaignId,
        campaignProspectId,
        type: 'replied',
        metadata: {
          messageId: message.messageId,
          subject: message.subject,
          fromAddress: message.fromAddress,
          snippet
        },
        occurredAt: message.receivedDateTime
      }
    })

    // Update prospect
    await prisma.email_campaign_prospects.update({
      where: { id: campaignProspectId },
      data: {
        replyDetectedAt: message.receivedDateTime,
        replyCount: 1,
        lastReplySnippet: snippet,
        lastStatus: 'replied',
        // Legacy cancel any future scheduled sends
        step2ScheduledAt: null
      }
    })

    // New scheduler: cancel any future (unsent) steps for this prospect.
    try {
      await (prisma as any).emailCampaignProspectStep.deleteMany({
        where: {
          campaignProspectId,
          sentAt: null
        }
      })
    } catch {
      // ignore if schema not migrated yet
    }

    console.log(`📬 Reply detected for prospect ${campaignProspectId}`)
  } catch (error) {
    console.error(`Error processing reply for prospect ${campaignProspectId}:`, error)
  }
}
