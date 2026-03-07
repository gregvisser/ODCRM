import express from 'express'
import { prisma } from '../lib/prisma.js'

const router = express.Router()

function getCustomerId(req: express.Request): string {
  const customerId = (req.headers['x-customer-id'] as string) || (req.query.customerId as string)
  if (!customerId) {
    const err = new Error('Customer ID required') as Error & { status?: number }
    err.status = 400
    throw err
  }
  return customerId
}

router.get('/readiness', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)

    const [activeIdentities, suppressionEntries, leadSources, templates, sequences] = await Promise.all([
      prisma.emailIdentity.count({ where: { customerId, isActive: true } }),
      prisma.suppressionEntry.count({ where: { customerId } }),
      prisma.contactList.count({ where: { customerId } }),
      prisma.emailTemplate.count({ where: { customerId } }),
      prisma.emailSequence.count({ where: { customerId } }),
    ])

    const checks = {
      emailIdentitiesConnected: activeIdentities > 0,
      suppressionConfigured: suppressionEntries > 0,
      leadSourceConfigured: leadSources > 0,
      templateAndSequenceReady: templates > 0 && sequences > 0,
    }

    res.json({
      success: true,
      data: {
        customerId,
        counts: {
          activeIdentities,
          suppressionEntries,
          leadSources,
          templates,
          sequences,
        },
        checks,
        ready: Object.values(checks).every(Boolean),
      },
    })
  } catch (error) {
    next(error)
  }
})

export default router
