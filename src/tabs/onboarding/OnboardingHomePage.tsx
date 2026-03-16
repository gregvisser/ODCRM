import { useMemo, useCallback, useEffect } from 'react'
import { Alert, AlertDescription, AlertIcon, AlertTitle, Badge, Box, Button, Flex, HStack, SimpleGrid, Text, VStack } from '@chakra-ui/react'
import { EditIcon, CheckCircleIcon } from '@chakra-ui/icons'
import { SubNavigation, type SubNavItem } from '../../design-system'
import { useLocale } from '../../contexts/LocaleContext'
import { isClientUI } from '../../platform/mode'
import CustomerSelector from './components/CustomerSelector'
import ProgressTrackerTab from './ProgressTrackerTab'
import CustomerOnboardingTab from './CustomerOnboardingTab'
import { onboardingDebug } from './utils/debug'
import { useClientReadinessState } from '../../hooks/useClientReadinessState'
import { getClientReadinessColorScheme } from '../../utils/clientReadinessState'
import { useScopedCustomerSelection } from '../../hooks/useCustomerScope'

export type OnboardingViewId = 'customer-onboarding' | 'progress-tracker'

function getNextStepButtonLabel(
  target: OnboardingViewId | 'onboarding' | 'clients' | 'marketing-readiness' | 'marketing-inbox' | 'marketing-reports' | 'marketing-sequences',
  t: (key: string) => string
): string {
  switch (target) {
    case 'clients':
      return t('onboarding.openClientDetails')
    case 'marketing-inbox':
      return t('onboarding.openInbox')
    case 'marketing-reports':
      return t('onboarding.openReports')
    case 'marketing-sequences':
      return t('onboarding.openSequences')
    case 'marketing-readiness':
      return t('onboarding.reviewMarketingReadiness')
    case 'customer-onboarding':
    case 'progress-tracker':
    case 'onboarding':
    default:
      return t('onboarding.continueOnboarding')
  }
}

function coerceViewId(view?: string): OnboardingViewId {
  if (view === 'progress-tracker' || view === 'customer-onboarding') return view
  // Legacy deep-link compatibility: old "overview" routes now land in the unified onboarding form.
  return 'customer-onboarding'
}

interface OnboardingHomePageProps {
  view?: string
  onNavigate?: (view: OnboardingViewId) => void
}

export default function OnboardingHomePage({ view, onNavigate }: OnboardingHomePageProps) {
  const activeView = coerceViewId(view)
  const { t } = useLocale()
  const { customerId: selectedCustomerId, setCustomerId: setSelectedCustomerId } = useScopedCustomerSelection()
  const { signal, interpretation: readiness } = useClientReadinessState(selectedCustomerId || null)

  useEffect(() => {
    onboardingDebug('🔄 OnboardingHomePage: Initial customerId from settingsStore:', selectedCustomerId)
  }, [selectedCustomerId])

  const handleCustomerChange = useCallback((customerId: string) => {
    onboardingDebug('🔄 OnboardingHomePage: Customer changed via selector:', customerId)
    setSelectedCustomerId(customerId)

    // UX: after selecting/creating a customer, keep user in the unified onboarding form.
    onNavigate?.('customer-onboarding')
  }, [onNavigate, setSelectedCustomerId])

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
    const items: SubNavItem[] = [
      {
        id: 'progress-tracker',
        label: t('onboarding.progressTracker'),
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
          label: t('onboarding.clientOnboarding'),
          icon: EditIcon,
          content: <CustomerOnboardingTab customerId={selectedCustomerId} />,
          sortOrder: 1,
        },
      )
    }

    return items
  }, [selectedCustomerId, t])

  const activationChecks = useMemo(() => {
    const mapCheck = (label: string, value: boolean | null) => ({
      label,
      complete: value === true,
      unknown: value === null,
    })
    return [
      mapCheck(t('onboarding.checkEmailIdentities'), signal.checks.emailIdentitiesConnected),
      mapCheck(t('onboarding.checkSuppressionList'), signal.checks.suppressionConfigured),
      mapCheck(t('onboarding.checkLeadSource'), signal.checks.leadSourceConfigured),
      mapCheck(t('onboarding.checkTemplateSequence'), signal.checks.templateAndSequenceReady),
    ]
  }, [signal.checks, t])

  const canProceedToOperations = readiness.state === 'ready-for-outreach' || readiness.state === 'outreach-active'
  const blockersCount = activationChecks.filter((item) => !item.complete).length
  const readyCheckCount = activationChecks.filter((item) => item.complete).length
  const effectiveActiveView: OnboardingViewId = selectedCustomerId ? activeView : 'progress-tracker'

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
            <Text fontSize="sm" fontWeight="semibold" color="blue.900">
              {t('onboarding.status')}
            </Text>
            <Text fontSize="sm" color="blue.800">
              {t('onboarding.statusDescription')}
            </Text>
          </VStack>
          <HStack mt={2} spacing={2}>
            <Badge colorScheme={getClientReadinessColorScheme(readiness.state)} data-testid="onboarding-client-readiness-state">
              {readiness.label}
            </Badge>
            <Text fontSize="sm" color="blue.900">{readiness.reason}</Text>
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
              {getNextStepButtonLabel(readiness.nextStep.target, t)}
            </Button>
            <Button
              size="sm"
              colorScheme="blue"
              onClick={handleContinueToMarketingReadiness}
              isDisabled={!selectedCustomerId}
              data-testid="onboarding-go-marketing-readiness"
            >
              {t('onboarding.reviewMarketingReadiness')}
            </Button>
            {!selectedCustomerId ? (
              <Text fontSize="xs" color="blue.700">
                {t('onboarding.selectClientFirst')}
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
                {t('onboarding.goLiveFollowUp')}
              </Text>
              <HStack spacing={2} flexWrap="wrap">
                <Badge colorScheme={canProceedToOperations ? 'green' : 'orange'} data-testid="onboarding-activation-state">
                  {canProceedToOperations ? t('onboarding.readyToMoveForward') : t('onboarding.followUpItemsLeft', { count: blockersCount })}
                </Badge>
                <Badge colorScheme="blue">
                  {t('onboarding.checksReady', { ready: readyCheckCount, total: activationChecks.length })}
                </Badge>
              </HStack>
              <Text fontSize="sm" color="blue.900">
                {t('onboarding.checksHelpConfirm')}
              </Text>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={1} width="100%">
                {activationChecks.map((item) => (
                  <HStack key={item.label} spacing={2}>
                    <Badge colorScheme={item.complete ? 'green' : item.unknown ? 'gray' : 'red'} minW="90px" textAlign="center">
                      {item.complete ? t('common.ready') : item.unknown ? t('common.pending') : t('common.missing')}
                    </Badge>
                    <Text fontSize="xs" color="blue.900">{item.label}</Text>
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
              <AlertTitle>{t('onboarding.selectClientToBegin')}</AlertTitle>
              <AlertDescription>
                {t('onboarding.selectClientDescription')}
              </AlertDescription>
            </Box>
          </Alert>
        ) : null}

        <SubNavigation
          key={`onboarding-${selectedCustomerId || 'no-customer'}`}
          items={navItems}
          activeId={effectiveActiveView}
          onChange={(id) => onNavigate?.(id as OnboardingViewId)}
          title={t('onboarding.title')}
          enableDragDrop={false}
        />
      </Box>
    </Flex>
  )
}
