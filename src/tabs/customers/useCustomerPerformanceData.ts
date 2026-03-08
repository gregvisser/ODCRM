import { useMemo } from 'react'
import { useCustomersFromDatabase } from '../../hooks/useCustomersFromDatabase'

type PerformanceAccount = {
  id?: string
  name: string
  defcon: number
}

export type AccountPerformanceRow = {
  account: PerformanceAccount
  weeklyActual: number
  monthlyActual: number
  weeklyTarget: number
  monthlyTarget: number
  percentToTarget: number
  spend: number
  leadCount: number
}

export type PerformanceTotals = {
  weeklyActual: number
  weeklyTarget: number
  monthlyActual: number
  monthlyTarget: number
  spend: number
  leadCount: number
}

export type PerformanceMeta = {
  currentMonthLabel: string
  currentWeekLabel: string
  lastSyncedAt: Date | null
}

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' })
const DAY_FORMATTER = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' })

function getIsoWeek(date: Date): number {
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = temp.getUTCDay() || 7
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1))
  return Math.ceil(((temp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function getWeekRangeLabel(reference: Date): string {
  const start = new Date(reference)
  const day = start.getDay()
  const diff = day === 0 ? -6 : 1 - day
  start.setDate(start.getDate() + diff)
  const end = new Date(start)
  end.setDate(start.getDate() + 4)
  const formattedRange = `${DAY_FORMATTER.format(start)} – ${DAY_FORMATTER.format(end)}`
  return `Week ${getIsoWeek(reference)} • ${formattedRange}`
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export function useCustomerPerformanceData() {
  const { customers, loading, error } = useCustomersFromDatabase()

  const rows = useMemo<AccountPerformanceRow[]>(() => {
    return (customers || []).map((customer) => {
      const weeklyActual = toNumber(customer.weeklyLeadActual)
      const monthlyActual = toNumber(customer.monthlyLeadActual)
      const weeklyTarget = toNumber(customer.weeklyLeadTarget)
      const monthlyTarget = toNumber(customer.monthlyLeadTarget)
      const percentToTarget = monthlyTarget > 0 ? monthlyActual / monthlyTarget : 0

      return {
        account: {
          id: customer.id,
          name: customer.name,
          defcon: typeof customer.defcon === 'number' ? customer.defcon : 3,
        },
        weeklyActual,
        monthlyActual,
        weeklyTarget,
        monthlyTarget,
        percentToTarget,
        // This keeps the existing table column populated from current DB customer truth.
        spend: toNumber(customer.monthlyRevenueFromCustomer),
        // Transitional-safe approximation for report cards where row-level lead records are not joined here.
        leadCount: monthlyActual,
      }
    })
  }, [customers])

  const totals = useMemo<PerformanceTotals>(() => {
    return rows.reduce<PerformanceTotals>(
      (acc, row) => ({
        weeklyActual: acc.weeklyActual + row.weeklyActual,
        weeklyTarget: acc.weeklyTarget + row.weeklyTarget,
        monthlyActual: acc.monthlyActual + row.monthlyActual,
        monthlyTarget: acc.monthlyTarget + row.monthlyTarget,
        spend: acc.spend + row.spend,
        leadCount: acc.leadCount + row.leadCount,
      }),
      { weeklyActual: 0, weeklyTarget: 0, monthlyActual: 0, monthlyTarget: 0, spend: 0, leadCount: 0 },
    )
  }, [rows])

  const lastSyncedAt = useMemo(() => {
    let latest: Date | null = null
    for (const customer of customers || []) {
      const candidate = new Date(customer.updatedAt)
      if (Number.isNaN(candidate.getTime())) continue
      if (!latest || candidate > latest) latest = candidate
    }
    return latest
  }, [customers])

  const meta = useMemo<PerformanceMeta>(() => {
    const now = new Date()
    return {
      currentMonthLabel: MONTH_FORMATTER.format(now),
      currentWeekLabel: getWeekRangeLabel(now),
      lastSyncedAt,
    }
  }, [lastSyncedAt])

  return { rows, totals, meta, loading, error }
}

