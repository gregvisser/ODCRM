import { useEffect, useMemo, useState, type ReactNode } from 'react'
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
  Icon,
} from '@chakra-ui/react'
import { ExternalLinkIcon, RepeatIcon } from '@chakra-ui/icons'
import { MdArrowUpward, MdArrowDownward } from 'react-icons/md'
import { accounts as defaultAccounts, type Account } from './AccountsTab'
import { ExportImportButtons } from './ExportImportButtons'
import { syncAccountLeadCountsFromLeads } from '../utils/accountsLeadsSync'
import { emit, on } from '../platform/events'
import { OdcrmStorageKeys } from '../platform/keys'
import { getItem, getJson, setItem, setJson } from '../platform/storage'

// Load accounts from storage (includes any edits made through the UI)
function loadAccountsFromStorage(): Account[] {
  const parsed = getJson<Account[]>(OdcrmStorageKeys.accounts)
  if (parsed && Array.isArray(parsed) && parsed.length > 0) return parsed
  return defaultAccounts // fallback if storage empty or invalid
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
function saveLeadsToStorage(leads: Lead[]) {
  setJson(OdcrmStorageKeys.marketingLeads, leads)
  const nowIso = new Date().toISOString()
  setItem(OdcrmStorageKeys.marketingLeadsLastRefresh, nowIso)

  // Keep the shared leads store in sync so Accounts tab / account cards can read the same data.
  // (AccountsTab reads `odcrm_leads` for per-account lead counts + weekly/monthly actuals.)
  setJson(OdcrmStorageKeys.leads, leads)
  setItem(OdcrmStorageKeys.leadsLastRefresh, nowIso)
}

// Load last refresh time from storage
function loadLastRefreshFromStorage(): Date | null {
  const stored = getItem(OdcrmStorageKeys.marketingLeadsLastRefresh)
  if (!stored) return null
  const d = new Date(stored)
  return isNaN(d.getTime()) ? null : d
}

// Extract sheet ID from Google Sheets URL
function extractSheetId(url: string): string | null {
  try {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

// Extract gid (sheet tab ID) from Google Sheets URL
function extractGid(url: string): string | null {
  try {
    // Try to extract gid from URL parameters or hash
    // Format can be: ?gid=123 or &gid=123 or #gid=0
    const gidMatch = url.match(/(?:[?&#])gid=(\d+)/i)
    return gidMatch ? gidMatch[1] : null
  } catch {
    return null
  }
}

// Parse CSV data
function parseCsv(csvText: string): string[][] {
  const lines: string[][] = []
  let currentLine: string[] = []
  let currentField = ''
  let inQuotes = false

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i]
    const nextChar = csvText[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"'
        i++ // Skip next quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      currentLine.push(currentField.trim())
      currentField = ''
    } else if (char === '\n' && !inQuotes) {
      currentLine.push(currentField.trim())
      currentField = ''
      if (currentLine.length > 0) {
        lines.push(currentLine)
        currentLine = []
      }
    } else {
      currentField += char
    }
  }

  if (currentField || currentLine.length > 0) {
    currentLine.push(currentField.trim())
    lines.push(currentLine)
  }

  return lines
}

// Fetch leads from a Google Sheet
async function fetchLeadsFromSheet(
  sheetUrl: string,
  accountName: string,
): Promise<Lead[]> {
  const sheetId = extractSheetId(sheetUrl)
  if (!sheetId) {
    throw new Error('Invalid Google Sheets URL format')
  }

  // Try to extract gid from URL, otherwise use '0'
  const extractedGid = extractGid(sheetUrl)
  const gidsToTry = extractedGid ? [extractedGid, '0'] : ['0']
  
  let lastError: Error | null = null
  
  // Try with extracted gid first, then fallback to '0'
  for (const gid of gidsToTry) {
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
      
      let response: Response
      try {
        response = await fetch(csvUrl, {
          mode: 'cors',
          headers: {
            'Accept': 'text/csv, text/plain, */*',
          },
          credentials: 'omit', // Don't send credentials for public sheets
        })
      } catch (networkError) {
        // Handle network errors (CORS, connection issues, etc.)
        if (networkError instanceof TypeError && networkError.message.includes('Failed to fetch')) {
          lastError = new Error('Network error: Sheet may not be publicly accessible or CORS is blocked. Please ensure the sheet is shared as "Anyone with the link can view"')
          continue // Try next gid
        }
        lastError = new Error(`Network error: ${networkError instanceof Error ? networkError.message : 'Unknown network error'}`)
        continue
      }

      if (!response.ok) {
        if (response.status === 403) {
          lastError = new Error('Sheet is not publicly accessible. Please set sharing to "Anyone with the link can view"')
          continue
        } else if (response.status === 404) {
          lastError = new Error('Sheet not found. Please check the URL is correct')
          continue
        } else {
          lastError = new Error(`Failed to fetch: ${response.status} ${response.statusText}`)
          continue
        }
      }

      const csvText = await response.text()
      
      // Check if we got an HTML error page instead of CSV
      if (csvText.trim().startsWith('<!DOCTYPE') || csvText.trim().startsWith('<html')) {
        lastError = new Error('Received HTML instead of CSV. The sheet may not be publicly accessible. Please ensure the sheet is shared as "Anyone with the link can view"')
        continue
      }
      
      const rows = parseCsv(csvText)

      if (rows.length < 2) {
        return [] // No data rows
      }

      const headers = rows[0].map((h) => h.trim())
      const leads: Lead[] = []

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        if (row.length === 0 || row.every((cell) => !cell || cell.trim() === '')) {
          continue // Skip empty rows
        }

        const lead: Lead = {
          accountName,
        }

        // Map all columns dynamically using original header names
        headers.forEach((header, index) => {
          const value = row[index] || ''
          // Use original header name as key, preserving exact field names
          if (header) {
            lead[header] = value
          }
        })

        // Skip rows that contain "w/c" or "w/v" in any field (case-insensitive)
        const containsWcOrWv = Object.values(lead).some(
          (value) => {
            const lowerValue = value ? String(value).toLowerCase() : ''
            return lowerValue.includes('w/c') || lowerValue.includes('w/v')
          }
        )
        if (containsWcOrWv) {
          continue // Skip this row
        }

        // Skip rows where both Name and Company columns are empty
        const nameValue = lead['Name'] || lead['name'] || ''
        const companyValue = lead['Company'] || lead['company'] || ''
        const hasName = nameValue && nameValue.trim() !== ''
        const hasCompany = companyValue && companyValue.trim() !== ''
        if (!hasName && !hasCompany) {
          continue
        }

        // Check if row has any meaningful data (at least 2 non-empty fields besides accountName)
        const nonEmptyFields = Object.keys(lead).filter(
          (key) => key !== 'accountName' && lead[key] && lead[key].trim() !== '',
        )

        // Only include rows with at least 2 fields of data (to filter out mostly empty rows)
        if (nonEmptyFields.length >= 2) {
          leads.push(lead)
        }
      }

      // Success! Return the leads
      return leads
    } catch (parseError) {
      // If parsing failed, try next gid
      lastError = parseError instanceof Error ? parseError : new Error('Failed to parse CSV data')
      continue
    }
  }
  
  // If we get here, all attempts failed
  console.error(`Error fetching leads for ${accountName}:`, lastError)
  throw lastError || new Error('Failed to fetch leads from Google Sheet')
}

type LeadWithDate = {
  data: Lead
  parsedDate: Date
}

function MarketingLeadsTab({ focusAccountName }: { focusAccountName?: string }) {
  // Load initial leads from localStorage
  const cachedLeads = loadLeadsFromStorage()
  const [leads, setLeads] = useState<Lead[]>(cachedLeads)
  const [loading, setLoading] = useState(cachedLeads.length === 0) // Show loading if no cached data
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
  const [sortConfig, setSortConfig] = useState<{
    column: string | null
    direction: 'asc' | 'desc'
  }>({
    column: 'Date',
    direction: 'desc',
  })
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

  // Check if 6 hours have passed since last refresh
  const shouldRefresh = (): boolean => {
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
  }

  const loadLeads = async (forceRefresh: boolean = false) => {
    // Check if we should refresh (unless forced)
    if (!forceRefresh && !shouldRefresh()) {
      console.log('Skipping refresh - less than 6 hours since last refresh')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Load accounts from localStorage to get the latest data including any Google Sheets URLs added through UI
      const accountsToUse = loadAccountsFromStorage()
      const allLeads: Lead[] = []

      const failedAccounts: Array<{ name: string; error: string }> = []
      
      for (const account of accountsToUse) {
        if (account.clientLeadsSheetUrl) {
          try {
            console.log(`📊 Fetching leads for account: ${account.name} from ${account.clientLeadsSheetUrl}`)
            const accountLeads = await fetchLeadsFromSheet(
              account.clientLeadsSheetUrl,
              account.name,
            )
            console.log(`✅ Loaded ${accountLeads.length} leads for ${account.name}`)
            allLeads.push(...accountLeads)
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error'
            console.error(`❌ Failed to load leads for ${account.name}:`, err)
            failedAccounts.push({ name: account.name, error: errorMessage })
          }
        } else {
          console.log(`⏭️ Skipping ${account.name} - no Google Sheet URL configured`)
        }
      }
      
      // Show summary toast if there were any failures
      if (failedAccounts.length > 0) {
        const failedNames = failedAccounts.map(a => a.name).join(', ')
        toast({
          title: `Failed to load leads for ${failedAccounts.length} account${failedAccounts.length !== 1 ? 's' : ''}`,
          description: `${failedNames}. Please ensure the Google Sheets are publicly accessible (File > Share > Anyone with the link can view).`,
          status: 'error',
          duration: 8000,
          isClosable: true,
        })
      }

      setLeads(allLeads)
      const refreshTime = new Date()
      setLastRefresh(refreshTime)
      
      // Save to localStorage
      saveLeadsToStorage(allLeads)

      // Keep account lead counts in sync (so "Leads: X" badges update across the app).
      syncAccountLeadCountsFromLeads(allLeads)
      
      // Dispatch event to update accounts with new actuals
      emit('leadsUpdated')
      
      const accountsWithSheets = accountsToUse.filter(a => a.clientLeadsSheetUrl)
      const accountsWithoutSheets = accountsToUse.filter(a => !a.clientLeadsSheetUrl)
      
      // Log summary for debugging
      console.log(`📊 Lead Loading Summary:`)
      console.log(`   Total accounts: ${accountsToUse.length}`)
      console.log(`   Accounts with Google Sheets: ${accountsWithSheets.length}`)
      console.log(`   Accounts without Google Sheets: ${accountsWithoutSheets.length}`)
      console.log(`   Total leads loaded: ${allLeads.length}`)
      if (accountsWithoutSheets.length > 0) {
        console.log(`   Accounts without sheets: ${accountsWithoutSheets.map(a => a.name).join(', ')}`)
      }
      
      // Group leads by account for summary
      const leadsByAccount: Record<string, number> = {}
      allLeads.forEach(lead => {
        leadsByAccount[lead.accountName] = (leadsByAccount[lead.accountName] || 0) + 1
      })
      console.log(`   Leads by account:`, leadsByAccount)
      
      let description = `Loaded ${allLeads.length} leads from ${accountsWithSheets.length} account${accountsWithSheets.length !== 1 ? 's' : ''}`
      if (accountsWithoutSheets.length > 0) {
        description += `. ${accountsWithoutSheets.length} account${accountsWithoutSheets.length !== 1 ? 's' : ''} without Google Sheets configured.`
      }
      
      toast({
        title: 'Leads loaded successfully',
        description,
        status: 'success',
        duration: 5000,
        isClosable: true,
      })
    } catch (err) {
      setError('Failed to load leads data. Please check that the Google Sheets are publicly accessible.')
      console.error('Error loading leads:', err)
      toast({
        title: 'Error loading leads',
        description: 'Failed to fetch data from Google Sheets. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Only load fresh data on mount if 6 hours have passed since last refresh
    // Otherwise, use cached data
    loadLeads(false)

    // Listen for account updates (when new accounts are created or Google Sheets URLs are added/updated)
    const handleAccountsUpdated = (event?: Event) => {
      console.log('📥 Accounts updated event received - refreshing leads...', event)
      // Force refresh when accounts are updated to pick up new Google Sheets
      // This ensures newly created accounts with Google Sheets URLs are immediately loaded
      loadLeads(true)
    }

    const offAccountsUpdated = on('accountsUpdated', () => handleAccountsUpdated())

    // Auto-refresh every 6 hours
    const refreshInterval = setInterval(() => {
      loadLeads(false)
    }, 6 * 60 * 60 * 1000) // 6 hours in milliseconds

    return () => {
      offAccountsUpdated()
      clearInterval(refreshInterval)
    }
  }, [])

  if (loading && leads.length === 0) {
    return (
      <Box textAlign="center" py={12}>
        <Spinner size="xl" color="brand.700" thickness="4px" />
        <Text mt={4} color="gray.600">
          Loading leads data from Google Sheets...
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

  // Handle column sorting
  const handleSort = (column: string) => {
    setSortConfig((prev) => {
      if (prev.column === column) {
        // Toggle direction if clicking the same column
        return {
          column,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        }
      }
      // New column, default to ascending
      return {
        column,
        direction: 'asc',
      }
    })
  }

  // Helper to parse dates in various formats
  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr || dateStr.trim() === '') return null
    
    // Try DD.MM.YY or DD.MM.YYYY format (from the Google Sheet)
    const ddmmyy = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/)
    if (ddmmyy) {
      const day = parseInt(ddmmyy[1], 10)
      const month = parseInt(ddmmyy[2], 10) - 1
      const year = parseInt(ddmmyy[3], 10) < 100 ? 2000 + parseInt(ddmmyy[3], 10) : parseInt(ddmmyy[3], 10)
      return new Date(year, month, day)
    }
    
    // Try standard date parsing
    const parsed = new Date(dateStr)
    return isNaN(parsed.getTime()) ? null : parsed
  }

  // Helper to compare values for sorting
  const compareValues = (a: string, b: string, column: string): number => {
    // Special handling for date columns
    if (column === 'Date' || column === 'First Meeting Date' || column === 'Closed Date') {
      const dateA = parseDate(a)
      const dateB = parseDate(b)
      
      if (!dateA && !dateB) return 0
      if (!dateA) return 1 // Put dates without valid date at the end
      if (!dateB) return -1
      
      return dateA.getTime() - dateB.getTime()
    }
    
    // Numeric comparison for numeric columns
    const numA = parseFloat(a)
    const numB = parseFloat(b)
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB
    }
    
    // String comparison
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  }

  // Unified analytics across all accounts
  const unifiedAnalytics = useMemo(() => {
    const accountsData = loadAccountsFromStorage()
    
    // Calculate total targets across all accounts
    const totalWeeklyTarget = accountsData.reduce((sum, acc) => sum + (acc.weeklyTarget || 0), 0)
    const totalMonthlyTarget = accountsData.reduce((sum, acc) => sum + (acc.monthlyTarget || 0), 0)
    
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfToday = new Date(startOfToday)
    endOfToday.setDate(endOfToday.getDate() + 1)

    // Current week: Monday -> next Monday (exclusive)
    const currentWeekStart = new Date(startOfToday)
    const day = currentWeekStart.getDay()
    const diff = day === 0 ? -6 : 1 - day
    currentWeekStart.setDate(currentWeekStart.getDate() + diff)
    const currentWeekEnd = new Date(currentWeekStart)
    currentWeekEnd.setDate(currentWeekEnd.getDate() + 7)

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1) // exclusive (start of next month)
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()

    // Calculate daily target from weekly/monthly
    const dailyTargetFromWeekly = totalWeeklyTarget / 7
    const dailyTargetFromMonthly = totalMonthlyTarget / daysInMonth
    const dailyTarget = dailyTargetFromWeekly > 0 ? dailyTargetFromWeekly : dailyTargetFromMonthly

    // Process all leads (not filtered by account)
    const leadsWithDates: LeadWithDate[] = leads
      .map((lead) => {
        const dateValue =
          lead['Date'] ||
          lead['date'] ||
          lead['Week'] ||
          lead['week'] ||
          lead['First Meeting Date'] ||
          ''
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
        if (entry.parsedDate >= start && entry.parsedDate < end) {
          actual += 1
          const channel = entry.data['Channel of Lead'] || entry.data['channel of lead'] || ''
          const normalizedSource = normalizeLeadSource(channel)
          if (normalizedSource) {
            breakdown[normalizedSource] = (breakdown[normalizedSource] || 0) + 1
          } else if (channel) {
            // Also track non-normalized channels
            breakdown[channel] = (breakdown[channel] || 0) + 1
          }

          // OD Team Member breakdown
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

    const periodMetrics = {
      today: {
        label: 'Today',
        ...computeMetrics(startOfToday, endOfToday),
        target: Math.max(Math.round(dailyTarget), 0),
      },
      week: {
        label: 'This Week',
        ...computeMetrics(currentWeekStart, currentWeekEnd),
        target: Math.max(Math.round(totalWeeklyTarget), 0),
      },
      month: {
        label: 'This Month',
        ...computeMetrics(monthStart, monthEnd),
        target: Math.max(Math.round(totalMonthlyTarget), 0),
      },
    }

    return { periodMetrics }
  }, [leads])

  // Account-specific performance analytics
  const accountPerformance = useMemo(() => {
    if (!performanceAccountFilter) return null

    const accountsData = loadAccountsFromStorage()
    const account = accountsData.find((acc) => acc.name === performanceAccountFilter)
    if (!account) return null

    const accountLeads = leads.filter((lead) => lead.accountName === performanceAccountFilter)
    const leadsWithDates: LeadWithDate[] = accountLeads
      .map((lead) => {
        const dateValue =
          lead['Date'] ||
          lead['date'] ||
          lead['Week'] ||
          lead['week'] ||
          lead['First Meeting Date'] ||
          ''
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

    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfToday = new Date(startOfToday)
    endOfToday.setDate(endOfToday.getDate() + 1)

    // Current week: Monday -> next Monday (exclusive)
    const currentWeekStart = new Date(startOfToday)
    const day = currentWeekStart.getDay()
    const diff = day === 0 ? -6 : 1 - day
    currentWeekStart.setDate(currentWeekStart.getDate() + diff)
    const currentWeekEnd = new Date(currentWeekStart)
    currentWeekEnd.setDate(currentWeekEnd.getDate() + 7)

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1) // exclusive (start of next month)
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()

    const computeMetrics = (start: Date, end: Date) => {
      const breakdown: Record<string, number> = {}
      const teamBreakdown: Record<string, number> = {}
      let actual = 0

      leadsWithDates.forEach((entry) => {
        if (entry.parsedDate >= start && entry.parsedDate < end) {
          actual += 1
          const channel = entry.data['Channel of Lead'] || entry.data['channel of lead'] || ''
          const normalizedSource = normalizeLeadSource(channel)
          if (normalizedSource) {
            breakdown[normalizedSource] = (breakdown[normalizedSource] || 0) + 1
          } else if (channel) {
            breakdown[channel] = (breakdown[channel] || 0) + 1
          }

          // OD Team Member breakdown
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

    const dailyTargetFromWeekly = account.weeklyTarget ? account.weeklyTarget / 7 : 0
    const dailyTargetFromMonthly = account.monthlyTarget ? account.monthlyTarget / daysInMonth : 0
    const dailyTarget = dailyTargetFromWeekly > 0 ? dailyTargetFromWeekly : dailyTargetFromMonthly

    const periodMetrics = {
      today: {
        label: 'Today',
        ...computeMetrics(startOfToday, endOfToday),
        target: Math.max(Math.round(dailyTarget), 0),
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
  }, [leads, performanceAccountFilter])

  // Filter leads based on filter criteria
  const filteredLeads = leads
    .filter((lead) => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        const searchableText = Object.values(lead)
          .join(' ')
          .toLowerCase()
        if (!searchableText.includes(searchLower)) return false
      }
      return true
    })
    .sort((a, b) => {
      if (!sortConfig.column) return 0
      
      const column = sortConfig.column === 'Account' ? 'accountName' : sortConfig.column
      const valueA = a[column] || ''
      const valueB = b[column] || ''
      
      const comparison = compareValues(String(valueA), String(valueB), sortConfig.column)
      
      return sortConfig.direction === 'asc' ? comparison : -comparison
    })

  // Get unique values for filter dropdowns
  const uniqueAccounts = Array.from(new Set(leads.map((lead) => lead.accountName))).sort()
  
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

  return (
    <Stack spacing={6}>
      <HStack justify="space-between" align="flex-start" flexWrap="wrap" spacing={4}>
        <Box flex="1" minW="200px">
          <Heading size="lg" mb={2}>
            Marketing Leads
          </Heading>
          <Text color="gray.600">
            All leads from customer Google Sheets ({filteredLeads.length} of {leads.length} leads)
          </Text>
          <Text fontSize="xs" color="gray.500" mt={1}>
            Last refreshed: {formatLastRefresh(lastRefresh)} • Auto-refreshes every 6 hours
          </Text>
        </Box>
        <HStack spacing={2} flexWrap="wrap">
          <ExportImportButtons
            data={filteredLeads}
            filename="marketing-leads"
            onImport={(importedLeads) => {
              setLeads(importedLeads)
              saveLeadsToStorage(importedLeads)
              syncAccountLeadCountsFromLeads(importedLeads)
              // Dispatch event to update accounts with new actuals
              emit('leadsUpdated')
              toast({
                title: 'Leads imported',
                description: `${importedLeads.length} leads loaded successfully.`,
                status: 'success',
                duration: 3000,
                isClosable: true,
              })
            }}
            size="sm"
          />
          <IconButton
            aria-label="Refresh leads data"
            icon={<RepeatIcon />}
            onClick={() => loadLeads(true)}
            isLoading={loading}
            variant="ghost"
            colorScheme="gray"
            size="sm"
          />
        </HStack>
      </HStack>

      {/* Unified Analytics Kanban Card */}
      <Box
        minW="280px"
        bg="bg.surface"
        borderRadius="lg"
        p={4}
        border="1px solid"
        borderColor="border.subtle"
        shadow="sm"
      >
        <HStack justify="space-between" mb={4}>
          <Box>
            <Text fontSize="xs" textTransform="uppercase" color="gray.500" fontWeight="semibold">
              Unified Lead Performance
            </Text>
            <Heading size="md" color="gray.700">
              All Accounts Combined
            </Heading>
          </Box>
          <Text fontSize="sm" color="gray.500">
            {new Date().toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </Text>
        </HStack>
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
          {(['today', 'week', 'month'] as const).map((periodKey) => {
            const period = unifiedAnalytics.periodMetrics[periodKey]
            const variance = period.actual - period.target
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
                  {period.actual}
                </Heading>
                <Text fontSize="sm" color="gray.600">
                  Actual Leads
                </Text>
                <Stack spacing={1} mt={3} fontSize="sm">
                  <Text color="gray.600">
                    Target Leads:{' '}
                    <Text as="span" fontWeight="semibold">
                      {period.target}
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
      </Box>

      {/* Account Performance Filter Section */}
      <Box p={4} bg="bg.surface" borderRadius="lg" border="1px solid" borderColor="border.subtle">
        <Heading size="sm" mb={4}>
          Account Performance
        </Heading>
        <Box mb={4}>
          <Text fontSize="xs" textTransform="uppercase" color="gray.500" mb={2} fontWeight="semibold">
            Select Account
          </Text>
          <Select
            placeholder="Choose an account to view performance"
            value={performanceAccountFilter}
            onChange={(e) => setPerformanceAccountFilter(e.target.value)}
            size="sm"
            maxW="400px"
          >
            {uniqueAccounts.map((account) => (
              <option key={account} value={account}>
                {account}
              </option>
            ))}
          </Select>
        </Box>

        {accountPerformance && (
          <Box
            minW="280px"
            bg="bg.surface"
            borderRadius="lg"
            p={4}
            border="1px solid"
            borderColor="border.subtle"
            shadow="sm"
          >
            <HStack justify="space-between" mb={4}>
              <Box>
                <Text fontSize="xs" textTransform="uppercase" color="gray.500" fontWeight="semibold">
                  Account Lead Performance
                </Text>
                <Heading size="md" color="gray.700">
                  {accountPerformance.accountName}
                </Heading>
              </Box>
              <Text fontSize="sm" color="gray.500">
                {new Date().toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
            </HStack>
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
              {(['today', 'week', 'month'] as const).map((periodKey) => {
                const period = accountPerformance.periodMetrics[periodKey]
                const variance = period.actual - period.target
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
                      {period.actual}
                    </Heading>
                    <Text fontSize="sm" color="gray.600">
                      Actual Leads
                    </Text>
                    <Stack spacing={1} mt={3} fontSize="sm">
                      <Text color="gray.600">
                        Target Leads:{' '}
                        <Text as="span" fontWeight="semibold">
                          {period.target}
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
          </Box>
        )}
      </Box>

      {error && leads.length > 0 && (
        <Alert status="warning" borderRadius="lg">
          <AlertIcon />
          <AlertDescription>
            Some data may be outdated. Last refresh attempt failed. Showing cached data.
          </AlertDescription>
        </Alert>
      )}

      {filteredLeads.length === 0 ? (
        <Box textAlign="center" py={12} bg="bg.surface" borderRadius="lg" border="1px solid" borderColor="border.subtle">
          <Text fontSize="lg" color="gray.600">
            No leads match the selected filters
          </Text>
          <Text fontSize="sm" color="gray.500" mt={2}>
            Try adjusting your filters or clear them to see all leads
          </Text>
        </Box>
      ) : (
        <Box
          overflowX="auto"
          overflowY="auto"
          maxH="calc(100vh - 400px)"
          maxW="100%"
          border="1px solid"
          borderColor="border.subtle"
          borderRadius="lg"
          bg="bg.surface"
        >
          <Table variant="simple" size="sm" minW="max-content">
            <Thead bg="bg.subtle" position="sticky" top={0} zIndex={10}>
              <Tr>
                <Th 
                  whiteSpace="nowrap" 
                  px={3} 
                  py={2} 
                  bg="bg.subtle" 
                  position="sticky" 
                  left={0} 
                  zIndex={11}
                  cursor="pointer"
                  userSelect="none"
                  onClick={() => handleSort('Account')}
                  _hover={{ bg: 'gray.100' }}
                >
                  <HStack spacing={1}>
                    <Text>Account</Text>
                    {sortConfig.column === 'Account' && (
                      <Icon as={sortConfig.direction === 'asc' ? MdArrowUpward : MdArrowDownward} boxSize={4} />
                    )}
                  </HStack>
                </Th>
                {columns.map((col) => (
                  <Th 
                    key={col} 
                    whiteSpace="nowrap" 
                    px={3} 
                    py={2} 
                    bg="bg.subtle"
                    cursor="pointer"
                    userSelect="none"
                    onClick={() => handleSort(col)}
                    _hover={{ bg: 'bg.subtle' }}
                  >
                    <HStack spacing={1}>
                      <Text>{col}</Text>
                      {sortConfig.column === col && (
                        <Icon as={sortConfig.direction === 'asc' ? MdArrowUpward : MdArrowDownward} boxSize={4} />
                      )}
                    </HStack>
                  </Th>
                ))}
              </Tr>
            </Thead>
            <Tbody>
              {filteredLeads.map((lead, index) => (
                <Tr
                  key={`${lead.accountName}-${index}`}
                  _hover={{ bg: 'bg.subtle' }}
                >
                  <Td
                    px={3}
                    py={2}
                    position="sticky"
                    left={0}
                    bg="bg.surface"
                    zIndex={5}
                    _hover={{ bg: 'bg.subtle' }}
                    sx={{
                      'tr:hover &': {
                        bg: 'bg.subtle',
                      },
                    }}
                  >
                    <Badge variant="subtle" colorScheme="gray">{lead.accountName}</Badge>
                  </Td>
                  {columns.map((col) => {
                    // Get value from lead object using the column name
                    const value = lead[col] || ''
                    return (
                      <Td key={col} px={3} py={2} whiteSpace="normal" maxW="300px">
                        {formatCell(value, col)}
                      </Td>
                    )
                  })}
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}
    </Stack>
  )
}

export default MarketingLeadsTab

