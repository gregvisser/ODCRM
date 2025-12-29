import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Flex,
  Heading,
  Text,
  VStack,
  Divider,
} from '@chakra-ui/react'
import { CRM_TOP_TABS, getCrmTopTab, type CrmTopTabId } from './contracts/nav'
import { CrmTopTabs } from './components/nav/CrmTopTabs'
import { DataPortability } from './components/DataPortability'
import CustomersHomePage, { type CustomersViewId } from './tabs/customers/CustomersHomePage'
import SalesHomePage from './tabs/sales/SalesHomePage'
import MarketingHomePage, { type MarketingViewId } from './tabs/marketing/MarketingHomePage'
import OperationsHomePage, { type OperationsViewId } from './tabs/operations/OperationsHomePage'
import OnboardingHomePage from './tabs/onboarding/OnboardingHomePage'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState<CrmTopTabId>('customers-home')
  const [activeView, setActiveView] = useState<string>('overview')
  const [focusAccountName, setFocusAccountName] = useState<string | undefined>(undefined)

  const isCrmTopTabId = (id: string): id is CrmTopTabId => CRM_TOP_TABS.some((t) => t.id === id)

  const legacyTabMap = useMemo(() => {
    return {
      accounts: { tab: 'customers-home' as const, view: 'accounts' satisfies CustomersViewId },
      contacts: { tab: 'customers-home' as const, view: 'contacts' satisfies CustomersViewId },
      'marketing-leads': { tab: 'marketing-home' as const, view: 'leads' satisfies MarketingViewId },
      'email-campaigns': { tab: 'marketing-home' as const, view: 'campaigns' satisfies MarketingViewId },
      'user-authorization': { tab: 'operations-home' as const, view: 'user-authorization' satisfies OperationsViewId },
    } as const
  }, [])

  // Deep-linking: keep current tab/view in the URL (?tab=...&view=...&account=...).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab')
    const view = params.get('view')
    const account = params.get('account')

    if (account) setFocusAccountName(account)

    if (!tab) return
    if (isCrmTopTabId(tab)) {
      setActiveTab(tab)
      if (view) setActiveView(view)
      return
    }

    // Legacy: ?tab=accounts etc → map into top-tab + view.
    const legacy = legacyTabMap[tab as keyof typeof legacyTabMap]
    if (legacy) {
      setActiveTab(legacy.tab)
      setActiveView(legacy.view)
    }
    // Run once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('tab', activeTab)
    url.searchParams.set('view', activeView)
    if (focusAccountName) url.searchParams.set('account', focusAccountName)
    else url.searchParams.delete('account')

    window.history.replaceState({}, '', url)
  }, [activeTab, activeView, focusAccountName])

  // Cross-page navigation events (kept for backward compatibility with existing components).
  useEffect(() => {
    const handleNavigateToAccount = (event: Event) => {
      const customEvent = event as CustomEvent<{ accountName?: string }>
      const accountName = customEvent.detail?.accountName
      setActiveTab('customers-home')
      setActiveView('accounts')
      if (accountName) setFocusAccountName(accountName)
    }

    const handleNavigateToLeads = (event: Event) => {
      const customEvent = event as CustomEvent<{ accountName?: string }>
      const accountName = customEvent.detail?.accountName
      setActiveTab('marketing-home')
      setActiveView('leads')
      if (accountName) setFocusAccountName(accountName)
    }

    window.addEventListener('navigateToAccount', handleNavigateToAccount as EventListener)
    window.addEventListener('navigateToLeads', handleNavigateToLeads as EventListener)
    return () => {
      window.removeEventListener('navigateToAccount', handleNavigateToAccount as EventListener)
      window.removeEventListener('navigateToLeads', handleNavigateToLeads as EventListener)
    }
  }, [])

  const page = (() => {
    switch (activeTab) {
      case 'customers-home':
        return (
          <CustomersHomePage
            view={activeView}
            focusAccountName={focusAccountName}
            onNavigate={(v) => {
              setActiveView(v)
              // clear focus when leaving accounts
              if (v !== 'accounts') setFocusAccountName(undefined)
            }}
          />
        )
      case 'sales-home':
        return <SalesHomePage />
      case 'marketing-home':
        return (
          <MarketingHomePage
            view={activeView}
            focusAccountName={focusAccountName}
            onNavigate={(v) => {
              setActiveView(v)
              // focus isn't used yet in Marketing, but keep URL clean
              if (v !== 'leads') setFocusAccountName(undefined)
            }}
          />
        )
      case 'operations-home':
        return (
          <OperationsHomePage
            view={activeView}
            onNavigate={(v) => {
              setActiveView(v)
              setFocusAccountName(undefined)
            }}
          />
        )
      case 'onboarding-home':
        return <OnboardingHomePage />
      default:
        return <SalesHomePage />
    }
  })()

  return (
    <Flex minH="100vh" bg="brand.50" direction="column">
      <Box bg="white" borderBottom="1px solid" borderColor="brand.100" px={{ base: 4, md: 6 }} py={4}>
        <VStack align="stretch" spacing={3}>
          <Flex align="center" justify="space-between" gap={4} wrap="wrap">
            <Box>
              <Heading size="md" color="brand.800" fontWeight="bold" letterSpacing="wide">
                OpenDoors CRM
              </Heading>
              <Text fontSize="sm" color="brand.400">
                {getCrmTopTab(activeTab).ownerAgent}
              </Text>
            </Box>
            <Box>
              <DataPortability />
            </Box>
          </Flex>
          <CrmTopTabs
            activeTab={activeTab}
            onTabClick={(tabId) => {
              setActiveTab(tabId)
              setActiveView('overview')
              setFocusAccountName(undefined)
            }}
          />
        </VStack>
      </Box>

      <Box flex="1" p={{ base: 4, md: 6, lg: 10 }} overflowY="auto" w="100%" minW={0}>
        <Box mb={4}>
          <Heading size="lg" color="brand.800" mb={1} noOfLines={2}>
            {getCrmTopTab(activeTab).label}
          </Heading>
          <Text color="brand.500" fontSize={{ base: 'sm', md: 'md' }}>
            {activeView !== 'overview' ? `View: ${activeView}` : 'Coming soon.'}
          </Text>
        </Box>

        <Box
          bg="white"
          borderRadius="2xl"
          border="1px solid"
          borderColor="brand.100"
          p={{ base: 4, md: 6 }}
          boxShadow="sm"
          w="100%"
          minW={0}
          overflowX="auto"
        >
          {page}
        </Box>
        <Divider mt={8} opacity={0} />
      </Box>
    </Flex>
  )
}

export default App
