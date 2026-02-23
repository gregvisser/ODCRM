import express from 'express'
import { prisma } from '../lib/prisma.js'

const router = express.Router()

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
    const { cpid } = req.query

    if (!cpid || typeof cpid !== 'string') {
      return res.send(unsubscribePage('error', 'Invalid unsubscribe link. Please contact support if you continue to receive unwanted emails.'))
    }

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

    res.send(unsubscribePage('success', 'You have been unsubscribed from this email list. You will no longer receive emails from this campaign.'))
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
