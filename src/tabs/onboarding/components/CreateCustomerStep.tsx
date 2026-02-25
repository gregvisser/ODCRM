/**
 * CreateCustomerStep - Initial onboarding step to create a new customer
 * This is the ONLY place users can create new customers in ODCRM.
 */

import { useState } from 'react'
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Input,
  VStack,
  Heading,
  Text,
  useToast,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from '@chakra-ui/react'
import { useCustomersFromDatabase } from '../../../hooks/useCustomersFromDatabase'
import { setCurrentCustomerId } from '../../../platform/stores/settings'
import { emit } from '../../../platform/events'
import { onboardingDebug, onboardingError } from '../utils/debug'

interface CreateCustomerStepProps {
  onCustomerCreated: (customerId: string) => void
}

export default function CreateCustomerStep({ onCustomerCreated }: CreateCustomerStepProps) {
  const toast = useToast()
  const { createCustomer } = useCustomersFromDatabase()
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    clientStatus: 'onboarding' as const,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    // Validate required fields
    if (!formData.name.trim()) {
      setFormError('Client name is required')
      return
    }

    setIsSubmitting(true)
    onboardingDebug('🚀 CreateCustomerStep: Creating customer:', { name: formData.name, domain: formData.domain })

    const { id, error } = await createCustomer({
      name: formData.name.trim(),
      domain: formData.domain.trim() || null,
      clientStatus: formData.clientStatus,
      accountData: {
        // Mark as created via onboarding wizard
        createdViaOnboarding: true,
        createdAt: new Date().toISOString(),
      },
    })

    setIsSubmitting(false)

    if (error || !id) {
      const errorMsg = error || 'Failed to create customer (no error details returned)'
      onboardingError('❌ CreateCustomerStep: Customer creation failed:', errorMsg)
      setFormError(errorMsg)
      toast({
        title: 'Create customer failed',
        description: errorMsg,
        status: 'error',
        duration: 8000,
        isClosable: true,
      })
      return
    }

    onboardingDebug('✅ CreateCustomerStep: Customer created successfully:', id)
    
    // Update canonical customer store FIRST
    setCurrentCustomerId(id)
    onboardingDebug('✅ CreateCustomerStep: Set canonical currentCustomerId:', id)
    
    // Emit customerCreated event for CustomerSelector to refresh
    emit('customerCreated', { id, name: formData.name })
    
    toast({
      title: 'Client created',
      description: `${formData.name} has been added. Continue with onboarding details.`,
      status: 'success',
      duration: 3000,
    })

    // Clear form and notify parent
    setFormData({ name: '', domain: '', clientStatus: 'onboarding' })
    onCustomerCreated(id)
  }

  return (
    <Box
      maxW="600px"
      mx="auto"
      p={8}
      bg="white"
      borderRadius="xl"
      border="1px solid"
      borderColor="gray.200"
      boxShadow="md"
    >
      <VStack spacing={6} align="stretch">
        <Box textAlign="center">
          <Heading size="lg" mb={2}>
            Create New Client
          </Heading>
          <Text color="gray.600" fontSize="md">
            Start the onboarding process by creating a new customer account.
            You'll be able to add detailed information in the next steps.
          </Text>
        </Box>

        {formError && (
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            <Box>
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Box>
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <VStack spacing={5} align="stretch">
            <FormControl isRequired isInvalid={!!formError && !formData.name.trim()}>
              <FormLabel fontWeight="semibold">Client Name</FormLabel>
              <Input
                placeholder="e.g., Acme Corporation Ltd"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                size="lg"
                autoFocus
              />
              <FormErrorMessage>Client name is required</FormErrorMessage>
            </FormControl>

            <FormControl>
              <FormLabel fontWeight="semibold">Company Domain (Optional)</FormLabel>
              <Input
                placeholder="e.g., acmecorp.com"
                value={formData.domain}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                size="lg"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                The company's website domain without https:// or www.
              </Text>
            </FormControl>

            <Button
              type="submit"
              colorScheme="teal"
              size="lg"
              isLoading={isSubmitting}
              loadingText="Creating..."
              width="100%"
              mt={4}
            >
              Create Client & Continue
            </Button>
          </VStack>
        </form>

        <Box pt={4} borderTop="1px solid" borderColor="gray.200">
          <Text fontSize="sm" color="gray.600" textAlign="center">
            After creating the customer, you'll be able to add contacts, profile details,
            and complete the full onboarding checklist.
          </Text>
        </Box>
      </VStack>
    </Box>
  )
}
