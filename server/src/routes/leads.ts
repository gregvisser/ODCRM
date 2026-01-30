// @ts-nocheck
import { Router } from 'express'
import { prisma } from '../lib/prisma.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const queryCustomerId = req.query.customerId as string | undefined
    const headerCustomerId = req.header('x-customer-id') || undefined
    let customerId = queryCustomerId

    if (!customerId && headerCustomerId) {
      const exists = await prisma.customer.findUnique({
        where: { id: headerCustomerId },
        select: { id: true },
      })
      if (exists) {
        customerId = headerCustomerId
      }
    }
    const since = req.query.since ? new Date(String(req.query.since)) : null

    const where: any = {
      customer: {
        leadsReportingUrl: { not: null },
      },
    }
    if (customerId) {
      where.customerId = customerId
    }
    if (since && !isNaN(since.getTime())) {
      where.updatedAt = { gte: since }
    }

    const leadRows = await prisma.leadRecord.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    })

    let lastSyncAt: Date | null = null
    if (customerId) {
      const state = await prisma.leadSyncState.findUnique({ where: { customerId } })
      lastSyncAt = state?.lastSuccessAt || state?.lastSyncAt || null
    } else {
      const latest = await prisma.leadSyncState.findFirst({
        orderBy: { lastSuccessAt: 'desc' },
      })
      lastSyncAt = latest?.lastSuccessAt || latest?.lastSyncAt || null
    }

    const leads = leadRows.map((lead) => ({
      ...(lead.data || {}),
      accountName: lead.accountName,
      customerId: lead.customerId,
    }))

    // Add comprehensive diagnostics logging
    console.log(`📊 LEADS API RESPONSE - ${new Date().toISOString()}`)
    console.log(`   Customer ID: ${customerId || 'ALL'}`)
    console.log(`   Since filter: ${since?.toISOString() || 'NONE'}`)
    console.log(`   Total leads in DB: ${leadRows.length}`)
    console.log(`   Last sync at: ${lastSyncAt?.toISOString() || 'NEVER'}`)

    // Count by account
    const accountCounts = leadRows.reduce((acc, lead) => {
      acc[lead.accountName] = (acc[lead.accountName] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    console.log(`   Leads by account:`, accountCounts)

    // Calculate checksum for data integrity
    const crypto = await import('crypto')
    const dataString = JSON.stringify(leads)
    const checksum = crypto.createHash('md5').update(dataString).digest('hex')
    console.log(`   Data checksum: ${checksum}`)

    return res.json({
      leads,
      lastSyncAt: lastSyncAt ? lastSyncAt.toISOString() : null,
      diagnostics: {
        totalLeads: leadRows.length,
        accountCounts,
        checksum,
        queriedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Error fetching leads:', error)
    return res.status(500).json({ error: 'Failed to fetch leads' })
  }
})

// Aggregations endpoint for detailed analytics
router.get('/aggregations', async (req, res) => {
  try {
    const customerId = req.query.customerId as string | undefined
    const timeframe = req.query.timeframe as 'week' | 'month' | 'all' || 'all'

    // Get all leads for the customer(s)
    const where: any = {
      customer: {
        leadsReportingUrl: { not: null },
      },
    }
    if (customerId) {
      where.customerId = customerId
    }

    const leadRecords = await prisma.leadRecord.findMany({
      where,
      select: {
        customerId: true,
        accountName: true,
        data: true,
      },
    })

    // Re-calculate aggregations from current data
    const customerAggregations: Record<string, any> = {}

    // Group leads by customer
    const leadsByCustomer = leadRecords.reduce((acc, record) => {
      if (!acc[record.customerId]) {
        acc[record.customerId] = []
      }
      acc[record.customerId].push({
        ...record.data,
        accountName: record.accountName,
      } as LeadRow)
      return acc
    }, {} as Record<string, LeadRow[]>)

    // Calculate aggregations for each customer
    for (const [custId, leads] of Object.entries(leadsByCustomer)) {
      const accountName = leads[0]?.accountName || 'Unknown'
      const { aggregations } = calculateActualsFromLeads(accountName, leads)

      customerAggregations[custId] = {
        accountName,
        totalLeads: leads.length,
        ...aggregations,
      }
    }

    // Global aggregations across all customers
    const allLeads = Object.values(leadsByCustomer).flat()
    const globalAccountName = 'All Accounts'
    const { aggregations: globalAggregations } = calculateActualsFromLeads(globalAccountName, allLeads)

    const result = {
      timestamp: new Date().toISOString(),
      timeframe,
      customerAggregations,
      globalAggregations: {
        accountName: globalAccountName,
        totalLeads: allLeads.length,
        ...globalAggregations,
      },
    }

    console.log(`📊 LEADS AGGREGATIONS REQUESTED - ${result.timestamp}`)
    console.log(`   Customers: ${Object.keys(customerAggregations).length}`)
    console.log(`   Total leads: ${allLeads.length}`)

    res.json(result)
  } catch (error) {
    console.error('Error in leads aggregations:', error)
    res.status(500).json({ error: 'Failed to get aggregations' })
  }
})

// Diagnostics endpoint for monitoring and debugging
router.get('/diagnostics', async (req, res) => {
  try {
    const customerId = req.query.customerId as string | undefined

    // Get sync states
    const syncStates = customerId
      ? await prisma.leadSyncState.findUnique({ where: { customerId } })
      : await prisma.leadSyncState.findMany({
          orderBy: { lastSuccessAt: 'desc' },
          take: 10,
        })

    // Get lead counts by customer
    const leadCounts = await prisma.leadRecord.groupBy({
      by: ['customerId', 'accountName'],
      _count: { id: true },
      orderBy: { customerId: 'asc' },
    })

    // Get recent sync history (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentSyncs = await prisma.leadSyncState.findMany({
      where: {
        lastSyncAt: { gte: yesterday },
      },
      orderBy: { lastSyncAt: 'desc' },
    })

    // Calculate data integrity metrics
    const totalLeads = await prisma.leadRecord.count()
    const customersWithLeads = await prisma.leadRecord.findMany({
      select: { customerId: true },
      distinct: ['customerId'],
    })

    const diagnostics = {
      timestamp: new Date().toISOString(),
      totalLeads,
      customersWithLeads: customersWithLeads.length,
      leadCounts,
      syncStates: Array.isArray(syncStates) ? syncStates : [syncStates].filter(Boolean),
      recentSyncs,
      health: {
        hasData: totalLeads > 0,
        hasRecentSync: recentSyncs.length > 0,
        lastSyncAge: recentSyncs[0]?.lastSuccessAt
          ? Date.now() - new Date(recentSyncs[0].lastSuccessAt).getTime()
          : null,
      },
    }

    console.log(`🔍 LEADS DIAGNOSTICS REQUESTED - ${diagnostics.timestamp}`)
    console.log(`   Total leads: ${totalLeads}`)
    console.log(`   Customers with leads: ${customersWithLeads.length}`)
    console.log(`   Recent syncs (24h): ${recentSyncs.length}`)

    res.json(diagnostics)
  } catch (error) {
    console.error('Error in leads diagnostics:', error)
    res.status(500).json({ error: 'Failed to get diagnostics' })
  }
})

export default router
