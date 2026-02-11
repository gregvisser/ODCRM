import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Flex,
  Tab,
  TabList,
  Tabs,
  Text,
  Button,
  Badge,
} from '@chakra-ui/react'
import { useMsal } from '@azure/msal-react'
import { CRM_TOP_TABS, type CrmTopTabId } from './contracts/nav'
import DashboardsHomePage from './tabs/dashboards/DashboardsHomePage'
import CustomersHomePage, { type CustomersViewId } from './tabs/customers/CustomersHomePage'
import MarketingHomePage, { type OpenDoorsViewId } from './tabs/marketing/MarketingHomePage'
import OnboardingHomePage, { type OnboardingViewId } from './tabs/onboarding/OnboardingHomePage'
import SettingsHomePage from './tabs/settings/SettingsHomePage'
import './App.css'
import { HeaderImagePicker } from './components/HeaderImagePicker'
// import { DiagnosticBanner } from './components/DiagnosticBanner' // REMOVED per user request
import { spacing, semanticColor, radius, shadow, zIndex } from './design-system'

const POST_LOGIN_REDIRECT_KEY = 'odcrm_post_login_redirect_v1'

function isSafeInternalRedirect(value: string): boolean {
  const v = value.trim()
  if (!v.startsWith('/')) return false
  if (v.startsWith('//')) return false
  if (v.includes('://')) return false
  if (v.includes('\\')) return false
  return true
}

function App() {
  const { instance } = useMsal()
  // Production requirement: first authenticated landing is ALWAYS Dashboard unless a safe deep link overrides it.
  const [activeTab, setActiveTab] = useState<CrmTopTabId>('dashboards-home')
  const [activeView, setActiveView] = useState<string>('accounts')
  const [focusAccountName, setFocusAccountName] = useState<string | undefined>(undefined)
  const isCrmTopTabId = (id: string): id is CrmTopTabId => CRM_TOP_TABS.some((t) => t.id === id)

  const legacyTabMap = useMemo(() => {
    return {
      accounts: { tab: 'customers-home' as const, view: 'accounts' satisfies CustomersViewId },
      contacts: { tab: 'customers-home' as const, view: 'contacts' satisfies CustomersViewId },
      inbox: { tab: 'marketing-home' as const, view: 'inbox' satisfies OpenDoorsViewId },
      reports: { tab: 'marketing-home' as const, view: 'reports' satisfies OpenDoorsViewId },
      'email-accounts': { tab: 'marketing-home' as const, view: 'email-accounts' satisfies OpenDoorsViewId },
      schedules: { tab: 'marketing-home' as const, view: 'schedules' satisfies OpenDoorsViewId },
    } as const
  }, [])

  // Deep-linking: keep current tab/view in the URL (?tab=...&view=...&account=...).
  useEffect(() => {
    // If user logged in from a deep link, MSAL returns to the configured redirectUri (root).
    // Restore the intended destination from sessionStorage (internal-only).
    let sourceUrl = new URL(window.location.href)
    try {
      const stored = sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY)
      if (stored && isSafeInternalRedirect(stored)) {
        sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY)
        sourceUrl = new URL(stored, window.location.origin)
      }
    } catch {
      // ignore
    }

    const params = sourceUrl.searchParams
    const tab = params.get('tab')
    const view = params.get('view')
    const account = params.get('account')

    if (account) setFocusAccountName(account)

    // Path-based deep link (preferred for production-safe routing)
    const fromPath = CRM_TOP_TABS.find((t) => t.path === sourceUrl.pathname)?.id

    if (!tab) {
      if (fromPath) {
        setActiveTab(fromPath)
        if (view) setActiveView(view)
        return
      }
      // Root or unknown path: default authenticated landing is Dashboard.
      setActiveTab('dashboards-home')
      return
    }
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
    // Keep pathname aligned with tab path (navigation fallback supports all paths).
    const tabPath = CRM_TOP_TABS.find((t) => t.id === activeTab)?.path
    if (tabPath) url.pathname = tabPath

    // Clean MSAL redirect params once we're in the app (prevents odd refresh behavior).
    url.searchParams.delete('code')
    url.searchParams.delete('state')
    url.searchParams.delete('client_info')
    url.searchParams.delete('session_state')

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

    const handleNavigateToOnboarding = () => {
      setActiveTab('onboarding-home')
      setActiveView('customer-onboarding')
    }

    window.addEventListener('navigateToAccount', handleNavigateToAccount as EventListener)
    window.addEventListener('navigateToLeads', handleNavigateToLeads as EventListener)
    window.addEventListener('navigateToOnboarding', handleNavigateToOnboarding as EventListener)
    return () => {
      window.removeEventListener('navigateToAccount', handleNavigateToAccount as EventListener)
      window.removeEventListener('navigateToLeads', handleNavigateToLeads as EventListener)
      window.removeEventListener('navigateToOnboarding', handleNavigateToOnboarding as EventListener)
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
        return (
          <OnboardingHomePage
            view={activeView}
            onNavigate={(v) => {
              setActiveView(v)
            }}
          />
        )
      case 'settings-home':
        return (
          <SettingsHomePage
            view={activeView}
            onNavigate={(v) => {
              setActiveView(v)
            }}
          />
        )
      default:
        return <DashboardsHomePage />
    }
  })()

  return (
    <Flex minH="100vh" bg={semanticColor.bgCanvas} direction="column" position="relative">
      {/* Main Content Area */}
      <Box
        flex="1"
        display="flex"
        flexDirection="column"
        minW={0}
        px={{ base: spacing[3], md: spacing[4], lg: spacing[6] }}
        py={{ base: spacing[3], md: spacing[4], lg: spacing[6] }}
      >
        <Box
          w="100%"
          maxW="1600px"
          mx="auto"
          flex="1"
          display="flex"
          flexDirection="column"
          gap={{ base: spacing[3], md: spacing[4] }}
          position="relative"
          zIndex={zIndex.base}
        >
          {/* Top Bar */}
          <Box
            bg={semanticColor.bgSurface}
            borderRadius={radius.lg}
            border="1px solid"
            borderColor={semanticColor.borderSubtle}
            px={{ base: spacing[3], md: spacing[4] }}
            py={{ base: spacing[2], md: spacing[2] }}
            boxShadow={shadow.sm}
            position="sticky"
            top={0}
            zIndex={zIndex.sticky}
          >
            <Tabs
              index={CRM_TOP_TABS.findIndex((tab) => tab.id === activeTab)}
              onChange={(nextIndex) => {
                const nextTab = CRM_TOP_TABS[nextIndex]
                if (!nextTab) return
                setActiveTab(nextTab.id)
                setActiveView('accounts')
                setFocusAccountName(undefined)
              }}
              variant="unstyled"
              mt={{ base: spacing[1], md: spacing[2] }}
            >
              <TabList
                overflowX="auto"
                whiteSpace="nowrap"
                borderBottom="1px solid"
                borderColor={semanticColor.borderSubtle}
                gap={spacing[2]}
                pb={spacing[1]}
                alignItems="center"
              >
                <Box
                  minW={{ base: '180px', md: '260px' }}
                  maxW={{ base: '240px', md: '320px' }}
                  mr={{ base: spacing[1], md: spacing[2] }}
                >
                  <HeaderImagePicker variant="logo" maxHeightPx={72} enableEdits={false} />
                </Box>
                {CRM_TOP_TABS.map((tab) => (
                  <Tab
                    key={tab.id}
                    px={spacing[3]}
                    py={spacing[1]}
                    fontSize="xs"
                    fontWeight="600"
                    color={semanticColor.textMuted}
                    border="1px solid"
                    borderColor={semanticColor.borderSubtle}
                    borderRadius={radius.md}
                    bg={semanticColor.bgSurface}
                    _hover={{ color: semanticColor.textPrimary, bg: semanticColor.bgSubtle }}
                    _selected={{
                      color: 'accent.700',
                      borderColor: 'accent.500',
                      bg: 'accent.50',
                    }}
                  >
                    {tab.label}
                  </Tab>
                ))}
                {/* Environment indicator */}
                <Badge
                  colorScheme={import.meta.env.PROD ? 'red' : 'yellow'}
                  fontSize="xs"
                  px={2}
                  py={1}
                  borderRadius={radius.md}
                  textTransform="uppercase"
                  fontWeight="bold"
                >
                  {import.meta.env.PROD ? 'PRODUCTION' : 'DEV'}
                </Badge>
                <Button
                  variant="outline"
                  size="xs"
                  px={spacing[3]}
                  py={spacing[1]}
                  fontSize="xs"
                  fontWeight="600"
                  color={semanticColor.textMuted}
                  borderColor={semanticColor.borderSubtle}
                  _hover={{ color: semanticColor.textPrimary, bg: semanticColor.bgSubtle }}
                  onClick={() => void handleSignOut()}
                >
                  Sign out
                </Button>
              </TabList>
            </Tabs>
          </Box>

          {/* Main Content */}
          <Box
            bg={semanticColor.bgSurface}
            borderRadius={radius.lg}
            border="1px solid"
            borderColor={semanticColor.borderSubtle}
            p={{ base: spacing[3], md: spacing[4], lg: spacing[6] }}
            boxShadow={shadow.md}
            w="100%"
            minW={0}
            overflowX="auto"
            flex="1"
          >
            {page}
          </Box>
        </Box>
      </Box>
      <Box px={{ base: spacing[3], md: spacing[4], lg: spacing[6] }} pb={{ base: spacing[3], md: spacing[4] }}>
        <Text fontSize="xs" color={semanticColor.textMuted} textAlign="center">
          Build {__BUILD_STAMP__}
        </Text>
      </Box>
    </Flex>
  )
}

export default App