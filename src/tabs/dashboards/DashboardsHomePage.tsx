import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Badge,
  Box,
  Heading,
  HStack,
  IconButton,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react'
import { RepeatIcon } from '@chakra-ui/icons'
import { accounts as defaultAccounts, type Account } from '../../components/AccountsTab'
import { syncAccountLeadCountsFromLeads } from '../../utils/accountsLeadsSync'
import { emit, on } from '../../platform/events'
import { OdcrmStorageKeys } from '../../platform/keys'
import { getItem, getJson, setItem, setJson } from '../../platform/storage'
import { api } from '../../utils/api'

type Lead = {
  [key: string]: string
  accountName: string
}

type CustomerApi = {
  id: string
  name: string
  domain?: string | null
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
  whatTheyDo: 'Information will be populated via AI research.',
  accreditations: 'Information will be populated via AI research.',
  keyLeaders: 'Information will be populated via AI research.',
  companyProfile: 'Information will be populated via AI research.',
  recentNews: 'Information will be populated via AI research.',
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

function normalizeName(value?: string | null): string {
  if (!value) return ''
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '')
}

function normalizeDomain(value?: string | null): string {
  if (!value) return ''
  try {
    const withScheme = value.startsWith('http') ? value : `https://${value}`
    const host = new URL(withScheme).hostname
    return host.replace(/^www\./, '').toLowerCase()
  } catch {
    return value.replace(/^https?:\/\//, '').replace(/^www\./, '').toLowerCase()
  }
}

function findCustomerForAccount(account: Account, customers: CustomerApi[]): CustomerApi | undefined {
  const accountKey = normalizeName(account.name)
  const accountDomain = normalizeDomain(account.website)

  return customers.find((customer) => {
    const customerKey = normalizeName(customer.name)
    const customerDomain = normalizeDomain(customer.domain ?? '')
    if (accountKey && customerKey && accountKey === customerKey) return true
    if (accountDomain && customerDomain && accountDomain === customerDomain) return true
    return false
  })
}

function buildAccountFromCustomer(customer: CustomerApi): Account {
  return {
    name: customer.name,
    website: normalizeCustomerWebsite(customer.domain),
    aboutSections: { ...DEFAULT_ABOUT_SECTIONS },
    sector: customer.sector || 'To be determined',
    socialMedia: [],
    status: mapClientStatusToAccountStatus(customer.clientStatus),
    targetLocation: customer.prospectingLocation ? [customer.prospectingLocation] : [],
    targetTitle: customer.targetJobTitle || '',
    monthlySpendGBP: Number(customer.monthlyIntakeGBP || 0),
    agreements: [],
    defcon: customer.defcon ?? 3,
    contractStart: '',
    contractEnd: '',
    days: 0,
    contacts: 0,
    leads: 0,
    weeklyTarget: customer.weeklyLeadTarget ?? 0,
    weeklyActual: customer.weeklyLeadActual ?? 0,
    monthlyTarget: customer.monthlyLeadTarget ?? 0,
    monthlyActual: customer.monthlyLeadActual ?? 0,
    weeklyReport: '',
    users: [],
    clientLeadsSheetUrl: customer.leadsReportingUrl || '',
  }
}

function mergeAccountFromCustomer(account: Account, customer: CustomerApi): Account {
  const updates: Partial<Account> = {}
  if (!account.clientLeadsSheetUrl && customer.leadsReportingUrl) {
    updates.clientLeadsSheetUrl = customer.leadsReportingUrl
  }
  if ((!account.sector || account.sector === 'To be determined') && customer.sector) {
    updates.sector = customer.sector
  }
  if ((!account.targetTitle || !account.targetTitle.trim()) && customer.targetJobTitle) {
    updates.targetTitle = customer.targetJobTitle
  }
  if ((account.targetLocation?.length ?? 0) === 0 && customer.prospectingLocation) {
    updates.targetLocation = [customer.prospectingLocation]
  }
  if ((!account.defcon || account.defcon === 0) && customer.defcon) {
    updates.defcon = customer.defcon
  }
  if ((!account.weeklyTarget || account.weeklyTarget === 0) && customer.weeklyLeadTarget) {
    updates.weeklyTarget = customer.weeklyLeadTarget
  }
  if ((!account.weeklyActual || account.weeklyActual === 0) && customer.weeklyLeadActual) {
    updates.weeklyActual = customer.weeklyLeadActual
  }
  if ((!account.monthlyTarget || account.monthlyTarget === 0) && customer.monthlyLeadTarget) {
    updates.monthlyTarget = customer.monthlyLeadTarget
  }
  if ((!account.monthlyActual || account.monthlyActual === 0) && customer.monthlyLeadActual) {
    updates.monthlyActual = customer.monthlyLeadActual
  }
  if ((!account.monthlySpendGBP || account.monthlySpendGBP === 0) && customer.monthlyIntakeGBP) {
    updates.monthlySpendGBP = Number(customer.monthlyIntakeGBP || 0)
  }
  if (!account.website && customer.domain) {
    updates.website = normalizeCustomerWebsite(customer.domain)
  }
  return Object.keys(updates).length ? { ...account, ...updates } : account
}

function loadAccountsFromStorage(): Account[] {
  const parsed = getJson<Account[]>(OdcrmStorageKeys.accounts)
  if (parsed && Array.isArray(parsed) && parsed.length > 0) return parsed
  return defaultAccounts
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

function extractSheetId(url: string): string | null {
  try {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

function extractGid(url: string): string | null {
  try {
    const gidMatch = url.match(/(?:[?&#])gid=(\d+)/i)
    return gidMatch ? gidMatch[1] : null
  } catch {
    return null
  }
}

function parseCsv(csvText: string): string[][] {
  const lines: string[][] = []
  let currentLine: string[] = []
  let currentField = ''
  let inQuotes = false

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i]
    const nextChar = csvText[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      currentLine.push(currentField.trim())
      currentField = ''
    } else if (char === '\n' && !inQuotes) {
      currentLine.push(currentField.trim())
      currentField = ''
      if (currentLine.length > 0) {
        lines.push(currentLine)
        currentLine = []
      }
    } else {
      currentField += char
    }
  }

  if (currentField || currentLine.length > 0) {
    currentLine.push(currentField.trim())
    lines.push(currentLine)
  }

  return lines
}

async function fetchLeadsFromSheet(sheetUrl: string, accountName: string): Promise<Lead[]> {
  const sheetId = extractSheetId(sheetUrl)
  if (!sheetId) {
    throw new Error('Invalid Google Sheets URL format')
  }

  const extractedGid = extractGid(sheetUrl)
  const gidsToTry = extractedGid ? [extractedGid, '0'] : ['0']
  let lastError: Error | null = null

  for (const gid of gidsToTry) {
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
      const response = await fetch(csvUrl, {
        mode: 'cors',
        headers: { Accept: 'text/csv, text/plain, */*' },
        credentials: 'omit',
      })

      if (!response.ok) {
        lastError = new Error(`Failed to fetch: ${response.status} ${response.statusText}`)
        continue
      }

      const csvText = await response.text()
      if (csvText.trim().startsWith('<!DOCTYPE') || csvText.trim().startsWith('<html')) {
        lastError = new Error('Received HTML instead of CSV. Check sheet sharing settings.')
        continue
      }

      const rows = parseCsv(csvText)
      if (rows.length < 2) return []

      const headers = rows[0].map((h) => h.trim())
      const leads: Lead[] = []

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        if (row.length === 0 || row.every((cell) => !cell || cell.trim() === '')) {
          continue
        }

        const lead: Lead = { accountName }
        headers.forEach((header, index) => {
          const value = row[index] || ''
          if (header) lead[header] = value
        })

        const containsWcOrWv = Object.values(lead).some((value) => {
          const lowerValue = value ? String(value).toLowerCase() : ''
          return lowerValue.includes('w/c') || lowerValue.includes('w/v')
        })
        if (containsWcOrWv) continue

        const nonEmptyFields = Object.keys(lead).filter(
          (key) => key !== 'accountName' && lead[key] && lead[key].trim() !== '',
        )
        if (nonEmptyFields.length >= 2) leads.push(lead)
      }

      return leads
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Failed to parse CSV data')
    }
  }

  throw lastError || new Error('Failed to fetch leads from Google Sheet')
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
  const hasSyncedCustomersRef = useRef(false)

  const refreshLeads = async (forceRefresh: boolean) => {
    if (!forceRefresh && !shouldRefresh(leads)) return

    setLoading(true)
    try {
      const accountsToUse = loadAccountsFromStorage()
      const allLeads: Lead[] = []
      const failedAccounts: string[] = []

      for (const account of accountsToUse) {
        if (!account.clientLeadsSheetUrl) continue
        try {
          const accountLeads = await fetchLeadsFromSheet(account.clientLeadsSheetUrl, account.name)
          allLeads.push(...accountLeads)
        } catch (err) {
          failedAccounts.push(account.name)
          console.warn(`Failed to load leads for ${account.name}:`, err)
        }
      }

      setJson(OdcrmStorageKeys.marketingLeads, allLeads)
      setItem(OdcrmStorageKeys.marketingLeadsLastRefresh, new Date().toISOString())
      setJson(OdcrmStorageKeys.leads, allLeads)
      setItem(OdcrmStorageKeys.leadsLastRefresh, new Date().toISOString())

      setLeads(allLeads)
      setLastRefresh(new Date())
      syncAccountLeadCountsFromLeads(allLeads)
      emit('leadsUpdated')

      if (failedAccounts.length > 0) {
        toast({
          title: `Some sheets failed (${failedAccounts.length})`,
          description: failedAccounts.join(', '),
          status: 'warning',
          duration: 6000,
          isClosable: true,
        })
      }
    } catch (err: any) {
      toast({
        title: 'Leads refresh failed',
        description: err?.message || 'Unable to refresh leads.',
        status: 'error',
        duration: 6000,
        isClosable: true,
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const syncFromCustomers = async () => {
      if (hasSyncedCustomersRef.current) return
      hasSyncedCustomersRef.current = true
      const { data, error } = await api.get<CustomerApi[]>('/api/customers')
      if (error || !data || data.length === 0) return

      const stored = loadAccountsFromStorage()
      const byName = new Map<string, Account>()
      stored.forEach((acc) => {
        byName.set(acc.name, acc)
        const normalized = normalizeName(acc.name)
        if (normalized) byName.set(normalized, acc)
      })
      let changed = false

      const merged = stored.map((acc) => {
        const customer = findCustomerForAccount(acc, data)
        if (!customer) return acc
        const updated = mergeAccountFromCustomer(acc, customer)
        if (updated !== acc) changed = true
        return updated
      })

      for (const customer of data) {
        const customerKey = normalizeName(customer.name)
        if (!byName.has(customer.name) && !byName.has(customerKey)) {
          merged.push(buildAccountFromCustomer(customer))
          changed = true
        }
      }

      if (changed) {
        setJson(OdcrmStorageKeys.accounts, merged)
        setItem(OdcrmStorageKeys.accountsLastUpdated, new Date().toISOString())
        setAccountsData(merged)
        emit('accountsUpdated', merged)
      }
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
  }, [])

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
    <Stack spacing={6}>
      <Box>
        <Heading size="lg" mb={2}>
          Dashboards
        </Heading>
        <Text color="gray.600">Live lead performance from your Google Sheets.</Text>
      </Box>

      <Box
        bg="bg.surface"
        borderRadius="lg"
        p={4}
        border="1px solid"
        borderColor="border.subtle"
        shadow="sm"
      >
        <HStack justify="space-between" mb={4} flexWrap="wrap" gap={3}>
          <Box>
            <Text fontSize="xs" textTransform="uppercase" color="gray.500" fontWeight="semibold">
              Unified Lead Performance
            </Text>
            <Heading size="md" color="gray.700">
              All Accounts Combined
            </Heading>
            <Text fontSize="xs" color="gray.500" mt={1}>
              Last refreshed: {lastRefresh.toLocaleString('en-GB')}
            </Text>
          </Box>
          <IconButton
            aria-label="Refresh leads data"
            icon={<RepeatIcon />}
            onClick={() => refreshLeads(true)}
            isLoading={loading}
            variant="ghost"
            colorScheme="gray"
            size="sm"
          />
        </HStack>
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
          {(['today', 'week', 'month'] as const).map((periodKey) => {
            const period = unifiedAnalytics.periodMetrics[periodKey]
            const variance = period.actual - period.target
            const allChannels = Object.keys(period.breakdown).sort(
              (a, b) => period.breakdown[b] - period.breakdown[a],
            )
            const allTeamMembers = Object.keys(period.teamBreakdown || {}).sort(
              (a, b) => (period.teamBreakdown?.[b] || 0) - (period.teamBreakdown?.[a] || 0),
            )
            return (
              <Box
                key={periodKey}
                border="1px solid"
                borderColor="border.subtle"
                borderRadius="lg"
                p={4}
                bg="bg.subtle"
                minH="280px"
              >
                <Text fontSize="xs" textTransform="uppercase" color="gray.500" fontWeight="semibold">
                  {period.label}
                </Text>
                <Heading size="2xl" mt={2} color="gray.800">
                  {period.actual}
                </Heading>
                <Text fontSize="sm" color="gray.600">
                  Actual Leads
                </Text>
                <Stack spacing={1} mt={3} fontSize="sm">
                  <Text color="gray.600">
                    Target Leads:{' '}
                    <Text as="span" fontWeight="semibold">
                      {period.target}
                    </Text>
                  </Text>
                  <Text color="text.muted">
                    Variance:{' '}
                    <Text as="span" fontWeight="semibold">
                      {variance > 0 ? '+' : ''}
                      {variance}
                    </Text>
                  </Text>
                </Stack>
                <Box mt={4}>
                  <Text fontSize="xs" textTransform="uppercase" color="gray.500" fontWeight="semibold" mb={2}>
                    Channels
                  </Text>
                  {allChannels.length > 0 ? (
                    <Stack spacing={1} maxH="120px" overflowY="auto">
                      {allChannels.map((channel) => (
                        <HStack key={channel} justify="space-between">
                          <Text fontSize="sm" color="gray.700" noOfLines={1}>
                            {channel}
                          </Text>
                          <Badge variant="subtle" colorScheme="gray" fontSize="xs">
                            {period.breakdown[channel]}
                          </Badge>
                        </HStack>
                      ))}
                    </Stack>
                  ) : (
                    <Text fontSize="sm" color="gray.400">
                      No leads recorded
                    </Text>
                  )}
                </Box>

                <Box mt={4}>
                  <Text fontSize="xs" textTransform="uppercase" color="gray.500" fontWeight="semibold" mb={2}>
                    OD Team
                  </Text>
                  {allTeamMembers.length > 0 ? (
                    <Stack spacing={1} maxH="120px" overflowY="auto">
                      {allTeamMembers.map((member) => (
                        <HStack key={member} justify="space-between">
                          <Text fontSize="sm" color="gray.700" noOfLines={1}>
                            {member}
                          </Text>
                          <Badge variant="subtle" colorScheme="gray" fontSize="xs">
                            {period.teamBreakdown?.[member] || 0}
                          </Badge>
                        </HStack>
                      ))}
                    </Stack>
                  ) : (
                    <Text fontSize="sm" color="gray.400">
                      No team members recorded
                    </Text>
                  )}
                </Box>
              </Box>
            )
          })}
        </SimpleGrid>
      </Box>
    </Stack>
  )
}
