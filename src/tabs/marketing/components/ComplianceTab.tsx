import { useCallback, useEffect, useState } from 'react'
import {
  Box,
  Button,
  Heading,
  HStack,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Text,
  VStack,
  Alert,
  AlertIcon,
  AlertDescription,
  FormControl,
  FormLabel,
  Input,
  Select,
  IconButton,
  Spinner,
  Badge,
  useToast,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Textarea,
  Progress,
  List,
  ListItem,
  ListIcon,
  CheckIcon,
} from '@chakra-ui/react'
import { DeleteIcon, AttachmentIcon, CloseIcon } from '@chakra-ui/icons'
import { api } from '../../../utils/api'
import { settingsStore } from '../../../platform'

type SuppressionEntry = {
  id: string
  customerId: string
  type: 'domain' | 'email'
  value: string
  emailNormalized?: string | null
  reason?: string | null
  source?: string | null
  sourceFileName?: string | null
  createdAt: string
}

export default function ComplianceTab() {
  const [entries, setEntries] = useState<SuppressionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState<'domain' | 'email'>('domain')
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')
  const [customerId, setCustomerId] = useState<string>(
    settingsStore.getCurrentCustomerId('prod-customer-1'),
  )
  const [importing, setImporting] = useState(false)
  const [csvData, setCsvData] = useState('')
  const [importResults, setImportResults] = useState<{
    imported: number
    duplicates: number
    errors: string[]
    totalProcessed: number
  } | null>(null)
  const toast = useToast()

  const loadEntries = useCallback(async () => {
    setLoading(true)
    const { data, error } = await api.get<SuppressionEntry[]>(
      `/api/suppression?customerId=${customerId}`,
    )
    if (error) {
      toast({ title: 'Error', description: error, status: 'error' })
    } else if (data) {
      setEntries(data)
    }
    setLoading(false)
  }, [customerId, toast])

  useEffect(() => {
    if (customerId) loadEntries()
  }, [customerId, loadEntries])

  useEffect(() => {
    const unsubscribe = settingsStore.onSettingsUpdated((detail) => {
      const next = (detail as { currentCustomerId?: string } | null)?.currentCustomerId
      if (next) setCustomerId(next)
    })
    return () => unsubscribe()
  }, [])

  const handleAdd = async () => {
    const payload = {
      type,
      value: value.trim(),
      reason: reason.trim() || undefined,
      source: 'manual',
    }
    if (!payload.value) {
      toast({ title: 'Validation error', description: 'Value is required', status: 'error' })
      return
    }

    const { error } = await api.post(`/api/suppression?customerId=${customerId}`, payload)
    if (error) {
      toast({ title: 'Error', description: error, status: 'error' })
      return
    }
    toast({ title: 'Added', description: 'Suppression entry saved', status: 'success' })
    setValue('')
    setReason('')
    loadEntries()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this suppression entry?')) return
    const { error } = await api.delete(`/api/suppression/${id}?customerId=${customerId}`)
    if (error) {
      toast({ title: 'Error', description: error, status: 'error' })
      return
    }
    toast({ title: 'Removed', description: 'Suppression entry deleted', status: 'success' })
    setEntries((prev) => prev.filter((entry) => entry.id !== id))
  }

  const parseCSV = (csvText: string): Array<{ email?: string; domain?: string; reason?: string }> => {
    const lines = csvText.trim().split('\n')
    if (lines.length < 2) return []

    const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''))
    const emailIndex = headers.indexOf('email')
    const domainIndex = headers.indexOf('domain')
    const reasonIndex = headers.indexOf('reason')

    if (emailIndex === -1 && domainIndex === -1) {
      throw new Error('CSV must contain at least one of: email, domain columns')
    }

    const results = []
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
      const entry: any = {}

      if (emailIndex >= 0 && values[emailIndex]) {
        entry.email = values[emailIndex]
      }
      if (domainIndex >= 0 && values[domainIndex]) {
        entry.domain = values[domainIndex]
      }
      if (reasonIndex >= 0 && values[reasonIndex]) {
        entry.reason = values[reasonIndex]
      }

      if (entry.email || entry.domain) {
        results.push(entry)
      }
    }
    return results
  }

  const handleImportCSV = async () => {
    if (!csvData.trim()) {
      toast({ title: 'Validation error', description: 'Please paste CSV data', status: 'error' })
      return
    }

    try {
      const entries = parseCSV(csvData)
      if (entries.length === 0) {
        toast({ title: 'Validation error', description: 'No valid entries found in CSV', status: 'error' })
        return
      }

      setImporting(true)
      const { data, error } = await api.post(`/api/suppression/import-csv?customerId=${customerId}`, {
        entries,
        sourceFileName: 'manual-import.csv',
      })

      if (error) {
        toast({ title: 'Import failed', description: error, status: 'error' })
        return
      }

      setImportResults(data)
      setCsvData('')
      loadEntries()

      toast({
        title: 'Import completed',
        description: `Imported ${data.imported} entries (${data.duplicates} duplicates, ${data.errors.length} errors)`,
        status: data.errors.length > 0 ? 'warning' : 'success',
      })
    } catch (err) {
      toast({
        title: 'Import failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        status: 'error',
      })
    } finally {
      setImporting(false)
    }
  }

  return (
    <Box>
      <VStack align="stretch" spacing={6}>
        <Box>
          <Heading size="lg" mb={2}>Compliance List</Heading>
          <Text fontSize="sm" color="gray.600">
            Manage suppression lists to prevent emails from being sent to unsubscribed or problematic recipients.
          </Text>
        </Box>

        <Alert status="info">
          <AlertIcon />
          <AlertDescription fontSize="sm">
            Suppression lists prevent emails from being sent to unsubscribed or problematic recipients. Each entry is scoped to the selected customer.
          </AlertDescription>
        </Alert>

        <Tabs variant="enclosed">
          <TabList>
            <Tab>Manual Entry</Tab>
            <Tab>CSV Import</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <Box borderWidth="1px" borderRadius="lg" p={4} bg="white">
                <Heading size="sm" mb={3}>Add suppression entry</Heading>
          <HStack spacing={3} align="flex-end" flexWrap="wrap">
            <FormControl w={{ base: '100%', md: '180px' }}>
              <FormLabel fontSize="sm">Type</FormLabel>
              <Select value={type} onChange={(e) => setType(e.target.value as 'domain' | 'email')}>
                <option value="domain">Domain</option>
                <option value="email">Email</option>
              </Select>
            </FormControl>
            <FormControl flex="1" minW={{ base: '100%', md: '220px' }}>
              <FormLabel fontSize="sm">Value</FormLabel>
              <Input
                placeholder={type === 'domain' ? 'domain.com' : 'name@domain.com'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </FormControl>
            <FormControl flex="1" minW={{ base: '100%', md: '240px' }}>
              <FormLabel fontSize="sm">Reason (optional)</FormLabel>
              <Input
                placeholder="e.g. Requested removal"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </FormControl>
            <Button colorScheme="teal" onClick={handleAdd}>
              Add
            </Button>
          </HStack>
        </Box>

        <Box bg="white" borderRadius="lg" border="1px solid" borderColor="gray.200" overflowX="auto">
          {loading ? (
            <Box textAlign="center" py={10}>
              <Spinner size="xl" />
            </Box>
          ) : (
            <Table size="sm">
              <Thead bg="gray.50">
                <Tr>
                  <Th>Type</Th>
                  <Th>Value</Th>
                  <Th>Reason</Th>
                  <Th>Source</Th>
                  <Th>Added</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {entries.length === 0 ? (
                  <Tr>
                    <Td colSpan={6} textAlign="center" py={6}>
                      <Text color="gray.500">No suppression entries yet.</Text>
                    </Td>
                  </Tr>
                ) : (
                  entries.map((entry) => (
                    <Tr key={entry.id}>
                      <Td>
                        <Badge colorScheme={entry.type === 'domain' ? 'purple' : 'blue'}>
                          {entry.type.toUpperCase()}
                        </Badge>
                      </Td>
                      <Td fontWeight="medium">{entry.value}</Td>
                      <Td fontSize="sm">{entry.reason || '-'}</Td>
                      <Td fontSize="sm">{entry.source || '-'}</Td>
                      <Td fontSize="sm">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </Td>
                      <Td>
                        <IconButton
                          aria-label="Remove"
                          icon={<DeleteIcon />}
                          size="xs"
                          variant="ghost"
                          colorScheme="red"
                          onClick={() => handleDelete(entry.id)}
                        />
                      </Td>
                    </Tr>
                  ))
                )}
              </Tbody>
            </Table>
          )}
        </Box>
            </TabPanel>

            <TabPanel>
              <Box borderWidth="1px" borderRadius="lg" p={4} bg="white">
                <Heading size="sm" mb={3}>Import from CSV</Heading>
                <VStack spacing={4} align="stretch">
                  <Alert status="info" fontSize="sm">
                    <AlertIcon />
                    CSV format: Include columns "email", "domain", and/or "reason". Emails and domains are normalized and deduplicated automatically.
                  </Alert>

                  <FormControl>
                    <FormLabel fontSize="sm">CSV Data</FormLabel>
                    <Textarea
                      placeholder={`email,reason
john@example.com,Requested removal
jane@example.com,Hard bounce
gmail.com,Domain block`}
                      value={csvData}
                      onChange={(e) => setCsvData(e.target.value)}
                      rows={8}
                      fontFamily="mono"
                      fontSize="sm"
                    />
                  </FormControl>

                  <Button
                    colorScheme="teal"
                    onClick={handleImportCSV}
                    isLoading={importing}
                    loadingText="Importing..."
                    leftIcon={<AttachmentIcon />}
                  >
                    Import CSV
                  </Button>

                  {importResults && (
                    <Box borderWidth="1px" borderRadius="md" p={4}>
                      <Heading size="sm" mb={3}>Import Results</Heading>
                      <VStack align="stretch" spacing={2}>
                        <HStack justify="space-between">
                          <Text fontSize="sm">Total processed:</Text>
                          <Text fontWeight="bold">{importResults.totalProcessed}</Text>
                        </HStack>
                        <HStack justify="space-between">
                          <Text fontSize="sm" color="green.600">Imported:</Text>
                          <Text fontWeight="bold" color="green.600">{importResults.imported}</Text>
                        </HStack>
                        <HStack justify="space-between">
                          <Text fontSize="sm" color="orange.600">Duplicates:</Text>
                          <Text fontWeight="bold" color="orange.600">{importResults.duplicates}</Text>
                        </HStack>
                        {importResults.errors.length > 0 && (
                          <Box>
                            <Text fontSize="sm" color="red.600" mb={1}>Errors ({importResults.errors.length}):</Text>
                            <List spacing={1} maxH="200px" overflowY="auto">
                              {importResults.errors.slice(0, 10).map((error, i) => (
                                <ListItem key={i} fontSize="xs" color="red.600">
                                  <ListIcon as={CloseIcon} color="red.600" />
                                  {error}
                                </ListItem>
                              ))}
                              {importResults.errors.length > 10 && (
                                <ListItem fontSize="xs" color="red.600">
                                  ... and {importResults.errors.length - 10} more errors
                                </ListItem>
                              )}
                            </List>
                          </Box>
                        )}
                      </VStack>
                    </Box>
                  )}
                </VStack>
              </Box>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </VStack>
    </Box>
  )
}
