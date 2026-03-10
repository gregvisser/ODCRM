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
  Input,
  Textarea,
  FormControl,
  FormLabel,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
} from '@chakra-ui/react'
import { ExternalLinkIcon, RepeatIcon, ViewIcon, DownloadIcon, AddIcon, EditIcon } from '@chakra-ui/icons'
import { on } from '../platform/events'
import { clearCurrentCustomerId, getCurrentCustomerId, setCurrentCustomerId } from '../platform/stores/settings'
import {
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
import { useLiveLeadsPolling } from '../hooks/useLiveLeadsPolling'
import { createLiveLead, retryLiveLeadOutboundSync, updateLiveLead, type LiveLeadRow } from '../utils/liveLeadsApi'
import { api } from '../utils/api'

type Lead = LeadRecord & {
  [key: string]: string | number | null | undefined // Dynamic fields from Google Sheet
  accountName: string
}

type CustomerOption = {
  id: string
  name: string
}

/** Map live API rows to Lead shape for table (accountName, source, owner, id, raw fields). */
function mapLiveLeadsToLead(rows: LiveLeadRow[], accountName: string): Lead[] {
  return rows.map((row, i) => {
    const lead: Lead = {
      ...row.raw,
      id: row.id || `live-${i}`,
      accountName,
      source: row.source ?? undefined,
      owner: row.owner ?? undefined,
      Name: row.fullName ?? row.name ?? undefined,
      Email: row.email ?? undefined,
      Phone: row.phone ?? undefined,
      Company: row.company ?? undefined,
      'Job Title': row.jobTitle ?? undefined,
      Location: row.location ?? undefined,
      Status: row.status ?? undefined,
      'Sync Status': row.syncStatus ?? undefined,
      syncStatus: row.syncStatus ?? undefined,
      Notes: row.notes ?? undefined,
      Date: row.occurredAt ? new Date(row.occurredAt).toLocaleDateString() : (row.raw['Date'] ?? row.raw['date'] ?? ''),
    }
    return lead
  })
}


function LeadsTab() {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(getCurrentCustomerId() || '')
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [customersLoading, setCustomersLoading] = useState(true)
  const [customersError, setCustomersError] = useState<string | null>(null)
  const activeCustomerId = selectedCustomerId.trim()
  const { data: liveData, loading, error, lastUpdatedAt, refetch } = useLiveLeadsPolling(activeCustomerId || null, {
    enabled: activeCustomerId !== '',
  })
  const leads = useMemo(
    () => (liveData ? mapLiveLeadsToLead(liveData.leads, liveData.customerName ?? '') : []),
    [liveData]
  )
  const lastRefresh = lastUpdatedAt ?? new Date()
  const liveWarning = liveData?.warning ?? null
  const sourceOfTruth = liveData?.sourceOfTruth ?? null
  const apiDisplayColumns = liveData?.displayColumns ?? []

  const [filters, setFilters] = useState({
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
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false)
  const [isCreatingLead, setIsCreatingLead] = useState(false)
  const [isEditLeadOpen, setIsEditLeadOpen] = useState(false)
  const [isUpdatingLead, setIsUpdatingLead] = useState(false)
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null)
  const [retryingLeadId, setRetryingLeadId] = useState<string | null>(null)
  const [addLeadForm, setAddLeadForm] = useState({
    occurredAt: '',
    fullName: '',
    email: '',
    phone: '',
    company: '',
    jobTitle: '',
    location: '',
    source: '',
    owner: '',
    status: 'new',
    notes: '',
  })
  const [editLeadForm, setEditLeadForm] = useState({
    occurredAt: '',
    fullName: '',
    email: '',
    phone: '',
    company: '',
    jobTitle: '',
    location: '',
    source: '',
    owner: '',
    status: 'new',
    notes: '',
  })

  const toast = useToast()

  const loadCustomers = useCallback(async () => {
    setCustomersLoading(true)
    setCustomersError(null)
    try {
      const { data, error } = await api.get<CustomerOption[]>('/api/customers')
      if (error) {
        setCustomersError(error)
        setCustomers([])
        return
      }
      const list = Array.isArray(data) ? data.filter((c) => c && c.id && c.name) : []
      setCustomers(list)
      if (selectedCustomerId && !list.some((customer) => customer.id === selectedCustomerId)) {
        setSelectedCustomerId('')
        clearCurrentCustomerId()
      }
    } catch (e) {
      setCustomersError(e instanceof Error ? e.message : 'Failed to load clients')
      setCustomers([])
    } finally {
      setCustomersLoading(false)
    }
  }, [selectedCustomerId])

  useEffect(() => {
    loadCustomers()
    const offAccountsUpdated = on('accountsUpdated', () => {
      void loadCustomers()
    })
    return () => {
      offAccountsUpdated()
    }
  }, [loadCustomers])

  const selectedCustomerName = useMemo(
    () => customers.find((customer) => customer.id === activeCustomerId)?.name || '',
    [customers, activeCustomerId]
  )

  const handleCustomerChange = (nextCustomerId: string) => {
    setSelectedCustomerId(nextCustomerId)
    setSelectedLeads(new Set())
    setFilters({ channelOfLead: '' })
    if (nextCustomerId) {
      setCurrentCustomerId(nextCustomerId)
    } else {
      clearCurrentCustomerId()
    }
  }

  const customerSelector = (
    <Box borderWidth="1px" borderRadius="lg" p={3} bg="white" data-testid="leads-tab-customer-selector">
      <HStack justify="space-between" align="start" mb={2} flexWrap="wrap">
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="gray.700">
            Client
          </Text>
          <Text fontSize="xs" color="gray.600">
            {selectedCustomerName
              ? `Showing leads for ${selectedCustomerName}`
              : 'Select a client to load leads, add/edit rows, and run sync actions.'}
          </Text>
        </Box>
        <Button size="xs" variant="ghost" leftIcon={<RepeatIcon />} onClick={() => void loadCustomers()} isLoading={customersLoading}>
          Refresh clients
        </Button>
      </HStack>
      <Select
        placeholder={customersLoading ? 'Loading clients...' : 'Select a client'}
        value={selectedCustomerId}
        onChange={(e) => handleCustomerChange(e.target.value)}
        data-testid="leads-tab-customer-select"
      >
        {customers.map((customer) => (
          <option key={customer.id} value={customer.id}>
            {customer.name}
          </option>
        ))}
      </Select>
      {customersError && (
        <Text mt={2} fontSize="xs" color="red.500">
          Failed to load clients: {customersError}
        </Text>
      )}
    </Box>
  )

  // When leads are empty, fetch sync status and validator to show why 0 leads
  useEffect(() => {
    if (leads.length > 0) {
      setSyncStatusForEmpty(null)
      setSheetValidateForEmpty(null)
      return
    }
    if (sourceOfTruth === 'db') {
      setSyncStatusForEmpty(null)
      setSheetValidateForEmpty(null)
      return
    }
    if (!activeCustomerId) return
    getSyncStatus(activeCustomerId).then(({ data }) => { if (data) setSyncStatusForEmpty(data) })
    getValidateSheetResult(activeCustomerId).then(({ data }) => { if (data) setSheetValidateForEmpty(data) })
  }, [leads.length, activeCustomerId, sourceOfTruth])

  // Load sequences on mount
  useEffect(() => {
    if (!activeCustomerId) {
      setSequences([])
      return
    }
    getSequences(activeCustomerId).then(({ data, error }) => {
      if (data) {
        setSequences(data)
      } else if (error) {
        console.error('Failed to load sequences:', error)
      }
    })
  }, [activeCustomerId])

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

  const getSyncStatusColor = (status?: string) => {
    const normalized = String(status || '').toLowerCase()
    if (normalized === 'synced') return 'green'
    if (normalized === 'pending_outbound') return 'yellow'
    if (normalized === 'sync_error') return 'red'
    return 'gray'
  }

  // Handle convert lead to contact
  const handleConvertLead = async (leadId: string, sequenceId?: string) => {
    if (!leadId) return
    
    setConvertingLeadId(leadId)
    try {
      const { data, error } = await convertLeadToContact(leadId, sequenceId, activeCustomerId)
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
        refetch()
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
      const { data, error } = await bulkConvertLeads(Array.from(selectedLeads), sequenceId, activeCustomerId)
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
        refetch()
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
      const { data, error } = await exportLeadsToCSV(activeCustomerId)
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

  useEffect(() => {
    const handleNavigate = () => {
      toast({ title: 'Loading leads...', status: 'info', duration: 2000 })
      refetch()
    }
    const handleAccountsUpdated = () => refetch()
    const offNavigate = on<{ accountName?: string }>('navigateToLeads', handleNavigate)
    const offAccountsUpdated = on('accountsUpdated', handleAccountsUpdated)
    return () => {
      offNavigate()
      offAccountsUpdated()
    }
  }, [refetch, toast])

  if (!activeCustomerId) {
    return (
      <Stack spacing={4}>
        {customerSelector}
        <Box textAlign="center" py={12} bg="white" borderRadius="lg" border="1px solid" borderColor="gray.200">
          <Text fontSize="lg" color="gray.600">
            Select a client to view leads
          </Text>
          <Text fontSize="sm" color="gray.500" mt={2}>
            This tab now manages lead operations directly. Choose a client above to load data.
          </Text>
        </Box>
      </Stack>
    )
  }

  if (loading) {
    return (
      <Stack spacing={4}>
        {customerSelector}
        <Box textAlign="center" py={12}>
          <Spinner size="xl" color="brand.500" thickness="4px" />
          <Text mt={4} color="gray.600">
            Loading leads data from the server...
          </Text>
        </Box>
      </Stack>
    )
  }

  if (error) {
    return (
      <Stack spacing={4}>
        {customerSelector}
        <Alert status="error" borderRadius="lg" data-testid="leads-acceptance-actionable-error">
          <AlertIcon />
          <Box>
            <AlertTitle>Error loading leads</AlertTitle>
            <AlertDescription>
              <Text>{error}</Text>
              <Text mt={2} fontSize="sm">
                {sourceOfTruth === 'db'
                  ? 'This client uses ODCRM database lead records. Confirm leads exist in ODCRM for this client.'
                  : 'This client uses Google Sheets-backed lead truth. Confirm the linked sheet URL is valid and readable by ODCRM.'}
              </Text>
            </AlertDescription>
          </Box>
        </Alert>
      </Stack>
    )
  }

  if (leads.length === 0) {
    const whyZeroMessage =
      error?.toLowerCase().includes('no leads reporting url')
        ? 'This account has no Leads reporting URL configured. Add a Google Sheet URL in Settings → Accounts.'
        : error
          ?? (sheetValidateForEmpty
            ? sheetValidateForEmpty.ok
              ? (sheetValidateForEmpty.rowCount === 0
                ? 'The sheet returned 0 data rows. Publish the sheet to web (File → Share → Publish to web) as CSV and ensure it has a header row and at least one data row.'
                : null)
              : sheetValidateForEmpty.error
            : null)
    return (
      <Stack spacing={4}>
        {customerSelector}
        <Stack spacing={4} py={12}>
          {liveWarning && (
            <Alert status="warning" borderRadius="lg" maxW="2xl" mx="auto" data-testid="leads-tab-stale-sheet-warning">
              <AlertIcon />
              <Box>
                <AlertTitle>Google Sheets sync warning</AlertTitle>
                <AlertDescription>{liveWarning}</AlertDescription>
              </Box>
            </Alert>
          )}
          <Box textAlign="center">
            <Text fontSize="lg" color="gray.600">
              No leads available for this client
            </Text>
          <Text fontSize="sm" color="gray.600" mt={2} data-testid="leads-acceptance-source-mode">
            {sourceOfTruth === 'db'
              ? 'This client is DB-backed for leads in this view.'
              : 'This client is Google Sheets-backed for leads in this view.'}
          </Text>
          <Text fontSize="sm" color="gray.500" mt={2}>
            {whyZeroMessage
              ?? (sourceOfTruth === 'db'
                ? 'No lead records are stored for this client yet.'
                : 'Configure Client Leads sheets in account settings to view leads data')}
          </Text>
          <Text fontSize="sm" color="gray.500" mt={2} data-testid="leads-acceptance-next-step">
            {sourceOfTruth === 'db'
              ? 'Next step: add or import lead records for this client in ODCRM, then refresh.'
              : 'Next step: update the client lead sheet link in Accounts and confirm sheet access, then refresh.'}
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

  // Use backend-provided visible columns when available; fallback to local derivation.
  const allColumns = new Set<string>()
  if (apiDisplayColumns.length > 0) {
    apiDisplayColumns.forEach((col) => allColumns.add(col))
  } else {
    leads.forEach((lead) => {
      Object.keys(lead).forEach((key) => {
        if (key !== 'accountName') allColumns.add(key)
      })
      if (lead.source != null || lead['Channel of Lead'] != null || lead['Channel'] != null) allColumns.add('Channel')
      if (lead.owner != null || lead['OD Team Member'] != null || lead['Owner'] != null) allColumns.add('Owner')
    })
  }

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
  const displayedColumns = (() => {
    const selected = columns.filter(col => visibleColumns.has(col))
    return selected.length > 0 ? selected : columns
  })()
  
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

  const toInputDate = (value: string | undefined): string => {
    if (!value) return ''
    const isoMatch = value.match(/^(\d{4}-\d{2}-\d{2})/)
    if (isoMatch) return isoMatch[1]
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return ''
    const year = parsed.getFullYear()
    const month = String(parsed.getMonth() + 1).padStart(2, '0')
    const day = String(parsed.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const openEditLeadModal = (lead: Lead, leadId: string) => {
    setEditingLeadId(leadId)
    setEditLeadForm({
      occurredAt: toInputDate(String(lead.Date || '')),
      fullName: String(lead.Name || lead.fullName || ''),
      email: String(lead.Email || lead.email || ''),
      phone: String(lead.Phone || lead.phone || ''),
      company: String(lead.Company || lead.company || ''),
      jobTitle: String(lead['Job Title'] || lead.jobTitle || ''),
      location: String(lead.Location || lead.location || ''),
      source: String(getChannelValue(lead) || ''),
      owner: String(getOwnerValue(lead) || ''),
      status: String(lead.status || lead.Status || 'new'),
      notes: String(lead.Notes || lead.notes || ''),
    })
    setIsEditLeadOpen(true)
  }

  const handleCreateLead = async () => {
    if (!activeCustomerId) return
    if (!addLeadForm.fullName.trim() && !addLeadForm.email.trim() && !addLeadForm.company.trim() && !addLeadForm.phone.trim()) {
      toast({
        title: 'Lead details required',
        description: 'Provide at least a name, email, company, or phone number.',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    setIsCreatingLead(true)
    try {
      const result = await createLiveLead(activeCustomerId, {
        occurredAt: addLeadForm.occurredAt || null,
        fullName: addLeadForm.fullName || null,
        email: addLeadForm.email || null,
        phone: addLeadForm.phone || null,
        company: addLeadForm.company || null,
        jobTitle: addLeadForm.jobTitle || null,
        location: addLeadForm.location || null,
        source: addLeadForm.source || null,
        owner: addLeadForm.owner || null,
        status: (addLeadForm.status as 'new' | 'qualified' | 'nurturing' | 'closed' | 'converted') || 'new',
        notes: addLeadForm.notes || null,
      })
      const outboundStatus = String(result.outboundSync.status || '')
      toast({
        title: 'Lead added',
        description: result.outboundSync.note,
        status: outboundStatus === 'sync_error' ? 'warning' : 'success',
        duration: 5000,
        isClosable: true,
      })
      setIsAddLeadOpen(false)
      setAddLeadForm({
        occurredAt: '',
        fullName: '',
        email: '',
        phone: '',
        company: '',
        jobTitle: '',
        location: '',
        source: '',
        owner: '',
        status: 'new',
        notes: '',
      })
      await refetch()
    } catch (e) {
      toast({
        title: 'Failed to add lead',
        description: e instanceof Error ? e.message : 'Unable to create lead',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setIsCreatingLead(false)
    }
  }

  const handleRetryOutboundSync = async (leadId: string) => {
    if (!activeCustomerId || !leadId) return
    setRetryingLeadId(leadId)
    try {
      const result = await retryLiveLeadOutboundSync(activeCustomerId, leadId)
      const status = String(result.outboundSync.status || '')
      toast({
        title: status === 'synced' ? 'Lead sync completed' : 'Lead sync retry finished',
        description: result.outboundSync.note + (result.outboundSync.error ? ` (${result.outboundSync.error})` : ''),
        status: status === 'synced' ? 'success' : 'warning',
        duration: 6000,
        isClosable: true,
      })
      await refetch()
    } catch (e) {
      toast({
        title: 'Retry failed',
        description: e instanceof Error ? e.message : 'Unable to retry outbound sync',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setRetryingLeadId(null)
    }
  }

  const handleUpdateLead = async () => {
    if (!activeCustomerId || !editingLeadId) return
    if (!editLeadForm.fullName.trim() && !editLeadForm.email.trim() && !editLeadForm.company.trim() && !editLeadForm.phone.trim()) {
      toast({
        title: 'Lead details required',
        description: 'Provide at least a name, email, company, or phone number.',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    setIsUpdatingLead(true)
    try {
      const result = await updateLiveLead(activeCustomerId, editingLeadId, {
        occurredAt: editLeadForm.occurredAt || null,
        fullName: editLeadForm.fullName || null,
        email: editLeadForm.email || null,
        phone: editLeadForm.phone || null,
        company: editLeadForm.company || null,
        jobTitle: editLeadForm.jobTitle || null,
        location: editLeadForm.location || null,
        source: editLeadForm.source || null,
        owner: editLeadForm.owner || null,
        status: (editLeadForm.status as 'new' | 'qualified' | 'nurturing' | 'closed' | 'converted') || 'new',
        notes: editLeadForm.notes || null,
      })
      const outboundStatus = String(result.outboundSync.status || '')
      toast({
        title: 'Lead updated',
        description: result.outboundSync.note + (result.outboundSync.error ? ` (${result.outboundSync.error})` : ''),
        status: outboundStatus === 'sync_error' ? 'warning' : 'success',
        duration: 6000,
        isClosable: true,
      })
      setIsEditLeadOpen(false)
      setEditingLeadId(null)
      await refetch()
    } catch (e) {
      toast({
        title: 'Failed to update lead',
        description: e instanceof Error ? e.message : 'Unable to update lead',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setIsUpdatingLead(false)
    }
  }

  // Filter leads based on filter criteria
  const filteredLeads = leads
    .filter((lead) => {
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
      {customerSelector}
      {liveWarning && (
        <Alert status="warning" borderRadius="lg" data-testid="leads-tab-stale-sheet-warning">
          <AlertIcon />
          <Box>
            <AlertTitle>Google Sheets sync warning</AlertTitle>
            <AlertDescription>{liveWarning}</AlertDescription>
          </Box>
        </Alert>
      )}
      <HStack justify="space-between" align="flex-start">
        <Box>
          <Heading size="lg" mb={2}>
            Leads Generated
          </Heading>
          <Text color="gray.600">
            {sourceOfTruth === 'db' ? 'Live ODCRM lead records' : 'Live sheet-backed data via ODCRM'} ({filteredLeads.length} of {leads.length} leads)
          </Text>
          <Text fontSize="xs" color="gray.500" mt={1}>
            Source of truth: {sourceOfTruth === 'db' ? 'ODCRM database (non-sheet-backed client)' : 'Google Sheets (sheet-backed client)'}
          </Text>
          <Text fontSize="xs" color="gray.500" mt={1} data-testid="leads-acceptance-next-step">
            {sourceOfTruth === 'db'
              ? 'Use this view to monitor DB-backed lead records for this client.'
              : 'Use this view to monitor Google Sheets-backed lead records for this client.'}
          </Text>
          <HStack spacing={2} mt={1} fontSize="xs" color="gray.500">
            <Text>Last synced: {formatLastRefresh(lastRefresh)}</Text>
            {Date.now() - lastRefresh.getTime() > 2 * 60 * 1000 && (
              <Badge size="sm" colorScheme="yellow">Stale</Badge>
            )}
            <Text>• Polls every 30s</Text>
          </HStack>
        </Box>
        <HStack spacing={2}>
          <Button
            size="sm"
            leftIcon={<AddIcon />}
            colorScheme="blue"
            onClick={() => setIsAddLeadOpen(true)}
          >
            Add Lead
          </Button>
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
            onClick={() => refetch()}
            isLoading={loading}
            colorScheme="gray"
            size="sm"
          />
        </HStack>
      </HStack>

      <Box p={4} bg="white" borderRadius="lg" border="1px solid" borderColor="gray.200">
        <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
          <Box>
            <Text fontSize="xs" textTransform="uppercase" color="gray.500" mb={2} fontWeight="semibold">
              Client scope
            </Text>
            <Text fontSize="xs" color="gray.600">
              Client selection is controlled by the selector at the top of this tab.
            </Text>
          </Box>

          <Box>
            <HStack mb={2} justify="space-between">
              <Text fontSize="xs" textTransform="uppercase" color="gray.500" fontWeight="semibold">
                Channel of Lead
              </Text>
              {filters.channelOfLead && (
                <Button
                  size="xs"
                  variant="ghost"
                  colorScheme="gray"
                  leftIcon={<RepeatIcon />}
                  onClick={() => setFilters({ channelOfLead: '' })}
                >
                  Reset
                </Button>
              )}
            </HStack>
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
                      isReadOnly
                      pointerEvents="none"
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
                      <VStack align="stretch" spacing={1}>
                        <Button
                          size="xs"
                          leftIcon={<EditIcon />}
                          colorScheme="gray"
                          variant="outline"
                          onClick={() => openEditLeadModal(lead, leadId)}
                          isDisabled={convertingLeadId !== null || retryingLeadId === leadId}
                        >
                          Edit
                        </Button>
                        {!isConverted ? (
                          <Menu>
                            <MenuButton 
                              as={Button} 
                              size="xs" 
                              colorScheme="blue"
                              isLoading={convertingLeadId === leadId}
                              isDisabled={convertingLeadId !== null || retryingLeadId === leadId}
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
                        {sourceOfTruth === 'google_sheets' && String(lead.syncStatus || '').toLowerCase() === 'sync_error' && (
                          <Button
                            size="xs"
                            colorScheme="orange"
                            variant="outline"
                            onClick={() => handleRetryOutboundSync(leadId)}
                            isLoading={retryingLeadId === leadId}
                            isDisabled={convertingLeadId !== null}
                          >
                            Retry Sync
                          </Button>
                        )}
                      </VStack>
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
                      if (col === 'Sync Status') {
                        const syncStatus = String(lead.syncStatus || lead['Sync Status'] || '').trim()
                        return (
                          <Td key={col} px={3} py={2} bg={isSelected ? 'blue.50' : 'white'}>
                            {syncStatus ? (
                              <Badge colorScheme={getSyncStatusColor(syncStatus)} fontSize="xs">
                                {syncStatus}
                              </Badge>
                            ) : (
                              <Text fontSize="xs" color="gray.400">-</Text>
                            )}
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

      <Modal isOpen={isAddLeadOpen} onClose={() => setIsAddLeadOpen(false)} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add Lead</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
              <FormControl>
                <FormLabel>Date</FormLabel>
                <Input type="date" value={addLeadForm.occurredAt} onChange={(e) => setAddLeadForm({ ...addLeadForm, occurredAt: e.target.value })} />
              </FormControl>
              <FormControl>
                <FormLabel>Full Name</FormLabel>
                <Input value={addLeadForm.fullName} onChange={(e) => setAddLeadForm({ ...addLeadForm, fullName: e.target.value })} />
              </FormControl>
              <FormControl>
                <FormLabel>Email</FormLabel>
                <Input type="email" value={addLeadForm.email} onChange={(e) => setAddLeadForm({ ...addLeadForm, email: e.target.value })} />
              </FormControl>
              <FormControl>
                <FormLabel>Phone</FormLabel>
                <Input value={addLeadForm.phone} onChange={(e) => setAddLeadForm({ ...addLeadForm, phone: e.target.value })} />
              </FormControl>
              <FormControl>
                <FormLabel>Company</FormLabel>
                <Input value={addLeadForm.company} onChange={(e) => setAddLeadForm({ ...addLeadForm, company: e.target.value })} />
              </FormControl>
              <FormControl>
                <FormLabel>Job Title</FormLabel>
                <Input value={addLeadForm.jobTitle} onChange={(e) => setAddLeadForm({ ...addLeadForm, jobTitle: e.target.value })} />
              </FormControl>
              <FormControl>
                <FormLabel>Location</FormLabel>
                <Input value={addLeadForm.location} onChange={(e) => setAddLeadForm({ ...addLeadForm, location: e.target.value })} />
              </FormControl>
              <FormControl>
                <FormLabel>Source / Channel</FormLabel>
                <Input value={addLeadForm.source} onChange={(e) => setAddLeadForm({ ...addLeadForm, source: e.target.value })} />
              </FormControl>
              <FormControl>
                <FormLabel>Owner / Employee</FormLabel>
                <Input value={addLeadForm.owner} onChange={(e) => setAddLeadForm({ ...addLeadForm, owner: e.target.value })} />
              </FormControl>
              <FormControl>
                <FormLabel>Status</FormLabel>
                <Select value={addLeadForm.status} onChange={(e) => setAddLeadForm({ ...addLeadForm, status: e.target.value })}>
                  <option value="new">new</option>
                  <option value="qualified">qualified</option>
                  <option value="nurturing">nurturing</option>
                  <option value="closed">closed</option>
                  <option value="converted">converted</option>
                </Select>
              </FormControl>
              <FormControl gridColumn={{ base: 'span 1', md: 'span 2' }}>
                <FormLabel>Notes</FormLabel>
                <Textarea value={addLeadForm.notes} onChange={(e) => setAddLeadForm({ ...addLeadForm, notes: e.target.value })} />
              </FormControl>
            </SimpleGrid>
            <Text fontSize="xs" color="gray.500" mt={3}>
              For sheet-backed clients this saves in ODCRM first, then attempts Google Sheets outbound sync.
            </Text>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => setIsAddLeadOpen(false)}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleCreateLead} isLoading={isCreatingLead}>
              Save Lead
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isEditLeadOpen} onClose={() => { setIsEditLeadOpen(false); setEditingLeadId(null) }} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Lead</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
              <FormControl>
                <FormLabel>Date</FormLabel>
                <Input type="date" value={editLeadForm.occurredAt} onChange={(e) => setEditLeadForm({ ...editLeadForm, occurredAt: e.target.value })} />
              </FormControl>
              <FormControl>
                <FormLabel>Full Name</FormLabel>
                <Input value={editLeadForm.fullName} onChange={(e) => setEditLeadForm({ ...editLeadForm, fullName: e.target.value })} />
              </FormControl>
              <FormControl>
                <FormLabel>Email</FormLabel>
                <Input type="email" value={editLeadForm.email} onChange={(e) => setEditLeadForm({ ...editLeadForm, email: e.target.value })} />
              </FormControl>
              <FormControl>
                <FormLabel>Phone</FormLabel>
                <Input value={editLeadForm.phone} onChange={(e) => setEditLeadForm({ ...editLeadForm, phone: e.target.value })} />
              </FormControl>
              <FormControl>
                <FormLabel>Company</FormLabel>
                <Input value={editLeadForm.company} onChange={(e) => setEditLeadForm({ ...editLeadForm, company: e.target.value })} />
              </FormControl>
              <FormControl>
                <FormLabel>Job Title</FormLabel>
                <Input value={editLeadForm.jobTitle} onChange={(e) => setEditLeadForm({ ...editLeadForm, jobTitle: e.target.value })} />
              </FormControl>
              <FormControl>
                <FormLabel>Location</FormLabel>
                <Input value={editLeadForm.location} onChange={(e) => setEditLeadForm({ ...editLeadForm, location: e.target.value })} />
              </FormControl>
              <FormControl>
                <FormLabel>Source / Channel</FormLabel>
                <Input value={editLeadForm.source} onChange={(e) => setEditLeadForm({ ...editLeadForm, source: e.target.value })} />
              </FormControl>
              <FormControl>
                <FormLabel>Owner / Employee</FormLabel>
                <Input value={editLeadForm.owner} onChange={(e) => setEditLeadForm({ ...editLeadForm, owner: e.target.value })} />
              </FormControl>
              <FormControl>
                <FormLabel>Status</FormLabel>
                <Select value={editLeadForm.status} onChange={(e) => setEditLeadForm({ ...editLeadForm, status: e.target.value })}>
                  <option value="new">new</option>
                  <option value="qualified">qualified</option>
                  <option value="nurturing">nurturing</option>
                  <option value="closed">closed</option>
                  <option value="converted">converted</option>
                </Select>
              </FormControl>
              <FormControl gridColumn={{ base: 'span 1', md: 'span 2' }}>
                <FormLabel>Notes</FormLabel>
                <Textarea value={editLeadForm.notes} onChange={(e) => setEditLeadForm({ ...editLeadForm, notes: e.target.value })} />
              </FormControl>
            </SimpleGrid>
            <Text fontSize="xs" color="gray.500" mt={3}>
              For sheet-backed clients this saves edits in ODCRM first, then attempts a row-targeted Google Sheets update.
            </Text>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => { setIsEditLeadOpen(false); setEditingLeadId(null) }}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleUpdateLead} isLoading={isUpdatingLead}>
              Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Stack>
  )
}

export default LeadsTab
