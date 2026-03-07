import express from 'express'
import { prisma } from '../lib/prisma.js'

const router = express.Router()

const LONDON_TZ = 'Europe/London'

const getCustomerId = (req: express.Request): string => {
  const customerId = (req.headers['x-customer-id'] as string) || (req.query.customerId as string)
  if (!customerId) {
    const err = new Error('Customer ID required') as Error & { status?: number }
    err.status = 400
    throw err
  }
  return customerId
}

/**
 * Get the start of today in Europe/London, returned as UTC Date.
 * Uses Intl.DateTimeFormat to determine the current London date and constructs
 * midnight UTC-aligned boundaries.
 */
function getLondonDateBoundaries(range: string): { startDate: Date; endDate: Date } {
  const now = new Date()

  // Format date parts in London timezone
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = fmt.formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'

  const year = parseInt(get('year'))
  const month = parseInt(get('month')) - 1 // 0-indexed
  const day = parseInt(get('day'))

  // Current London midnight as UTC
  const londonMidnight = new Date(
    Date.UTC(year, month, day) - getLondonOffsetMs(now),
  )

  if (range === 'today') {
    const startDate = londonMidnight
    const endDate = new Date(londonMidnight.getTime() + 24 * 60 * 60 * 1000 - 1)
    return { startDate, endDate }
  }

  if (range === 'week') {
    // Mon–Sun: find most recent Monday in London time
    const londonDow = getLondonDayOfWeek(now) // 0=Sun, 1=Mon, ..., 6=Sat
    const daysSinceMonday = londonDow === 0 ? 6 : londonDow - 1 // Mon=0, Tue=1, ..., Sun=6
    const weekStart = new Date(londonMidnight.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000)
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1)
    return { startDate: weekStart, endDate: weekEnd }
  }

  if (range === 'month') {
    // 1st of current month to last day of current month in London
    const monthStart = new Date(Date.UTC(year, month, 1) - getLondonOffsetMs(now))
    const monthEnd = new Date(
      Date.UTC(year, month + 1, 0) - getLondonOffsetMs(now) + 24 * 60 * 60 * 1000 - 1,
    )
    return { startDate: monthStart, endDate: monthEnd }
  }

  // Fallback: today
  const startDate = londonMidnight
  const endDate = new Date(londonMidnight.getTime() + 24 * 60 * 60 * 1000 - 1)
  return { startDate, endDate }
}

/** Returns the UTC offset in milliseconds for Europe/London at the given instant */
function getLondonOffsetMs(at: Date): number {
  // Use two formatters to compute offset: London time vs UTC
  const londonStr = at.toLocaleString('en-GB', { timeZone: LONDON_TZ, hour12: false })
  const utcStr = at.toLocaleString('en-GB', { timeZone: 'UTC', hour12: false })

  const parseLocal = (s: string): number => {
    // format: "dd/mm/yyyy, hh:mm:ss"
    const [datePart, timePart] = s.split(', ')
    const [d, mo, y] = datePart.split('/')
    const [h, mi, se] = timePart.split(':')
    return Date.UTC(parseInt(y), parseInt(mo) - 1, parseInt(d), parseInt(h), parseInt(mi), parseInt(se))
  }

  return parseLocal(londonStr) - parseLocal(utcStr)
}

/** Returns 0=Sun, 1=Mon, ..., 6=Sat in London timezone */
function getLondonDayOfWeek(at: Date): number {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON_TZ,
    weekday: 'short',
  })
  const day = fmt.format(at)
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return map[day] ?? 0
}

// GET /api/reports/customer?customerId=X&dateRange=today|week|month
router.get('/customer', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const dateRange = (req.query.dateRange as string) || 'today'

    const { startDate, endDate } = getLondonDateBoundaries(dateRange)

    const eventCounts = await prisma.emailEvent.groupBy({
      by: ['type'],
      where: {
        customerId,
        occurredAt: { gte: startDate, lte: endDate },
      },
      _count: { id: true },
    })

    const counts: Record<string, number> = {}
    eventCounts.forEach((event) => {
      counts[event.type] = event._count.id
    })

    const sent = counts['sent'] || 0
    const delivered = counts['delivered'] || 0
    const opened = counts['opened'] || 0
    const clicked = counts['clicked'] || 0
    const replied = counts['replied'] || 0
    const bounced = counts['bounced'] || 0
    const optedOut = counts['opted_out'] || 0
    const spamComplaints = counts['spam_complaint'] || 0
    const failed = counts['failed'] || 0
    const notReached = counts['not_reached'] || 0

    const deliveryRate = sent > 0 ? (delivered / sent) * 100 : 0
    const openRate = delivered > 0 ? (opened / delivered) * 100 : 0
    const clickRate = delivered > 0 ? (clicked / delivered) * 100 : 0
    const replyRate = delivered > 0 ? (replied / delivered) * 100 : 0
    const bounceRate = sent > 0 ? (bounced / sent) * 100 : 0
    const optOutRate = delivered > 0 ? (optedOut / delivered) * 100 : 0
    const notReachedRate = sent > 0 ? ((failed + notReached) / sent) * 100 : 0

    const sequencesCompleted = await prisma.sequenceEnrollment.count({
      where: {
        sequence: { customerId },
        status: 'completed',
      },
    })

    const uniqueSenders = await prisma.emailEvent.findMany({
      where: {
        customerId,
        type: 'sent',
        occurredAt: { gte: startDate, lte: endDate },
      },
      select: {
        senderIdentityId: true,
        senderIdentity: {
          select: { emailAddress: true, displayName: true },
        },
      },
      distinct: ['senderIdentityId'],
    })

    res.json({
      customerId,
      dateRange,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      timezone: LONDON_TZ,

      sent,
      delivered,
      opened,
      clicked,
      replied,
      bounced,
      optedOut,
      spamComplaints,
      failed,
      notReached,

      sequencesCompleted,
      deliveryRate: Math.round(deliveryRate * 10) / 10,
      openRate: Math.round(openRate * 10) / 10,
      clickRate: Math.round(clickRate * 10) / 10,
      replyRate: Math.round(replyRate * 10) / 10,
      bounceRate: Math.round(bounceRate * 10) / 10,
      optOutRate: Math.round(optOutRate * 10) / 10,
      notReachedRate: Math.round(notReachedRate * 10) / 10,

      uniqueSenders: uniqueSenders.length,
      senders: uniqueSenders.map((s) => ({
        identityId: s.senderIdentityId,
        email: s.senderIdentity?.emailAddress,
        name: s.senderIdentity?.displayName,
      })),

      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/reports/outreach?customerId=X&sinceDays=7|30
router.get('/outreach', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const rawSinceDays = typeof req.query.sinceDays === 'string' ? parseInt(req.query.sinceDays, 10) : 30
    const sinceDays = Number.isFinite(rawSinceDays) ? Math.min(Math.max(rawSinceDays, 1), 90) : 30
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000)

    const audits = await prisma.outboundSendAttemptAudit.findMany({
      where: { customerId, decidedAt: { gte: since } },
      select: { queueItemId: true, decision: true, reason: true },
      orderBy: { decidedAt: 'desc' },
      take: 5000,
    })
    const queueItemIds = Array.from(new Set(audits.map((a) => a.queueItemId).filter(Boolean)))
    const queueItems = queueItemIds.length
      ? await prisma.outboundSendQueueItem.findMany({
          where: { id: { in: queueItemIds }, customerId },
          select: { id: true, enrollmentId: true },
        })
      : []
    const enrollmentIds = Array.from(new Set(queueItems.map((q) => q.enrollmentId).filter(Boolean)))
    const enrollments = enrollmentIds.length
      ? await prisma.enrollment.findMany({
          where: { id: { in: enrollmentIds }, customerId },
          select: { id: true, sequenceId: true },
        })
      : []
    const sequenceIds = Array.from(new Set(enrollments.map((e) => e.sequenceId).filter(Boolean)))
    const sequences = sequenceIds.length
      ? await prisma.emailSequence.findMany({
          where: { id: { in: sequenceIds }, customerId },
          select: { id: true, name: true, senderIdentityId: true },
        })
      : []
    const senderIds = Array.from(new Set(sequences.map((s) => s.senderIdentityId).filter((v): v is string => !!v)))
    const identities = senderIds.length
      ? await prisma.emailIdentity.findMany({
          where: { id: { in: senderIds }, customerId },
          select: { id: true, emailAddress: true, displayName: true },
        })
      : []

    const queueToEnrollment = new Map(queueItems.map((q) => [q.id, q.enrollmentId]))
    const enrollmentToSequence = new Map(enrollments.map((e) => [e.id, e.sequenceId]))
    const sequenceById = new Map(sequences.map((s) => [s.id, s]))
    const identityById = new Map(identities.map((i) => [i.id, i]))

    type Metrics = { sent: number; sendFailed: number; suppressed: number; skipped: number; replies: number; optOuts: number }
    const bySequence = new Map<string, Metrics>()
    const byIdentity = new Map<string, Metrics>()
    const zero = (): Metrics => ({ sent: 0, sendFailed: 0, suppressed: 0, skipped: 0, replies: 0, optOuts: 0 })
    const recentReasons: Record<string, number> = {
      SKIP_REPLIED_STOP: 0,
      hard_bounce_invalid_recipient: 0,
    }

    for (const audit of audits) {
      const enrollmentId = queueToEnrollment.get(audit.queueItemId)
      const sequenceId = enrollmentId ? enrollmentToSequence.get(enrollmentId) : null
      const sequence = sequenceId ? sequenceById.get(sequenceId) : null
      const identityId = sequence?.senderIdentityId ?? null
      const seqKey = sequenceId ?? 'unknown'
      const identKey = identityId ?? 'unknown'
      if (!bySequence.has(seqKey)) bySequence.set(seqKey, zero())
      if (!byIdentity.has(identKey)) byIdentity.set(identKey, zero())
      const seqM = bySequence.get(seqKey)!
      const idM = byIdentity.get(identKey)!

      if (audit.decision === 'SENT') { seqM.sent += 1; idM.sent += 1; continue }
      if (audit.decision === 'SEND_FAILED') { seqM.sendFailed += 1; idM.sendFailed += 1; continue }
      if (audit.decision === 'SKIP_SUPPRESSED') { seqM.suppressed += 1; idM.suppressed += 1; continue }
      if (String(audit.decision).startsWith('SKIP_')) { seqM.skipped += 1; idM.skipped += 1 }
      if (audit.reason === 'SKIP_REPLIED_STOP') recentReasons.SKIP_REPLIED_STOP += 1
      if (audit.reason === 'hard_bounce_invalid_recipient') recentReasons.hard_bounce_invalid_recipient += 1
    }

    const repliesByIdentity = await prisma.emailEvent.groupBy({
      by: ['senderIdentityId'],
      where: { customerId, type: 'replied', occurredAt: { gte: since } },
      _count: { id: true },
    })
    let optOutsByIdentity: Array<{ senderIdentityId: string | null; _count: { id: number } }> = []
    try {
      const groupedOptOuts = await prisma.emailEvent.groupBy({
        by: ['senderIdentityId'],
        where: { customerId, type: 'opted_out', occurredAt: { gte: since } },
        _count: { id: true },
      })
      optOutsByIdentity = groupedOptOuts.map((row) => ({
        senderIdentityId: row.senderIdentityId ?? null,
        _count: { id: row._count.id },
      }))
    } catch (error) {
      // Some environments can lag enum values; keep reports available and treat opt-outs as 0.
      console.warn('[reports/outreach] opted_out groupBy unavailable; defaulting optOuts to 0')
    }

    for (const row of repliesByIdentity) {
      const identKey = row.senderIdentityId ?? 'unknown'
      if (!byIdentity.has(identKey)) byIdentity.set(identKey, zero())
      byIdentity.get(identKey)!.replies += row._count.id
    }
    for (const row of optOutsByIdentity) {
      const identKey = row.senderIdentityId ?? 'unknown'
      if (!byIdentity.has(identKey)) byIdentity.set(identKey, zero())
      byIdentity.get(identKey)!.optOuts += row._count.id
    }

    const sequenceRows = Array.from(bySequence.entries()).map(([sequenceId, metrics]) => ({
      sequenceId,
      sequenceName: sequenceById.get(sequenceId)?.name ?? 'Unknown sequence',
      ...metrics,
    })).sort((a, b) => b.sent - a.sent)

    const identityRows = Array.from(byIdentity.entries()).map(([identityId, metrics]) => {
      const identity = identityById.get(identityId)
      return {
        identityId,
        email: identity?.emailAddress ?? null,
        name: identity?.displayName ?? null,
        ...metrics,
      }
    }).sort((a, b) => b.sent - a.sent)

    res.json({
      success: true,
      data: {
        customerId,
        sinceDays,
        bySequence: sequenceRows,
        byIdentity: identityRows,
        recentReasons,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/reports/customers — list all customers for dropdown
router.get('/customers', async (req, res, next) => {
  try {
    const customers = await prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        _count: { select: { emailEvents: true } },
      },
      orderBy: { name: 'asc' },
    })

    res.json({
      customers: customers.map((c) => ({
        id: c.id,
        name: c.name,
        totalEvents: c._count.emailEvents,
      })),
    })
  } catch (error) {
    next(error)
  }
})

export default router
