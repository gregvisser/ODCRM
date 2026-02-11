import { useState, useCallback, useEffect } from 'react'
import { Box, Flex, Text } from '@chakra-ui/react'
import { getCurrentCustomerId, setCurrentCustomerId, onSettingsUpdated } from '../../platform/stores/settings'
import CustomerSelector from './components/CustomerSelector'
import CustomerOnboardingTab from './CustomerOnboardingTab'
import { onboardingDebug } from './utils/debug'

export type OnboardingViewId = 'onboarding'

interface OnboardingHomePageProps {
  view?: string
  onNavigate?: (view: OnboardingViewId) => void
}

export default function OnboardingHomePage({ view, onNavigate }: OnboardingHomePageProps) {
  // Use canonical settingsStore for customer selection (SINGLE SOURCE OF TRUTH)
  const [selectedCustomerId, setSelectedCustomerId] = useState(() => getCurrentCustomerId(''))

  // Sync with settingsStore on mount and when settings change globally
  useEffect(() => {
    onboardingDebug('🔄 OnboardingHomePage: Initial customerId from settingsStore:', selectedCustomerId)
    
    const unsubscribe = onSettingsUpdated((detail: any) => {
      if (detail && typeof detail.currentCustomerId === 'string') {
        onboardingDebug('🔄 OnboardingHomePage: Customer changed via settingsStore:', detail.currentCustomerId)
        setSelectedCustomerId(detail.currentCustomerId)
      }
    })
    return unsubscribe
  }, [])

  // Handler when customer changes via selector - update canonical store
  const handleCustomerChange = useCallback((customerId: string) => {
    onboardingDebug('🔄 OnboardingHomePage: Customer changed via selector:', customerId)
    setCurrentCustomerId(customerId) // Update canonical store
    setSelectedCustomerId(customerId) // Update local state
  }, [])

  return (
    <Flex direction="column" h="100%">
      <Box mb={4}>
        <CustomerSelector selectedCustomerId={selectedCustomerId} onCustomerChange={handleCustomerChange} />
      </Box>

      <Box flex="1">
        {!selectedCustomerId ? (
          <Box p={6} border="1px solid" borderColor="gray.200" borderRadius="xl" bg="white">
            <Text fontSize="sm" color="gray.600">
              Select a customer (or create one from the dropdown) to begin onboarding.
            </Text>
          </Box>
        ) : (
          <CustomerOnboardingTab customerId={selectedCustomerId} />
        )}
      </Box>
    </Flex>
  )
}
