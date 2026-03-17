/**
 * Reporting Dashboard API — operator-grade, tenant-scoped reporting.
 * All endpoints require X-Customer-Id (or query customerId). No silent defaults.
 * Metrics are derived from DB truth only; unavailable metrics are omitted or explicitly null.
 */
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma.js'
import { isClientMode, requireCustomerId } from '../utils/tenantId.js'
import {
  getDateRangeFilter,
  getLeadCreatedWithinPeriodWhere,
  getPreviousReportingPeriod,
  resolveReportingPeriod,
  sumLeadTargets,
} from '../utils/reportingPeriods.js'

const router = Router()

type ReportingScope = {
  scope: 'single' | 'all'
  customerId: string
  customerIds: string[]
  customerCount: number
  customerNamesById: Map<string, string>
}

function isOptOutEventType(value: unknown): boolean {
  return value === 'opted_out' || value === 'unsubscribed'
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function wantsAllClientsScope(req: Request): boolean {
  const scopeParam = normalizeString(req.query.scope).toLowerCase()
  const headerCustomerId = normalizeString(req.headers['x-customer-id']).toLowerCase()
  const queryCustomerId = normalizeString(req.query.customerId).toLowerCase()
  return scopeParam === 'all' || headerCustomerId === 'all' || queryCustomerId === 'all'
}

function hasConflictingCustomerScope(req: Request): boolean {
  const headerCustomerId = normalizeString(req.headers['x-customer-id'])
  const queryCustomerId = normalizeString(req.query.customerId)
  return [headerCustomerId, queryCustomerId].some((value) => value && value.toLowerCase() !== 'all')
}

function getCustomerIdFilter(customerIds: string[]): string | { in: string[] } {
  return customerIds.length === 1 ? customerIds[0] : { in: customerIds }
}

function zeroSummaryData(scope: ReportingScope, period: ReturnType<typeof resolveReportingPeriod>) {
  return {
    customerId: scope.customerId,
    scope: scope.scope,
    customerCount: scope.customerCount,
    sinceDays: period.sinceDays,
    periodType: period.periodType,
    periodStart: period.start.toISOString(),
    periodEnd: period.end.toISOString(),
    generatedAt: new Date().toISOString(),
    leadsCreated: 0,
    leadsTarget: scope.scope === 'all' ? 0 : null,
    percentToTarget: null,
    emailsSent: 0,
    delivered: null,
    openRate: null,
    replyRate: null,
    replyCount: 0,
    positiveReplyCount: null,
    meetingsBooked: null,
    bounces: 0,
    unsubscribes: 0,
    suppressedEmails: 0,
    suppressedDomains: 0,
    sendFailures: 0,
  }
}

async function resolveReportingScope(req: Request, res: Response): Promise<ReportingScope | null> {
  if (!wantsAllClientsScope(req)) {
    const customerId = requireCustomerId(req, res)
    if (!customerId) return null
    return {
      scope: 'single',
      customerId,
      customerIds: [customerId],
      customerCount: 1,
      customerNamesById: new Map(),
    }
  }

  if (hasConflictingCustomerScope(req)) {
    res.status(400).json({ success: false, error: 'scope=all cannot be combined with a specific customerId or X-Customer-Id' })
    return null
  }

  if (isClientMode()) {
    res.status(403).json({ success: false, error: 'All clients reporting is not allowed in client mode' })
    return null
  }

  const customers = await prisma.customer.findMany({
    where: { isArchived: false },
    select: { id: true, name: true },
    orderBy: { createdAt: 'desc' },
  })

  return {
    scope: 'all',
    customerId: 'all',
    customerIds: customers.map((customer) => customer.id),
    customerCount: customers.length,
    customerNamesById: new Map(customers.map((customer) => [customer.id, customer.name])),
  }
}

// --- GET /api/reporting/summary ---
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const reportingScope = await resolveReportingScope(req, res)
    if (!reportingScope) return
    const period = resolveReportingPeriod(req.query)
    if (reportingScope.customerIds.length === 0) {
      res.json({ success: true, data: zeroSummaryData(reportingScope, period) })
      return
    }
    const customerIdFilter = getCustomerIdFilter(reportingScope.customerIds)
    const periodRange = getDateRangeFilter(period)

    const [customers, leadCount, eventCounts, suppressionCounts, queueCounts] = await Promise.all([
      prisma.customer.findMany({
        where: { id: { in: reportingScope.customerIds } },
        select: {
          id: true,
          weeklyLeadTarget: true,
          monthlyLeadTarget: true,
        },
      }),
      prisma.leadRecord.count({
        where: {
          customerId: customerIdFilter,
          ...getLeadCreatedWithinPeriodWhere(period),
        },
      }),
      prisma.emailEvent.groupBy({
        by: ['type'],
        where: { customerId: customerIdFilter, occurredAt: periodRange },
        _count: { id: true },
      }),
      prisma.suppressionEntry.groupBy({
        by: ['type'],
        where: { customerId: customerIdFilter },
        _count: { id: true },
      }),
      prisma.outboundSendQueueItem.groupBy({
        by: ['status'],
        where: { customerId: customerIdFilter, createdAt: periodRange },
        _count: { id: true },
      }),
    ])

    const events: Record<string, number> = {}
    eventCounts.forEach((e) => { events[e.type] = e._count.id })
    const sent = events['sent'] ?? 0
    const delivered = events['delivered'] ?? 0
    const opened = events['opened'] ?? 0
    const replied = events['replied'] ?? 0
    const bounced = events['bounced'] ?? 0
    const optedOut = Object.entries(events).reduce(
      (sum, [type, count]) => (isOptOutEventType(type) ? sum + count : sum),
      0,
    )
    const failed = events['failed'] ?? 0

    const suppressionsByType: Record<string, number> = {}
    suppressionCounts.forEach((s) => { suppressionsByType[s.type] = s._count.id })
    const suppressedEmails = suppressionsByType['email'] ?? 0
    const suppressedDomains = suppressionsByType['domain'] ?? 0

    const queueByStatus: Record<string, number> = {}
    queueCounts.forEach((q) => { queueByStatus[q.status] = q._count.id })
    const queueSent = queueByStatus['SENT'] ?? 0
    const queueFailed = queueByStatus['FAILED'] ?? 0

    const targetValue = sumLeadTargets(customers, period)
    const normalizedTargetValue = reportingScope.scope === 'all' ? targetValue : (targetValue > 0 ? targetValue : null)
    const percentToTarget =
      normalizedTargetValue != null && normalizedTargetValue > 0 ? Math.round((leadCount / normalizedTargetValue) * 100) : null

    res.json({
      success: true,
      data: {
        customerId: reportingScope.customerId,
        scope: reportingScope.scope,
        customerCount: reportingScope.customerCount,
        sinceDays: period.sinceDays,
        periodType: period.periodType,
        periodStart: period.start.toISOString(),
        periodEnd: period.end.toISOString(),
        generatedAt: new Date().toISOString(),
        leadsCreated: leadCount,
        leadsTarget: normalizedTargetValue,
        percentToTarget,
        emailsSent: sent || queueSent,
        delivered: delivered || null,
        openRate: delivered > 0 && opened >= 0 ? Math.round((opened / delivered) * 1000) / 10 : null,
        replyRate: (sent || queueSent) > 0 ? Math.round((replied / (sent || queueSent)) * 1000) / 10 : null,
        replyCount: replied,
        positiveReplyCount: null,
        meetingsBooked: null,
        bounces: bounced,
        unsubscribes: optedOut,
        suppressedEmails,
        suppressedDomains,
        sendFailures: failed || queueFailed,
      },
    })
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Summary failed',
    })
  }
})

// --- GET /api/reporting/leads-vs-target ---
router.get('/leads-vs-target', async (req: Request, res: Response) => {
  try {
    const reportingScope = await resolveReportingScope(req, res)
    if (!reportingScope) return
    const currentPeriod = resolveReportingPeriod(req.query)
    const previousPeriod = getPreviousReportingPeriod(currentPeriod)
    if (reportingScope.customerIds.length === 0) {
      res.json({
        success: true,
        data: {
          customerId: reportingScope.customerId,
          scope: reportingScope.scope,
          customerCount: reportingScope.customerCount,
          sinceDays: currentPeriod.sinceDays,
          periodType: currentPeriod.periodType,
          periodStart: currentPeriod.start.toISOString(),
          periodEnd: currentPeriod.end.toISOString(),
          leadsCreated: 0,
          leadsTarget: 0,
          percentToTarget: null,
          previousPeriodLeads: 0,
          trendVsPrevious: null,
          generatedAt: new Date().toISOString(),
        },
      })
      return
    }
    const customerIdFilter = getCustomerIdFilter(reportingScope.customerIds)

    const [customers, currentLeads, previousLeads] = await Promise.all([
      prisma.customer.findMany({
        where: { id: { in: reportingScope.customerIds } },
        select: { weeklyLeadTarget: true, monthlyLeadTarget: true },
      }),
      prisma.leadRecord.count({
        where: {
          customerId: customerIdFilter,
          ...getLeadCreatedWithinPeriodWhere(currentPeriod),
        },
      }),
      prisma.leadRecord.count({
        where: {
          customerId: customerIdFilter,
          ...getLeadCreatedWithinPeriodWhere(previousPeriod),
        },
      }),
    ])

    const targetValue = sumLeadTargets(customers, currentPeriod)
    const normalizedTargetValue = reportingScope.scope === 'all' ? targetValue : (targetValue > 0 ? targetValue : null)
    const percentToTarget =
      normalizedTargetValue != null && normalizedTargetValue > 0 ? Math.round((currentLeads / normalizedTargetValue) * 100) : null
    const trend = previousLeads > 0 ? currentLeads - previousLeads : null

    res.json({
      success: true,
      data: {
        customerId: reportingScope.customerId,
        scope: reportingScope.scope,
        customerCount: reportingScope.customerCount,
        sinceDays: currentPeriod.sinceDays,
        periodType: currentPeriod.periodType,
        periodStart: currentPeriod.start.toISOString(),
        periodEnd: currentPeriod.end.toISOString(),
        leadsCreated: currentLeads,
        leadsTarget: normalizedTargetValue,
        percentToTarget,
        previousPeriodLeads: previousLeads,
        trendVsPrevious: trend,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Leads vs target failed',
    })
  }
})

// --- GET /api/reporting/leads-by-source ---
router.get('/leads-by-source', async (req: Request, res: Response) => {
  try {
    const reportingScope = await resolveReportingScope(req, res)
    if (!reportingScope) return
    const period = resolveReportingPeriod(req.query)
    if (reportingScope.customerIds.length === 0) {
      res.json({
        success: true,
        data: {
          customerId: reportingScope.customerId,
          scope: reportingScope.scope,
          customerCount: reportingScope.customerCount,
          sinceDays: period.sinceDays,
          periodType: period.periodType,
          periodStart: period.start.toISOString(),
          periodEnd: period.end.toISOString(),
          totalLeads: 0,
          bySource: [],
          topByVolume: null,
          generatedAt: new Date().toISOString(),
        },
      })
      return
    }
    const customerIdFilter = getCustomerIdFilter(reportingScope.customerIds)

    const groups = await prisma.leadRecord.groupBy({
      by: ['source'],
      where: {
        customerId: customerIdFilter,
        ...getLeadCreatedWithinPeriodWhere(period),
      },
      _count: { id: true },
    })

    const total = groups.reduce((sum, g) => sum + g._count.id, 0)
    const bySource = groups
      .map((g) => ({
        source: g.source ?? 'Unknown',
        count: g._count.id,
        percent: total > 0 ? Math.round((g._count.id / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count)

    const topByVolume = bySource[0] ?? null

    res.json({
      success: true,
      data: {
        customerId: reportingScope.customerId,
        scope: reportingScope.scope,
        customerCount: reportingScope.customerCount,
        sinceDays: period.sinceDays,
        periodType: period.periodType,
        periodStart: period.start.toISOString(),
        periodEnd: period.end.toISOString(),
        totalLeads: total,
        bySource,
        topByVolume,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Leads by source failed',
    })
  }
})

// --- GET /api/reporting/top-sourcers ---
router.get('/top-sourcers', async (req: Request, res: Response) => {
  try {
    const reportingScope = await resolveReportingScope(req, res)
    if (!reportingScope) return
    const period = resolveReportingPeriod(req.query)
    if (reportingScope.customerIds.length === 0) {
      res.json({
        success: true,
        data: {
          customerId: reportingScope.customerId,
          scope: reportingScope.scope,
          customerCount: reportingScope.customerCount,
          sinceDays: period.sinceDays,
          periodType: period.periodType,
          periodStart: period.start.toISOString(),
          periodEnd: period.end.toISOString(),
          totalLeads: 0,
          sourcers: [],
          generatedAt: new Date().toISOString(),
        },
      })
      return
    }
    const customerIdFilter = getCustomerIdFilter(reportingScope.customerIds)

    const groups = await prisma.leadRecord.groupBy({
      by: ['owner'],
      where: {
        customerId: customerIdFilter,
        ...getLeadCreatedWithinPeriodWhere(period),
      },
      _count: { id: true },
    })

    const total = groups.reduce((sum, g) => sum + g._count.id, 0)
    const sourcers = groups
      .map((g) => ({
        owner: g.owner ?? 'Unassigned',
        count: g._count.id,
        percent: total > 0 ? Math.round((g._count.id / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count)

    res.json({
      success: true,
      data: {
        customerId: reportingScope.customerId,
        scope: reportingScope.scope,
        customerCount: reportingScope.customerCount,
        sinceDays: period.sinceDays,
        periodType: period.periodType,
        periodStart: period.start.toISOString(),
        periodEnd: period.end.toISOString(),
        totalLeads: total,
        sourcers,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Top sourcers failed',
    })
  }
})

// --- GET /api/reporting/outreach-performance ---
router.get('/outreach-performance', async (req: Request, res: Response) => {
  try {
    const reportingScope = await resolveReportingScope(req, res)
    if (!reportingScope) return
    const period = resolveReportingPeriod(req.query)
    if (reportingScope.customerIds.length === 0) {
      res.json({
        success: true,
        data: {
          customerId: reportingScope.customerId,
          scope: reportingScope.scope,
          customerCount: reportingScope.customerCount,
          sinceDays: period.sinceDays,
          periodType: period.periodType,
          periodStart: period.start.toISOString(),
          periodEnd: period.end.toISOString(),
          totalSent: 0,
          totalReplies: 0,
          bySequence: [],
          byIdentity: [],
          topSequence: null,
          generatedAt: new Date().toISOString(),
        },
      })
      return
    }
    const customerIdFilter = getCustomerIdFilter(reportingScope.customerIds)
    const periodRange = getDateRangeFilter(period)

    const audits = await prisma.outboundSendAttemptAudit.findMany({
      where: { customerId: customerIdFilter, decidedAt: periodRange },
      select: { queueItemId: true, decision: true, reason: true },
      orderBy: { decidedAt: 'desc' },
      take: 10000,
    })

    const queueItemIds = Array.from(new Set(audits.map((a) => a.queueItemId).filter(Boolean))) as string[]
    const queueItems =
      queueItemIds.length > 0
        ? await prisma.outboundSendQueueItem.findMany({
            where: { id: { in: queueItemIds }, customerId: customerIdFilter },
            select: { id: true, enrollmentId: true },
          })
        : []
    const enrollmentIds = Array.from(new Set(queueItems.map((q) => q.enrollmentId).filter(Boolean)))
    const enrollments =
      enrollmentIds.length > 0
        ? await prisma.enrollment.findMany({
            where: { id: { in: enrollmentIds }, customerId: customerIdFilter },
            select: { id: true, sequenceId: true },
          })
        : []
    const sequenceIds = Array.from(new Set(enrollments.map((e) => e.sequenceId).filter(Boolean)))
    const sequences =
      sequenceIds.length > 0
        ? await prisma.emailSequence.findMany({
            where: { id: { in: sequenceIds }, customerId: customerIdFilter },
            select: { id: true, name: true, senderIdentityId: true, customerId: true },
          })
        : []
    const identityIds = Array.from(
      new Set(sequences.map((s) => s.senderIdentityId).filter((v): v is string => !!v)),
    )
    const identities =
      identityIds.length > 0
        ? await prisma.emailIdentity.findMany({
            where: { id: { in: identityIds }, customerId: customerIdFilter },
            select: { id: true, emailAddress: true, displayName: true, customerId: true },
          })
        : []

    const queueToEnrollment = new Map(queueItems.map((q) => [q.id, q.enrollmentId]))
    const enrollmentToSequence = new Map(enrollments.map((e) => [e.id, e.sequenceId]))
    const sequenceById = new Map(sequences.map((s) => [s.id, s]))
    const identityById = new Map(identities.map((i) => [i.id, i]))

    type M = { sent: number; failed: number; suppressed: number; skipped: number; replies: number; optOuts: number }
    const bySequence = new Map<string, M>()
    const byIdentity = new Map<string, M>()
    const zero = (): M => ({ sent: 0, failed: 0, suppressed: 0, skipped: 0, replies: 0, optOuts: 0 })

    for (const audit of audits) {
      const enrollmentId = queueToEnrollment.get(audit.queueItemId)
      const sequenceId = enrollmentId ? enrollmentToSequence.get(enrollmentId) : null
      const sequence = sequenceId ? sequenceById.get(sequenceId) : null
      const identityId = sequence?.senderIdentityId ?? null
      const seqKey = sequenceId ?? 'unknown'
      const identKey = identityId ?? 'unknown'
      if (!bySequence.has(seqKey)) bySequence.set(seqKey, zero())
      if (!byIdentity.has(identKey)) byIdentity.set(identKey, zero())
      const sm = bySequence.get(seqKey)!
      const im = byIdentity.get(identKey)!
      if (audit.decision === 'SENT') {
        sm.sent += 1
        im.sent += 1
        continue
      }
      if (audit.decision === 'SEND_FAILED') {
        sm.failed += 1
        im.failed += 1
        continue
      }
      if (audit.decision === 'SKIP_SUPPRESSED') {
        sm.suppressed += 1
        im.suppressed += 1
        continue
      }
      if (String(audit.decision).startsWith('SKIP_')) {
        sm.skipped += 1
        im.skipped += 1
      }
    }

    let replyEvents: Array<{ senderIdentityId: string | null; campaign: { sequenceId: string | null } | null }> = []
    try {
      replyEvents = await prisma.emailEvent.findMany({
        where: {
          customerId: customerIdFilter,
          type: 'replied',
          occurredAt: periodRange,
        },
        select: {
          senderIdentityId: true,
          campaign: { select: { sequenceId: true } },
        },
      })
    } catch {
      // Relation or environment drift should not take down the dashboard.
    }
    for (const ev of replyEvents) {
      const identKey = ev.senderIdentityId ?? 'unknown'
      const seqId = ev.campaign?.sequenceId ?? 'unknown'
      if (!byIdentity.has(identKey)) byIdentity.set(identKey, zero())
      if (!bySequence.has(seqId)) bySequence.set(seqId, zero())
      byIdentity.get(identKey)!.replies += 1
      bySequence.get(seqId)!.replies += 1
    }

    const optOutAuditRows = await prisma.enrollmentAuditEvent.findMany({
      where: {
        customerId: customerIdFilter,
        createdAt: periodRange,
        eventType: 'send_skipped',
        message: 'unsubscribe_link_clicked',
      },
      select: { enrollmentId: true },
    })
    const optOutEnrollmentIds = Array.from(new Set(optOutAuditRows.map((row) => row.enrollmentId).filter(Boolean)))
    const optOutEnrollments =
      optOutEnrollmentIds.length > 0
        ? await prisma.enrollment.findMany({
            where: { customerId: customerIdFilter, id: { in: optOutEnrollmentIds } },
            select: { id: true, sequenceId: true },
          })
        : []
    const optOutEnrollmentToSequence = new Map(optOutEnrollments.map((row) => [row.id, row.sequenceId]))

    for (const row of optOutAuditRows) {
      const seqId = optOutEnrollmentToSequence.get(row.enrollmentId) ?? 'unknown'
      const sequence = sequenceById.get(seqId)
      const identKey = sequence?.senderIdentityId ?? 'unknown'
      if (!byIdentity.has(identKey)) byIdentity.set(identKey, zero())
      if (!bySequence.has(seqId)) bySequence.set(seqId, zero())
      byIdentity.get(identKey)!.optOuts += 1
      bySequence.get(seqId)!.optOuts += 1
    }

    const sequenceRows = Array.from(bySequence.entries())
      .map(([id, m]) => ({
        sequenceId: id,
        sequenceName: sequenceById.get(id)?.name ?? 'Unknown',
        customerName: reportingScope.customerNamesById.get(sequenceById.get(id)?.customerId ?? '') ?? null,
        ...m,
      }))
      .sort((a, b) => b.sent - a.sent)
    const identityRows = Array.from(byIdentity.entries())
      .map(([id, m]) => {
        const ident = identityById.get(id)
        return {
          identityId: id,
          email: ident?.emailAddress ?? null,
          name: ident?.displayName ?? null,
          customerName: reportingScope.customerNamesById.get(ident?.customerId ?? '') ?? null,
          ...m,
        }
      })
      .sort((a, b) => b.sent - a.sent)

    const totalSent = sequenceRows.reduce((s, r) => s + r.sent, 0)
    const totalReplies = sequenceRows.reduce((s, r) => s + r.replies, 0)
    const topSequence = sequenceRows[0] ?? null

    res.json({
      success: true,
      data: {
        customerId: reportingScope.customerId,
        scope: reportingScope.scope,
        customerCount: reportingScope.customerCount,
        sinceDays: period.sinceDays,
        periodType: period.periodType,
        periodStart: period.start.toISOString(),
        periodEnd: period.end.toISOString(),
        totalSent,
        totalReplies,
        bySequence: sequenceRows,
        byIdentity: identityRows,
        topSequence,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Outreach performance failed',
    })
  }
})

// --- GET /api/reporting/funnel ---
router.get('/funnel', async (req: Request, res: Response) => {
  try {
    const reportingScope = await resolveReportingScope(req, res)
    if (!reportingScope) return
    const period = resolveReportingPeriod(req.query)
    if (reportingScope.customerIds.length === 0) {
      res.json({
        success: true,
        data: {
          customerId: reportingScope.customerId,
          scope: reportingScope.scope,
          customerCount: reportingScope.customerCount,
          sinceDays: period.sinceDays,
          periodType: period.periodType,
          periodStart: period.start.toISOString(),
          periodEnd: period.end.toISOString(),
          leadsCreated: 0,
          contacted: 0,
          replied: 0,
          positiveReplies: null,
          converted: 0,
          byLeadStatus: {},
          generatedAt: new Date().toISOString(),
        },
      })
      return
    }
    const customerIdFilter = getCustomerIdFilter(reportingScope.customerIds)
    const periodRange = getDateRangeFilter(period)

    const [leadStatusCounts, contactedCount, repliedCount, convertedCount] = await Promise.all([
      prisma.leadRecord.groupBy({
        by: ['status'],
        where: {
          customerId: customerIdFilter,
          ...getLeadCreatedWithinPeriodWhere(period),
        },
        _count: { id: true },
      }),
      prisma.outboundSendQueueItem.count({
        where: { customerId: customerIdFilter, status: 'SENT', sentAt: periodRange },
      }),
      prisma.emailEvent.count({
        where: { customerId: customerIdFilter, type: 'replied', occurredAt: periodRange },
      }),
      prisma.leadRecord.count({
        where: { customerId: customerIdFilter, convertedToContactId: { not: null }, convertedAt: periodRange },
      }),
    ])

    const leadsTotal = leadStatusCounts.reduce((s, g) => s + g._count.id, 0)
    const byStatus: Record<string, number> = {}
    leadStatusCounts.forEach((g) => {
      byStatus[g.status] = g._count.id
    })

    res.json({
      success: true,
      data: {
        customerId: reportingScope.customerId,
        scope: reportingScope.scope,
        customerCount: reportingScope.customerCount,
        sinceDays: period.sinceDays,
        periodType: period.periodType,
        periodStart: period.start.toISOString(),
        periodEnd: period.end.toISOString(),
        leadsCreated: leadsTotal,
        contacted: contactedCount,
        replied: repliedCount,
        positiveReplies: null,
        converted: convertedCount,
        byLeadStatus: byStatus,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Funnel failed',
    })
  }
})

// --- GET /api/reporting/mailboxes ---
router.get('/mailboxes', async (req: Request, res: Response) => {
  try {
    const reportingScope = await resolveReportingScope(req, res)
    if (!reportingScope) return
    const period = resolveReportingPeriod(req.query)
    if (reportingScope.customerIds.length === 0) {
      res.json({
        success: true,
        data: {
          customerId: reportingScope.customerId,
          scope: reportingScope.scope,
          customerCount: reportingScope.customerCount,
          sinceDays: period.sinceDays,
          periodType: period.periodType,
          periodStart: period.start.toISOString(),
          periodEnd: period.end.toISOString(),
          mailboxes: [],
          generatedAt: new Date().toISOString(),
        },
      })
      return
    }
    const customerIdFilter = getCustomerIdFilter(reportingScope.customerIds)

    const eventsByIdentity = await prisma.emailEvent.groupBy({
      by: ['senderIdentityId', 'type'],
      where: {
        customerId: customerIdFilter,
        occurredAt: getDateRangeFilter(period),
        senderIdentityId: { not: null },
      },
      _count: { id: true },
    })

    const identityIds = Array.from(
      new Set(eventsByIdentity.map((e) => e.senderIdentityId).filter((v): v is string => !!v)),
    )
    const identities =
      identityIds.length > 0
        ? await prisma.emailIdentity.findMany({
            where: { id: { in: identityIds }, customerId: customerIdFilter },
            select: { id: true, emailAddress: true, displayName: true, customerId: true },
          })
        : []

    const byIdentity = new Map<
      string,
      { sent: number; delivered: number; replied: number; bounced: number; optedOut: number; failed: number }
    >()
    for (const e of eventsByIdentity) {
      const id = e.senderIdentityId!
      if (!byIdentity.has(id)) {
        byIdentity.set(id, { sent: 0, delivered: 0, replied: 0, bounced: 0, optedOut: 0, failed: 0 })
      }
      const row = byIdentity.get(id)!
      if (e.type === 'sent') row.sent += e._count.id
      else if (e.type === 'delivered') row.delivered += e._count.id
      else if (e.type === 'replied') row.replied += e._count.id
      else if (e.type === 'bounced') row.bounced += e._count.id
      else if (isOptOutEventType(e.type)) row.optedOut += e._count.id
      else if (e.type === 'failed') row.failed += e._count.id
    }

    const identityById = new Map(identities.map((i) => [i.id, i]))
    const rows = Array.from(byIdentity.entries()).map(([id, m]) => ({
      identityId: id,
      email: identityById.get(id)?.emailAddress ?? null,
      name: identityById.get(id)?.displayName ?? null,
      customerName: reportingScope.customerNamesById.get(identityById.get(id)?.customerId ?? '') ?? null,
      ...m,
    }))

    res.json({
      success: true,
      data: {
        customerId: reportingScope.customerId,
        scope: reportingScope.scope,
        customerCount: reportingScope.customerCount,
        sinceDays: period.sinceDays,
        periodType: period.periodType,
        periodStart: period.start.toISOString(),
        periodEnd: period.end.toISOString(),
        mailboxes: rows.sort((a, b) => b.sent - a.sent),
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Mailboxes failed',
    })
  }
})

// --- GET /api/reporting/compliance ---
router.get('/compliance', async (req: Request, res: Response) => {
  try {
    const reportingScope = await resolveReportingScope(req, res)
    if (!reportingScope) return
    const period = resolveReportingPeriod(req.query)
    if (reportingScope.customerIds.length === 0) {
      res.json({
        success: true,
        data: {
          customerId: reportingScope.customerId,
          scope: reportingScope.scope,
          customerCount: reportingScope.customerCount,
          sinceDays: period.sinceDays,
          periodType: period.periodType,
          periodStart: period.start.toISOString(),
          periodEnd: period.end.toISOString(),
          suppressedEmails: 0,
          suppressedDomains: 0,
          unsubscribesInPeriod: 0,
          suppressionBlocksInPeriod: 0,
          generatedAt: new Date().toISOString(),
        },
      })
      return
    }
    const customerIdFilter = getCustomerIdFilter(reportingScope.customerIds)

    const [suppressionCounts, recentEventCounts, blockedFromQueue] = await Promise.all([
      prisma.suppressionEntry.groupBy({
        by: ['type', 'source'],
        where: { customerId: customerIdFilter },
        _count: { id: true },
      }),
      prisma.emailEvent.groupBy({
        by: ['type'],
        where: { customerId: customerIdFilter, occurredAt: getDateRangeFilter(period) },
        _count: { id: true },
      }),
      prisma.outboundSendAttemptAudit.count({
        where: {
          customerId: customerIdFilter,
          decidedAt: getDateRangeFilter(period),
          decision: 'SKIP_SUPPRESSED',
        },
      }),
    ])

    const byType: Record<string, number> = {}
    suppressionCounts.forEach((s) => {
      const key = s.type
      byType[key] = (byType[key] ?? 0) + s._count.id
    })
    const optedOutCount = recentEventCounts.reduce(
      (sum, row) => (isOptOutEventType(row.type) ? sum + row._count.id : sum),
      0,
    )

    res.json({
      success: true,
      data: {
        customerId: reportingScope.customerId,
        scope: reportingScope.scope,
        customerCount: reportingScope.customerCount,
        sinceDays: period.sinceDays,
        periodType: period.periodType,
        periodStart: period.start.toISOString(),
        periodEnd: period.end.toISOString(),
        suppressedEmails: byType['email'] ?? 0,
        suppressedDomains: byType['domain'] ?? 0,
        unsubscribesInPeriod: optedOutCount,
        suppressionBlocksInPeriod: blockedFromQueue,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Compliance failed',
    })
  }
})

// --- GET /api/reporting/trends ---
router.get('/trends', async (req: Request, res: Response) => {
  try {
    const reportingScope = await resolveReportingScope(req, res)
    if (!reportingScope) return
    const period = resolveReportingPeriod(req.query)
    if (reportingScope.customerIds.length === 0) {
      res.json({
        success: true,
        data: {
          customerId: reportingScope.customerId,
          scope: reportingScope.scope,
          customerCount: reportingScope.customerCount,
          sinceDays: period.sinceDays,
          periodType: period.periodType,
          periodStart: period.start.toISOString(),
          periodEnd: period.end.toISOString(),
          trend: [],
          generatedAt: new Date().toISOString(),
        },
      })
      return
    }
    const customerIdFilter = getCustomerIdFilter(reportingScope.customerIds)

    const [leadsRaw, eventsRaw] = await Promise.all([
      prisma.leadRecord.findMany({
        where: {
          customerId: customerIdFilter,
          ...getLeadCreatedWithinPeriodWhere(period),
        },
        select: { occurredAt: true, createdAt: true },
      }),
      prisma.emailEvent.findMany({
        where: { customerId: customerIdFilter, occurredAt: getDateRangeFilter(period), type: { in: ['sent', 'replied'] } },
        select: { type: true, occurredAt: true },
      }),
    ])

    const dayKey = (d: Date) => d.toISOString().slice(0, 10)
    const leadsByDay: Record<string, number> = {}
    leadsRaw.forEach((r) => {
      const at = r.occurredAt ?? r.createdAt
      if (at) {
        const k = dayKey(at)
        leadsByDay[k] = (leadsByDay[k] ?? 0) + 1
      }
    })
    const sentByDay: Record<string, number> = {}
    const repliedByDay: Record<string, number> = {}
    eventsRaw.forEach((e) => {
      const k = dayKey(e.occurredAt)
      if (e.type === 'sent') sentByDay[k] = (sentByDay[k] ?? 0) + 1
      else if (e.type === 'replied') repliedByDay[k] = (repliedByDay[k] ?? 0) + 1
    })

    const allDays = new Set<string>([
      ...Object.keys(leadsByDay),
      ...Object.keys(sentByDay),
      ...Object.keys(repliedByDay),
    ])
    const sortedDays = Array.from(allDays).sort()
    const trend = sortedDays.map((day) => ({
      day,
      leads: leadsByDay[day] ?? 0,
      sent: sentByDay[day] ?? 0,
      replied: repliedByDay[day] ?? 0,
    }))

    res.json({
      success: true,
      data: {
        customerId: reportingScope.customerId,
        scope: reportingScope.scope,
        customerCount: reportingScope.customerCount,
        sinceDays: period.sinceDays,
        periodType: period.periodType,
        periodStart: period.start.toISOString(),
        periodEnd: period.end.toISOString(),
        trend,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Trends failed',
    })
  }
})

export default router
