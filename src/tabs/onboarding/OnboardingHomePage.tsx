/**
 * OnboardingHomePage - Restructured with SubNavigation and left panel
 * Follows Marketing section pattern with customer selector in left panel
 */

import { useState, useMemo } from 'react'
import { Box, Flex, Text, VStack } from '@chakra-ui/react'
import { InfoIcon, EditIcon, CheckCircleIcon } from '@chakra-ui/icons'
import { SubNavigation, type SubNavItem } from '../../design-system'
import CustomerSelector from './components/CustomerSelector'
import OnboardingOverview from './OnboardingOverview'
import ProgressTrackerTab from './ProgressTrackerTab'
import CustomerOnboardingTab from './CustomerOnboardingTab'

export type OnboardingViewId = 'overview' | 'customer-onboarding' | 'progress-tracker'

function coerceViewId(view?: string): OnboardingViewId {
  if (view === 'customer-onboarding' || view === 'progress-tracker') {
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

  // Create navigation items with customer context
  const navItems: SubNavItem[] = useMemo(() => {
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
        content: selectedCustomerId ? (
          <CustomerOnboardingTab customerId={selectedCustomerId} />
        ) : (
          <EmptyState message="Select a customer to view onboarding details" />
        ),
        sortOrder: 1,
      },
      {
        id: 'progress-tracker',
        label: 'Progress Tracker',
        icon: CheckCircleIcon,
        content: selectedCustomerId ? (
          <ProgressTrackerTab customerId={selectedCustomerId} />
        ) : (
          <EmptyState message="Select a customer to track onboarding progress" />
        ),
        sortOrder: 2,
      },
    ]
  }, [selectedCustomerId])

  return (
    <Flex direction="column" h="100%">
      {/* Customer Selector above SubNavigation */}
      <Box mb={4}>
        <CustomerSelector 
          selectedCustomerId={selectedCustomerId} 
          onCustomerChange={setSelectedCustomerId} 
        />
      </Box>

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
    </Flex>
  )
}

// Empty state component for when no customer is selected
function EmptyState({ message }: { message: string }) {
  return (
    <Box
      border="1px dashed"
      borderColor="gray.300"
      borderRadius="xl"
      p={12}
      textAlign="center"
      bg="gray.50"
    >
      <VStack spacing={3}>
        <Text color="gray.500" fontSize="md" fontWeight="medium">
          {message}
        </Text>
        <Text color="gray.400" fontSize="sm">
          Use the customer selector above to choose a customer.
        </Text>
      </VStack>
    </Box>
  )
}
