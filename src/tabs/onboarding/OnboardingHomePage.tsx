import { useState, useMemo, useCallback, useEffect } from 'react'
import { Badge, Box, Button, Flex, HStack, SimpleGrid, Text, VStack } from '@chakra-ui/react'
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
  const { signal, interpretation: readiness } = useClientReadinessState(selectedCustomerId || null)

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

  const activationChecks = useMemo(() => {
    const mapCheck = (label: string, value: boolean | null) => ({
      label,
      complete: value === true,
      unknown: value === null,
    })
    return [
      mapCheck('Email identities connected', signal.checks.emailIdentitiesConnected),
      mapCheck('Suppression source configured', signal.checks.suppressionConfigured),
      mapCheck('Lead source configured (transitional sheet-linked)', signal.checks.leadSourceConfigured),
      mapCheck('Template and sequence basics ready', signal.checks.templateAndSequenceReady),
    ]
  }, [signal.checks])

  const canProceedToOperations = readiness.state === 'ready-for-outreach' || readiness.state === 'outreach-active'
  const blockersCount = activationChecks.filter((item) => !item.complete).length

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
            Onboarding is for setup progression and activation checkpoints before daily outreach operations.
          </Text>
          <Text mt={1} fontSize="sm" color="blue.900" data-testid="onboarding-activation-framing">
            Complete core onboarding checkpoints here, then continue into Marketing once this client is ready enough to operate.
          </Text>
          <HStack mt={2} spacing={2}>
            <Badge colorScheme={getClientReadinessColorScheme(readiness.state)} data-testid="onboarding-client-readiness-state">
              {readiness.label}
            </Badge>
            <Text fontSize="sm" color="blue.900">{readiness.reason}</Text>
          </HStack>
          <Text fontSize="sm" color="blue.900" mt={1} data-testid="onboarding-readiness-guidance">
            After setup tasks are complete for this client, continue in Marketing Readiness for daily outreach operations.
          </Text>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={2} mt={3} data-testid="onboarding-checkpoint-guidance">
            <VStack
              align="start"
              spacing={0}
              p={2}
              borderRadius="md"
              border="1px solid"
              borderColor="blue.200"
              bg="white"
              data-testid="onboarding-clients-vs-onboarding-guidance"
            >
              <Text fontSize="xs" fontWeight="bold" textTransform="uppercase" color="blue.700">Fix in OpenDoors Clients</Text>
              <Text fontSize="sm" color="blue.900">
                Account/company details, contact quality, and upstream data gaps that affect outreach readiness.
              </Text>
            </VStack>
            <VStack
              align="start"
              spacing={0}
              p={2}
              borderRadius="md"
              border="1px solid"
              borderColor="blue.200"
              bg="white"
            >
              <Text fontSize="xs" fontWeight="bold" textTransform="uppercase" color="blue.700">Complete in Onboarding</Text>
              <Text fontSize="sm" color="blue.900">
                Activation checklist steps, ownership sign-offs, and setup progress tracking before operations.
              </Text>
            </VStack>
          </SimpleGrid>
          <VStack
            align="start"
            spacing={1}
            mt={3}
            p={2}
            borderRadius="md"
            border="1px solid"
            borderColor="blue.200"
            bg="white"
            data-testid="onboarding-blocker-vs-proceed"
          >
            <Text fontSize="xs" fontWeight="bold" textTransform="uppercase" color="blue.700">Activation checkpoint status</Text>
            <HStack spacing={2} flexWrap="wrap">
              <Badge colorScheme={canProceedToOperations ? 'green' : 'orange'} data-testid="onboarding-activation-state">
                {canProceedToOperations ? 'Done enough to proceed' : `${blockersCount} checkpoint(s) still blocking`}
              </Badge>
              <Text fontSize="xs" color="blue.800">
                {canProceedToOperations
                  ? 'Setup is sufficient for operations handoff. Continue in Marketing Readiness.'
                  : 'Complete missing checkpoints first, then proceed to Marketing Readiness.'}
              </Text>
            </HStack>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={1} width="100%">
              {activationChecks.map((item) => (
                <HStack key={item.label} spacing={2}>
                  <Badge colorScheme={item.complete ? 'green' : item.unknown ? 'gray' : 'red'} minW="90px" textAlign="center">
                    {item.complete ? 'Ready' : item.unknown ? 'Pending' : 'Missing'}
                  </Badge>
                  <Text fontSize="xs" color="blue.900">{item.label}</Text>
                </HStack>
              ))}
            </SimpleGrid>
          </VStack>
          <Text fontSize="xs" color="blue.800" mt={2} data-testid="onboarding-transitional-leads-note">
            Lead-source readiness may include linked Google Sheets during transition, so this view reflects integrated signals rather than ODCRM-only lead ownership.
          </Text>
          <Text fontSize="xs" color="blue.800" mt={2} data-testid="onboarding-operations-handoff">
            When this client is done enough to proceed, move to Marketing Readiness for send planning, sequencing, inbox handling, and reporting.
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
