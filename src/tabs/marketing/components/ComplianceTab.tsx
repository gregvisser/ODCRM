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
import { clearCurrentCustomerId, getCurrentCustomerId, onSettingsUpdated, setCurrentCustomerId } from '../../../platform/stores/settings'
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

export default function ComplianceTab() {
  const { customers, loading: customersLoading, error: customersError } = useCustomersFromDatabase()
  const [entries, setEntries] = useState<SuppressionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [customerId, setCustomerId] = useState<string>(getCurrentCustomerId())
  const [listTypeFilter, setListTypeFilter] = useState<SheetKind>('email')
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

  const filteredEntries = useMemo(
    () => entries.filter((entry) => entry.type === listTypeFilter),
    [entries, listTypeFilter],
  )

  const loadEntries = useCallback(async () => {
    if (!customerId) {
      setEntries([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await api.get<SuppressionEntry[]>(`/api/suppression?customerId=${customerId}`)
    if (error) {
      toast({ title: 'Error loading suppression entries', description: error, status: 'error' })
    } else {
      setEntries(data || [])
    }
    setLoading(false)
  }, [customerId, toast])

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
  }, [customerId, loadEntries])

  useEffect(() => {
    if (customerId) void loadSuppressionHealth()
  }, [customerId, loadSuppressionHealth])

  useEffect(() => {
    const unsubscribe = onSettingsUpdated((detail) => {
      const next = (detail as { currentCustomerId?: string } | null)?.currentCustomerId
      setCustomerId(next || '')
    })
    return () => unsubscribe()
  }, [])

  const handleCustomerChange = useCallback((nextCustomerId: string) => {
    setCustomerId(nextCustomerId)
    setEntries([])
    setImportResults({})
    setSuppressionSheetHealth(null)
    setDataHealthError(null)
    setSheetUrls({ email: '', domain: '' })
    setSheetEditorOpen({ email: false, domain: false })
    setLoading(Boolean(nextCustomerId))
    if (nextCustomerId) {
      setCurrentCustomerId(nextCustomerId)
      return
    }
    clearCurrentCustomerId()
  }, [])

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
    })
    if (error) {
      toast({ title: 'Failed to add entry', description: error, status: 'error' })
      return
    }
    setValue('')
    setReason('')
    toast({ title: 'Suppression entry added', status: 'success' })
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
    const { error } = await api.delete(`/api/suppression/${id}?customerId=${customerId}`)
    if (error) {
      setEntries(snapshot)
      toast({ title: 'Delete failed', description: error, status: 'error' })
      return
    }
    toast({ title: 'Entry removed', status: 'success' })
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
    })

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
      description: (data?.inserted ?? 0) > 0
        ? `Synced ${data?.inserted ?? 0} entries from Google Sheets.`
        : 'Connected sheet is valid and currently empty.',
      status: 'success',
    })
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
    const label = kind === 'email' ? 'Email DNC' : 'Domain DNC'
    const awaitingHealth = dataHealthLoading && !suppressionSheetHealth
    const isConnected = Boolean(health?.configured)
    const editorOpen = sheetEditorOpen[kind]
    const statusText = awaitingHealth
      ? 'Checking the linked Google Sheet for this client.'
      : !health?.configured
      ? 'Connect the Google Sheet for this client.'
      : health?.lastImportStatus === 'error'
        ? `Last sync failed${health.lastError ? `: ${health.lastError}` : '.'}`
        : (health.totalEntries ?? 0) === 0
          ? 'Connected. The linked Google Sheet is live and currently empty.'
          : 'Connected. Changes from the linked Google Sheet sync into this client list.'

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
              Open linked sheet
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
              {isConnected ? 'Sync now' : 'Connect sheet'}
            </Button>
            {isConnected ? (
              <Button
                variant="outline"
                onClick={() => setSheetEditorOpen((prev) => ({ ...prev, [kind]: !prev[kind] }))}
              >
                {editorOpen ? 'Hide advanced sheet settings' : 'Show advanced sheet settings'}
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
              Update linked sheet
            </Button>
          ) : null}

          {result && !awaitingHealth ? (
            <HStack spacing={2} flexWrap="wrap">
              <Badge colorScheme="green">Inserted: {result.inserted}</Badge>
              <Badge colorScheme="red">Replaced: {result.replacedCount}</Badge>
              <Badge colorScheme="yellow">Duplicates: {result.duplicates}</Badge>
              <Badge colorScheme="blue">Rows: {result.totalRows}</Badge>
            </HStack>
          ) : null}
        </VStack>
      </Box>
    )
  }

  return (
    <Box id="suppression-tab-panel" data-testid="suppression-tab-panel">
      <VStack align="stretch" spacing={6}>
        <Box>
          <Heading size="lg" mb={2}>Suppression List</Heading>
                <Text fontSize="sm" color="gray.600">
                  Connect each client&apos;s Email DNC and Domain DNC sheet once, then sync from the linked sheet when needed.
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
              Select a client before connecting sheets or reviewing suppression entries.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <Box borderWidth="1px" borderRadius="lg" p={4} bg="white">
              <VStack align="stretch" spacing={4}>
                <HStack justify="space-between" flexWrap="wrap">
                  <Heading size="sm">Google Sheets</Heading>
                  <Button size="xs" variant="outline" onClick={() => void loadSuppressionHealth()} isLoading={dataHealthLoading}>
                    Refresh status
                  </Button>
                </HStack>

                <Text fontSize="sm" color="gray.600">
                  Connected sheets stay linked to this client. Sync from the linked sheet without re-pasting URLs.
                </Text>

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

            <Box id="suppression-tab-manual-panel" data-testid="suppression-tab-manual-panel" borderWidth="1px" borderRadius="lg" p={4} bg="white">
              <VStack align="stretch" spacing={4}>
                <HStack justify="space-between" flexWrap="wrap">
                  <Heading size="sm">Manual Entries</Heading>
                  <HStack>
                    <Button
                      size="sm"
                      variant={listTypeFilter === 'email' ? 'solid' : 'outline'}
                      colorScheme="blue"
                      onClick={() => setListTypeFilter('email')}
                    >
                      Email DNC
                    </Button>
                    <Button
                      size="sm"
                      variant={listTypeFilter === 'domain' ? 'solid' : 'outline'}
                      colorScheme="purple"
                      onClick={() => setListTypeFilter('domain')}
                    >
                      Domain DNC
                    </Button>
                  </HStack>
                </HStack>

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
                    Add
                  </Button>
                </HStack>
              </VStack>
            </Box>

            <Box id="suppression-tab-entries-table" data-testid="suppression-tab-entries-table" bg="white" borderRadius="lg" borderWidth="1px" overflowX="auto">
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
                      <Th>Source</Th>
                      <Th>Added</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {filteredEntries.length === 0 ? (
                      <Tr>
                        <Td colSpan={5} textAlign="center" py={8}>
                          <Text color="gray.500">
                            {`No suppressed ${listTypeFilter}s found for ${selectedCustomer?.name || 'the selected client'}.`}
                          </Text>
                        </Td>
                      </Tr>
                    ) : (
                      filteredEntries.map((entry) => (
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
            </Box>
          </>
        )}
      </VStack>
    </Box>
  )
}
