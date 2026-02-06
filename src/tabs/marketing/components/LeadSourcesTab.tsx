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
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
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
  useDisclosure,
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

// Types
interface SheetSourceConfig {
  source: string
  defaultSheetUrl: string
  connected: boolean
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

interface CampaignOption {
  id: string
  name: string
  status?: string
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
  blackbook: 'Blackbook',
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
  const [syncResults, setSyncResults] = useState<Record<string, SyncResult>>({})
  const [previewResults, setPreviewResults] = useState<Record<string, PreviewResult>>({})
  const [snapshotLists, setSnapshotLists] = useState<Record<string, SnapshotList[]>>({})
  const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([])
  const [campaignsLoading, setCampaignsLoading] = useState(false)
  const [campaignsError, setCampaignsError] = useState<string | null>(null)
  const [selectedSnapshot, setSelectedSnapshot] = useState<SnapshotList | null>(null)
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('')
  const [newCampaignName, setNewCampaignName] = useState('')
  const [campaignSubmitting, setCampaignSubmitting] = useState(false)
  const { isOpen: isCampaignModalOpen, onOpen: onCampaignModalOpen, onClose: onCampaignModalClose } = useDisclosure()
  const toast = useToast()

  // Load sources on mount
  useEffect(() => {
    loadSources()
  }, [])

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
      res.data.sources.forEach(s => {
        urls[s.source] = s.sheetUrl || s.defaultSheetUrl
      })
      setSheetUrls(urls)

      await Promise.all(res.data.sources.map(s => loadSnapshotLists(s.source)))
    }
    
    setLoading(false)
  }

  const handleConnect = async (source: string) => {
    const sheetUrl = sheetUrls[source]
    if (!sheetUrl) {
      toast({
        title: 'Sheet URL required',
        status: 'error',
        duration: 3000,
      })
      return
    }

    const res = await api.post<{ success: boolean; error?: string }>(
      `/api/sheets/sources/${source}/connect`,
      { sheetUrl }
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

  const handleOpenSnapshotList = (listId: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set('tab', 'marketing-home')
    url.searchParams.set('view', 'lists')
    url.searchParams.set('listId', listId)
    window.location.assign(url.toString())
  }

  const handleGoToCampaign = (campaignId: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set('tab', 'marketing-home')
    url.searchParams.set('view', 'campaigns')
    url.searchParams.set('campaignId', campaignId)
    window.location.assign(url.toString())
  }

  const loadCampaignOptions = async () => {
    setCampaignsLoading(true)
    setCampaignsError(null)
    const res = await api.get<CampaignOption[]>('/api/campaigns')
    if (res.error) {
      setCampaignsError(res.error)
      setCampaignOptions([])
    } else {
      setCampaignOptions(res.data || [])
    }
    setCampaignsLoading(false)
  }

  const openUseInCampaign = async (snapshot: SnapshotList) => {
    setSelectedSnapshot(snapshot)
    setSelectedCampaignId('')
    setNewCampaignName('')
    onCampaignModalOpen()
    await loadCampaignOptions()
  }

  const closeUseInCampaign = () => {
    onCampaignModalClose()
    setSelectedSnapshot(null)
    setSelectedCampaignId('')
    setNewCampaignName('')
    setCampaignsError(null)
  }

  const handleAttachToCampaign = async () => {
    if (!selectedSnapshot) return

    if (!selectedCampaignId) {
      toast({
        title: 'Select a campaign',
        status: 'error',
        duration: 3000,
      })
      return
    }

    if (selectedCampaignId === 'new' && !newCampaignName.trim()) {
      toast({
        title: 'Campaign name required',
        status: 'error',
        duration: 3000,
      })
      return
    }

    setCampaignSubmitting(true)

    let campaignId = selectedCampaignId
    if (selectedCampaignId === 'new') {
      const createRes = await api.post<{ id: string }>('/api/campaigns', {
        name: newCampaignName.trim(),
        status: 'draft',
      })
      if (createRes.error || !createRes.data?.id) {
        setCampaignSubmitting(false)
        toast({
          title: 'Failed to create campaign',
          description: createRes.error || 'Campaign ID not returned',
          status: 'error',
          duration: 5000,
        })
        return
      }
      campaignId = createRes.data.id
    }

    const attachRes = await api.patch(`/api/campaigns/${campaignId}`, {
      listId: selectedSnapshot.id,
    })

    setCampaignSubmitting(false)

    if (attachRes.error) {
      toast({
        title: 'Failed to attach snapshot',
        description: attachRes.error,
        status: 'error',
        duration: 5000,
      })
      return
    }

    closeUseInCampaign()
    toast({
      title: 'Snapshot attached to campaign',
      status: 'success',
      duration: 5000,
      render: ({ onClose }) => (
        <Box bg="green.500" color="white" p={4} borderRadius="md">
          <Text fontWeight="bold" mb={2}>Snapshot attached to campaign</Text>
          <Button size="sm" variant="outline" onClick={() => { onClose(); handleGoToCampaign(campaignId) }}>
            Go to Campaign
          </Button>
        </Box>
      ),
    })
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
                {source.sheetUrl && source.connected && (
                  <Text fontSize="sm" color="gray.600" mt={2}>
                    Connected sheet:{" "}
                    <Link href={source.sheetUrl} isExternal color="blue.500">
                      {source.sheetUrl}
                    </Link>
                  </Text>
                )}
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

        {/* Recent Snapshots */}
        {snapshots.length > 0 && (
          <Card mt={6}>
            <CardHeader>
              <Heading size="sm">Recent Snapshots</Heading>
            </CardHeader>
            <CardBody>
              <VStack align="stretch" spacing={3}>
                {snapshots.map((list) => (
                  <Flex key={list.id} align="center" justify="space-between">
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
                      <Button size="sm" colorScheme="blue" onClick={() => openUseInCampaign(list)}>
                        Use in Campaign
                      </Button>
                    </HStack>
                  </Flex>
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
            Connect Google Sheets to import contacts from Cognism, Apollo, and Blackbook
          </Text>
        </Box>
        <Button leftIcon={<RepeatIcon />} onClick={loadSources} variant="outline">
          Refresh
        </Button>
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
            Blackbook
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

      <Modal isOpen={isCampaignModalOpen} onClose={closeUseInCampaign} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Use snapshot in campaign</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack align="stretch" spacing={4}>
              <Box>
                <Text fontWeight="semibold">{selectedSnapshot?.name || 'Snapshot'}</Text>
                <Text fontSize="sm" color="gray.500">
                  {selectedSnapshot?.memberCount ?? 0} members
                </Text>
              </Box>

              <FormControl>
                <FormLabel>Select campaign</FormLabel>
                <Select
                  placeholder={campaignsLoading ? 'Loading campaigns...' : 'Choose a campaign'}
                  value={selectedCampaignId}
                  onChange={(e) => setSelectedCampaignId(e.target.value)}
                  isDisabled={campaignsLoading}
                >
                  {campaignOptions.map(campaign => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}{campaign.status ? ` (${campaign.status})` : ''}
                    </option>
                  ))}
                  <option value="new">Create new campaign</option>
                </Select>
                {campaignsError && (
                  <Text mt={2} fontSize="sm" color="red.500">
                    {campaignsError}
                  </Text>
                )}
              </FormControl>

              {selectedCampaignId === 'new' && (
                <FormControl>
                  <FormLabel>New campaign name</FormLabel>
                  <Input
                    value={newCampaignName}
                    onChange={(e) => setNewCampaignName(e.target.value)}
                    placeholder="Enter campaign name"
                  />
                </FormControl>
              )}

              <Alert status="info">
                <AlertIcon />
                <AlertDescription>
                  This does NOT send emails. Campaign remains in Draft.
                </AlertDescription>
              </Alert>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={closeUseInCampaign}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleAttachToCampaign}
              isLoading={campaignSubmitting}
              isDisabled={!selectedSnapshot}
            >
              Confirm
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}

export default LeadSourcesTab
