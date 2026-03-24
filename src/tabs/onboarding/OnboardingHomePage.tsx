import { useCallback, useEffect } from 'react'
import { Alert, AlertDescription, AlertIcon, AlertTitle, Box, Flex } from '@chakra-ui/react'
import CustomerSelector from './components/CustomerSelector'
import CustomerOnboardingTab from './CustomerOnboardingTab'
import { onboardingDebug } from './utils/debug'
import { useScopedCustomerSelection } from '../../hooks/useCustomerScope'
import { isClientUI } from '../../platform/mode'

export type OnboardingViewId = 'customer-onboarding'

interface OnboardingHomePageProps {
  /** Accepted for URL/parent compatibility; onboarding is a single view. */
  view?: string
  onNavigate?: (view: OnboardingViewId) => void
}

export default function OnboardingHomePage({ onNavigate }: OnboardingHomePageProps) {
  const { customerId: selectedCustomerId, setCustomerId: setSelectedCustomerId } = useScopedCustomerSelection()

  useEffect(() => {
    onboardingDebug('🔄 OnboardingHomePage: Initial customerId from settingsStore:', selectedCustomerId)
  }, [selectedCustomerId])

  const handleCustomerChange = useCallback(
    (customerId: string) => {
      onboardingDebug('🔄 OnboardingHomePage: Customer changed via selector:', customerId)
      setSelectedCustomerId(customerId)
      onNavigate?.('customer-onboarding')
    },
    [onNavigate, setSelectedCustomerId],
  )

  return (
    <Flex direction="column" h="100%">
      {!isClientUI() && (
        <Box mb={4}>
          <CustomerSelector selectedCustomerId={selectedCustomerId} onCustomerChange={handleCustomerChange} />
        </Box>
      )}

      <Box flex="1">
        {!selectedCustomerId ? (
          <Alert status="info" mb={4}>
            <AlertIcon />
            <Box>
              <AlertTitle>Select a client to begin</AlertTitle>
              <AlertDescription>
                Choose an existing client, or create one from the selector above, to continue onboarding.
              </AlertDescription>
            </Box>
          </Alert>
        ) : (
          <CustomerOnboardingTab key={selectedCustomerId} customerId={selectedCustomerId} />
        )}
      </Box>
    </Flex>
  )
}
