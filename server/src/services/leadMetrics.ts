import {
  extractStoredLeadCanonicalRecord,
  isRealStoredLeadRow,
  type StoredLeadTruthRow,
} from './leadCanonicalMapping.js'

const METRICS_TIMEZONE = process.env.LEADS_METRICS_TIMEZONE || 'Europe/London'

export type StoredLeadMetricRow = StoredLeadTruthRow & {
  source?: string | null
  owner?: string | null
}

export type LeadMetricCounts = {
  today: number
  week: number
  month: number
  total: number
}

export type LeadMetricBreakdowns = {
  breakdownBySource: Record<string, number>
  breakdownByOwner: Record<string, number>
}

export type LeadMetricSummary = LeadMetricCounts & LeadMetricBreakdowns

export type LeadMetricTimeRanges = {
  todayStart: Date
  todayEnd: Date
  weekStart: Date
  weekEnd: Date
  monthStart: Date
  monthEnd: Date
}

function formatDateInMetricsTz(date: Date): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: METRICS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = fmt.formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '0'
  return `${get('year')}-${get('month')}-${get('day')}`
}

function getHourInMetricsTz(date: Date): number {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: METRICS_TIMEZONE,
    hour: '2-digit',
    hour12: false,
  })
  return Number.parseInt(fmt.format(date), 10)
}

function midnightInMetricsTzUtc(y: number, m: number, d: number): Date {
  for (let hourUtc = -2; hourUtc <= 2; hourUtc++) {
    const candidate = new Date(Date.UTC(y, m, d, hourUtc, 0, 0, 0))
    if (
      formatDateInMetricsTz(candidate) === `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` &&
      getHourInMetricsTz(candidate) === 0
    ) {
      return candidate
    }
  }

  const baseline = new Date(Date.UTC(y, m, d, 0, 0, 0, 0))
  const inTz = formatDateInMetricsTz(baseline)
  const [ty, tm, td] = inTz.split('-').map(Number)
  if (ty === y && tm === m + 1 && td === d && getHourInMetricsTz(baseline) === 1) {
    return new Date(Date.UTC(y, m, d, -1, 0, 0, 0))
  }
  if (ty === y && tm === m + 1 && td === d - 1 && getHourInMetricsTz(baseline) === 23) {
    return new Date(Date.UTC(y, m, d, 1, 0, 0, 0))
  }
  return baseline
}

export function getLeadMetricsTimeRangesUtc(): LeadMetricTimeRanges {
  const now = new Date()
  const dateFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: METRICS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const weekdayFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: METRICS_TIMEZONE,
    weekday: 'short',
  })
  const parts = dateFmt.formatToParts(now)
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '0'
  const y = Number.parseInt(get('year'), 10)
  const m = Number.parseInt(get('month'), 10) - 1
  const d = Number.parseInt(get('day'), 10)

  const todayStart = midnightInMetricsTzUtc(y, m, d)
  const todayEnd = midnightInMetricsTzUtc(y, m, d + 1)

  const weekdayShort = weekdayFmt.format(now)
  const weekdayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
  const dow = weekdayOrder.indexOf(weekdayShort as (typeof weekdayOrder)[number])
  const mondayOffset = dow < 0 ? 0 : -dow
  const mondayD = d + mondayOffset
  const weekStart = midnightInMetricsTzUtc(y, m, mondayD)
  const nextMonday = new Date(Date.UTC(y, m, mondayD + 7, 12, 0, 0))
  const weekEnd = midnightInMetricsTzUtc(nextMonday.getUTCFullYear(), nextMonday.getUTCMonth(), nextMonday.getUTCDate())

  const monthStart = midnightInMetricsTzUtc(y, m, 1)
  const monthEnd = midnightInMetricsTzUtc(y, m + 1, 1)

  return { todayStart, todayEnd, weekStart, weekEnd, monthStart, monthEnd }
}

export function getStoredLeadOccurredAt(row: StoredLeadTruthRow): Date | null {
  if (row.occurredAt instanceof Date && !Number.isNaN(row.occurredAt.getTime())) {
    return row.occurredAt
  }

  const canonical = extractStoredLeadCanonicalRecord(row)
  if (canonical.occurredAt && !Number.isNaN(canonical.occurredAt.getTime())) {
    return canonical.occurredAt
  }

  if (row.externalSourceType === 'odcrm_manual' && row.createdAt instanceof Date && !Number.isNaN(row.createdAt.getTime())) {
    return row.createdAt
  }

  return null
}

export function calculateStoredLeadMetrics(
  rows: StoredLeadMetricRow[],
  ranges: LeadMetricTimeRanges = getLeadMetricsTimeRangesUtc()
): LeadMetricSummary {
  const counts: LeadMetricCounts = { today: 0, week: 0, month: 0, total: 0 }
  const breakdownBySource: Record<string, number> = {}
  const breakdownByOwner: Record<string, number> = {}

  for (const row of rows) {
    if (!isRealStoredLeadRow(row)) continue

    counts.total += 1
    const occurredAt = getStoredLeadOccurredAt(row)
    if (!occurredAt) continue

    if (occurredAt >= ranges.todayStart && occurredAt < ranges.todayEnd) counts.today += 1
    if (occurredAt >= ranges.weekStart && occurredAt < ranges.weekEnd) counts.week += 1
    if (occurredAt >= ranges.monthStart && occurredAt < ranges.monthEnd) counts.month += 1

    if (occurredAt >= ranges.weekStart && occurredAt < ranges.weekEnd) {
      const canonical = extractStoredLeadCanonicalRecord(row)
      const source = row.source && String(row.source).trim() ? String(row.source).trim() : canonical.source || '(none)'
      const owner = row.owner && String(row.owner).trim() ? String(row.owner).trim() : canonical.owner || '(none)'
      breakdownBySource[source] = (breakdownBySource[source] || 0) + 1
      breakdownByOwner[owner] = (breakdownByOwner[owner] || 0) + 1
    }
  }

  return {
    ...counts,
    breakdownBySource,
    breakdownByOwner,
  }
}
