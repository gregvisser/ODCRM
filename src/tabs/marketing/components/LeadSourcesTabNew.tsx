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
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
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
import { visibleColumns } from '../../../utils/visibleColumns'

const API_BASE = import.meta.env.VITE_API_URL || ''
const SOURCE_LABELS: Record<LeadSourceType, string> = {
  COGNISM: 'Cognism',
  APOLLO: 'Apollo',
  SOCIAL: 'Social',
  BLACKBOOK: 'Blackbook',
}
const POLL_INTERVAL_MS = 45 * 1000

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
  const [batchDate, setBatchDate] = useState(() => new Date().toISOString().slice(0, 10))
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
    let cancelled = false
    const run = async () => {
      setBatchesLoading(true)
      try {
        const data = await getLeadSourceBatches(customerId, viewBatchesSource, batchDate)
        const list = Array.isArray(data) ? data : (data?.batches ?? [])
        if (!cancelled) setBatches(list)
      } catch {
        if (!cancelled) setBatches([])
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
        setContacts(data.contacts)
        setContactsColumns(data.columns)
        setContactsTotal(data.total)
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
        const data = await getLeadSourceBatches(customerId, sourceType, batchDate)
        const list = Array.isArray(data) ? data : (data?.batches ?? [])
        setBatches(list)
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
      await connectLeadSource(customerId, connectSource, connectUrl.trim(), connectName.trim())
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

  if (!customerId && customers.length > 0) return null

  return (
    <Box p={4}>
      <VStack align="stretch" spacing={6}>
        <Flex justify="space-between" align="center" flexWrap="wrap" gap={2}>
          <Heading size="lg">Lead Sources</Heading>
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

        {!loading && (
          <>
            <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
              {(['COGNISM', 'APOLLO', 'SOCIAL', 'BLACKBOOK'] as const).map((sourceType) => {
                const src = sources.find((s) => s.sourceType === sourceType)
                const connected = !!src?.connected
                return (
                  <Card key={sourceType}>
                    <CardHeader>
                      <Flex justify="space-between" align="center">
                        <Heading size="sm">{src?.displayName ?? SOURCE_LABELS[sourceType]}</Heading>
                        {connected ? (
                          <Badge colorScheme="green">Connected</Badge>
                        ) : (
                          <Badge colorScheme="gray">Not connected</Badge>
                        )}
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
                          onClick={() => {
                            setViewBatchesSource(sourceType)
                            setContactsBatchKey(null)
                          }}
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
                        <Button size="sm" leftIcon={<AddIcon />} variant="outline" onClick={() => openConnect(sourceType)}>
                          Connect
                        </Button>
                        {connected && (
                          <Button
                            size="sm"
                            leftIcon={<RepeatIcon />}
                            variant="ghost"
                            onClick={() => handlePoll(sourceType)}
                          >
                            Poll now
                          </Button>
                        )}
                      </VStack>
                    </CardBody>
                  </Card>
                )
              })}
            </SimpleGrid>

            {viewBatchesSource && (
              <Box mt={6}>
                <Flex justify="space-between" align="center" mb={3}>
                  <Heading size="md">Batches — {SOURCE_LABELS[viewBatchesSource]}</Heading>
                  <HStack>
                    <FormControl width="auto">
                      <FormLabel fontSize="sm">Date</FormLabel>
                      <Input
                        type="date"
                        size="sm"
                        value={batchDate}
                        onChange={(e) => setBatchDate(e.target.value)}
                        maxW="160px"
                      />
                    </FormControl>
                    <Button size="sm" onClick={() => setViewBatchesSource(null)}>
                      Back
                    </Button>
                  </HStack>
                </Flex>
                {batchesLoading && batches.length === 0 ? (
                  <Spinner size="sm" />
                ) : (
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
                        {batches.length === 0 ? (
                          <Tr>
                            <Td colSpan={5} color="gray.500">
                              No batches
                            </Td>
                          </Tr>
                        ) : (
                          batches.map((b) => (
                            <Tr key={b.batchKey}>
                              <Td>{b.client ?? '(none)'}</Td>
                              <Td>{b.jobTitle ?? '(none)'}</Td>
                              <Td isNumeric>{b.count ?? 0}</Td>
                              <Td>
                                {b.lastSeenAt
                                  ? new Date(b.lastSeenAt).toLocaleString()
                                  : '—'}
                              </Td>
                              <Td>
                                <HStack spacing={2}>
                                  <Button
                                    size="xs"
                                    onClick={() => {
                                      setContacts([])
                                      setContactsColumns([])
                                      setContactsTotal(0)
                                      setContactsPage(1)
                                      setContactsBatchKey({
                                        sourceType: viewBatchesSource,
                                        batchKey: b.batchKey,
                                      })
                                    }}
                                  >
                                    View contacts
                                  </Button>
                                  <Button size="xs" variant="outline" onClick={() => handleUseInSequence(b)}>
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
                )}
              </Box>
            )}

            {contactsBatchKey && (
              <Card>
                <CardHeader>
                  <Flex justify="space-between" align="center">
                    <Heading size="md">Contacts — {SOURCE_LABELS[contactsBatchKey.sourceType]}</Heading>
                    <Button size="sm" onClick={() => setContactsBatchKey(null)}>
                      Back
                    </Button>
                  </Flex>
                </CardHeader>
                <CardBody pt={0}>
                  {contactsLoading && contacts.length === 0 ? (
                    <Spinner size="sm" />
                  ) : (
                    <>
                      {(() => {
                        const computed = contacts.length ? visibleColumns(contactsColumns, contacts) : contactsColumns
                        const contactsCols = computed.length ? computed : contactsColumns
                        return (
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
                                  {contactsCols.map((col) => (
                                    <Th key={col} whiteSpace="nowrap" minW="120px" maxW="200px">
                                      {col}
                                    </Th>
                                  ))}
                                </Tr>
                              </Thead>
                              <Tbody>
                                {contacts.length === 0 ? (
                                  <Tr>
                                    <Td colSpan={contactsCols.length || 1} color="gray.500">
                                      {contacts.length === 0 && contactsTotal > 0 ? 'No rows on this page (pagination)' : 'No contacts'}
                                    </Td>
                                  </Tr>
                                ) : (
                                  contacts.map((row, i) => (
                                    <Tr key={i}>
                                      {contactsCols.map((col) => (
                                        <Td key={col} whiteSpace="nowrap" minW="120px" maxW="200px" overflow="hidden" textOverflow="ellipsis">
                                          {row[col] ?? ''}
                                        </Td>
                                      ))}
                                    </Tr>
                                  ))
                                )}
                              </Tbody>
                            </Table>
                          </Box>
                        )
                      })()}
                      <Flex justify="space-between" align="center" mt={4}>
                        <Text fontSize="sm" color="gray.600">
                          Page {contactsPage} of {Math.ceil(contactsTotal / contactsPageSize) || 1} ({contactsTotal} total)
                        </Text>
                        <HStack>
                          <Button
                            size="sm"
                            isDisabled={contactsPage <= 1}
                            onClick={() => setContactsPage((p) => p - 1)}
                          >
                            Previous
                          </Button>
                          <Button
                            size="sm"
                            isDisabled={contactsPage >= Math.ceil(contactsTotal / contactsPageSize)}
                            onClick={() => setContactsPage((p) => p + 1)}
                          >
                            Next
                          </Button>
                        </HStack>
                      </Flex>
                    </>
                  )}
                </CardBody>
              </Card>
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