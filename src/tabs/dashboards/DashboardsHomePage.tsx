import { useEffect, useState } from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Badge,
  Box,
  Button,
  Heading,
  HStack,
  IconButton,
  Progress,
  SimpleGrid,
  Spinner,
  Stack,
  Stat,
  StatHelpText,
  StatLabel,
  StatNumber,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
  VStack,
} from '@chakra-ui/react'
import { CheckCircleIcon, RepeatIcon, WarningIcon, DownloadIcon } from '@chakra-ui/icons'
import { type Account } from '../../components/AccountsTab'
import { emit, on } from '../../platform/events'
import { api } from '../../utils/api'
import { getCurrentCustomerId } from '../../platform/stores/settings'
import RequireActiveClient from '../../components/RequireActiveClient'
import { useLiveLeadMetricsPolling } from '../../hooks/useLiveLeadsPolling'
import { DataTable, type DataTableColumn } from '../../components/DataTable'
import { useClientReadinessState } from '../../hooks/useClientReadinessState'
import { getClientReadinessColorScheme } from '../../utils/clientReadinessState'

type CustomerApi = {
  id: string
  name: string
  domain?: string | null
  accountData?: Record<string, unknown> | null
  leadsReportingUrl?: string | null
  sector?: string | null
  clientStatus?: string | null
  targetJobTitle?: string | null
  prospectingLocation?: string | null
  monthlyIntakeGBP?: number | string | null
  defcon?: number | null
  weeklyLeadTarget?: number | null
  weeklyLeadActual?: number | null
  monthlyLeadTarget?: number | null
  monthlyLeadActual?: number | null
}

const DEFAULT_ABOUT_SECTIONS: Account['aboutSections'] = {
  whatTheyDo: '',
  accreditations: '',
  keyLeaders: '',
  companyProfile: '',
  recentNews: '',
  companySize: '',
  headquarters: '',
  foundingYear: '',
}

function mapClientStatusToAccountStatus(status?: string | null): Account['status'] {
  switch (status) {
    case 'inactive':
      return 'Inactive'
    case 'onboarding':
    case 'win_back':
      return 'On Hold'
    default:
      return 'Active'
  }
}

function normalizeCustomerWebsite(domain?: string | null): string {
  if (!domain) return ''
  if (domain.startsWith('http://') || domain.startsWith('https://')) return domain
  return `https://${domain}`
}

function coerceAccountData(value: unknown): Partial<Account> | null {
  if (!value || typeof value !== 'object') return null
  return value as Partial<Account>
}

function normalizeAccountDefaults(raw: Partial<Account>): Account {
  return {
    name: raw.name || '',
    website: raw.website || '',
    aboutSections: { ...DEFAULT_ABOUT_SECTIONS, ...(raw.aboutSections || {}) },
    sector: raw.sector || '',
    socialMedia: Array.isArray(raw.socialMedia) ? raw.socialMedia : [],
    logoUrl: raw.logoUrl,
    aboutSource: raw.aboutSource,
    aboutLocked: raw.aboutLocked,
    status: raw.status || 'Active',
    targetLocation: Array.isArray(raw.targetLocation) ? raw.targetLocation : [],
    targetTitle: raw.targetTitle || '',
    monthlySpendGBP: Number(raw.monthlySpendGBP || 0),
    agreements: Array.isArray(raw.agreements) ? raw.agreements : [],
    defcon: typeof raw.defcon === 'number' ? raw.defcon : 3,
    contractStart: raw.contractStart || '',
    contractEnd: raw.contractEnd || '',
    days: typeof raw.days === 'number' ? raw.days : 0,
    contacts: typeof raw.contacts === 'number' ? raw.contacts : 0,
    leads: typeof raw.leads === 'number' ? raw.leads : 0,
    weeklyTarget: typeof raw.weeklyTarget === 'number' ? raw.weeklyTarget : 0,
    weeklyActual: typeof raw.weeklyActual === 'number' ? raw.weeklyActual : 0,
    monthlyTarget: typeof raw.monthlyTarget === 'number' ? raw.monthlyTarget : 0,
    monthlyActual: typeof raw.monthlyActual === 'number' ? raw.monthlyActual : 0,
    weeklyReport: raw.weeklyReport || '',
    users: Array.isArray(raw.users) ? raw.users : [],
    clientLeadsSheetUrl: raw.clientLeadsSheetUrl || '',
    notes: Array.isArray(raw.notes) ? raw.notes : undefined,
  }
}

function applyCustomerFieldsToAccount(account: Account, customer: CustomerApi): Account {
  const updated: Account = { ...account }
  if (customer.name) updated.name = customer.name
  if (customer.domain) updated.website = normalizeCustomerWebsite(customer.domain)
  if (customer.sector) updated.sector = customer.sector
  if (customer.clientStatus) updated.status = mapClientStatusToAccountStatus(customer.clientStatus)
  if (customer.prospectingLocation) updated.targetLocation = [customer.prospectingLocation]
  if (customer.targetJobTitle) updated.targetTitle = customer.targetJobTitle
  if (customer.monthlyIntakeGBP) updated.monthlySpendGBP = Number(customer.monthlyIntakeGBP || 0)
  if (typeof customer.defcon === 'number') updated.defcon = customer.defcon
  if (typeof customer.weeklyLeadTarget === 'number') updated.weeklyTarget = customer.weeklyLeadTarget
  if (typeof customer.weeklyLeadActual === 'number') updated.weeklyActual = customer.weeklyLeadActual
  if (typeof customer.monthlyLeadTarget === 'number') updated.monthlyTarget = customer.monthlyLeadTarget
  if (typeof customer.monthlyLeadActual === 'number') updated.monthlyActual = customer.monthlyLeadActual
  if (customer.leadsReportingUrl) updated.clientLeadsSheetUrl = customer.leadsReportingUrl
  return updated
}

function buildAccountFromCustomer(customer: CustomerApi): Account {
  const fallback = normalizeAccountDefaults({
    name: customer.name,
    website: normalizeCustomerWebsite(customer.domain),
    sector: customer.sector || '',
    status: mapClientStatusToAccountStatus(customer.clientStatus),
    targetLocation: customer.prospectingLocation ? [customer.prospectingLocation] : [],
    targetTitle: customer.targetJobTitle || '',
    monthlySpendGBP: Number(customer.monthlyIntakeGBP || 0),
    defcon: customer.defcon ?? 3,
    weeklyTarget: customer.weeklyLeadTarget ?? 0,
    weeklyActual: customer.weeklyLeadActual ?? 0,
    monthlyTarget: customer.monthlyLeadTarget ?? 0,
    monthlyActual: customer.monthlyLeadActual ?? 0,
    clientLeadsSheetUrl: customer.leadsReportingUrl || '',
  })
  const accountData = coerceAccountData(customer.accountData)
  const base = accountData ? normalizeAccountDefaults({ ...fallback, ...accountData }) : fallback
  return applyCustomerFieldsToAccount(base, customer)
}

export default function DashboardsHomePage() {
  const toast = useToast()
  const customerId = getCurrentCustomerId()
  const {
    data: liveMetricsData,
    loading: metricsLoading,
    error: metricsError,
    lastUpdatedAt: metricsUpdatedAt,
    refetch: refetchMetrics,
  } = useLiveLeadMetricsPolling(customerId || null)
  const { interpretation: readiness, signal: readinessSignal } = useClientReadinessState(customerId)
  const sourceOfTruth = liveMetricsData?.sourceOfTruth ?? null
  const lastRefresh = metricsUpdatedAt ?? new Date()

  const [accountsData, setAccountsData] = useState<Account[]>([])
  const [hasSyncedCustomers, setHasSyncedCustomers] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  const goToMarketingReadiness = () => {
    window.dispatchEvent(new CustomEvent('navigateToMarketing', { detail: { view: 'readiness' } }))
  }

  const goToOnboardingSetup = () => {
    window.dispatchEvent(new CustomEvent('navigateToOnboarding'))
  }

  const goToClientsMaintenance = () => {
    window.dispatchEvent(new CustomEvent('navigateToAccount'))
  }

  const goToMarketingReports = () => {
    window.dispatchEvent(new CustomEvent('navigateToMarketing', { detail: { view: 'reports' } }))
  }

  const goToMarketingInbox = () => {
    window.dispatchEvent(new CustomEvent('navigateToMarketing', { detail: { view: 'inbox' } }))
  }

  const runReadinessNextStep = () => {
    switch (readiness.nextStep.target) {
      case 'onboarding':
        goToOnboardingSetup()
        break
      case 'clients':
        goToClientsMaintenance()
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
      default:
        goToMarketingReadiness()
        break
    }
  }
  
  useEffect(() => {
    const syncFromCustomers = async () => {
      if (hasSyncedCustomers) return
      setHasSyncedCustomers(true)
      
      console.log('🔄 Dashboard: Fetching customers from API...')
      const { data, error } = await api.get<CustomerApi[]>('/api/customers')
      
      if (error) {
        console.error('❌ Dashboard: Failed to fetch customers:', error)
        return
      }
      
      const list = Array.isArray(data) ? data : []
      if (list.length === 0) {
        console.warn('⚠️ Dashboard: ZERO customers returned from API!')
        console.warn('⚠️ You need to add customers in the Accounts tab first.')
        return
      }

      console.log(`✅ Dashboard: Loaded ${list.length} customers from API`)
      
      // Check which customers have Google Sheets URLs
      const customersWithUrls = list.filter(c => c.leadsReportingUrl)
      console.log(`📊 Customers with Google Sheets URLs: ${customersWithUrls.length}/${list.length}`)
      
      if (customersWithUrls.length === 0) {
        console.warn('⚠️ Dashboard: NO customers have Google Sheets URLs configured!')
        console.warn('⚠️ This is why NO leads data is showing!')
        console.warn('⚠️ Solution: Go to Accounts tab → Edit each customer → Add Google Sheets URL')
      } else {
        customersWithUrls.forEach(c => {
          console.log(`  ✅ ${c.name}: ${c.leadsReportingUrl}`)
        })
      }

      const hydrated = list.map((customer) => buildAccountFromCustomer(customer))
      // NO localStorage persistence - API is the ONLY source of truth
      setAccountsData(hydrated)
      emit('accountsUpdated', hydrated)
    }

    const init = async () => {
      await syncFromCustomers()
      await refetchMetrics()
    }

    void init()

    const offAccountsUpdated = on<Account[]>('accountsUpdated', (accounts) => {
      if (accounts && accounts.length > 0) setAccountsData(accounts)
      void refetchMetrics()
    })
    const offLeadsUpdated = on('leadsUpdated', () => void refetchMetrics())

    const refreshInterval = setInterval(async () => {
      const syncCustomers = async () => {
        const { data, error } = await api.get<CustomerApi[]>('/api/customers')
        const list = Array.isArray(data) ? data : []
        if (error || list.length === 0) return
        const hydrated = list.map((customer) => buildAccountFromCustomer(customer))
        setAccountsData(hydrated)
        emit('accountsUpdated', hydrated)
      }
      await Promise.allSettled([syncCustomers(), refetchMetrics()])
    }, 30 * 1000)

    return () => {
      offAccountsUpdated()
      offLeadsUpdated()
      clearInterval(refreshInterval)
    }
  }, [refetchMetrics, hasSyncedCustomers])

  const now = new Date()
  const totalWeeklyTarget = accountsData.reduce((sum, acc) => sum + (acc.weeklyTarget || 0), 0)
  const totalMonthlyTarget = accountsData.reduce((sum, acc) => sum + (acc.monthlyTarget || 0), 0)
  const kpiMetricsAvailable = Boolean(liveMetricsData) && !metricsError
  const metricsAuthoritative = liveMetricsData?.authoritative !== false && liveMetricsData?.dataFreshness !== 'diagnostic_stale'
  const showKpiContractError = !metricsLoading && (!kpiMetricsAvailable || !metricsAuthoritative)
  const weekTotal = kpiMetricsAvailable && metricsAuthoritative ? (liveMetricsData?.weekLeads ?? 0) : 0
  const monthTotal = kpiMetricsAvailable && metricsAuthoritative ? (liveMetricsData?.monthLeads ?? 0) : 0
  const todayTotal = kpiMetricsAvailable && metricsAuthoritative ? (liveMetricsData?.todayLeads ?? 0) : 0
  const channelBreakdown: Record<string, number> =
    kpiMetricsAvailable && metricsAuthoritative ? (liveMetricsData?.breakdownBySource ?? {}) : {}
  const teamBreakdown: Record<string, number> =
    kpiMetricsAvailable && metricsAuthoritative ? (liveMetricsData?.breakdownByOwner ?? {}) : {}

  const salesLeaderboard = Object.entries(teamBreakdown)
    .map(([name, leads]) => ({ name, leads }))
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 5)

  const accountsWithPercentages = accountsData
    .map((account) => ({
      ...account,
      monthlyPercentage: account.monthlyTarget > 0 
        ? ((account.monthlyActual || 0) / account.monthlyTarget) * 100 
        : 0,
    }))
    .sort((a, b) => b.monthlySpendGBP - a.monthlySpendGBP)
  
  // DataTable columns definition
  const dashboardColumns: DataTableColumn<typeof accountsWithPercentages[0]>[] = [
    {
      id: 'name',
      header: 'Client',
      accessorKey: 'name',
      sortable: true,
      filterable: true,
      width: 200,
    },
    {
      id: 'monthlySpendGBP',
      header: 'Spend (£)',
      accessorKey: 'monthlySpendGBP',
      cell: ({ value }) => value.toLocaleString(),
      sortable: true,
      width: 120,
    },
    {
      id: 'weeklyActual',
      header: 'Week Actual',
      accessorKey: 'weeklyActual',
      cell: ({ value }) => value || 0,
      sortable: true,
      width: 100,
    },
    {
      id: 'weeklyTarget',
      header: 'Week Target',
      accessorKey: 'weeklyTarget',
      cell: ({ value }) => value || 0,
      sortable: true,
      width: 100,
    },
    {
      id: 'monthlyActual',
      header: 'Month Actual',
      accessorKey: 'monthlyActual',
      cell: ({ value }) => value || 0,
      sortable: true,
      width: 120,
    },
    {
      id: 'monthlyTarget',
      header: 'Month Target',
      accessorKey: 'monthlyTarget',
      cell: ({ value }) => value || 0,
      sortable: true,
      width: 120,
    },
    {
      id: 'monthlyPercentage',
      header: '% Target',
      accessorKey: 'monthlyPercentage',
      cell: ({ value }) => (
        <Text
          color={
            value >= 100 ? 'green.600' :
            value >= 50 ? 'yellow.600' :
            'red.600'
          }
          fontWeight="semibold"
        >
          {value.toFixed(1)}%
        </Text>
      ),
      sortable: true,
      width: 100,
    },
    {
      id: 'defcon',
      header: 'DEFCON',
      accessorKey: 'defcon',
      cell: ({ value }) => (
        <Badge
          colorScheme={
            value <= 2 ? 'red' :
            value === 3 ? 'yellow' :
            value >= 4 && value <= 5 ? 'green' :
            'blue'
          }
          fontSize="sm"
          px={2}
        >
          {value}
        </Badge>
      ),
      sortable: true,
      width: 90,
    },
  ]

  const weekProgress = totalWeeklyTarget > 0 ? (weekTotal / totalWeeklyTarget) * 100 : 0
  const isWeekOnTrack = weekTotal >= totalWeeklyTarget * 0.8
  const dailyTarget = Math.ceil(totalWeeklyTarget / 7)
  const currentMonth = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const weekNumber = Math.ceil((now.getDate() + new Date(now.getFullYear(), now.getMonth(), now.getDate()).getDay()) / 7)

  if (metricsLoading && !liveMetricsData) {
    return (
      <RequireActiveClient>
        <Box textAlign="center" py={12}>
          <Spinner size="xl" color="brand.700" thickness="4px" />
          <Text mt={4} color="gray.600">
            Loading live lead performance...
          </Text>
        </Box>
      </RequireActiveClient>
    )
  }

  return (
    <RequireActiveClient>
    <VStack spacing={3} align="stretch">
      {/* Action-Priority Triage (primary entry) */}
      <Box
        id="dashboard-next-step-routing"
        bg="blue.50"
        p={3}
        borderRadius="md"
        border="1px"
        borderColor="blue.100"
        data-testid="dashboard-action-priority-triage"
      >
        <Box
          mb={2}
          p={2}
          borderRadius="md"
          borderWidth="1px"
          borderColor="blue.200"
          bg="blue.100"
          data-testid="dashboard-live-triage-role-separation"
        >
          <Text fontSize="sm" color="blue.900">
            Dashboard is for live triage: what needs attention now. Use Marketing Reports for retrospective outcome analysis.
          </Text>
        </Box>
        <HStack justify="space-between" align="start" flexWrap="wrap" gap={2}>
          <Box>
            <Text fontWeight="semibold" color="blue.800" data-testid="dashboard-role-framing">
              Action priority triage
            </Text>
            <Text fontSize="sm" color="blue.900" mt={1}>
              Start here each day: resolve urgent blockers first, then move into outreach operations.
            </Text>
          </Box>
          <Badge colorScheme={getClientReadinessColorScheme(readiness.state)} data-testid="dashboard-client-readiness-state">
            {readiness.label}
          </Badge>
        </HStack>

        <Text fontSize="sm" color="blue.900" mt={2}>
          {readiness.reason}
        </Text>
        <Text fontSize="xs" color="blue.800" mt={1} data-testid="dashboard-daily-vs-admin-framing">
          Daily workflow: Dashboard, Clients, Onboarding, and Marketing. Use Settings for admin controls only.
        </Text>

        <HStack spacing={2} mt={3} flexWrap="wrap" data-testid="dashboard-triage-next-actions">
          <Button
            size="sm"
            colorScheme="teal"
            onClick={runReadinessNextStep}
            data-testid="dashboard-readiness-next-step"
          >
            {readiness.nextStep.label}
          </Button>
          <Button size="sm" colorScheme="blue" onClick={goToMarketingReadiness} data-testid="dashboard-go-marketing-readiness">
            Open Marketing Readiness
          </Button>
          <Button size="sm" variant="outline" colorScheme="purple" onClick={goToOnboardingSetup} data-testid="dashboard-go-onboarding-setup">
            Continue setup in Onboarding
          </Button>
          <Button size="sm" variant="outline" colorScheme="gray" onClick={goToClientsMaintenance} data-testid="dashboard-go-clients-maintenance">
            Fix data in OpenDoors Clients
          </Button>
          <Button size="sm" variant="ghost" colorScheme="blue" onClick={goToMarketingReports} data-testid="dashboard-go-reports-retrospective">
            Review retrospective results in Reports
          </Button>
        </HStack>

        <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={2} mt={3} data-testid="dashboard-priority-groups">
          <Box borderWidth="1px" borderRadius="md" p={2} bg={readiness.state === 'needs-attention' ? 'red.50' : 'white'} data-testid="dashboard-priority-needs-attention">
            <HStack justify="space-between">
              <Text fontWeight="semibold" fontSize="sm">Needs attention</Text>
              <Badge colorScheme="red">{readiness.state === 'needs-attention' ? 1 : 0}</Badge>
            </HStack>
            <Text fontSize="xs" color="gray.600" mt={1}>Blocked or failed outreach that should be reviewed now.</Text>
            <Button mt={2} size="xs" variant="ghost" onClick={goToMarketingReadiness}>Open Readiness</Button>
          </Box>

          <Box borderWidth="1px" borderRadius="md" p={2} bg={(readiness.state === 'setup-needed' || readiness.state === 'data-incomplete') ? 'orange.50' : 'white'} data-testid="dashboard-priority-setup-data">
            <HStack justify="space-between">
              <Text fontWeight="semibold" fontSize="sm">Setup / data blockers</Text>
              <Badge colorScheme="orange">{(readiness.state === 'setup-needed' || readiness.state === 'data-incomplete') ? 1 : 0}</Badge>
            </HStack>
            <Text fontSize="xs" color="gray.600" mt={1}>Onboarding and client data prerequisites that block reliable outreach.</Text>
            <HStack mt={2}>
              <Button size="xs" variant="ghost" onClick={goToOnboardingSetup}>Onboarding</Button>
              <Button size="xs" variant="ghost" onClick={goToClientsMaintenance}>Clients</Button>
            </HStack>
          </Box>

          <Box borderWidth="1px" borderRadius="md" p={2} bg={readiness.state === 'ready-for-outreach' ? 'green.50' : 'white'} data-testid="dashboard-priority-ready-outreach">
            <HStack justify="space-between">
              <Text fontWeight="semibold" fontSize="sm">Ready for outreach</Text>
              <Badge colorScheme="green">{readiness.state === 'ready-for-outreach' ? 1 : 0}</Badge>
            </HStack>
            <Text fontSize="xs" color="gray.600" mt={1}>Core checks are healthy and the client can move into outreach execution.</Text>
            <Button mt={2} size="xs" variant="ghost" onClick={goToMarketingReadiness}>Start in Marketing</Button>
          </Box>

          <Box borderWidth="1px" borderRadius="md" p={2} bg={readiness.state === 'outreach-active' ? 'blue.100' : 'white'} data-testid="dashboard-priority-active-outreach">
            <HStack justify="space-between">
              <Text fontWeight="semibold" fontSize="sm">Outreach active</Text>
              <Badge colorScheme="blue">{readiness.state === 'outreach-active' ? 1 : 0}</Badge>
            </HStack>
            <Text fontSize="xs" color="gray.600" mt={1}>Watch outcomes and replies while outreach is running.</Text>
            <HStack mt={2}>
              <Button size="xs" variant="ghost" onClick={goToMarketingReports}>Reports</Button>
              <Button size="xs" variant="ghost" onClick={goToMarketingInbox}>Inbox</Button>
            </HStack>
          </Box>
        </SimpleGrid>

        <HStack mt={2} spacing={3} flexWrap="wrap" data-testid="dashboard-triage-queue-facts">
          <Text fontSize="xs" color="gray.700">Ready now: <b>{readinessSignal.queue.readyNow}</b></Text>
          <Text fontSize="xs" color="gray.700">Blocked: <b>{readinessSignal.queue.blocked}</b></Text>
          <Text fontSize="xs" color="gray.700">Failed recently: <b>{readinessSignal.queue.failedRecently}</b></Text>
          <Text fontSize="xs" color="gray.700">Sent recently: <b>{readinessSignal.queue.sentRecently}</b></Text>
        </HStack>
      </Box>

      {/* Header Stats */}
      <Box
        bg="white"
        p={3}
        borderRadius="md"
        shadow="sm"
        border="1px"
        borderColor="gray.200"
        data-testid="dashboard-kpi-truth-contract"
      >
        <HStack justify="space-between" mb={2} flexWrap="wrap">
          <Box>
            <Heading size="md" color="gray.700">
              Supporting KPI Context
            </Heading>
            <Text fontSize="xs" color="gray.500" mt={1}>
              Secondary metrics and trend context after triage decisions. Auto-refreshes every 30 seconds • Last updated: {lastRefresh.toLocaleTimeString()}
            </Text>
            <Text fontSize="xs" color="gray.500" mt={1} data-testid="dashboard-kpi-source-of-truth-mode">
              KPI source of truth: {sourceOfTruth === 'google_sheets' ? 'Google Sheets (backend-validated)' : sourceOfTruth === 'db' ? 'Database' : 'Unavailable'}
            </Text>
          </Box>
          <HStack spacing={2}>
            <IconButton
              aria-label="Sync from Google Sheets"
              icon={<DownloadIcon />}
              onClick={async () => {
                setIsSyncing(true)
                try {
                  const { data: customers, error: customersError } = await api.get<CustomerApi[]>('/api/customers')
                  if (customersError || !customers) throw new Error('Failed to fetch customers')
                  
                  const customersWithUrls = customers.filter(c => c.leadsReportingUrl)
                  const syncPromises = customersWithUrls.map(async (customer) => {
                    try {
                      const { error } = await api.post(`/api/leads/sync/trigger?customerId=${customer.id}`)
                      return { customer: customer.name, success: !error }
                    } catch {
                      return { customer: customer.name, success: false }
                    }
                  })
                  
                  const results = await Promise.all(syncPromises)
                  const successCount = results.filter(r => r.success).length
                  
                  if (successCount > 0) {
                    toast({
                      title: 'Sync triggered',
                      description: `Syncing ${successCount} customers. Refresh in 10 seconds.`,
                      status: 'success',
                      duration: 5000,
                    })
                    setTimeout(() => {
                      void refetchMetrics()
                    }, 10000)
                  }
                } catch (err: any) {
                  toast({
                    title: 'Sync failed',
                    description: err?.message || 'Could not trigger sync',
                    status: 'error',
                    duration: 5000,
                  })
                } finally {
                  setIsSyncing(false)
                }
              }}
              isLoading={isSyncing}
              colorScheme="green"
              size="sm"
              title="Sync from Google Sheets"
            />
            <IconButton
              aria-label="Refresh dashboard data"
              icon={<RepeatIcon />}
            onClick={async () => {
              // Refresh both customers and leads
              const syncFromCustomers = async () => {
                const { data, error } = await api.get<CustomerApi[]>('/api/customers')
                if (error || !data || data.length === 0) return
                const hydrated = data.map((customer) => buildAccountFromCustomer(customer))
                // NO localStorage persistence - API is the ONLY source of truth
                setAccountsData(hydrated)
                emit('accountsUpdated', hydrated)
              }

              const results = await Promise.allSettled([
                syncFromCustomers(),
                refetchMetrics(),
              ])

              // Check actual operation success before showing feedback
              const allSuccessful = results.every(result => result.status === 'fulfilled')
              const hasPartialSuccess = results.some(result => result.status === 'fulfilled')

              if (allSuccessful) {
                toast({
                  title: 'Dashboard refreshed',
                  description: 'Latest customer and lead data loaded',
                  status: 'success',
                  duration: 2000,
                  isClosable: true,
                })
              } else if (hasPartialSuccess) {
                toast({
                  title: 'Partial refresh completed',
                  description: 'Some data refreshed successfully',
                  status: 'warning',
                  duration: 3000,
                  isClosable: true,
                })
              } else {
                toast({
                  title: 'Refresh failed',
                  description: 'Could not refresh dashboard data',
                  status: 'error',
                  duration: 3000,
                  isClosable: true,
                })
              }
            }}
              isLoading={metricsLoading}
              colorScheme="blue"
              size="sm"
              title="Refresh dashboard data"
            />
          </HStack>
        </HStack>

        {showKpiContractError && (
          <Alert
            status="warning"
            borderRadius="md"
            mb={3}
            data-testid="dashboard-kpi-truth-error"
            id="dashboard-kpi-truth-error"
          >
            <AlertIcon />
            <Box>
              <AlertTitle fontSize="sm">Live KPI truth is currently unavailable</AlertTitle>
              <AlertDescription fontSize="sm">
                {metricsError || liveMetricsData?.warning || liveMetricsData?.hint || 'The dashboard could not load authoritative KPI metrics from backend truth. Refresh after checking lead source access.'}
              </AlertDescription>
            </Box>
          </Alert>
        )}

        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
          <Stat>
            <StatLabel fontSize="xs">Total Leads This Week</StatLabel>
            <StatNumber fontSize="2xl" color="orange.500">
              {showKpiContractError ? '—' : weekTotal}
            </StatNumber>
            <StatHelpText fontSize="xs">Week {weekNumber} Target: {totalWeeklyTarget}</StatHelpText>
          </Stat>

          <Stat>
            <StatLabel fontSize="xs">Current Month</StatLabel>
            <StatNumber fontSize="lg">{currentMonth}</StatNumber>
            <StatHelpText fontSize="xs">Target: {totalMonthlyTarget}</StatHelpText>
          </Stat>

          <Stat>
            <StatLabel fontSize="xs">Month-to-Date</StatLabel>
            <StatNumber fontSize="2xl" color="orange.500">
              {showKpiContractError ? '—' : monthTotal}
            </StatNumber>
            <StatHelpText fontSize="xs">
              {showKpiContractError
                ? 'Awaiting authoritative KPI refresh'
                : totalMonthlyTarget > 0
                ? `${((monthTotal / totalMonthlyTarget) * 100).toFixed(1)}% of target`
                : 'No target set'}
            </StatHelpText>
          </Stat>
        </SimpleGrid>
      </Box>

      {/* Main Client Table */}
      <DataTable
        data={accountsWithPercentages}
        columns={dashboardColumns}
        tableId="dashboard-clients"
        enableSorting
        enableFiltering={false}
        enableColumnReorder
        enableColumnResize
        enableColumnVisibility
        enablePagination={false}
        enableExport
        compact
        loading={metricsLoading}
        emptyMessage="No client data available"
      />

      {/* Channel Breakdown & Progress */}
      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={3}>
        {/* Channel Breakdown */}
        <Box bg="white" p={3} borderRadius="md" shadow="sm" border="1px" borderColor="gray.200">
          <Heading size="sm" mb={2}>Channel</Heading>
          <VStack align="stretch" spacing={2}>
            {Object.entries(channelBreakdown)
              .sort((a, b) => b[1] - a[1])
              .map(([channel, count]) => (
                <HStack key={channel} justify="space-between">
                  <Text fontSize="sm">{channel}</Text>
                  <Badge colorScheme="blue" fontSize="sm" px={2}>
                    {count}
                  </Badge>
                </HStack>
              ))}
            {Object.keys(channelBreakdown).length === 0 && (
              <Text color="gray.400" fontSize="sm">No leads this week</Text>
            )}
          </VStack>

          <Box mt={3} p={3} bg="gray.50" borderRadius="md">
            <Text fontWeight="semibold" fontSize="sm" mb={1}>Month-to-Date</Text>
            <Text fontSize="2xl" fontWeight="bold" color="blue.600">{monthTotal}</Text>
            {Object.entries(channelBreakdown).map(([channel, count]) => {
              const percentage = monthTotal > 0 ? (count / monthTotal) * 100 : 0
              return (
                <HStack key={channel} justify="space-between" mt={2}>
                  <Text fontSize="sm">{channel}</Text>
                  <Text fontSize="sm" color="gray.600">{percentage.toFixed(0)}%</Text>
                </HStack>
              )
            })}
          </Box>
        </Box>

        {/* Week Progress - INCH BY INCH */}
        <Box bg="white" p={3} borderRadius="md" shadow="sm" border="1px" borderColor="gray.200">
          <Heading size="sm" mb={2} color="purple.700">INCH BY INCH</Heading>
          
          <Box mb={3}>
            <HStack justify="space-between" mb={1}>
              <Text fontWeight="semibold" fontSize="sm">This Week's Target</Text>
              <Badge 
                colorScheme={isWeekOnTrack ? 'green' : 'orange'} 
                fontSize="xs" 
                px={2}
              >
                {isWeekOnTrack ? '✓ On Track' : '○ Behind'}
              </Badge>
            </HStack>
            <Text fontSize="3xl" fontWeight="bold" color="blue.600">{totalWeeklyTarget}</Text>
            <Progress 
              value={weekProgress} 
              colorScheme={weekProgress >= 80 ? 'green' : weekProgress >= 50 ? 'yellow' : 'red'}
              size="md"
              borderRadius="md"
              mt={1}
              hasStripe
              isAnimated
            />
            <Text fontSize="xs" color="gray.600" mt={1}>{weekProgress.toFixed(0)}% Complete ({weekTotal}/{totalWeeklyTarget})</Text>
          </Box>

          <VStack align="stretch" spacing={2}>
            <HStack justify="space-between" p={2} bg="blue.50" borderRadius="md">
              <Text fontWeight="medium" fontSize="sm">Daily Target</Text>
              <Text fontSize="lg" fontWeight="bold">{dailyTarget}</Text>
            </HStack>
            
            <HStack justify="space-between" p={2} bg="green.50" borderRadius="md">
              <Text fontWeight="medium" fontSize="sm">Today's Leads</Text>
              <HStack>
                <Text fontSize="lg" fontWeight="bold">{todayTotal}</Text>
                {todayTotal >= dailyTarget ? (
                  <CheckCircleIcon color="green.500" boxSize={4} />
                ) : (
                  <WarningIcon color="orange.500" boxSize={4} />
                )}
              </HStack>
            </HStack>

            <HStack justify="space-between" p={2} bg="orange.50" borderRadius="md">
              <Text fontWeight="medium" fontSize="sm">Left to Go</Text>
              <Text fontSize="lg" fontWeight="bold" color="orange.600">
                {Math.max(0, totalWeeklyTarget - weekTotal)}
              </Text>
            </HStack>
          </VStack>
        </Box>
      </SimpleGrid>

      {/* Sales Leaderboard */}
      <Box bg="white" p={3} borderRadius="md" shadow="sm" border="1px" borderColor="gray.200">
        <HStack justify="space-between" mb={2}>
          <Heading size="sm" color="blue.700">Sales Leaderboard</Heading>
          <Badge colorScheme="blue" fontSize="xs" px={2}>Current Week</Badge>
        </HStack>
        
        <Table size="sm" variant="simple" sx={{ 'td, th': { py: 1, px: 2 } }}>
          <Thead bg="blue.50">
            <Tr>
              <Th fontSize="xs">Rank</Th>
              <Th fontSize="xs">Salesperson</Th>
              <Th isNumeric fontSize="xs">Leads</Th>
            </Tr>
          </Thead>
          <Tbody>
            {salesLeaderboard.map((entry, index) => (
              <Tr key={entry.name}>
                <Td>
                  <Badge
                    colorScheme={index === 0 ? 'yellow' : index === 1 ? 'gray' : index === 2 ? 'orange' : 'blue'}
                    fontSize="sm"
                    px={2}
                  >
                    {index + 1}
                  </Badge>
                </Td>
                <Td fontWeight="medium" fontSize="sm">{entry.name}</Td>
                <Td isNumeric fontSize="lg" fontWeight="bold" color="blue.600">{entry.leads}</Td>
              </Tr>
            ))}
            {salesLeaderboard.length === 0 && (
              <Tr>
                <Td colSpan={3} textAlign="center" color="gray.400" py={4} fontSize="sm">
                  No leads recorded this week
                </Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </Box>

      <Text fontSize="xs" color="gray.400" textAlign="center">
        Last synced: {lastRefresh.toLocaleString('en-GB')} | KPI truth: {sourceOfTruth === 'google_sheets' ? 'Google Sheets (via backend sync)' : sourceOfTruth === 'db' ? 'Database' : 'Unavailable'}
      </Text>
    </VStack>
    </RequireActiveClient>
  )
}
