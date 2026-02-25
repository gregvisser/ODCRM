import React, { useEffect, useState } from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Heading,
  HStack,
  Icon,
  Input,
  InputGroup,
  Select,
  SimpleGrid,
  Spinner,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  Badge,
  useToast,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  FormControl,
  FormLabel,
  FormHelperText,
  Link,
} from '@chakra-ui/react'
import {
  CheckCircleIcon,
  WarningIcon,
  RepeatIcon,
  ExternalLinkIcon,
  ViewIcon,
  InfoIcon,
} from '@chakra-ui/icons'
import { api } from '../../../utils/api'
import { normalizeCustomersListResponse } from '../../../utils/normalizeApiResponse'
import { getCurrentCustomerId, setCurrentCustomerId, onSettingsUpdated } from '../../../platform/stores/settings'
import { GoogleSheetLink } from '../../../components/links/GoogleSheetLink'

// Types
interface SheetSourceConfig {
  source: string
  defaultSheetUrl: string
  connected: boolean
  label: string
  sheetUrl: string | null
  sheetId: string | null
  gid: string | null
  sheetName: string | null
  lastSyncAt: string | null
  lastSyncStatus: 'pending' | 'syncing' | 'success' | 'error'
  lastError: string | null
  rowsImported: number
  rowsUpdated: number
  rowsSkipped: number
}

interface SheetSourcesResponse {
  sources: SheetSourceConfig[]
  credentialsConfigured: boolean
  authMethodUsed: 'json' | 'split' | 'none'
  serviceAccountEmail: string | null
  lastAuthError: string | null
}

interface SyncResult {
  success: boolean
  source: string
  sheetName?: string
  totalRows?: number
  imported?: number
  updated?: number
  skipped?: number
  errors?: string[]
  lastSyncAt?: string
  list?: {
    id: string
    name: string
    memberCount: number
  }
  error?: string
}

interface PreviewResult {
  source: string
  sheetName?: string
  totalRows?: number
  preview?: ContactPreview[]
  rawHeaders?: string[]
  rawRows?: string[][]
  errors?: string[]
  lastSyncAt?: string | null
  lastSyncStatus?: 'pending' | 'syncing' | 'success' | 'error'
  lastError?: string | null
}

interface SnapshotList {
  id: string
  name: string
  memberCount: number
  lastSyncAt: string
}

interface CustomerOption {
  id: string
  name: string
}

interface ContactPreview {
  email: string
  firstName: string | null
  lastName: string | null
  companyName: string | null
  jobTitle: string | null
  phone: string | null
}

// Source display names
const SOURCE_LABELS: Record<string, string> = {
  cognism: 'Cognism',
  apollo: 'Apollo',
  blackbook: 'Social',
}

const LeadSourcesTab: React.FC = () => {
  const [sources, setSources] = useState<SheetSourceConfig[]>([])
  const [credentialsConfigured, setCredentialsConfigured] = useState(false)
  const [serviceAccountEmail, setServiceAccountEmail] = useState<string | null>(null)
  const [lastAuthError, setLastAuthError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncingSource, setSyncingSource] = useState<string | null>(null)
  const [previewingSource, setPreviewingSource] = useState<string | null>(null)
  const [sheetUrls, setSheetUrls] = useState<Record<string, string>>({})
  const [sheetLabels, setSheetLabels] = useState<Record<string, string>>({})
  const [syncResults, setSyncResults] = useState<Record<string, SyncResult>>({})
  const [previewResults, setPreviewResults] = useState<Record<string, PreviewResult>>({})
  const [snapshotLists, setSnapshotLists] = useState<Record<string, SnapshotList[]>>({})
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [currentCustomerId, setCurrentCustomerId] = useState<string>(
    getCurrentCustomerId()
  )
  const [rawRowsByListId, setRawRowsByListId] = useState<Record<string, { headers: string[]; rows: string[][] }>>({})
  const [rawRowsLoading, setRawRowsLoading] = useState<Record<string, boolean>>({})
  const [rawRowsError, setRawRowsError] = useState<Record<string, string | null>>({})
  const [expandedRawLists, setExpandedRawLists] = useState<Set<string>>(new Set())
  const toast = useToast()

  const loadCustomers = async () => {
    const res = await api.get('/api/customers')
    if (res.error) {
      toast({
        title: 'Failed to load customers',
        description: res.error,
        status: 'error',
        duration: 5000,
      })
      return
    }

    try {
      const customersData = normalizeCustomersListResponse(res.data) as CustomerOption[]
      const list = customersData.map((customer) => ({
        id: customer.id,
        name: customer.name,
      }))

      setCustomers(list)

      if (!currentCustomerId && list.length > 0) {
        setCurrentCustomerId(list[0].id)
        setCurrentCustomerId(list[0].id)
      } else if (currentCustomerId && !list.some((c) => c.id === currentCustomerId) && list.length > 0) {
        setCurrentCustomerId(list[0].id)
        setCurrentCustomerId(list[0].id)
      }
    } catch (err: any) {
      console.error('❌ Failed to normalize customers in LeadSourcesTab:', err)
      toast({
        title: 'Failed to parse customers',
        description: err.message || 'Unexpected API response format',
        status: 'error',
        duration: 5000,
      })
    }
  }

  // Load customers on mount
  useEffect(() => {
    loadCustomers()
    const unsubscribe = onSettingsUpdated((detail) => {
      const nextId = (detail as { currentCustomerId?: string | null })?.currentCustomerId
      if (typeof nextId === 'string') {
        setCurrentCustomerId(nextId)
      }
    })
    return () => unsubscribe()
  }, [])

  // Load sources when customer changes
  useEffect(() => {
    if (currentCustomerId) {
      loadSources()
    }
  }, [currentCustomerId])

  const loadSnapshotLists = async (source: string) => {
    const res = await api.get<{ source: string; lists: SnapshotList[] }>(`/api/sheets/sources/${source}/lists`)
    if (res.error) {
      setSnapshotLists(prev => ({ ...prev, [source]: [] }))
      return
    }
    if (res.data) {
      setSnapshotLists(prev => ({ ...prev, [source]: res.data?.lists || [] }))
    }
  }

  const loadSources = async () => {
    setLoading(true)
    setError(null)

    const res = await api.get<SheetSourcesResponse>('/api/sheets/sources')
    
    if (res.error) {
      setError(res.error)
      setLoading(false)
      return
    }

    if (res.data) {
      setSources(res.data.sources)
      setCredentialsConfigured(res.data.credentialsConfigured)
      setServiceAccountEmail(res.data.serviceAccountEmail)
      setLastAuthError(res.data.lastAuthError)
      
      // Initialize sheet URLs from sources
      const urls: Record<string, string> = {}
      const labels: Record<string, string> = {}
      res.data.sources.forEach(s => {
        urls[s.source] = s.sheetUrl || s.defaultSheetUrl
        labels[s.source] = s.label || SOURCE_LABELS[s.source] || 'Google Sheet'
      })
      setSheetUrls(urls)
      setSheetLabels(labels)

      await Promise.all(res.data.sources.map(s => loadSnapshotLists(s.source)))
    }
    
    setLoading(false)
  }

  const handleCustomerChange = (customerId: string) => {
    setCurrentCustomerId(customerId)
    setCurrentCustomerId(customerId)
    setSyncResults({})
    setPreviewResults({})
    setSnapshotLists({})
    setRawRowsByListId({})
    setExpandedRawLists(new Set())
  }

  const handleConnect = async (source: string) => {
    const sheetUrl = sheetUrls[source]
    const label = (sheetLabels[source] || '').trim()
    if (!sheetUrl) {
      toast({
        title: 'Sheet URL required',
        status: 'error',
        duration: 3000,
      })
      return
    }
    if (!label) {
      toast({
        title: 'Label required',
        description: 'Please set a label (we display label-only across the system).',
        status: 'error',
        duration: 4000,
      })
      return
    }

    const res = await api.post<{ success: boolean; error?: string }>(
      `/api/sheets/sources/${source}/connect`,
      { sheetUrl, label }
    )

    if (res.error) {
      toast({
        title: 'Failed to connect',
        description: res.error,
        status: 'error',
        duration: 5000,
      })
      return
    }

    toast({
      title: 'Sheet connected',
      status: 'success',
      duration: 3000,
    })

    loadSources()
  }

  const handleSync = async (source: string) => {
    setSyncingSource(source)

    const res = await api.post<SyncResult>(`/api/sheets/sources/${source}/sync`, {})

    setSyncingSource(null)

    if (res.error) {
      setSyncResults(prev => ({
        ...prev,
        [source]: { success: false, source, error: res.error },
      }))
      toast({
        title: 'Sync failed',
        description: res.error,
        status: 'error',
        duration: 5000,
      })
      return
    }

    if (res.data) {
      setSyncResults(prev => ({
        ...prev,
        [source]: res.data!,
      }))

      if (res.data.success) {
        toast({
          title: 'Sync completed',
          description: `Imported ${res.data.imported}, updated ${res.data.updated}, skipped ${res.data.skipped}`,
          status: 'success',
          duration: 5000,
        })
        await loadSnapshotLists(source)
      } else {
        toast({
          title: 'Sync failed',
          description: res.data.error,
          status: 'error',
          duration: 5000,
        })
      }
    }

    loadSources()
  }

  const handlePreview = async (source: string) => {
    setPreviewingSource(source)
    const res = await api.get<PreviewResult>(`/api/sheets/sources/${source}/preview`)
    setPreviewingSource(null)

    if (res.error) {
      setPreviewResults(prev => ({
        ...prev,
        [source]: {
          source,
          errors: [res.error],
        },
      }))
      toast({
        title: 'Preview failed',
        description: res.error,
        status: 'error',
        duration: 5000,
      })
      return
    }

    if (res.data) {
      setPreviewResults(prev => ({
        ...prev,
        [source]: res.data!,
      }))
    }
  }

  const loadRawRowsForList = async (source: string, listId: string) => {
    setRawRowsLoading((prev) => ({ ...prev, [listId]: true }))
    setRawRowsError((prev) => ({ ...prev, [listId]: null }))
    const res = await api.get<{ rawHeaders: string[]; rawRows: string[][] }>(
      `/api/sheets/sources/${source}/lists/${listId}/rows?limit=20`
    )
    if (res.error) {
      setRawRowsError((prev) => ({ ...prev, [listId]: res.error || 'Failed to load raw rows' }))
      setRawRowsLoading((prev) => ({ ...prev, [listId]: false }))
      return
    }

    setRawRowsByListId((prev) => ({
      ...prev,
      [listId]: { headers: res.data?.rawHeaders || [], rows: res.data?.rawRows || [] },
    }))
    setRawRowsLoading((prev) => ({ ...prev, [listId]: false }))
  }

  const toggleRawRows = async (source: string, listId: string) => {
    setExpandedRawLists((prev) => {
      const next = new Set(prev)
      if (next.has(listId)) {
        next.delete(listId)
      } else {
        next.add(listId)
      }
      return next
    })

    if (!rawRowsByListId[listId]) {
      await loadRawRowsForList(source, listId)
    }
  }

  const handleOpenSnapshotList = (listId: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set('tab', 'marketing-home')
    url.searchParams.set('view', 'lists')
    url.searchParams.set('listId', listId)
    window.location.assign(url.toString())
  }

  const handleCreateFromSnapshot = (view: 'campaigns' | 'sequences', snapshotId: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set('tab', 'marketing-home')
    url.searchParams.set('view', view)
    url.searchParams.set('snapshotId', snapshotId)
    window.location.assign(url.toString())
  }

  const getStatusBadge = (status: string, error?: string | null) => {
    switch (status) {
      case 'success':
        return <Badge colorScheme="green">Connected</Badge>
      case 'syncing':
        return <Badge colorScheme="blue">Syncing...</Badge>
      case 'error':
        return <Badge colorScheme="red" title={error || undefined}>Error</Badge>
      case 'pending':
      default:
        return <Badge colorScheme="gray">Not synced</Badge>
    }
  }

  const getEmailColumnIndex = (headers: string[]) => {
    return headers.findIndex((header) => header.toLowerCase().includes('email'))
  }

  const renderSourceTab = (source: SheetSourceConfig) => {
    const isSyncing = syncingSource === source.source
    const isPreviewing = previewingSource === source.source
    const result = syncResults[source.source]
    const previewResult = previewResults[source.source]
    const snapshots = snapshotLists[source.source] || []
    const label = SOURCE_LABELS[source.source] || source.source

    return (
      <Box>
        {/* Connection Status Card */}
        <Card mb={6}>
          <CardHeader>
            <Flex align="center" justify="space-between">
              <HStack spacing={3}>
                <Heading size="md">{label} Integration</Heading>
                {getStatusBadge(source.lastSyncStatus, source.lastError)}
              </HStack>
              {source.connected && (
                <HStack spacing={2}>
                  <Button
                    leftIcon={isPreviewing ? <Spinner size="sm" /> : <ViewIcon />}
                    variant="outline"
                    onClick={() => handlePreview(source.source)}
                    isDisabled={!credentialsConfigured}
                    isLoading={isPreviewing}
                    loadingText="Previewing..."
                  >
                    Preview
                  </Button>
                  <Button
                    leftIcon={isSyncing ? <Spinner size="sm" /> : <RepeatIcon />}
                    colorScheme="blue"
                    onClick={() => handleSync(source.source)}
                    isDisabled={!credentialsConfigured}
                    isLoading={isSyncing}
                    loadingText="Syncing..."
                  >
                    Sync Now
                  </Button>
                </HStack>
              )}
            </Flex>
          </CardHeader>
          <CardBody>
            <VStack align="stretch" spacing={4}>
              {/* Credentials Warning */}
              {!credentialsConfigured && (
                <Alert status="warning">
                  <AlertIcon />
                  <Box>
                    <AlertTitle>Google Sheets credentials not configured</AlertTitle>
                    <AlertDescription>
                      <VStack align="start" spacing={1} mt={2}>
                        <Text>1) Create a Google service account</Text>
                        <Text>2) Add GOOGLE_SERVICE_ACCOUNT_JSON to Azure App Service</Text>
                        <Text>3) Share the sheet with the service account email</Text>
                      </VStack>
                      {serviceAccountEmail && (
                        <Text mt={2}>
                          Service account email: <strong>{serviceAccountEmail}</strong>
                        </Text>
                      )}
                      {lastAuthError && (
                        <Text mt={2} color="red.600">
                          {lastAuthError}
                        </Text>
                      )}
                    </AlertDescription>
                  </Box>
                </Alert>
              )}

              {/* Sheet URL */}
              <FormControl>
                <FormLabel>Google Sheet URL</FormLabel>
                <InputGroup>
                  <Input
                    value={sheetUrls[source.source] || ''}
                    onChange={(e) => setSheetUrls(prev => ({
                      ...prev,
                      [source.source]: e.target.value,
                    }))}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                  />
                </InputGroup>
                <FormHelperText>
                  <Link href={source.defaultSheetUrl} isExternal color="blue.500">
                    Open default sheet <ExternalLinkIcon mx="2px" />
                  </Link>
                </FormHelperText>
              </FormControl>

              {/* Sheet Label (required) */}
              <FormControl isRequired>
                <FormLabel>Label</FormLabel>
                <Input
                  value={sheetLabels[source.source] || ''}
                  onChange={(e) =>
                    setSheetLabels((prev) => ({
                      ...prev,
                      [source.source]: e.target.value,
                    }))
                  }
                  placeholder={SOURCE_LABELS[source.source] || 'e.g. Cognism Lead Sheet'}
                />
                {source.sheetUrl && source.connected ? (
                  <Text fontSize="sm" color="gray.600" mt={2}>
                    Connected sheet:{' '}
                    <GoogleSheetLink
                      url={source.sheetUrl}
                      label={sheetLabels[source.source] || source.label || SOURCE_LABELS[source.source]}
                      fallbackLabel={SOURCE_LABELS[source.source] || 'Google Sheet'}
                    />
                  </Text>
                ) : null}
              </FormControl>

              {!source.connected && (
                <Button
                  colorScheme="green"
                  onClick={() => handleConnect(source.source)}
                  isDisabled={!credentialsConfigured}
                >
                  Connect Sheet
                </Button>
              )}

              {/* Sync Stats */}
              {source.connected && (
                <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
                  <Stat>
                    <StatLabel>Last Synced</StatLabel>
                    <StatNumber fontSize="md">
                      {source.lastSyncAt
                        ? new Date(source.lastSyncAt).toLocaleString()
                        : 'Never'}
                    </StatNumber>
                  </Stat>
                  <Stat>
                    <StatLabel>Rows Imported</StatLabel>
                    <StatNumber>{source.rowsImported}</StatNumber>
                  </Stat>
                  <Stat>
                    <StatLabel>Rows Updated</StatLabel>
                    <StatNumber>{source.rowsUpdated}</StatNumber>
                  </Stat>
                  <Stat>
                    <StatLabel>Rows Skipped</StatLabel>
                    <StatNumber>{source.rowsSkipped}</StatNumber>
                  </Stat>
                </SimpleGrid>
              )}

              {/* Error Display */}
              {source.lastError && (
                <Alert status="error" mt={2}>
                  <AlertIcon />
                  <Box>
                    <AlertTitle>Last sync had errors</AlertTitle>
                    <AlertDescription fontSize="sm">{source.lastError}</AlertDescription>
                  </Box>
                </Alert>
              )}

              {/* Sheet Name */}
              {source.sheetName && (
                <Text fontSize="sm" color="gray.500">
                  <Icon as={InfoIcon} mr={1} />
                  Connected to sheet: <strong>{source.sheetName}</strong>
                </Text>
              )}
            </VStack>
          </CardBody>
        </Card>

        {/* Sync Results */}
        {result && (
          <Card mb={6}>
            <CardHeader>
              <Heading size="sm">Last Sync Results</Heading>
            </CardHeader>
            <CardBody>
              {result.success ? (
                <VStack align="stretch" spacing={4}>
                  <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
                    <Stat>
                      <StatLabel>Total Rows</StatLabel>
                      <StatNumber>{result.totalRows ?? 0}</StatNumber>
                    </Stat>
                    <Stat>
                      <StatLabel>Imported</StatLabel>
                      <StatNumber>{result.imported ?? 0}</StatNumber>
                    </Stat>
                    <Stat>
                      <StatLabel>Updated</StatLabel>
                      <StatNumber>{result.updated ?? 0}</StatNumber>
                    </Stat>
                    <Stat>
                      <StatLabel>Skipped</StatLabel>
                      <StatNumber>{result.skipped ?? 0}</StatNumber>
                    </Stat>
                  </SimpleGrid>

                  {result.list && (
                    <Alert status="info">
                      <AlertIcon />
                      <Box flex="1">
                        <AlertTitle>Snapshot List</AlertTitle>
                        <AlertDescription>
                          {result.list.name} ({result.list.memberCount} members)
                        </AlertDescription>
                      </Box>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenSnapshotList(result.list!.id)}
                      >
                        Open Snapshot List
                      </Button>
                    </Alert>
                  )}

                  {result.errors && result.errors.length > 0 && (
                    <Box>
                      <Text fontWeight="bold" color="red.500" mb={2}>
                        Sync Errors ({result.errors.length}):
                      </Text>
                      <Box maxH="200px" overflowY="auto" bg="red.50" p={2} borderRadius="md">
                        {result.errors.map((err, idx) => (
                          <Text key={idx} fontSize="sm" color="red.700">
                            {err}
                          </Text>
                        ))}
                      </Box>
                    </Box>
                  )}
                </VStack>
              ) : (
                <Alert status="error">
                  <AlertIcon />
                  <Box>
                    <AlertTitle>Sync failed</AlertTitle>
                    <AlertDescription>{result.error || 'Unknown error'}</AlertDescription>
                  </Box>
                </Alert>
              )}
            </CardBody>
          </Card>
        )}

        {/* Preview Errors */}
        {previewResult && previewResult.errors && previewResult.errors.length > 0 && (!previewResult.preview || previewResult.preview.length === 0) && (
          <Alert status="error" mb={6}>
            <AlertIcon />
            <Box>
              <AlertTitle>Preview failed</AlertTitle>
              <AlertDescription>{previewResult.errors.join('; ')}</AlertDescription>
            </Box>
          </Alert>
        )}

        {/* Preview Table */}
        {previewResult && previewResult.preview && previewResult.preview.length > 0 && (
          <Card>
            <CardHeader>
              <Heading size="sm">
                Preview (first {previewResult.preview.length} of {previewResult.totalRows} rows)
              </Heading>
            </CardHeader>
            <CardBody>
              {previewResult.errors && previewResult.errors.length > 0 && (
                <Alert status="warning" mb={4}>
                  <AlertIcon />
                  <Box>
                    <AlertTitle>Preview warnings</AlertTitle>
                    <AlertDescription>
                      {previewResult.errors.slice(0, 3).join('; ')}
                    </AlertDescription>
                  </Box>
                </Alert>
              )}
              <Box overflowX="auto">
                <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th>Email</Th>
                      <Th>First Name</Th>
                      <Th>Last Name</Th>
                      <Th>Company</Th>
                      <Th>Job Title</Th>
                      <Th>Phone</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {previewResult.preview.map((contact, idx) => (
                      <Tr key={idx}>
                        <Td>{contact.email}</Td>
                        <Td>{contact.firstName || '-'}</Td>
                        <Td>{contact.lastName || '-'}</Td>
                        <Td>{contact.companyName || '-'}</Td>
                        <Td>{contact.jobTitle || '-'}</Td>
                        <Td>{contact.phone || '-'}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            </CardBody>
          </Card>
        )}

        {previewResult && previewResult.rawHeaders && previewResult.rawRows && previewResult.rawRows.length > 0 && (
          <Card mt={6}>
            <CardHeader>
              <Heading size="sm">Raw Fields (first {previewResult.rawRows.length} rows)</Heading>
            </CardHeader>
            <CardBody>
              <Box overflowX="auto">
                <Table size="sm">
                  <Thead>
                    <Tr>
                      {previewResult.rawHeaders.map((header, idx) => (
                        <Th
                          key={`${header}-${idx}`}
                          bg={idx === getEmailColumnIndex(previewResult.rawHeaders || []) ? 'yellow.50' : undefined}
                        >
                          {header || '(blank)'}
                        </Th>
                      ))}
                    </Tr>
                  </Thead>
                  <Tbody>
                    {previewResult.rawRows.map((row, rowIdx) => (
                      <Tr key={`raw-${rowIdx}`}>
                        {previewResult.rawHeaders.map((_, colIdx) => (
                          <Td key={`raw-${rowIdx}-${colIdx}`}>{row[colIdx] || ''}</Td>
                        ))}
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            </CardBody>
          </Card>
        )}

        {/* Recent Snapshots */}
        {snapshots.length > 0 && (
          <Card mt={6}>
            <CardHeader>
              <Heading size="sm">Recent Snapshots</Heading>
            </CardHeader>
            <CardBody>
              <VStack align="stretch" spacing={3}>
                {snapshots.map((list) => (
                  <Box key={list.id}>
                    <Flex align="center" justify="space-between">
                      <Box>
                        <Text fontWeight="medium">{list.name}</Text>
                        <Text fontSize="sm" color="gray.500">
                          {list.memberCount} members · {new Date(list.lastSyncAt).toLocaleString()}
                        </Text>
                      </Box>
                      <HStack spacing={2}>
                        <Button size="sm" variant="outline" onClick={() => handleOpenSnapshotList(list.id)}>
                          Open Snapshot List
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => toggleRawRows(source.source, list.id)}>
                          {expandedRawLists.has(list.id) ? 'Hide Raw Fields' : 'Raw Fields'}
                        </Button>
                        <Button size="sm" colorScheme="blue" onClick={() => handleCreateFromSnapshot('campaigns', list.id)}>
                          Create Campaign
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleCreateFromSnapshot('sequences', list.id)}>
                          Create Sequence
                        </Button>
                      </HStack>
                    </Flex>

                    {expandedRawLists.has(list.id) && (
                      <Box mt={3} border="1px solid" borderColor="gray.200" borderRadius="md" p={3}>
                        {rawRowsLoading[list.id] && (
                          <HStack spacing={2}>
                            <Spinner size="sm" />
                            <Text fontSize="sm">Loading raw fields...</Text>
                          </HStack>
                        )}
                        {rawRowsError[list.id] && (
                          <Text fontSize="sm" color="red.500">
                            {rawRowsError[list.id]}
                          </Text>
                        )}
                        {rawRowsByListId[list.id] && rawRowsByListId[list.id].rows.length > 0 && (
                          <Box overflowX="auto">
                            <Table size="sm">
                              <Thead>
                                <Tr>
                                  {rawRowsByListId[list.id].headers.map((header, idx) => (
                                    <Th
                                      key={`${list.id}-header-${idx}`}
                                      bg={idx === getEmailColumnIndex(rawRowsByListId[list.id].headers) ? 'yellow.50' : undefined}
                                    >
                                      {header || '(blank)'}
                                    </Th>
                                  ))}
                                </Tr>
                              </Thead>
                              <Tbody>
                                {rawRowsByListId[list.id].rows.map((row, rowIdx) => (
                                  <Tr key={`${list.id}-row-${rowIdx}`}>
                                    {rawRowsByListId[list.id].headers.map((_, colIdx) => (
                                      <Td key={`${list.id}-row-${rowIdx}-${colIdx}`}>{row[colIdx] || ''}</Td>
                                    ))}
                                  </Tr>
                                ))}
                              </Tbody>
                            </Table>
                          </Box>
                        )}
                        {rawRowsByListId[list.id] && rawRowsByListId[list.id].rows.length === 0 && !rawRowsLoading[list.id] && (
                          <Text fontSize="sm" color="gray.500">
                            No raw rows found for this snapshot.
                          </Text>
                        )}
                      </Box>
                    )}
                  </Box>
                ))}
              </VStack>
            </CardBody>
          </Card>
        )}
      </Box>
    )
  }

  if (loading) {
    return (
      <Flex justify="center" align="center" minH="400px">
        <VStack spacing={4}>
          <Spinner size="xl" color="blue.500" />
          <Text color="gray.500">Loading lead sources...</Text>
        </VStack>
      </Flex>
    )
  }

  if (error) {
    return (
      <Alert status="error">
        <AlertIcon />
        <Box>
          <AlertTitle>Failed to load lead sources</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Box>
        <Button ml="auto" onClick={loadSources}>
          Retry
        </Button>
      </Alert>
    )
  }

  const cognism = sources.find(s => s.source === 'cognism')
  const apollo = sources.find(s => s.source === 'apollo')
  const blackbook = sources.find(s => s.source === 'blackbook')

  return (
    <Box>
      {/* Header */}
      <Flex mb={6} align="center" justify="space-between">
        <Box>
          <Heading size="lg">Lead Sources</Heading>
          <Text color="gray.500">
            Connect Google Sheets to import contacts from Cognism, Apollo, and Social
          </Text>
          {currentCustomerId && (
            <Text mt={2} fontSize="sm" color="gray.600">
              Working as: <strong>{customers.find((c) => c.id === currentCustomerId)?.name || currentCustomerId}</strong>
            </Text>
          )}
        </Box>
        <HStack spacing={3}>
          <FormControl minW="240px">
            <FormLabel fontSize="sm" mb={1}>Current Client</FormLabel>
            <Select
              value={currentCustomerId}
              onChange={(e) => handleCustomerChange(e.target.value)}
              placeholder={customers.length === 0 ? 'No clients' : 'Select client'}
            >
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </Select>
          </FormControl>
          <Button leftIcon={<RepeatIcon />} onClick={loadSources} variant="outline">
            Refresh
          </Button>
        </HStack>
      </Flex>

      {/* Summary Stats */}
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} mb={6}>
        {sources.map(source => (
          <Card key={source.source}>
            <CardBody>
              <Flex align="center" justify="space-between">
                <Stat>
                  <StatLabel>{SOURCE_LABELS[source.source]}</StatLabel>
                  <StatNumber>
                    {source.rowsImported + source.rowsUpdated}
                  </StatNumber>
                  <StatHelpText>
                    {source.connected ? (
                      <HStack>
                        <CheckCircleIcon color="green.500" />
                        <Text>Connected</Text>
                      </HStack>
                    ) : (
                      <HStack>
                        <WarningIcon color="gray.400" />
                        <Text>Not connected</Text>
                      </HStack>
                    )}
                  </StatHelpText>
                </Stat>
              </Flex>
            </CardBody>
          </Card>
        ))}
      </SimpleGrid>

      {/* Tabs for each source */}
      <Tabs colorScheme="blue" variant="enclosed">
        <TabList>
          <Tab>
            Cognism
            {cognism?.connected && <Badge ml={2} colorScheme="green" fontSize="xs">Connected</Badge>}
          </Tab>
          <Tab>
            Apollo
            {apollo?.connected && <Badge ml={2} colorScheme="green" fontSize="xs">Connected</Badge>}
          </Tab>
          <Tab>
            Social
            {blackbook?.connected && <Badge ml={2} colorScheme="green" fontSize="xs">Connected</Badge>}
          </Tab>
        </TabList>

        <TabPanels>
          <TabPanel>
            {cognism && renderSourceTab(cognism)}
          </TabPanel>
          <TabPanel>
            {apollo && renderSourceTab(apollo)}
          </TabPanel>
          <TabPanel>
            {blackbook && renderSourceTab(blackbook)}
          </TabPanel>
        </TabPanels>
      </Tabs>

    </Box>
  )
}

export default LeadSourcesTab
