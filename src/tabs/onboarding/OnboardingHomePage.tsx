/**
 * OnboardingHomePage - Restructured with SubNavigation and left panel
 * Follows Marketing section pattern with customer selector in left panel
 */

import { useState, useMemo, useCallback } from 'react'
import { Box, Flex, Text, VStack } from '@chakra-ui/react'
import { InfoIcon, EditIcon, CheckCircleIcon } from '@chakra-ui/icons'
import { SubNavigation, type SubNavItem } from '../../design-system'
import CustomerSelector from './components/CustomerSelector'
import CreateCustomerStep from './components/CreateCustomerStep'
import OnboardingOverview from './OnboardingOverview'
import ProgressTrackerTab from './ProgressTrackerTab'
import CustomerOnboardingTab from './CustomerOnboardingTab'

export type OnboardingViewId = 'create-customer' | 'overview' | 'customer-onboarding' | 'progress-tracker'

function coerceViewId(view?: string): OnboardingViewId {
  if (view === 'create-customer' || view === 'customer-onboarding' || view === 'progress-tracker') {
    return view
  }
  return 'overview'
}

interface OnboardingHomePageProps {
  view?: string
  onNavigate?: (view: OnboardingViewId) => void
}

export default function OnboardingHomePage({ view, onNavigate }: OnboardingHomePageProps) {
  const activeView = coerceViewId(view)
  const [selectedCustomerId, setSelectedCustomerId] = useState('')

  // Handler when customer is created - sets customer ID and navigates to Customer Onboarding
  const handleCustomerCreated = useCallback((customerId: string) => {
    console.log('🎉 OnboardingHomePage: Customer created, setting ID and navigating:', customerId)
    setSelectedCustomerId(customerId)
    onNavigate?.('customer-onboarding')
  }, [onNavigate])

  // Create navigation items with customer context
  const navItems: SubNavItem[] = useMemo(() => {
    // If no customer selected, show Create Customer as the primary action
    if (!selectedCustomerId) {
      return [
        {
          id: 'create-customer',
          label: 'Create Customer',
          icon: EditIcon,
          content: <CreateCustomerStep onCustomerCreated={handleCustomerCreated} />,
          sortOrder: 0,
        },
        {
          id: 'overview',
          label: 'Overview',
          icon: InfoIcon,
          content: <OnboardingOverview />,
          sortOrder: 1,
        },
      ]
    }

    // Customer selected - show full onboarding tabs
    return [
      {
        id: 'overview',
        label: 'Overview',
        icon: InfoIcon,
        content: <OnboardingOverview />,
        sortOrder: 0,
      },
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
    ]
  }, [selectedCustomerId, handleCustomerCreated])

  return (
    <Flex direction="column" h="100%">
      {/* Customer Selector - shown when customer exists or after creation */}
      {selectedCustomerId && (
        <Box mb={4}>
          <CustomerSelector 
            selectedCustomerId={selectedCustomerId} 
            onCustomerChange={setSelectedCustomerId} 
          />
        </Box>
      )}

      {/* SubNavigation with customer-aware content */}
      <Box flex="1">
        <SubNavigation
          key={`onboarding-${selectedCustomerId || 'no-customer'}`}
          items={navItems}
          activeId={activeView}
          onChange={(id) => onNavigate?.(id as OnboardingViewId)}
          title="Onboarding"
          enableDragDrop={false}
        />
      </Box>

      {/* Optional: Show customer selector at bottom when no customer selected */}
      {!selectedCustomerId && (
        <Box mt={4} p={4} bg="gray.50" borderRadius="md" border="1px solid" borderColor="gray.200">
          <Text fontSize="sm" fontWeight="semibold" mb={2} color="gray.700">
            Already have a customer account?
          </Text>
          <CustomerSelector 
            selectedCustomerId={selectedCustomerId} 
            onCustomerChange={(id) => {
              setSelectedCustomerId(id)
              onNavigate?.('customer-onboarding')
            }} 
          />
        </Box>
      )}
    </Flex>
  )
}
