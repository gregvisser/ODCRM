/**
 * Lead Sources — 4 sheets (Cognism, Apollo, Social, Blackbook) as immutable source of truth.
 * Uses /api/lead-sources only (batches + contacts). No /api/live/leads in this tab.
 * Wide table for contacts.
 */

import React, { useEffect, useState, useCallback } from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Heading,
  HStack,
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
  VStack,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Checkbox,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Tooltip,
  useToast,
} from '@chakra-ui/react'
import { ExternalLinkIcon, RepeatIcon, ViewIcon, AddIcon } from '@chakra-ui/icons'
import { api } from '../../../utils/api'
import { normalizeCustomersListResponse } from '../../../utils/normalizeApiResponse'
import { settingsStore, leadSourceSelectionStore } from '../../../platform'
import {
  getLeadSources,
  connectLeadSource,
  pollLeadSource,
  getLeadSourceBatches,
  getLeadSourceContacts,
  buildOpenSheetUrl,
  type LeadSourceType,
  type LeadSourceBatch,
} from '../../../utils/leadSourcesApi'
import { visibleColumns, normKey } from '../../../utils/visibleColumns'

const API_BASE = import.meta.env.VITE_API_URL || ''
const SOURCE_LABELS: Record<LeadSourceType, string> = {
  COGNISM: 'Cognism',
  APOLLO: 'Apollo',
  SOCIAL: 'Social',
  BLACKBOOK: 'Blackbook',
}
const POLL_INTERVAL_MS = 45 * 1000

const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? v : [])

function isoToday(): string {
  return new Date().toISOString().slice(0, 10)
}

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test((s || '').trim())
}

function normalizeBatchDate(s: string): string {
  return isIsoDate(s) ? s : isoToday()
}

function isoYesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

function SourcesOverview({
  sources,
  customerId,
  onViewBatches,
  onOpenConnect,
  onPoll,
}: {
  sources: Awaited<ReturnType<typeof getLeadSources>>['sources']
  customerId: string
  onViewBatches: (sourceType: LeadSourceType) => void
  onOpenConnect: (sourceType: LeadSourceType) => void
  onPoll: (sourceType: LeadSourceType) => void
}) {
  return (
    <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
      {(['COGNISM', 'APOLLO', 'SOCIAL', 'BLACKBOOK'] as const).map((sourceType) => {
        const src = sources.find((s) => s.sourceType === sourceType)
        const connected = !!src?.connected
        return (
          <Card key={sourceType}>
            <CardHeader>
              <Flex justify="space-between" align="center" flexWrap="wrap" gap={2}>
                <Heading size="sm">{src?.displayName ?? SOURCE_LABELS[sourceType]}</Heading>
                <HStack spacing={2}>
                  {connected ? (
                    <Badge colorScheme="green">Connected</Badge>
                  ) : (
                    <Badge colorScheme="gray">Not connected</Badge>
                  )}
                  {connected && src?.usingGlobalConfig && (
                    <Tooltip label="This sheet is shared across all accounts." hasArrow>
                      <Badge colorScheme="blue" cursor="help">Using global config</Badge>
                    </Tooltip>
                  )}
                </HStack>
              </Flex>
            </CardHeader>
            <CardBody pt={0}>
              {src?.lastError && (
                <Text fontSize="xs" color="red.600" mb={2}>
                  {src.lastError}
                </Text>
              )}
              {src?.lastFetchAt && (
                <Text fontSize="xs" color="gray.600" mb={2}>
                  Last fetch: {new Date(src.lastFetchAt).toLocaleString()}
                </Text>
              )}
              <VStack align="stretch" spacing={2}>
                <Button
                  size="sm"
                  leftIcon={<ViewIcon />}
                  isDisabled={!connected}
                  onClick={() => onViewBatches(sourceType)}
                >
                  View Batches
                </Button>
                {connected && (
                  <Link
                    href={buildOpenSheetUrl(API_BASE, sourceType, customerId)}
                    isExternal
                    _hover={{ textDecoration: 'none' }}
                  >
                    <Button size="sm" leftIcon={<ExternalLinkIcon />} width="100%" variant="outline">
                      Open Sheet
                    </Button>
                  </Link>
                )}
                <Button size="sm" leftIcon={<AddIcon />} variant="outline" onClick={() => onOpenConnect(sourceType)}>
                  Connect
                </Button>
                {connected && (
                  <Button size="sm" leftIcon={<RepeatIcon />} variant="ghost" onClick={() => onPoll(sourceType)}>
                    Poll now
                  </Button>
                )}
              </VStack>
            </CardBody>
          </Card>
        )
      })}
    </SimpleGrid>
  )
}

function BatchesBlock({
  batches,
  batchesLoading,
  batchesFallback,
  sourceLabel,
  batchDate,
  onBatchDateChange,
  onBack,
  onViewContacts,
  onUseInSequence,
}: {
  batches: LeadSourceBatch[]
  batchesLoading: boolean
  batchesFallback?: boolean
  sourceLabel: string
  batchDate: string
  onBatchDateChange: (date: string) => void
  onBack: () => void
  onViewContacts: (batchKey: string) => void
  onUseInSequence: (batch: LeadSourceBatch) => void
}) {
  const safeBatches = asArray<LeadSourceBatch>(batches)
  return (
    <Box mt={6}>
      <Flex justify="space-between" align="center" mb={3}>
        <Heading size="md">Batches — {sourceLabel}</Heading>
        <HStack>
          <FormControl width="auto">
            <FormLabel fontSize="sm">Date</FormLabel>
            <Input
              type="date"
              size="sm"
              value={normalizeBatchDate(batchDate)}
              onChange={(e) => onBatchDateChange(normalizeBatchDate(e.target.value))}
              maxW="160px"
            />
          </FormControl>
          <Button size="sm" onClick={onBack}>
            Back
          </Button>
        </HStack>
      </Flex>
      {batchesLoading && safeBatches.length === 0 ? (
        <Spinner size="sm" />
      ) : (
        <>
          {batchesFallback && (
            <Text fontSize="sm" color="gray.600" mb={2}>
              No batches for selected date; showing most recent batches.
            </Text>
          )}
          <Box overflowX="auto" borderWidth="1px" borderRadius="md">
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Client</Th>
                  <Th>Job Title</Th>
                  <Th isNumeric>Count</Th>
                  <Th>Last updated</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
              {safeBatches.length === 0 ? (
                <Tr>
                  <Td colSpan={5} color="gray.500">
                    <VStack align="stretch" spacing={2} py={2}>
                      <Text>
                        No batches for this date. Try selecting yesterday&apos;s date or click Poll now on the source.
                      </Text>
                      <Button
                        size="sm"
                        variant="outline"
                        width="fit-content"
                        onClick={() => onBatchDateChange(isoYesterday())}
                      >
                        Set date to yesterday
                      </Button>
                    </VStack>
                  </Td>
                </Tr>
              ) : (
                safeBatches.map((b) => (
                  <Tr key={b.batchKey}>
                    <Td>{b.client ?? '(none)'}</Td>
                    <Td>{b.jobTitle ?? '(none)'}</Td>
                    <Td isNumeric>{b.count ?? 0}</Td>
                    <Td>{b.lastSeenAt ? new Date(b.lastSeenAt).toLocaleString() : '—'}</Td>
                    <Td>
                      <HStack spacing={2}>
                        <Button size="xs" onClick={() => onViewContacts(b.batchKey)}>
                          View contacts
                        </Button>
                        <Button size="xs" variant="outline" onClick={() => onUseInSequence(b)}>
                          Use in sequence
                        </Button>
                      </HStack>
                    </Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </Box>
        </>
      )}
    </Box>
  )
}

function ContactsBlock({
  contacts,
  contactsColumns,
  contactsTotal,
  contactsLoading,
  contactsPage,
  contactsPageSize,
  sourceLabel,
  onPrevPage,
  onNextPage,
  onBack,
}: {
  contacts: Record<string, string>[]
  contactsColumns: string[]
  contactsTotal: number
  contactsLoading: boolean
  contactsPage: number
  contactsPageSize: number
  sourceLabel: string
  onPrevPage: () => void
  onNextPage: () => void
  onBack: () => void
}) {
  // Normalize keys so columns and row lookups match (backend may send camelCase, sheet headers vary)
  const normalizedColumns = contactsColumns.map((c) => normKey(c))
  const normToDisplay: Record<string, string> = {}
  contactsColumns.forEach((c) => {
    const n = normKey(c)
    if (!(n in normToDisplay)) normToDisplay[n] = c
  })
  const normalizedContacts = contacts.map((row) => {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(row ?? {})) out[normKey(k)] = typeof v === 'string' ? v : String(v ?? '')
    return out
  })
  const visibleCols = normalizedContacts.length
    ? visibleColumns(normalizedColumns, normalizedContacts)
    : normalizedColumns
  const cols = visibleCols.length ? visibleCols : normalizedColumns
  const displayLabel = (normCol: string) => normToDisplay[normCol] ?? normCol
  return (
    <Card>
      <CardHeader>
        <Flex justify="space-between" align="center">
          <Heading size="md">Contacts — {sourceLabel}</Heading>
          <Button size="sm" onClick={onBack}>
            Back
          </Button>
        </Flex>
      </CardHeader>
      <CardBody pt={0}>
        {contactsLoading && contacts.length === 0 ? (
          <Spinner size="sm" />
        ) : (
          <>
            <Box
              overflowX="auto"
              overflowY="auto"
              maxH="60vh"
              borderWidth="1px"
              borderRadius="md"
              bg="white"
              _dark={{ bg: 'gray.800' }}
            >
              <Table size="sm" layout="fixed" minW="max-content">
                <Thead position="sticky" top={0} zIndex={2} bg="gray.50" _dark={{ bg: 'gray.800' }}>
                  <Tr>
                    {cols.map((col) => (
                      <Th key={col} whiteSpace="nowrap" minW="120px" maxW="200px">
                        {displayLabel(col)}
                      </Th>
                    ))}
                  </Tr>
                </Thead>
                <Tbody>
                  {normalizedContacts.length === 0 ? (
                    <Tr>
                      <Td colSpan={cols.length || 1} color="gray.500">
                        {contactsTotal > 0 ? 'No rows on this page (pagination)' : 'No contacts'}
                      </Td>
                    </Tr>
                  ) : (
                    normalizedContacts.map((row, i) => (
                      <Tr key={i}>
                        {cols.map((col) => (
                          <Td
                            key={col}
                            whiteSpace="nowrap"
                            minW="120px"
                            maxW="200px"
                            overflow="hidden"
                            textOverflow="ellipsis"
                          >
                            {row[col] ?? ''}
                          </Td>
                        ))}
                      </Tr>
                    ))
                  )}
                </Tbody>
              </Table>
            </Box>
            <Flex justify="space-between" align="center" mt={4}>
              <Text fontSize="sm" color="gray.600">
                Page {contactsPage} of {Math.ceil(contactsTotal / contactsPageSize) || 1} ({contactsTotal} total)
              </Text>
              <HStack>
                <Button size="sm" isDisabled={contactsPage <= 1} onClick={onPrevPage}>
                  Previous
                </Button>
                <Button size="sm" isDisabled={contactsPage >= Math.ceil(contactsTotal / contactsPageSize)} onClick={onNextPage}>
                  Next
                </Button>
              </HStack>
            </Flex>
          </>
        )}
      </CardBody>
    </Card>
  )
}

export default function LeadSourcesTabNew({
  onNavigateToSequences,
}: {
  onNavigateToSequences?: () => void
} = {}) {
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([])
  const [customerId, setCustomerId] = useState('')
  const [sources, setSources] = useState<Awaited<ReturnType<typeof getLeadSources>>['sources']>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewBatchesSource, setViewBatchesSource] = useState<LeadSourceType | null>(null)
  const [batches, setBatches] = useState<LeadSourceBatch[]>([])
  const [batchesLoading, setBatchesLoading] = useState(false)
  const [batchesFallback, setBatchesFallback] = useState(false)
  const [batchDate, setBatchDate] = useState<string>(isoToday())
  const [contactsBatchKey, setContactsBatchKey] = useState<{ sourceType: LeadSourceType; batchKey: string } | null>(null)
  const [contacts, setContacts] = useState<Record<string, string>[]>([])
  const [contactsColumns, setContactsColumns] = useState<string[]>([])
  const [contactsPage, setContactsPage] = useState(1)
  const [contactsTotal, setContactsTotal] = useState(0)
  const [contactsPageSize] = useState(50)
  const [contactsLoading, setContactsLoading] = useState(false)
  const [connectSource, setConnectSource] = useState<LeadSourceType | null>(null)
  const [connectUrl, setConnectUrl] = useState('')
  const [connectName, setConnectName] = useState('')
  const [connectSubmitting, setConnectSubmitting] = useState(false)
  const [connectUrlError, setConnectUrlError] = useState<string | null>(null)
  const [connectApplyToAllAccounts, setConnectApplyToAllAccounts] = useState(false)
  const { isOpen: isConnectOpen, onOpen: onConnectOpen, onClose: onConnectClose } = useDisclosure()
  const toast = useToast()

  function isPublishedOrCsvUrl(url: string) {
    const u = (url || '').toLowerCase().trim()
    return (
      u.includes('/spreadsheets/d/e/') ||
      u.includes('/pub') ||
      u.includes('output=csv') ||
      u.includes('/export?format=csv') ||
      u.includes('/gviz/tq')
    )
  }

  const loadCustomers = useCallback(async () => {
    const res = await api.get('/api/customers')
    if (res.error) return
    try {
      const list = normalizeCustomersListResponse(res.data) as Array<{ id: string; name: string }>
      setCustomers(list.map((c) => ({ id: c.id, name: c.name })))
      const current = settingsStore.getCurrentCustomerId('')
      if (current && list.some((c: { id: string }) => c.id === current)) setCustomerId(current)
      else if (list.length) setCustomerId(list[0].id)
    } catch {
      setCustomers([])
    }
  }, [])

  const loadSources = useCallback(async () => {
    if (!customerId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getLeadSources(customerId)
      setSources(data.sources)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sources')
      setSources([])
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    loadCustomers()
    const unsub = settingsStore.onSettingsUpdated((d) => {
      const id = (d as { currentCustomerId?: string })?.currentCustomerId
      if (typeof id === 'string') setCustomerId(id)
    })
    return () => unsub()
  }, [loadCustomers])

  useEffect(() => {
    if (customerId) loadSources()
  }, [customerId, loadSources])

  useEffect(() => {
    if (!customerId || !viewBatchesSource) return
    const safeDate = normalizeBatchDate(batchDate)
    if (safeDate !== batchDate) {
      setBatchDate(safeDate)
      return
    }
    let cancelled = false
    const run = async () => {
      setBatchesLoading(true)
      try {
        const data = await getLeadSourceBatches(customerId, viewBatchesSource, safeDate)
        const list = Array.isArray(data) ? data : (data?.batches ?? [])
        const safeList = asArray<LeadSourceBatch>(list)
        if (!cancelled) {
          setBatches(safeList)
          setBatchesFallback(!!(data && 'batchesFallback' in data && data.batchesFallback))
          if (import.meta.env.DEV) console.log('[LeadSources] batches[0]=', safeList?.[0])
        }
      } catch {
        if (!cancelled) {
          setBatches([])
          setBatchesFallback(false)
        }
      } finally {
        if (!cancelled) setBatchesLoading(false)
      }
    }
    run()
    const t = setInterval(run, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [customerId, viewBatchesSource, batchDate])

  const loadContacts = useCallback(
    async (opts?: { keepPrevious: boolean }) => {
      if (!customerId || !contactsBatchKey) return
      if (!opts?.keepPrevious) setContactsLoading(true)
      try {
        const data = await getLeadSourceContacts(
          customerId,
          contactsBatchKey.sourceType,
          contactsBatchKey.batchKey,
          contactsPage,
          contactsPageSize
        )
        if (import.meta.env.DEV) {
          console.log('[LeadSources] contacts columns:', data?.columns)
          console.log('[LeadSources] contacts[0] keys:', Object.keys(data?.contacts?.[0] ?? {}))
          console.log('[LeadSources] contacts[0] row:', data?.contacts?.[0])
        }
        setContacts(asArray<Record<string, string>>(data?.contacts))
        setContactsColumns(asArray<string>(data?.columns))
        setContactsTotal(Number(data?.total) ?? 0)
      } catch {
        if (!opts?.keepPrevious) {
          setContacts([])
          setContactsColumns([])
          setContactsTotal(0)
        }
      } finally {
        setContactsLoading(false)
      }
    },
    [customerId, contactsBatchKey, contactsPage, contactsPageSize]
  )

  useEffect(() => {
    if (contactsBatchKey) loadContacts()
  }, [contactsBatchKey, contactsPage, loadContacts])

  // Poll contacts every 45s when viewing a batch; keep previous data while refreshing (no flicker)
  useEffect(() => {
    if (!customerId || !contactsBatchKey) return
    const t = setInterval(() => loadContacts({ keepPrevious: true }), POLL_INTERVAL_MS)
    return () => clearInterval(t)
  }, [customerId, contactsBatchKey, contactsPage, contactsPageSize, loadContacts])

  const handleCustomerChange = (id: string) => {
    settingsStore.setCurrentCustomerId(id)
    setCustomerId(id)
    setViewBatchesSource(null)
    setContactsBatchKey(null)
  }

  const handlePoll = async (sourceType: LeadSourceType) => {
    try {
      const result = await pollLeadSource(customerId, sourceType)
      toast({ title: 'Poll complete', description: `${result.totalRows} rows, ${result.newRowsDetected} new`, status: 'success', duration: 3000 })
      loadSources()
      if (viewBatchesSource === sourceType) {
        const data = await getLeadSourceBatches(customerId, sourceType, normalizeBatchDate(batchDate))
        const list = Array.isArray(data) ? data : (data?.batches ?? [])
        setBatches(list)
        setBatchesFallback(!!(data && 'batchesFallback' in data && data.batchesFallback))
      }
    } catch (e) {
      toast({ title: 'Poll failed', description: e instanceof Error ? e.message : 'Error', status: 'error', duration: 5000 })
    }
  }

  const openConnect = (sourceType: LeadSourceType) => {
    setConnectSource(sourceType)
    setConnectName(SOURCE_LABELS[sourceType])
    setConnectUrl('')
    setConnectUrlError(null)
    setConnectApplyToAllAccounts(false)
    onConnectOpen()
  }

  const submitConnect = async () => {
    if (!connectSource || !connectUrl.trim() || !connectName.trim()) return
    if (isPublishedOrCsvUrl(connectUrl)) {
      setConnectUrlError('Use normal Google Sheets URL …/spreadsheets/d/<ID>/edit#gid=… (not published/CSV links).')
      return
    }
    setConnectUrlError(null)
    setConnectSubmitting(true)
    try {
      await connectLeadSource(customerId, connectSource, connectUrl.trim(), connectName.trim(), connectApplyToAllAccounts)
      toast({ title: 'Connected', status: 'success', duration: 3000 })
      onConnectClose()
      loadSources()
    } catch (e) {
      toast({ title: 'Connect failed', description: e instanceof Error ? e.message : 'Error', status: 'error', duration: 5000 })
    } finally {
      setConnectSubmitting(false)
    }
  }

  const handleUseInSequence = (batch: LeadSourceBatch) => {
    const key = contactsBatchKey?.batchKey ?? batch.batchKey
    const source = viewBatchesSource ?? (contactsBatchKey?.sourceType as LeadSourceType)
    leadSourceSelectionStore.setLeadSourceBatchSelection({ sourceType: source, batchKey: key })
    toast({
      title: 'Batch selected for sequence',
      description: 'Go to Sequences to preview recipients and use this batch.',
      status: 'info',
      duration: 5000,
    })
    onNavigateToSequences?.()
  }

  const buildVersion = import.meta.env.VITE_GIT_SHA ?? 'unknown'

  return (
    <Box p={4}>
      <VStack align="stretch" spacing={6}>
        <Flex justify="space-between" align="center" flexWrap="wrap" gap={2}>
          <Box>
            <Heading size="lg">Lead Sources</Heading>
            {import.meta.env.DEV && (
              <Text fontSize="xs" color="gray.500" mt={0.5}>
                build: {buildVersion}
              </Text>
            )}
          </Box>
          <Select
            maxW="280px"
            value={customerId}
            onChange={(e) => handleCustomerChange(e.target.value)}
            placeholder="Select customer"
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Flex>

        {!customerId ? (
          <Card>
            <CardBody>
              <VStack py={8} spacing={2}>
                <Text color="gray.600" fontSize="md">
                  Select a customer to view Lead Sources
                </Text>
                <Text fontSize="sm" color="gray.500">
                  Choose a customer from the dropdown above to connect sheets and view batches and contacts.
                </Text>
              </VStack>
            </CardBody>
          </Card>
        ) : (
          <>
            {loading && (
              <Flex justify="center" py={8}>
                <Spinner size="lg" />
              </Flex>
            )}
            {error && (
              <Alert status="error">
                <AlertIcon />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {!loading && customerId && (
          contactsBatchKey ? (
            <ContactsBlock
              sourceLabel={SOURCE_LABELS[contactsBatchKey.sourceType]}
              contacts={contacts}
              contactsColumns={contactsColumns}
              contactsTotal={contactsTotal}
              contactsLoading={contactsLoading}
              contactsPage={contactsPage}
              contactsPageSize={contactsPageSize}
              onPrevPage={() => setContactsPage((p) => Math.max(1, p - 1))}
              onNextPage={() => setContactsPage((p) => p + 1)}
              onBack={() => {
                setContactsBatchKey(null)
                setContacts([])
                setContactsColumns([])
                setContactsTotal(0)
                setContactsPage(1)
              }}
            />
          ) : viewBatchesSource ? (
            <BatchesBlock
              sourceLabel={SOURCE_LABELS[viewBatchesSource]}
              batches={batches}
              batchesLoading={batchesLoading}
              batchesFallback={batchesFallback}
              batchDate={batchDate}
              onBatchDateChange={(next) => setBatchDate(next)}
              onBack={() => setViewBatchesSource(null)}
              onViewContacts={(batchKey) => {
                setContacts([])
                setContactsColumns([])
                setContactsTotal(0)
                setContactsPage(1)
                setContactsBatchKey({ sourceType: viewBatchesSource, batchKey })
              }}
              onUseInSequence={(batch) => handleUseInSequence(batch)}
            />
          ) : (
            <SourcesOverview
              sources={sources}
              customerId={customerId}
              onViewBatches={(sourceType) => {
                setViewBatchesSource(sourceType)
                setContactsBatchKey(null)
                setBatchDate((prev) => normalizeBatchDate(prev))
                setBatches([])
                setBatchesFallback(false)
              }}
              onOpenConnect={(sourceType) => openConnect(sourceType)}
              onPoll={(sourceType) => handlePoll(sourceType)}
            />
          )
            )}
          </>
        )}
      </VStack>

      <Modal isOpen={isConnectOpen} onClose={onConnectClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Connect sheet — {connectSource && SOURCE_LABELS[connectSource]}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl isRequired mb={3} isInvalid={!!connectUrlError}>
              <FormLabel>Sheet URL</FormLabel>
              <Input
                value={connectUrl}
                onChange={(e) => {
                  const next = e.target.value
                  setConnectUrl(next)
                  if (connectUrlError && !isPublishedOrCsvUrl(next)) setConnectUrlError(null)
                }}
                placeholder="https://docs.google.com/spreadsheets/d/<ID>/edit#gid=0"
              />
              <Text fontSize="sm" color="gray.600" mt={1}>
                Use normal Google Sheets URL …/spreadsheets/d/&lt;ID&gt;/edit#gid=… (sheet must be viewable by anyone with the link).
              </Text>
              <FormErrorMessage>{connectUrlError}</FormErrorMessage>
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Display name</FormLabel>
              <Input
                placeholder="e.g. Cognism"
                value={connectName}
                onChange={(e) => setConnectName(e.target.value)}
              />
            </FormControl>
            <FormControl mt={3}>
              <Checkbox
                isChecked={connectApplyToAllAccounts}
                onChange={(e) => setConnectApplyToAllAccounts(e.target.checked)}
              >
                Apply to all accounts (use this sheet for every customer that does not have their own)
              </Checkbox>
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onConnectClose}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={submitConnect}
              isLoading={connectSubmitting}
              isDisabled={!connectUrl.trim() || !connectName.trim()}
            >
              Connect
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}