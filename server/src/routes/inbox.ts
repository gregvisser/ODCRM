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

const listRepliesSchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
  campaignId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
})

function parseRange(start?: string, end?: string) {
  const now = new Date()
  const endDate = end ? new Date(end) : now
  const startDate = start ? new Date(start) : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000)
  return { startDate, endDate }
}

// Reply.io-style “Inbox”: list prospects with detected replies
router.get('/replies', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { start, end, campaignId, limit } = listRepliesSchema.parse(req.query)
    const { startDate, endDate } = parseRange(start, end)

    const rows = await prisma.emailCampaignProspect.findMany({
      where: {
        campaign: { customerId },
        ...(campaignId ? { campaignId } : {}),
        replyDetectedAt: { not: null, gte: startDate, lte: endDate },
      },
      include: {
        contact: true,
        campaign: {
          select: {
            id: true,
            name: true,
            senderIdentity: { select: { emailAddress: true, displayName: true } },
          },
        },
      },
      orderBy: { replyDetectedAt: 'desc' },
      take: limit || 100,
    })

    res.json({
      range: { start: startDate.toISOString(), end: endDate.toISOString() },
      items: rows.map((p) => ({
        prospectId: p.id,
        campaignId: p.campaignId,
        campaignName: p.campaign?.name,
        senderEmail: p.campaign?.senderIdentity?.emailAddress,
        senderName: p.campaign?.senderIdentity?.displayName,
        contact: {
          id: p.contact.id,
          firstName: p.contact.firstName,
          lastName: p.contact.lastName,
          companyName: p.contact.companyName,
          email: p.contact.email,
        },
        replyDetectedAt: p.replyDetectedAt,
        replyCount: p.replyCount,
        lastReplySnippet: p.lastReplySnippet,
      })),
    })
  } catch (error) {
    next(error)
  }
})

// Get email threads for customer's mailboxes
router.get('/threads', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const limit = parseInt(req.query.limit as string) || 50
    const offset = parseInt(req.query.offset as string) || 0

    // Get all threads that have messages in customer's mailboxes
    const threads = await prisma.emailMessageMetadata.findMany({
      where: {
        senderIdentity: { customerId },
        threadId: { not: null },
      },
      select: {
        threadId: true,
        subject: true,
        fromAddress: true,
        toAddress: true,
        direction: true,
        createdAt: true,
        senderIdentity: {
          select: {
            id: true,
            emailAddress: true,
            displayName: true,
          },
        },
        campaignProspect: {
          select: {
            id: true,
            contact: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                companyName: true,
                email: true,
              },
            },
            campaign: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      distinct: ['threadId'],
      take: limit,
      skip: offset,
    })

    // Group messages by thread and get latest message info
    const threadMap = new Map()

    for (const message of threads) {
      if (!message.threadId) continue

      const threadId = message.threadId
      const existing = threadMap.get(threadId)

      if (!existing || message.createdAt > existing.latestMessageAt) {
        threadMap.set(threadId, {
          threadId,
          subject: message.subject,
          participantEmail: message.direction === 'inbound' ? message.fromAddress : message.toAddress,
          participantName: message.campaignProspect?.contact ?
            `${message.campaignProspect.contact.firstName || ''} ${message.campaignProspect.contact.lastName || ''}`.trim() ||
            message.campaignProspect.contact.companyName : null,
          mailboxEmail: message.senderIdentity?.emailAddress,
          mailboxName: message.senderIdentity?.displayName,
          campaignId: message.campaignProspect?.campaign?.id,
          campaignName: message.campaignProspect?.campaign?.name,
          latestMessageAt: message.createdAt,
          messageCount: 1,
          hasReplies: message.direction === 'inbound',
        })
      } else {
        existing.messageCount++
        if (message.direction === 'inbound') {
          existing.hasReplies = true
        }
      }
    }

    const threadList = Array.from(threadMap.values())
    threadList.sort((a, b) => b.latestMessageAt.getTime() - a.latestMessageAt.getTime())

    res.json({
      threads: threadList.map(thread => ({
        ...thread,
        latestMessageAt: thread.latestMessageAt.toISOString(),
      })),
      hasMore: threads.length === limit,
      offset: offset + threads.length,
    })
  } catch (error) {
    next(error)
  }
})

// Get messages in a specific thread
router.get('/threads/:threadId/messages', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { threadId } = req.params

    const messages = await prisma.emailMessageMetadata.findMany({
      where: {
        threadId,
        senderIdentity: { customerId },
      },
      include: {
        senderIdentity: {
          select: {
            id: true,
            emailAddress: true,
            displayName: true,
          },
        },
        campaignProspect: {
          select: {
            id: true,
            contact: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                companyName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    res.json({
      threadId,
      messages: messages.map(msg => ({
        id: msg.id,
        direction: msg.direction,
        fromAddress: msg.fromAddress,
        toAddress: msg.toAddress,
        subject: msg.subject,
        rawHeaders: msg.rawHeaders,
        createdAt: msg.createdAt.toISOString(),
        senderIdentity: msg.senderIdentity,
        campaignProspect: msg.campaignProspect,
      })),
    })
  } catch (error) {
    next(error)
  }
})

// Send reply in a thread
router.post('/threads/:threadId/reply', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { threadId } = req.params
    const { content, toAddress } = req.body

    if (!content || !toAddress) {
      return res.status(400).json({ error: 'Content and toAddress are required' })
    }

    // Find the original message to determine which mailbox to reply from
    const originalMessage = await prisma.emailMessageMetadata.findFirst({
      where: {
        threadId,
        senderIdentity: { customerId },
      },
      include: {
        senderIdentity: true,
        campaignProspect: {
          include: {
            campaign: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!originalMessage) {
      return res.status(404).json({ error: 'Thread not found' })
    }

    // Send the reply using the same mailbox
    const { sendEmail } = await import('../services/outlookEmailService.js')

    const result = await sendEmail(prisma, {
      senderIdentityId: originalMessage.senderIdentity.id,
      toEmail: toAddress,
      subject: `Re: ${originalMessage.subject.replace(/^Re:\s*/i, '')}`,
      htmlBody: content,
      textBody: content,
    })

    if (!result.success) {
      return res.status(500).json({ error: 'Failed to send reply', details: result.error })
    }

    // Create EmailMessageMetadata for the outbound reply
    await prisma.emailMessageMetadata.create({
      data: {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        senderIdentityId: originalMessage.senderIdentity.id,
        providerMessageId: result.messageId || `sent_${Date.now()}`,
        threadId: threadId,
        direction: 'outbound',
        fromAddress: originalMessage.senderIdentity.emailAddress,
        toAddress: toAddress,
        subject: `Re: ${originalMessage.subject.replace(/^Re:\s*/i, '')}`,
      },
    })

    // Create EmailEvent for the reply
    if (originalMessage.campaignProspectId) {
      await prisma.emailEvent.create({
        data: {
          customerId,
          campaignId: originalMessage.campaignProspect?.campaignId || '',
          campaignProspectId: originalMessage.campaignProspectId,
          senderIdentityId: originalMessage.senderIdentity.id,
          recipientEmail: toAddress,
          type: 'replied',
          metadata: {
            threadId,
            replyContent: content,
            messageId: result.messageId,
          },
          occurredAt: new Date(),
        },
      })
    }

    res.json({
      success: true,
      messageId: result.messageId,
      threadId,
    })
  } catch (error) {
    next(error)
  }
})

export default router

