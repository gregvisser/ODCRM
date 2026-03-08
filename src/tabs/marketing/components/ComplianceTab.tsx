import { useCallback, useEffect, useMemo, useState } from 'react'
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
  Select,
  Spinner,
  SimpleGrid,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  Link,
  useToast,
  VStack,
} from '@chakra-ui/react'
import { DeleteIcon } from '@chakra-ui/icons'
import { api } from '../../../utils/api'
import { getCurrentCustomerId, onSettingsUpdated } from '../../../platform/stores/settings'
import RequireActiveClient from '../../../components/RequireActiveClient'

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

type SheetImportResult = {
  success: boolean
  type: 'email' | 'domain'
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

type LeadSourceHealthRow = {
  sourceType: string
  displayName: string
  connected: boolean
  usingGlobalConfig: boolean
  lastFetchAt: string | null
  lastError: string | null
  isLocked: boolean
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

const DEFAULT_EMAIL_DNC_URL =
  'https://docs.google.com/spreadsheets/d/1anU9DGiKVYj5LUPySpKAgDp0_bZeJv5KquJ0fExrsrw/edit?usp=drive_link'
const DEFAULT_DOMAIN_DNC_URL =
  'https://docs.google.com/spreadsheets/d/1BV6ab9e1bA5xl_DiWMmY5CnD1rjfylHKQsKt_dxd2cE/edit?usp=drive_link'

export default function ComplianceTab() {
  const [entries, setEntries] = useState<SuppressionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [customerId, setCustomerId] = useState<string>(getCurrentCustomerId())
  const [listTypeFilter, setListTypeFilter] = useState<'email' | 'domain'>('email')
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append')
  const [sheetUrl, setSheetUrl] = useState(DEFAULT_EMAIL_DNC_URL)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<SheetImportResult | null>(null)
  const [leadSourceHealth, setLeadSourceHealth] = useState<LeadSourceHealthRow[]>([])
  const [suppressionSheetHealth, setSuppressionSheetHealth] = useState<{ email: SuppressionSheetHealth; domain: SuppressionSheetHealth } | null>(null)
  const [dataHealthLoading, setDataHealthLoading] = useState(false)
  const [dataHealthError, setDataHealthError] = useState<string | null>(null)
  const toast = useToast()

  const filteredEntries = useMemo(
    () => entries.filter((e) => e.type === listTypeFilter),
    [entries, listTypeFilter]
  )

  const loadEntries = useCallback(async () => {
    if (!customerId) return
    setLoading(true)
    const { data, error } = await api.get<SuppressionEntry[]>(`/api/suppression?customerId=${customerId}`)
    if (error) {
      toast({ title: 'Error loading suppression entries', description: error, status: 'error' })
    } else {
      setEntries(data || [])
    }
    setLoading(false)
  }, [customerId, toast])

  const loadDataHealth = useCallback(async () => {
    if (!customerId) return
    setDataHealthLoading(true)
    setDataHealthError(null)
    const [leadRes, suppressionRes] = await Promise.all([
      api.get<{ sources: LeadSourceHealthRow[] }>(`/api/lead-sources?customerId=${customerId}`),
      api.get<{ success: boolean; data?: { suppressionSheets?: { email: SuppressionSheetHealth; domain: SuppressionSheetHealth } } }>(
        `/api/suppression/health?customerId=${customerId}`
      ),
    ])

    if (leadRes.error) {
      setDataHealthError(leadRes.error)
      setLeadSourceHealth([])
    } else {
      setLeadSourceHealth(Array.isArray(leadRes.data?.sources) ? leadRes.data!.sources : [])
    }

    if (suppressionRes.error) {
      setDataHealthError((prev) => prev ? `${prev} | ${suppressionRes.error}` : suppressionRes.error)
      setSuppressionSheetHealth(null)
    } else {
      const sheets = suppressionRes.data?.data?.suppressionSheets
      if (sheets?.email && sheets?.domain) setSuppressionSheetHealth(sheets)
      else setSuppressionSheetHealth(null)
    }

    setDataHealthLoading(false)
  }, [customerId])

  useEffect(() => {
    if (customerId) void loadEntries()
  }, [customerId, loadEntries])

  useEffect(() => {
    if (customerId) void loadDataHealth()
  }, [customerId, loadDataHealth])

  useEffect(() => {
    const unsubscribe = onSettingsUpdated((detail) => {
      const next = (detail as { currentCustomerId?: string } | null)?.currentCustomerId
      if (next) setCustomerId(next)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    setSheetUrl(listTypeFilter === 'email' ? DEFAULT_EMAIL_DNC_URL : DEFAULT_DOMAIN_DNC_URL)
  }, [listTypeFilter])

  const handleAdd = async () => {
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
    await loadDataHealth()
  }

  const handleDelete = async (id: string) => {
    const snapshot = entries
    setEntries((prev) => prev.filter((e) => e.id !== id))
    const { error } = await api.delete(`/api/suppression/${id}?customerId=${customerId}`)
    if (error) {
      setEntries(snapshot)
      toast({ title: 'Delete failed', description: error, status: 'error' })
      return
    }
    toast({ title: 'Entry removed', status: 'success' })
    await loadDataHealth()
  }

  const handleImportFromSheet = async () => {
    if (!sheetUrl.trim()) {
      toast({ title: 'Google Sheet URL is required', status: 'error' })
      return
    }
    setImporting(true)
    setImportResult(null)
    const endpoint =
      listTypeFilter === 'email'
        ? `/api/suppression/emails/import-sheet?customerId=${customerId}`
        : `/api/suppression/domains/import-sheet?customerId=${customerId}`
    const { data, error } = await api.post<SheetImportResult>(endpoint, {
      sheetUrl: sheetUrl.trim(),
      mode: importMode,
      sourceLabel: listTypeFilter === 'email' ? 'google-sheet:email-dnc' : 'google-sheet:domain-dnc',
    })
    if (error) {
      toast({ title: 'Import failed', description: error, status: 'error', duration: 6000 })
      setImporting(false)
      return
    }
    setImportResult(data || null)
    toast({
      title: 'Google Sheet import completed',
      description: `Inserted ${(data as SheetImportResult)?.inserted ?? 0} entries`,
      status: 'success',
    })
    await loadEntries()
    await loadDataHealth()
    setImporting(false)
  }

  return (
    <RequireActiveClient>
      <Box id="suppression-tab-panel" data-testid="suppression-tab-panel">
        <VStack align="stretch" spacing={6}>
          <Box>
            <Heading size="lg" mb={2}>Suppression List</Heading>
            <Text fontSize="sm" color="gray.600">
              Manage customer-scoped Do Not Contact rules for email addresses and domains.
            </Text>
          </Box>

          <Alert id="suppression-tab-sheet-truth-banner" data-testid="suppression-tab-sheet-truth-banner" status="info">
            <AlertIcon />
            <AlertDescription fontSize="sm">
              Google Sheets import is now the primary source of truth for suppression lists. Manual edits remain available.
            </AlertDescription>
          </Alert>

          <Box id="marketing-data-health-panel" data-testid="marketing-data-health-panel" borderWidth="1px" borderRadius="lg" p={4} bg="white">
            <VStack align="stretch" spacing={3}>
              <HStack justify="space-between" flexWrap="wrap">
                <Heading size="sm">Marketing Data Health</Heading>
                <Button size="xs" variant="outline" onClick={() => void loadDataHealth()} isLoading={dataHealthLoading}>
                  Refresh health
                </Button>
              </HStack>
              <Text fontSize="sm" color="gray.600">
                Live view of Google Sheets-linked Lead Sources and suppression list linkage/health for this client.
              </Text>
              {dataHealthError ? (
                <Alert status="error">
                  <AlertIcon />
                  <AlertDescription fontSize="sm">{dataHealthError}</AlertDescription>
                </Alert>
              ) : null}

              <Box>
                <Text fontSize="sm" fontWeight="semibold" mb={2}>Lead Sources</Text>
                <Box borderWidth="1px" borderRadius="md" overflowX="auto">
                  <Table size="sm">
                    <Thead bg="gray.50">
                      <Tr>
                        <Th>Source</Th>
                        <Th>Connected</Th>
                        <Th>Scope</Th>
                        <Th>Last Sync</Th>
                        <Th>Error</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {leadSourceHealth.length === 0 ? (
                        <Tr><Td colSpan={5}><Text fontSize="sm" color="gray.500">No lead source health data yet.</Text></Td></Tr>
                      ) : (
                        leadSourceHealth.map((source) => (
                          <Tr key={source.sourceType}>
                            <Td>{source.displayName}</Td>
                            <Td>
                              <Badge colorScheme={source.connected ? 'green' : 'gray'}>
                                {source.connected ? 'Connected' : 'Missing'}
                              </Badge>
                            </Td>
                            <Td>
                              <Badge variant="subtle" colorScheme={source.usingGlobalConfig ? 'purple' : 'blue'}>
                                {source.usingGlobalConfig ? 'Global' : 'Customer'}
                              </Badge>
                            </Td>
                            <Td>{source.lastFetchAt ? new Date(source.lastFetchAt).toLocaleString() : 'Never'}</Td>
                            <Td>
                              <Text fontSize="xs" color={source.lastError ? 'red.600' : 'gray.500'}>
                                {source.lastError || 'OK'}
                              </Text>
                            </Td>
                          </Tr>
                        ))
                      )}
                    </Tbody>
                  </Table>
                </Box>
              </Box>

              <Box>
                <Text fontSize="sm" fontWeight="semibold" mb={2}>Suppression Sheets</Text>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                  {(['email', 'domain'] as const).map((kind) => {
                    const h = suppressionSheetHealth?.[kind]
                    return (
                      <Box key={kind} borderWidth="1px" borderRadius="md" p={3}>
                        <HStack justify="space-between" mb={1}>
                          <Text fontWeight="semibold">{kind === 'email' ? 'Email DNC' : 'Domain DNC'}</Text>
                          <Badge colorScheme={h?.configured ? 'green' : 'orange'}>
                            {h?.configured ? 'Sheet linked' : 'Sheet missing'}
                          </Badge>
                        </HStack>
                        <Text fontSize="xs" color="gray.600">Entries: {h?.totalEntries ?? 0}</Text>
                        <Text fontSize="xs" color="gray.600">Last import: {h?.lastImportedAt ? new Date(h.lastImportedAt).toLocaleString() : 'Never'}</Text>
                        <Text fontSize="xs" color={h?.lastImportStatus === 'error' ? 'red.600' : 'gray.600'}>
                          Status: {h?.lastImportStatus || 'unknown'}
                        </Text>
                        {h?.sheetUrl ? (
                          <Link fontSize="xs" color="blue.600" href={h.sheetUrl} isExternal>
                            Open linked sheet
                          </Link>
                        ) : (
                          <Text fontSize="xs" color="orange.600">
                            No persisted sheet URL yet. Import from Google Sheet to link.
                          </Text>
                        )}
                        {h?.lastError ? (
                          <Text fontSize="xs" color="red.600">Error: {h.lastError}</Text>
                        ) : null}
                      </Box>
                    )
                  })}
                </SimpleGrid>
              </Box>
            </VStack>
          </Box>

          <Box id="suppression-tab-import-panel" data-testid="suppression-tab-import-panel" borderWidth="1px" borderRadius="lg" p={4} bg="white">
            <VStack align="stretch" spacing={4}>
              <HStack justify="space-between" flexWrap="wrap">
                <Heading size="sm">Google Sheet Import</Heading>
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

              <FormControl>
                <FormLabel fontSize="sm">Google Sheet URL</FormLabel>
                <Input value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." />
              </FormControl>

              <HStack align="flex-end" spacing={3} flexWrap="wrap">
                <FormControl w={{ base: '100%', md: '220px' }}>
                  <FormLabel fontSize="sm">Import mode</FormLabel>
                  <Select value={importMode} onChange={(e) => setImportMode(e.target.value as 'append' | 'replace')}>
                    <option value="append">Append (safe)</option>
                    <option value="replace">Replace all {listTypeFilter}s</option>
                  </Select>
                </FormControl>
                <Button id="suppression-tab-import-btn" data-testid="suppression-tab-import-btn" colorScheme="teal" onClick={handleImportFromSheet} isLoading={importing} loadingText="Importing">
                  Import {listTypeFilter === 'email' ? 'Emails' : 'Domains'} From Sheet
                </Button>
              </HStack>

              {importResult ? (
                <Box borderWidth="1px" borderRadius="md" p={3}>
                  <HStack spacing={3} flexWrap="wrap">
                    <Badge colorScheme="green">Inserted: {importResult.inserted}</Badge>
                    <Badge colorScheme="yellow">Duplicates: {importResult.duplicates}</Badge>
                    <Badge colorScheme="blue">Rows: {importResult.totalRows}</Badge>
                    {importResult.mode === 'replace' ? (
                      <Badge colorScheme="red">Replaced: {importResult.replacedCount}</Badge>
                    ) : null}
                    <Badge>{importResult.sheetTitle}</Badge>
                  </HStack>
                  {importResult.invalid.length > 0 ? (
                    <Text fontSize="xs" color="red.600" mt={2}>
                      Invalid values (first {Math.min(importResult.invalid.length, 20)}): {importResult.invalid.slice(0, 20).join(', ')}
                    </Text>
                  ) : null}
                </Box>
              ) : null}
            </VStack>
          </Box>

          <Box id="suppression-tab-manual-panel" data-testid="suppression-tab-manual-panel" borderWidth="1px" borderRadius="lg" p={4} bg="white">
            <Heading size="sm" mb={3}>Manual Entry</Heading>
            <HStack spacing={3} align="flex-end" flexWrap="wrap">
              <FormControl w={{ base: '100%', md: '180px' }}>
                <FormLabel fontSize="sm">Type</FormLabel>
                <Select value={listTypeFilter} onChange={(e) => setListTypeFilter(e.target.value as 'email' | 'domain')}>
                  <option value="email">Email</option>
                  <option value="domain">Domain</option>
                </Select>
              </FormControl>
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
              <Button id="suppression-tab-manual-add-btn" data-testid="suppression-tab-manual-add-btn" colorScheme="teal" onClick={handleAdd}>Add</Button>
            </HStack>
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
                        <Text color="gray.500">No suppressed {listTypeFilter}s found.</Text>
                      </Td>
                    </Tr>
                  ) : (
                    filteredEntries.map((entry) => (
                      <Tr key={entry.id}>
                        <Td fontWeight="medium">{entry.value}</Td>
                        <Td>{entry.reason || '-'}</Td>
                        <Td>{entry.source || '-'}</Td>
                        <Td>{new Date(entry.createdAt).toLocaleString()}</Td>
                        <Td>
                          <IconButton
                            aria-label="Remove entry"
                            icon={<DeleteIcon />}
                            size="xs"
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
        </VStack>
      </Box>
    </RequireActiveClient>
  )
}
