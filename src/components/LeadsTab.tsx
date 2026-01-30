import { useCallback, useEffect, useState, type ReactNode } from 'react'
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
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Checkbox,
  VStack,
} from '@chakra-ui/react'
import { ExternalLinkIcon, RepeatIcon, ViewIcon } from '@chakra-ui/icons'
import { syncAccountLeadCountsFromLeads } from '../utils/accountsLeadsSync'
import { on } from '../platform/events'
import { OdcrmStorageKeys } from '../platform/keys'
import { getItem, getJson } from '../platform/storage'
import { fetchLeadsFromApi, persistLeadsToStorage } from '../utils/leadsApi'

type Lead = {
  [key: string]: string // Dynamic fields from Google Sheet
  accountName: string
}

// Load leads from storage
function loadLeadsFromStorage(): Lead[] {
  const parsed = getJson<Lead[]>(OdcrmStorageKeys.leads)
  if (!parsed || !Array.isArray(parsed)) return []
  console.log('✅ Loaded leads from storage:', parsed.length)
  return parsed
}

// Save leads to storage
function saveLeadsToStorage(leads: Lead[], lastSyncAt?: string | null): Date {
  const refreshTime = persistLeadsToStorage(leads, lastSyncAt)
  console.log('💾 Saved leads to storage:', leads.length)
  return refreshTime
}

// Load last refresh time from storage
function loadLastRefreshFromStorage(): Date | null {
  const stored = getItem(OdcrmStorageKeys.leadsLastRefresh)
  if (!stored) return null
  const d = new Date(stored)
  return isNaN(d.getTime()) ? null : d
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
  
  // Default visible columns as requested by user
  const defaultVisibleColumns = ['Account', 'Date', 'Company', 'OD Team Member', 'Channel of Lead']
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(defaultVisibleColumns))
  
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
  const shouldRefresh = useCallback((): boolean => {
    const lastRefreshTime = loadLastRefreshFromStorage()
    if (!lastRefreshTime) return true // No previous refresh, allow refresh
    
    const now = new Date()
    const sixHoursInMs = 6 * 60 * 60 * 1000
    const timeSinceLastRefresh = now.getTime() - lastRefreshTime.getTime()
    
    return timeSinceLastRefresh >= sixHoursInMs
  }, [])

  const loadLeads = useCallback(async (forceRefresh: boolean = false) => {
    // Check if we should refresh (unless forced)
    if (!forceRefresh && !shouldRefresh()) {
      console.log('Skipping refresh - less than 6 hours since last refresh')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { leads: allLeads, lastSyncAt } = await fetchLeadsFromApi()
      setLeads(allLeads)
      const refreshTime = saveLeadsToStorage(allLeads, lastSyncAt)
      setLastRefresh(refreshTime)
      syncAccountLeadCountsFromLeads(allLeads)
    } catch (err) {
      setError('Failed to load leads data from the server.')
      console.error('Error loading leads:', err)
    } finally {
      setLoading(false)
    }
  }, [shouldRefresh])

  useEffect(() => {
    // Only load fresh data on mount if 6 hours have passed since last refresh
    // Otherwise, use cached data
    loadLeads(false)

    // Auto-refresh every 6 hours
    const refreshInterval = setInterval(() => {
      loadLeads(false)
    }, 6 * 60 * 60 * 1000) // 6 hours in milliseconds

    // Listen for navigation events (but only refresh if 6 hours have passed)
    const handleNavigate = (event: { accountName?: string } | undefined) => {
      const accountName = event?.accountName
      if (accountName) {
        toast({
          title: 'Loading leads...',
          description: `Fetching leads for ${accountName}`,
          status: 'info',
          duration: 2000,
        })
        loadLeads(true)
      }
    }

    // When accounts (or their sheet URLs) change, force refresh so dependent views stay in sync.
    const handleAccountsUpdated = () => {
      console.log('Accounts updated, refreshing leads...')
      loadLeads(true)
    }

    const offNavigate = on<{ accountName?: string }>('navigateToLeads', (detail) => handleNavigate(detail))
    const offAccountsUpdated = on('accountsUpdated', () => handleAccountsUpdated())

    return () => {
      clearInterval(refreshInterval)
      offNavigate()
      offAccountsUpdated()
    }
  }, [lastRefresh, loadLeads, toast])

  if (loading) {
    return (
      <Box textAlign="center" py={12}>
        <Spinner size="xl" color="brand.500" thickness="4px" />
        <Text mt={4} color="gray.600">
          Loading leads data from the server...
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

  // Define the specific column order - minimized to essential columns
  const columnOrder = [
    'Account',
    'Week',
    'Date',
    'Company',
    'Name',
    'Job Title',
    'Industry',
    'Contact Info',
    'OD Team Member',
    'OD Call Recording Available',
    'Channel of Lead',
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
  
  // Filter columns based on visibility
  const displayedColumns = columns.filter(col => visibleColumns.has(col))
  
  // Toggle column visibility
  const toggleColumnVisibility = (column: string) => {
    const newVisible = new Set(visibleColumns)
    if (newVisible.has(column)) {
      newVisible.delete(column)
    } else {
      newVisible.add(column)
    }
    setVisibleColumns(newVisible)
  }

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
          <Link href={value} isExternal color="text.muted" display="inline-flex" alignItems="center" gap={1}>
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
            Live data from the database ({filteredLeads.length} of {leads.length} leads)
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
          colorScheme="gray"
          size="sm"
        />
      </HStack>

      <Box p={4} bg="white" borderRadius="lg" border="1px solid" borderColor="gray.200">
        <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
          <Box>
            <HStack mb={2} justify="space-between">
              <Text fontSize="xs" textTransform="uppercase" color="gray.500" fontWeight="semibold">
                Account
              </Text>
              {(filters.account || filters.channelOfLead) && (
                <Button
                  size="xs"
                  variant="ghost"
                  colorScheme="gray"
                  leftIcon={<RepeatIcon />}
                  onClick={() => setFilters({ account: '', channelOfLead: '' })}
                >
                  Reset
                </Button>
              )}
            </HStack>
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

          <Box>
            <Text fontSize="xs" textTransform="uppercase" color="gray.500" mb={2} fontWeight="semibold">
              Column Visibility
            </Text>
            <Menu closeOnSelect={false}>
              <MenuButton as={Button} size="sm" leftIcon={<ViewIcon />} width="100%">
                Show/Hide Columns ({visibleColumns.size})
              </MenuButton>
              <MenuList maxH="400px" overflowY="auto">
                {columns.map((col) => (
                  <MenuItem key={col} onClick={() => toggleColumnVisibility(col)}>
                    <Checkbox 
                      isChecked={visibleColumns.has(col)} 
                      onChange={() => toggleColumnVisibility(col)}
                      mr={2}
                    >
                      {col}
                    </Checkbox>
                  </MenuItem>
                ))}
              </MenuList>
            </Menu>
          </Box>
        </SimpleGrid>
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
                {displayedColumns.map((col) => (
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
                {displayedColumns.map((col) => {
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
                        <Badge colorScheme="gray">{lead.accountName}</Badge>
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

