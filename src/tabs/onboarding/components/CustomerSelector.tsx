import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  HStack,
  IconButton,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Spinner,
  Text,
  useDisclosure,
  useToast,
  VStack,
} from '@chakra-ui/react'
import { RepeatIcon } from '@chakra-ui/icons'
import { api } from '../../../utils/api'
import { normalizeCustomersListResponse } from '../../../utils/normalizeApiResponse'
import { setCurrentCustomerId } from '../../../platform/stores/settings'
import { on } from '../../../platform/events'
import { onboardingDebug } from '../utils/debug'
import { useCustomersFromDatabase } from '../../../hooks/useCustomersFromDatabase'

type CustomerApi = {
  id: string
  name: string
  accountData?: Record<string, unknown> | null
}

interface CustomerSelectorProps {
  selectedCustomerId: string
  onCustomerChange: (customerId: string) => void
}

const CREATE_NEW_VALUE = '__create_new_customer__'

export default function CustomerSelector({ selectedCustomerId, onCustomerChange }: CustomerSelectorProps) {
  const toast = useToast()
  const { createCustomer } = useCustomersFromDatabase()
  const [customers, setCustomers] = useState<CustomerApi[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const { isOpen, onOpen, onClose } = useDisclosure()
  const [isCreating, setIsCreating] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', domainOrWebsite: '' })

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    const { data, error } = await api.get('/api/customers')
    if (error) {
      setLoadError(error)
      setIsLoading(false)
      return
    }
    
    let apiCustomers: CustomerApi[]
    try {
      // Use canonical normalizer - throws on unexpected shape
      apiCustomers = normalizeCustomersListResponse(data) as CustomerApi[]
    } catch (err: any) {
      console.error('❌ Failed to normalize customers response in CustomerSelector:', err)
      setLoadError(err.message || 'Failed to parse customers response')
      setIsLoading(false)
      return
    }
    setCustomers(apiCustomers)
    if (!selectedCustomerId || !apiCustomers.some((item) => item.id === selectedCustomerId)) {
      const firstCustomer = apiCustomers[0]?.id || ''
      onCustomerChange(firstCustomer)
      if (firstCustomer) {
        setCurrentCustomerId(firstCustomer)
      }
    }
    setIsLoading(false)
  }, [selectedCustomerId, onCustomerChange])

  const sortedCustomers = useMemo(() => {
    return [...customers].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
  }, [customers])

  useEffect(() => {
    void fetchCustomers()
  }, [fetchCustomers])

  // Listen for customerCreated event to refresh dropdown
  useEffect(() => {
    const unsubscribe = on<{ id: string; name: string }>('customerCreated', () => {
      onboardingDebug('🔄 Customer created event received, refreshing customers list...')
      void fetchCustomers()
    })
    return () => unsubscribe()
  }, [fetchCustomers])

  // Persist customer selection
  useEffect(() => {
    if (selectedCustomerId) {
      setCurrentCustomerId(selectedCustomerId)
    }
  }, [selectedCustomerId])

  const handleSelectChange = (value: string) => {
    if (value === CREATE_NEW_VALUE) {
      // Open inline create modal; do not change selection yet
      onOpen()
      return
    }
    onCustomerChange(value)
  }

  const handleCreate = async () => {
    const name = createForm.name.trim()
    if (!name) {
      toast({ title: 'Name required', status: 'warning', duration: 2500 })
      return
    }

    setIsCreating(true)
    const rawDomain = createForm.domainOrWebsite.trim()
    // Accept either a domain (acme.com) or a website URL; store as domain for now to match existing API usage.
    const domain = rawDomain || null

    const { id, error } = await createCustomer({
      name,
      domain,
      clientStatus: 'onboarding',
      accountData: {
        createdViaOnboarding: true,
        createdAt: new Date().toISOString(),
      },
    })
    setIsCreating(false)

    if (error || !id) {
      toast({
        title: 'Create customer failed',
        description: error || 'Unknown error',
        status: 'error',
        duration: 6000,
        isClosable: true,
      })
      return
    }

    toast({ title: 'Customer created', status: 'success', duration: 2000 })
    setCreateForm({ name: '', domainOrWebsite: '' })
    onClose()

    // Refresh dropdown from DB and select new customer
    await fetchCustomers()
    onCustomerChange(id)
  }

  return (
    <Box
      bg="white"
      border="1px solid"
      borderColor="gray.200"
      borderRadius="md"
      p={3}
      mb={4}
    >
      <VStack align="stretch" spacing={3}>
        <FormControl>
          <FormLabel fontSize="sm" fontWeight="semibold" mb={2}>
            Customer
          </FormLabel>
          {isLoading ? (
            <HStack spacing={2}>
              <Spinner size="sm" />
              <Text fontSize="sm" color="gray.600">
                Loading...
              </Text>
            </HStack>
          ) : (
            <HStack spacing={2}>
              <Select
                value={selectedCustomerId}
                onChange={(e) => handleSelectChange(e.target.value)}
                placeholder={customers.length ? 'Select client' : 'No clients found'}
                size="sm"
                flex="1"
              >
                {sortedCustomers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
                <option value={CREATE_NEW_VALUE}>+ Create new client…</option>
              </Select>
              <IconButton
                aria-label="Refresh clients"
                icon={<RepeatIcon />}
                size="sm"
                variant="outline"
                onClick={() => {
                  toast({
                    title: 'Refreshing...',
                    status: 'info',
                    duration: 1000,
                  })
                  void fetchCustomers()
                }}
                title="Refresh client list"
              />
            </HStack>
          )}
        </FormControl>

        {loadError && (
          <Text color="red.500" fontSize="xs">
            {loadError}
          </Text>
        )}

        {!isLoading && customers.length === 0 ? (
          <Text fontSize="xs" color="gray.500">
            No clients found yet. Use “+ Create new client…” to start onboarding.
          </Text>
        ) : null}
      </VStack>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create new client</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack align="stretch" spacing={4}>
              <FormControl isRequired>
                <FormLabel fontSize="sm">Customer Name</FormLabel>
                <Input
                  value={createForm.name}
                  onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Acme Corporation Ltd"
                  autoFocus
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Domain or Website (optional)</FormLabel>
                <Input
                  value={createForm.domainOrWebsite}
                  onChange={(e) => setCreateForm((p) => ({ ...p, domainOrWebsite: e.target.value }))}
                  placeholder="e.g. acme.com or https://acme.com"
                />
              </FormControl>
              <Text fontSize="xs" color="gray.600">
                After creating, the customer will be selected and the onboarding form will load from the database.
              </Text>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="teal" onClick={() => void handleCreate()} isLoading={isCreating}>
              Create & Select
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}
