import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Box,
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
import { CheckCircleIcon, RepeatIcon, WarningIcon } from '@chakra-ui/icons'
import { type Account } from '../../components/AccountsTab'
import { syncAccountLeadCountsFromLeads } from '../../utils/accountsLeadsSync'
import { emit, on } from '../../platform/events'
import { OdcrmStorageKeys } from '../../platform/keys'
import { getItem, getJson, setItem, setJson } from '../../platform/storage'
import { api } from '../../utils/api'
import { fetchLeadsFromApi, persistLeadsToStorage } from '../../utils/leadsApi'

type Lead = {
  [key: string]: string
  accountName: string
}

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

const LEAD_SOURCE_CATEGORIES = [
  'Individual Email',
  'Telesales',
  'SJ Contact List',
  'Salesforce Individual Email',
  'Personal Contacts',
  'Old CRM',
  'LinkedIn',
  'CRM Email',
] as const

const LEAD_SOURCE_KEYWORDS: Record<string, string[]> = {
  'Individual Email': ['individual email'],
  Telesales: ['telesales', 'tele-sales'],
  'SJ Contact List': ['sj contact'],
  'Salesforce Individual Email': ['salesforce individual email', 'salesforce email'],
  'Personal Contacts': ['personal contact'],
  'Old CRM': ['old crm'],
  LinkedIn: ['linkedin'],
  'CRM Email': ['crm email'],
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

const normalizeLeadSource = (value: string | undefined): string | null => {
  if (!value) return null
  const cleaned = value.trim().toLowerCase()
  if (!cleaned) return null

  const exactMatch = LEAD_SOURCE_CATEGORIES.find((source) => source.toLowerCase() === cleaned)
  if (exactMatch) return exactMatch

  for (const category of LEAD_SOURCE_CATEGORIES) {
    const keywords = LEAD_SOURCE_KEYWORDS[category] || []
    if (keywords.some((keyword) => cleaned.includes(keyword))) {
      return category
    }
  }

  return null
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

function loadAccountsFromStorage(): Account[] {
  const parsed = getJson<Account[]>(OdcrmStorageKeys.accounts)
  if (parsed && Array.isArray(parsed) && parsed.length > 0) return parsed
  return []
}

function loadLeadsFromStorage(): Lead[] {
  const parsed = getJson<Lead[]>(OdcrmStorageKeys.marketingLeads)
  return parsed && Array.isArray(parsed) ? parsed : []
}

function loadLastRefreshFromStorage(): Date | null {
  const stored = getItem(OdcrmStorageKeys.marketingLeadsLastRefresh)
  if (!stored) return null
  const parsed = new Date(stored)
  return isNaN(parsed.getTime()) ? null : parsed
}

function shouldRefresh(leads: Lead[]): boolean {
  if (leads.length === 0) return true
  const lastRefreshTime = loadLastRefreshFromStorage()
  if (!lastRefreshTime) return true

  try {
    const accountsUpdatedIso = getItem(OdcrmStorageKeys.accountsLastUpdated)
    if (accountsUpdatedIso) {
      const accountsUpdatedAt = new Date(accountsUpdatedIso)
      if (!isNaN(accountsUpdatedAt.getTime()) && accountsUpdatedAt > lastRefreshTime) {
        return true
      }
    }
  } catch {
    // ignore
  }

  const now = new Date()
  const sixHoursInMs = 6 * 60 * 60 * 1000
  return now.getTime() - lastRefreshTime.getTime() >= sixHoursInMs
}

export default function DashboardsHomePage() {
  const toast = useToast()
  const [accountsData, setAccountsData] = useState<Account[]>(() => loadAccountsFromStorage())
  const [leads, setLeads] = useState<Lead[]>(() => loadLeadsFromStorage())
  const [loading, setLoading] = useState(leads.length === 0)
  const [lastRefresh, setLastRefresh] = useState<Date>(() => loadLastRefreshFromStorage() || new Date())
  const [hasSyncedCustomers, setHasSyncedCustomers] = useState(false)

  const refreshLeads = useCallback(async (forceRefresh: boolean) => {
    if (!forceRefresh && !shouldRefresh(leads)) return

    setLoading(true)
    try {
      const { leads: allLeads, lastSyncAt } = await fetchLeadsFromApi()
      persistLeadsToStorage(allLeads, lastSyncAt)
      setLeads(allLeads)
      setLastRefresh(lastSyncAt ? new Date(lastSyncAt) : new Date())
      syncAccountLeadCountsFromLeads(allLeads)
    } catch (err: any) {
      toast({
        title: 'Leads refresh failed',
        description: err?.message || 'Unable to refresh leads from the server.',
        status: 'error',
        duration: 6000,
        isClosable: true,
      })
    } finally {
      setLoading(false)
    }
  }, [leads, toast])

  useEffect(() => {
    const syncFromCustomers = async () => {
      if (hasSyncedCustomers) return
      setHasSyncedCustomers(true)
      const { data, error } = await api.get<CustomerApi[]>('/api/customers')
      if (error || !data || data.length === 0) return

      const hydrated = data.map((customer) => buildAccountFromCustomer(customer))
      setJson(OdcrmStorageKeys.accounts, hydrated)
      setItem(OdcrmStorageKeys.accountsLastUpdated, new Date().toISOString())
      setAccountsData(hydrated)
      emit('accountsUpdated', hydrated)
    }

    const init = async () => {
      await syncFromCustomers()
      await refreshLeads(false)
    }

    void init()

    const offAccountsUpdated = on('accountsUpdated', () => {
      setAccountsData(loadAccountsFromStorage())
      void refreshLeads(true)
    })
    const offLeadsUpdated = on('leadsUpdated', () => {
      setLeads(loadLeadsFromStorage())
      setLastRefresh(loadLastRefreshFromStorage() || new Date())
    })

    const refreshInterval = setInterval(() => {
      void refreshLeads(false)
    }, 6 * 60 * 60 * 1000)

    return () => {
      offAccountsUpdated()
      offLeadsUpdated()
      clearInterval(refreshInterval)
    }
  }, [refreshLeads, hasSyncedCustomers])

  const unifiedAnalytics = useMemo(() => {
    const totalWeeklyTarget = accountsData.reduce((sum, acc) => sum + (acc.weeklyTarget || 0), 0)
    const totalMonthlyTarget = accountsData.reduce((sum, acc) => sum + (acc.monthlyTarget || 0), 0)

    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfToday = new Date(startOfToday)
    endOfToday.setDate(endOfToday.getDate() + 1)

    const weekStart = new Date(startOfToday)
    const day = weekStart.getDay()
    const diff = day === 0 ? -6 : 1 - day
    weekStart.setDate(weekStart.getDate() + diff)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()

    const dailyTargetFromWeekly = totalWeeklyTarget / 7
    const dailyTargetFromMonthly = totalMonthlyTarget / daysInMonth
    const dailyTarget = dailyTargetFromWeekly > 0 ? dailyTargetFromWeekly : dailyTargetFromMonthly

    const parseLeadDate = (dateStr: string): Date | null => {
      if (!dateStr || dateStr.trim() === '') return null
      const ddmmyy = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/)
      if (ddmmyy) {
        const day = parseInt(ddmmyy[1], 10)
        const month = parseInt(ddmmyy[2], 10) - 1
        const year = parseInt(ddmmyy[3], 10) < 100 ? 2000 + parseInt(ddmmyy[3], 10) : parseInt(ddmmyy[3], 10)
        return new Date(year, month, day)
      }
      const parsed = new Date(dateStr)
      return isNaN(parsed.getTime()) ? null : parsed
    }

    const leadsWithDates = leads
      .map((lead) => {
        const dateValue =
          lead['Date'] ||
          lead['date'] ||
          lead['Week'] ||
          lead['week'] ||
          lead['First Meeting Date'] ||
          ''
        const parsedDate = parseLeadDate(dateValue)
        if (!parsedDate) return null
        return { data: lead, parsedDate }
      })
      .filter((x): x is { data: Lead; parsedDate: Date } => Boolean(x))

    const computeMetrics = (start: Date, end: Date) => {
      const breakdown: Record<string, number> = {}
      const teamBreakdown: Record<string, number> = {}
      let actual = 0

      leadsWithDates.forEach((entry) => {
        if (entry.parsedDate >= start && entry.parsedDate < end) {
          actual += 1

          const channel = entry.data['Channel of Lead'] || entry.data['channel of lead'] || ''
          const normalized = normalizeLeadSource(channel)
          const key = normalized || (channel ? channel : '')
          if (key) breakdown[key] = (breakdown[key] || 0) + 1

          const rawTeamMember =
            entry.data['OD Team Member'] ||
            entry.data['OD team member'] ||
            entry.data['od team member'] ||
            entry.data['OD Team'] ||
            entry.data['od team'] ||
            ''

          if (rawTeamMember && rawTeamMember.trim()) {
            const members = rawTeamMember
              .split(/,|&|\/|\+|\band\b/gi)
              .map((m) => m.trim())
              .filter(Boolean)

            members.forEach((member) => {
              teamBreakdown[member] = (teamBreakdown[member] || 0) + 1
            })
          }
        }
      })

      return { actual, breakdown, teamBreakdown }
    }

    return {
      periodMetrics: {
        today: { label: 'Today', ...computeMetrics(startOfToday, endOfToday), target: Math.max(Math.round(dailyTarget), 0) },
        week: { label: 'This Week', ...computeMetrics(weekStart, weekEnd), target: Math.max(Math.round(totalWeeklyTarget), 0) },
        month: { label: 'This Month', ...computeMetrics(monthStart, monthEnd), target: Math.max(Math.round(totalMonthlyTarget), 0) },
      },
    }
  }, [accountsData, leads])

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfToday = new Date(startOfToday)
  endOfToday.setDate(endOfToday.getDate() + 1)

  const weekStart = new Date(startOfToday)
  const day = weekStart.getDay()
  const diff = day === 0 ? -6 : 1 - day
  weekStart.setDate(weekStart.getDate() + diff)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const parseLeadDate = (dateStr: string): Date | null => {
    if (!dateStr || dateStr.trim() === '') return null
    const ddmmyy = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/)
    if (ddmmyy) {
      const day = parseInt(ddmmyy[1], 10)
      const month = parseInt(ddmmyy[2], 10) - 1
      const year = parseInt(ddmmyy[3], 10) < 100 ? 2000 + parseInt(ddmmyy[3], 10) : parseInt(ddmmyy[3], 10)
      return new Date(year, month, day)
    }
    return null
  }

  const leadsWithDates = leads
    .map((lead) => {
      const dateValue = lead['Date'] || lead['date'] || lead['Week'] || lead['week'] || ''
      const parsedDate = parseLeadDate(dateValue)
      if (!parsedDate) return null
      return { data: lead, parsedDate }
    })
    .filter((x): x is { data: Lead; parsedDate: Date } => Boolean(x))

  const weekTotal = leadsWithDates.filter(
    (entry) => entry.parsedDate >= weekStart && entry.parsedDate < weekEnd
  ).length

  const monthTotal = leadsWithDates.filter(
    (entry) => entry.parsedDate >= monthStart && entry.parsedDate < monthEnd
  ).length

  const todayTotal = leadsWithDates.filter(
    (entry) => entry.parsedDate >= startOfToday && entry.parsedDate < endOfToday
  ).length

  const totalWeeklyTarget = accountsData.reduce((sum, acc) => sum + (acc.weeklyTarget || 0), 0)
  const totalMonthlyTarget = accountsData.reduce((sum, acc) => sum + (acc.monthlyTarget || 0), 0)

  const channelBreakdown: Record<string, number> = {}
  leadsWithDates
    .filter((entry) => entry.parsedDate >= weekStart && entry.parsedDate < weekEnd)
    .forEach((entry) => {
      const channel = entry.data['Channel of Lead'] || entry.data['channel of lead'] || 'Unknown'
      channelBreakdown[channel] = (channelBreakdown[channel] || 0) + 1
    })

  const teamBreakdown: Record<string, number> = {}
  leadsWithDates
    .filter((entry) => entry.parsedDate >= weekStart && entry.parsedDate < weekEnd)
    .forEach((entry) => {
      const member = entry.data['OD Team Member'] || entry.data['OD team member'] || 'Unknown'
      if (member && member.trim() && member !== 'Unknown') {
        teamBreakdown[member] = (teamBreakdown[member] || 0) + 1
      }
    })

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

  const weekProgress = totalWeeklyTarget > 0 ? (weekTotal / totalWeeklyTarget) * 100 : 0
  const isWeekOnTrack = weekTotal >= totalWeeklyTarget * 0.8
  const dailyTarget = Math.ceil(totalWeeklyTarget / 7)
  const currentMonth = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const weekNumber = Math.ceil((now.getDate() + startOfToday.getDay()) / 7)

  if (loading && leads.length === 0) {
    return (
      <Box textAlign="center" py={12}>
        <Spinner size="xl" color="brand.700" thickness="4px" />
        <Text mt={4} color="gray.600">
          Loading live lead performance...
        </Text>
      </Box>
    )
  }

  return (
    <VStack spacing={6} align="stretch">
      {/* Header Stats */}
      <Box bg="white" p={6} borderRadius="lg" shadow="sm" border="1px" borderColor="gray.200">
        <HStack justify="space-between" mb={4} flexWrap="wrap">
          <Heading size="lg" color="gray.700">
            Client Lead Generation Dashboard
          </Heading>
          <IconButton
            aria-label="Refresh"
            icon={<RepeatIcon />}
            onClick={() => refreshLeads(true)}
            isLoading={loading}
            colorScheme="blue"
            size="sm"
          />
        </HStack>

        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
          <Stat>
            <StatLabel>Total Leads This Week</StatLabel>
            <StatNumber fontSize="3xl" color="orange.500">
              {weekTotal}
            </StatNumber>
            <StatHelpText>Week {weekNumber} Target: {totalWeeklyTarget}</StatHelpText>
          </Stat>

          <Stat>
            <StatLabel>Current Month</StatLabel>
            <StatNumber fontSize="2xl">{currentMonth}</StatNumber>
            <StatHelpText>Target: {totalMonthlyTarget}</StatHelpText>
          </Stat>

          <Stat>
            <StatLabel>Month-to-Date</StatLabel>
            <StatNumber fontSize="3xl" color="orange.500">
              {monthTotal}
            </StatNumber>
            <StatHelpText>
              {totalMonthlyTarget > 0 
                ? `${((monthTotal / totalMonthlyTarget) * 100).toFixed(1)}% of target`
                : 'No target set'}
            </StatHelpText>
          </Stat>
        </SimpleGrid>
      </Box>

      {/* Main Client Table */}
      <Box bg="white" borderRadius="lg" shadow="sm" border="1px" borderColor="gray.200" overflow="hidden">
        <Box overflowX="auto">
          <Table size="sm" variant="simple">
            <Thead bg="gray.100">
              <Tr>
                <Th>Client</Th>
                <Th isNumeric>Spend (£)</Th>
                <Th isNumeric>Current Week Actual</Th>
                <Th isNumeric>Current Week Target</Th>
                <Th isNumeric>Month Actual</Th>
                <Th isNumeric>Month Target</Th>
                <Th isNumeric>% of Target</Th>
                <Th textAlign="center">DEFCON</Th>
              </Tr>
            </Thead>
            <Tbody>
              {accountsWithPercentages.map((account) => (
                <Tr key={account.name} _hover={{ bg: 'gray.50' }}>
                  <Td fontWeight="medium">{account.name}</Td>
                  <Td isNumeric>{account.monthlySpendGBP.toLocaleString()}</Td>
                  <Td isNumeric>{account.weeklyActual || 0}</Td>
                  <Td isNumeric>{account.weeklyTarget || 0}</Td>
                  <Td isNumeric>{account.monthlyActual || 0}</Td>
                  <Td isNumeric>{account.monthlyTarget || 0}</Td>
                  <Td isNumeric>
                    <Text 
                      color={
                        account.monthlyPercentage >= 100 ? 'green.600' : 
                        account.monthlyPercentage >= 50 ? 'yellow.600' : 
                        'red.600'
                      }
                      fontWeight="semibold"
                    >
                      {account.monthlyPercentage.toFixed(1)}%
                    </Text>
                  </Td>
                  <Td textAlign="center">
                    <Badge
                      colorScheme={
                        account.defcon <= 2 ? 'red' : 
                        account.defcon === 3 ? 'yellow' : 
                        account.defcon >= 4 && account.defcon <= 5 ? 'green' : 
                        'blue'
                      }
                      fontSize="md"
                      px={3}
                      py={1}
                      borderRadius="md"
                    >
                      {account.defcon}
                    </Badge>
                  </Td>
                </Tr>
              ))}
              <Tr bg="gray.100" fontWeight="bold" fontSize="md">
                <Td>Totals ({accountsData.length} accounts)</Td>
                <Td isNumeric>{accountsData.reduce((sum, a) => sum + a.monthlySpendGBP, 0).toLocaleString()}</Td>
                <Td isNumeric>{accountsData.reduce((sum, a) => sum + (a.weeklyActual || 0), 0)}</Td>
                <Td isNumeric>{totalWeeklyTarget}</Td>
                <Td isNumeric>{accountsData.reduce((sum, a) => sum + (a.monthlyActual || 0), 0)}</Td>
                <Td isNumeric>{totalMonthlyTarget}</Td>
                <Td isNumeric>
                  {totalMonthlyTarget > 0 
                    ? ((monthTotal / totalMonthlyTarget) * 100).toFixed(1)
                    : '0.0'}%
                </Td>
                <Td></Td>
              </Tr>
            </Tbody>
          </Table>
        </Box>
      </Box>

      {/* Channel Breakdown & Progress */}
      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
        {/* Channel Breakdown */}
        <Box bg="white" p={6} borderRadius="lg" shadow="sm" border="1px" borderColor="gray.200">
          <Heading size="md" mb={4}>Channel</Heading>
          <VStack align="stretch" spacing={3}>
            {Object.entries(channelBreakdown)
              .sort((a, b) => b[1] - a[1])
              .map(([channel, count]) => (
                <HStack key={channel} justify="space-between">
                  <Text>{channel}</Text>
                  <Badge colorScheme="blue" fontSize="md" px={3}>
                    {count}
                  </Badge>
                </HStack>
              ))}
            {Object.keys(channelBreakdown).length === 0 && (
              <Text color="gray.400">No leads this week</Text>
            )}
          </VStack>

          <Box mt={6} p={4} bg="gray.50" borderRadius="md">
            <Text fontWeight="semibold" fontSize="lg" mb={2}>Month-to-Date</Text>
            <Text fontSize="3xl" fontWeight="bold" color="blue.600">{monthTotal}</Text>
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
        <Box bg="white" p={6} borderRadius="lg" shadow="sm" border="1px" borderColor="gray.200">
          <Heading size="md" mb={4} color="purple.700">INCH BY INCH</Heading>
          
          <Box mb={6}>
            <HStack justify="space-between" mb={2}>
              <Text fontWeight="semibold">This Week's Target</Text>
              <Badge 
                colorScheme={isWeekOnTrack ? 'green' : 'orange'} 
                fontSize="md" 
                px={3}
                py={1}
              >
                {isWeekOnTrack ? '✓ On Track' : '○ Behind'}
              </Badge>
            </HStack>
            <Text fontSize="4xl" fontWeight="bold" color="blue.600">{totalWeeklyTarget}</Text>
            <Progress 
              value={weekProgress} 
              colorScheme={weekProgress >= 80 ? 'green' : weekProgress >= 50 ? 'yellow' : 'red'}
              size="lg"
              borderRadius="md"
              mt={2}
              hasStripe
              isAnimated
            />
            <Text fontSize="sm" color="gray.600" mt={1}>{weekProgress.toFixed(0)}% Complete ({weekTotal}/{totalWeeklyTarget})</Text>
          </Box>

          <VStack align="stretch" spacing={3}>
            <HStack justify="space-between" p={3} bg="blue.50" borderRadius="md">
              <Text fontWeight="medium">Daily Target</Text>
              <Text fontSize="xl" fontWeight="bold">{dailyTarget}</Text>
            </HStack>
            
            <HStack justify="space-between" p={3} bg="green.50" borderRadius="md">
              <Text fontWeight="medium">Today's Leads</Text>
              <HStack>
                <Text fontSize="xl" fontWeight="bold">{todayTotal}</Text>
                {todayTotal >= dailyTarget ? (
                  <CheckCircleIcon color="green.500" />
                ) : (
                  <WarningIcon color="orange.500" />
                )}
              </HStack>
            </HStack>

            <HStack justify="space-between" p={3} bg="orange.50" borderRadius="md">
              <Text fontWeight="medium">Left to Go</Text>
              <Text fontSize="xl" fontWeight="bold" color="orange.600">
                {Math.max(0, totalWeeklyTarget - weekTotal)}
              </Text>
            </HStack>
          </VStack>
        </Box>
      </SimpleGrid>

      {/* Sales Leaderboard */}
      <Box bg="white" p={6} borderRadius="lg" shadow="sm" border="1px" borderColor="gray.200">
        <HStack justify="space-between" mb={4}>
          <Heading size="md" color="blue.700">Sales Leaderboard</Heading>
          <Badge colorScheme="blue" fontSize="md" px={3}>Current Week</Badge>
        </HStack>
        
        <Table size="sm" variant="simple">
          <Thead bg="blue.50">
            <Tr>
              <Th>Rank</Th>
              <Th>Salesperson</Th>
              <Th isNumeric>Leads</Th>
            </Tr>
          </Thead>
          <Tbody>
            {salesLeaderboard.map((entry, index) => (
              <Tr key={entry.name}>
                <Td>
                  <Badge
                    colorScheme={index === 0 ? 'yellow' : index === 1 ? 'gray' : index === 2 ? 'orange' : 'blue'}
                    fontSize="lg"
                    px={3}
                    py={1}
                  >
                    {index + 1}
                  </Badge>
                </Td>
                <Td fontWeight="medium" fontSize="md">{entry.name}</Td>
                <Td isNumeric fontSize="xl" fontWeight="bold" color="blue.600">{entry.leads}</Td>
              </Tr>
            ))}
            {salesLeaderboard.length === 0 && (
              <Tr>
                <Td colSpan={3} textAlign="center" color="gray.400" py={6}>
                  No leads recorded this week
                </Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </Box>

      <Text fontSize="xs" color="gray.400" textAlign="center">
        Last synced: {lastRefresh.toLocaleString('en-GB')} | Data from Google Sheets via automated sync
      </Text>
    </VStack>
  )
}
