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
} from '@chakra-ui/react'
import { DeleteIcon } from '@chakra-ui/icons'
import { api } from '../../../utils/api'
import { settingsStore } from '../../../platform'

type SuppressionEntry = {
  id: string
  customerId: string
  type: 'domain' | 'email'
  value: string
  reason?: string | null
  source?: string | null
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

  return (
    <Box>
      <VStack align="stretch" spacing={6}>
        <Box>
          <Heading size="lg" mb={2}>Deliverability & Compliance</Heading>
          <Text fontSize="sm" color="gray.600">
            Manage suppression lists, unsubscribe handling, and deliverability safety rails.
          </Text>
        </Box>

        <Alert status="info">
          <AlertIcon />
          <AlertDescription fontSize="sm">
            Unsubscribe and bounce handling is automated. Add domains or emails below to prevent outreach.
          </AlertDescription>
        </Alert>

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
      </VStack>
    </Box>
  )
}
