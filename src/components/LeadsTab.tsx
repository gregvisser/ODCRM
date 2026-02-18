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
import { ExternalLinkIcon, RepeatIcon, ViewIcon, DownloadIcon, AddIcon } from '@chakra-ui/icons'
import { syncAccountLeadCountsFromLeads } from '../utils/accountsLeadsSync'
import { on } from '../platform/events'
import { OdcrmStorageKeys } from '../platform/keys'
import { getItem, getJson } from '../platform/storage'
import { 
  fetchLeadsFromApi, 
  persistLeadsToStorage,
  convertLeadToContact,
  bulkConvertLeads,
  scoreLead,
  updateLeadStatus,
  exportLeadsToCSV,
  getSequences,
  getSyncStatus,
  getValidateSheetResult,
  type LeadRecord,
  type SyncStatus,
  type ValidateSheetResult
} from '../utils/leadsApi'

type Lead = LeadRecord & {
  [key: string]: string | number | null | undefined // Dynamic fields from Google Sheet
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
  
  // Default visible columns: Channel/Owner from API (source/owner) or sheet data
  const defaultVisibleColumns = ['Account', 'Date', 'Company', 'Channel', 'Owner', 'Status', 'Score']
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(defaultVisibleColumns))
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set())
  const [convertingLeadId, setConvertingLeadId] = useState<string | null>(null)
  const [bulkConverting, setBulkConverting] = useState(false)
  const [sequences, setSequences] = useState<Array<{ id: string; name: string; description?: string }>>([])
  const [syncStatusForEmpty, setSyncStatusForEmpty] = useState<SyncStatus | null>(null)
  const [sheetValidateForEmpty, setSheetValidateForEmpty] = useState<ValidateSheetResult | null>(null)

  const toast = useToast()

  // When leads are empty, fetch sync status and validator to show why 0 leads
  useEffect(() => {
    if (leads.length > 0) {
      setSyncStatusForEmpty(null)
      setSheetValidateForEmpty(null)
      return
    }
    const customerId = localStorage.getItem('currentCustomerId') || ''
    if (!customerId) return
    getSyncStatus(customerId).then(({ data }) => { if (data) setSyncStatusForEmpty(data) })
    getValidateSheetResult(customerId).then(({ data }) => { if (data) setSheetValidateForEmpty(data) })
  }, [leads.length])

  // Load sequences on mount
  useEffect(() => {
    getSequences().then(({ data, error }) => {
      if (data) {
        setSequences(data)
      } else if (error) {
        console.error('Failed to load sequences:', error)
      }
    })
  }, [])

  // Helper to format last refresh time
  const formatLastRefresh = (date: Date) => {
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
    if (diff < 60) return `${diff} seconds ago`
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`
    return date.toLocaleTimeString()
  }

  // Get status badge color
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'new': return 'gray'
      case 'qualified': return 'blue'
      case 'nurturing': return 'purple'
      case 'closed': return 'red'
      case 'converted': return 'green'
      default: return 'gray'
    }
  }

  // Handle convert lead to contact
  const handleConvertLead = async (leadId: string, sequenceId?: string) => {
    if (!leadId) return
    
    setConvertingLeadId(leadId)
    try {
      const { data, error } = await convertLeadToContact(leadId, sequenceId)
      if (error) {
        toast({
          title: 'Conversion failed',
          description: error,
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
      } else if (data) {
        toast({
          title: 'Lead converted',
          description: data.isNewContact 
            ? `Created new contact and ${data.enrollmentId ? 'enrolled in sequence' : 'ready for outreach'}`
            : `Linked to existing contact${data.enrollmentId ? ' and enrolled in sequence' : ''}`,
          status: 'success',
          duration: 5000,
          isClosable: true,
        })
        // Refresh leads to get updated status
        await loadLeads(true)
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to convert lead',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setConvertingLeadId(null)
    }
  }

  // Handle bulk convert
  const handleBulkConvert = async (sequenceId?: string) => {
    if (selectedLeads.size === 0) {
      toast({
        title: 'No leads selected',
        description: 'Please select leads to convert',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    setBulkConverting(true)
    try {
      const { data, error } = await bulkConvertLeads(Array.from(selectedLeads), sequenceId)
      if (error) {
        toast({
          title: 'Bulk conversion failed',
          description: error,
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
      } else if (data) {
        toast({
          title: 'Bulk conversion complete',
          description: `Converted ${data.converted} leads. Created ${data.contactsCreated} new contacts, found ${data.contactsExisting} existing. ${data.enrollments > 0 ? `Enrolled ${data.enrollments} in sequence.` : ''}`,
          status: 'success',
          duration: 7000,
          isClosable: true,
        })
        setSelectedLeads(new Set())
        await loadLeads(true)
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to bulk convert leads',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setBulkConverting(false)
    }
  }

  // Handle export to CSV
  const handleExportCSV = async () => {
    try {
      const { data, error } = await exportLeadsToCSV()
      if (error) {
        toast({
          title: 'Export failed',
          description: error,
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
      } else if (data) {
        const url = URL.createObjectURL(data)
        const link = document.createElement('a')
        link.href = url
        link.download = `leads-export-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        toast({
          title: 'Export successful',
          description: 'Leads exported to CSV',
          status: 'success',
          duration: 3000,
          isClosable: true,
        })
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to export leads',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    }
  }

  // Toggle lead selection
  const toggleLeadSelection = (leadId: string) => {
    const newSelected = new Set(selectedLeads)
    if (newSelected.has(leadId)) {
      newSelected.delete(leadId)
    } else {
      newSelected.add(leadId)
    }
    setSelectedLeads(newSelected)
  }

  // Toggle all leads selection
  const toggleAllLeads = () => {
    if (selectedLeads.size === filteredLeads.length) {
      setSelectedLeads(new Set())
    } else {
      setSelectedLeads(new Set(filteredLeads.filter(l => l.id).map(l => l.id!)))
    }
  }

  const loadLeads = useCallback(async (forceRefresh: boolean = false) => {
    setLoading(true)
    setError(null)

    try {
      const customerId = localStorage.getItem('currentCustomerId') || undefined
      if (!customerId) {
        console.warn('Missing customerId – leads fetch skipped')
        setLoading(false)
        return
      }
      const { leads: allLeads, lastSyncAt } = await fetchLeadsFromApi(customerId)
      setLeads(allLeads as Lead[])
      const refreshTime = saveLeadsToStorage(allLeads, lastSyncAt)
      setLastRefresh(refreshTime)
      syncAccountLeadCountsFromLeads(allLeads)
    } catch (err) {
      setError('Failed to load leads data from the server.')
      console.error('Error loading leads:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLeads(true)

    const pollInterval = 60 * 1000 // 60 seconds
    const refreshInterval = setInterval(() => {
      const customerId = localStorage.getItem('currentCustomerId')
      if (customerId) {
        console.log('[LeadsTab] Polling leads (60s)')
        loadLeads(true)
      }
    }, pollInterval)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const customerId = localStorage.getItem('currentCustomerId')
        if (customerId) loadLeads(true)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

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

    const handleAccountsUpdated = () => {
      console.log('Accounts updated, refreshing leads...')
      loadLeads(true)
    }

    const offNavigate = on<{ accountName?: string }>('navigateToLeads', (detail) => handleNavigate(detail))
    const offAccountsUpdated = on('accountsUpdated', () => handleAccountsUpdated())

    return () => {
      clearInterval(refreshInterval)
      document.removeEventListener('visibilitychange', handleVisibility)
      offNavigate()
      offAccountsUpdated()
    }
  }, [loadLeads, toast])

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
    const whyZeroMessage = sheetValidateForEmpty
      ? sheetValidateForEmpty.ok
        ? (sheetValidateForEmpty.rowCount === 0
          ? 'The sheet returned 0 data rows. Publish the sheet to web (File → Share → Publish to web) as CSV and ensure it has a header row and at least one data row.'
          : null)
        : sheetValidateForEmpty.error?.toLowerCase().includes('no leads reporting url')
          ? 'This account has no Leads reporting URL configured. Add a Google Sheet URL in Settings → Accounts.'
          : sheetValidateForEmpty.error
      : null
    return (
      <Stack spacing={4} py={12}>
        <Box textAlign="center">
          <Text fontSize="lg" color="gray.600">
            No leads data available
          </Text>
          <Text fontSize="sm" color="gray.500" mt={2}>
            {whyZeroMessage ?? 'Configure Client Leads sheets in account settings to view leads data'}
          </Text>
          {sheetValidateForEmpty?.hint && !sheetValidateForEmpty.ok && (
            <Text fontSize="sm" color="gray.500" mt={1} fontStyle="italic">{sheetValidateForEmpty.hint}</Text>
          )}
        </Box>
        {syncStatusForEmpty && (
          <Alert status={syncStatusForEmpty.lastError ? 'warning' : 'info'} borderRadius="lg" maxW="2xl" mx="auto">
            <AlertIcon />
            <Box>
              <AlertTitle>Sync status</AlertTitle>
              <AlertDescription>
                Last sync: {syncStatusForEmpty.lastSyncAt ? new Date(syncStatusForEmpty.lastSyncAt).toLocaleString() : 'Never'}
                {syncStatusForEmpty.lastSuccessAt && ` · Last success: ${new Date(syncStatusForEmpty.lastSuccessAt).toLocaleString()}`}
                {syncStatusForEmpty.lastError && (
                  <Text mt={2} fontWeight="semibold" color="orange.600">Error: {syncStatusForEmpty.lastError}</Text>
                )}
                {(syncStatusForEmpty.isPaused || syncStatusForEmpty.isRunning) && (
                  <Text mt={1} fontSize="sm">{syncStatusForEmpty.isPaused ? 'Paused' : ''} {syncStatusForEmpty.isRunning ? 'Sync in progress' : ''}</Text>
                )}
              </AlertDescription>
            </Box>
          </Alert>
        )}
      </Stack>
    )
  }

  // Define the specific column order. Channel = source, Owner = owner (from API or sheet data).
  const columnOrder = [
    'Account',
    'Week',
    'Date',
    'Company',
    'Name',
    'Job Title',
    'Industry',
    'Contact Info',
    'Channel',
    'Owner',
    'OD Team Member',
    'OD Call Recording Available',
    'Channel of Lead',
    'Status',
    'Score',
  ]

  // Get all unique column headers; ensure Channel/Owner from API (source/owner) are included
  const allColumns = new Set<string>()
  leads.forEach((lead) => {
    Object.keys(lead).forEach((key) => {
      if (key !== 'accountName') allColumns.add(key)
    })
    if (lead.source != null || lead['Channel of Lead'] != null || lead['Channel'] != null) allColumns.add('Channel')
    if (lead.owner != null || lead['OD Team Member'] != null || lead['Owner'] != null) allColumns.add('Owner')
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

  const getChannelValue = (lead: Lead) =>
    lead.source ?? lead['Channel of Lead'] ?? lead['Channel'] ?? ''
  const getOwnerValue = (lead: Lead) =>
    lead.owner ?? lead['OD Team Member'] ?? lead['Owner'] ?? ''

  // Filter leads based on filter criteria
  const filteredLeads = leads
    .filter((lead) => {
      if (filters.account && lead.accountName !== filters.account) return false
      const channel = getChannelValue(lead)
      if (filters.channelOfLead && !channel?.toLowerCase().includes(filters.channelOfLead.toLowerCase()))
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
    new Set(leads.map((lead) => getChannelValue(lead)).filter((c) => c && c.trim() !== '')),
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
          <HStack spacing={2} mt={1} fontSize="xs" color="gray.500">
            <Text>Last synced: {formatLastRefresh(lastRefresh)}</Text>
            {Date.now() - lastRefresh.getTime() > 2 * 60 * 1000 && (
              <Badge size="sm" colorScheme="yellow">Stale</Badge>
            )}
            <Text>• Polls every 60s</Text>
          </HStack>
        </Box>
        <HStack spacing={2}>
          {selectedLeads.size > 0 && (
            <Menu>
              <MenuButton as={Button} size="sm" colorScheme="blue" leftIcon={<AddIcon />}>
                Bulk Actions ({selectedLeads.size})
              </MenuButton>
              <MenuList>
                <MenuItem onClick={() => handleBulkConvert()}>
                  Convert to Contacts
                </MenuItem>
                {sequences.length > 0 && (
                  <>
                    <MenuItem isDisabled>Enroll in Sequence:</MenuItem>
                    {sequences.map((seq) => (
                      <MenuItem key={seq.id} onClick={() => handleBulkConvert(seq.id)}>
                        {seq.name}
                      </MenuItem>
                    ))}
                  </>
                )}
              </MenuList>
            </Menu>
          )}
          <Button
            size="sm"
            leftIcon={<DownloadIcon />}
            onClick={handleExportCSV}
            colorScheme="gray"
            variant="outline"
          >
            Export CSV
          </Button>
          <IconButton
            aria-label="Refresh leads data"
            icon={<RepeatIcon />}
            onClick={() => loadLeads(true)}
            isLoading={loading}
            colorScheme="gray"
            size="sm"
          />
        </HStack>
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
                <Th px={3} py={2} bg="gray.50" position="sticky" left={0} zIndex={11}>
                  <Checkbox
                    isChecked={selectedLeads.size > 0 && selectedLeads.size === filteredLeads.filter(l => l.id).length}
                    isIndeterminate={selectedLeads.size > 0 && selectedLeads.size < filteredLeads.filter(l => l.id).length}
                    onChange={toggleAllLeads}
                  />
                </Th>
                <Th px={3} py={2} bg="gray.50" position="sticky" left={10} zIndex={10} whiteSpace="nowrap">
                  Actions
                </Th>
                {displayedColumns.map((col) => (
                  <Th key={col} whiteSpace="nowrap" px={3} py={2} bg="gray.50">
                    {col}
                  </Th>
                ))}
              </Tr>
            </Thead>
            <Tbody>
              {filteredLeads.map((lead, index) => {
                const leadId = lead.id || `${lead.accountName}-${index}`
                const isSelected = selectedLeads.has(leadId)
                const isConverted = lead.status === 'converted' || !!lead.convertedToContactId
                
                return (
                  <Tr
                    key={leadId}
                    bg={isSelected ? 'blue.50' : 'white'}
                    _hover={{ bg: isSelected ? 'blue.100' : 'gray.50' }}
                    sx={{
                      '&:hover td': {
                        bg: isSelected ? 'blue.100' : 'gray.50',
                      },
                    }}
                  >
                    <Td px={3} py={2} position="sticky" left={0} bg={isSelected ? 'blue.50' : 'white'} zIndex={5}>
                      <Checkbox
                        isChecked={isSelected}
                        onChange={() => toggleLeadSelection(leadId)}
                      />
                    </Td>
                    <Td px={3} py={2} position="sticky" left={10} bg={isSelected ? 'blue.50' : 'white'} zIndex={5} whiteSpace="nowrap">
                      {!isConverted ? (
                        <Menu>
                          <MenuButton 
                            as={Button} 
                            size="xs" 
                            colorScheme="blue"
                            isLoading={convertingLeadId === leadId}
                            isDisabled={convertingLeadId !== null}
                          >
                            Convert
                          </MenuButton>
                          <MenuList>
                            <MenuItem onClick={() => handleConvertLead(leadId)}>
                              Convert to Contact
                            </MenuItem>
                            {sequences.length > 0 && (
                              <>
                                <MenuItem isDisabled>Convert & Enroll:</MenuItem>
                                {sequences.map((seq) => (
                                  <MenuItem key={seq.id} onClick={() => handleConvertLead(leadId, seq.id)}>
                                    {seq.name}
                                  </MenuItem>
                                ))}
                              </>
                            )}
                          </MenuList>
                        </Menu>
                      ) : (
                        <Badge colorScheme="green" fontSize="xs">Converted</Badge>
                      )}
                    </Td>
                    {displayedColumns.map((col) => {
                      if (col === 'Account') {
                        return (
                          <Td
                            key={col}
                            px={3}
                            py={2}
                            bg={isSelected ? 'blue.50' : 'white'}
                            _hover={{ bg: isSelected ? 'blue.100' : 'gray.50' }}
                            sx={{
                              'tr:hover &': {
                                bg: isSelected ? 'blue.100' : 'gray.50',
                              },
                            }}
                          >
                            <Badge colorScheme="gray">{lead.accountName}</Badge>
                          </Td>
                        )
                      }
                      if (col === 'Status') {
                        const status = lead.status || 'new'
                        return (
                          <Td key={col} px={3} py={2} bg={isSelected ? 'blue.50' : 'white'}>
                            <Badge colorScheme={getStatusColor(status)} fontSize="xs" textTransform="capitalize">
                              {status}
                            </Badge>
                          </Td>
                        )
                      }
                      if (col === 'Score') {
                        const score = lead.score
                        return (
                          <Td key={col} px={3} py={2} bg={isSelected ? 'blue.50' : 'white'}>
                            {score !== null && score !== undefined ? (
                              <Badge 
                                colorScheme={score >= 70 ? 'green' : score >= 50 ? 'yellow' : 'gray'} 
                                fontSize="xs"
                              >
                                {score}
                              </Badge>
                            ) : (
                              <Text fontSize="xs" color="gray.400">-</Text>
                            )}
                          </Td>
                        )
                      }
                      // Channel/Owner from API (source/owner) or sheet data
                      const value =
                        col === 'Channel'
                          ? getChannelValue(lead)
                          : col === 'Owner'
                            ? getOwnerValue(lead)
                            : String(lead[col] || '')
                      return (
                        <Td key={col} px={3} py={2} whiteSpace="normal" maxW="300px" bg={isSelected ? 'blue.50' : 'white'}>
                          {formatCell(value, col)}
                        </Td>
                      )
                    })}
                  </Tr>
                )
              })}
            </Tbody>
          </Table>
        </Box>
      )}
    </Stack>
  )
}

export default LeadsTab

