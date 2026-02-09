/**
 * OnboardingHomePage - Restructured with SubNavigation and left panel
 * Follows Marketing section pattern with customer selector in left panel
 */

import { useState, useMemo, useCallback, useEffect } from 'react'
import { Box, Flex, Text, VStack } from '@chakra-ui/react'
import { InfoIcon, EditIcon, CheckCircleIcon } from '@chakra-ui/icons'
import { SubNavigation, type SubNavItem } from '../../design-system'
import { getCurrentCustomerId, setCurrentCustomerId, onSettingsUpdated } from '../../platform/stores/settings'
import CustomerSelector from './components/CustomerSelector'
import CreateCustomerStep from './components/CreateCustomerStep'
import OnboardingOverview from './OnboardingOverview'
import ProgressTrackerTab from './ProgressTrackerTab'
import CustomerOnboardingTab from './CustomerOnboardingTab'
import { onboardingDebug } from './utils/debug'
import { api } from '../../utils/api'

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
  
  // Use canonical settingsStore for customer selection (SINGLE SOURCE OF TRUTH)
  const [selectedCustomerId, setSelectedCustomerId] = useState(() => getCurrentCustomerId(''))
  
  // Customer data for Complete Onboarding button
  const [customerData, setCustomerData] = useState<{ name: string; clientStatus: string } | null>(null)

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

  // Handler when customer is created - sets canonical customer ID and navigates
  const handleCustomerCreated = useCallback((customerId: string) => {
    onboardingDebug('🎉 OnboardingHomePage: Customer created, setting canonical ID:', customerId)
    setCurrentCustomerId(customerId) // Update canonical store
    setSelectedCustomerId(customerId) // Update local state
    onNavigate?.('customer-onboarding')
  }, [onNavigate])
  
  // Handler when customer changes via selector - update canonical store
  const handleCustomerChange = useCallback((customerId: string) => {
    onboardingDebug('🔄 OnboardingHomePage: Customer changed via selector:', customerId)
    setCurrentCustomerId(customerId) // Update canonical store
    setSelectedCustomerId(customerId) // Update local state
  }, [])

  // Fetch customer data for Complete Onboarding button
  const fetchCustomerData = useCallback(async () => {
    if (!selectedCustomerId) {
      setCustomerData(null)
      return
    }

    try {
      const { data, error } = await api.get<any>(`/api/customers/${selectedCustomerId}`)
      if (error || !data) {
        console.error('Failed to fetch customer data:', error)
        return
      }

      setCustomerData({
        name: data.name,
        clientStatus: data.clientStatus || 'unknown',
      })
    } catch (err) {
      console.error('Error fetching customer data:', err)
    }
  }, [selectedCustomerId])

  // Load customer data when selection changes
  useEffect(() => {
    void fetchCustomerData()
  }, [fetchCustomerData])

  // Handler for when status is updated (refresh customer data)
  const handleStatusUpdated = useCallback(() => {
    void fetchCustomerData()
  }, [fetchCustomerData])

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
        content: (
          <OnboardingOverview
            customerId={selectedCustomerId}
            customerName={customerData?.name}
            currentStatus={customerData?.clientStatus}
            onStatusUpdated={handleStatusUpdated}
          />
        ),
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
            onCustomerChange={handleCustomerChange} 
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
              handleCustomerChange(id)
              onNavigate?.('customer-onboarding')
            }} 
          />
        </Box>
      )}
    </Flex>
  )
}
