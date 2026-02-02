import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
} from '@chakra-ui/react'
import { ExternalLinkIcon, RepeatIcon, ViewIcon } from '@chakra-ui/icons'
import { type Account } from './AccountsTab'
import { syncAccountLeadCountsFromLeads } from '../utils/accountsLeadsSync'
import { on } from '../platform/events'
import { OdcrmStorageKeys } from '../platform/keys'
import { getItem, getJson } from '../platform/storage'
import { fetchLeadsFromApi, persistLeadsToStorage } from '../utils/leadsApi'

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

// Load leads from storage
function loadLeadsFromStorage(): Lead[] {
  const parsed = getJson<Lead[]>(OdcrmStorageKeys.marketingLeads)
  return parsed && Array.isArray(parsed) ? parsed : []
}

// Save leads to storage
function saveLeadsToStorage(leads: Lead[], lastSyncAt?: string | null): Date {
  return persistLeadsToStorage(leads, lastSyncAt)
}

// Load last refresh time from storage
function loadLastRefreshFromStorage(): Date | null {
  const stored = getItem(OdcrmStorageKeys.marketingLeadsLastRefresh)
  if (!stored) return null
  const d = new Date(stored)
  return isNaN(d.getTime()) ? null : d
}

type LeadWithDate = {
  data: Lead
  parsedDate: Date
}

function MarketingLeadsTab({ focusAccountName }: { focusAccountName?: string }) {
  // Load initial leads from localStorage
  const cachedLeads = loadLeadsFromStorage()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(() => {
    const stored = loadLastRefreshFromStorage()
    return stored || new Date()
  })
  const [filters] = useState({
    account: '',
    search: '',
  })
  const [performanceAccountFilter, setPerformanceAccountFilter] = useState<string>('')
  
  // Default visible columns for Detailed Leads List
  const defaultVisibleColumns = ['Account', 'Date', 'Company', 'OD Team Member', 'Channel of Lead']
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(defaultVisibleColumns))
  
  const toast = useToast()
  const lastErrorToastAtRef = useRef(0)
  
  // Use refs to prevent infinite refresh loops
  const cachedLeadsRef = useRef(cachedLeads)
  useEffect(() => {
    cachedLeadsRef.current = cachedLeads
  }, [cachedLeads])

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

  // Check if 6 hours have passed since last refresh
  const shouldRefresh = useCallback((): boolean => {
    const lastRefreshTime = loadLastRefreshFromStorage()
    if (!lastRefreshTime) return true // No previous refresh, allow refresh

    // If accounts were updated since last refresh (e.g., sheet URLs pasted), refresh immediately.
    try {
      const accountsUpdatedIso = getItem(OdcrmStorageKeys.accountsLastUpdated)
      if (accountsUpdatedIso) {
        const accountsUpdatedAt = new Date(accountsUpdatedIso)
        if (!isNaN(accountsUpdatedAt.getTime()) && accountsUpdatedAt > lastRefreshTime) {
          return true
        }
      }
    } catch {
      // ignore
    }
    
    const now = new Date()
    const sixHoursInMs = 6 * 60 * 60 * 1000
    const timeSinceLastRefresh = now.getTime() - lastRefreshTime.getTime()
    
    return timeSinceLastRefresh >= sixHoursInMs
  }, [])

  const loadLeads = useCallback(async (forceRefresh: boolean = false) => {
    const accountsData = loadAccountsFromStorage()
    const hasSheets = accountsData.some((account) => Boolean(account.clientLeadsSheetUrl?.trim()))
    if (!hasSheets) {
      setLeads([])
      const refreshTime = saveLeadsToStorage([], null)
      setLastRefresh(refreshTime)
      setLoading(false)
      return
    }

    // Check if we should refresh (unless forced)
    if (!forceRefresh && !shouldRefresh()) {
      console.log('Skipping refresh - less than 6 hours since last refresh')
      const currentCached = cachedLeadsRef.current
      if (currentCached.length > 0) {
        setLeads(currentCached)
      }
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Fetch leads from API - it already filters for accounts with Google Sheets URLs
      // No need to filter again based on localStorage (database is single source of truth)
      const { leads: allLeads, lastSyncAt } = await fetchLeadsFromApi()
      setLeads(allLeads)
      const refreshTime = saveLeadsToStorage(allLeads, lastSyncAt)
      setLastRefresh(refreshTime)

      // Keep account lead counts in sync (so "Leads: X" badges update across the app).
      syncAccountLeadCountsFromLeads(allLeads)

      // Group leads by account for summary
      const leadsByAccount: Record<string, number> = {}
      allLeads.forEach(lead => {
        leadsByAccount[lead.accountName] = (leadsByAccount[lead.accountName] || 0) + 1
      })
      console.log(`✅ Leads loaded by account:`, leadsByAccount)

      const description = `Loaded ${allLeads.length} leads from the server.`
      toast({
        title: 'Leads loaded successfully',
        description,
        status: 'success',
        duration: 5000,
        isClosable: true,
      })
    } catch (err) {
      const currentCached = cachedLeadsRef.current
      if (currentCached.length > 0) {
        setLeads(currentCached)
      }
      setError('Failed to load leads data from the server.')
      console.error('Error loading leads:', err)
      const now = Date.now()
      if (now - lastErrorToastAtRef.current > 60000) {
        toast({
          title: 'Error loading leads',
          description: 'Failed to fetch data from the server. Please try again.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
        lastErrorToastAtRef.current = now
      }
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    // Only load fresh data on mount if 6 hours have passed since last refresh
    // Otherwise, use cached data
    loadLeads(false)

    // Listen for account updates (when new accounts are created or metadata changes)
    const handleAccountsUpdated = (event?: Event) => {
      console.log('📥 Accounts updated event received - refreshing leads...', event)
      // Force refresh when accounts are updated to keep lead counts current
      // API will handle filtering for accounts with Google Sheets URLs
      loadLeads(true)
    }

    const offAccountsUpdated = on('accountsUpdated', () => handleAccountsUpdated())

    // Auto-refresh every 30 minutes
    const refreshInterval = setInterval(() => {
      loadLeads(false)
    }, 30 * 60 * 1000) // 30 minutes in milliseconds

    return () => {
      offAccountsUpdated()
      clearInterval(refreshInterval)
    }
  }, [loadLeads])

  // Get all unique column headers from all leads (excluding accountName)
  const allColumns = new Set<string>()
  leads.forEach((lead) => {
    Object.keys(lead).forEach((key) => {
      if (key !== 'accountName') {
        allColumns.add(key)
      }
    })
  })

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

  // Account-specific performance analytics
  const accountPerformance = useMemo(() => {
    try {
      if (!performanceAccountFilter) return null

      const accountsData = loadAccountsFromStorage()
      const account = accountsData.find((acc) => acc.name === performanceAccountFilter)
      if (!account) return null

      const accountLeads = leads.filter((lead) => lead.accountName === performanceAccountFilter)
      
      // Enhanced date field detection - check all fields for date patterns first
      const leadsWithDates: LeadWithDate[] = accountLeads
        .map((lead) => {
          let dateValue = ''
          let dateFieldName = ''
          
          // FIRST: Check ALL fields for DD.MM.YY format (like "05.01.26")
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

      // Calculate daily target with division by zero protection
      const dailyTargetFromWeekly = account.weeklyTarget && account.weeklyTarget > 0 ? account.weeklyTarget / 7 : 0
      const dailyTargetFromMonthly = account.monthlyTarget && account.monthlyTarget > 0 && daysInMonth > 0 ? account.monthlyTarget / daysInMonth : 0
      const dailyTarget = dailyTargetFromWeekly > 0 ? dailyTargetFromWeekly : dailyTargetFromMonthly

      const periodMetrics = {
        today: {
          label: 'Today',
          ...computeMetrics(startOfToday, endOfToday),
          target: Math.max(Math.round(dailyTarget || 0), 0),
        },
        week: {
          label: 'This Week',
          ...computeMetrics(currentWeekStart, currentWeekEnd),
          target: Math.max(Math.round(account.weeklyTarget || 0), 0),
        },
        month: {
          label: 'This Month',
          ...computeMetrics(monthStart, monthEnd),
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
  }, [leads, performanceAccountFilter])

  // Get all leads for the selected account (for detailed table)
  const accountPerformanceLeads = useMemo(() => {
    if (!performanceAccountFilter) return []
    return leads
      .filter((lead) => lead.accountName === performanceAccountFilter)
      .sort((a, b) => {
        // Sort by date (most recent first)
        const dateA = parseDate(a['Date'] || a['Week'] || '')
        const dateB = parseDate(b['Date'] || b['Week'] || '')
        if (!dateA && !dateB) return 0
        if (!dateA) return 1
        if (!dateB) return -1
        return dateB.getTime() - dateA.getTime()
      })
  }, [leads, performanceAccountFilter])

  // Get unique values for filter dropdowns
  const uniqueAccounts = Array.from(new Set(leads.map((lead) => lead.accountName))).sort()

  if (loading && leads.length === 0) {
    return (
      <Box textAlign="center" py={12}>
        <Spinner size="xl" color="brand.700" thickness="4px" />
        <Text mt={4} color="gray.600">
          Loading leads data from the server...
        </Text>
      </Box>
    )
  }

  if (error && leads.length === 0) {
    return (
      <Alert status="error" borderRadius="lg">
        <AlertIcon />
        <Box>
          <AlertTitle>Error loading leads</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Box>
      </Alert>
    )
  }

  return (
    <Stack spacing={{ base: 4, md: 6, lg: 8 }} px={{ base: 0, md: 0 }} pb={8}>
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
              All leads from customer data ({leads.length} leads)
            </Text>
            <Text fontSize="xs" color="gray.500" mt={2}>
              Last refreshed: {formatLastRefresh(lastRefresh)} • Auto-refreshes every 30 minutes
            </Text>
          </Box>
          <IconButton
            aria-label="Refresh leads data"
            icon={<RepeatIcon />}
            onClick={() => loadLeads(true)}
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
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={{ base: 3, md: 4 }}>
          {(['today', 'week', 'month'] as const).map((periodKey) => {
            const period = unifiedAnalytics.periodMetrics[periodKey]
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
                    borderColor="border.subtle"
                    borderRadius="lg"
                    p={4}
                    bg="bg.subtle"
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
                              <Badge variant="subtle" colorScheme="gray" fontSize="xs">
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
                              <Badge variant="subtle" colorScheme="gray" fontSize="xs">
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
                            No leads found for this account
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
                    Total Leads: <Badge colorScheme="blue" ml={2}>{accountPerformanceLeads.length}</Badge>
                  </Text>
                  <Text fontSize="xs" color="gray.600">
                    Account: {performanceAccountFilter}
                  </Text>
                </HStack>
              </Box>
            )}
          </Box>
        )}
      </Box>

      {error && leads.length > 0 && (
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
  )
}

export default MarketingLeadsTab

