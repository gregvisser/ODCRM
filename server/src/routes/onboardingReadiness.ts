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

    const [activeIdentities, suppressionEntries, leadSources, templates, sequences, customer] = await Promise.all([
      prisma.emailIdentity.count({ where: { customerId, isActive: true } }),
      prisma.suppressionEntry.count({ where: { customerId } }),
      prisma.contactList.count({ where: { customerId } }),
      prisma.emailTemplate.count({ where: { customerId } }),
      prisma.emailSequence.count({ where: { customerId } }),
      prisma.customer.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          leadsReportingUrl: true,
          accountData: true,
        },
      }),
    ])

    const accountData =
      customer?.accountData && typeof customer.accountData === 'object'
        ? (customer.accountData as Record<string, unknown>)
        : {}
    const dncSheetSources =
      accountData.dncSheetSources && typeof accountData.dncSheetSources === 'object'
        ? (accountData.dncSheetSources as Record<string, unknown>)
        : {}
    const emailSheetMeta =
      dncSheetSources.email && typeof dncSheetSources.email === 'object'
        ? (dncSheetSources.email as Record<string, unknown>)
        : {}
    const domainSheetMeta =
      dncSheetSources.domain && typeof dncSheetSources.domain === 'object'
        ? (dncSheetSources.domain as Record<string, unknown>)
        : {}
    const suppressionSheetsConfigured =
      (typeof emailSheetMeta.sheetUrl === 'string' && emailSheetMeta.sheetUrl.trim().length > 0) ||
      (typeof domainSheetMeta.sheetUrl === 'string' && domainSheetMeta.sheetUrl.trim().length > 0)
    const leadSheetConfigured = typeof customer?.leadsReportingUrl === 'string' && customer.leadsReportingUrl.trim().length > 0

    const checks = {
      emailIdentitiesConnected: activeIdentities > 0,
      // Transitional model: consider suppression configured when Google Sheets sources are linked
      // or existing suppression entries already exist in DB.
      suppressionConfigured: suppressionSheetsConfigured || suppressionEntries > 0,
      // Transitional model: support either lead-source records or customer-level lead reporting sheet URL.
      leadSourceConfigured: leadSources > 0 || leadSheetConfigured,
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
          suppressionSheetsConfigured,
          leadSheetConfigured,
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
