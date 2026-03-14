import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Box,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Text,
  Stack,
  Badge,
  Link,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  useToast,
  HStack,
  IconButton,
  Select,
  SimpleGrid,
  Button,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Checkbox,
  Input,
  InputGroup,
  InputLeftElement,
  VStack,
  Flex,
  Tag,
  TagLabel,
  TagCloseButton,
  Divider,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Collapse,
} from '@chakra-ui/react'
import { ExternalLinkIcon, RepeatIcon, ViewIcon, SearchIcon, ChevronLeftIcon, ChevronRightIcon, DownloadIcon, ChevronUpIcon, ChevronDownIcon, SettingsIcon, StarIcon } from '@chakra-ui/icons'
import { type Account } from './AccountsTab'
import { syncSingleAccountLeadCount } from '../utils/accountsLeadsSync'
import { on } from '../platform/events'
import { OdcrmStorageKeys } from '../platform/keys'
import { getItem, getJson, setItem } from '../platform/storage'
import { getCurrentCustomerId } from '../platform/stores/settings'
import RequireActiveClient from './RequireActiveClient'
import { getSyncStatus, type SyncStatus } from '../utils/leadsApi'
import { fetchAllCustomers, type AggregateMetricsResult, type CustomerForAggregate } from '../utils/leadsAggregate'
import { useLiveLeadMetricsPolling, useLiveLeadsPolling } from '../hooks/useLiveLeadsPolling'
import { fetchLiveMetricsForCustomers, getLiveLeads, type LiveLeadRow } from '../utils/liveLeadsApi'

// Load accounts from storage (includes any edits made through the UI)
function loadAccountsFromStorage(): Account[] {
  const parsed = getJson<Account[]>(OdcrmStorageKeys.accounts)
  if (parsed && Array.isArray(parsed) && parsed.length > 0) return parsed
  return []
}

type Lead = {
  [key: string]: string // Dynamic fields from Google Sheet
  accountName: string
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

const normalizeLeadSource = (value: string | undefined): string | null => {
  if (!value) return null
  const cleaned = value.trim().toLowerCase()
  if (!cleaned) return null

  const exactMatch = LEAD_SOURCE_CATEGORIES.find(
    (source) => source.toLowerCase() === cleaned,
  )
  if (exactMatch) {
    return exactMatch
  }

  for (const category of LEAD_SOURCE_CATEGORIES) {
    const keywords = LEAD_SOURCE_KEYWORDS[category] || []
    if (keywords.some((keyword) => cleaned.includes(keyword))) {
      return category
    }
  }

  return null
}

/** Map live API rows to Lead shape for table. */
function mapLiveLeadsToLead(rows: LiveLeadRow[], accountName: string): Lead[] {
  return rows.map((row, i) => ({
    ...row.raw,
    id: `live-${i}`,
    accountName,
    source: row.source ?? undefined,
    owner: row.owner ?? undefined,
    Date: row.occurredAt ? new Date(row.occurredAt).toLocaleDateString() : (row.raw['Date'] ?? row.raw['date'] ?? ''),
  }))
}

type LeadWithDate = {
  data: Lead
  parsedDate: Date
}

type FilterState = {
  search: string
  accounts: string[]
  channels: string[]
  teamMembers: string[]
  leadStatuses: string[]
  outcomes: string[]
  dateRange: {
    field: 'Date' | 'First Meeting Date' | 'Closed Date' | ''
    start: string
    end: string
  }
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

type SavedFilter = {
  id: string
  name: string
  filters: FilterState
}

const ITEMS_PER_PAGE = 50
const LEAD_STATUS_OPTIONS = ['New', 'Qualified', 'Nurturing', 'Closed Won', 'Closed Lost', 'Converted']
const DEFAULT_FILTERS: FilterState = {
  search: '',
  accounts: [],
  channels: [],
  teamMembers: [],
  leadStatuses: [],
  outcomes: [],
  dateRange: { field: '', start: '', end: '' },
  sortBy: 'Date',
  sortOrder: 'desc',
}

function MarketingLeadsTab({ focusAccountName, enabled = true }: { focusAccountName?: string; enabled?: boolean }) {
  const customerId = getCurrentCustomerId()

  const [performanceAccountFilter, setPerformanceAccountFilter] = useState<string>('')
  const [aggregateMetrics, setAggregateMetrics] = useState<AggregateMetricsResult | null>(null)
  const [aggregateLoading, setAggregateLoading] = useState(false)
  const [aggregateCustomersList, setAggregateCustomersList] = useState<CustomerForAggregate[] | null>(null)
  const [showUnconfiguredList, setShowUnconfiguredList] = useState(false)
  const [syncStatusForEmpty, setSyncStatusForEmpty] = useState<SyncStatus | null>(null)

  // Advanced filtering state
  const [filters, setFilters] = useState<FilterState>(() => {
    // Load from URL params if available
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const saved = params.get('filters')
      if (saved) {
        try {
          return JSON.parse(decodeURIComponent(saved))
        } catch {
          return DEFAULT_FILTERS
        }
      }
    }
    return DEFAULT_FILTERS
  })
  
  const [currentPage, setCurrentPage] = useState(1)
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(() => {
    const stored = getItem('odcrm_saved_lead_filters')
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {
        return []
      }
    }
    return []
  })
  const saveFilterModal = useDisclosure()
  const [newFilterName, setNewFilterName] = useState('')
  
  // Default visible columns for Detailed Leads List
  const defaultVisibleColumns = ['Account', 'Date', 'Company', 'OD Team Member', 'Channel of Lead']
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(defaultVisibleColumns))
  
  // Update URL when filters change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS)) {
        params.set('filters', encodeURIComponent(JSON.stringify(filters)))
      } else {
        params.delete('filters')
      }
      const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`
      window.history.replaceState({}, '', newUrl)
    }
  }, [filters])
  
  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filters])

  const [accountPage, setAccountPage] = useState(1)
  useEffect(() => {
    setAccountPage(1)
  }, [performanceAccountFilter])

  const {
    data: liveData,
    loading,
    error,
    lastUpdatedAt,
    refetch,
  } = useLiveLeadsPolling(customerId || null, {
    enabled,
    page: currentPage,
    pageSize: ITEMS_PER_PAGE,
    search: filters.search,
    accounts: filters.accounts,
    channels: filters.channels,
    teamMembers: filters.teamMembers,
    leadStatuses: filters.leadStatuses,
    outcomes: filters.outcomes,
    dateField: filters.dateRange.field || undefined,
    dateStart: filters.dateRange.start || undefined,
    dateEnd: filters.dateRange.end || undefined,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  })
  const leads = useMemo(
    () => (liveData ? mapLiveLeadsToLead(liveData.leads, liveData.customerName ?? '') : []),
    [liveData]
  )
  const customerName = liveData?.customerName
    || aggregateCustomersList?.find((customer) => customer.id === customerId)?.name
    || ''
  const {
    data: metricsData,
  } = useLiveLeadMetricsPolling(enabled ? (customerId || null) : null)
  const {
    data: accountDetailData,
    loading: accountDetailLoading,
  } = useLiveLeadsPolling(customerId || null, {
    enabled: enabled && Boolean(performanceAccountFilter) && (!customerName || performanceAccountFilter === customerName),
    page: accountPage,
    pageSize: ITEMS_PER_PAGE,
    sortBy: 'Date',
    sortOrder: 'desc',
  })
  const accountDetailLeads = useMemo(
    () => (accountDetailData ? mapLiveLeadsToLead(accountDetailData.leads, accountDetailData.customerName ?? '') : []),
    [accountDetailData]
  )
  const lastRefresh = lastUpdatedAt ?? new Date()
  const liveWarning = liveData?.warning ?? null
  const sourceOfTruth = liveData?.sourceOfTruth ?? null
  const filteredLeadCount = liveData?.total ?? 0
  const totalLeadCount = liveData?.rowCount ?? 0
  const totalPages = liveData?.totalPages ?? 1
  const serverPage = liveData?.page ?? currentPage
  const accountDetailTotal = accountDetailData?.total ?? 0
  const accountDetailTotalPages = accountDetailData?.totalPages ?? 1
  const accountDetailServerPage = accountDetailData?.page ?? accountPage
  
  const toast = useToast()
  

  // Allow parent navigators (top-tab shell) to focus an account's performance view.
  useEffect(() => {
    if (!focusAccountName) return
    setPerformanceAccountFilter(focusAccountName)
  }, [focusAccountName])

  // Helper to format last refresh time
  const formatLastRefresh = (date: Date) => {
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
    if (diff < 60) return `${diff} seconds ago`
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`
    return date.toLocaleDateString()
  }

  useEffect(() => {
    const handleAccountsUpdated = () => refetch()
    const off = on('accountsUpdated', handleAccountsUpdated)
    return () => off()
  }, [refetch])

  useEffect(() => {
    if (customerName && totalLeadCount > 0) {
      syncSingleAccountLeadCount(customerName, totalLeadCount)
    }
  }, [customerName, totalLeadCount])

  // Aggregate metrics for "All Accounts Combined" — live metrics, 30s polling
  const loadAggregate = useCallback(async () => {
    setAggregateLoading(true)
    try {
      const customers = await fetchAllCustomers()
      setAggregateCustomersList(customers)
      const result = await fetchLiveMetricsForCustomers(customers)
      setAggregateMetrics(result)
    } catch (e) {
      console.warn('Aggregate metrics fetch failed:', e)
    } finally {
      setAggregateLoading(false)
    }
  }, [])
  useEffect(() => {
    loadAggregate()
    const poll = setInterval(loadAggregate, 30 * 1000)
    const onVisible = () => { if (document.visibilityState === 'visible') loadAggregate() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(poll); document.removeEventListener('visibilitychange', onVisible) }
  }, [loadAggregate])

  // When leads are empty, fetch sync status so we can show lastError / lastSyncAt
  useEffect(() => {
    if (totalLeadCount > 0 || sourceOfTruth === 'db') { setSyncStatusForEmpty(null); return }
    const customerId = getCurrentCustomerId()
    if (!customerId) return
    getSyncStatus(customerId).then(({ data }) => { if (data) setSyncStatusForEmpty(data) })
  }, [totalLeadCount, sourceOfTruth])

  const allColumns = new Set<string>(liveData?.allDisplayColumns ?? [])

  // Define preferred column order based on the Google Sheet structure
  const preferredColumnOrder = [
    'Week',
    'Date',
    'Company',
    'Name',
    'Job Title',
    'Industry',
    'Contact Info',
    'OD Team Member',
    'OD Call Recording Available',
    'Link for Call Recording',
    'Channel of Lead',
    'Client Notes',
    'Outcome',
    'First Meeting Date',
    'Lead Status',
    'Closed Date',
  ]

  // Build columns array: preferred order first, then any remaining columns
  const orderedColumns: string[] = []
  const remainingColumns: string[] = []

  preferredColumnOrder.forEach((col) => {
    if (allColumns.has(col)) {
      orderedColumns.push(col)
    }
  })

  allColumns.forEach((col) => {
    if (!preferredColumnOrder.includes(col)) {
      remainingColumns.push(col)
    }
  })

  const columns = [...orderedColumns, ...remainingColumns.sort()]

  // Helper to parse dates in various formats (European formats prioritized)
  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr || dateStr.trim() === '') return null
    
    const trimmed = dateStr.trim()
    
    // Try DD.MM.YY or DD.MM.YYYY format (European format - most common)
    const ddmmyy = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/)
    if (ddmmyy) {
      const day = parseInt(ddmmyy[1], 10)
      const month = parseInt(ddmmyy[2], 10) - 1
      let year = parseInt(ddmmyy[3], 10)
      if (year < 100) year += 2000
      const date = new Date(year, month, day)
      if (!isNaN(date.getTime())) return date
    }
    
    // Try DD/MM/YY or DD/MM/YYYY format (European slash format)
    const ddmmyySlash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
    if (ddmmyySlash) {
      const day = parseInt(ddmmyySlash[1], 10)
      const month = parseInt(ddmmyySlash[2], 10) - 1
      let year = parseInt(ddmmyySlash[3], 10)
      if (year < 100) year += 2000
      const date = new Date(year, month, day)
      if (!isNaN(date.getTime())) return date
    }
    
    // Try DD-MM-YY or DD-MM-YYYY format (European dash format)
    const ddmmyyDash = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{2}|\d{4})$/)
    if (ddmmyyDash) {
      const day = parseInt(ddmmyyDash[1], 10)
      const month = parseInt(ddmmyyDash[2], 10) - 1
      let year = parseInt(ddmmyyDash[3], 10)
      if (year < 100) year += 2000
      const date = new Date(year, month, day)
      if (!isNaN(date.getTime())) return date
    }
    
    // Try YYYY-MM-DD format (ISO format)
    const yyyymmdd = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
    if (yyyymmdd) {
      const year = parseInt(yyyymmdd[1], 10)
      const month = parseInt(yyyymmdd[2], 10) - 1
      const day = parseInt(yyyymmdd[3], 10)
      const date = new Date(year, month, day)
      if (!isNaN(date.getTime())) return date
    }
    
    // Try MM/DD/YYYY format (US format - less common but handle it)
    const mmddyyyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (mmddyyyy) {
      const month = parseInt(mmddyyyy[1], 10) - 1
      const day = parseInt(mmddyyyy[2], 10)
      const year = parseInt(mmddyyyy[3], 10)
      const date = new Date(year, month, day)
      if (!isNaN(date.getTime())) return date
    }
    
    // Try native Date parsing as fallback
    const parsed = new Date(trimmed)
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getFullYear()
      if (year >= 2000 && year <= 2100) {
        return parsed
      }
    }
    
    return null
  }

  // Helper to check if a value is a URL
  const isUrl = (str: string): boolean => {
    if (!str || str === 'Yes' || str === 'No' || str.trim() === '') return false
    try {
      new URL(str)
      return true
    } catch {
      return false
    }
  }

  // Helper to format cell content
  const formatCell = (value: string, header: string): ReactNode => {
    if (!value || value.trim() === '') return <Text color="gray.400">-</Text>

    // Special handling for certain fields
    if (header.toLowerCase().includes('link') || header.toLowerCase().includes('recording')) {
      if (isUrl(value)) {
        return (
          <Link href={value} isExternal color="text.muted" display="inline-flex" alignItems="center" gap={1}>
            View <ExternalLinkIcon />
          </Link>
        )
      }
    }

    // Handle Yes/No fields
    if (value === 'Yes' || value === 'No') {
      return (
        <Badge colorScheme={value === 'Yes' ? 'green' : 'gray'}>
          {value}
        </Badge>
      )
    }

    // Truncate very long text
    if (value.length > 150) {
      return (
        <Text title={value} noOfLines={3} fontSize="sm">
          {value.substring(0, 150)}...
        </Text>
      )
    }

    return <Text fontSize="sm">{value}</Text>
  }


  // Unified analytics across all accounts
  const unifiedAnalytics = useMemo(() => {
    try {
      const accountsData = loadAccountsFromStorage()
      
      // Calculate total targets across all accounts
      const totalWeeklyTarget = accountsData.reduce((sum, acc) => sum + (acc.weeklyTarget || 0), 0)
      const totalMonthlyTarget = accountsData.reduce((sum, acc) => sum + (acc.monthlyTarget || 0), 0)
      
      // Use Europe/London timezone for consistent date calculations
      const now = new Date()
      const londonTime = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now)
      const [day, month, year] = londonTime.split('/').map(Number)
      const londonNow = new Date(year, month - 1, day)
      
      const startOfToday = new Date(londonNow.getFullYear(), londonNow.getMonth(), londonNow.getDate())
      const endOfToday = new Date(startOfToday)
      endOfToday.setDate(endOfToday.getDate() + 1)

      // Current week: Monday -> next Monday (exclusive)
      const currentWeekStart = new Date(startOfToday)
      const dayOfWeek = currentWeekStart.getDay()
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      currentWeekStart.setDate(currentWeekStart.getDate() + diff)
      currentWeekStart.setHours(0, 0, 0, 0)
      const currentWeekEnd = new Date(currentWeekStart)
      currentWeekEnd.setDate(currentWeekEnd.getDate() + 7)

      const monthStart = new Date(londonNow.getFullYear(), londonNow.getMonth(), 1)
      monthStart.setHours(0, 0, 0, 0)
      const monthEnd = new Date(londonNow.getFullYear(), londonNow.getMonth() + 1, 1) // exclusive (start of next month)
      const daysInMonth = new Date(londonNow.getFullYear(), londonNow.getMonth() + 1, 0).getDate()

      // Calculate daily target from weekly/monthly (with division by zero protection)
      const dailyTargetFromWeekly = totalWeeklyTarget > 0 ? totalWeeklyTarget / 7 : 0
      const dailyTargetFromMonthly = totalMonthlyTarget > 0 && daysInMonth > 0 ? totalMonthlyTarget / daysInMonth : 0
      const dailyTarget = dailyTargetFromWeekly > 0 ? dailyTargetFromWeekly : dailyTargetFromMonthly

      // Process all leads (not filtered by account)
      // Enhanced date field detection - check all fields for date patterns first
      const leadsWithDates: LeadWithDate[] = leads
        .map((lead) => {
          let dateValue = ''
          let dateFieldName = ''
          
          // FIRST: Check ALL fields for DD.MM.YY format (like "05.01.26") - this is the key!
          for (const key of Object.keys(lead)) {
            const value = lead[key] || ''
            if (value && value.trim() && /^\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(value.trim())) {
              dateValue = value.trim()
              dateFieldName = key
              break
            }
          }
          
          // SECOND: If no DD.MM.YY format found, check for date fields in preferred order
          if (!dateValue || !dateValue.trim()) {
            dateValue =
              lead['Date'] ||
              lead['date'] ||
              lead['Week'] ||
              lead['week'] ||
              lead['First Meeting Date'] ||
              ''
            
            if (dateValue) {
              dateFieldName = lead['Date'] ? 'Date' : lead['date'] ? 'date' : lead['Week'] ? 'Week' : lead['week'] ? 'week' : lead['First Meeting Date'] ? 'First Meeting Date' : 'unknown'
            }
          }
          
          const parsedDate = parseDate(dateValue)
          if (!parsedDate) {
            return null
          }
          return {
            data: lead,
            parsedDate,
          }
        })
        .filter((item): item is LeadWithDate => Boolean(item))

      const computeMetrics = (start: Date, end: Date) => {
        const breakdown: Record<string, number> = {}
        const teamBreakdown: Record<string, number> = {}
        let actual = 0

        leadsWithDates.forEach((entry) => {
          try {
            if (entry.parsedDate >= start && entry.parsedDate < end) {
              actual += 1
              const channel = entry.data['Channel of Lead'] || entry.data['channel of lead'] || ''
              const normalizedSource = normalizeLeadSource(channel)
              if (normalizedSource) {
                breakdown[normalizedSource] = (breakdown[normalizedSource] || 0) + 1
              } else if (channel && channel.trim()) {
                // Also track non-normalized channels
                breakdown[channel] = (breakdown[channel] || 0) + 1
              }

              // OD Team Member breakdown - enhanced parsing with multiple separators
              const rawTeamMember =
                entry.data['OD Team Member'] ||
                entry.data['OD team member'] ||
                entry.data['od team member'] ||
                entry.data['OD Team'] ||
                entry.data['od team'] ||
                ''

              if (rawTeamMember && rawTeamMember.trim()) {
                // Split by comma, &, /, +, and "and" (case insensitive)
                const members = rawTeamMember
                  .split(/,|&|\/|\+|\band\b/gi)
                  .map((m) => m.trim())
                  .filter(Boolean)

                members.forEach((member) => {
                  if (member) {
                    teamBreakdown[member] = (teamBreakdown[member] || 0) + 1
                  }
                })
              }
            }
          } catch (error) {
            console.warn('Error processing lead entry:', error)
            // Continue processing other leads
          }
        })

        return { actual, breakdown, teamBreakdown }
      }

      const periodMetrics = {
        today: {
          label: 'Today',
          ...computeMetrics(startOfToday, endOfToday),
          target: Math.max(Math.round(dailyTarget || 0), 0),
        },
        week: {
          label: 'This Week',
          ...computeMetrics(currentWeekStart, currentWeekEnd),
          target: Math.max(Math.round(totalWeeklyTarget || 0), 0),
        },
        month: {
          label: 'This Month',
          ...computeMetrics(monthStart, monthEnd),
          target: Math.max(Math.round(totalMonthlyTarget || 0), 0),
        },
      }

      return { periodMetrics }
    } catch (error) {
      console.error('Error calculating unified analytics:', error)
      // Return safe defaults on error
      return {
        periodMetrics: {
          today: { label: 'Today', actual: 0, breakdown: {}, teamBreakdown: {}, target: 0 },
          week: { label: 'This Week', actual: 0, breakdown: {}, teamBreakdown: {}, target: 0 },
          month: { label: 'This Month', actual: 0, breakdown: {}, teamBreakdown: {}, target: 0 },
        },
      }
    }
  }, [leads])

  // For "All Accounts Combined" card: use API aggregate counts and keep target values from local account settings.
  const displayUnifiedPeriodMetrics = useMemo(() => {
    const base = unifiedAnalytics.periodMetrics
    if (!aggregateMetrics) {
      return {
        today: { ...base.today, actual: 0, breakdown: {}, teamBreakdown: {} },
        week: { ...base.week, actual: 0, breakdown: {}, teamBreakdown: {} },
        month: { ...base.month, actual: 0, breakdown: {}, teamBreakdown: {} },
      }
    }
    return {
      today: { ...base.today, actual: aggregateMetrics.totals.today, breakdown: aggregateMetrics.breakdownBySource, teamBreakdown: aggregateMetrics.breakdownByOwner },
      week: { ...base.week, actual: aggregateMetrics.totals.week, breakdown: aggregateMetrics.breakdownBySource, teamBreakdown: aggregateMetrics.breakdownByOwner },
      month: { ...base.month, actual: aggregateMetrics.totals.month, breakdown: aggregateMetrics.breakdownBySource, teamBreakdown: aggregateMetrics.breakdownByOwner },
    }
  }, [unifiedAnalytics, aggregateMetrics])

  // Account-specific performance analytics
  const accountPerformance = useMemo(() => {
    try {
      if (!performanceAccountFilter) return null
      if (customerName && performanceAccountFilter !== customerName) return null

      const accountsData = loadAccountsFromStorage()
      const account = accountsData.find((acc) => acc.name === performanceAccountFilter)
      if (!account) return null

      // Calculate daily target with division by zero protection
      const now = new Date()
      const londonTime = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now)
      const [day, month, year] = londonTime.split('/').map(Number)
      const londonNow = new Date(year, month - 1, day)
      const daysInMonth = new Date(londonNow.getFullYear(), londonNow.getMonth() + 1, 0).getDate()
      const dailyTargetFromWeekly = account.weeklyTarget && account.weeklyTarget > 0 ? account.weeklyTarget / 7 : 0
      const dailyTargetFromMonthly = account.monthlyTarget && account.monthlyTarget > 0 && daysInMonth > 0 ? account.monthlyTarget / daysInMonth : 0
      const dailyTarget = dailyTargetFromWeekly > 0 ? dailyTargetFromWeekly : dailyTargetFromMonthly
      const breakdownBySource = metricsData?.breakdownBySource ?? {}
      const breakdownByOwner = metricsData?.breakdownByOwner ?? {}

      const periodMetrics = {
        today: {
          label: 'Today',
          actual: metricsData?.counts?.today ?? metricsData?.todayLeads ?? 0,
          breakdown: breakdownBySource,
          teamBreakdown: breakdownByOwner,
          target: Math.max(Math.round(dailyTarget || 0), 0),
        },
        week: {
          label: 'This Week',
          actual: metricsData?.counts?.week ?? metricsData?.weekLeads ?? 0,
          breakdown: breakdownBySource,
          teamBreakdown: breakdownByOwner,
          target: Math.max(Math.round(account.weeklyTarget || 0), 0),
        },
        month: {
          label: 'This Month',
          actual: metricsData?.counts?.month ?? metricsData?.monthLeads ?? 0,
          breakdown: breakdownBySource,
          teamBreakdown: breakdownByOwner,
          target: Math.max(Math.round(account.monthlyTarget || 0), 0),
        },
      }

      return {
        accountName: account.name,
        periodMetrics,
      }
    } catch (error) {
      console.error('Error calculating account performance analytics:', error)
      return null
    }
  }, [customerName, metricsData, performanceAccountFilter])

  // Get all leads for the selected account (for detailed table)
  const accountPerformanceLeads = useMemo(() => {
    if (!performanceAccountFilter) return []
    return accountDetailLeads
  }, [accountDetailLeads, performanceAccountFilter])

  // Server-provided filter metadata
  const uniqueAccounts = useMemo(() => {
    if (liveData?.availableAccounts?.length) return liveData.availableAccounts
    return customerName ? [customerName] : []
  }, [customerName, liveData?.availableAccounts])

  const uniqueChannels = liveData?.availableChannels ?? []
  const uniqueTeamMembers = liveData?.availableTeamMembers ?? []
  const uniqueOutcomes = liveData?.availableOutcomes ?? []
  const availableLeadStatuses = liveData?.availableLeadStatuses ?? LEAD_STATUS_OPTIONS
  const filteredAndSortedLeads = leads
  
  // Helper to highlight search terms
  const highlightSearch = (text: string): ReactNode => {
    if (!filters.search.trim() || !text) return <Text fontSize="sm">{text}</Text>
    
    const parts = text.split(new RegExp(`(${filters.search})`, 'gi'))
    return (
      <Text fontSize="sm">
        {parts.map((part, i) => 
          part.toLowerCase() === filters.search.toLowerCase() ? (
            <Text as="span" key={i} bg="yellow.200" fontWeight="bold">{part}</Text>
          ) : (
            <Text as="span" key={i}>{part}</Text>
          )
        )}
      </Text>
    )
  }
  
  // Export filtered results to CSV
  const exportFilteredToCSV = useCallback(async () => {
    if (!customerId) {
      toast({
        title: 'No client selected',
        description: 'Select a client before exporting leads.',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    if (filteredLeadCount === 0) {
      toast({
        title: 'No data to export',
        description: 'There are no filtered leads to export.',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      })
      return
    }
    
    try {
      const exportData = await getLiveLeads(customerId, {
        search: filters.search,
        accounts: filters.accounts,
        channels: filters.channels,
        teamMembers: filters.teamMembers,
        leadStatuses: filters.leadStatuses,
        outcomes: filters.outcomes,
        dateField: filters.dateRange.field || undefined,
        dateStart: filters.dateRange.start || undefined,
        dateEnd: filters.dateRange.end || undefined,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      })
      const exportLeads = mapLiveLeadsToLead(exportData.leads, exportData.customerName ?? customerName)

      if (exportLeads.length === 0) {
        toast({
          title: 'No data to export',
          description: 'There are no filtered leads to export.',
          status: 'warning',
          duration: 3000,
          isClosable: true,
        })
        return
      }

      // Get all unique column headers
      const allHeaders = new Set<string>()
      exportLeads.forEach(lead => {
        Object.keys(lead).forEach(key => {
          if (key !== 'accountName' || allHeaders.size === 0) {
            allHeaders.add(key)
          }
        })
      })
      
      const headers = Array.from(allHeaders)
      const csvRows = [
        headers.join(','),
        ...exportLeads.map(lead =>
          headers.map(header => {
            const value = lead[header] || ''
            return `"${String(value).replace(/"/g, '""')}"`
          }).join(',')
        ),
      ]
      
      const csvContent = csvRows.join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `leads-filtered-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      toast({
        title: 'Export successful',
        description: `Exported ${exportLeads.length} lead(s) to CSV.`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
    } catch (error) {
      console.error('Export error:', error)
      toast({
        title: 'Export failed',
        description: 'Failed to export leads. Please try again.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    }
  }, [customerId, customerName, filteredLeadCount, filters, toast])
  
  // Save current filter as preset
  const saveCurrentFilter = useCallback(() => {
    if (!newFilterName.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a name for this filter preset.',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      })
      return
    }
    
    const newFilter: SavedFilter = {
      id: Date.now().toString(),
      name: newFilterName.trim(),
      filters: { ...filters },
    }
    
    const updated = [...savedFilters, newFilter]
    setSavedFilters(updated)
    setItem('odcrm_saved_lead_filters', JSON.stringify(updated))
    setNewFilterName('')
    saveFilterModal.onClose()
    
    toast({
      title: 'Filter saved',
      description: `"${newFilterName}" has been saved as a filter preset.`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    })
  }, [newFilterName, filters, savedFilters, saveFilterModal, toast])
  
  // Load saved filter
  const loadSavedFilter = useCallback((savedFilter: SavedFilter) => {
    setFilters(savedFilter.filters)
    toast({
      title: 'Filter loaded',
      description: `Loaded filter preset "${savedFilter.name}".`,
      status: 'success',
      duration: 2000,
      isClosable: true,
    })
  }, [toast])
  
  // Delete saved filter
  const deleteSavedFilter = useCallback((id: string) => {
    const updated = savedFilters.filter(f => f.id !== id)
    setSavedFilters(updated)
    setItem('odcrm_saved_lead_filters', JSON.stringify(updated))
    toast({
      title: 'Filter deleted',
      status: 'success',
      duration: 2000,
      isClosable: true,
    })
  }, [savedFilters, toast])
  
  // Helper to update filter
  const updateFilter = useCallback((updates: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...updates }))
  }, [])
  
  // Helper to toggle array filter value
  const toggleFilterValue = useCallback((
    filterKey: 'accounts' | 'channels' | 'teamMembers' | 'leadStatuses' | 'outcomes',
    value: string
  ) => {
    setFilters(prev => {
      const current = prev[filterKey]
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value]
      return { ...prev, [filterKey]: updated }
    })
  }, [])
  
  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
    toast({
      title: 'Filters cleared',
      status: 'info',
      duration: 2000,
      isClosable: true,
    })
  }, [toast])

  return (
    <RequireActiveClient>
      {loading && totalLeadCount === 0 ? (
        <Box textAlign="center" py={12}>
          <Spinner size="xl" color="brand.700" thickness="4px" />
          <Text mt={4} color="gray.600">
            Loading leads data from the server...
          </Text>
        </Box>
      ) : error && totalLeadCount === 0 ? (
        <Alert status="error" borderRadius="lg" data-testid="marketing-leads-actionable-error">
          <AlertIcon />
          <Box>
            <AlertTitle>Error loading leads</AlertTitle>
            <AlertDescription>
              <Text>{error}</Text>
              <Text mt={2} fontSize="sm">
                {sourceOfTruth === 'db'
                  ? 'This client is DB-backed for leads in Marketing. Confirm lead records are available in ODCRM.'
                  : 'This client is Google Sheets-backed for leads in Marketing. Confirm the linked sheet URL and access, then refresh.'}
              </Text>
            </AlertDescription>
          </Box>
        </Alert>
      ) : (
    <Stack spacing={{ base: 4, md: 6, lg: 8 }} px={{ base: 0, md: 0 }} pb={8}>
      {liveWarning && (
        <Alert status="warning" borderRadius="lg" data-testid="marketing-leads-stale-sheet-warning">
          <AlertIcon />
          <Box>
            <AlertTitle>Using cached Google Sheets data</AlertTitle>
            <AlertDescription>{liveWarning}</AlertDescription>
          </Box>
        </Alert>
      )}
      {totalLeadCount === 0 && syncStatusForEmpty && (
        <Alert
          status={syncStatusForEmpty.syncState?.severity === 'error' ? 'error' : syncStatusForEmpty.syncState?.severity === 'warning' ? 'warning' : 'info'}
          borderRadius="lg"
        >
          <AlertIcon />
          <Box>
            <AlertTitle>
              {syncStatusForEmpty.syncState?.code === 'connected_empty'
                ? 'Connected sheet is empty'
                : syncStatusForEmpty.syncState?.code === 'never_synced'
                  ? 'Lead sync not finished yet'
                  : syncStatusForEmpty.syncState?.code === 'misconfigured'
                    ? 'Lead sheet configuration issue'
                    : syncStatusForEmpty.syncState?.code === 'sync_failed'
                      ? 'Lead sync failed'
                      : syncStatusForEmpty.syncState?.code === 'stale_last_good'
                        ? 'Showing last successful snapshot'
                        : (syncStatusForEmpty.lastError ? 'Why 0 leads?' : 'Connected sheet is empty')}
            </AlertTitle>
            <AlertDescription>
              {syncStatusForEmpty.syncState?.message && <Text>{syncStatusForEmpty.syncState.message}</Text>}
              Last sync: {syncStatusForEmpty.lastSyncAt ? new Date(syncStatusForEmpty.lastSyncAt).toLocaleString() : 'Never'}
              {syncStatusForEmpty.lastSuccessAt && ` · Last success: ${new Date(syncStatusForEmpty.lastSuccessAt).toLocaleString()}`}
              {(syncStatusForEmpty.syncState?.detail || syncStatusForEmpty.lastError) && (
                <Text mt={2} fontWeight="semibold" color={syncStatusForEmpty.syncState?.severity === 'error' ? 'red.600' : 'orange.600'}>
                  {syncStatusForEmpty.syncState?.detail || syncStatusForEmpty.lastError}
                </Text>
              )}
              {!syncStatusForEmpty.syncState?.message && !syncStatusForEmpty.lastError && (
                <Text mt={2}>The linked Google Sheet is connected and currently empty.</Text>
              )}
              {(syncStatusForEmpty.isPaused || syncStatusForEmpty.isRunning) && (
                <Text mt={1} fontSize="sm">Status: {syncStatusForEmpty.isPaused ? 'Paused' : ''} {syncStatusForEmpty.isRunning ? 'Sync in progress' : ''}</Text>
              )}
            </AlertDescription>
          </Box>
        </Alert>
      )}
      {/* Header Section */}
      <Box
        bg="white"
        borderRadius="xl"
        p={{ base: 4, md: 6 }}
        boxShadow="md"
        border="1px solid"
        borderColor="gray.200"
      >
        <HStack justify="space-between" align="flex-start" flexWrap="wrap" gap={4}>
          <Box flex="1" minW={{ base: "full", sm: "200px" }}>
            <Heading 
              size={{ base: "md", md: "lg" }} 
              mb={2} 
              color="gray.800"
              fontWeight="bold"
            >
              Marketing Leads
            </Heading>
            <Text color="gray.600" fontSize={{ base: "sm", md: "md" }}>
              {sourceOfTruth === 'db' ? 'Live ODCRM lead records' : 'Live sheet-backed leads via ODCRM'} ({totalLeadCount} total
              {filteredLeadCount !== totalLeadCount && `, ${filteredLeadCount} filtered`})
            </Text>
            <Text fontSize="xs" color="gray.500" mt={1}>
              Source of truth: {sourceOfTruth === 'db' ? 'ODCRM database (non-sheet-backed client)' : 'Google Sheets (sheet-backed client)'}
            </Text>
            <Text fontSize="xs" color="gray.500" mt={1} data-testid="marketing-leads-next-step-guidance">
              {sourceOfTruth === 'db'
                ? 'Next step: use Marketing workflows to operate on DB-backed lead records.'
                : 'Next step: maintain sheet setup in Clients/Lead Sources, then run outreach from Marketing.'}
            </Text>
            <Text fontSize="xs" color="gray.500" mt={2}>
              Last refreshed: {formatLastRefresh(lastRefresh)} • Polls every 30s
            </Text>
          </Box>
          <IconButton
            aria-label="Refresh leads data"
            icon={<RepeatIcon />}
            onClick={() => refetch()}
            isLoading={loading}
            colorScheme="blue"
            size="md"
            borderRadius="lg"
            boxShadow="sm"
            _hover={{ transform: 'scale(1.05)', boxShadow: 'md' }}
            transition="all 0.2s"
          />
        </HStack>
      </Box>

      {/* Unified Analytics Kanban Card */}
      <Box
        bg="white"
        borderRadius="xl"
        p={{ base: 4, md: 6 }}
        border="1px solid"
        borderColor="gray.200"
        boxShadow="md"
      >
        <Stack direction={{ base: "column", md: "row" }} justify="space-between" mb={6} spacing={4}>
          <Box>
            <Text 
              fontSize="xs" 
              textTransform="uppercase" 
              color="blue.500" 
              fontWeight="bold"
              letterSpacing="wide"
            >
              Unified Lead Performance
            </Text>
            <Heading size={{ base: "sm", md: "md" }} color="gray.800" mt={1}>
              All Accounts Combined
            </Heading>
            <Text fontSize="xs" color="gray.500" mt={1}>Totals from all accounts with sheets. Select an account to view individual lead rows.</Text>
          </Box>
          <Text fontSize="sm" color="gray.500" fontWeight="medium">
            {new Date().toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </Text>
        </Stack>
        {aggregateCustomersList && (() => {
          const configured = aggregateCustomersList.filter((c) => c.leadsReportingUrl != null && String(c.leadsReportingUrl).trim() !== '')
          const unconfigured = aggregateCustomersList.filter((c) => !c.leadsReportingUrl || String(c.leadsReportingUrl).trim() === '')
          return (
            <Box mb={4} fontSize="sm">
              <HStack spacing={4} flexWrap="wrap">
                <Text color="gray.600">
                  <strong>{configured.length}</strong> customer{configured.length !== 1 ? 's' : ''} configured for leads
                </Text>
                {unconfigured.length > 0 && (
                  <Box>
                    <Button
                      size="xs"
                      variant="ghost"
                      colorScheme="gray"
                      rightIcon={showUnconfiguredList ? <ChevronUpIcon /> : <ChevronDownIcon />}
                      onClick={() => setShowUnconfiguredList((v) => !v)}
                    >
                      <strong>{unconfigured.length}</strong> NOT configured
                    </Button>
                    <Collapse in={showUnconfiguredList}>
                      <Stack as="ul" pl={4} mt={1} spacing={0.5} listStyleType="disc">
                        {unconfigured.map((c) => (
                          <Text key={c.id} as="li" fontSize="xs" color="gray.600">{c.name}</Text>
                        ))}
                      </Stack>
                    </Collapse>
                  </Box>
                )}
              </HStack>
              {configured.length === 0 && (
                <Alert status="info" mt={2} borderRadius="md">
                  <AlertIcon />
                  <Box>
                    <AlertTitle>No clients have a Leads reporting URL configured</AlertTitle>
                    <AlertDescription>Add a Google Sheet URL in Settings → Accounts to see combined metrics here.</AlertDescription>
                  </Box>
                </Alert>
              )}
            </Box>
          )
        })()}
        {aggregateLoading && (
          <HStack mb={4} fontSize="sm" color="gray.500">
            <Spinner size="sm" />
            <Text>Updating combined metrics…</Text>
          </HStack>
        )}
        {aggregateMetrics && (
          <Box mb={4} fontSize="sm" color="gray.600">
            <Text>Data health: Newest sync {aggregateMetrics.lastSyncNewest ? new Date(aggregateMetrics.lastSyncNewest).toLocaleString() : '—'} · Oldest sync {aggregateMetrics.lastSyncOldest ? new Date(aggregateMetrics.lastSyncOldest).toLocaleString() : '—'}</Text>
            {aggregateMetrics.errors.length > 0 && (
              <Box mt={2}>
                <Text fontWeight="semibold" color="orange.600">{aggregateMetrics.errors.length} customer(s) have sync errors</Text>
                <Stack as="ul" mt={1} pl={4} spacing={0.5}>
                  {aggregateMetrics.errors.map((e) => (
                    <Text key={e.customerId} as="li" fontSize="xs">{e.name}: {e.message}</Text>
                  ))}
                </Stack>
              </Box>
            )}
          </Box>
        )}
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={{ base: 3, md: 4 }}>
          {(['today', 'week', 'month'] as const).map((periodKey) => {
            const period = displayUnifiedPeriodMetrics[periodKey]
            // Ensure variance calculation handles NaN/undefined safely
            const actual = period.actual || 0
            const target = period.target || 0
            const variance = actual - target
            // Get all channels (both normalized and raw)
            const allChannels = Object.keys(period.breakdown).sort(
              (a, b) => period.breakdown[b] - period.breakdown[a],
            )
            const allTeamMembers = Object.keys(period.teamBreakdown || {}).sort(
              (a, b) => (period.teamBreakdown?.[b] || 0) - (period.teamBreakdown?.[a] || 0),
            )
            return (
              <Box
                key={periodKey}
                border="1px solid"
                borderColor="gray.200"
                borderRadius="xl"
                p={{ base: 4, md: 5 }}
                bg={periodKey === 'today' ? 'blue.50' : periodKey === 'week' ? 'green.50' : 'purple.50'}
                minH={{ base: "auto", md: "320px" }}
                boxShadow="sm"
                _hover={{ boxShadow: 'lg', transform: 'translateY(-2px)' }}
                transition="all 0.3s"
              >
                <Text 
                  fontSize="xs" 
                  textTransform="uppercase" 
                  color={periodKey === 'today' ? 'blue.600' : periodKey === 'week' ? 'green.600' : 'purple.600'}
                  fontWeight="bold"
                  letterSpacing="wide"
                >
                  {period.label}
                </Text>
                <Heading size={{ base: "xl", md: "2xl" }} mt={2} color="gray.800" fontWeight="extrabold">
                  {actual}
                </Heading>
                <Text fontSize="sm" color="gray.600" fontWeight="medium">
                  Actual Leads
                </Text>
                <Stack spacing={2} mt={4} fontSize="sm">
                  <HStack justify="space-between" bg="white" p={2} borderRadius="md">
                    <Text color="gray.600" fontWeight="medium">Target:</Text>
                    <Text fontWeight="bold" color="gray.800">{target}</Text>
                  </HStack>
                  <HStack justify="space-between" bg="white" p={2} borderRadius="md">
                    <Text color="gray.600" fontWeight="medium">Variance:</Text>
                    <Badge 
                      colorScheme={variance >= 0 ? 'green' : 'red'}
                      fontSize="xs"
                      px={2}
                      py={1}
                      borderRadius="md"
                    >
                      {variance > 0 ? '+' : ''}{variance}
                    </Badge>
                  </HStack>
                </Stack>
                <Box mt={4}>
                  <Text fontSize="xs" textTransform="uppercase" color="gray.600" fontWeight="bold" mb={2}>
                    Channels
                  </Text>
                  {allChannels.length > 0 ? (
                    <Stack spacing={2} maxH="100px" overflowY="auto" css={{
                      '&::-webkit-scrollbar': { width: '4px' },
                      '&::-webkit-scrollbar-track': { background: 'transparent' },
                      '&::-webkit-scrollbar-thumb': { background: '#CBD5E0', borderRadius: '24px' },
                    }}>
                      {allChannels.map((channel) => (
                        <HStack key={channel} justify="space-between" bg="white" p={2} borderRadius="md">
                          <Text fontSize="sm" color="gray.700" noOfLines={1} fontWeight="medium">
                            {channel}
                          </Text>
                          <Badge colorScheme="blue" fontSize="xs">
                            {period.breakdown[channel]}
                          </Badge>
                        </HStack>
                      ))}
                    </Stack>
                  ) : (
                    <Text fontSize="sm" color="gray.400" fontStyle="italic">
                      No leads recorded
                    </Text>
                  )}
                </Box>

                <Box mt={4}>
                  <Text fontSize="xs" textTransform="uppercase" color="gray.600" fontWeight="bold" mb={2}>
                    OD Team
                  </Text>
                  {allTeamMembers.length > 0 ? (
                    <Stack spacing={2} maxH="100px" overflowY="auto" css={{
                      '&::-webkit-scrollbar': { width: '4px' },
                      '&::-webkit-scrollbar-track': { background: 'transparent' },
                      '&::-webkit-scrollbar-thumb': { background: '#CBD5E0', borderRadius: '24px' },
                    }}>
                      {allTeamMembers.map((member) => (
                        <HStack key={member} justify="space-between" bg="white" p={2} borderRadius="md">
                          <Text fontSize="sm" color="gray.700" noOfLines={1} fontWeight="medium">
                            {member}
                          </Text>
                          <Badge colorScheme="purple" fontSize="xs">
                            {period.teamBreakdown?.[member] || 0}
                          </Badge>
                        </HStack>
                      ))}
                    </Stack>
                  ) : (
                    <Text fontSize="sm" color="gray.400" fontStyle="italic">
                      No team members recorded
                    </Text>
                  )}
                </Box>
              </Box>
            )
          })}
        </SimpleGrid>
      </Box>

      {/* Advanced Filtering Section */}
      <Box 
        p={{ base: 4, md: 6 }} 
        bg="white" 
        borderRadius="xl" 
        border="1px solid" 
        borderColor="gray.200"
        boxShadow="md"
      >
        <HStack justify="space-between" mb={4} flexWrap="wrap" gap={4}>
          <Heading size={{ base: "sm", md: "md" }} color="gray.800">
            Advanced Filters & Search
          </Heading>
          <HStack>
            <Button
              size="sm"
              variant="outline"
              colorScheme="blue"
              leftIcon={<SettingsIcon />}
              onClick={saveFilterModal.onOpen}
            >
              Save Filter
            </Button>
            {(filters.search || filters.accounts.length > 0 || filters.channels.length > 0 || 
              filters.teamMembers.length > 0 || filters.leadStatuses.length > 0 || 
              filters.outcomes.length > 0 || filters.dateRange.field) && (
              <Button
                size="sm"
                variant="ghost"
                colorScheme="red"
                onClick={clearAllFilters}
              >
                Clear All
              </Button>
            )}
          </HStack>
        </HStack>
        
        {/* Search Bar */}
        <Box mb={4}>
          <InputGroup>
            <InputLeftElement pointerEvents="none">
              <SearchIcon color="gray.400" />
            </InputLeftElement>
            <Input
              placeholder="Search by name, company, email, phone, or job title..."
              value={filters.search}
              onChange={(e) => updateFilter({ search: e.target.value })}
              size="md"
              borderRadius="lg"
            />
          </InputGroup>
        </Box>
        
        {/* Filter Chips and Multi-Select Filters */}
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4} mb={4}>
          {/* Account Filter */}
          <Box>
            <Text fontSize="xs" fontWeight="bold" color="gray.600" mb={2} textTransform="uppercase">
              Accounts
            </Text>
            <Menu closeOnSelect={false}>
              <MenuButton as={Button} size="sm" width="100%" variant="outline" borderRadius="lg">
                Accounts {filters.accounts.length > 0 && `(${filters.accounts.length})`}
              </MenuButton>
              <MenuList maxH="300px" overflowY="auto">
                {uniqueAccounts.map(account => (
                  <MenuItem key={account} onClick={() => toggleFilterValue('accounts', account)}>
                    <Checkbox isChecked={filters.accounts.includes(account)} mr={2} />
                    {account}
                  </MenuItem>
                ))}
              </MenuList>
            </Menu>
            {filters.accounts.length > 0 && (
              <HStack mt={2} flexWrap="wrap">
                {filters.accounts.map(account => (
                  <Tag key={account} size="sm" colorScheme="blue">
                    <TagLabel>{account}</TagLabel>
                    <TagCloseButton onClick={() => toggleFilterValue('accounts', account)} />
                  </Tag>
                ))}
              </HStack>
            )}
          </Box>
          
          {/* Channel Filter */}
          <Box>
            <Text fontSize="xs" fontWeight="bold" color="gray.600" mb={2} textTransform="uppercase">
              Channels
            </Text>
            <Menu closeOnSelect={false}>
              <MenuButton as={Button} size="sm" width="100%" variant="outline" borderRadius="lg">
                Channels {filters.channels.length > 0 && `(${filters.channels.length})`}
              </MenuButton>
              <MenuList maxH="300px" overflowY="auto">
                {uniqueChannels.map(channel => (
                  <MenuItem key={channel} onClick={() => toggleFilterValue('channels', channel)}>
                    <Checkbox isChecked={filters.channels.includes(channel)} mr={2} />
                    {channel}
                  </MenuItem>
                ))}
              </MenuList>
            </Menu>
            {filters.channels.length > 0 && (
              <HStack mt={2} flexWrap="wrap">
                {filters.channels.map(channel => (
                  <Tag key={channel} size="sm" colorScheme="green">
                    <TagLabel>{channel}</TagLabel>
                    <TagCloseButton onClick={() => toggleFilterValue('channels', channel)} />
                  </Tag>
                ))}
              </HStack>
            )}
          </Box>
          
          {/* Team Member Filter */}
          <Box>
            <Text fontSize="xs" fontWeight="bold" color="gray.600" mb={2} textTransform="uppercase">
              Team Members
            </Text>
            <Menu closeOnSelect={false}>
              <MenuButton as={Button} size="sm" width="100%" variant="outline" borderRadius="lg">
                Team Members {filters.teamMembers.length > 0 && `(${filters.teamMembers.length})`}
              </MenuButton>
              <MenuList maxH="300px" overflowY="auto">
                {uniqueTeamMembers.map(member => (
                  <MenuItem key={member} onClick={() => toggleFilterValue('teamMembers', member)}>
                    <Checkbox isChecked={filters.teamMembers.includes(member)} mr={2} />
                    {member}
                  </MenuItem>
                ))}
              </MenuList>
            </Menu>
            {filters.teamMembers.length > 0 && (
              <HStack mt={2} flexWrap="wrap">
                {filters.teamMembers.map(member => (
                  <Tag key={member} size="sm" colorScheme="purple">
                    <TagLabel>{member}</TagLabel>
                    <TagCloseButton onClick={() => toggleFilterValue('teamMembers', member)} />
                  </Tag>
                ))}
              </HStack>
            )}
          </Box>
          
          {/* Lead Status Filter */}
          <Box>
            <Text fontSize="xs" fontWeight="bold" color="gray.600" mb={2} textTransform="uppercase">
              Lead Status
            </Text>
            <Menu closeOnSelect={false}>
              <MenuButton as={Button} size="sm" width="100%" variant="outline" borderRadius="lg">
                Status {filters.leadStatuses.length > 0 && `(${filters.leadStatuses.length})`}
              </MenuButton>
              <MenuList maxH="300px" overflowY="auto">
                {availableLeadStatuses.map(status => (
                  <MenuItem key={status} onClick={() => toggleFilterValue('leadStatuses', status)}>
                    <Checkbox isChecked={filters.leadStatuses.includes(status)} mr={2} />
                    {status}
                  </MenuItem>
                ))}
              </MenuList>
            </Menu>
            {filters.leadStatuses.length > 0 && (
              <HStack mt={2} flexWrap="wrap">
                {filters.leadStatuses.map(status => (
                  <Tag key={status} size="sm" colorScheme="orange">
                    <TagLabel>{status}</TagLabel>
                    <TagCloseButton onClick={() => toggleFilterValue('leadStatuses', status)} />
                  </Tag>
                ))}
              </HStack>
            )}
          </Box>
          
          {/* Outcome Filter */}
          <Box>
            <Text fontSize="xs" fontWeight="bold" color="gray.600" mb={2} textTransform="uppercase">
              Outcomes
            </Text>
            <Menu closeOnSelect={false}>
              <MenuButton as={Button} size="sm" width="100%" variant="outline" borderRadius="lg">
                Outcomes {filters.outcomes.length > 0 && `(${filters.outcomes.length})`}
              </MenuButton>
              <MenuList maxH="300px" overflowY="auto">
                {uniqueOutcomes.map(outcome => (
                  <MenuItem key={outcome} onClick={() => toggleFilterValue('outcomes', outcome)}>
                    <Checkbox isChecked={filters.outcomes.includes(outcome)} mr={2} />
                    {outcome}
                  </MenuItem>
                ))}
              </MenuList>
            </Menu>
            {filters.outcomes.length > 0 && (
              <HStack mt={2} flexWrap="wrap">
                {filters.outcomes.map(outcome => (
                  <Tag key={outcome} size="sm" colorScheme="teal">
                    <TagLabel>{outcome}</TagLabel>
                    <TagCloseButton onClick={() => toggleFilterValue('outcomes', outcome)} />
                  </Tag>
                ))}
              </HStack>
            )}
          </Box>
          
          {/* Date Range Filter */}
          <Box>
            <Text fontSize="xs" fontWeight="bold" color="gray.600" mb={2} textTransform="uppercase">
              Date Range
            </Text>
            <VStack spacing={2} align="stretch">
              <Select
                size="sm"
                value={filters.dateRange.field}
                onChange={(e) => updateFilter({ 
                  dateRange: { ...filters.dateRange, field: e.target.value as any }
                })}
                placeholder="Select date field"
                borderRadius="lg"
              >
                <option value="Date">Date</option>
                <option value="First Meeting Date">First Meeting Date</option>
                <option value="Closed Date">Closed Date</option>
              </Select>
              {filters.dateRange.field && (
                <>
                  <Input
                    type="date"
                    size="sm"
                    value={filters.dateRange.start}
                    onChange={(e) => updateFilter({
                      dateRange: { ...filters.dateRange, start: e.target.value }
                    })}
                    placeholder="Start date"
                    borderRadius="lg"
                  />
                  <Input
                    type="date"
                    size="sm"
                    value={filters.dateRange.end}
                    onChange={(e) => updateFilter({
                      dateRange: { ...filters.dateRange, end: e.target.value }
                    })}
                    placeholder="End date"
                    borderRadius="lg"
                  />
                </>
              )}
            </VStack>
          </Box>
        </SimpleGrid>
        
        {/* Saved Filter Presets */}
        {savedFilters.length > 0 && (
          <Box mb={4}>
            <Text fontSize="xs" fontWeight="bold" color="gray.600" mb={2} textTransform="uppercase">
              Saved Filter Presets
            </Text>
            <HStack flexWrap="wrap" gap={2}>
              {savedFilters.map(saved => (
                <Tag key={saved.id} size="md" colorScheme="blue" cursor="pointer">
                  <TagLabel onClick={() => loadSavedFilter(saved)}>
                    <HStack>
                      <StarIcon />
                      <Text>{saved.name}</Text>
                    </HStack>
                  </TagLabel>
                  <TagCloseButton onClick={() => deleteSavedFilter(saved.id)} />
                </Tag>
              ))}
            </HStack>
          </Box>
        )}
        
        {/* Sort Controls */}
        <HStack mb={4} flexWrap="wrap" gap={2}>
          <Text fontSize="xs" fontWeight="bold" color="gray.600" textTransform="uppercase">
            Sort By:
          </Text>
          <Select
            size="sm"
            value={filters.sortBy}
            onChange={(e) => updateFilter({ sortBy: e.target.value })}
            width="200px"
            borderRadius="lg"
          >
            {columns.map(col => (
              <option key={col} value={col}>{col}</option>
            ))}
          </Select>
          <IconButton
            aria-label="Toggle sort order"
            icon={filters.sortOrder === 'asc' ? <ChevronUpIcon /> : <ChevronDownIcon />}
            size="sm"
            onClick={() => updateFilter({ sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' })}
          />
        </HStack>
        
        {/* Results Summary and Export */}
        <HStack justify="space-between" mb={4} flexWrap="wrap" gap={2}>
          <Text fontSize="sm" color="gray.700" fontWeight="medium">
            Showing <Badge colorScheme="blue">{filteredLeadCount}</Badge> of{' '}
            <Badge colorScheme="gray">{totalLeadCount}</Badge> leads
            {filters.search && (
              <Text as="span" color="gray.500" ml={2}>
                matching "{filters.search}"
              </Text>
            )}
          </Text>
          <Button
            size="sm"
            colorScheme="green"
            leftIcon={<DownloadIcon />}
            onClick={exportFilteredToCSV}
            isDisabled={filteredLeadCount === 0}
          >
            Export Filtered ({filteredLeadCount})
          </Button>
        </HStack>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <HStack justify="center" mt={4}>
            <IconButton
              aria-label="Previous page"
              icon={<ChevronLeftIcon />}
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              isDisabled={serverPage === 1}
            />
            <Text fontSize="sm" color="gray.700" fontWeight="medium">
              Page {serverPage} of {totalPages}
            </Text>
            <IconButton
              aria-label="Next page"
              icon={<ChevronRightIcon />}
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              isDisabled={serverPage === totalPages}
            />
          </HStack>
        )}
      </Box>
      
      {/* Account Performance Filter Section */}
      <Box 
        p={{ base: 4, md: 6 }} 
        bg="white" 
        borderRadius="xl" 
        border="1px solid" 
        borderColor="gray.200"
        boxShadow="md"
      >
        <Heading size={{ base: "sm", md: "md" }} mb={4} color="gray.800">
          Account Performance
        </Heading>
        <SimpleGrid columns={{ base: 1, md: 2 }} gap={{ base: 3, md: 4 }} mb={6}>
          <Box>
            <HStack mb={2} justify="space-between">
              <Text 
                fontSize="xs" 
                textTransform="uppercase" 
                color="gray.600" 
                fontWeight="bold"
                letterSpacing="wide"
              >
                Select Account
              </Text>
              {performanceAccountFilter && (
                <Button
                  size="xs"
                  variant="ghost"
                  colorScheme="red"
                  leftIcon={<RepeatIcon />}
                  onClick={() => setPerformanceAccountFilter('')}
                  fontSize="xs"
                >
                  Reset
                </Button>
              )}
            </HStack>
            <Select
              placeholder="Choose an account to view performance"
              value={performanceAccountFilter}
              onChange={(e) => setPerformanceAccountFilter(e.target.value)}
              size="md"
              borderColor="gray.300"
              borderRadius="lg"
              _hover={{ borderColor: 'blue.400' }}
              _focus={{ borderColor: 'blue.500', boxShadow: '0 0 0 1px var(--chakra-colors-blue-500)' }}
            >
              {uniqueAccounts.map((account) => (
                <option key={account} value={account}>
                  {account}
                </option>
              ))}
            </Select>
          </Box>

          <Box>
            <Text 
              fontSize="xs" 
              textTransform="uppercase" 
              color="gray.600" 
              mb={2} 
              fontWeight="bold"
              letterSpacing="wide"
            >
              Column Visibility
            </Text>
            <Menu closeOnSelect={false}>
              <MenuButton 
                as={Button} 
                size="md" 
                leftIcon={<ViewIcon />} 
                width="100%"
                borderRadius="lg"
                colorScheme="blue"
                variant="outline"
                _hover={{ bg: 'blue.50' }}
              >
                Show/Hide Columns ({visibleColumns.size})
              </MenuButton>
              <MenuList maxH="400px" overflowY="auto" borderRadius="lg" boxShadow="lg">
                {['Account', 'Week', 'Date', 'Company', 'Name', 'Job Title', 'Channel of Lead', 'OD Team Member', 'Contact Info', 'Outcome', 'Lead Status'].map((col) => (
                  <MenuItem 
                    key={col} 
                    onClick={() => {
                      const newVisible = new Set(visibleColumns)
                      if (newVisible.has(col)) {
                        newVisible.delete(col)
                      } else {
                        newVisible.add(col)
                      }
                      setVisibleColumns(newVisible)
                    }}
                    _hover={{ bg: 'blue.50' }}
                  >
                    <Checkbox 
                      isChecked={visibleColumns.has(col)} 
                      onChange={() => {
                        const newVisible = new Set(visibleColumns)
                        if (newVisible.has(col)) {
                          newVisible.delete(col)
                        } else {
                          newVisible.add(col)
                        }
                        setVisibleColumns(newVisible)
                      }}
                      mr={2}
                      colorScheme="blue"
                    >
                      {col}
                    </Checkbox>
                  </MenuItem>
                ))}
              </MenuList>
            </Menu>
          </Box>
        </SimpleGrid>

        {accountPerformance && (
          <Box
            bgGradient="linear(to-br, blue.50, purple.50)"
            borderRadius="xl"
            p={{ base: 4, md: 6 }}
            border="1px solid"
            borderColor="gray.200"
            boxShadow="lg"
          >
            <Stack direction={{ base: "column", md: "row" }} justify="space-between" mb={6} spacing={4}>
              <Box>
                <Text 
                  fontSize="xs" 
                  textTransform="uppercase" 
                  color="blue.600" 
                  fontWeight="bold"
                  letterSpacing="wide"
                >
                  Account Lead Performance
                </Text>
                <Heading size={{ base: "sm", md: "md" }} color="gray.800" mt={1}>
                  {accountPerformance.accountName}
                </Heading>
              </Box>
              <Text fontSize="sm" color="gray.600" fontWeight="medium">
                {new Date().toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
            </Stack>
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={{ base: 3, md: 4 }}>
              {(['today', 'week', 'month'] as const).map((periodKey) => {
                const period = accountPerformance.periodMetrics[periodKey]
                // Ensure variance calculation handles NaN/undefined safely
                const actual = period.actual || 0
                const target = period.target || 0
                const variance = actual - target
                const allChannels = Object.keys(period.breakdown).sort(
                  (a, b) => period.breakdown[b] - period.breakdown[a],
                )
                const allTeamMembers = Object.keys(period.teamBreakdown || {}).sort(
                  (a, b) => (period.teamBreakdown?.[b] || 0) - (period.teamBreakdown?.[a] || 0),
                )
                return (
                  <Box
                    key={periodKey}
                    border="1px solid"
                    borderColor="gray.200"
                    borderRadius="lg"
                    p={4}
                    bg="gray.50"
                    minH="280px"
                  >
                    <Text fontSize="xs" textTransform="uppercase" color="gray.500" fontWeight="semibold">
                      {period.label}
                    </Text>
                    <Heading size="2xl" mt={2} color="gray.800">
                      {actual}
                    </Heading>
                    <Text fontSize="sm" color="gray.600">
                      Actual Leads
                    </Text>
                    <Stack spacing={1} mt={3} fontSize="sm">
                      <Text color="gray.600">
                        Target Leads:{' '}
                        <Text as="span" fontWeight="semibold">
                          {target}
                        </Text>
                      </Text>
                      <Text color="text.muted">
                        Variance:{' '}
                        <Text as="span" fontWeight="semibold">
                          {variance > 0 ? '+' : ''}
                          {variance}
                        </Text>
                      </Text>
                    </Stack>
                    <Box mt={4}>
                      <Text fontSize="xs" textTransform="uppercase" color="gray.500" fontWeight="semibold" mb={2}>
                        Channels
                      </Text>
                      {allChannels.length > 0 ? (
                        <Stack spacing={1} maxH="120px" overflowY="auto">
                          {allChannels.map((channel) => (
                            <HStack key={channel} justify="space-between">
                              <Text fontSize="sm" color="gray.700" noOfLines={1}>
                                {channel}
                              </Text>
                              <Badge colorScheme="blue" variant="subtle" fontSize="xs">
                                {period.breakdown[channel]}
                              </Badge>
                            </HStack>
                          ))}
                        </Stack>
                      ) : (
                        <Text fontSize="sm" color="gray.400">
                          No leads recorded
                        </Text>
                      )}
                    </Box>

                    <Box mt={4}>
                      <Text fontSize="xs" textTransform="uppercase" color="gray.500" fontWeight="semibold" mb={2}>
                        OD Team
                      </Text>
                      {allTeamMembers.length > 0 ? (
                        <Stack spacing={1} maxH="120px" overflowY="auto">
                          {allTeamMembers.map((member) => (
                            <HStack key={member} justify="space-between">
                              <Text fontSize="sm" color="gray.700" noOfLines={1}>
                                {member}
                              </Text>
                              <Badge colorScheme="purple" variant="subtle" fontSize="xs">
                                {period.teamBreakdown?.[member] || 0}
                              </Badge>
                            </HStack>
                          ))}
                        </Stack>
                      ) : (
                        <Text fontSize="sm" color="gray.400">
                          No team members recorded
                        </Text>
                      )}
                    </Box>
                  </Box>
                )
              })}
            </SimpleGrid>

            {/* Comprehensive Leads Table for Selected Account */}
            {performanceAccountFilter && (
              <Box mt={6}>
                <Heading size={{ base: "sm", md: "md" }} mb={4} color="gray.800">
                  Detailed Leads List - {performanceAccountFilter}
                </Heading>
                <Box
                  overflowX="auto"
                  overflowY="auto"
                  maxH={{ base: "400px", md: "600px" }}
                  border="1px solid"
                  borderColor="gray.200"
                  borderRadius="xl"
                  bg="white"
                  boxShadow="md"
                  css={{
                    '&::-webkit-scrollbar': { width: '8px', height: '8px' },
                    '&::-webkit-scrollbar-track': { background: '#F7FAFC' },
                    '&::-webkit-scrollbar-thumb': { background: '#CBD5E0', borderRadius: '24px' },
                    '&::-webkit-scrollbar-thumb:hover': { background: '#A0AEC0' },
                  }}
                >
                  <Table variant="simple" size={{ base: "sm", md: "md" }}>
                    <Thead bg="blue.50" position="sticky" top={0} zIndex={10} borderBottom="2px solid" borderColor="blue.200">
                      <Tr>
                        {visibleColumns.has('Account') && (
                          <Th whiteSpace="nowrap" color="gray.700" fontWeight="bold" fontSize="xs" textTransform="uppercase" letterSpacing="wide">
                            Account
                          </Th>
                        )}
                        {visibleColumns.has('Week') && (
                          <Th whiteSpace="nowrap" color="gray.700" fontWeight="bold" fontSize="xs" textTransform="uppercase" letterSpacing="wide">
                            Week
                          </Th>
                        )}
                        {visibleColumns.has('Date') && (
                          <Th whiteSpace="nowrap" color="gray.700" fontWeight="bold" fontSize="xs" textTransform="uppercase" letterSpacing="wide">
                            Date
                          </Th>
                        )}
                        {visibleColumns.has('Company') && (
                          <Th whiteSpace="nowrap" color="gray.700" fontWeight="bold" fontSize="xs" textTransform="uppercase" letterSpacing="wide">
                            Company
                          </Th>
                        )}
                        {visibleColumns.has('Name') && (
                          <Th whiteSpace="nowrap" color="gray.700" fontWeight="bold" fontSize="xs" textTransform="uppercase" letterSpacing="wide">
                            Name
                          </Th>
                        )}
                        {visibleColumns.has('Job Title') && (
                          <Th whiteSpace="nowrap" color="gray.700" fontWeight="bold" fontSize="xs" textTransform="uppercase" letterSpacing="wide">
                            Job Title
                          </Th>
                        )}
                        {visibleColumns.has('Channel of Lead') && (
                          <Th whiteSpace="nowrap" color="gray.700" fontWeight="bold" fontSize="xs" textTransform="uppercase" letterSpacing="wide">
                            Channel
                          </Th>
                        )}
                        {visibleColumns.has('OD Team Member') && (
                          <Th whiteSpace="nowrap" color="gray.700" fontWeight="bold" fontSize="xs" textTransform="uppercase" letterSpacing="wide">
                            Team Member
                          </Th>
                        )}
                        {visibleColumns.has('Contact Info') && (
                          <Th whiteSpace="nowrap" color="gray.700" fontWeight="bold" fontSize="xs" textTransform="uppercase" letterSpacing="wide">
                            Contact
                          </Th>
                        )}
                        {visibleColumns.has('Outcome') && (
                          <Th whiteSpace="nowrap" color="gray.700" fontWeight="bold" fontSize="xs" textTransform="uppercase" letterSpacing="wide">
                            Outcome
                          </Th>
                        )}
                        {visibleColumns.has('Lead Status') && (
                          <Th whiteSpace="nowrap" color="gray.700" fontWeight="bold" fontSize="xs" textTransform="uppercase" letterSpacing="wide">
                            Status
                          </Th>
                        )}
                      </Tr>
                    </Thead>
                    <Tbody>
                      {accountPerformanceLeads.length > 0 ? (
                        accountPerformanceLeads.map((lead, index) => (
                          <Tr 
                            key={`lead-${index}`} 
                            _hover={{ bg: 'blue.50' }}
                            borderBottom="1px solid"
                            borderColor="gray.100"
                            transition="all 0.2s"
                          >
                            {visibleColumns.has('Account') && (
                              <Td whiteSpace="nowrap">
                                <Badge colorScheme="gray">{lead.accountName}</Badge>
                              </Td>
                            )}
                            {visibleColumns.has('Week') && <Td whiteSpace="nowrap">{lead['Week'] || '-'}</Td>}
                            {visibleColumns.has('Date') && <Td whiteSpace="nowrap">{lead['Date'] || '-'}</Td>}
                            {visibleColumns.has('Company') && <Td>{lead['Company'] || '-'}</Td>}
                            {visibleColumns.has('Name') && <Td>{lead['Name'] || '-'}</Td>}
                            {visibleColumns.has('Job Title') && <Td>{lead['Job Title'] || '-'}</Td>}
                            {visibleColumns.has('Channel of Lead') && (
                              <Td>
                                {lead['Channel of Lead'] ? (
                                  <Badge colorScheme="blue" variant="subtle">
                                    {lead['Channel of Lead']}
                                  </Badge>
                                ) : (
                                  '-'
                                )}
                              </Td>
                            )}
                            {visibleColumns.has('OD Team Member') && (
                              <Td>
                                {lead['OD Team Member'] ? (
                                  <Badge colorScheme="purple" variant="subtle">
                                    {lead['OD Team Member']}
                                  </Badge>
                                ) : (
                                  '-'
                                )}
                              </Td>
                            )}
                            {visibleColumns.has('Contact Info') && <Td>{lead['Contact Info'] || '-'}</Td>}
                            {visibleColumns.has('Outcome') && <Td>{lead['Outcome'] || '-'}</Td>}
                            {visibleColumns.has('Lead Status') && (
                              <Td>
                                {lead['Lead Status'] ? (
                                  <Badge
                                    colorScheme={
                                      lead['Lead Status'].toLowerCase().includes('closed')
                                        ? 'green'
                                        : lead['Lead Status'].toLowerCase().includes('meeting')
                                        ? 'orange'
                                        : 'gray'
                                    }
                                  >
                                    {lead['Lead Status']}
                                  </Badge>
                                ) : (
                                  '-'
                                )}
                              </Td>
                            )}
                          </Tr>
                        ))
                      ) : (
                        <Tr>
                          <Td colSpan={visibleColumns.size} textAlign="center" py={8} color="gray.500">
                            {accountDetailLoading ? 'Loading leads for this account...' : 'No leads found for this account'}
                          </Td>
                        </Tr>
                      )}
                    </Tbody>
                  </Table>
                </Box>
                <HStack 
                  mt={4} 
                  p={3} 
                  bg="blue.50" 
                  borderRadius="lg"
                  justify="space-between"
                  flexWrap="wrap"
                >
                  <Text fontSize="sm" color="gray.700" fontWeight="medium">
                    Total Leads: <Badge colorScheme="blue" ml={2}>{accountDetailTotal}</Badge>
                  </Text>
                  <Text fontSize="xs" color="gray.600">
                    Account: {performanceAccountFilter}
                  </Text>
                </HStack>
                {accountDetailTotalPages > 1 && (
                  <HStack justify="center" mt={4}>
                    <IconButton
                      aria-label="Previous account page"
                      icon={<ChevronLeftIcon />}
                      size="sm"
                      onClick={() => setAccountPage((prev) => Math.max(1, prev - 1))}
                      isDisabled={accountDetailServerPage === 1}
                    />
                    <Text fontSize="sm" color="gray.700" fontWeight="medium">
                      Page {accountDetailServerPage} of {accountDetailTotalPages} ({accountDetailTotal} total)
                    </Text>
                    <IconButton
                      aria-label="Next account page"
                      icon={<ChevronRightIcon />}
                      size="sm"
                      onClick={() => setAccountPage((prev) => Math.min(accountDetailTotalPages, prev + 1))}
                      isDisabled={accountDetailServerPage === accountDetailTotalPages}
                    />
                  </HStack>
                )}
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* Save Filter Modal */}
      <Modal isOpen={saveFilterModal.isOpen} onClose={saveFilterModal.onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Save Filter Preset</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl>
              <FormLabel>Filter Name</FormLabel>
              <Input
                placeholder="e.g., Hot Leads, This Week, My Team"
                value={newFilterName}
                onChange={(e) => setNewFilterName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    saveCurrentFilter()
                  }
                }}
              />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={saveFilterModal.onClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={saveCurrentFilter}>
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      {/* Comprehensive Filtered Leads Table */}
      {filteredLeadCount > 0 && (
        <Box 
          p={{ base: 4, md: 6 }} 
          bg="white" 
          borderRadius="xl" 
          border="1px solid" 
          borderColor="gray.200"
          boxShadow="md"
        >
          <Heading size={{ base: "sm", md: "md" }} mb={4} color="gray.800">
            Filtered Leads ({filteredLeadCount})
          </Heading>
          <Box
            overflowX="auto"
            overflowY="auto"
            maxH={{ base: "400px", md: "600px" }}
            border="1px solid"
            borderColor="gray.200"
            borderRadius="xl"
            bg="white"
            boxShadow="md"
            css={{
              '&::-webkit-scrollbar': { width: '8px', height: '8px' },
              '&::-webkit-scrollbar-track': { background: '#F7FAFC' },
              '&::-webkit-scrollbar-thumb': { background: '#CBD5E0', borderRadius: '24px' },
              '&::-webkit-scrollbar-thumb:hover': { background: '#A0AEC0' },
            }}
          >
            <Table variant="simple" size={{ base: "sm", md: "md" }}>
              <Thead bg="blue.50" position="sticky" top={0} zIndex={10} borderBottom="2px solid" borderColor="blue.200">
                <Tr>
                  {visibleColumns.has('Account') && (
                    <Th whiteSpace="nowrap" color="gray.700" fontWeight="bold" fontSize="xs" textTransform="uppercase" letterSpacing="wide">
                      Account
                    </Th>
                  )}
                  {visibleColumns.has('Week') && (
                    <Th whiteSpace="nowrap" color="gray.700" fontWeight="bold" fontSize="xs" textTransform="uppercase" letterSpacing="wide">
                      Week
                    </Th>
                  )}
                  {visibleColumns.has('Date') && (
                    <Th whiteSpace="nowrap" color="gray.700" fontWeight="bold" fontSize="xs" textTransform="uppercase" letterSpacing="wide">
                      Date
                    </Th>
                  )}
                  {visibleColumns.has('Company') && (
                    <Th whiteSpace="nowrap" color="gray.700" fontWeight="bold" fontSize="xs" textTransform="uppercase" letterSpacing="wide">
                      Company
                    </Th>
                  )}
                  {visibleColumns.has('Name') && (
                    <Th whiteSpace="nowrap" color="gray.700" fontWeight="bold" fontSize="xs" textTransform="uppercase" letterSpacing="wide">
                      Name
                    </Th>
                  )}
                  {visibleColumns.has('Job Title') && (
                    <Th whiteSpace="nowrap" color="gray.700" fontWeight="bold" fontSize="xs" textTransform="uppercase" letterSpacing="wide">
                      Job Title
                    </Th>
                  )}
                  {visibleColumns.has('Channel of Lead') && (
                    <Th whiteSpace="nowrap" color="gray.700" fontWeight="bold" fontSize="xs" textTransform="uppercase" letterSpacing="wide">
                      Channel
                    </Th>
                  )}
                  {visibleColumns.has('OD Team Member') && (
                    <Th whiteSpace="nowrap" color="gray.700" fontWeight="bold" fontSize="xs" textTransform="uppercase" letterSpacing="wide">
                      Team Member
                    </Th>
                  )}
                  {visibleColumns.has('Contact Info') && (
                    <Th whiteSpace="nowrap" color="gray.700" fontWeight="bold" fontSize="xs" textTransform="uppercase" letterSpacing="wide">
                      Contact
                    </Th>
                  )}
                  {visibleColumns.has('Outcome') && (
                    <Th whiteSpace="nowrap" color="gray.700" fontWeight="bold" fontSize="xs" textTransform="uppercase" letterSpacing="wide">
                      Outcome
                    </Th>
                  )}
                  {visibleColumns.has('Lead Status') && (
                    <Th whiteSpace="nowrap" color="gray.700" fontWeight="bold" fontSize="xs" textTransform="uppercase" letterSpacing="wide">
                      Status
                    </Th>
                  )}
                </Tr>
              </Thead>
              <Tbody>
                {filteredAndSortedLeads.map((lead, index) => (
                  <Tr 
                    key={`filtered-lead-${index}`} 
                    _hover={{ bg: 'blue.50' }}
                    borderBottom="1px solid"
                    borderColor="gray.100"
                    transition="all 0.2s"
                  >
                    {visibleColumns.has('Account') && (
                      <Td whiteSpace="nowrap">
                        <Badge colorScheme="gray">{lead.accountName}</Badge>
                      </Td>
                    )}
                    {visibleColumns.has('Week') && <Td whiteSpace="nowrap">{highlightSearch(lead['Week'] || '-')}</Td>}
                    {visibleColumns.has('Date') && <Td whiteSpace="nowrap">{highlightSearch(lead['Date'] || '-')}</Td>}
                    {visibleColumns.has('Company') && <Td>{highlightSearch(lead['Company'] || '-')}</Td>}
                    {visibleColumns.has('Name') && <Td>{highlightSearch(lead['Name'] || '-')}</Td>}
                    {visibleColumns.has('Job Title') && <Td>{highlightSearch(lead['Job Title'] || '-')}</Td>}
                    {visibleColumns.has('Channel of Lead') && (
                      <Td>
                        {lead['Channel of Lead'] ? (
                          <Badge colorScheme="blue" variant="subtle">
                            {highlightSearch(lead['Channel of Lead'])}
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </Td>
                    )}
                    {visibleColumns.has('OD Team Member') && (
                      <Td>
                        {lead['OD Team Member'] ? (
                          <Badge colorScheme="purple" variant="subtle">
                            {highlightSearch(lead['OD Team Member'])}
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </Td>
                    )}
                    {visibleColumns.has('Contact Info') && <Td>{highlightSearch(lead['Contact Info'] || '-')}</Td>}
                    {visibleColumns.has('Outcome') && <Td>{highlightSearch(lead['Outcome'] || '-')}</Td>}
                    {visibleColumns.has('Lead Status') && (
                      <Td>
                        {lead['Lead Status'] ? (
                          <Badge
                            colorScheme={
                              lead['Lead Status'].toLowerCase().includes('closed')
                                ? 'green'
                                : lead['Lead Status'].toLowerCase().includes('meeting')
                                ? 'orange'
                                : 'gray'
                            }
                          >
                            {highlightSearch(lead['Lead Status'])}
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </Td>
                    )}
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
          {totalPages > 1 && (
            <HStack justify="center" mt={4}>
              <IconButton
                aria-label="Previous page"
                icon={<ChevronLeftIcon />}
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                isDisabled={serverPage === 1}
              />
              <Text fontSize="sm" color="gray.700" fontWeight="medium">
                Page {serverPage} of {totalPages} ({filteredLeadCount} total)
              </Text>
              <IconButton
                aria-label="Next page"
                icon={<ChevronRightIcon />}
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                isDisabled={serverPage === totalPages}
              />
            </HStack>
          )}
        </Box>
      )}
      
      {filteredLeadCount === 0 && totalLeadCount > 0 && (
        <Alert status="info" borderRadius="xl">
          <AlertIcon />
          <AlertDescription>
            No leads match the current filters. Try adjusting your search criteria.
          </AlertDescription>
        </Alert>
      )}

      {error && totalLeadCount > 0 && (
        <Alert 
          status="warning" 
          borderRadius="xl"
          boxShadow="md"
          bg="orange.50"
          borderLeft="4px solid"
          borderColor="orange.400"
        >
          <AlertIcon color="orange.500" />
          <AlertDescription color="gray.700" fontWeight="medium">
            Some data may be outdated. Last refresh attempt failed. Showing cached data.
          </AlertDescription>
        </Alert>
      )}
    </Stack>
      )}
    </RequireActiveClient>
  )
}

export default MarketingLeadsTab
