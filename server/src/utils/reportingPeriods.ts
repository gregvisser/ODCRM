import type { Request } from 'express'

export type ReportingPeriodType = 'days' | 'week' | 'month'

export type ReportingPeriod = {
  periodType: ReportingPeriodType
  sinceDays: number
  start: Date
  end: Date
}

export function parseSinceDays(query: Request['query']): number {
  const raw = typeof query.sinceDays === 'string' ? parseInt(query.sinceDays, 10) : 30
  if (!Number.isFinite(raw) || raw < 1) return 30
  return Math.min(Math.max(raw, 1), 90)
}

function getSinceDate(sinceDays: number): Date {
  return new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000)
}

export function parsePeriodType(query: Request['query']): ReportingPeriodType {
  const raw = typeof query.periodType === 'string' ? query.periodType.toLowerCase().trim() : 'days'
  return raw === 'week' ? 'week' : raw === 'month' ? 'month' : 'days'
}

function getMonday(date: Date): Date {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  const day = d.getUTCDay()
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1)
  d.setUTCDate(diff)
  return d
}

export function getWeekBoundaries(weekStart: string): { start: Date; end: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return null
  const date = new Date(`${weekStart}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return null
  const start = getMonday(date)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 6)
  end.setUTCHours(23, 59, 59, 999)
  return { start, end }
}

export function getMonthBoundaries(month: string): { start: Date; end: Date } | null {
  if (!/^\d{4}-\d{2}$/.test(month)) return null
  const date = new Date(`${month}-01T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return null
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999))
  return { start, end }
}

export function resolveReportingPeriod(query: Request['query']): ReportingPeriod {
  const sinceDays = parseSinceDays(query)
  const periodType = parsePeriodType(query)

  if (periodType === 'week') {
    const weekStart = typeof query.weekStart === 'string' ? query.weekStart : ''
    const boundaries = getWeekBoundaries(weekStart)
    if (boundaries) {
      return { periodType: 'week', sinceDays, start: boundaries.start, end: boundaries.end }
    }
  }

  if (periodType === 'month') {
    const month = typeof query.month === 'string' ? query.month : ''
    const boundaries = getMonthBoundaries(month)
    if (boundaries) {
      return { periodType: 'month', sinceDays, start: boundaries.start, end: boundaries.end }
    }
  }

  return {
    periodType: 'days',
    sinceDays,
    start: getSinceDate(sinceDays),
    end: new Date(),
  }
}

export function getPreviousReportingPeriod(period: ReportingPeriod): ReportingPeriod {
  if (period.periodType === 'week') {
    const start = new Date(period.start)
    const end = new Date(period.end)
    start.setUTCDate(start.getUTCDate() - 7)
    end.setUTCDate(end.getUTCDate() - 7)
    return { ...period, start, end }
  }

  if (period.periodType === 'month') {
    const start = new Date(Date.UTC(period.start.getUTCFullYear(), period.start.getUTCMonth() - 1, 1, 0, 0, 0, 0))
    const end = new Date(Date.UTC(period.start.getUTCFullYear(), period.start.getUTCMonth(), 0, 23, 59, 59, 999))
    return { ...period, start, end }
  }

  const durationMs = period.end.getTime() - period.start.getTime() + 1
  const end = new Date(period.start.getTime() - 1)
  const start = new Date(end.getTime() - durationMs + 1)
  return { ...period, start, end }
}

export function getDateRangeFilter(period: ReportingPeriod): { gte: Date; lte: Date } {
  return { gte: period.start, lte: period.end }
}

export function getLeadCreatedWithinPeriodWhere(period: ReportingPeriod) {
  const range = getDateRangeFilter(period)
  return {
    OR: [{ occurredAt: range }, { occurredAt: null, createdAt: range }],
  }
}

export function getTargetField(period: ReportingPeriod): 'weeklyLeadTarget' | 'monthlyLeadTarget' {
  if (period.periodType === 'week') return 'weeklyLeadTarget'
  if (period.periodType === 'month') return 'monthlyLeadTarget'
  return period.sinceDays <= 14 ? 'weeklyLeadTarget' : 'monthlyLeadTarget'
}

export function sumLeadTargets(
  customers: Array<{ weeklyLeadTarget?: number | null; monthlyLeadTarget?: number | null }>,
  period: ReportingPeriod,
): number {
  const targetField = getTargetField(period)
  return customers.reduce((sum, customer) => sum + (customer[targetField] ?? 0), 0)
}
