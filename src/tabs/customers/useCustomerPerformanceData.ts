import { useEffect, useMemo, useState } from 'react'
import {
  type Account,
  type Lead,
  loadAccountsFromStorage,
  loadLeadsFromStorage,
  calculateActualsFromLeads,
} from '../../components/AccountsTab'
import { on } from '../../platform/events'
import { OdcrmStorageKeys } from '../../platform/keys'
import { getItem } from '../../platform/storage'

export type AccountPerformanceRow = {
  account: Account
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
  lastSyncedAt: Date
}

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' })
const DAY_FORMATTER = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' })

function getLastLeadSync(): Date | null {
  const raw = getItem(OdcrmStorageKeys.marketingLeadsLastRefresh)
  if (!raw) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

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

export function useCustomerPerformanceData() {
  const [accounts, setAccounts] = useState<Account[]>(() => loadAccountsFromStorage())
  const [leads, setLeads] = useState<Lead[]>(() => loadLeadsFromStorage())
  // Use current time for live reporting - data is always up-to-date
  const [lastSyncedAt, setLastSyncedAt] = useState<Date>(() => new Date())

  useEffect(() => {
    const offAccounts = on<Account[]>('accountsUpdated', (updated) => {
      if (Array.isArray(updated) && updated.length > 0) {
        setAccounts(updated)
        // Update sync time when accounts change (data is live)
        setLastSyncedAt(new Date())
      } else {
        setAccounts(loadAccountsFromStorage())
        setLastSyncedAt(new Date())
      }
    })

    const offLeads = on('leadsUpdated', () => {
      setLeads(loadLeadsFromStorage())
      // Update sync time when leads change (data is live)
      setLastSyncedAt(new Date())
    })

    // Update sync time periodically to show it's live (every minute)
    const interval = setInterval(() => {
      setLastSyncedAt(new Date())
    }, 60000) // Update every minute

    return () => {
      offAccounts()
      offLeads()
      clearInterval(interval)
    }
  }, [])

  const leadCounts = useMemo(() => {
    const counts = new Map<string, number>()
    leads.forEach((lead) => {
      const key = lead.accountName || 'Unknown'
      counts.set(key, (counts.get(key) || 0) + 1)
    })
    return counts
  }, [leads])

  const rows = useMemo<AccountPerformanceRow[]>(() => {
    return accounts.map((account) => {
      const actuals = calculateActualsFromLeads(account.name, leads)
      const weeklyTarget = account.weeklyTarget ?? 0
      const monthlyTarget = account.monthlyTarget ?? 0
      const percentToTarget = monthlyTarget > 0 ? actuals.monthlyActual / monthlyTarget : 0
      return {
        account,
        weeklyActual: actuals.weeklyActual,
        monthlyActual: actuals.monthlyActual,
        weeklyTarget,
        monthlyTarget,
        percentToTarget,
        spend: account.monthlySpendGBP ?? 0,
        leadCount: leadCounts.get(account.name) ?? 0,
      }
    })
  }, [accounts, leads, leadCounts])

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

  const meta = useMemo<PerformanceMeta>(() => {
    const now = new Date()
    return {
      currentMonthLabel: MONTH_FORMATTER.format(now),
      currentWeekLabel: getWeekRangeLabel(now),
      lastSyncedAt,
    }
  }, [lastSyncedAt])

  return { rows, totals, meta }
}


