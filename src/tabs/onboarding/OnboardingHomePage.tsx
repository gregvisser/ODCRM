import { useMemo, useCallback, useEffect } from 'react'
import { Alert, AlertDescription, AlertIcon, AlertTitle, Badge, Box, Button, Flex, HStack, SimpleGrid, Text, VStack } from '@chakra-ui/react'
import { EditIcon } from '@chakra-ui/icons'
import CustomerSelector from './components/CustomerSelector'
import CustomerOnboardingTab from './CustomerOnboardingTab'
import { onboardingDebug } from './utils/debug'
import { useClientReadinessState } from '../../hooks/useClientReadinessState'
import { getClientReadinessColorScheme } from '../../utils/clientReadinessState'
import { useScopedCustomerSelection } from '../../hooks/useCustomerScope'
import { isClientUI } from '../../platform/mode'

export type OnboardingViewId = 'customer-onboarding'

function getNextStepButtonLabel(
  target: OnboardingViewId | 'onboarding' | 'clients' | 'marketing-readiness' | 'marketing-inbox' | 'marketing-reports' | 'marketing-sequences',
): string {
  switch (target) {
    case 'clients':
      return 'Open client details'
    case 'marketing-inbox':
      return 'Open inbox'
    case 'marketing-reports':
      return 'Open reports'
    case 'marketing-sequences':
      return 'Open sequences'
    case 'marketing-readiness':
      return 'Review marketing readiness'
    case 'customer-onboarding':
    case 'onboarding':
    default:
      return 'Continue onboarding'
  }
}

function coerceViewId(view?: string): OnboardingViewId {
  return 'customer-onboarding'
}

interface OnboardingHomePageProps {
  view?: string
  onNavigate?: (view: OnboardingViewId) => void
}

export default function OnboardingHomePage({ view, onNavigate }: OnboardingHomePageProps) {
  coerceViewId(view)
  const { customerId: selectedCustomerId, setCustomerId: setSelectedCustomerId } = useScopedCustomerSelection()
  const { signal, interpretation: readiness } = useClientReadinessState(selectedCustomerId || null)

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

  const handleContinueToMarketingReadiness = useCallback(() => {
    window.dispatchEvent(new CustomEvent('navigateToMarketing', { detail: { view: 'readiness' } }))
  }, [])

  const runReadinessNextStep = useCallback(() => {
    switch (readiness.nextStep.target) {
      case 'clients':
        window.dispatchEvent(new CustomEvent('navigateToAccount'))
        break
      case 'marketing-inbox':
        window.dispatchEvent(new CustomEvent('navigateToMarketing', { detail: { view: 'inbox' } }))
        break
      case 'marketing-reports':
        window.dispatchEvent(new CustomEvent('navigateToMarketing', { detail: { view: 'reports' } }))
        break
      case 'marketing-sequences':
        window.dispatchEvent(new CustomEvent('navigateToMarketing', { detail: { view: 'sequences' } }))
        break
      case 'marketing-readiness':
        handleContinueToMarketingReadiness()
        break
      case 'onboarding':
      default:
        onNavigate?.('customer-onboarding')
        break
    }
  }, [handleContinueToMarketingReadiness, onNavigate, readiness.nextStep.target])

  const activationChecks = useMemo(() => {
    const mapCheck = (label: string, value: boolean | null) => ({
      label,
      complete: value === true,
      unknown: value === null,
    })
    return [
      mapCheck('Email identities connected', signal.checks.emailIdentitiesConnected),
      mapCheck('Suppression list connected', signal.checks.suppressionConfigured),
      mapCheck('Lead source connected', signal.checks.leadSourceConfigured),
      mapCheck('Template and sequence basics ready', signal.checks.templateAndSequenceReady),
    ]
  }, [signal.checks])

  const canProceedToOperations = readiness.state === 'ready-for-outreach' || readiness.state === 'outreach-active'
  const blockersCount = activationChecks.filter((item) => !item.complete).length
  const readyCheckCount = activationChecks.filter((item) => item.complete).length

  return (
    <Flex direction="column" h="100%">
      {!isClientUI() && (
        <Box mb={4}>
          <CustomerSelector selectedCustomerId={selectedCustomerId} onCustomerChange={handleCustomerChange} />
        </Box>
      )}

      <Box flex="1">
        <Box
          mb={4}
          p={4}
          bg="blue.50"
          borderRadius="md"
          border="1px solid"
          borderColor="blue.100"
          data-testid="onboarding-marketing-bridge"
        >
          <VStack align="start" spacing={1}>
            <HStack spacing={2}>
              <EditIcon color="blue.700" />
              <Text fontSize="sm" fontWeight="semibold" color="blue.900">
                Onboarding
              </Text>
            </HStack>
            <Text fontSize="sm" color="blue.800">
              Select a client, then complete account details and the embedded checklist in one place.
            </Text>
          </VStack>
          <HStack mt={2} spacing={2}>
            <Badge colorScheme={getClientReadinessColorScheme(readiness.state)} data-testid="onboarding-client-readiness-state">
              {readiness.label}
            </Badge>
            <Text fontSize="sm" color="blue.900">
              {readiness.reason}
            </Text>
          </HStack>
          <HStack mt={3}>
            <Button
              size="sm"
              variant="outline"
              colorScheme="teal"
              onClick={runReadinessNextStep}
              isDisabled={!selectedCustomerId}
              data-testid="onboarding-readiness-next-step"
            >
              {getNextStepButtonLabel(readiness.nextStep.target)}
            </Button>
            <Button
              size="sm"
              colorScheme="blue"
              onClick={handleContinueToMarketingReadiness}
              isDisabled={!selectedCustomerId}
              data-testid="onboarding-go-marketing-readiness"
            >
              Review marketing readiness
            </Button>
            {!selectedCustomerId ? (
              <Text fontSize="xs" color="blue.700">
                Select a client first.
              </Text>
            ) : null}
          </HStack>
          <Box
            mt={3}
            p={3}
            borderRadius="md"
            border="1px solid"
            borderColor="blue.200"
            bg="white"
            data-testid="onboarding-blocker-vs-proceed"
          >
            <VStack align="start" spacing={2}>
              <Text fontSize="xs" fontWeight="bold" textTransform="uppercase" color="blue.700">
                Go-live follow-up
              </Text>
              <HStack spacing={2} flexWrap="wrap">
                <Badge colorScheme={canProceedToOperations ? 'green' : 'orange'} data-testid="onboarding-activation-state">
                  {canProceedToOperations ? 'Ready to move forward' : `${blockersCount} follow-up item(s) left`}
                </Badge>
                <Badge colorScheme="blue">{`${readyCheckCount} of ${activationChecks.length} checks ready`}</Badge>
              </HStack>
              <Text fontSize="sm" color="blue.900">
                These checks help confirm the client can move safely from onboarding into live outreach.
              </Text>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={1} width="100%">
                {activationChecks.map((item) => (
                  <HStack key={item.label} spacing={2}>
                    <Badge colorScheme={item.complete ? 'green' : item.unknown ? 'gray' : 'red'} minW="90px" textAlign="center">
                      {item.complete ? 'Ready' : item.unknown ? 'Pending' : 'Missing'}
                    </Badge>
                    <Text fontSize="xs" color="blue.900">
                      {item.label}
                    </Text>
                  </HStack>
                ))}
              </SimpleGrid>
            </VStack>
          </Box>
        </Box>

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
          <CustomerOnboardingTab customerId={selectedCustomerId} />
        )}
      </Box>
    </Flex>
  )
}
