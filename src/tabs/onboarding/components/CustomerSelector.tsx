import { useCallback, useEffect, useState } from 'react'
import {
  Box,
  FormControl,
  FormLabel,
  HStack,
  IconButton,
  Select,
  Spinner,
  Text,
  useToast,
  VStack,
} from '@chakra-ui/react'
import { RepeatIcon } from '@chakra-ui/icons'
import { api } from '../../../utils/api'
import { settingsStore } from '../../../platform'
import { on } from '../../../platform/events'
import { onboardingDebug } from '../utils/debug'

type CustomerApi = {
  id: string
  name: string
  accountData?: Record<string, unknown> | null
}

interface CustomerSelectorProps {
  selectedCustomerId: string
  onCustomerChange: (customerId: string) => void
}

export default function CustomerSelector({ selectedCustomerId, onCustomerChange }: CustomerSelectorProps) {
  const toast = useToast()
  const [customers, setCustomers] = useState<CustomerApi[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    const { data, error } = await api.get<{ customers: CustomerApi[] } | CustomerApi[]>('/api/customers')
    if (error) {
      setLoadError(error)
      setIsLoading(false)
      return
    }
    
    // Normalize response: handle both array and { customers: array } shapes
    let apiCustomers: CustomerApi[]
    if (Array.isArray(data)) {
      apiCustomers = data
    } else if (data && typeof data === 'object' && 'customers' in data && Array.isArray(data.customers)) {
      apiCustomers = data.customers
    } else {
      apiCustomers = []
      if (data) {
        console.error('❌ Unexpected API response shape in CustomerSelector:', data)
        setLoadError('Unexpected API response format')
      }
    }
    setCustomers(apiCustomers)
    if (!selectedCustomerId || !apiCustomers.some((item) => item.id === selectedCustomerId)) {
      const firstCustomer = apiCustomers[0]?.id || ''
      onCustomerChange(firstCustomer)
      if (firstCustomer) {
        settingsStore.setCurrentCustomerId(firstCustomer)
      }
    }
    setIsLoading(false)
  }, [selectedCustomerId, onCustomerChange])

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
      settingsStore.setCurrentCustomerId(selectedCustomerId)
    }
  }, [selectedCustomerId])

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
                onChange={(e) => onCustomerChange(e.target.value)}
                placeholder={customers.length ? 'Select customer' : 'No customers found'}
                size="sm"
                flex="1"
              >
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </Select>
              <IconButton
                aria-label="Refresh customers"
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
                title="Refresh customer list"
              />
            </HStack>
          )}
        </FormControl>

        {loadError && (
          <Text color="red.500" fontSize="xs">
            {loadError}
          </Text>
        )}

        {!isLoading && customers.length === 0 && (
          <Text fontSize="xs" color="gray.500">
            No customers found. Create a customer in the Customers tab first.
          </Text>
        )}
      </VStack>
    </Box>
  )
}
