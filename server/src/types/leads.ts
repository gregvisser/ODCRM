/**
 * Shared types for Lead-related functionality
 * Extracted from leadsSync.ts for use across routes and workers
 */

export type LeadRow = {
  [key: string]: string
  accountName: string
}

export interface LeadAggregations {
  totalsByDay: Array<{date: string, count: number}>
  totalsByWeek: Array<{isoWeek: number, year: number, count: number}>
  totalsByMonth: Array<{month: number, year: number, count: number}>
  breakdownByTeamMember: Array<{teamMember: string, count: number}>
  breakdownByPlatform: Array<{platform: string, count: number}>
}

export interface CalculateActualsResult {
  weeklyActual: number
  monthlyActual: number
  aggregations: LeadAggregations
}

/**
 * Parse various date formats commonly found in spreadsheets
 */
export function parseDate(value: string): Date | null {
  if (!value || typeof value !== 'string') return null
  
  const trimmed = value.trim()
  if (!trimmed) return null

  // Try DD/MM/YYYY or DD.MM.YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[\.\/](\d{1,2})[\.\/](\d{2,4})$/)
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch
    const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y)
    const date = new Date(year, parseInt(m) - 1, parseInt(d))
    if (!isNaN(date.getTime())) return date
  }

  // Try YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    const [, y, m, d] = isoMatch
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
    if (!isNaN(date.getTime())) return date
  }

  // Fallback to native parsing
  const parsed = new Date(trimmed)
  if (!isNaN(parsed.getTime())) return parsed

  return null
}

/**
 * Calculate comprehensive aggregations with proper timezone handling
 */
export function calculateActualsFromLeads(accountName: string, leads: LeadRow[]): CalculateActualsResult {
  const now = new Date()
  const londonTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const [day, month, year] = londonTime.split('/').map(Number)
  const londonNow = new Date(year, month - 1, day)

  const currentWeekStart = new Date(londonNow)
  const dayOfWeek = currentWeekStart.getDay()
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  currentWeekStart.setDate(currentWeekStart.getDate() + diff)
  currentWeekStart.setHours(0, 0, 0, 0)

  const currentWeekEnd = new Date(currentWeekStart)
  currentWeekEnd.setDate(currentWeekEnd.getDate() + 7)

  const monthStart = new Date(londonNow.getFullYear(), londonNow.getMonth(), 1)
  const monthEnd = new Date(londonNow.getFullYear(), londonNow.getMonth() + 1, 1)

  const accountLeads = leads.filter((lead) => lead.accountName === accountName)

  let weeklyActual = 0
  let monthlyActual = 0

  const dayCounts = new Map<string, number>()
  const weekCounts = new Map<string, number>()
  const monthCounts = new Map<string, number>()
  const teamMemberCounts = new Map<string, number>()
  const platformCounts = new Map<string, number>()

  accountLeads.forEach((lead) => {
    let dateValue = lead['Date'] || lead['date'] || lead['Created At'] || lead['createdAt'] || lead['First Meeting Date'] || ''

    if (!dateValue) {
      for (const key of Object.keys(lead)) {
        const value = lead[key] || ''
        if (value && /^\d{1,2}[\.\/]\d{1,2}[\.\/]\d{2,4}$/.test(value.trim())) {
          dateValue = value.trim()
          break
        }
      }
    }

    const parsedDate = parseDate(dateValue)
    if (!parsedDate) return

    if (parsedDate >= currentWeekStart && parsedDate < currentWeekEnd) {
      weeklyActual++
    }
    if (parsedDate >= monthStart && parsedDate < monthEnd) {
      monthlyActual++
    }

    // Daily aggregation
    const dateKey = parsedDate.toISOString().split('T')[0]
    dayCounts.set(dateKey, (dayCounts.get(dateKey) || 0) + 1)

    // Weekly aggregation (ISO week)
    const isoWeek = getISOWeek(parsedDate)
    const weekKey = `${parsedDate.getFullYear()}-W${isoWeek}`
    weekCounts.set(weekKey, (weekCounts.get(weekKey) || 0) + 1)

    // Monthly aggregation
    const monthKey = `${parsedDate.getFullYear()}-${parsedDate.getMonth() + 1}`
    monthCounts.set(monthKey, (monthCounts.get(monthKey) || 0) + 1)

    // Team member breakdown
    const teamMember = lead['Team Member'] || lead['teamMember'] || lead['Owner'] || lead['owner'] || 'Unknown'
    teamMemberCounts.set(teamMember, (teamMemberCounts.get(teamMember) || 0) + 1)

    // Platform breakdown
    const platform = lead['Platform'] || lead['platform'] || lead['Source'] || lead['source'] || 'Unknown'
    platformCounts.set(platform, (platformCounts.get(platform) || 0) + 1)
  })

  return {
    weeklyActual,
    monthlyActual,
    aggregations: {
      totalsByDay: Array.from(dayCounts.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      totalsByWeek: Array.from(weekCounts.entries())
        .map(([key, count]) => {
          const [yearStr, weekStr] = key.split('-W')
          return { isoWeek: parseInt(weekStr), year: parseInt(yearStr), count }
        })
        .sort((a, b) => a.year - b.year || a.isoWeek - b.isoWeek),
      totalsByMonth: Array.from(monthCounts.entries())
        .map(([key, count]) => {
          const [yearStr, monthStr] = key.split('-')
          return { month: parseInt(monthStr), year: parseInt(yearStr), count }
        })
        .sort((a, b) => a.year - b.year || a.month - b.month),
      breakdownByTeamMember: Array.from(teamMemberCounts.entries())
        .map(([teamMember, count]) => ({ teamMember, count }))
        .sort((a, b) => b.count - a.count),
      breakdownByPlatform: Array.from(platformCounts.entries())
        .map(([platform, count]) => ({ platform, count }))
        .sort((a, b) => b.count - a.count),
    },
  }
}

/**
 * Get ISO week number
 */
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}
