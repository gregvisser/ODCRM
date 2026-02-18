// @ts-nocheck
import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { triggerManualSync } from '../workers/leadsSync.js'

const router = Router()

/**
 * Timezone for lead metrics. Week is Monday–Sunday in this timezone.
 * Set LEADS_METRICS_TIMEZONE to override (e.g. "Europe/London").
 */
const METRICS_TIMEZONE = process.env.LEADS_METRICS_TIMEZONE || 'Europe/London'

/** Format a UTC Date as YYYY-MM-DD in the metrics timezone. */
function formatDateInMetricsTz (date: Date): string {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: METRICS_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
  const parts = fmt.formatToParts(date)
  const get = (type: string) => parts.find(p => p.type === type)?.value || '0'
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** Hour (0–23) of the given date in the metrics timezone. */
function getHourInMetricsTz (date: Date): number {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: METRICS_TIMEZONE, hour: '2-digit', hour12: false })
  return parseInt(fmt.format(date), 10)
}

/**
 * Return UTC Date for midnight (00:00) on the given calendar date (y, m, d) in the metrics timezone.
 * y,m,d are the calendar date in that timezone (m 0-based).
 */
function midnightInMetricsTzUtc (y: number, m: number, d: number): Date {
  for (let hourUtc = -2; hourUtc <= 2; hourUtc++) {
    const t = new Date(Date.UTC(y, m, d, hourUtc, 0, 0, 0))
    if (formatDateInMetricsTz(t) === `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` && getHourInMetricsTz(t) === 0) {
      return t
    }
  }
  const t = new Date(Date.UTC(y, m, d, 0, 0, 0, 0))
  const inLondon = formatDateInMetricsTz(t)
  const [ly, lm, ld] = inLondon.split('-').map(Number)
  if (ly === y && lm === m + 1 && ld === d && getHourInMetricsTz(t) === 1) {
    return new Date(Date.UTC(y, m, d, -1, 0, 0, 0))
  }
  if (ly === y && lm === m + 1 && ld === d - 1 && getHourInMetricsTz(t) === 23) {
    return new Date(Date.UTC(y, m, d, 1, 0, 0, 0))
  }
  return t
}

/**
 * Return { todayStart, todayEnd, weekStart, weekEnd, monthStart, monthEnd } as UTC Dates for the current moment in METRICS_TIMEZONE.
 * Week is Monday–Sunday.
 */
function getMetricsTimeRangesUtc (): { todayStart: Date, todayEnd: Date, weekStart: Date, weekEnd: Date, monthStart: Date, monthEnd: Date } {
  const now = new Date()
  const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: METRICS_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
  const weekdayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: METRICS_TIMEZONE, weekday: 'short' })
  const parts = dateFmt.formatToParts(now)
  const get = (type: string) => parts.find(p => p.type === type)?.value || '0'
  const y = parseInt(get('year'), 10)
  const m = parseInt(get('month'), 10) - 1
  const d = parseInt(get('day'), 10)

  const todayStart = midnightInMetricsTzUtc(y, m, d)
  const todayEnd = midnightInMetricsTzUtc(y, m, d + 1)

  const weekdayShort = weekdayFmt.format(now)
  const WEEKDAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
  const dow = WEEKDAY_ORDER.indexOf(weekdayShort as any)
  const mondayOffset = dow < 0 ? 0 : -dow
  const mondayD = d + mondayOffset
  const weekStart = midnightInMetricsTzUtc(y, m, mondayD)
  const nextMonday = new Date(Date.UTC(y, m, mondayD + 7, 12, 0, 0))
  const weekEnd = midnightInMetricsTzUtc(nextMonday.getUTCFullYear(), nextMonday.getUTCMonth(), nextMonday.getUTCDate())

  const monthStart = midnightInMetricsTzUtc(y, m, 1)
  const monthEnd = midnightInMetricsTzUtc(y, m + 1, 1)

  return { todayStart, todayEnd, weekStart, weekEnd, monthStart, monthEnd }
}

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    // Test database connection
    const leadCount = await prisma.leadRecord.count()
    const customerCount = await prisma.customer.count()
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        leadCount,
        customerCount,
      },
    })
  } catch (error) {
    console.error('Health check failed:', error)
    res.status(500).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

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

    const leads = leadRows.map((lead) => {
      try {
        const leadData = lead.data && typeof lead.data === 'object' ? lead.data as Record<string, any> : {}
        return {
          ...leadData,
          id: lead.id,
          accountName: lead.accountName,
          customerId: lead.customerId,
          status: lead.status,
          score: lead.score,
          convertedToContactId: lead.convertedToContactId,
          convertedAt: lead.convertedAt?.toISOString(),
          qualifiedAt: lead.qualifiedAt?.toISOString(),
          enrolledInSequenceId: lead.enrolledInSequenceId,
        }
      } catch (mapError) {
        console.error(`Error mapping lead ${lead.id}:`, mapError)
        return {
          id: lead.id,
          accountName: lead.accountName,
          customerId: lead.customerId,
          status: lead.status,
          error: 'Failed to map lead data',
        }
      }
    })

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
    console.error('❌ CRITICAL ERROR in GET /api/leads:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      customerId,
      since: since?.toISOString(),
    })
    return res.status(500).json({ 
      error: 'Failed to fetch leads',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
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

/** True if d is a valid Date (not Invalid Date). */
function isValidDate (d: unknown): d is Date {
  return d instanceof Date && !isNaN(d.getTime())
}

/**
 * Return UTC date ranges for metrics. If timezone-based computation yields any invalid date, fall back to UTC boundaries and log a warning.
 */
function getMetricsTimeRangesUtcSafe (): { todayStart: Date, todayEnd: Date, weekStart: Date, weekEnd: Date, monthStart: Date, monthEnd: Date } {
  let ranges: ReturnType<typeof getMetricsTimeRangesUtc> | null = null
  try {
    ranges = getMetricsTimeRangesUtc()
  } catch (e) {
    console.warn('[leads/metrics] getMetricsTimeRangesUtc threw, using UTC fallback:', e)
  }
  const ok =
    ranges != null &&
    isValidDate(ranges.todayStart) &&
    isValidDate(ranges.todayEnd) &&
    isValidDate(ranges.weekStart) &&
    isValidDate(ranges.weekEnd) &&
    isValidDate(ranges.monthStart) &&
    isValidDate(ranges.monthEnd)
  if (ok) return ranges

  console.warn('[leads/metrics] Invalid date(s) from getMetricsTimeRangesUtc, using UTC fallback (week = Mon–Sun UTC)')
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const d = now.getUTCDate()
  const utcDow = now.getUTCDay()
  const daysToMonday = utcDow === 0 ? 6 : utcDow - 1
  const todayStart = new Date(Date.UTC(y, m, d, 0, 0, 0, 0))
  const todayEnd = new Date(Date.UTC(y, m, d + 1, 0, 0, 0, 0))
  const weekStart = new Date(Date.UTC(y, m, d - daysToMonday, 0, 0, 0, 0))
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
  const monthStart = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0))
  const monthEnd = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0, 0))
  return { todayStart, todayEnd, weekStart, weekEnd, monthStart, monthEnd }
}

/**
 * Build a Prisma where clause for "lead date in [start, end)": (occurredAt in range) OR (occurredAt is null AND createdAt in range).
 * Uses equals: null for Prisma compatibility. Dates must be valid (use getMetricsTimeRangesUtcSafe).
 */
function leadDateInRange (customerId: string, start: Date, end: Date) {
  return {
    customerId,
    OR: [
      { occurredAt: { gte: start, lt: end } },
      { AND: [{ occurredAt: { equals: null } }, { createdAt: { gte: start, lt: end } }] },
    ],
  } as const
}

/** True if the error is Prisma complaining that occurredAt is unknown (e.g. prod schema without occurredAt). */
function isUnknownOccurredAtError (err: any): boolean {
  const msg = String(err?.message || '')
  return msg.includes('Unknown argument occurredAt') || msg.includes('Unknown argument `occurredAt`')
}

/** Where clause for "lead date in [start, end)" using occurredAt when present. Throws in prod if occurredAt missing (use fallback). */
function buildWhereWithOccurredAt (customerId: string, start: Date, end: Date) {
  return {
    customerId,
    OR: [
      { occurredAt: { gte: start, lt: end } },
      { AND: [{ occurredAt: { equals: null } }, { createdAt: { gte: start, lt: end } }] },
    ],
  } as const
}

/** Where clause for "lead createdAt in [start, end)" only. Used when occurredAt is missing in schema. */
function buildWhereCreatedAtOnly (customerId: string, start: Date, end: Date) {
  return { customerId, createdAt: { gte: start, lt: end } } as const
}

/**
 * GET /api/leads/metrics
 * Customer: prefer x-customer-id header; use query customerId only when header absent. Always verify customer exists.
 * Counts: DB-native (occurredAt in range OR occurredAt is null AND createdAt in range). Week = Monday–Sunday in LEADS_METRICS_TIMEZONE.
 *
 * Self-test (commented; run manually or in test):
 *   curl -s "http://localhost:3001/api/leads/metrics?customerId=cust_XXX"   -> 200 + JSON (customerId, counts, breakdownBySource, breakdownByOwner, lastSync)
 *   curl -s -H "x-customer-id: cust_XXX" "http://localhost:3001/api/leads/metrics" -> 200 + same shape (header wins when both set)
 *   Missing customerId -> 400 { error: "Customer ID required (...)" }
 *   Unknown customerId -> 404 { error: "Customer not found" }
 */
router.get('/metrics', async (req, res) => {
  const headerCustomerId = (req.header('x-customer-id') || '').trim()
  const queryCustomerId = typeof req.query.customerId === 'string' ? req.query.customerId.trim() : undefined
  const customerId = headerCustomerId || queryCustomerId
  const reqId = `${Date.now()}_${Math.random().toString(16).slice(2)}`

  if (!customerId) {
    return res.status(400).json({ error: 'Customer ID required (query customerId or header x-customer-id)' })
  }

  function logErr (stage: string, err: unknown): void {
    const e = err && typeof err === 'object' && err instanceof Error ? err : new Error(String(err))
    const payload: Record<string, unknown> = {
      tag: 'leadsMetricsError',
      stage,
      reqId,
      customerId,
      tz: METRICS_TIMEZONE,
      errName: e.name,
      errMessage: e.message,
      errStack: e.stack,
    }
    if (e && typeof e === 'object' && 'code' in e && (e as { code?: unknown }).code !== undefined) {
      payload.errCode = (e as { code: unknown }).code
    }
    if (e && typeof e === 'object' && 'meta' in e && (e as { meta?: unknown }).meta !== undefined) {
      payload.errMeta = (e as { meta: unknown }).meta
    }
    console.error(JSON.stringify(payload))
  }

  try {
    let customer: { id: string } | null = null
    try {
      customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { id: true },
      })
    } catch (err) {
      logErr('customer.exists', err)
      throw err
    }
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' })
    }

    const { todayStart, todayEnd, weekStart, weekEnd, monthStart, monthEnd } = getMetricsTimeRangesUtcSafe()

    async function countWithDateFallback (op: 'counts.today' | 'counts.week' | 'counts.month', start: Date, end: Date): Promise<number> {
      try {
        return await prisma.leadRecord.count({
          where: buildWhereWithOccurredAt(customerId, start, end),
        })
      } catch (err) {
        if (isUnknownOccurredAtError(err)) {
          console.warn(JSON.stringify({ tag: 'leadsMetricsFallback', reqId, reason: 'occurredAtMissing', op }))
          return await prisma.leadRecord.count({
            where: buildWhereCreatedAtOnly(customerId, start, end),
          })
        }
        logErr(op, err)
        throw err
      }
    }

    async function groupByWithFallback (op: 'breakdown.source.groupBy' | 'breakdown.owner.groupBy', by: 'source' | 'owner') {
      try {
        return await prisma.leadRecord.groupBy({
          by: [by],
          where: { customerId },
          _count: { id: true },
        })
      } catch (err) {
        if (isUnknownOccurredAtError(err)) {
          console.warn(JSON.stringify({ tag: 'leadsMetricsFallback', reqId, reason: 'occurredAtMissing', op }))
          return await prisma.leadRecord.groupBy({
            by: [by],
            where: { customerId },
            _count: { id: true },
          })
        }
        logErr(op, err)
        throw err
      }
    }

    const [countToday, countWeek, countMonth, total, bySourceRows, byOwnerRows, syncState] = await Promise.all([
      countWithDateFallback('counts.today', todayStart, todayEnd),
      countWithDateFallback('counts.week', weekStart, weekEnd),
      countWithDateFallback('counts.month', monthStart, monthEnd),
      prisma.leadRecord.count({ where: { customerId } })
        .catch(err => { logErr('counts.total', err); throw err }),
      groupByWithFallback('breakdown.source.groupBy', 'source'),
      groupByWithFallback('breakdown.owner.groupBy', 'owner'),
      prisma.leadSyncState.findUnique({ where: { customerId } })
        .catch(err => { logErr('lastSyncState', err); throw err }),
    ])

    const breakdownBySource: Record<string, number> = {}
    for (const row of bySourceRows) {
      const key = row.source != null && String(row.source).trim() !== '' ? String(row.source).trim() : '(none)'
      breakdownBySource[key] = row._count.id
    }
    const breakdownByOwner: Record<string, number> = {}
    for (const row of byOwnerRows) {
      const key = row.owner != null && String(row.owner).trim() !== '' ? String(row.owner).trim() : '(none)'
      breakdownByOwner[key] = row._count.id
    }

    const lastSync = syncState
      ? {
          lastSyncAt: syncState.lastSyncAt?.toISOString() ?? null,
          lastSuccessAt: syncState.lastSuccessAt?.toISOString() ?? null,
          lastError: syncState.lastError ?? null,
          isPaused: syncState.isPaused ?? false,
          isRunning: syncState.isRunning ?? false,
          rowCount: syncState.rowCount ?? null,
        }
      : null

    console.log(JSON.stringify({ tag: 'leadsMetricsOk', reqId, customerId, total }))

    res.json({
      customerId,
      timezone: METRICS_TIMEZONE,
      weekDefinition: 'Monday–Sunday (week boundaries in the timezone above)',
      counts: {
        today: countToday,
        week: countWeek,
        month: countMonth,
        total,
      },
      breakdownBySource,
      breakdownByOwner,
      lastSync,
    })
  } catch (error: unknown) {
    const err = error && typeof error === 'object' && error instanceof Error ? error : new Error(String(error))
    logErr('handler', err)
    res.status(500).json({ error: 'Failed to fetch lead metrics' })
  }
})

// Convert lead to contact
router.post('/:id/convert', async (req, res) => {
  try {
    const queryCustomerId = req.query.customerId as string | undefined
    const headerCustomerId = req.header('x-customer-id') || undefined
    const customerId = queryCustomerId || headerCustomerId

    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID required' })
    }

    const { id } = req.params
    const { sequenceId } = req.body // Optional: auto-enroll in sequence

    // Get the lead
    const lead = await prisma.leadRecord.findFirst({
      where: {
        id,
        customerId,
      },
    })

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' })
    }

    if (lead.convertedToContactId) {
      return res.status(400).json({ 
        error: 'Lead already converted',
        contactId: lead.convertedToContactId 
      })
    }

    // Extract contact data from lead JSON
    const leadData = lead.data as any
    const email = leadData['Email'] || leadData['email'] || ''
    const firstName = leadData['Name']?.split(' ')[0] || leadData['First Name'] || leadData['firstName'] || ''
    const lastName = leadData['Name']?.split(' ').slice(1).join(' ') || leadData['Last Name'] || leadData['lastName'] || ''
    const companyName = leadData['Company'] || leadData['company'] || lead.accountName || ''
    const jobTitle = leadData['Job Title'] || leadData['jobTitle'] || leadData['Title'] || null
    const phone = leadData['Phone'] || leadData['phone'] || null

    if (!email) {
      return res.status(400).json({ error: 'Lead data missing email address' })
    }

    // Check for duplicate contact by email
    const existingContact = await prisma.contact.findFirst({
      where: {
        customerId,
        email: email.toLowerCase().trim(),
      },
    })

    let contactId: string

    if (existingContact) {
      // Use existing contact
      contactId = existingContact.id
    } else {
      // Create new contact
      const newContact = await prisma.contact.create({
        data: {
          id: `contact_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          customerId,
          firstName: firstName || 'Unknown',
          lastName: lastName || '',
          email: email.toLowerCase().trim(),
          companyName,
          jobTitle,
          phone,
          source: 'lead_conversion',
        },
      })
      contactId = newContact.id
    }

    // Update lead with conversion info
    await prisma.leadRecord.update({
      where: { id },
      data: {
        convertedToContactId: contactId,
        convertedAt: new Date(),
        status: 'converted',
      },
    })

    // Auto-enroll in sequence if provided
    let enrollmentId: string | null = null
    if (sequenceId) {
      try {
        // Check if sequence exists and belongs to customer
        const sequence = await prisma.emailSequence.findFirst({
          where: {
            id: sequenceId,
            customerId,
          },
        })

        if (sequence) {
          // Check if already enrolled
          const existingEnrollment = await prisma.sequenceEnrollment.findFirst({
            where: {
              sequenceId,
              contactId,
            },
          })

          if (!existingEnrollment) {
            // Get first step to calculate next scheduled time
            const firstStep = await prisma.emailSequenceStep.findFirst({
              where: { sequenceId },
              orderBy: { stepOrder: 'asc' },
            })

            const nextStepScheduledAt = firstStep
              ? new Date(Date.now() + (firstStep.delayDaysFromPrevious || 0) * 24 * 60 * 60 * 1000)
              : new Date()

            const enrollment = await prisma.sequenceEnrollment.create({
              data: {
                id: `enroll_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                sequenceId,
                contactId,
                status: 'active',
                nextStepScheduledAt,
                enrolledAt: new Date(),
              },
            })
            enrollmentId = enrollment.id

            // Update lead with sequence enrollment
            await prisma.leadRecord.update({
              where: { id },
              data: {
                enrolledInSequenceId: sequenceId,
                status: 'nurturing',
              },
            })
          }
        }
      } catch (enrollError) {
        console.error('Error auto-enrolling in sequence:', enrollError)
        // Don't fail the conversion if enrollment fails
      }
    }

    res.json({
      success: true,
      contactId,
      isNewContact: !existingContact,
      enrollmentId,
      message: existingContact 
        ? 'Lead converted to existing contact' 
        : 'Lead converted to new contact',
    })
  } catch (error) {
    console.error('Error converting lead:', error)
    return res.status(500).json({ error: 'Failed to convert lead' })
  }
})

// Bulk convert leads to contacts
router.post('/bulk-convert', async (req, res) => {
  try {
    const queryCustomerId = req.query.customerId as string | undefined
    const headerCustomerId = req.header('x-customer-id') || undefined
    const customerId = queryCustomerId || headerCustomerId

    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID required' })
    }

    const { leadIds, sequenceId } = req.body

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ error: 'leadIds must be a non-empty array' })
    }

    const results = {
      converted: 0,
      skipped: 0,
      errorCount: 0,
      contactsCreated: 0,
      contactsExisting: 0,
      enrollments: 0,
      errors: [] as string[],
    }

    for (const leadId of leadIds) {
      try {
        const lead = await prisma.leadRecord.findFirst({
          where: {
            id: leadId,
            customerId,
          },
        })

        if (!lead) {
          results.errorCount++
          results.errors.push(`Lead ${leadId} not found`)
          continue
        }

        if (lead.convertedToContactId) {
          results.skipped++
          continue
        }

        // Extract contact data
        const leadData = lead.data as any
        const email = leadData['Email'] || leadData['email'] || ''
        if (!email) {
          results.errorCount++
          results.errors.push(`Lead ${leadId} missing email`)
          continue
        }

        const firstName = leadData['Name']?.split(' ')[0] || leadData['First Name'] || leadData['firstName'] || ''
        const lastName = leadData['Name']?.split(' ').slice(1).join(' ') || leadData['Last Name'] || leadData['lastName'] || ''
        const companyName = leadData['Company'] || leadData['company'] || lead.accountName || ''
        const jobTitle = leadData['Job Title'] || leadData['jobTitle'] || leadData['Title'] || null
        const phone = leadData['Phone'] || leadData['phone'] || null

        // Check for duplicate
        const existingContact = await prisma.contact.findFirst({
          where: {
            customerId,
            email: email.toLowerCase().trim(),
          },
        })

        let contactId: string

        if (existingContact) {
          contactId = existingContact.id
          results.contactsExisting++
        } else {
          const newContact = await prisma.contact.create({
            data: {
              id: `contact_${Date.now()}_${Math.random().toString(36).substring(7)}`,
              customerId,
              firstName: firstName || 'Unknown',
              lastName: lastName || '',
              email: email.toLowerCase().trim(),
              companyName,
              jobTitle,
              phone,
              source: 'lead_conversion',
            },
          })
          contactId = newContact.id
          results.contactsCreated++
        }

        // Update lead
        await prisma.leadRecord.update({
          where: { id: leadId },
          data: {
            convertedToContactId: contactId,
            convertedAt: new Date(),
            status: 'converted',
          },
        })

        // Auto-enroll if sequence provided
        if (sequenceId) {
          const sequence = await prisma.emailSequence.findFirst({
            where: {
              id: sequenceId,
              customerId,
            },
          })

          if (sequence) {
            const existingEnrollment = await prisma.sequenceEnrollment.findFirst({
              where: {
                sequenceId,
                contactId,
              },
            })

            if (!existingEnrollment) {
              const firstStep = await prisma.emailSequenceStep.findFirst({
                where: { sequenceId },
                orderBy: { stepOrder: 'asc' },
              })

              const nextStepScheduledAt = firstStep
                ? new Date(Date.now() + (firstStep.delayDaysFromPrevious || 0) * 24 * 60 * 60 * 1000)
                : new Date()

              await prisma.sequenceEnrollment.create({
                data: {
                  id: `enroll_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                  sequenceId,
                  contactId,
                  status: 'active',
                  nextStepScheduledAt,
                  enrolledAt: new Date(),
                },
              })

              await prisma.leadRecord.update({
                where: { id: leadId },
                data: {
                  enrolledInSequenceId: sequenceId,
                  status: 'nurturing',
                },
              })

              results.enrollments++
            }
          }
        }

        results.converted++
      } catch (error) {
        results.errorCount++
        results.errors.push(`Error converting lead ${leadId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    res.json(results)
  } catch (error) {
    console.error('Error in bulk convert:', error)
    return res.status(500).json({ error: 'Failed to bulk convert leads' })
  }
})

// Calculate lead score
router.post('/:id/score', async (req, res) => {
  try {
    const queryCustomerId = req.query.customerId as string | undefined
    const headerCustomerId = req.header('x-customer-id') || undefined
    const customerId = queryCustomerId || headerCustomerId

    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID required' })
    }

    const { id } = req.params

    const lead = await prisma.leadRecord.findFirst({
      where: {
        id,
        customerId,
      },
    })

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' })
    }

    const leadData = lead.data as any
    let score = 0

    // Score based on channel
    const channel = leadData['Channel of Lead'] || leadData['channel'] || ''
    const channelScores: Record<string, number> = {
      'referral': 90,
      'website': 70,
      'social media': 60,
      'email': 50,
      'cold call': 40,
      'other': 30,
    }
    score += channelScores[channel.toLowerCase()] || 30

    // Score based on outcome
    const outcome = leadData['Outcome'] || leadData['outcome'] || ''
    const outcomeScores: Record<string, number> = {
      'qualified': 50,
      'interested': 40,
      'follow-up': 30,
      'not interested': 0,
    }
    score += outcomeScores[outcome.toLowerCase()] || 20

    // Score based on company size (if available)
    const companySize = leadData['Company Size'] || leadData['companySize'] || ''
    if (companySize) {
      if (companySize.includes('1000+') || companySize.includes('500+')) {
        score += 20
      } else if (companySize.includes('100+') || companySize.includes('50+')) {
        score += 10
      }
    }

    // Cap score at 100
    score = Math.min(100, score)

    // Update lead with score
    await prisma.leadRecord.update({
      where: { id },
      data: { score },
    })

    // Auto-qualify if score >= 70
    if (score >= 70 && lead.status === 'new') {
      await prisma.leadRecord.update({
        where: { id },
        data: {
          status: 'qualified',
          qualifiedAt: new Date(),
        },
      })
    }

    res.json({ score, status: score >= 70 ? 'qualified' : lead.status })
  } catch (error) {
    console.error('Error scoring lead:', error)
    return res.status(500).json({ error: 'Failed to score lead' })
  }
})

// Update lead status
router.patch('/:id/status', async (req, res) => {
  try {
    const queryCustomerId = req.query.customerId as string | undefined
    const headerCustomerId = req.header('x-customer-id') || undefined
    const customerId = queryCustomerId || headerCustomerId

    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID required' })
    }

    const { id } = req.params
    const { status } = req.body

    const validStatuses = ['new', 'qualified', 'nurturing', 'closed', 'converted']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` })
    }

    const updateData: any = { status }
    if (status === 'qualified' && !req.body.qualifiedAt) {
      updateData.qualifiedAt = new Date()
    }

    const lead = await prisma.leadRecord.update({
      where: {
        id,
        customerId,
      },
      data: updateData,
    })

    res.json(lead)
  } catch (error) {
    console.error('Error updating lead status:', error)
    return res.status(500).json({ error: 'Failed to update lead status' })
  }
})

// Export leads to CSV
router.get('/export/csv', async (req, res) => {
  try {
    const queryCustomerId = req.query.customerId as string | undefined
    const headerCustomerId = req.header('x-customer-id') || undefined
    const customerId = queryCustomerId || headerCustomerId

    const where: any = {}
    if (customerId) {
      where.customerId = customerId
    }

    const leads = await prisma.leadRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    // Convert to CSV
    if (leads.length === 0) {
      return res.status(404).json({ error: 'No leads found' })
    }

    // Get all unique keys from lead data
    const allKeys = new Set<string>()
    leads.forEach(lead => {
      const data = lead.data as any
      Object.keys(data).forEach(key => allKeys.add(key))
    })

    const headers = ['ID', 'Account Name', 'Status', 'Score', 'Converted', 'Created At', ...Array.from(allKeys)]
    const rows = leads.map(lead => {
      const data = lead.data as any
      return [
        lead.id,
        lead.accountName,
        lead.status,
        lead.score || '',
        lead.convertedToContactId ? 'Yes' : 'No',
        lead.createdAt.toISOString(),
        ...Array.from(allKeys).map(key => data[key] || ''),
      ]
    })

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="leads-export-${Date.now()}.csv"`)
    res.send(csv)
  } catch (error) {
    console.error('Error exporting leads:', error)
    return res.status(500).json({ error: 'Failed to export leads' })
  }
})

// Analytics: Sequence performance by lead source
router.get('/analytics/sequence-performance', async (req, res) => {
  try {
    const queryCustomerId = req.query.customerId as string | undefined
    const headerCustomerId = req.header('x-customer-id') || undefined
    const customerId = queryCustomerId || headerCustomerId

    const where: any = {}
    if (customerId) {
      where.customerId = customerId
    }

    // Get all converted leads with sequence enrollment
    const convertedLeads = await prisma.leadRecord.findMany({
      where: {
        ...where,
        convertedToContactId: { not: null },
        enrolledInSequenceId: { not: null },
      },
      include: {
        convertedContact: {
          include: {
            sequenceEnrollments: {
              where: {
                sequenceId: { not: null },
              },
              include: {
                sequence: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    // Group by lead source (channel)
    const performanceBySource: Record<string, any> = {}

    for (const lead of convertedLeads) {
      const leadData = lead.data as any
      const source = leadData['Channel of Lead'] || leadData['channel'] || 'unknown'
      
      if (!performanceBySource[source]) {
        performanceBySource[source] = {
          source,
          totalLeads: 0,
          converted: 0,
          enrolled: 0,
          sequences: {} as Record<string, any>,
        }
      }

      performanceBySource[source].totalLeads++
      if (lead.convertedToContactId) {
        performanceBySource[source].converted++
      }
      if (lead.enrolledInSequenceId) {
        performanceBySource[source].enrolled++

        // Get sequence performance
        const enrollment = lead.convertedContact?.sequenceEnrollments.find(
          e => e.sequenceId === lead.enrolledInSequenceId
        )

        if (enrollment) {
          const seqName = enrollment.sequence.name
          if (!performanceBySource[source].sequences[seqName]) {
            performanceBySource[source].sequences[seqName] = {
              sequenceName: seqName,
              enrolled: 0,
              emailsSent: 0,
              opens: 0,
              clicks: 0,
              replies: 0,
            }
          }

          performanceBySource[source].sequences[seqName].enrolled++
          performanceBySource[source].sequences[seqName].emailsSent += enrollment.totalEmailsSent || 0
          performanceBySource[source].sequences[seqName].opens += enrollment.totalOpens || 0
          performanceBySource[source].sequences[seqName].clicks += enrollment.totalClicks || 0
          performanceBySource[source].sequences[seqName].replies += enrollment.totalReplies || 0
        }
      }
    }

    // Calculate conversion rates
    Object.values(performanceBySource).forEach((perf: any) => {
      perf.conversionRate = perf.totalLeads > 0 ? (perf.converted / perf.totalLeads) * 100 : 0
      perf.enrollmentRate = perf.converted > 0 ? (perf.enrolled / perf.converted) * 100 : 0

      // Calculate rates for each sequence
      Object.values(perf.sequences).forEach((seq: any) => {
        seq.openRate = seq.emailsSent > 0 ? (seq.opens / seq.emailsSent) * 100 : 0
        seq.clickRate = seq.emailsSent > 0 ? (seq.clicks / seq.emailsSent) * 100 : 0
        seq.replyRate = seq.emailsSent > 0 ? (seq.replies / seq.emailsSent) * 100 : 0
      })
    })

    res.json({
      timestamp: new Date().toISOString(),
      performanceBySource: Object.values(performanceBySource),
    })
  } catch (error) {
    console.error('Error in sequence performance analytics:', error)
    return res.status(500).json({ error: 'Failed to get analytics' })
  }
})

// Sync management endpoints

// Get sync status for a customer
router.get('/sync/status', async (req, res) => {
  try {
    const queryCustomerId = req.query.customerId as string | undefined
    const headerCustomerId = req.header('x-customer-id') || undefined
    const customerId = queryCustomerId || headerCustomerId

    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID required' })
    }

    const syncState = await prisma.leadSyncState.findUnique({
      where: { customerId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            leadsReportingUrl: true,
          },
        },
      },
    })

    if (!syncState) {
      return res.json({
        customerId,
        status: 'never_synced',
        isPaused: false,
        isRunning: false,
        lastSyncAt: null,
        lastSuccessAt: null,
        lastError: null,
        metrics: {
          rowCount: 0,
          syncDuration: null,
          rowsProcessed: 0,
          rowsInserted: 0,
          rowsUpdated: 0,
          rowsDeleted: 0,
          errorCount: 0,
          retryCount: 0,
        },
        progress: {
          percent: 0,
          message: 'Not started',
        },
      })
    }

    res.json({
      customerId,
      status: syncState.lastError ? 'error' : syncState.lastSuccessAt ? 'success' : 'never_synced',
      isPaused: syncState.isPaused || false,
      isRunning: syncState.isRunning || false,
      lastSyncAt: syncState.lastSyncAt?.toISOString() || null,
      lastSuccessAt: syncState.lastSuccessAt?.toISOString() || null,
      lastError: syncState.lastError || null,
      metrics: {
        rowCount: syncState.rowCount || 0,
        syncDuration: syncState.syncDuration || null,
        rowsProcessed: syncState.rowsProcessed || 0,
        rowsInserted: syncState.rowsInserted || 0,
        rowsUpdated: syncState.rowsUpdated || 0,
        rowsDeleted: syncState.rowsDeleted || 0,
        errorCount: syncState.errorCount || 0,
        retryCount: syncState.retryCount || 0,
      },
      progress: {
        percent: syncState.progressPercent || 0,
        message: syncState.progressMessage || 'Not started',
      },
      customer: syncState.customer,
    })
  } catch (error) {
    console.error('Error fetching sync status:', error)
    res.status(500).json({ error: 'Failed to fetch sync status' })
  }
})

// Get sync status for all customers
router.get('/sync/status/all', async (req, res) => {
  try {
    const syncStates = await prisma.leadSyncState.findMany({
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            leadsReportingUrl: true,
          },
        },
      },
      orderBy: { lastSyncAt: 'desc' },
    })

    const allStatuses = syncStates.map(state => ({
      customerId: state.customerId,
      status: state.lastError ? 'error' : state.lastSuccessAt ? 'success' : 'never_synced',
      isPaused: state.isPaused || false,
      isRunning: state.isRunning || false,
      lastSyncAt: state.lastSyncAt?.toISOString() || null,
      lastSuccessAt: state.lastSuccessAt?.toISOString() || null,
      lastError: state.lastError || null,
      metrics: {
        rowCount: state.rowCount || 0,
        syncDuration: state.syncDuration || null,
        rowsProcessed: state.rowsProcessed || 0,
        rowsInserted: state.rowsInserted || 0,
        rowsUpdated: state.rowsUpdated || 0,
        rowsDeleted: state.rowsDeleted || 0,
        errorCount: state.errorCount || 0,
        retryCount: state.retryCount || 0,
      },
      progress: {
        percent: state.progressPercent || 0,
        message: state.progressMessage || 'Not started',
      },
      customer: state.customer,
    }))

    res.json({
      total: allStatuses.length,
      statuses: allStatuses,
    })
  } catch (error) {
    console.error('Error fetching all sync statuses:', error)
    res.status(500).json({ error: 'Failed to fetch sync statuses' })
  }
})

// Manual sync trigger
router.post('/sync/trigger', async (req, res) => {
  try {
    const queryCustomerId = req.query.customerId as string | undefined
    const headerCustomerId = req.header('x-customer-id') || undefined
    const customerId = queryCustomerId || headerCustomerId

    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID required' })
    }

    // Check if sync is already running
    const syncState = await prisma.leadSyncState.findUnique({
      where: { customerId },
      select: { isRunning: true },
    })

    if (syncState?.isRunning) {
      return res.status(409).json({ error: 'Sync already in progress' })
    }

    // Trigger sync in background (don't await)
    triggerManualSync(prisma, customerId).catch((error) => {
      console.error('Error in manual sync:', error)
    })

    res.json({
      success: true,
      message: 'Sync triggered successfully',
      customerId,
    })
  } catch (error) {
    console.error('Error triggering sync:', error)
    res.status(500).json({ error: 'Failed to trigger sync' })
  }
})

// Pause sync
router.post('/sync/pause', async (req, res) => {
  try {
    const queryCustomerId = req.query.customerId as string | undefined
    const headerCustomerId = req.header('x-customer-id') || undefined
    const customerId = queryCustomerId || headerCustomerId

    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID required' })
    }

    await prisma.leadSyncState.upsert({
      where: { customerId },
      create: {
        id: `lead_sync_${customerId}`,
        customerId,
        isPaused: true,
      },
      update: {
        isPaused: true,
      },
    })

    res.json({
      success: true,
      message: 'Sync paused',
      customerId,
    })
  } catch (error) {
    console.error('Error pausing sync:', error)
    res.status(500).json({ error: 'Failed to pause sync' })
  }
})

// Resume sync
router.post('/sync/resume', async (req, res) => {
  try {
    const queryCustomerId = req.query.customerId as string | undefined
    const headerCustomerId = req.header('x-customer-id') || undefined
    const customerId = queryCustomerId || headerCustomerId

    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID required' })
    }

    await prisma.leadSyncState.upsert({
      where: { customerId },
      create: {
        id: `lead_sync_${customerId}`,
        customerId,
        isPaused: false,
      },
      update: {
        isPaused: false,
      },
    })

    res.json({
      success: true,
      message: 'Sync resumed',
      customerId,
    })
  } catch (error) {
    console.error('Error resuming sync:', error)
    res.status(500).json({ error: 'Failed to resume sync' })
  }
})

// Get sync performance metrics
router.get('/sync/metrics', async (req, res) => {
  try {
    const queryCustomerId = req.query.customerId as string | undefined
    const headerCustomerId = req.header('x-customer-id') || undefined
    const customerId = queryCustomerId || headerCustomerId

    const where: any = {}
    if (customerId) {
      where.customerId = customerId
    }

    const syncStates = await prisma.leadSyncState.findMany({
      where,
      select: {
        customerId: true,
        syncDuration: true,
        rowsProcessed: true,
        rowsInserted: true,
        rowsUpdated: true,
        rowsDeleted: true,
        errorCount: true,
        retryCount: true,
        lastSuccessAt: true,
        lastSyncAt: true,
      },
    })

    // Calculate aggregate metrics
    const totalSyncs = syncStates.length
    const successfulSyncs = syncStates.filter(s => s.lastSuccessAt).length
    const failedSyncs = syncStates.filter(s => s.lastSyncAt && !s.lastSuccessAt).length

    const avgDuration = syncStates
      .filter(s => s.syncDuration)
      .reduce((sum, s) => sum + (s.syncDuration || 0), 0) / syncStates.filter(s => s.syncDuration).length || 0

    const totalRowsProcessed = syncStates.reduce((sum, s) => sum + (s.rowsProcessed || 0), 0)
    const totalRowsInserted = syncStates.reduce((sum, s) => sum + (s.rowsInserted || 0), 0)
    const totalRowsUpdated = syncStates.reduce((sum, s) => sum + (s.rowsUpdated || 0), 0)
    const totalRowsDeleted = syncStates.reduce((sum, s) => sum + (s.rowsDeleted || 0), 0)
    const totalErrors = syncStates.reduce((sum, s) => sum + (s.errorCount || 0), 0)
    const totalRetries = syncStates.reduce((sum, s) => sum + (s.retryCount || 0), 0)

    res.json({
      timestamp: new Date().toISOString(),
      customerId: customerId || 'all',
      summary: {
        totalSyncs,
        successfulSyncs,
        failedSyncs,
        successRate: totalSyncs > 0 ? (successfulSyncs / totalSyncs) * 100 : 0,
        avgDuration: Math.round(avgDuration),
      },
      metrics: {
        totalRowsProcessed,
        totalRowsInserted,
        totalRowsUpdated,
        totalRowsDeleted,
        totalErrors,
        totalRetries,
        errorRate: totalRowsProcessed > 0 ? (totalErrors / totalRowsProcessed) * 100 : 0,
      },
      details: syncStates,
    })
  } catch (error) {
    console.error('Error fetching sync metrics:', error)
    res.status(500).json({ error: 'Failed to fetch sync metrics' })
  }
})

export default router
