/**
 * MarketingHomePage - OpenDoors Email Outreach System
 * Complete implementation based on Reply.io architecture exploration
 */

import React, { useMemo } from 'react'
import { Badge, Box, Button, HStack, Text } from '@chakra-ui/react'
import {
  CheckCircleIcon,
  RepeatIcon,
  ViewIcon,
  ChatIcon,
  SearchIcon,
  CopyIcon,
  SettingsIcon,
  WarningIcon,
  CalendarIcon,
} from '@chakra-ui/icons'
import { SubNavigation, type SubNavItem } from '../../design-system'
import { useLocale } from '../../contexts/LocaleContext'
import { useUserPreferencesContext } from '../../contexts/UserPreferencesContext'
import SequencesTab from './components/SequencesTab'
import LeadSourcesTabNew from './components/LeadSourcesTabNew'
import EmailAccountsTab from './components/EmailAccountsTab'
import TemplatesTab from './components/TemplatesTab'
import ReportsTab from './components/ReportsTab'
import InboxTab from './components/InboxTab'
import ComplianceTab from './components/ComplianceTab'
import SchedulesTab from './components/SchedulesTab'
import ReadinessTab from './components/ReadinessTab'
import { useEffectiveCustomerId } from '../../hooks/useCustomerScope'
import { useClientReadinessState } from '../../hooks/useClientReadinessState'
import { getClientReadinessColorScheme } from '../../utils/clientReadinessState'

// 'overview' and 'people' removed from the UI (2026-02-22).
// Kept in the type union for backward compatibility so that deep-link URLs like
// ?view=overview or ?view=people are safely coerced to 'email-accounts' below.
export type OpenDoorsViewId =
  | 'overview'
  | 'sequences'
  | 'people'
  | 'lists'
  | 'email-accounts'
  | 'templates'
  | 'compliance'
  | 'reports'
  | 'inbox'
  | 'schedules'
  | 'readiness'

export type MarketingViewId = OpenDoorsViewId

function coerceViewId(view?: string): OpenDoorsViewId {
  // Legacy deep-link fallback: 'overview' and 'people' no longer have UI tabs.
  // Redirect to 'email-accounts' so old bookmarks / URLs land on a real tab.
  if (view === 'overview' || view === 'people') return 'email-accounts'
  if (
    view === 'sequences' ||
    view === 'lists' ||
    view === 'email-accounts' ||
    view === 'templates' ||
    view === 'compliance' ||
    view === 'schedules' ||
    view === 'readiness' ||
    view === 'reports' ||
    view === 'inbox'
  )
    return view
  // Default for unknown / missing views
  return 'email-accounts'
}

const MARKETING_SECTION_KEY = 'marketing'

export default function MarketingHomePage({
  view,
  onNavigate,
  focusAccountName,
}: {
  view?: string
  onNavigate?: (view: OpenDoorsViewId) => void
  focusAccountName?: string
}) {
  const activeView = coerceViewId(view)
  const { t } = useLocale()
  const { getTabOrder, saveTabOrder, loading: prefsLoading } = useUserPreferencesContext()
  const customerId = useEffectiveCustomerId()
  const { interpretation: readiness } = useClientReadinessState(customerId)

  const runReadinessNextStep = () => {
    switch (readiness.nextStep.target) {
      case 'onboarding':
        window.dispatchEvent(new CustomEvent('navigateToOnboarding'))
        break
      case 'clients':
        window.dispatchEvent(new CustomEvent('navigateToAccount'))
        break
      case 'marketing-inbox':
        onNavigate?.('inbox')
        break
      case 'marketing-reports':
        onNavigate?.('reports')
        break
      case 'marketing-sequences':
        onNavigate?.('sequences')
        break
      case 'marketing-readiness':
      default:
        onNavigate?.('readiness')
        break
    }
  }

  const goToOnboarding = () => {
    window.dispatchEvent(new CustomEvent('navigateToOnboarding'))
  }

  const goToClients = () => {
    window.dispatchEvent(new CustomEvent('navigateToAccount'))
  }

  // Default navigation items — Overview and People tabs removed (2026-02-22).
  // Old ?view=overview and ?view=people URLs are handled by coerceViewId above.
  const defaultNavItems: SubNavItem[] = useMemo(() => [
    {
      id: 'readiness',
      label: t('marketing.readiness'),
      icon: CheckCircleIcon,
      content: <ReadinessTab />,
      sortOrder: 0,
    },
    {
      id: 'reports',
      label: t('marketing.reports'),
      icon: SearchIcon,
      content: <ReportsTab />,
      sortOrder: 1,
    },
    {
      id: 'lists',
      label: t('marketing.leadSources'),
      icon: ViewIcon,
      content: <LeadSourcesTabNew onNavigateToSequences={onNavigate ? () => onNavigate('sequences') : undefined} />,
      sortOrder: 2,
    },
    {
      id: 'compliance',
      label: t('marketing.suppressionList'),
      icon: WarningIcon,
      content: <ComplianceTab />,
      sortOrder: 3,
    },
    {
      id: 'email-accounts',
      label: t('marketing.emailAccounts'),
      icon: SettingsIcon,
      content: <EmailAccountsTab />,
      sortOrder: 4,
    },
    {
      id: 'templates',
      label: t('marketing.templates'),
      icon: CopyIcon,
      content: <TemplatesTab />,
      sortOrder: 5,
    },
    {
      id: 'sequences',
      label: t('marketing.sequences'),
      icon: RepeatIcon,
      content: <SequencesTab />,
      sortOrder: 6,
    },
    {
      id: 'schedules',
      label: t('marketing.schedules'),
      icon: CalendarIcon,
      content: <SchedulesTab />,
      sortOrder: 7,
    },
    {
      id: 'inbox',
      label: t('marketing.inbox'),
      icon: ChatIcon,
      content: <InboxTab />,
      sortOrder: 8,
    },
  ], [onNavigate, t])

  // Apply saved tab order from database (per-user)
  const navItems = useMemo(() => {
    const savedOrder = getTabOrder(MARKETING_SECTION_KEY)
    if (!savedOrder || savedOrder.length === 0) {
      return defaultNavItems
    }

    // Reorder items based on saved preference
    const orderedItems: SubNavItem[] = []
    const itemsById = new Map(defaultNavItems.map(item => [item.id, item]))

    // Add items in saved order
    for (const id of savedOrder) {
      const item = itemsById.get(id)
      if (item) {
        orderedItems.push(item)
        itemsById.delete(id)
      }
    }

    // Add any new items that weren't in saved order (at the end)
    orderedItems.push(...Array.from(itemsById.values()))

    return orderedItems
  }, [getTabOrder, defaultNavItems])

  // Save navigation order when it changes (to database, per-user)
  const handleNavReorder = async (reorderedItems: SubNavItem[]) => {
    const tabIds = reorderedItems.map(item => item.id)
    await saveTabOrder(MARKETING_SECTION_KEY, tabIds)
  }

  return (
    <div data-testid="marketing-home-panel">
      <Box mb={3} data-testid="marketing-home-operator-guidance">
        <HStack spacing={2} mb={1}>
          <Badge colorScheme={getClientReadinessColorScheme(readiness.state)} data-testid="marketing-client-readiness-state">
            {readiness.label}
          </Badge>
          <Text fontSize="sm" color="gray.600">{readiness.reason}</Text>
        </HStack>
        <Text fontSize="sm" color="gray.600">
          {t('marketing.guidanceStart')}
        </Text>
        <Text fontSize="xs" color="gray.500" mt={1} data-testid="marketing-module-continuity-guidance">
          {t('marketing.guidanceBlockers')}
        </Text>
        <HStack mt={2} flexWrap="wrap">
          <Button size="xs" variant="outline" colorScheme="teal" onClick={runReadinessNextStep} data-testid="marketing-readiness-next-step">
            {readiness.nextStep.label}
          </Button>
          <Button size="xs" variant="ghost" colorScheme="purple" onClick={goToOnboarding} data-testid="marketing-go-onboarding-setup">
            {t('marketing.openOnboardingSetup')}
          </Button>
          <Button size="xs" variant="ghost" colorScheme="gray" onClick={goToClients} data-testid="marketing-go-clients-data-health">
            {t('marketing.openClientsDataHealth')}
          </Button>
        </HStack>
      </Box>
      <SubNavigation
        items={navItems}
        activeId={activeView}
        title={t('marketing.sectionTitle')}
        onChange={(id) => onNavigate?.(id as OpenDoorsViewId)}
        onReorder={handleNavReorder}
        enableDragDrop={true}
      />
    </div>
  )
}
