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
  Select,
} from '@chakra-ui/react'
import { useMsal } from '@azure/msal-react'
import { CRM_TOP_TABS, type CrmTopTabId } from './contracts/nav'
import { getVisibleCrmTopTabs, resolveClientModeTab } from './utils/crmTopTabsVisibility'
import { isClientUI } from './platform/mode'
import { getMe, type MeResponse } from './platform/me'
import { clearApiAuthToken } from './auth/apiAuthToken'
import CustomersHomePage, { type CustomersViewId } from './tabs/customers/CustomersHomePage'
import MarketingHomePage, { type OpenDoorsViewId } from './tabs/marketing/MarketingHomePage'
import OnboardingHomePage, { type OnboardingViewId } from './tabs/onboarding/OnboardingHomePage'
import SettingsHomePage from './tabs/settings/SettingsHomePage'
import './App.css'
import { HeaderImagePicker } from './components/HeaderImagePicker'
// import { DiagnosticBanner } from './components/DiagnosticBanner' // REMOVED per user request
import { spacing, semanticColor, radius, shadow, zIndex } from './design-system'
import { useI18n } from './contexts/I18nContext'
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
  const { language, setLanguage, t, dir, isRTL } = useI18n()
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
        setActiveTab(resolveClientModeTab(fromPath))
        if (view) setActiveView(view)
        return
      }
      // Root or unknown path: default authenticated landing is Clients.
      setActiveTab(resolveClientModeTab('customers-home'))
      return
    }
    if (isCrmTopTabId(tab)) {
      setActiveTab(resolveClientModeTab(tab))
      if (view) setActiveView(view)
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

  const getTopTabLabel = (tabId: CrmTopTabId): string => {
    switch (tabId) {
      case 'customers-home':
        return t('nav.customers')
      case 'marketing-home':
        return t('nav.marketing')
      case 'onboarding-home':
        return t('nav.onboarding')
      case 'settings-home':
        return t('nav.settings')
      default:
        return tabId
    }
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
        <Flex minH="100vh" bg={semanticColor.bgCanvas} align="center" justify="center" p={6} dir={dir}>
          <Text color="red.600">{meError}</Text>
        </Flex>
      )
    }
    if (!me) {
      return (
        <Flex minH="100vh" bg={semanticColor.bgCanvas} align="center" justify="center" p={6} dir={dir}>
          <Text>{t('shell.loading')}</Text>
        </Flex>
      )
    }
    if (me.uiMode !== 'client' || !me.fixedCustomerId) {
      return (
        <Flex minH="100vh" bg={semanticColor.bgCanvas} align="center" justify="center" p={6} dir={dir}>
          <Text>Client mode is not configured yet. Contact admin.</Text>
        </Flex>
      )
    }
  }

  return (
    <Flex minH="100vh" bg={semanticColor.bgCanvas} direction="column" position="relative" dir={dir}>
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
            bg={semanticColor.bgElevated}
            borderRadius="2xl"
            border="1px solid"
            borderColor={semanticColor.borderStrong}
            px={{ base: spacing[3], md: spacing[4] }}
            py={{ base: spacing[3], md: spacing[4] }}
            boxShadow={shadow.md}
            backdropFilter="blur(22px)"
            position="sticky"
            top={0}
            zIndex={zIndex.sticky}
            overflow="hidden"
          >
            <Flex
              align={{ base: 'stretch', md: 'center' }}
              justify="space-between"
              gap={3}
              flexDirection={{ base: 'column', lg: isRTL ? 'row-reverse' : 'row' }}
              mb={{ base: spacing[3], md: spacing[4] }}
            >
              <Box>
                <Text
                  fontSize={{ base: 'lg', md: 'xl' }}
                  fontWeight="800"
                  letterSpacing="-0.03em"
                  color={semanticColor.textPrimary}
                >
                  {t('shell.productName')}
                </Text>
                <Text fontSize="sm" color={semanticColor.textMuted}>
                  Premium operator workspace
                </Text>
              </Box>
              <HStack
                spacing={2}
                justify={{ base: 'flex-start', lg: 'flex-end' }}
                flexWrap="wrap"
                flexDirection={isRTL ? 'row-reverse' : 'row'}
              >
                <Select
                  size="sm"
                  maxW={{ base: '100%', md: '180px' }}
                  value={language}
                  onChange={(event) => setLanguage(event.target.value as 'en' | 'ar')}
                  aria-label={t('shell.language')}
                >
                  <option value="en">{t('shell.english')}</option>
                  <option value="ar">{t('shell.arabic')}</option>
                </Select>
                <Badge
                  colorScheme={import.meta.env.PROD ? 'red' : 'yellow'}
                  fontSize="xs"
                  px={2.5}
                  py={1}
                  borderRadius="full"
                  textTransform="uppercase"
                  fontWeight="800"
                >
                  {import.meta.env.PROD ? t('shell.production') : t('shell.dev')}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleSignOut()}
                >
                  {t('shell.signOut')}
                </Button>
              </HStack>
            </Flex>
            <Tabs
              index={tabIndex}
              onChange={(nextIndex) => {
                const nextTab = visibleTopTabs[nextIndex]
                if (!nextTab) return
                setActiveTab(nextTab.id)
                setActiveView('accounts')
                setFocusAccountName(undefined)
              }}
              variant="unstyled"
              dir={dir}
            >
              <TabList
                overflowX="auto"
                whiteSpace="nowrap"
                borderBottom="1px solid"
                borderColor={semanticColor.borderSubtle}
                gap={spacing[2]}
                pb={spacing[2]}
                alignItems="center"
                dir={dir}
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
                    px={spacing[4]}
                    py={spacing[2]}
                    fontSize="sm"
                    fontWeight="700"
                    color={semanticColor.textMuted}
                    border="1px solid"
                    borderColor={semanticColor.borderSubtle}
                    borderRadius="xl"
                    bg="rgba(255,255,255,0.03)"
                    _hover={{ color: semanticColor.textPrimary, bg: 'rgba(255,255,255,0.06)' }}
                    _selected={{
                      color: 'accent.100',
                      borderColor: 'accent.500',
                      bg: 'rgba(227,179,65,0.14)',
                      boxShadow: '0 10px 28px rgba(227,179,65,0.16)',
                    }}
                  >
                    {getTopTabLabel(tab.id)}
                  </Tab>
                ))}
              </TabList>
            </Tabs>
          </Box>

          {/* Main Content */}
          <Box
            bg={semanticColor.bgSurface}
            borderRadius="2xl"
            border="1px solid"
            borderColor={semanticColor.borderSubtle}
            p={{ base: spacing[3], md: spacing[4], lg: spacing[6] }}
            boxShadow={shadow.lg}
            backdropFilter="blur(22px)"
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
