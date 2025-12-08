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
  Tag,
  TagLabel,
  TagCloseButton,
  Button,
  Input,
  InputGroup,
  InputLeftElement,
  Icon,
} from '@chakra-ui/react'
import { ExternalLinkIcon, RepeatIcon, SearchIcon } from '@chakra-ui/icons'
import { MdArrowUpward, MdArrowDownward } from 'react-icons/md'
import { accounts as defaultAccounts, type Account } from './AccountsTab'
import { ExportImportButtons } from './ExportImportButtons'

// Load accounts from localStorage (includes any edits made through the UI)
function loadAccountsFromStorage(): Account[] {
  try {
    const stored = localStorage.getItem('odcrm_accounts')
    if (stored) {
      const parsed = JSON.parse(stored) as Account[]
      // Merge with default accounts to ensure new accounts are included
      const loadedAccountNames = new Set(parsed.map(a => a.name))
      const newAccounts = defaultAccounts.filter(a => !loadedAccountNames.has(a.name))
      return [...parsed, ...newAccounts]
    }
  } catch (error) {
    console.warn('Failed to load accounts from localStorage:', error)
  }
  return defaultAccounts
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

// localStorage key for marketing leads
const STORAGE_KEY_MARKETING_LEADS = 'odcrm_marketing_leads'
const STORAGE_KEY_MARKETING_LEADS_LAST_REFRESH = 'odcrm_marketing_leads_last_refresh'

// Load leads from localStorage
function loadLeadsFromStorage(): Lead[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_MARKETING_LEADS)
    if (stored) {
      const parsed = JSON.parse(stored) as Lead[]
      return parsed
    }
  } catch (error) {
    console.warn('Failed to load marketing leads from localStorage:', error)
  }
  return []
}

// Save leads to localStorage
function saveLeadsToStorage(leads: Lead[]) {
  try {
    localStorage.setItem(STORAGE_KEY_MARKETING_LEADS, JSON.stringify(leads))
    localStorage.setItem(STORAGE_KEY_MARKETING_LEADS_LAST_REFRESH, new Date().toISOString())
  } catch (error) {
    console.warn('Failed to save marketing leads to localStorage:', error)
  }
}

// Load last refresh time from localStorage
function loadLastRefreshFromStorage(): Date | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_MARKETING_LEADS_LAST_REFRESH)
    if (stored) {
      return new Date(stored)
    }
  } catch (error) {
    console.warn('Failed to load last refresh time from localStorage:', error)
  }
  return null
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

// Convert Google Sheets URL to CSV export URL
function getCsvExportUrl(sheetUrl: string, gid: string = '0'): string | null {
  const sheetId = extractSheetId(sheetUrl)
  if (!sheetId) return null
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
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
  try {
    const csvUrl = getCsvExportUrl(sheetUrl)
    if (!csvUrl) {
      throw new Error('Invalid Google Sheets URL')
    }

    const response = await fetch(csvUrl, {
      mode: 'cors',
      headers: {
        'Accept': 'text/csv',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`)
    }

    const csvText = await response.text()
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

    return leads
  } catch (error) {
    console.error(`Error fetching leads for ${accountName}:`, error)
    throw error
  }
}

type LeadWithDate = {
  data: Lead
  parsedDate: Date
}

function MarketingLeadsTab() {
  // Load initial leads from localStorage
  const cachedLeads = loadLeadsFromStorage()
  const [leads, setLeads] = useState<Lead[]>(cachedLeads)
  const [loading, setLoading] = useState(cachedLeads.length === 0) // Show loading if no cached data
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(() => {
    const stored = loadLastRefreshFromStorage()
    return stored || new Date()
  })
  const [filters, setFilters] = useState({
    account: '',
    search: '',
  })
  const [sortConfig, setSortConfig] = useState<{
    column: string | null
    direction: 'asc' | 'desc'
  }>({
    column: 'Date',
    direction: 'desc',
  })
  const toast = useToast()

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

      for (const account of accountsToUse) {
        if (account.clientLeadsSheetUrl) {
          try {
            const accountLeads = await fetchLeadsFromSheet(
              account.clientLeadsSheetUrl,
              account.name,
            )
            allLeads.push(...accountLeads)
          } catch (err) {
            console.warn(`Failed to load leads for ${account.name}:`, err)
          }
        }
      }

      setLeads(allLeads)
      const refreshTime = new Date()
      setLastRefresh(refreshTime)
      
      // Save to localStorage
      saveLeadsToStorage(allLeads)
      
      const accountsWithSheets = accountsToUse.filter(a => a.clientLeadsSheetUrl)
      toast({
        title: 'Leads loaded successfully',
        description: `Loaded ${allLeads.length} leads from ${accountsWithSheets.length} account${accountsWithSheets.length !== 1 ? 's' : ''}`,
        status: 'success',
        duration: 3000,
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

    // Auto-refresh every 6 hours
    const refreshInterval = setInterval(() => {
      loadLeads(false)
    }, 6 * 60 * 60 * 1000) // 6 hours in milliseconds

    return () => {
      clearInterval(refreshInterval)
    }
  }, [])

  if (loading && leads.length === 0) {
    return (
      <Box textAlign="center" py={12}>
        <Spinner size="xl" color="teal.500" thickness="4px" />
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

  const selectedAccountName = filters.account

  const leadAnalytics = useMemo(() => {
    if (!selectedAccountName) {
      return null
    }

    const accountsData = loadAccountsFromStorage()
    const account = accountsData.find((acc) => acc.name === selectedAccountName)
    if (!account) {
      return null
    }

    const accountLeads = leads.filter((lead) => lead.accountName === selectedAccountName)
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

    const pastWeekStart = new Date(startOfToday)
    pastWeekStart.setDate(pastWeekStart.getDate() - 6)

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()

    const computeMetrics = (start: Date, end: Date) => {
      const breakdown: Record<string, number> = {}
      let actual = 0

      leadsWithDates.forEach((entry) => {
        if (entry.parsedDate >= start && entry.parsedDate < end) {
          actual += 1
          const normalizedSource = normalizeLeadSource(entry.data['Channel of Lead'])
          if (normalizedSource) {
            breakdown[normalizedSource] = (breakdown[normalizedSource] || 0) + 1
          }
        }
      })

      return { actual, breakdown }
    }

    const dailyTargetFromWeekly = account.weeklyTarget
      ? account.weeklyTarget / 7
      : 0
    const dailyTargetFromMonthly = account.monthlyTarget
      ? account.monthlyTarget / daysInMonth
      : 0

    const derivedDailyTarget =
      dailyTargetFromWeekly > 0
        ? dailyTargetFromWeekly
        : dailyTargetFromMonthly
    const roundedDailyTarget = Math.round(derivedDailyTarget)

    const weeklyTarget =
      account.weeklyTarget > 0
        ? account.weeklyTarget
        : Math.round(roundedDailyTarget * 7)

    const monthlyTarget =
      account.monthlyTarget > 0
        ? account.monthlyTarget
        : Math.round(roundedDailyTarget * daysInMonth)

    const periodMetrics = {
      today: {
        label: 'Today',
        ...computeMetrics(startOfToday, endOfToday),
        target: Math.max(roundedDailyTarget, 0),
      },
      week: {
        label: 'Past Week',
        ...computeMetrics(pastWeekStart, endOfToday),
        target: Math.max(weeklyTarget, 0),
      },
      month: {
        label: 'This Month',
        ...computeMetrics(monthStart, endOfToday),
        target: Math.max(monthlyTarget, 0),
      },
    }

    return {
      accountName: account.name,
      periodMetrics,
    }
  }, [leads, selectedAccountName])

  // Filter leads based on filter criteria
  const filteredLeads = leads
    .filter((lead) => {
      if (filters.account && lead.accountName !== filters.account) return false
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
  
  // Get accounts with Google Sheets configured for display
  const accountsWithSheets = loadAccountsFromStorage().filter(a => a.clientLeadsSheetUrl)

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
          <Link href={value} isExternal color="teal.600" display="inline-flex" alignItems="center" gap={1}>
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
            colorScheme="teal"
            size="sm"
          />
        </HStack>
      </HStack>

      {selectedAccountName ? (
        leadAnalytics ? (
          <Box
            p={4}
            bg="white"
            borderRadius="lg"
            border="1px solid"
            borderColor="gray.200"
          >
            <HStack justify="space-between" flexWrap="wrap" mb={4}>
              <Box>
                <Text fontSize="xs" textTransform="uppercase" color="gray.500" fontWeight="semibold">
                  Lead Performance
                </Text>
                <Heading size="md" color="gray.700">
                  {leadAnalytics.accountName}
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
                const period = leadAnalytics.periodMetrics[periodKey]
                const variance = period.actual - period.target
                const sourceBreakdown = LEAD_SOURCE_CATEGORIES.filter(
                  (source) => period.breakdown[source] > 0,
                )
                return (
                  <Box
                    key={periodKey}
                    border="1px solid"
                    borderColor="gray.200"
                    borderRadius="lg"
                    p={4}
                    bg="gray.50"
                    minH="260px"
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
                      <Text color={variance >= 0 ? 'teal.600' : 'red.600'}>
                        Variance:{' '}
                        <Text as="span" fontWeight="semibold">
                          {variance > 0 ? '+' : ''}
                          {variance}
                        </Text>
                      </Text>
                    </Stack>
                    <Box mt={4}>
                      <Text fontSize="xs" textTransform="uppercase" color="gray.500" fontWeight="semibold" mb={2}>
                        Breakdown by Source
                      </Text>
                      {sourceBreakdown.length > 0 ? (
                        <Stack spacing={1}>
                          {sourceBreakdown.map((source) => (
                            <Text key={source} fontSize="sm" color="gray.700">
                              • {source}:{' '}
                              <Text as="span" fontWeight="semibold">
                                {period.breakdown[source] ?? 0}
                              </Text>{' '}
                              leads
                            </Text>
                          ))}
                        </Stack>
                      ) : (
                        <Text fontSize="sm" color="gray.400">
                          No leads recorded
                        </Text>
                      )}
                    </Box>
                  </Box>
                )
              })}
            </SimpleGrid>
          </Box>
        ) : (
          <Alert status="info" borderRadius="lg">
            <AlertIcon />
            <AlertDescription>
              Select a valid account with leads to view the analytics dashboard.
            </AlertDescription>
          </Alert>
        )
      ) : (
        <Alert status="info" borderRadius="lg">
          <AlertIcon />
          <AlertDescription>
            Choose an account from the filter below to view the Kanban analytics dashboard.
          </AlertDescription>
        </Alert>
      )}

      <Box p={4} bg="white" borderRadius="lg" border="1px solid" borderColor="gray.200">
        <Heading size="sm" mb={4}>
          Filters
        </Heading>
        <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
          <Box>
            <Text fontSize="xs" textTransform="uppercase" color="gray.500" mb={2} fontWeight="semibold">
              Account
            </Text>
            <Select
              placeholder="All Accounts"
              value={filters.account}
              onChange={(e) => setFilters({ ...filters, account: e.target.value })}
              size="sm"
            >
              {uniqueAccounts.map((account) => (
                <option key={account} value={account}>
                  {account}
                </option>
              ))}
            </Select>
          </Box>

          <Box>
            <Text fontSize="xs" textTransform="uppercase" color="gray.500" mb={2} fontWeight="semibold">
              Search
            </Text>
            <InputGroup size="sm">
              <InputLeftElement pointerEvents="none">
                <SearchIcon color="gray.300" />
              </InputLeftElement>
              <Input
                placeholder="Search leads..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </InputGroup>
          </Box>
        </SimpleGrid>

        {(filters.account || filters.search) && (
          <HStack mt={4} flexWrap="wrap" spacing={2}>
            <Text fontSize="sm" color="gray.600" fontWeight="medium">
              Active filters:
            </Text>
            {filters.account && (
              <Tag colorScheme="teal" size="md">
                <TagLabel>Account: {filters.account}</TagLabel>
                <TagCloseButton onClick={() => setFilters({ ...filters, account: '' })} />
              </Tag>
            )}
            {filters.search && (
              <Tag colorScheme="teal" size="md">
                <TagLabel>Search: {filters.search}</TagLabel>
                <TagCloseButton onClick={() => setFilters({ ...filters, search: '' })} />
              </Tag>
            )}
            <Button
              size="xs"
              variant="ghost"
              colorScheme="gray"
              onClick={() => setFilters({ account: '', search: '' })}
            >
              Clear All
            </Button>
          </HStack>
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
        <Box textAlign="center" py={12} bg="white" borderRadius="lg" border="1px solid" borderColor="gray.200">
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
          borderColor="gray.200"
          borderRadius="lg"
          bg="white"
        >
          <Table variant="simple" size="sm" minW="max-content">
            <Thead bg="gray.50" position="sticky" top={0} zIndex={10}>
              <Tr>
                <Th 
                  whiteSpace="nowrap" 
                  px={3} 
                  py={2} 
                  bg="gray.50" 
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
                    bg="gray.50"
                    cursor="pointer"
                    userSelect="none"
                    onClick={() => handleSort(col)}
                    _hover={{ bg: 'gray.100' }}
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
                  _hover={{ bg: 'gray.50' }}
                >
                  <Td
                    px={3}
                    py={2}
                    position="sticky"
                    left={0}
                    bg="white"
                    zIndex={5}
                    _hover={{ bg: 'gray.50' }}
                    sx={{
                      'tr:hover &': {
                        bg: 'gray.50',
                      },
                    }}
                  >
                    <Badge colorScheme="teal">{lead.accountName}</Badge>
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

