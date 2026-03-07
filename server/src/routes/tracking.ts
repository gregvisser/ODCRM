import express from 'express'
import { randomUUID } from 'crypto'
import { OutboundSendQueueStatus } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

const router = express.Router()

async function upsertUnsubscribeSuppression(customerId: string, emailRaw: string) {
  const normalizedEmail = String(emailRaw || '').trim().toLowerCase()
  const domain = normalizedEmail.includes('@') ? normalizedEmail.split('@')[1].trim().toLowerCase() : ''
  if (!customerId || !normalizedEmail) return
  await prisma.suppressionEntry.upsert({
    where: {
      customerId_type_value: {
        customerId,
        type: 'email',
        value: normalizedEmail,
      },
    },
    update: {
      emailNormalized: normalizedEmail,
      reason: 'Unsubscribed via tracking link',
      source: 'tracking-unsubscribe',
    },
    create: {
      id: randomUUID(),
      customerId,
      type: 'email',
      value: normalizedEmail,
      emailNormalized: normalizedEmail,
      reason: 'Unsubscribed via tracking link',
      source: 'tracking-unsubscribe',
    },
  })
  if (domain && !domain.includes('@')) {
    await prisma.suppressionEntry.upsert({
      where: {
        customerId_type_value: {
          customerId,
          type: 'domain',
          value: domain,
        },
      },
      update: {
        reason: 'Unsubscribed via tracking link',
        source: 'tracking-unsubscribe',
      },
      create: {
        id: randomUUID(),
        customerId,
        type: 'domain',
        value: domain,
        emailNormalized: null,
        reason: 'Unsubscribed via tracking link',
        source: 'tracking-unsubscribe',
      },
    })
  }
}

// Open tracking pixel — GET /api/email/open?cpid=<campaignProspectId>
router.get('/open', async (req, res) => {
  try {
    const { cpid } = req.query

    if (!cpid || typeof cpid !== 'string') {
      return sendTransparentPixel(res)
    }

    const prospect = await prisma.emailCampaignProspect.findUnique({
      where: { id: cpid },
      include: {
        campaign: {
          select: {
            customerId: true,
            senderIdentityId: true,
          },
        },
      },
    })

    if (prospect) {
      await prisma.emailEvent.create({
        data: {
          customerId: prospect.campaign?.customerId || '',
          campaignId: prospect.campaignId,
          campaignProspectId: prospect.id,
          senderIdentityId: prospect.campaign?.senderIdentityId ?? undefined,
          type: 'opened',
          occurredAt: new Date(),
        },
      })

      await prisma.emailCampaignProspect.update({
        where: { id: prospect.id },
        data: {
          openCount: { increment: 1 },
          lastOpenedAt: new Date(),
        },
      })
    }

    sendTransparentPixel(res)
  } catch (error) {
    console.error('Error tracking email open:', error)
    sendTransparentPixel(res)
  }
})

// Click redirect — GET /api/email/click?cpid=<campaignProspectId>&url=<encodedUrl>
router.get('/click', async (req, res) => {
  const { cpid, url } = req.query

  const safeUrl =
    typeof url === 'string' && url.startsWith('http') ? url : null

  try {
    if (cpid && typeof cpid === 'string') {
      const prospect = await prisma.emailCampaignProspect.findUnique({
        where: { id: cpid },
        include: {
          campaign: {
            select: {
              customerId: true,
              senderIdentityId: true,
            },
          },
        },
      })

      if (prospect) {
        await prisma.emailEvent.create({
          data: {
            customerId: prospect.campaign?.customerId || '',
            campaignId: prospect.campaignId,
            campaignProspectId: prospect.id,
            senderIdentityId: prospect.campaign?.senderIdentityId ?? undefined,
            type: 'clicked',
            metadata: { url: safeUrl },
            occurredAt: new Date(),
          },
        })
      }
    }
  } catch (error) {
    console.error('Error tracking email click:', error)
  }

  if (safeUrl) {
    res.redirect(302, safeUrl)
  } else {
    res.status(400).send('Invalid redirect URL')
  }
})

// Unsubscribe page — GET /api/email/unsubscribe?cpid=<campaignProspectId>
router.get('/unsubscribe', async (req, res) => {
  try {
    const cpid = typeof req.query.cpid === 'string' ? req.query.cpid.trim() : ''
    const enrollmentId = typeof req.query.enrollmentId === 'string' ? req.query.enrollmentId.trim() : ''
    const emailParam = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : ''

    if (!cpid && !enrollmentId) {
      return res.send(unsubscribePage('error', 'Invalid unsubscribe link. Please contact support if you continue to receive unwanted emails.'))
    }

    if (cpid) {
      const prospect = await prisma.emailCampaignProspect.findUnique({
        where: { id: cpid },
        include: {
          contact: true,
          campaign: {
            select: {
              customerId: true,
              senderIdentityId: true,
            },
          },
        },
      })

      if (!prospect) {
        return res.send(unsubscribePage('not-found', 'This unsubscribe link is not valid.'))
      }

      if (prospect.unsubscribedAt) {
        return res.send(unsubscribePage('already', 'You have already been unsubscribed from this email list.'))
      }

      const customerId = prospect.campaign?.customerId || ''

      await prisma.emailEvent.create({
        data: {
          customerId,
          campaignId: prospect.campaignId,
          campaignProspectId: prospect.id,
          senderIdentityId: prospect.campaign?.senderIdentityId ?? undefined,
          type: 'opted_out',
          occurredAt: new Date(),
        },
      })

      await prisma.emailCampaignProspect.update({
        where: { id: prospect.id },
        data: {
          unsubscribedAt: new Date(),
          lastStatus: 'unsubscribed',
        },
      })

      await upsertUnsubscribeSuppression(customerId, String(prospect.contact?.email || ''))

      // Cancel any future unsent steps
      try {
        await (prisma as any).emailCampaignProspectStep.deleteMany({
          where: {
            campaignProspectId: prospect.id,
            sentAt: null,
          },
        })
      } catch {
        // ignore if schema not migrated yet
      }
      return res.send(unsubscribePage('success', 'You have been unsubscribed from this email list. You will no longer receive emails from this campaign.'))
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { id: true, customerId: true },
    })
    if (!enrollment || !emailParam) {
      return res.send(unsubscribePage('not-found', 'This unsubscribe link is not valid.'))
    }

    const recipient = await prisma.enrollmentRecipient.findFirst({
      where: {
        enrollmentId: enrollment.id,
        email: { equals: emailParam, mode: 'insensitive' },
      },
      select: { email: true },
    })
    if (!recipient) {
      return res.send(unsubscribePage('not-found', 'This unsubscribe link is not valid.'))
    }

    await upsertUnsubscribeSuppression(enrollment.customerId, recipient.email)
    await prisma.outboundSendQueueItem.updateMany({
      where: {
        customerId: enrollment.customerId,
        enrollmentId: enrollment.id,
        recipientEmail: { equals: recipient.email, mode: 'insensitive' },
        status: OutboundSendQueueStatus.QUEUED,
      },
      data: {
        status: OutboundSendQueueStatus.SKIPPED,
        lastError: 'unsubscribed_tracking_link',
        lockedAt: null,
        lockedBy: null,
      },
    })
    await prisma.enrollmentAuditEvent.create({
      data: {
        customerId: enrollment.customerId,
        enrollmentId: enrollment.id,
        recipientEmail: recipient.email,
        eventType: 'send_skipped',
        message: 'unsubscribe_link_clicked',
        meta: { reason: 'tracking_unsubscribe' },
      },
    })

    res.send(unsubscribePage('success', 'You have been unsubscribed from this email list.'))
  } catch (error) {
    console.error('Error processing unsubscribe:', error)
    res.send(unsubscribePage('error', 'An error occurred. Please try again later or contact support.'))
  }
})

function unsubscribePage(state: 'success' | 'error' | 'not-found' | 'already', message: string): string {
  const titles: Record<string, string> = {
    success: 'Unsubscribed Successfully',
    error: 'Unsubscribe Error',
    'not-found': 'Not Found',
    already: 'Already Unsubscribed',
  }
  return `<html><head><title>${titles[state] || 'Unsubscribe'}</title></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:50px auto;padding:20px;">
<h1>${titles[state] || 'Unsubscribe'}</h1>
<p>${message}</p>
</body></html>`
}

function sendTransparentPixel(res: express.Response): void {
  const pixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  )
  res.setHeader('Content-Type', 'image/png')
  res.setHeader('Content-Length', pixel.length.toString())
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  res.send(pixel)
}

export default router
