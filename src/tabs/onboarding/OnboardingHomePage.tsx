import { useState, useMemo, useCallback, useEffect } from 'react'
import { Box, Flex, Text } from '@chakra-ui/react'
import { InfoIcon, EditIcon, CheckCircleIcon } from '@chakra-ui/icons'
import { SubNavigation, type SubNavItem } from '../../design-system'
import { getCurrentCustomerId, setCurrentCustomerId, onSettingsUpdated } from '../../platform/stores/settings'
import CustomerSelector from './components/CustomerSelector'
import OnboardingOverview from './OnboardingOverview'
import ProgressTrackerTab from './ProgressTrackerTab'
import CustomerOnboardingTab from './CustomerOnboardingTab'
import { onboardingDebug } from './utils/debug'

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

    // UX: after selecting/creating a customer, keep user in the unified onboarding form.
    onNavigate?.('customer-onboarding')
  }, [])

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
    ]

    // Only show the unified onboarding form and progress tracker when a customer is selected.
    if (selectedCustomerId) {
      items.push(
        {
          id: 'customer-onboarding',
          label: 'Customer Onboarding',
          icon: EditIcon,
          content: <CustomerOnboardingTab customerId={selectedCustomerId} />,
          sortOrder: 1,
        },
        {
          id: 'progress-tracker',
          label: 'Progress Tracker',
          icon: CheckCircleIcon,
          content: <ProgressTrackerTab customerId={selectedCustomerId} />,
          sortOrder: 2,
        },
      )
    }

    return items
  }, [selectedCustomerId])

  return (
    <Flex direction="column" h="100%">
      <Box mb={4}>
        <CustomerSelector selectedCustomerId={selectedCustomerId} onCustomerChange={handleCustomerChange} />
      </Box>

      <Box flex="1">
        {!selectedCustomerId ? (
          <Box mb={4} p={4} bg="gray.50" borderRadius="md" border="1px solid" borderColor="gray.200">
            <Text fontSize="sm" color="gray.700">
              Select a customer (or create one from the dropdown) to begin onboarding.
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
