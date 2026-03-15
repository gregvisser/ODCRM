import {
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Box,
  Button,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  IconButton,
  Input,
  Link,
  Select,
  SimpleGrid,
  Spinner,
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
import { DeleteIcon } from '@chakra-ui/icons'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../../utils/api'
import { useI18n } from '../../../contexts/I18nContext'
import { useScopedCustomerSelection } from '../../../hooks/useCustomerScope'
import { useCustomersFromDatabase } from '../../../hooks/useCustomersFromDatabase'

type SuppressionEntry = {
  id: string
  customerId: string
  type: 'domain' | 'email'
  value: string
  reason?: string | null
  source?: string | null
  sourceFileName?: string | null
  createdAt: string
}

type SuppressionEntriesResponse = {
  entries: SuppressionEntry[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

type SheetKind = 'email' | 'domain'

type SheetImportResult = {
  success: boolean
  type: SheetKind
  mode: 'append' | 'replace'
  sheetTitle: string
  sheetUrl: string
  gid?: string | null
  totalRows: number
  inserted: number
  updated?: number
  deleted?: number
  unchanged?: number
  duplicates: number
  replacedCount: number
  invalid: string[]
  headers: string[]
}

type SuppressionSheetHealth = {
  configured: boolean
  sheetUrl: string | null
  gid: string | null
  lastImportStatus: string | null
  lastImportedAt: string | null
  lastSourceLabel: string | null
  lastError: string | null
  totalEntries: number
}

type ProtectionStatus = {
  colorScheme: 'blue' | 'green' | 'orange'
  label: string
  description: string
}

function getProtectionStatus(kind: SheetKind, health: SuppressionSheetHealth | null | undefined, awaitingHealth: boolean): ProtectionStatus {
  const protectionLabel = kind === 'email' ? 'email suppression' : 'domain suppression'

  if (awaitingHealth) {
    return {
      colorScheme: 'blue',
      label: 'Checking',
      description: `Checking whether ${protectionLabel} is connected and current for this client.`,
    }
  }

  if (!health?.configured) {
    return {
      colorScheme: 'orange',
      label: 'Not connected',
      description: `No source is connected yet. Connect a source before relying on ${protectionLabel}.`,
    }
  }

  if (health.lastImportStatus === 'error') {
    return {
      colorScheme: 'orange',
      label: 'Needs attention',
      description: `The connected source needs review${health.lastError ? `: ${health.lastError}` : '.'}`,
    }
  }

  if ((health.totalEntries ?? 0) === 0) {
    return {
      colorScheme: 'green',
      label: 'Connected',
      description: 'The connected source is current and the protection list is live, but it is currently empty.',
    }
  }

  return {
    colorScheme: 'green',
    label: 'Protected',
    description: `The connected source is current and actively protecting this client's ${kind === 'email' ? 'email' : 'domain'} sends.`,
  }
}

export default function ComplianceTab() {
  const { t } = useI18n()
  const DEFAULT_PAGE_SIZE = 50
  const { customers, loading: customersLoading, error: customersError } = useCustomersFromDatabase()
  const [entries, setEntries] = useState<SuppressionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const { customerHeaders, customerId, setCustomerId } = useScopedCustomerSelection()
  const [listTypeFilter, setListTypeFilter] = useState<SheetKind>('email')
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, pageSize: DEFAULT_PAGE_SIZE, total: 0, totalPages: 1 })
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')
  const [sheetUrls, setSheetUrls] = useState<Record<SheetKind, string>>({ email: '', domain: '' })
  const [sheetEditorOpen, setSheetEditorOpen] = useState<Record<SheetKind, boolean>>({ email: false, domain: false })
  const [importingKind, setImportingKind] = useState<SheetKind | null>(null)
  const [importResults, setImportResults] = useState<Partial<Record<SheetKind, SheetImportResult | null>>>({})
  const [suppressionSheetHealth, setSuppressionSheetHealth] = useState<{ email: SuppressionSheetHealth; domain: SuppressionSheetHealth } | null>(null)
  const [dataHealthLoading, setDataHealthLoading] = useState(false)
  const [dataHealthError, setDataHealthError] = useState<string | null>(null)
  const toast = useToast()

  const selectedCustomer = useMemo(
    () => (Array.isArray(customers) ? customers.find((customer) => customer.id === customerId) ?? null : null),
    [customerId, customers],
  )

  const protectionOverview = useMemo(() => {
    const emailHealth = suppressionSheetHealth?.email
    const domainHealth = suppressionSheetHealth?.domain
    const connectedCount = [emailHealth, domainHealth].filter((health) => Boolean(health?.configured)).length
    const attentionCount = [emailHealth, domainHealth].filter((health) => !health?.configured || health?.lastImportStatus === 'error').length

    return {
      connectedCount,
      attentionCount,
      emailEntries: emailHealth?.totalEntries ?? 0,
      domainEntries: domainHealth?.totalEntries ?? 0,
    }
  }, [suppressionSheetHealth])

  const loadEntries = useCallback(async () => {
    if (!customerId) {
      setEntries([])
      setPagination({ page: 1, pageSize: DEFAULT_PAGE_SIZE, total: 0, totalPages: 1 })
      setLoading(false)
      return
    }
    setLoading(true)
    const params = new URLSearchParams({
      customerId,
      type: listTypeFilter,
      page: String(currentPage),
      pageSize: String(DEFAULT_PAGE_SIZE),
    })
    const { data, error } = await api.get<SuppressionEntriesResponse>(`/api/suppression?${params.toString()}`)
    if (error) {
      toast({ title: 'Error loading suppression entries', description: error, status: 'error' })
    } else {
      const next = data || { entries: [], page: 1, pageSize: DEFAULT_PAGE_SIZE, total: 0, totalPages: 1 }
      setEntries(next.entries || [])
      setPagination({
        page: next.page || 1,
        pageSize: next.pageSize || DEFAULT_PAGE_SIZE,
        total: next.total || 0,
        totalPages: next.totalPages || 1,
      })
      if (currentPage > (next.totalPages || 1)) {
        setCurrentPage(next.totalPages || 1)
      }
    }
    setLoading(false)
  }, [customerId, currentPage, listTypeFilter, toast])

  const loadSuppressionHealth = useCallback(async () => {
    if (!customerId) {
      setSuppressionSheetHealth(null)
      setDataHealthError(null)
      setDataHealthLoading(false)
      return
    }

    setDataHealthLoading(true)
    setDataHealthError(null)
    const { data, error } = await api.get<{ suppressionSheets?: { email: SuppressionSheetHealth; domain: SuppressionSheetHealth } }>(
      `/api/suppression/health?customerId=${customerId}`,
    )

    if (error) {
      setDataHealthError(error)
      setSuppressionSheetHealth(null)
      setDataHealthLoading(false)
      return
    }

    const sheets = data?.suppressionSheets
    if (sheets?.email && sheets?.domain) {
      setSuppressionSheetHealth(sheets)
      setSheetUrls((prev) => ({
        email: prev.email.trim() || sheets.email.sheetUrl || '',
        domain: prev.domain.trim() || sheets.domain.sheetUrl || '',
      }))
    } else {
      setSuppressionSheetHealth(null)
    }

    setDataHealthLoading(false)
  }, [customerId])

  useEffect(() => {
    if (customerId) void loadEntries()
  }, [customerId, currentPage, listTypeFilter, loadEntries])

  useEffect(() => {
    if (customerId) void loadSuppressionHealth()
  }, [customerId, loadSuppressionHealth])

  const handleCustomerChange = useCallback((nextCustomerId: string) => {
    setCustomerId(nextCustomerId)
    setEntries([])
    setCurrentPage(1)
    setPagination({ page: 1, pageSize: DEFAULT_PAGE_SIZE, total: 0, totalPages: 1 })
    setImportResults({})
    setSuppressionSheetHealth(null)
    setDataHealthError(null)
    setSheetUrls({ email: '', domain: '' })
    setSheetEditorOpen({ email: false, domain: false })
    setLoading(Boolean(nextCustomerId))
  }, [setCustomerId])

  useEffect(() => {
    setCurrentPage(1)
  }, [listTypeFilter])

  const handleAdd = async () => {
    if (!customerId) {
      toast({ title: 'Select a client first', description: 'Choose the target client before adding suppression entries.', status: 'warning' })
      return
    }
    const normalized = value.trim().toLowerCase()
    if (!normalized) {
      toast({ title: 'Value is required', status: 'error' })
      return
    }
    const { error } = await api.post(`/api/suppression?customerId=${customerId}`, {
      type: listTypeFilter,
      value: normalized,
      reason: reason.trim() || undefined,
      source: 'manual',
    }, { headers: customerHeaders })
    if (error) {
      toast({ title: 'Failed to add entry', description: error, status: 'error' })
      return
    }
    setValue('')
    setReason('')
    toast({ title: 'Suppression entry added', status: 'success' })
    if (currentPage !== 1) {
      setCurrentPage(1)
      await loadSuppressionHealth()
      return
    }
    await loadEntries()
    await loadSuppressionHealth()
  }

  const handleDelete = async (id: string) => {
    if (!customerId) {
      toast({ title: 'Select a client first', description: 'Choose the target client before removing suppression entries.', status: 'warning' })
      return
    }
    const snapshot = entries
    setEntries((prev) => prev.filter((entry) => entry.id !== id))
    const { error } = await api.delete(`/api/suppression/${id}?customerId=${customerId}`, { headers: customerHeaders })
    if (error) {
      setEntries(snapshot)
      toast({ title: 'Delete failed', description: error, status: 'error' })
      return
    }
    toast({ title: 'Entry removed', status: 'success' })
    if (entries.length === 1 && currentPage > 1) {
      setCurrentPage((prev) => Math.max(1, prev - 1))
      await loadSuppressionHealth()
      return
    }
    await loadEntries()
    await loadSuppressionHealth()
  }

  const handleSheetSync = async (kind: SheetKind, overrideSheetUrl?: string) => {
    if (!customerId) {
      toast({ title: 'Select a client first', description: 'Choose the target client before connecting a suppression sheet.', status: 'warning' })
      return
    }

    const nextSheetUrl = String(overrideSheetUrl ?? sheetUrls[kind] ?? '').trim()
    if (!nextSheetUrl) {
      toast({ title: 'Google Sheet URL is required', status: 'error' })
      return
    }

    setImportingKind(kind)
    const endpoint =
      kind === 'email'
        ? `/api/suppression/emails/import-sheet?customerId=${customerId}`
        : `/api/suppression/domains/import-sheet?customerId=${customerId}`

    const { data, error } = await api.post<SheetImportResult>(endpoint, {
      sheetUrl: nextSheetUrl,
      mode: 'replace',
      sourceLabel: kind === 'email' ? 'google-sheet:email-dnc' : 'google-sheet:domain-dnc',
    }, { headers: customerHeaders })

    if (error) {
      toast({ title: 'Sheet sync failed', description: error, status: 'error', duration: 6000 })
      setImportingKind(null)
      await loadSuppressionHealth()
      return
    }

    setImportResults((prev) => ({ ...prev, [kind]: data || null }))
    setSheetUrls((prev) => ({ ...prev, [kind]: data?.sheetUrl || prev[kind] }))
    toast({
      title: kind === 'email' ? 'Email DNC synced' : 'Domain DNC synced',
      description:
        (data?.totalRows ?? 0) > 0
          ? `Synced ${data?.inserted ?? 0} new, ${data?.updated ?? 0} updated, ${data?.deleted ?? 0} removed.`
          : 'Connected sheet is valid and currently empty.',
      status: 'success',
    })
    if (currentPage !== 1) {
      setCurrentPage(1)
      await loadSuppressionHealth()
      if (data?.sheetUrl) {
        setSheetEditorOpen((prev) => ({ ...prev, [kind]: false }))
      }
      setImportingKind(null)
      return
    }
    await loadEntries()
    await loadSuppressionHealth()
    if (data?.sheetUrl) {
      setSheetEditorOpen((prev) => ({ ...prev, [kind]: false }))
    }
    setImportingKind(null)
  }

  const renderSheetCard = (kind: SheetKind) => {
    const health = suppressionSheetHealth?.[kind]
    const result = importResults[kind]
    const label = kind === 'email' ? 'Email suppression source' : 'Domain suppression source'
    const awaitingHealth = dataHealthLoading && !suppressionSheetHealth
    const isConnected = Boolean(health?.configured)
    const editorOpen = sheetEditorOpen[kind]
    const statusText = awaitingHealth
      ? 'Checking the linked Google Sheet for this client.'
      : !health?.configured
      ? 'Add the Google Sheet URL used for this protection source.'
      : health?.lastImportStatus === 'error'
        ? `Last source sync failed${health.lastError ? `: ${health.lastError}` : '.'}`
        : (health.totalEntries ?? 0) === 0
          ? 'Linked source is connected and currently empty.'
          : 'Linked source is connected. Use it to refresh or replace this protection list when needed.'

    return (
      <Box key={kind} borderWidth="1px" borderRadius="lg" p={4} bg="white">
        <VStack align="stretch" spacing={3}>
          <HStack justify="space-between" flexWrap="wrap">
            <Heading size="sm">{label}</Heading>
            <Badge colorScheme={awaitingHealth ? 'blue' : health?.configured ? 'green' : 'orange'}>
              {awaitingHealth ? 'Checking…' : health?.configured ? 'Connected' : 'Not connected'}
            </Badge>
          </HStack>

          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={2}>
            <Text fontSize="sm" color="gray.600">
              Entries: {health?.totalEntries ?? 0}
            </Text>
            <Text fontSize="sm" color="gray.600">
              Last import: {health?.lastImportedAt ? new Date(health.lastImportedAt).toLocaleString() : 'Never'}
            </Text>
          </SimpleGrid>

          <Text fontSize="sm" color={health?.lastImportStatus === 'error' ? 'red.600' : 'gray.600'}>
            {statusText}
          </Text>

          {health?.sheetUrl ? (
            <Link fontSize="sm" color="blue.600" href={health.sheetUrl} isExternal>
              Open linked source
            </Link>
          ) : null}

          <HStack spacing={3} flexWrap="wrap">
            <Button
              colorScheme="teal"
              onClick={() => void handleSheetSync(kind, isConnected ? health?.sheetUrl || undefined : undefined)}
              isLoading={importingKind === kind}
              isDisabled={awaitingHealth}
              loadingText={isConnected ? 'Syncing' : 'Connecting'}
            >
              {isConnected ? 'Sync source now' : 'Connect source'}
            </Button>
            {isConnected ? (
              <Button
                variant="outline"
                onClick={() => setSheetEditorOpen((prev) => ({ ...prev, [kind]: !prev[kind] }))}
              >
                {editorOpen ? 'Hide source settings' : 'Show source settings'}
              </Button>
            ) : null}
          </HStack>

          {!awaitingHealth && (!isConnected || editorOpen) ? (
            <FormControl>
              <FormLabel fontSize="sm">Google Sheet URL</FormLabel>
              <Input
                value={sheetUrls[kind]}
                onChange={(e) => {
                  const nextUrl = e.target.value
                  setSheetUrls((prev) => ({ ...prev, [kind]: nextUrl }))
                }}
                placeholder="https://docs.google.com/spreadsheets/d/..."
              />
            </FormControl>
          ) : null}

          {isConnected && editorOpen && !awaitingHealth ? (
            <Button
              variant="outline"
              onClick={() => void handleSheetSync(kind)}
              isLoading={importingKind === kind}
              loadingText="Updating"
            >
              Replace linked source
            </Button>
          ) : null}

          {result && !awaitingHealth ? (
            <HStack spacing={2} flexWrap="wrap">
              <Badge colorScheme="green">Inserted: {result.inserted}</Badge>
              <Badge colorScheme="blue">Updated: {result.updated ?? 0}</Badge>
              <Badge colorScheme="red">Removed: {result.deleted ?? result.replacedCount}</Badge>
              <Badge colorScheme="yellow">Unchanged: {result.unchanged ?? result.duplicates}</Badge>
              <Badge colorScheme="blue">Rows: {result.totalRows}</Badge>
            </HStack>
          ) : null}
        </VStack>
      </Box>
    )
  }

  const renderProtectionCard = (kind: SheetKind) => {
    const health = suppressionSheetHealth?.[kind]
    const awaitingHealth = dataHealthLoading && !suppressionSheetHealth
    const status = getProtectionStatus(kind, health, awaitingHealth)
    const title = kind === 'email' ? 'Email suppression' : 'Domain suppression'
    const entryLabel = kind === 'email' ? 'Protected emails' : 'Protected domains'

    return (
      <Box key={kind} borderWidth="1px" borderRadius="lg" p={4} bg="white">
        <VStack align="stretch" spacing={3}>
          <HStack justify="space-between" flexWrap="wrap">
            <Heading size="sm">{title}</Heading>
            <Badge colorScheme={status.colorScheme}>{status.label}</Badge>
          </HStack>

          <SimpleGrid columns={{ base: 2 }} spacing={3}>
            <Box>
              <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wide">
                {entryLabel}
              </Text>
              <Text fontSize="xl" fontWeight="semibold">
                {health?.totalEntries ?? 0}
              </Text>
            </Box>
            <Box>
              <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wide">
                Last checked
              </Text>
              <Text fontSize="sm" color="gray.700">
                {health?.lastImportedAt ? new Date(health.lastImportedAt).toLocaleString() : 'Not yet'}
              </Text>
            </Box>
          </SimpleGrid>

          <Text fontSize="sm" color="gray.600">
            {status.description}
          </Text>

          <HStack spacing={3} flexWrap="wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setListTypeFilter(kind)
                setCurrentPage(1)
              }}
            >
              {kind === 'email' ? 'Review protected emails' : 'Review protected domains'}
            </Button>
            <Button
              size="sm"
              colorScheme={health?.configured ? 'teal' : 'blue'}
              variant={health?.configured ? 'outline' : 'solid'}
              isDisabled={awaitingHealth}
              isLoading={importingKind === kind}
              loadingText={health?.configured ? 'Syncing' : 'Opening'}
              onClick={() => {
                if (health?.configured && health.sheetUrl) {
                  void handleSheetSync(kind, health.sheetUrl)
                  return
                }
                setSheetEditorOpen((prev) => ({ ...prev, [kind]: true }))
              }}
            >
              {health?.configured ? 'Re-sync source' : 'Connect source'}
            </Button>
            {health?.configured ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSheetEditorOpen((prev) => ({ ...prev, [kind]: true }))}
              >
                Replace source
              </Button>
            ) : null}
          </HStack>
        </VStack>
      </Box>
    )
  }

  return (
    <Box id="suppression-tab-panel" data-testid="suppression-tab-panel">
      <VStack align="stretch" spacing={6}>
        <Box>
          <Heading size="lg" mb={2}>{t('compliance.title')}</Heading>
          <Text fontSize="sm" color="gray.600">
            Check whether email and domain suppression protections are connected, current, and safe for this client.
          </Text>
        </Box>

        <Box borderWidth="1px" borderRadius="lg" p={4} bg="white">
          <VStack align="stretch" spacing={3}>
            <HStack justify="space-between" align="flex-start" flexWrap="wrap">
              <Box>
                <Heading size="sm">Client</Heading>
                <Text fontSize="sm" color="gray.600">
                  Suppression data is client-specific.
                </Text>
              </Box>
              <Badge colorScheme={customerId ? 'blue' : 'orange'}>
                {selectedCustomer?.name || (customerId ? 'Client selected' : 'No client selected')}
              </Badge>
            </HStack>

            <FormControl>
              <FormLabel fontSize="sm">Client</FormLabel>
              <Select
                value={customerId}
                onChange={(e) => handleCustomerChange(e.target.value)}
                placeholder={customersLoading ? 'Loading clients...' : 'Select a client'}
                isDisabled={customersLoading}
              >
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </Select>
            </FormControl>

            {customersError ? (
              <Alert status="error">
                <AlertIcon />
                <AlertDescription fontSize="sm">{customersError}</AlertDescription>
              </Alert>
            ) : null}
          </VStack>
        </Box>

        {!customerId ? (
          <Alert status="warning">
            <AlertIcon />
            <AlertDescription fontSize="sm">
              Select a client before reviewing protection status or changing suppression entries.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <Box borderWidth="1px" borderRadius="lg" p={4} bg="white">
              <VStack align="stretch" spacing={4}>
                {dataHealthLoading && !suppressionSheetHealth ? (
                  <Alert status="info">
                    <AlertIcon />
                    <AlertDescription fontSize="sm">
                      Checking this client&apos;s suppression protections.
                    </AlertDescription>
                  </Alert>
                ) : dataHealthError ? (
                  <Alert status="warning">
                    <AlertIcon />
                    <AlertDescription fontSize="sm">
                      Protection status could not be checked right now. Use the follow-up section below to refresh and review source details.
                    </AlertDescription>
                  </Alert>
                ) : protectionOverview.attentionCount > 0 ? (
                  <Alert status="warning">
                    <AlertIcon />
                    <AlertDescription fontSize="sm">
                      {protectionOverview.connectedCount} of 2 protection sources are connected. Review any source that is missing or needs attention before relying on suppression coverage.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert status="success">
                    <AlertIcon />
                    <AlertDescription fontSize="sm">
                      Email and domain suppression protections are connected for this client.
                    </AlertDescription>
                  </Alert>
                )}

                <Box>
                  <Heading size="sm" mb={1}>Protection status</Heading>
                  <Text fontSize="sm" color="gray.600">
                    Start here to see whether email and domain protections are connected, current, and ready to use.
                  </Text>
                </Box>

                <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={4}>
                  {renderProtectionCard('email')}
                  {renderProtectionCard('domain')}
                </SimpleGrid>
              </VStack>
            </Box>

            <Box id="suppression-tab-manual-panel" data-testid="suppression-tab-manual-panel" borderWidth="1px" borderRadius="lg" p={4} bg="white">
              <VStack align="stretch" spacing={4}>
                <HStack justify="space-between" flexWrap="wrap">
                  <Box>
                    <Heading size="sm">Add protected email or domain</Heading>
                    <Text fontSize="sm" color="gray.600">
                      Use manual entries for quick removals or corrections. Source setup and refresh detail stay lower down.
                    </Text>
                  </Box>
                  <HStack>
                    <Button
                      size="sm"
                      variant={listTypeFilter === 'email' ? 'solid' : 'outline'}
                      colorScheme="blue"
                      onClick={() => setListTypeFilter('email')}
                    >
                      Email suppression
                    </Button>
                    <Button
                      size="sm"
                      variant={listTypeFilter === 'domain' ? 'solid' : 'outline'}
                      colorScheme="purple"
                      onClick={() => setListTypeFilter('domain')}
                    >
                      Domain suppression
                    </Button>
                  </HStack>
                </HStack>

                <Text fontSize="sm" color="gray.600">
                  Showing {entries.length} of {pagination.total} protected {listTypeFilter === 'email' ? 'emails' : 'domains'}.
                </Text>

                <HStack spacing={3} align="flex-end" flexWrap="wrap">
                  <FormControl flex="1" minW={{ base: '100%', md: '220px' }}>
                    <FormLabel fontSize="sm">Value</FormLabel>
                    <Input
                      placeholder={listTypeFilter === 'email' ? 'person@company.com' : 'company.com'}
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                    />
                  </FormControl>
                  <FormControl flex="1" minW={{ base: '100%', md: '240px' }}>
                    <FormLabel fontSize="sm">Reason (optional)</FormLabel>
                    <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Requested removal" />
                  </FormControl>
                  <Button id="suppression-tab-manual-add-btn" data-testid="suppression-tab-manual-add-btn" colorScheme="teal" onClick={handleAdd}>
                    Add protection
                  </Button>
                </HStack>
              </VStack>
            </Box>

            <Box id="suppression-tab-entries-table" data-testid="suppression-tab-entries-table" bg="white" borderRadius="lg" borderWidth="1px" overflowX="auto">
              <VStack align="stretch" spacing={0}>
                <Box p={4} borderBottomWidth="1px">
                  <Heading size="sm" mb={1}>
                    {listTypeFilter === 'email' ? 'Protected emails' : 'Protected domains'}
                  </Heading>
                  <Text fontSize="sm" color="gray.600">
                    Review the current protection list and remove entries that should no longer block sending.
                  </Text>
                </Box>
                {loading ? (
                  <Box textAlign="center" py={10}>
                    <Spinner size="lg" />
                  </Box>
                ) : (
                  <Table size="sm">
                    <Thead bg="gray.50">
                      <Tr>
                        <Th>Value</Th>
                        <Th>Reason</Th>
                        <Th>Added by</Th>
                        <Th>Added</Th>
                        <Th>Actions</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {entries.length === 0 ? (
                        <Tr>
                          <Td colSpan={5} textAlign="center" py={8}>
                            <Text color="gray.500">
                              {`No protected ${listTypeFilter === 'email' ? 'emails' : 'domains'} found for ${selectedCustomer?.name || 'the selected client'}.`}
                            </Text>
                          </Td>
                        </Tr>
                      ) : (
                        entries.map((entry) => (
                          <Tr key={entry.id}>
                            <Td>{entry.value}</Td>
                            <Td>{entry.reason || '—'}</Td>
                            <Td>{entry.source || 'manual'}</Td>
                            <Td>{new Date(entry.createdAt).toLocaleString()}</Td>
                            <Td>
                              <IconButton
                                aria-label="Delete suppression entry"
                                icon={<DeleteIcon />}
                                size="sm"
                                variant="ghost"
                                colorScheme="red"
                                onClick={() => void handleDelete(entry.id)}
                              />
                            </Td>
                          </Tr>
                        ))
                      )}
                    </Tbody>
                  </Table>
                )}
              </VStack>
            </Box>

            <HStack justify="space-between" flexWrap="wrap">
              <Text fontSize="sm" color="gray.600">
                Page {pagination.page} of {pagination.totalPages}
              </Text>
              <HStack>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  isDisabled={pagination.page <= 1 || loading}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentPage((prev) => Math.min(pagination.totalPages, prev + 1))}
                  isDisabled={pagination.page >= pagination.totalPages || loading}
                >
                  Next
                </Button>
              </HStack>
            </HStack>

            <Box borderWidth="1px" borderRadius="lg" p={4} bg="gray.50">
              <VStack align="stretch" spacing={4}>
                <HStack justify="space-between" flexWrap="wrap">
                  <Box>
                    <Heading size="sm">Source setup & troubleshooting</Heading>
                    <Text fontSize="sm" color="gray.600">
                      Secondary detail for Google Sheet links, refresh checks, sync results, and source replacement.
                    </Text>
                  </Box>
                  <Button size="xs" variant="outline" onClick={() => void loadSuppressionHealth()} isLoading={dataHealthLoading}>
                    Refresh protection status
                  </Button>
                </HStack>

                {dataHealthError ? (
                  <Alert status="error">
                    <AlertIcon />
                    <AlertDescription fontSize="sm">{dataHealthError}</AlertDescription>
                  </Alert>
                ) : null}

                <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={4}>
                  {renderSheetCard('email')}
                  {renderSheetCard('domain')}
                </SimpleGrid>
              </VStack>
            </Box>
          </>
        )}
      </VStack>
    </Box>
  )
}
