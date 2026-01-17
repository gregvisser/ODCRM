import { useEffect, useMemo, useState } from 'react'
import { Box, Divider, Flex, VStack, IconButton, useColorMode } from '@chakra-ui/react'
import { MoonIcon, SunIcon } from '@chakra-ui/icons'
import { CRM_TOP_TABS, type CrmTopTabId } from './contracts/nav'
import { CrmTopTabs } from './components/nav/CrmTopTabs'
import { DataPortability } from './components/DataPortability'
import { HeaderImagePicker } from './components/HeaderImagePicker'
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
  const [uxToolsEnabled, setUxToolsEnabled] = useState<boolean>(false)
  const { colorMode, toggleColorMode } = useColorMode()

  const isCrmTopTabId = (id: string): id is CrmTopTabId => CRM_TOP_TABS.some((t) => t.id === id)

  const legacyTabMap = useMemo(() => {
    return {
      accounts: { tab: 'customers-home' as const, view: 'accounts' satisfies CustomersViewId },
      contacts: { tab: 'customers-home' as const, view: 'contacts' satisfies CustomersViewId },
      'marketing-leads': { tab: 'marketing-home' as const, view: 'leads' satisfies MarketingViewId },
      'email-campaigns': { tab: 'marketing-home' as const, view: 'campaigns' satisfies MarketingViewId },
      'email-templates': { tab: 'marketing-home' as const, view: 'templates' satisfies MarketingViewId },
      'cognism-prospects': { tab: 'marketing-home' as const, view: 'cognism-prospects' satisfies MarketingViewId },
      inbox: { tab: 'marketing-home' as const, view: 'inbox' satisfies MarketingViewId },
      reports: { tab: 'marketing-home' as const, view: 'reports' satisfies MarketingViewId },
      'email-accounts': { tab: 'marketing-home' as const, view: 'email-accounts' satisfies MarketingViewId },
      schedules: { tab: 'marketing-home' as const, view: 'schedules' satisfies MarketingViewId },
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

  // UX tools toggle (owner-only-ish): Ctrl+Shift+U to show/hide power tools in the header.
  useEffect(() => {
    try {
      const stored = localStorage.getItem('odcrm_ux_tools_enabled')
      if (stored === 'true') setUxToolsEnabled(true)
    } catch {
      // ignore
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'U' || e.key === 'u')) {
        e.preventDefault()
        setUxToolsEnabled((prev) => {
          const next = !prev
          try {
            localStorage.setItem('odcrm_ux_tools_enabled', String(next))
          } catch {
            // ignore
          }
          return next
        })
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
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
    <Flex
      minH="100vh"
      bg="mist.50"
      direction="row"
      position="relative"
      overflow="hidden"
    >
      {/* Left Sidebar Navigation */}
      <Box
        w={{ base: '60px', md: '240px' }}
        minW={{ base: '60px', md: '240px' }}
        bg="bg.surface"
        borderRight="1px solid"
        borderColor="border.subtle"
        p={{ base: 2, md: 4 }}
        display="flex"
        flexDirection="column"
        gap={4}
        position="sticky"
        top={0}
        h="100vh"
        overflowY="auto"
        zIndex={10}
      >
        {/* Logo - only show on larger screens */}
        <Box display={{ base: 'none', md: 'block' }} mb={4}>
          <VStack spacing={2} align="flex-start" w="100%">
            <HeaderImagePicker 
              variant="logo" 
              maxHeightPx={120} 
              lockEdits={false}
              storageKey="odcrm_sidebar_logo_data_url"
            />
          </VStack>
        </Box>

        {/* Navigation Tabs */}
        <Box flex={1}>
          <CrmTopTabs
            activeTab={activeTab}
            onTabClick={(tabId) => {
              setActiveTab(tabId)
              setActiveView('overview')
              setFocusAccountName(undefined)
            }}
          />
        </Box>

        {/* Dark mode toggle at bottom */}
        <Box>
          <IconButton
            aria-label="Toggle color mode"
            icon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
            onClick={toggleColorMode}
            variant="ghost"
            colorScheme="gray"
            size="md"
            w="100%"
          />
          {uxToolsEnabled ? <Box mt={2}><DataPortability /></Box> : null}
        </Box>
      </Box>

      {/* Main Content Area */}
      <Box
        flex="1"
        display="flex"
        flexDirection="column"
        minW={0}
        px={{ base: 3, md: 6 }}
        py={{ base: 4, md: 8 }}
      >
        <Box
          w="100%"
          maxW="1440px"
          mx="auto"
          flex="1"
          display="flex"
          flexDirection="column"
          gap={{ base: 4, md: 6 }}
          position="relative"
          zIndex={1}
        >
          {/* Main Content */}
          <Box
            bg="bg.surface"
            borderRadius="3xl"
            border="1px solid"
            borderColor="border.subtle"
            p={{ base: 4, md: 6, lg: 8 }}
            boxShadow="2xl"
            w="100%"
            minW={0}
            overflowX="auto"
            flex="1"
          >
            {page}
          </Box>
          <Divider mt={8} opacity={0} />
        </Box>
      </Box>
    </Flex>
  )
}

export default App
