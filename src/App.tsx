import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Divider,
  Flex,
  Tab,
  TabList,
  Tabs,
  Text,
  Button,
} from '@chakra-ui/react'
import { useMsal } from '@azure/msal-react'
import { CRM_TOP_TABS, type CrmTopTabId } from './contracts/nav'
import DashboardsHomePage from './tabs/dashboards/DashboardsHomePage'
import CustomersHomePage, { type CustomersViewId } from './tabs/customers/CustomersHomePage'
import MarketingHomePage, { type MarketingViewId } from './tabs/marketing/MarketingHomePage'
import OnboardingHomePage from './tabs/onboarding/OnboardingHomePage'
import './App.css'
import { HeaderImagePicker } from './components/HeaderImagePicker'

function App() {
  const { instance } = useMsal()
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
      'email-templates': { tab: 'marketing-home' as const, view: 'templates' satisfies MarketingViewId },
      'cognism-prospects': { tab: 'marketing-home' as const, view: 'cognism-prospects' satisfies MarketingViewId },
      inbox: { tab: 'marketing-home' as const, view: 'inbox' satisfies MarketingViewId },
      reports: { tab: 'marketing-home' as const, view: 'reports' satisfies MarketingViewId },
      'email-accounts': { tab: 'marketing-home' as const, view: 'email-accounts' satisfies MarketingViewId },
      schedules: { tab: 'marketing-home' as const, view: 'schedules' satisfies MarketingViewId },
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

  const handleSignOut = async () => {
    await instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin })
  }

  const page = (() => {
    switch (activeTab) {
      case 'dashboards-home':
        return <DashboardsHomePage />
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
      case 'onboarding-home':
        return <OnboardingHomePage />
      default:
        return <DashboardsHomePage />
    }
  })()

  return (
    <Flex minH="100vh" bg="bg.canvas" direction="column" position="relative">
      {/* Main Content Area */}
      <Box
        flex="1"
        display="flex"
        flexDirection="column"
        minW={0}
        px={{ base: 3, md: 5, xl: 6 }}
        py={{ base: 3, md: 5, xl: 6 }}
      >
        <Box
          w="100%"
          flex="1"
          display="flex"
          flexDirection="column"
          gap={{ base: 3, md: 4 }}
          position="relative"
          zIndex={1}
        >
          {/* Top Bar */}
          <Box
            bg="bg.surface"
            borderRadius="lg"
            border="1px solid"
            borderColor="border.subtle"
            px={{ base: 3, md: 5 }}
            py={{ base: 2, md: 2 }}
            boxShadow="sm"
            position="sticky"
            top={0}
            zIndex={5}
          >
            <Tabs
              index={CRM_TOP_TABS.findIndex((tab) => tab.id === activeTab)}
              onChange={(nextIndex) => {
                const nextTab = CRM_TOP_TABS[nextIndex]
                if (!nextTab) return
                setActiveTab(nextTab.id)
                setActiveView('overview')
                setFocusAccountName(undefined)
              }}
              variant="unstyled"
              mt={{ base: 1, md: 2 }}
            >
              <TabList
                overflowX="auto"
                whiteSpace="nowrap"
                borderBottom="1px solid"
                borderColor="border.subtle"
                gap={2}
                pb={1}
                alignItems="center"
              >
                <Box
                  minW={{ base: '180px', md: '260px' }}
                  maxW={{ base: '240px', md: '320px' }}
                  mr={{ base: 1, md: 2 }}
                >
                  <HeaderImagePicker variant="logo" maxHeightPx={72} enableEdits={false} />
                </Box>
                {CRM_TOP_TABS.map((tab) => (
                  <Tab
                    key={tab.id}
                    px={3}
                    py={1}
                    fontSize="xs"
                    fontWeight="600"
                    color="text.muted"
                    border="1px solid"
                    borderColor="border.subtle"
                    borderRadius="md"
                    bg="white"
                    _hover={{ color: 'text.primary', bg: 'bg.subtle' }}
                    _selected={{
                      color: 'accent.700',
                      borderColor: 'accent.500',
                      bg: 'accent.50',
                    }}
                  >
                    {tab.label}
                  </Tab>
                ))}
                <Button
                  variant="outline"
                  size="xs"
                  px={3}
                  py={1}
                  fontSize="xs"
                  fontWeight="600"
                  color="text.muted"
                  borderColor="border.subtle"
                  _hover={{ color: 'text.primary', bg: 'bg.subtle' }}
                  onClick={() => void handleSignOut()}
                >
                  Sign out
                </Button>
              </TabList>
            </Tabs>
          </Box>

          {/* Main Content */}
          <Box
            bg="bg.surface"
            borderRadius="lg"
            border="1px solid"
            borderColor="border.subtle"
            p={{ base: 3, md: 5, lg: 6 }}
            boxShadow="md"
            w="100%"
            minW={0}
            overflowX="auto"
            flex="1"
          >
            {page}
          </Box>
          <Divider mt={6} opacity={0} />
        </Box>
      </Box>
      <Box px={{ base: 3, md: 5, xl: 6 }} pb={{ base: 3, md: 5 }}>
        <Text fontSize="xs" color="text.muted" textAlign="center">
          Build {__BUILD_STAMP__}
        </Text>
      </Box>
    </Flex>
  )
}

export default App
