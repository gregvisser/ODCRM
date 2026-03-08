import { useState, useMemo, useCallback, useEffect } from 'react'
import { Badge, Box, Button, Flex, HStack, Text } from '@chakra-ui/react'
import { InfoIcon, EditIcon, CheckCircleIcon } from '@chakra-ui/icons'
import { SubNavigation, type SubNavItem } from '../../design-system'
import { getCurrentCustomerId, setCurrentCustomerId, onSettingsUpdated } from '../../platform/stores/settings'
import { isClientUI } from '../../platform/mode'
import CustomerSelector from './components/CustomerSelector'
import OnboardingOverview from './OnboardingOverview'
import ProgressTrackerTab from './ProgressTrackerTab'
import CustomerOnboardingTab from './CustomerOnboardingTab'
import { onboardingDebug } from './utils/debug'
import { useClientReadinessState } from '../../hooks/useClientReadinessState'
import { getClientReadinessColorScheme } from '../../utils/clientReadinessState'

export type OnboardingViewId = 'overview' | 'customer-onboarding' | 'progress-tracker'

function coerceViewId(view?: string): OnboardingViewId {
  if (view === 'overview' || view === 'customer-onboarding' || view === 'progress-tracker') return view
  return 'overview'
}

interface OnboardingHomePageProps {
  view?: string
  onNavigate?: (view: OnboardingViewId) => void
}

export default function OnboardingHomePage({ view, onNavigate }: OnboardingHomePageProps) {
  const activeView = coerceViewId(view)
  // Use canonical settingsStore for customer selection (SINGLE SOURCE OF TRUTH)
  const [selectedCustomerId, setSelectedCustomerId] = useState(() => getCurrentCustomerId() ?? '')
  const { interpretation: readiness } = useClientReadinessState(selectedCustomerId || null)

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

    // UX: after selecting/creating a customer, keep user in the unified onboarding form.
    onNavigate?.('customer-onboarding')
  }, [onNavigate])

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

  const navItems: SubNavItem[] = useMemo(() => {
    // Overview is always available.
    const items: SubNavItem[] = [
      {
        id: 'overview',
        label: 'Overview',
        icon: InfoIcon,
        content: <OnboardingOverview customerId={selectedCustomerId || undefined} />,
        sortOrder: 0,
      },
      {
        id: 'progress-tracker',
        label: 'Progress Tracker',
        icon: CheckCircleIcon,
        content: <ProgressTrackerTab />,
        sortOrder: 2,
      },
    ]

    // Only show the unified onboarding form when a customer is selected.
    if (selectedCustomerId) {
      items.push(
        {
          id: 'customer-onboarding',
          label: 'Client Onboarding',
          icon: EditIcon,
          content: <CustomerOnboardingTab customerId={selectedCustomerId} />,
          sortOrder: 1,
        },
      )
    }

    return items
  }, [selectedCustomerId])

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
          <Text fontSize="sm" color="blue.900" fontWeight="semibold" data-testid="onboarding-role-framing">
            Onboarding is a setup progression area.
          </Text>
          <HStack mt={2} spacing={2}>
            <Badge colorScheme={getClientReadinessColorScheme(readiness.state)} data-testid="onboarding-client-readiness-state">
              {readiness.label}
            </Badge>
            <Text fontSize="sm" color="blue.900">{readiness.reason}</Text>
          </HStack>
          <Text fontSize="sm" color="blue.900" mt={1}>
            After setup tasks are complete for this client, continue in Marketing Readiness for daily outreach operations.
          </Text>
          <HStack mt={3}>
            <Button
              size="sm"
              variant="outline"
              colorScheme="teal"
              onClick={runReadinessNextStep}
              isDisabled={!selectedCustomerId}
              data-testid="onboarding-readiness-next-step"
            >
              {readiness.nextStep.label}
            </Button>
            <Button
              size="sm"
              colorScheme="blue"
              onClick={handleContinueToMarketingReadiness}
              isDisabled={!selectedCustomerId}
              data-testid="onboarding-go-marketing-readiness"
            >
              Continue in Marketing Readiness
            </Button>
            {!selectedCustomerId ? (
              <Text fontSize="xs" color="blue.700">
                Select a client first.
              </Text>
            ) : null}
          </HStack>
        </Box>

        {!selectedCustomerId ? (
          <Box mb={4} p={4} bg="gray.50" borderRadius="md" border="1px solid" borderColor="gray.200">
            <Text fontSize="sm" color="gray.700">
              Select a client (or create one from the dropdown) to begin onboarding.
            </Text>
          </Box>
        ) : null}

        <SubNavigation
          key={`onboarding-${selectedCustomerId || 'no-customer'}`}
          items={navItems}
          activeId={activeView}
          onChange={(id) => onNavigate?.(id as OnboardingViewId)}
          title="Onboarding"
          enableDragDrop={false}
        />
      </Box>
    </Flex>
  )
}
