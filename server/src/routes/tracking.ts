import express from 'express'
import { prisma } from '../lib/prisma.js'

const router = express.Router()

// Open tracking pixel
router.get('/open', async (req, res) => {
  try {
    const { cpid } = req.query // campaignProspectId

    if (!cpid || typeof cpid !== 'string') {
      // Return transparent pixel anyway
      return sendTransparentPixel(res)
    }

    // Find prospect
    const prospect = await prisma.emailCampaignProspect.findUnique({
      where: { id: cpid }
    })

    if (prospect) {
      // Record event
      await prisma.emailEvent.create({
        data: {
          campaignId: prospect.campaignId,
          campaignProspectId: prospect.id,
          type: 'opened',
          occurredAt: new Date()
        }
      })

      // Update prospect stats
      await prisma.emailCampaignProspect.update({
        where: { id: prospect.id },
        data: {
          openCount: { increment: 1 },
          lastOpenedAt: new Date()
        }
      })
    }

    sendTransparentPixel(res)
  } catch (error) {
    console.error('Error tracking email open:', error)
    sendTransparentPixel(res)
  }
})

// Unsubscribe page
router.get('/unsubscribe', async (req, res) => {
  try {
    const { cpid, token } = req.query

    if (!cpid || typeof cpid !== 'string') {
      return res.send(`
        <html>
          <head><title>Unsubscribe</title></head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
            <h1>Unsubscribe Error</h1>
            <p>Invalid unsubscribe link. Please contact support if you continue to receive unwanted emails.</p>
          </body>
        </html>
      `)
    }

    const prospect = await prisma.emailCampaignProspect.findUnique({
      where: { id: cpid },
      include: {
        contact: true
      }
    })

    if (!prospect) {
      return res.send(`
        <html>
          <head><title>Unsubscribe</title></head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
            <h1>Not Found</h1>
            <p>This unsubscribe link is not valid.</p>
          </body>
        </html>
      `)
    }

    // Check if already unsubscribed
    if (prospect.unsubscribedAt) {
      return res.send(`
        <html>
          <head><title>Already Unsubscribed</title></head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
            <h1>Already Unsubscribed</h1>
            <p>You have already been unsubscribed from this email list.</p>
          </body>
        </html>
      `)
    }

    // Record unsubscribe
    await prisma.emailEvent.create({
      data: {
        campaignId: prospect.campaignId,
        campaignProspectId: prospect.id,
        type: 'unsubscribed',
        occurredAt: new Date()
      }
    })

    // Update prospect
    await prisma.emailCampaignProspect.update({
      where: { id: prospect.id },
      data: {
        unsubscribedAt: new Date(),
        lastStatus: 'unsubscribed'
      }
    })

    // New scheduler: cancel any future (unsent) steps for this prospect.
    try {
      await (prisma as any).emailCampaignProspectStep.deleteMany({
        where: {
          campaignProspectId: prospect.id,
          sentAt: null
        }
      })
    } catch {
      // ignore if schema not migrated yet
    }

    res.send(`
      <html>
        <head><title>Unsubscribed</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
          <h1>Unsubscribed Successfully</h1>
          <p>You have been unsubscribed from this email list. You will no longer receive emails from this campaign.</p>
          <p>If you have any questions, please contact support.</p>
        </body>
      </html>
    `)
  } catch (error) {
    console.error('Error processing unsubscribe:', error)
    res.send(`
      <html>
        <head><title>Error</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
          <h1>Error</h1>
          <p>An error occurred while processing your unsubscribe request. Please try again later or contact support.</p>
        </body>
      </html>
    `)
  }
})

// Helper: Send 1x1 transparent PNG
function sendTransparentPixel(res: express.Response) {
  // 1x1 transparent PNG
  const pixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  )

  res.setHeader('Content-Type', 'image/png')
  res.setHeader('Content-Length', pixel.length.toString())
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  res.send(pixel)
}

export default router
