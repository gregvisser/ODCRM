import express from 'express'
import { prisma } from '../lib/prisma.js'
import { z } from 'zod'
import { requireMarketingMutationAuth } from '../middleware/marketingMutationAuth.js'
import { randomUUID } from 'crypto'
import { buildInboxThreadSummaries, type InboxThreadMessageRecord } from '../utils/inboxThreadSummaries.js'
import { deriveInboxOptOutTarget } from '../utils/inboxOptOut.js'

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

function isMissingColumnError(err: unknown, columnName: string): boolean {
  const text = (err as any)?.message || ''
  return typeof text === 'string' && text.includes('does not exist') && text.includes(columnName)
}

function parseRange(start?: string, end?: string) {
  const now = new Date()
  const endDate = end ? new Date(end) : now
  const startDate = start ? new Date(start) : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000)
  return { startDate, endDate }
}

// Reply.io-style “Inbox”: list prospects with detected replies
// GET /api/inbox (root) - 404-safe for Marketing Overview
router.get('/', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const limit = Math.min(parseInt(String(req.query.limit || '10'), 10) || 10, 100)
    const { startDate, endDate } = parseRange()

    const rows = await prisma.emailCampaignProspect.findMany({
      where: {
        campaign: { customerId },
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
      take: limit,
    })

    const items = rows.map((p) => ({
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
      receivedAt: p.replyDetectedAt,
      replyCount: p.replyCount,
      lastReplySnippet: p.lastReplySnippet,
    }))

    res.setHeader('x-odcrm-customer-id', customerId)
    res.json({ data: items })
  } catch (error) {
    next(error)
  }
})

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
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200)
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0)
    const unreadOnly = req.query.unreadOnly === 'true'

    const messages = await prisma.emailMessageMetadata.findMany({
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
        isRead: true,
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
      take: 2000,
    })
    let threadList = buildInboxThreadSummaries(messages as InboxThreadMessageRecord[])
    if (unreadOnly) {
      threadList = threadList.filter((t) => t.unreadCount > 0)
    }
    const paged = threadList.slice(offset, offset + limit)

    res.json({
      threads: paged.map(thread => ({
        ...thread,
        latestMessageAt: thread.latestMessageAt.toISOString(),
      })),
      hasMore: offset + paged.length < threadList.length,
      offset: offset + paged.length,
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

    let messages: any[] = []
    try {
      messages = await prisma.emailMessageMetadata.findMany({
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
    } catch (err) {
      if (!isMissingColumnError(err, 'email_message_metadata.bodyPreview') && !isMissingColumnError(err, 'email_message_metadata.isRead')) {
        throw err
      }
      messages = await prisma.emailMessageMetadata.findMany({
        where: {
          threadId,
          senderIdentity: { customerId },
        },
        select: {
          id: true,
          threadId: true,
          direction: true,
          fromAddress: true,
          toAddress: true,
          subject: true,
          rawHeaders: true,
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
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      })
    }

    res.json({
      threadId,
      messages: messages.map(msg => ({
        id: msg.id,
        threadId: msg.threadId,
        direction: msg.direction,
        fromAddress: msg.fromAddress,
        toAddress: msg.toAddress,
        subject: msg.subject,
        bodyPreview: (msg as any).bodyPreview || null,
        isRead: (msg as any).isRead ?? false,
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

// GET /api/inbox/messages — paginated flat list of inbound messages (for list view)
router.get('/messages', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200)
    const offset = parseInt(req.query.offset as string) || 0
    const unreadOnly = req.query.unreadOnly === 'true'

    let messages: any[] = []
    try {
      messages = await prisma.emailMessageMetadata.findMany({
        where: {
          senderIdentity: { customerId },
          direction: 'inbound',
          ...(unreadOnly ? { isRead: false } : {}),
        },
        include: {
          senderIdentity: {
            select: { id: true, emailAddress: true, displayName: true },
          },
          campaignProspect: {
            select: {
              id: true,
              contact: {
                select: { id: true, firstName: true, lastName: true, companyName: true, email: true },
              },
              campaign: {
                select: { id: true, name: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      })
    } catch (err) {
      if (!isMissingColumnError(err, 'email_message_metadata.bodyPreview') && !isMissingColumnError(err, 'email_message_metadata.isRead')) {
        throw err
      }
      messages = await prisma.emailMessageMetadata.findMany({
        where: {
          senderIdentity: { customerId },
          direction: 'inbound',
        },
        select: {
          id: true,
          threadId: true,
          direction: true,
          fromAddress: true,
          toAddress: true,
          subject: true,
          createdAt: true,
          senderIdentity: {
            select: { id: true, emailAddress: true, displayName: true },
          },
          campaignProspect: {
            select: {
              id: true,
              contact: {
                select: { id: true, firstName: true, lastName: true, companyName: true, email: true },
              },
              campaign: {
                select: { id: true, name: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      })
    }

    res.json({
      messages: messages.map((m) => ({
        id: m.id,
        threadId: m.threadId,
        direction: m.direction,
        fromAddress: m.fromAddress,
        toAddress: m.toAddress,
        subject: m.subject,
        bodyPreview: (m as any).bodyPreview || null,
        isRead: (m as any).isRead ?? false,
        createdAt: m.createdAt.toISOString(),
        senderIdentity: m.senderIdentity,
        contact: m.campaignProspect?.contact || null,
        campaign: m.campaignProspect?.campaign || null,
      })),
      hasMore: messages.length === limit,
      offset: offset + messages.length,
    })
  } catch (error) {
    next(error)
  }
})

// POST /api/inbox/messages/:id/read — mark message as read/unread
router.post('/messages/:id/read', requireMarketingMutationAuth, async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { id } = req.params
    const isRead: boolean = req.body?.isRead !== false // default true

    // Verify message belongs to this customer
    const message = await prisma.emailMessageMetadata.findFirst({
      where: { id, senderIdentity: { customerId } },
      select: { id: true },
    })

    if (!message) return res.status(404).json({ error: 'Message not found' })

    try {
      await prisma.emailMessageMetadata.update({
        where: { id },
        data: { isRead } as any,
      })
    } catch (err) {
      if (!isMissingColumnError(err, 'email_message_metadata.isRead')) {
        throw err
      }
      // Backward-compatible no-op when isRead column is not yet present in DB.
    }

    res.json({ success: true, id, isRead })
  } catch (error) {
    next(error)
  }
})

// POST /api/inbox/messages/:id/optout — add sender email/domain to suppression list
router.post('/messages/:id/optout', requireMarketingMutationAuth, async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { id } = req.params

    const message = await prisma.emailMessageMetadata.findFirst({
      where: { id, senderIdentity: { customerId } },
      select: { id: true, fromAddress: true },
    })

    if (!message) return res.status(404).json({ error: 'Message not found' })

    const { email, domain } = deriveInboxOptOutTarget(message.fromAddress)

    await prisma.suppressionEntry.upsert({
      where: { customerId_type_value: { customerId, type: 'email', value: email } },
      update: { reason: 'Opted out via inbox', source: 'inbox-optout' },
      create: {
        id: randomUUID(),
        customerId,
        type: 'email',
        value: email,
        emailNormalized: email,
        reason: 'Opted out via inbox',
        source: 'inbox-optout',
      },
    })

    if (domain && !domain.includes('@')) {
      await prisma.suppressionEntry.upsert({
        where: { customerId_type_value: { customerId, type: 'domain', value: domain } },
        update: { reason: 'Opted out via inbox', source: 'inbox-optout' },
        create: {
          id: randomUUID(),
          customerId,
          type: 'domain',
          value: domain,
          emailNormalized: null,
          reason: 'Opted out via inbox',
          source: 'inbox-optout',
        },
      })
    }

    res.json({ success: true, suppressedEmail: email, suppressedDomain: domain || null })
  } catch (error) {
    next(error)
  }
})

// POST /api/inbox/refresh — trigger immediate reply detection poll for this customer
router.post('/refresh', requireMarketingMutationAuth, async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)

    // Get all active identities for this customer
    const identities = await prisma.emailIdentity.findMany({
      where: { customerId, isActive: true },
      select: { id: true, emailAddress: true, lastCheckedAt: true },
    })

    if (identities.length === 0) {
      return res.json({ success: true, message: 'No active identities to check', identitiesChecked: 0 })
    }

    // Trigger detection via the existing worker service if available
    let refreshed = 0
    try {
      const { fetchRecentInboxMessages } = await import('../services/outlookEmailService.js')
      const { PrismaClient } = await import('@prisma/client')

      for (const identity of identities) {
        try {
          const messages = await fetchRecentInboxMessages(prisma, identity.id, 24)
          if (Array.isArray(messages)) {
            for (const msg of messages) {
              // Check if already stored
              const exists = await prisma.emailMessageMetadata.findUnique({
                where: { providerMessageId: msg.messageId },
                select: { id: true },
              })
              if (!exists) {
                try {
                  await prisma.emailMessageMetadata.create({
                    data: {
                      senderIdentityId: identity.id,
                      providerMessageId: msg.messageId,
                      threadId: msg.threadId || null,
                      direction: 'inbound',
                      fromAddress: msg.fromAddress || '',
                      toAddress: msg.toAddress || '',
                      subject: msg.subject || '',
                      rawHeaders: msg.headers || null,
                      isRead: false,
                      bodyPreview: msg.bodyPreview ? msg.bodyPreview.substring(0, 500) : null,
                    } as any,
                  })
                } catch (err) {
                  if (!isMissingColumnError(err, 'email_message_metadata.bodyPreview') && !isMissingColumnError(err, 'email_message_metadata.isRead')) {
                    throw err
                  }
                  await prisma.emailMessageMetadata.create({
                    data: {
                      senderIdentityId: identity.id,
                      providerMessageId: msg.messageId,
                      threadId: msg.threadId || null,
                      direction: 'inbound',
                      fromAddress: msg.fromAddress || '',
                      toAddress: msg.toAddress || '',
                      subject: msg.subject || '',
                      rawHeaders: msg.headers || null,
                    } as any,
                  })
                }
              }
            }
          }
          // Update last checked time
          await prisma.emailIdentity.update({
            where: { id: identity.id },
            data: { lastCheckedAt: new Date() } as any,
          })
          refreshed++
        } catch (identityErr) {
          console.error(`[inbox/refresh] Error refreshing identity ${identity.id}:`, identityErr)
        }
      }
    } catch (importErr) {
      console.error('[inbox/refresh] Could not import outlookEmailService:', importErr)
    }

    res.json({
      success: true,
      identitiesChecked: identities.length,
      identitiesRefreshed: refreshed,
      checkedAt: new Date().toISOString(),
    })
  } catch (error) {
    next(error)
  }
})

// Send reply in a thread
router.post('/threads/:threadId/reply', requireMarketingMutationAuth, async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { threadId } = req.params
    const { content } = req.body

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'content is required' })
    }

    // Find messages in the thread to choose mailbox + recipient deterministically.
    const threadMessages = await prisma.emailMessageMetadata.findMany({
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

    if (threadMessages.length === 0) {
      return res.status(404).json({ error: 'Thread not found' })
    }
    const latest = threadMessages[0]
    const latestInbound = threadMessages.find((m) => m.direction === 'inbound') || null
    const toAddress = latestInbound?.fromAddress || latest.toAddress
    if (!toAddress) {
      return res.status(400).json({ error: 'Unable to resolve reply recipient for thread' })
    }
    const baseSubject = (latest.subject || '').replace(/^Re:\s*/i, '').trim() || 'No subject'
    const replySubject = `Re: ${baseSubject}`

    const { sendEmail, replyToMessage } = await import('../services/outlookEmailService.js')

    let result
    if (latestInbound?.providerMessageId) {
      result = await replyToMessage(prisma, {
        senderIdentityId: latest.senderIdentity.id,
        replyToMessageId: latestInbound.providerMessageId,
        htmlBody: content,
        toEmail: toAddress,
      })
    } else {
      result = await sendEmail(prisma, {
        senderIdentityId: latest.senderIdentity.id,
        toEmail: toAddress,
        subject: replySubject,
        htmlBody: content,
        textBody: content,
      })
    }

    if (!result.success) {
      return res.status(500).json({ error: 'Failed to send reply', details: result.error })
    }

    await prisma.emailMessageMetadata.create({
      data: {
        campaignProspectId: latest.campaignProspectId || null,
        senderIdentityId: latest.senderIdentity.id,
        providerMessageId: result.messageId || `sent_${randomUUID()}`,
        threadId: threadId,
        direction: 'outbound',
        fromAddress: latest.senderIdentity.emailAddress,
        toAddress: toAddress,
        subject: replySubject,
        bodyPreview: content.trim().slice(0, 500),
      },
    })

    if (latest.campaignProspectId) {
      await prisma.emailEvent.create({
        data: {
          customerId,
          campaignId: latest.campaignProspect?.campaignId || '',
          campaignProspectId: latest.campaignProspectId,
          senderIdentityId: latest.senderIdentity.id,
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
