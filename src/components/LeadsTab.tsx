import { useEffect, useState, type ReactNode } from 'react'
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
} from '@chakra-ui/react'
import { ExternalLinkIcon, RepeatIcon } from '@chakra-ui/icons'

type Lead = {
  [key: string]: string // Dynamic fields from Google Sheet
  accountName: string
}

// localStorage key for leads
const STORAGE_KEY_LEADS = 'odcrm_leads'
const STORAGE_KEY_LEADS_LAST_REFRESH = 'odcrm_leads_last_refresh'

// Load leads from localStorage
function loadLeadsFromStorage(): Lead[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_LEADS)
    if (stored) {
      const parsed = JSON.parse(stored) as Lead[]
      console.log('✅ Loaded leads from localStorage:', parsed.length)
      return parsed
    }
  } catch (error) {
    console.warn('Failed to load leads from localStorage:', error)
  }
  return []
}

// Save leads to localStorage
function saveLeadsToStorage(leads: Lead[]) {
  try {
    localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(leads))
    localStorage.setItem(STORAGE_KEY_LEADS_LAST_REFRESH, new Date().toISOString())
    console.log('💾 Saved leads to localStorage:', leads.length)
  } catch (error) {
    console.warn('Failed to save leads to localStorage:', error)
  }
}

// Load last refresh time from localStorage
function loadLastRefreshFromStorage(): Date | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_LEADS_LAST_REFRESH)
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

function LeadsTab() {
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
    channelOfLead: '',
  })
  const toast = useToast()

  // Helper to format last refresh time
  const formatLastRefresh = (date: Date) => {
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
    if (diff < 60) return `${diff} seconds ago`
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`
    return date.toLocaleTimeString()
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
      // Get updated accounts data from AccountsTab
      let accountsToUse: typeof import('./AccountsTab').accounts
      
      if ((window as any).__getAccounts) {
        accountsToUse = (window as any).__getAccounts()
      } else {
        const { accounts } = await import('./AccountsTab')
        accountsToUse = accounts
      }

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
    } catch (err) {
      setError('Failed to load leads data. Please check that the Google Sheets are publicly accessible.')
      console.error('Error loading leads:', err)
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

    // Listen for navigation events (but only refresh if 6 hours have passed)
    const handleNavigate = (event: CustomEvent) => {
      const accountName = event.detail?.accountName
      if (accountName) {
        // Only show toast and refresh if 6 hours have passed
        if (shouldRefresh()) {
          toast({
            title: 'Loading leads...',
            description: `Fetching leads for ${accountName}`,
            status: 'info',
            duration: 2000,
          })
          loadLeads(false)
        } else {
          toast({
            title: 'Using cached data',
            description: `Data will auto-refresh every 6 hours. Last refresh: ${formatLastRefresh(lastRefresh)}`,
            status: 'info',
            duration: 2000,
          })
        }
      }
    }

    // Listen for accounts updated event (but only refresh if 6 hours have passed)
    const handleAccountsUpdated = () => {
      console.log('Accounts updated, checking if refresh is needed...')
      if (shouldRefresh()) {
        console.log('6 hours have passed, reloading leads...')
        loadLeads(false)
      } else {
        console.log('Skipping refresh - less than 6 hours since last refresh')
      }
    }

    window.addEventListener('navigateToLeads', handleNavigate as EventListener)
    window.addEventListener('accountsUpdated', handleAccountsUpdated)

    return () => {
      clearInterval(refreshInterval)
      window.removeEventListener('navigateToLeads', handleNavigate as EventListener)
      window.removeEventListener('accountsUpdated', handleAccountsUpdated)
    }
  }, [toast, lastRefresh])

  if (loading) {
    return (
      <Box textAlign="center" py={12}>
        <Spinner size="xl" color="teal.500" thickness="4px" />
        <Text mt={4} color="gray.600">
          Loading leads data from Google Sheets...
        </Text>
      </Box>
    )
  }

  if (error) {
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

  if (leads.length === 0) {
    return (
      <Box textAlign="center" py={12}>
        <Text fontSize="lg" color="gray.600">
          No leads data available
        </Text>
        <Text fontSize="sm" color="gray.500" mt={2}>
          Configure Client Leads sheets in account settings to view leads data
        </Text>
      </Box>
    )
  }

  // Define the specific column order
  const columnOrder = [
    'Account',
    'Week',
    'Lead',
    'Date',
    'Channel of Lead',
    'Company',
    'Name',
    'Job Title',
    'Industry',
    'Contact Info',
    'OD Notes',
    'Link to Website',
    'OD Call Recording Available',
    'First Meeting Booked',
    'Outcome',
    'Client Notes',
    'Qualification',
    'Lead Status',
    'Pipeline Stage',
    'Closed Date',
  ]

  // Get all unique column headers from all leads (excluding accountName)
  const allColumns = new Set<string>()
  leads.forEach((lead) => {
    Object.keys(lead).forEach((key) => {
      if (key !== 'accountName') {
        allColumns.add(key)
      }
    })
  })

  // Build columns array: specified order first, then any remaining columns
  const orderedColumns: string[] = []
  const remainingColumns: string[] = []

  columnOrder.forEach((col) => {
    if (allColumns.has(col)) {
      orderedColumns.push(col)
    }
  })

  allColumns.forEach((col) => {
    if (!columnOrder.includes(col)) {
      remainingColumns.push(col)
    }
  })

  const columns = [...orderedColumns, ...remainingColumns.sort()]

  // Filter leads based on filter criteria
  const filteredLeads = leads
    .filter((lead) => {
      if (filters.account && lead.accountName !== filters.account) return false
      if (
        filters.channelOfLead &&
        lead['Channel of Lead']?.toLowerCase().includes(filters.channelOfLead.toLowerCase()) === false
      )
        return false
      return true
    })
    .sort((a, b) => {
      // Sort by date (newest to oldest)
      const dateA = a['Date'] || ''
      const dateB = b['Date'] || ''
      
      // Try to parse dates in various formats
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

      const dateAObj = parseDate(dateA)
      const dateBObj = parseDate(dateB)

      if (!dateAObj && !dateBObj) return 0
      if (!dateAObj) return 1 // Put dates without valid date at the end
      if (!dateBObj) return -1
      
      // Newest first (descending order)
      return dateBObj.getTime() - dateAObj.getTime()
    })

  // Get unique values for filter dropdowns
  const uniqueAccounts = Array.from(new Set(leads.map((lead) => lead.accountName))).sort()
  const uniqueChannels = Array.from(
    new Set(
      leads.map((lead) => lead['Channel of Lead']).filter((c) => c && c.trim() !== ''),
    ),
  ).sort()

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
    if (!value || value.trim() === '') return '-'

    // Special handling for certain fields
    if (header.toLowerCase().includes('link') || header.toLowerCase().includes('website')) {
      if (isUrl(value)) {
        return (
          <Link href={value} isExternal color="teal.600" display="inline-flex" alignItems="center" gap={1}>
            <ExternalLinkIcon />
          </Link>
        )
      }
    }

    // Truncate very long text
    if (value.length > 100) {
      return (
        <Text title={value} noOfLines={2} fontSize="xs">
          {value.substring(0, 100)}...
        </Text>
      )
    }

    return value
  }

  return (
    <Stack spacing={6}>
      <HStack justify="space-between" align="flex-start">
        <Box>
          <Heading size="lg" mb={2}>
            Leads Generated
          </Heading>
          <Text color="gray.600">
            Live data from all client Google Sheets ({filteredLeads.length} of {leads.length} leads)
          </Text>
          <Text fontSize="xs" color="gray.500" mt={1}>
            Last refreshed: {formatLastRefresh(lastRefresh)} • Auto-refreshes every 6 hours
          </Text>
        </Box>
        <IconButton
          aria-label="Refresh leads data"
          icon={<RepeatIcon />}
          onClick={() => loadLeads(true)}
          isLoading={loading}
          colorScheme="teal"
          size="sm"
        />
      </HStack>

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
              Channel of Lead
            </Text>
            <Select
              placeholder="All Channels"
              value={filters.channelOfLead}
              onChange={(e) => setFilters({ ...filters, channelOfLead: e.target.value })}
              size="sm"
            >
              {uniqueChannels.map((channel) => (
                <option key={channel} value={channel}>
                  {channel}
                </option>
              ))}
            </Select>
          </Box>
        </SimpleGrid>

        {(filters.account || filters.channelOfLead) && (
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
            {filters.channelOfLead && (
              <Tag colorScheme="teal" size="md">
                <TagLabel>Channel: {filters.channelOfLead}</TagLabel>
                <TagCloseButton onClick={() => setFilters({ ...filters, channelOfLead: '' })} />
              </Tag>
            )}
            <Button
              size="xs"
              variant="ghost"
              colorScheme="gray"
              onClick={() => setFilters({ account: '', channelOfLead: '' })}
            >
              Clear All
            </Button>
          </HStack>
        )}
      </Box>

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
          maxH="calc(100vh - 300px)"
          maxW="100%"
          border="1px solid"
          borderColor="gray.200"
          borderRadius="lg"
          bg="white"
        >
          <Table variant="simple" size="sm" minW="max-content">
            <Thead bg="gray.50" position="sticky" top={0} zIndex={10}>
              <Tr>
                {columns.map((col) => (
                  <Th key={col} whiteSpace="nowrap" px={3} py={2} bg="gray.50">
                    {col}
                  </Th>
                ))}
              </Tr>
            </Thead>
            <Tbody>
              {filteredLeads.map((lead, index) => (
              <Tr
                key={`${lead.accountName}-${index}`}
                _hover={{ bg: 'gray.50' }}
                sx={{
                  '&:hover td': {
                    bg: 'gray.50',
                  },
                }}
              >
                {columns.map((col) => {
                  if (col === 'Account') {
                    return (
                      <Td
                        key={col}
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
                    )
                  }
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

export default LeadsTab

