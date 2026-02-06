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
  Grid,
  GridItem,
  Heading,
  HStack,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
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
}

interface SyncResult {
  success: boolean
  source: string
  sheetTitle?: string
  totalRows?: number
  imported?: number
  updated?: number
  skipped?: number
  errors?: string[]
  lastSyncAt?: string
  mappings?: Record<string, string | null>
  preview?: ContactPreview[]
  listId?: string
  listName?: string
  error?: string
}

interface ContactPreview {
  email: string
  firstName: string
  lastName: string
  companyName: string
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncingSource, setSyncingSource] = useState<string | null>(null)
  const [sheetUrls, setSheetUrls] = useState<Record<string, string>>({})
  const [syncResults, setSyncResults] = useState<Record<string, SyncResult>>({})
  const toast = useToast()

  // Load sources on mount
  useEffect(() => {
    loadSources()
  }, [])

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
      
      // Initialize sheet URLs from sources
      const urls: Record<string, string> = {}
      res.data.sources.forEach(s => {
        urls[s.source] = s.sheetUrl || s.defaultSheetUrl
      })
      setSheetUrls(urls)
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
    const result = syncResults[source.source]
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
                <Button
                  leftIcon={isSyncing ? <Spinner size="sm" /> : <RepeatIcon />}
                  colorScheme="blue"
                  onClick={() => handleSync(source.source)}
                  isLoading={isSyncing}
                  loadingText="Syncing..."
                >
                  Sync Now
                </Button>
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
                      Contact your administrator to set up the GOOGLE_SERVICE_ACCOUNT_JSON environment variable.
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
        {result && result.success && (
          <Card mb={6}>
            <CardHeader>
              <Heading size="sm">Last Sync Results</Heading>
            </CardHeader>
            <CardBody>
              <VStack align="stretch" spacing={4}>
                {/* Mapping Info */}
                {result.mappings && (
                  <Box>
                    <Text fontWeight="bold" mb={2}>Column Mappings Detected:</Text>
                    <SimpleGrid columns={{ base: 2, md: 4 }} spacing={2}>
                      {Object.entries(result.mappings).map(([field, header]) => (
                        <HStack key={field}>
                          <Badge colorScheme={header ? 'green' : 'gray'}>
                            {field}
                          </Badge>
                          <Text fontSize="sm" color={header ? 'green.600' : 'gray.400'}>
                            {header || 'Not found'}
                          </Text>
                        </HStack>
                      ))}
                    </SimpleGrid>
                  </Box>
                )}

                {/* Added to list info */}
                {result.listName && (
                  <Alert status="info">
                    <AlertIcon />
                    Contacts added to list: <strong>{result.listName}</strong>
                  </Alert>
                )}

                {/* Sync Errors */}
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
            </CardBody>
          </Card>
        )}

        {/* Preview Table */}
        {result && result.preview && result.preview.length > 0 && (
          <Card>
            <CardHeader>
              <Heading size="sm">
                Preview (first {result.preview.length} of {result.totalRows} rows)
              </Heading>
            </CardHeader>
            <CardBody>
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
                    {result.preview.map((contact, idx) => (
                      <Tr key={idx}>
                        <Td>{contact.email}</Td>
                        <Td>{contact.firstName}</Td>
                        <Td>{contact.lastName}</Td>
                        <Td>{contact.companyName}</Td>
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
    </Box>
  )
}

export default LeadSourcesTab
