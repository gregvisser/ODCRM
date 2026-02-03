import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Badge,
  Box,
  Heading,
  HStack,
  IconButton,
  Progress,
  SimpleGrid,
  Spinner,
  Stack,
  Stat,
  StatHelpText,
  StatLabel,
  StatNumber,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
  VStack,
} from '@chakra-ui/react'
import { CheckCircleIcon, RepeatIcon, WarningIcon, DownloadIcon } from '@chakra-ui/icons'
import { type Account } from '../../components/AccountsTab'
import { syncAccountLeadCountsFromLeads } from '../../utils/accountsLeadsSync'
import { emit, on } from '../../platform/events'
import { api } from '../../utils/api'
import { fetchLeadsFromApi } from '../../utils/leadsApi'
import { DataTable, type DataTableColumn } from '../../components/DataTable'

type Lead = {
  [key: string]: string
  accountName: string
}

type CustomerApi = {
  id: string
  name: string
  domain?: string | null
  accountData?: Record<string, unknown> | null
  leadsReportingUrl?: string | null
  sector?: string | null
  clientStatus?: string | null
  targetJobTitle?: string | null
  prospectingLocation?: string | null
  monthlyIntakeGBP?: number | string | null
  defcon?: number | null
  weeklyLeadTarget?: number | null
  weeklyLeadActual?: number | null
  monthlyLeadTarget?: number | null
  monthlyLeadActual?: number | null
}

const LEAD_SOURCE_CATEGORIES = [
  'Individual Email',
  'Telesales',
  'SJ Contact List',
  'Salesforce Individual Email',
  'Personal Contacts',
  'Old CRM',
  'LinkedIn',
  'CRM Email',
] as const

const LEAD_SOURCE_KEYWORDS: Record<string, string[]> = {
  'Individual Email': ['individual email'],
  Telesales: ['telesales', 'tele-sales'],
  'SJ Contact List': ['sj contact'],
  'Salesforce Individual Email': ['salesforce individual email', 'salesforce email'],
  'Personal Contacts': ['personal contact'],
  'Old CRM': ['old crm'],
  LinkedIn: ['linkedin'],
  'CRM Email': ['crm email'],
}

const DEFAULT_ABOUT_SECTIONS: Account['aboutSections'] = {
  whatTheyDo: '',
  accreditations: '',
  keyLeaders: '',
  companyProfile: '',
  recentNews: '',
  companySize: '',
  headquarters: '',
  foundingYear: '',
}

const normalizeLeadSource = (value: string | undefined): string | null => {
  if (!value) return null
  const cleaned = value.trim().toLowerCase()
  if (!cleaned) return null

  const exactMatch = LEAD_SOURCE_CATEGORIES.find((source) => source.toLowerCase() === cleaned)
  if (exactMatch) return exactMatch

  for (const category of LEAD_SOURCE_CATEGORIES) {
    const keywords = LEAD_SOURCE_KEYWORDS[category] || []
    if (keywords.some((keyword) => cleaned.includes(keyword))) {
      return category
    }
  }

  return null
}

function mapClientStatusToAccountStatus(status?: string | null): Account['status'] {
  switch (status) {
    case 'inactive':
      return 'Inactive'
    case 'onboarding':
    case 'win_back':
      return 'On Hold'
    default:
      return 'Active'
  }
}

function normalizeCustomerWebsite(domain?: string | null): string {
  if (!domain) return ''
  if (domain.startsWith('http://') || domain.startsWith('https://')) return domain
  return `https://${domain}`
}

function coerceAccountData(value: unknown): Partial<Account> | null {
  if (!value || typeof value !== 'object') return null
  return value as Partial<Account>
}

function normalizeAccountDefaults(raw: Partial<Account>): Account {
  return {
    name: raw.name || '',
    website: raw.website || '',
    aboutSections: { ...DEFAULT_ABOUT_SECTIONS, ...(raw.aboutSections || {}) },
    sector: raw.sector || '',
    socialMedia: Array.isArray(raw.socialMedia) ? raw.socialMedia : [],
    logoUrl: raw.logoUrl,
    aboutSource: raw.aboutSource,
    aboutLocked: raw.aboutLocked,
    status: raw.status || 'Active',
    targetLocation: Array.isArray(raw.targetLocation) ? raw.targetLocation : [],
    targetTitle: raw.targetTitle || '',
    monthlySpendGBP: Number(raw.monthlySpendGBP || 0),
    agreements: Array.isArray(raw.agreements) ? raw.agreements : [],
    defcon: typeof raw.defcon === 'number' ? raw.defcon : 3,
    contractStart: raw.contractStart || '',
    contractEnd: raw.contractEnd || '',
    days: typeof raw.days === 'number' ? raw.days : 0,
    contacts: typeof raw.contacts === 'number' ? raw.contacts : 0,
    leads: typeof raw.leads === 'number' ? raw.leads : 0,
    weeklyTarget: typeof raw.weeklyTarget === 'number' ? raw.weeklyTarget : 0,
    weeklyActual: typeof raw.weeklyActual === 'number' ? raw.weeklyActual : 0,
    monthlyTarget: typeof raw.monthlyTarget === 'number' ? raw.monthlyTarget : 0,
    monthlyActual: typeof raw.monthlyActual === 'number' ? raw.monthlyActual : 0,
    weeklyReport: raw.weeklyReport || '',
    users: Array.isArray(raw.users) ? raw.users : [],
    clientLeadsSheetUrl: raw.clientLeadsSheetUrl || '',
    notes: Array.isArray(raw.notes) ? raw.notes : undefined,
  }
}

function applyCustomerFieldsToAccount(account: Account, customer: CustomerApi): Account {
  const updated: Account = { ...account }
  if (customer.name) updated.name = customer.name
  if (customer.domain) updated.website = normalizeCustomerWebsite(customer.domain)
  if (customer.sector) updated.sector = customer.sector
  if (customer.clientStatus) updated.status = mapClientStatusToAccountStatus(customer.clientStatus)
  if (customer.prospectingLocation) updated.targetLocation = [customer.prospectingLocation]
  if (customer.targetJobTitle) updated.targetTitle = customer.targetJobTitle
  if (customer.monthlyIntakeGBP) updated.monthlySpendGBP = Number(customer.monthlyIntakeGBP || 0)
  if (typeof customer.defcon === 'number') updated.defcon = customer.defcon
  if (typeof customer.weeklyLeadTarget === 'number') updated.weeklyTarget = customer.weeklyLeadTarget
  if (typeof customer.weeklyLeadActual === 'number') updated.weeklyActual = customer.weeklyLeadActual
  if (typeof customer.monthlyLeadTarget === 'number') updated.monthlyTarget = customer.monthlyLeadTarget
  if (typeof customer.monthlyLeadActual === 'number') updated.monthlyActual = customer.monthlyLeadActual
  if (customer.leadsReportingUrl) updated.clientLeadsSheetUrl = customer.leadsReportingUrl
  return updated
}

function buildAccountFromCustomer(customer: CustomerApi): Account {
  const fallback = normalizeAccountDefaults({
    name: customer.name,
    website: normalizeCustomerWebsite(customer.domain),
    sector: customer.sector || '',
    status: mapClientStatusToAccountStatus(customer.clientStatus),
    targetLocation: customer.prospectingLocation ? [customer.prospectingLocation] : [],
    targetTitle: customer.targetJobTitle || '',
    monthlySpendGBP: Number(customer.monthlyIntakeGBP || 0),
    defcon: customer.defcon ?? 3,
    weeklyTarget: customer.weeklyLeadTarget ?? 0,
    weeklyActual: customer.weeklyLeadActual ?? 0,
    monthlyTarget: customer.monthlyLeadTarget ?? 0,
    monthlyActual: customer.monthlyLeadActual ?? 0,
    clientLeadsSheetUrl: customer.leadsReportingUrl || '',
  })
  const accountData = coerceAccountData(customer.accountData)
  const base = accountData ? normalizeAccountDefaults({ ...fallback, ...accountData }) : fallback
  return applyCustomerFieldsToAccount(base, customer)
}

// localStorage helper functions removed - dashboard now uses API as single source of truth

export default function DashboardsHomePage() {
  const toast = useToast()
  // Start with empty arrays - API will load fresh data immediately
  const [accountsData, setAccountsData] = useState<Account[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [hasSyncedCustomers, setHasSyncedCustomers] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [showDebugPanel, setShowDebugPanel] = useState(false)
  const [debugInfo, setDebugInfo] = useState<any[]>([])
  
  // Use ref to avoid dependency issues that cause glitching
  const leadsRef = useRef(leads)
  useEffect(() => {
    leadsRef.current = leads
  }, [leads])

  const refreshLeads = useCallback(async (forceRefresh: boolean) => {
    // ALWAYS fetch from API (database is source of truth)
    setLoading(true)
    try {
      console.log('🔄 Dashboard: Fetching fresh leads from API...')
      const response = await fetchLeadsFromApi()
      const allLeads = response.leads || []
      const lastSyncAt = response.lastSyncAt
      
      console.log(`✅ Dashboard: Loaded ${allLeads.length} leads from API`)
      console.log('📊 Response details:', { 
        leadsCount: allLeads.length, 
        lastSyncAt,
        diagnostics: response.diagnostics || 'none'
      })
      
      if (allLeads.length === 0) {
        console.warn('⚠️ Dashboard: ZERO leads returned from API!')
        console.warn('⚠️ Possible reasons:')
        console.warn('   1. No customers have Google Sheets URLs configured')
        console.warn('   2. Leads sync has not been triggered yet')
        console.warn('   3. Leads sync is failing')
        console.warn('   4. Check Accounts tab → Ensure customers have Google Sheets URLs')
      } else {
        // Sample the first lead to see its structure
        console.log('📄 Sample lead structure:', Object.keys(allLeads[0] || {}))
      }
      
      // NO localStorage persistence - keep data in memory only
      setLeads(allLeads)
      setLastRefresh(lastSyncAt ? new Date(lastSyncAt) : new Date())
      syncAccountLeadCountsFromLeads(allLeads)
      
      console.log('✅ Dashboard: Leads state updated, syncAccountLeadCounts called')
    } catch (err: any) {
      console.error('❌ Dashboard: Failed to fetch leads:', err)
      toast({
        title: 'Leads refresh failed',
        description: err?.message || 'Unable to refresh leads from the server.',
        status: 'error',
        duration: 6000,
        isClosable: true,
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    const syncFromCustomers = async () => {
      if (hasSyncedCustomers) return
      setHasSyncedCustomers(true)
      
      console.log('🔄 Dashboard: Fetching customers from API...')
      const { data, error } = await api.get<CustomerApi[]>('/api/customers')
      
      if (error) {
        console.error('❌ Dashboard: Failed to fetch customers:', error)
        return
      }
      
      if (!data || data.length === 0) {
        console.warn('⚠️ Dashboard: ZERO customers returned from API!')
        console.warn('⚠️ You need to add customers in the Accounts tab first.')
        return
      }

      console.log(`✅ Dashboard: Loaded ${data.length} customers from API`)
      
      // Check which customers have Google Sheets URLs
      const customersWithUrls = data.filter(c => c.leadsReportingUrl)
      console.log(`📊 Customers with Google Sheets URLs: ${customersWithUrls.length}/${data.length}`)
      
      if (customersWithUrls.length === 0) {
        console.warn('⚠️ Dashboard: NO customers have Google Sheets URLs configured!')
        console.warn('⚠️ This is why NO leads data is showing!')
        console.warn('⚠️ Solution: Go to Accounts tab → Edit each customer → Add Google Sheets URL')
      } else {
        customersWithUrls.forEach(c => {
          console.log(`  ✅ ${c.name}: ${c.leadsReportingUrl}`)
        })
      }

      const hydrated = data.map((customer) => buildAccountFromCustomer(customer))
      // NO localStorage persistence - API is the ONLY source of truth
      setAccountsData(hydrated)
      emit('accountsUpdated', hydrated)
    }

    const init = async () => {
      await syncFromCustomers()
      await refreshLeads(false)
    }

    void init()

    const offAccountsUpdated = on<Account[]>('accountsUpdated', (accounts) => {
      // Use the passed data instead of loading from localStorage
      if (accounts && accounts.length > 0) {
        setAccountsData(accounts)
      }
      void refreshLeads(true)
    })
    const offLeadsUpdated = on<Lead[]>('leadsUpdated', (updatedLeads) => {
      // Use the passed data instead of loading from localStorage
      if (updatedLeads && updatedLeads.length > 0) {
        setLeads(updatedLeads)
        setLastRefresh(new Date())
      }
    })

    // Auto-refresh every 30 seconds to keep dashboard current
    const refreshInterval = setInterval(async () => {
      // Refresh both customers and leads automatically
      const syncFromCustomers = async () => {
        const { data, error } = await api.get<CustomerApi[]>('/api/customers')
        if (error || !data || data.length === 0) return
        const hydrated = data.map((customer) => buildAccountFromCustomer(customer))
        // NO localStorage persistence - API is the ONLY source of truth
        setAccountsData(hydrated)
        emit('accountsUpdated', hydrated)
      }

      await Promise.allSettled([
        syncFromCustomers(),
        refreshLeads(false)
      ])
    }, 30 * 1000)

    return () => {
      offAccountsUpdated()
      offLeadsUpdated()
      clearInterval(refreshInterval)
    }
  }, [refreshLeads, hasSyncedCustomers])

  const unifiedAnalytics = useMemo(() => {
    const totalWeeklyTarget = accountsData.reduce((sum, acc) => sum + (acc.weeklyTarget || 0), 0)
    const totalMonthlyTarget = accountsData.reduce((sum, acc) => sum + (acc.monthlyTarget || 0), 0)

    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfToday = new Date(startOfToday)
    endOfToday.setDate(endOfToday.getDate() + 1)

    const weekStart = new Date(startOfToday)
    const day = weekStart.getDay()
    const diff = day === 0 ? -6 : 1 - day
    weekStart.setDate(weekStart.getDate() + diff)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()

    const dailyTargetFromWeekly = totalWeeklyTarget / 7
    const dailyTargetFromMonthly = totalMonthlyTarget / daysInMonth
    const dailyTarget = dailyTargetFromWeekly > 0 ? dailyTargetFromWeekly : dailyTargetFromMonthly

    const parseLeadDate = (dateStr: string): Date | null => {
      if (!dateStr || dateStr.trim() === '') return null
      
      const trimmed = dateStr.trim()
      
      // Try dd.mm.yy format (e.g., 03.02.26)
      const ddmmyy = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/)
      if (ddmmyy) {
        const day = parseInt(ddmmyy[1], 10)
        const month = parseInt(ddmmyy[2], 10) - 1
        const year = parseInt(ddmmyy[3], 10) < 100 ? 2000 + parseInt(ddmmyy[3], 10) : parseInt(ddmmyy[3], 10)
        return new Date(year, month, day)
      }
      
      // Try dd/mm/yyyy format (e.g., 03/02/2026)
      const ddmmyyyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
      if (ddmmyyyy) {
        const day = parseInt(ddmmyyyy[1], 10)
        const month = parseInt(ddmmyyyy[2], 10) - 1
        const year = parseInt(ddmmyyyy[3], 10)
        return new Date(year, month, day)
      }
      
      // Try Week format (e.g., "Week 5 - 03 Feb")
      const weekMatch = trimmed.match(/Week\s+(\d+)/i)
      if (weekMatch) {
        const dateAfterDash = trimmed.split('-')[1]
        if (dateAfterDash) {
          const parsed = new Date(dateAfterDash.trim())
          if (!isNaN(parsed.getTime())) return parsed
        }
      }
      
      // Try standard Date parsing as fallback
      const parsed = new Date(trimmed)
      return isNaN(parsed.getTime()) ? null : parsed
    }

    const leadsWithDates = leads
      .map((lead) => {
        const dateValue =
          lead['Date'] ||
          lead['date'] ||
          lead['Week'] ||
          lead['week'] ||
          lead['First Meeting Date'] ||
          ''
        const parsedDate = parseLeadDate(dateValue)
        if (!parsedDate) return null
        return { data: lead, parsedDate }
      })
      .filter((x): x is { data: Lead; parsedDate: Date } => Boolean(x))

    const computeMetrics = (start: Date, end: Date) => {
      const breakdown: Record<string, number> = {}
      const teamBreakdown: Record<string, number> = {}
      let actual = 0

      leadsWithDates.forEach((entry) => {
        if (entry.parsedDate >= start && entry.parsedDate < end) {
          actual += 1

          const channel = entry.data['Channel of Lead'] || entry.data['channel of lead'] || ''
          const normalized = normalizeLeadSource(channel)
          const key = normalized || (channel ? channel : '')
          if (key) breakdown[key] = (breakdown[key] || 0) + 1

          const rawTeamMember =
            entry.data['OD Team Member'] ||
            entry.data['OD team member'] ||
            entry.data['od team member'] ||
            entry.data['OD Team'] ||
            entry.data['od team'] ||
            ''

          if (rawTeamMember && rawTeamMember.trim()) {
            const members = rawTeamMember
              .split(/,|&|\/|\+|\band\b/gi)
              .map((m) => m.trim())
              .filter(Boolean)

            members.forEach((member) => {
              teamBreakdown[member] = (teamBreakdown[member] || 0) + 1
            })
          }
        }
      })

      return { actual, breakdown, teamBreakdown }
    }

    return {
      periodMetrics: {
        today: { label: 'Today', ...computeMetrics(startOfToday, endOfToday), target: Math.max(Math.round(dailyTarget), 0) },
        week: { label: 'This Week', ...computeMetrics(weekStart, weekEnd), target: Math.max(Math.round(totalWeeklyTarget), 0) },
        month: { label: 'This Month', ...computeMetrics(monthStart, monthEnd), target: Math.max(Math.round(totalMonthlyTarget), 0) },
      },
    }
  }, [accountsData, leads])

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfToday = new Date(startOfToday)
  endOfToday.setDate(endOfToday.getDate() + 1)

  const weekStart = new Date(startOfToday)
  const day = weekStart.getDay()
  const diff = day === 0 ? -6 : 1 - day
  weekStart.setDate(weekStart.getDate() + diff)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  // Use the SAME parseLeadDate function from unifiedAnalytics (supports multiple date formats)
  const parseLeadDateFlexible = (dateStr: string): Date | null => {
    if (!dateStr || dateStr.trim() === '') return null
    
    const trimmed = dateStr.trim()
    
    // Try dd.mm.yy format (e.g., 03.02.26)
    const ddmmyy = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/)
    if (ddmmyy) {
      const day = parseInt(ddmmyy[1], 10)
      const month = parseInt(ddmmyy[2], 10) - 1
      const year = parseInt(ddmmyy[3], 10) < 100 ? 2000 + parseInt(ddmmyy[3], 10) : parseInt(ddmmyy[3], 10)
      return new Date(year, month, day)
    }
    
    // Try dd/mm/yyyy format (e.g., 03/02/2026)
    const ddmmyyyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (ddmmyyyy) {
      const day = parseInt(ddmmyyyy[1], 10)
      const month = parseInt(ddmmyyyy[2], 10) - 1
      const year = parseInt(ddmmyyyy[3], 10)
      return new Date(year, month, day)
    }
    
    // Try mm/dd/yyyy format (US format, e.g., 02/03/2026)
    const mmddyyyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (mmddyyyy) {
      const month = parseInt(mmddyyyy[1], 10) - 1
      const day = parseInt(mmddyyyy[2], 10)
      const year = parseInt(mmddyyyy[3], 10)
      const usDate = new Date(year, month, day)
      if (!isNaN(usDate.getTime())) return usDate
    }
    
    // Try Week format (e.g., "Week 5 - 03 Feb" or "Week 5")
    const weekMatch = trimmed.match(/Week\s+(\d+)/i)
    if (weekMatch) {
      // Try to extract date after the dash
      const dateAfterDash = trimmed.split('-')[1]
      if (dateAfterDash) {
        const parsed = new Date(dateAfterDash.trim())
        if (!isNaN(parsed.getTime())) return parsed
      }
    }
    
    // Try standard Date parsing as fallback (handles ISO, other formats)
    const parsed = new Date(trimmed)
    return isNaN(parsed.getTime()) ? null : parsed
  }

  const leadsWithDates = leads
    .map((lead) => {
      const dateValue = lead['Date'] || lead['date'] || lead['Week'] || lead['week'] || lead['First Meeting Date'] || ''
      const parsedDate = parseLeadDateFlexible(dateValue)
      
      // DEBUG: Collect GreenTheUK leads info for visual display
      if (lead.accountName === 'GreenTheUK Limited') {
        const debugData = {
          dateValue,
          parsedDate: parsedDate ? parsedDate.toISOString() : 'NULL',
          allDateFields: {
            'Date': lead['Date'],
            'date': lead['date'],
            'Week': lead['Week'],
            'week': lead['week'],
            'First Meeting Date': lead['First Meeting Date']
          },
          leadName: lead['Name'] || lead['name'] || 'unknown',
          isToday: parsedDate ? (parsedDate >= startOfToday && parsedDate < endOfToday) : false,
          isThisWeek: parsedDate ? (parsedDate >= weekStart && parsedDate < weekEnd) : false,
          isThisMonth: parsedDate ? (parsedDate >= monthStart && parsedDate < monthEnd) : false,
        }
        console.log('🔍 GreenTheUK Lead Debug:', debugData)
        setDebugInfo(prev => [...prev.slice(-20), debugData]) // Keep last 20 leads
      }
      
      if (!parsedDate) return null
      return { data: lead, parsedDate }
    })
    .filter((x): x is { data: Lead; parsedDate: Date } => Boolean(x))

  const weekTotal = leadsWithDates.filter(
    (entry) => entry.parsedDate >= weekStart && entry.parsedDate < weekEnd
  ).length

  const monthTotal = leadsWithDates.filter(
    (entry) => entry.parsedDate >= monthStart && entry.parsedDate < monthEnd
  ).length

  const todayTotal = leadsWithDates.filter(
    (entry) => entry.parsedDate >= startOfToday && entry.parsedDate < endOfToday
  ).length

  const totalWeeklyTarget = accountsData.reduce((sum, acc) => sum + (acc.weeklyTarget || 0), 0)
  const totalMonthlyTarget = accountsData.reduce((sum, acc) => sum + (acc.monthlyTarget || 0), 0)

  const channelBreakdown: Record<string, number> = {}
  leadsWithDates
    .filter((entry) => entry.parsedDate >= weekStart && entry.parsedDate < weekEnd)
    .forEach((entry) => {
      const channel = entry.data['Channel of Lead'] || entry.data['channel of lead'] || 'Unknown'
      channelBreakdown[channel] = (channelBreakdown[channel] || 0) + 1
    })

  const teamBreakdown: Record<string, number> = {}
  leadsWithDates
    .filter((entry) => entry.parsedDate >= weekStart && entry.parsedDate < weekEnd)
    .forEach((entry) => {
      const member = entry.data['OD Team Member'] || entry.data['OD team member'] || 'Unknown'
      if (member && member.trim() && member !== 'Unknown') {
        teamBreakdown[member] = (teamBreakdown[member] || 0) + 1
      }
    })

  const salesLeaderboard = Object.entries(teamBreakdown)
    .map(([name, leads]) => ({ name, leads }))
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 5)

  const accountsWithPercentages = accountsData
    .map((account) => ({
      ...account,
      monthlyPercentage: account.monthlyTarget > 0 
        ? ((account.monthlyActual || 0) / account.monthlyTarget) * 100 
        : 0,
    }))
    .sort((a, b) => b.monthlySpendGBP - a.monthlySpendGBP)
  
  // DataTable columns definition
  const dashboardColumns: DataTableColumn<typeof accountsWithPercentages[0]>[] = [
    {
      id: 'name',
      header: 'Client',
      accessorKey: 'name',
      sortable: true,
      filterable: true,
      width: 200,
    },
    {
      id: 'monthlySpendGBP',
      header: 'Spend (£)',
      accessorKey: 'monthlySpendGBP',
      cell: ({ value }) => value.toLocaleString(),
      sortable: true,
      width: 120,
    },
    {
      id: 'weeklyActual',
      header: 'Week Actual',
      accessorKey: 'weeklyActual',
      cell: ({ value }) => value || 0,
      sortable: true,
      width: 100,
    },
    {
      id: 'weeklyTarget',
      header: 'Week Target',
      accessorKey: 'weeklyTarget',
      cell: ({ value }) => value || 0,
      sortable: true,
      width: 100,
    },
    {
      id: 'monthlyActual',
      header: 'Month Actual',
      accessorKey: 'monthlyActual',
      cell: ({ value }) => value || 0,
      sortable: true,
      width: 120,
    },
    {
      id: 'monthlyTarget',
      header: 'Month Target',
      accessorKey: 'monthlyTarget',
      cell: ({ value }) => value || 0,
      sortable: true,
      width: 120,
    },
    {
      id: 'monthlyPercentage',
      header: '% Target',
      accessorKey: 'monthlyPercentage',
      cell: ({ value }) => (
        <Text
          color={
            value >= 100 ? 'green.600' :
            value >= 50 ? 'yellow.600' :
            'red.600'
          }
          fontWeight="semibold"
        >
          {value.toFixed(1)}%
        </Text>
      ),
      sortable: true,
      width: 100,
    },
    {
      id: 'defcon',
      header: 'DEFCON',
      accessorKey: 'defcon',
      cell: ({ value }) => (
        <Badge
          colorScheme={
            value <= 2 ? 'red' :
            value === 3 ? 'yellow' :
            value >= 4 && value <= 5 ? 'green' :
            'blue'
          }
          fontSize="sm"
          px={2}
        >
          {value}
        </Badge>
      ),
      sortable: true,
      width: 90,
    },
  ]

  const weekProgress = totalWeeklyTarget > 0 ? (weekTotal / totalWeeklyTarget) * 100 : 0
  const isWeekOnTrack = weekTotal >= totalWeeklyTarget * 0.8
  const dailyTarget = Math.ceil(totalWeeklyTarget / 7)
  const currentMonth = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const weekNumber = Math.ceil((now.getDate() + startOfToday.getDay()) / 7)

  if (loading && leads.length === 0) {
    return (
      <Box textAlign="center" py={12}>
        <Spinner size="xl" color="brand.700" thickness="4px" />
        <Text mt={4} color="gray.600">
          Loading live lead performance...
        </Text>
      </Box>
    )
  }

  return (
    <VStack spacing={3} align="stretch">
      {/* Header Stats */}
      <Box bg="white" p={3} borderRadius="md" shadow="sm" border="1px" borderColor="gray.200">
        <HStack justify="space-between" mb={2} flexWrap="wrap">
          <Box>
            <Heading size="md" color="gray.700">
              Client Lead Generation Dashboard
            </Heading>
            <Text fontSize="xs" color="gray.500" mt={1}>
              Auto-refreshes every 30 seconds • Last updated: {lastRefresh.toLocaleTimeString()}
            </Text>
          </Box>
          <HStack spacing={2}>
            <IconButton
              aria-label="Toggle debug panel"
              icon={<WarningIcon />}
              onClick={() => setShowDebugPanel(!showDebugPanel)}
              colorScheme={showDebugPanel ? 'yellow' : 'gray'}
              size="sm"
              title="Show GreenTheUK date debugging"
            />
            <IconButton
              aria-label="Sync from Google Sheets"
              icon={<DownloadIcon />}
              onClick={async () => {
                setIsSyncing(true)
                try {
                  const { data: customers, error: customersError } = await api.get<CustomerApi[]>('/api/customers')
                  if (customersError || !customers) throw new Error('Failed to fetch customers')
                  
                  const customersWithUrls = customers.filter(c => c.leadsReportingUrl)
                  const syncPromises = customersWithUrls.map(async (customer) => {
                    try {
                      const { error } = await api.post(`/api/leads/sync/trigger?customerId=${customer.id}`)
                      return { customer: customer.name, success: !error }
                    } catch {
                      return { customer: customer.name, success: false }
                    }
                  })
                  
                  const results = await Promise.all(syncPromises)
                  const successCount = results.filter(r => r.success).length
                  
                  if (successCount > 0) {
                    toast({
                      title: 'Sync triggered',
                      description: `Syncing ${successCount} customers. Refresh in 10 seconds.`,
                      status: 'success',
                      duration: 5000,
                    })
                    setTimeout(() => refreshLeads(true), 10000)
                  }
                } catch (err: any) {
                  toast({
                    title: 'Sync failed',
                    description: err?.message || 'Could not trigger sync',
                    status: 'error',
                    duration: 5000,
                  })
                } finally {
                  setIsSyncing(false)
                }
              }}
              isLoading={isSyncing}
              colorScheme="green"
              size="sm"
              title="Sync from Google Sheets"
            />
            <IconButton
              aria-label="Refresh dashboard data"
              icon={<RepeatIcon />}
            onClick={async () => {
              // Refresh both customers and leads
              const syncFromCustomers = async () => {
                const { data, error } = await api.get<CustomerApi[]>('/api/customers')
                if (error || !data || data.length === 0) return
                const hydrated = data.map((customer) => buildAccountFromCustomer(customer))
                // NO localStorage persistence - API is the ONLY source of truth
                setAccountsData(hydrated)
                emit('accountsUpdated', hydrated)
              }

              // Use Promise.allSettled for consistency with auto-refresh
              const results = await Promise.allSettled([
                syncFromCustomers(),
                refreshLeads(true)
              ])

              // Check actual operation success before showing feedback
              const allSuccessful = results.every(result => result.status === 'fulfilled')
              const hasPartialSuccess = results.some(result => result.status === 'fulfilled')

              if (allSuccessful) {
                toast({
                  title: 'Dashboard refreshed',
                  description: 'Latest customer and lead data loaded',
                  status: 'success',
                  duration: 2000,
                  isClosable: true,
                })
              } else if (hasPartialSuccess) {
                toast({
                  title: 'Partial refresh completed',
                  description: 'Some data refreshed successfully',
                  status: 'warning',
                  duration: 3000,
                  isClosable: true,
                })
              } else {
                toast({
                  title: 'Refresh failed',
                  description: 'Could not refresh dashboard data',
                  status: 'error',
                  duration: 3000,
                  isClosable: true,
                })
              }

              toast({
                title: 'Dashboard refreshed',
                description: 'Latest customer and lead data loaded',
                status: 'success',
                duration: 2000,
                isClosable: true,
              })
            }}
              isLoading={loading}
              colorScheme="blue"
              size="sm"
              title="Refresh dashboard data"
            />
          </HStack>
        </HStack>

        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
          <Stat>
            <StatLabel fontSize="xs">Total Leads This Week</StatLabel>
            <StatNumber fontSize="2xl" color="orange.500">
              {weekTotal}
            </StatNumber>
            <StatHelpText fontSize="xs">Week {weekNumber} Target: {totalWeeklyTarget}</StatHelpText>
          </Stat>

          <Stat>
            <StatLabel fontSize="xs">Current Month</StatLabel>
            <StatNumber fontSize="lg">{currentMonth}</StatNumber>
            <StatHelpText fontSize="xs">Target: {totalMonthlyTarget}</StatHelpText>
          </Stat>

          <Stat>
            <StatLabel fontSize="xs">Month-to-Date</StatLabel>
            <StatNumber fontSize="2xl" color="orange.500">
              {monthTotal}
            </StatNumber>
            <StatHelpText fontSize="xs">
              {totalMonthlyTarget > 0 
                ? `${((monthTotal / totalMonthlyTarget) * 100).toFixed(1)}% of target`
                : 'No target set'}
            </StatHelpText>
          </Stat>
        </SimpleGrid>
      </Box>

      {/* Main Client Table */}
      <DataTable
        data={accountsWithPercentages}
        columns={dashboardColumns}
        tableId="dashboard-clients"
        enableSorting
        enableFiltering={false}
        enableColumnReorder
        enableColumnResize
        enableColumnVisibility
        enablePagination={false}
        enableExport
        compact
        loading={loading}
        emptyMessage="No client data available"
      />

      {/* Channel Breakdown & Progress */}
      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={3}>
        {/* Channel Breakdown */}
        <Box bg="white" p={3} borderRadius="md" shadow="sm" border="1px" borderColor="gray.200">
          <Heading size="sm" mb={2}>Channel</Heading>
          <VStack align="stretch" spacing={2}>
            {Object.entries(channelBreakdown)
              .sort((a, b) => b[1] - a[1])
              .map(([channel, count]) => (
                <HStack key={channel} justify="space-between">
                  <Text fontSize="sm">{channel}</Text>
                  <Badge colorScheme="blue" fontSize="sm" px={2}>
                    {count}
                  </Badge>
                </HStack>
              ))}
            {Object.keys(channelBreakdown).length === 0 && (
              <Text color="gray.400" fontSize="sm">No leads this week</Text>
            )}
          </VStack>

          <Box mt={3} p={3} bg="gray.50" borderRadius="md">
            <Text fontWeight="semibold" fontSize="sm" mb={1}>Month-to-Date</Text>
            <Text fontSize="2xl" fontWeight="bold" color="blue.600">{monthTotal}</Text>
            {Object.entries(channelBreakdown).map(([channel, count]) => {
              const percentage = monthTotal > 0 ? (count / monthTotal) * 100 : 0
              return (
                <HStack key={channel} justify="space-between" mt={2}>
                  <Text fontSize="sm">{channel}</Text>
                  <Text fontSize="sm" color="gray.600">{percentage.toFixed(0)}%</Text>
                </HStack>
              )
            })}
          </Box>
        </Box>

        {/* Week Progress - INCH BY INCH */}
        <Box bg="white" p={3} borderRadius="md" shadow="sm" border="1px" borderColor="gray.200">
          <Heading size="sm" mb={2} color="purple.700">INCH BY INCH</Heading>
          
          <Box mb={3}>
            <HStack justify="space-between" mb={1}>
              <Text fontWeight="semibold" fontSize="sm">This Week's Target</Text>
              <Badge 
                colorScheme={isWeekOnTrack ? 'green' : 'orange'} 
                fontSize="xs" 
                px={2}
              >
                {isWeekOnTrack ? '✓ On Track' : '○ Behind'}
              </Badge>
            </HStack>
            <Text fontSize="3xl" fontWeight="bold" color="blue.600">{totalWeeklyTarget}</Text>
            <Progress 
              value={weekProgress} 
              colorScheme={weekProgress >= 80 ? 'green' : weekProgress >= 50 ? 'yellow' : 'red'}
              size="md"
              borderRadius="md"
              mt={1}
              hasStripe
              isAnimated
            />
            <Text fontSize="xs" color="gray.600" mt={1}>{weekProgress.toFixed(0)}% Complete ({weekTotal}/{totalWeeklyTarget})</Text>
          </Box>

          <VStack align="stretch" spacing={2}>
            <HStack justify="space-between" p={2} bg="blue.50" borderRadius="md">
              <Text fontWeight="medium" fontSize="sm">Daily Target</Text>
              <Text fontSize="lg" fontWeight="bold">{dailyTarget}</Text>
            </HStack>
            
            <HStack justify="space-between" p={2} bg="green.50" borderRadius="md">
              <Text fontWeight="medium" fontSize="sm">Today's Leads</Text>
              <HStack>
                <Text fontSize="lg" fontWeight="bold">{todayTotal}</Text>
                {todayTotal >= dailyTarget ? (
                  <CheckCircleIcon color="green.500" boxSize={4} />
                ) : (
                  <WarningIcon color="orange.500" boxSize={4} />
                )}
              </HStack>
            </HStack>

            <HStack justify="space-between" p={2} bg="orange.50" borderRadius="md">
              <Text fontWeight="medium" fontSize="sm">Left to Go</Text>
              <Text fontSize="lg" fontWeight="bold" color="orange.600">
                {Math.max(0, totalWeeklyTarget - weekTotal)}
              </Text>
            </HStack>
          </VStack>
        </Box>
      </SimpleGrid>

      {/* Sales Leaderboard */}
      <Box bg="white" p={3} borderRadius="md" shadow="sm" border="1px" borderColor="gray.200">
        <HStack justify="space-between" mb={2}>
          <Heading size="sm" color="blue.700">Sales Leaderboard</Heading>
          <Badge colorScheme="blue" fontSize="xs" px={2}>Current Week</Badge>
        </HStack>
        
        <Table size="sm" variant="simple" sx={{ 'td, th': { py: 1, px: 2 } }}>
          <Thead bg="blue.50">
            <Tr>
              <Th fontSize="xs">Rank</Th>
              <Th fontSize="xs">Salesperson</Th>
              <Th isNumeric fontSize="xs">Leads</Th>
            </Tr>
          </Thead>
          <Tbody>
            {salesLeaderboard.map((entry, index) => (
              <Tr key={entry.name}>
                <Td>
                  <Badge
                    colorScheme={index === 0 ? 'yellow' : index === 1 ? 'gray' : index === 2 ? 'orange' : 'blue'}
                    fontSize="sm"
                    px={2}
                  >
                    {index + 1}
                  </Badge>
                </Td>
                <Td fontWeight="medium" fontSize="sm">{entry.name}</Td>
                <Td isNumeric fontSize="lg" fontWeight="bold" color="blue.600">{entry.leads}</Td>
              </Tr>
            ))}
            {salesLeaderboard.length === 0 && (
              <Tr>
                <Td colSpan={3} textAlign="center" color="gray.400" py={4} fontSize="sm">
                  No leads recorded this week
                </Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </Box>

      <Text fontSize="xs" color="gray.400" textAlign="center">
        Last synced: {lastRefresh.toLocaleString('en-GB')} | Data from Google Sheets via automated sync
      </Text>
    </VStack>
  )
}