import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Flex,
  HStack,
  Tab,
  TabList,
  Tabs,
  Text,
  Button,
  Badge,
  Switch,
} from '@chakra-ui/react'
import { useMsal } from '@azure/msal-react'
import { CRM_TOP_TABS, type CrmTopTabId } from './contracts/nav'
import { getVisibleCrmTopTabs, resolveClientModeTab } from './utils/crmTopTabsVisibility'
import { isClientUI } from './platform/mode'
import { getMe, type MeResponse } from './platform/me'
import { clearApiAuthToken } from './auth/apiAuthToken'
import { useLocale } from './contexts/LocaleContext'
import CustomersHomePage, { type CustomersViewId } from './tabs/customers/CustomersHomePage'
import MarketingHomePage, { type OpenDoorsViewId } from './tabs/marketing/MarketingHomePage'
import ReportingHomePage, { type ReportingViewId } from './tabs/reporting/ReportingHomePage'
import OnboardingHomePage, { type OnboardingViewId } from './tabs/onboarding/OnboardingHomePage'
import SettingsHomePage from './tabs/settings/SettingsHomePage'
import './App.css'
import { HeaderImagePicker } from './components/HeaderImagePicker'
// import { DiagnosticBanner } from './components/DiagnosticBanner' // REMOVED per user request
import { spacing, semanticColor, radius, shadow, zIndex } from './design-system'
import { BUILD_SHA, BUILD_TIME } from './version'

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
  const { t, locale, setLocale } = useLocale()
  const [activeTab, setActiveTab] = useState<CrmTopTabId>('customers-home')
  const [activeView, setActiveView] = useState<string>('accounts')
  const [focusAccountName, setFocusAccountName] = useState<string | undefined>(undefined)
  const isCrmTopTabId = (id: string): id is CrmTopTabId => CRM_TOP_TABS.some((t) => t.id === id)

  // Client UI: block app until /api/me returns client mode with fixedCustomerId
  const [me, setMe] = useState<MeResponse | null>(null)
  const [meError, setMeError] = useState<string | null>(null)
  useEffect(() => {
    if (!isClientUI()) return
    getMe()
      .then(setMe)
      .catch((err) => setMeError(err?.message ?? 'Failed to load client configuration'))
  }, [])

  // Client mode: hide Clients tab from nav; use first visible tab for content when Clients would be selected.
  const visibleTopTabs = getVisibleCrmTopTabs()
  const effectiveTab: CrmTopTabId = resolveClientModeTab(activeTab)
  const tabIndex = Math.max(
    0,
    visibleTopTabs.findIndex((t) => t.id === effectiveTab),
  )

  const legacyTabMap = useMemo(() => {
    return {
      accounts: { tab: 'customers-home' as const, view: 'accounts' satisfies CustomersViewId },
      contacts: { tab: 'customers-home' as const, view: 'contacts' satisfies CustomersViewId },
      inbox: { tab: 'marketing-home' as const, view: 'inbox' satisfies OpenDoorsViewId },
      reports: { tab: 'marketing-home' as const, view: 'reports' satisfies OpenDoorsViewId },
      reporting: { tab: 'reporting-home' as const, view: 'reporting-dashboard' satisfies ReportingViewId },
      dashboard: { tab: 'reporting-home' as const, view: 'reporting-dashboard' satisfies ReportingViewId },
      'email-accounts': { tab: 'marketing-home' as const, view: 'email-accounts' satisfies OpenDoorsViewId },
      schedules: { tab: 'marketing-home' as const, view: 'schedules' satisfies OpenDoorsViewId },
    } as const
  }, [])

  const getDefaultViewForTab = (tab: CrmTopTabId): string => {
    if (tab === 'reporting-home') return 'reporting-dashboard'
    return 'accounts'
  }

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
        setActiveTab(resolveClientModeTab(fromPath))
        if (view) setActiveView(view)
        else setActiveView(getDefaultViewForTab(fromPath))
        return
      }
      // Root or unknown path: default authenticated landing is Clients.
      setActiveTab(resolveClientModeTab('customers-home'))
      return
    }
    if (isCrmTopTabId(tab)) {
      setActiveTab(resolveClientModeTab(tab))
      if (view) setActiveView(view)
      else setActiveView(getDefaultViewForTab(tab))
      return
    }

    // Legacy: ?tab=accounts etc → map into top-tab + view.
    const legacy = legacyTabMap[tab as keyof typeof legacyTabMap]
    if (legacy) {
      setActiveTab(resolveClientModeTab(legacy.tab))
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

    const handleNavigateToMarketing = (event: Event) => {
      const customEvent = event as CustomEvent<{ view?: OpenDoorsViewId }>
      const requestedView = customEvent.detail?.view
      const supportedViews: OpenDoorsViewId[] = [
        'readiness',
        'sequences',
        'inbox',
        'reports',
        'email-accounts',
        'templates',
        'compliance',
        'schedules',
        'lists',
      ]
      const nextView = requestedView && supportedViews.includes(requestedView) ? requestedView : 'readiness'
      setActiveTab('marketing-home')
      setActiveView(nextView)
      setFocusAccountName(undefined)
    }

    window.addEventListener('navigateToAccount', handleNavigateToAccount as EventListener)
    window.addEventListener('navigateToLeads', handleNavigateToLeads as EventListener)
    window.addEventListener('navigateToOnboarding', handleNavigateToOnboarding as EventListener)
    window.addEventListener('navigateToMarketing', handleNavigateToMarketing as EventListener)
    return () => {
      window.removeEventListener('navigateToAccount', handleNavigateToAccount as EventListener)
      window.removeEventListener('navigateToLeads', handleNavigateToLeads as EventListener)
      window.removeEventListener('navigateToOnboarding', handleNavigateToOnboarding as EventListener)
      window.removeEventListener('navigateToMarketing', handleNavigateToMarketing as EventListener)
    }
  }, [])

  const handleSignOut = async () => {
    clearApiAuthToken()
    await instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin })
  }

  const page = (() => {
    switch (effectiveTab) {
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
      case 'reporting-home':
        return <ReportingHomePage view={activeView} />
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
        return (
          <CustomersHomePage
            view={activeView}
            focusAccountName={focusAccountName}
            onNavigate={(v) => {
              setActiveView(v)
              if (v !== 'accounts') setFocusAccountName(undefined)
            }}
          />
        )
    }
  })()

  // Client UI: block until /api/me says client mode with fixedCustomerId
  if (isClientUI()) {
    if (meError) {
      return (
        <Flex minH="100vh" bg={semanticColor.bgCanvas} align="center" justify="center" p={6}>
          <Text color="red.600">{meError}</Text>
        </Flex>
      )
    }
    if (!me) {
      return (
        <Flex minH="100vh" bg={semanticColor.bgCanvas} align="center" justify="center" p={6}>
          <Text>{t('shell.loading')}</Text>
        </Flex>
      )
    }
    if (me.uiMode !== 'client' || !me.fixedCustomerId) {
      return (
        <Flex minH="100vh" bg={semanticColor.bgCanvas} align="center" justify="center" p={6}>
          <Text>{t('shell.clientModeNotConfigured')}</Text>
        </Flex>
      )
    }
  }

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
            <Flex w="100%" align="center" gap={spacing[3]} mt={{ base: spacing[1], md: spacing[2] }}>
              <Tabs
                index={tabIndex}
                onChange={(nextIndex) => {
                  const nextTab = visibleTopTabs[nextIndex]
                  if (!nextTab) return
                  setActiveTab(nextTab.id)
                  setActiveView(getDefaultViewForTab(nextTab.id))
                  setFocusAccountName(undefined)
                }}
                variant="unstyled"
                flex="1"
                minW={0}
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
                  {visibleTopTabs.map((tab) => (
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
                      {t(`nav.${tab.id}`)}
                    </Tab>
                  ))}
                </TabList>
              </Tabs>

              <Flex align="center" gap={spacing[3]} flexShrink={0}>
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
                <HStack
                  spacing={2}
                  px={spacing[2]}
                  py={spacing[1]}
                  border="1px solid"
                  borderColor={semanticColor.borderSubtle}
                  borderRadius={radius.md}
                  bg={semanticColor.bgSurface}
                >
                  <Text fontSize="xs" fontWeight="600" color={locale === 'en' ? semanticColor.textPrimary : semanticColor.textMuted}>
                    {t('locale.english')}
                  </Text>
                  <Switch
                    size="md"
                    colorScheme="accent"
                    isChecked={locale === 'ar'}
                    onChange={(e) => setLocale(e.target.checked ? 'ar' : 'en')}
                    aria-label={t('locale.switchAria')}
                  />
                  <Text fontSize="xs" fontWeight="600" color={locale === 'ar' ? semanticColor.textPrimary : semanticColor.textMuted}>
                    {t('locale.arabic')}
                  </Text>
                </HStack>
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
                  {t('shell.signOut')}
                </Button>
              </Flex>
            </Flex>
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
          {import.meta.env.PROD ? `${t('shell.build')} ${__BUILD_STAMP__}` : `${t('shell.build')}: ${BUILD_SHA} ${BUILD_TIME}`}
        </Text>
      </Box>
    </Flex>
  )
}

export default App
