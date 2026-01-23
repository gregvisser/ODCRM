import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Heading,
  HStack,
  Progress,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  IconButton,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  useToast,
} from '@chakra-ui/react'
import { RepeatIcon, CheckCircleIcon, WarningIcon } from '@chakra-ui/icons'
import { type Account } from '../../components/AccountsTab'
import { loadAccountsFromStorage, syncAccountLeadCountsFromLeads } from '../../utils/accountsLeadsSync'
import { fetchLeadsFromApi, persistLeadsToStorage } from '../../utils/leadsApi'
import { on } from '../../platform/events'
import { OdcrmStorageKeys } from '../../platform/keys'
import { getItem, getJson, setItem } from '../../platform/storage'

type Lead = {
  [key: string]: string
  accountName: string
}

const DEFCONColors: Record<number, string> = {
  1: 'red.500',
  2: 'red.400',
  3: 'yellow.400',
  4: 'green.400',
  5: 'green.500',
  6: 'blue.500',
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

export default function LeadGenerationDashboard() {
  const toast = useToast()
  const [accounts, setAccounts] = useState<Account[]>(() => loadAccountsFromStorage())
  const [leads, setLeads] = useState<Lead[]>(() => loadLeadsFromStorage())
  const [loading, setLoading] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(() => loadLastRefreshFromStorage() || new Date())

  const refreshLeads = useCallback(async () => {
    setLoading(true)
    try {
      const { leads: allLeads, lastSyncAt } = await fetchLeadsFromApi()
      persistLeadsToStorage(allLeads, lastSyncAt)
      setLeads(allLeads)
      setLastRefresh(lastSyncAt ? new Date(lastSyncAt) : new Date())
      syncAccountLeadCountsFromLeads(allLeads)
    } catch (err: any) {
      toast({
        title: 'Failed to refresh leads',
        description: err?.message || 'Unable to fetch lead data',
        status: 'error',
        duration: 4000,
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    const offAccountsUpdated = on('accountsUpdated', () => {
      setAccounts(loadAccountsFromStorage())
    })
    const offLeadsUpdated = on('leadsUpdated', () => {
      setLeads(loadLeadsFromStorage())
      setLastRefresh(loadLastRefreshFromStorage() || new Date())
    })

    return () => {
      offAccountsUpdated()
      offLeadsUpdated()
    }
  }, [])

  const analytics = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
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

    const totalWeeklyTarget = accounts.reduce((sum, acc) => sum + (acc.weeklyTarget || 0), 0)
    const totalMonthlyTarget = accounts.reduce((sum, acc) => sum + (acc.monthlyTarget || 0), 0)

    // Channel breakdown for the week
    const channelBreakdown: Record<string, number> = {}
    leadsWithDates
      .filter((entry) => entry.parsedDate >= weekStart && entry.parsedDate < weekEnd)
      .forEach((entry) => {
        const channel = entry.data['Channel of Lead'] || entry.data['channel of lead'] || 'Unknown'
        channelBreakdown[channel] = (channelBreakdown[channel] || 0) + 1
      })

    // Team member breakdown
    const teamBreakdown: Record<string, number> = {}
    leadsWithDates
      .filter((entry) => entry.parsedDate >= weekStart && entry.parsedDate < weekEnd)
      .forEach((entry) => {
        const member = entry.data['OD Team Member'] || entry.data['OD team member'] || 'Unknown'
        if (member && member.trim()) {
          teamBreakdown[member] = (teamBreakdown[member] || 0) + 1
        }
      })

    return {
      weekTotal,
      monthTotal,
      totalWeeklyTarget,
      totalMonthlyTarget,
      channelBreakdown,
      teamBreakdown,
      currentMonth: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      weekNumber: Math.ceil((now.getDate() + startOfToday.getDay()) / 7),
    }
  }, [accounts, leads])

  const accountsWithLeads = useMemo(() => {
    return accounts
      .map((account) => ({
        ...account,
        weeklyPercentage: account.weeklyTarget > 0 
          ? ((account.weeklyActual || 0) / account.weeklyTarget) * 100 
          : 0,
        monthlyPercentage: account.monthlyTarget > 0 
          ? ((account.monthlyActual || 0) / account.monthlyTarget) * 100 
          : 0,
      }))
      .sort((a, b) => b.monthlySpendGBP - a.monthlySpendGBP)
  }, [accounts])

  const salesLeaderboard = useMemo(() => {
    return Object.entries(analytics.teamBreakdown)
      .map(([name, leads]) => ({ name, leads }))
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 5)
  }, [analytics.teamBreakdown])

  const weekProgress = analytics.totalWeeklyTarget > 0 
    ? (analytics.weekTotal / analytics.totalWeeklyTarget) * 100 
    : 0

  const isWeekOnTrack = analytics.weekTotal >= analytics.totalWeeklyTarget * 0.8

  return (
    <VStack spacing={6} align="stretch">
      {/* Header Stats */}
      <Box bg="white" p={6} borderRadius="lg" shadow="sm" border="1px" borderColor="gray.200">
        <HStack justify="space-between" mb={4}>
          <Heading size="lg" color="gray.700">
            Client Lead Generation Dashboard
          </Heading>
          <IconButton
            aria-label="Refresh"
            icon={<RepeatIcon />}
            onClick={refreshLeads}
            isLoading={loading}
            colorScheme="blue"
            size="sm"
          />
        </HStack>

        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
          <Stat>
            <StatLabel>Total Leads This Week</StatLabel>
            <StatNumber fontSize="3xl" color="orange.500">
              {analytics.weekTotal}
            </StatNumber>
            <StatHelpText>Week {analytics.weekNumber} Target: {analytics.totalWeeklyTarget}</StatHelpText>
          </Stat>

          <Stat>
            <StatLabel>Current Month</StatLabel>
            <StatNumber fontSize="2xl">{analytics.currentMonth}</StatNumber>
            <StatHelpText>Target: {analytics.totalMonthlyTarget}</StatHelpText>
          </Stat>

          <Stat>
            <StatLabel>Month-to-Date</StatLabel>
            <StatNumber fontSize="3xl" color="orange.500">
              {analytics.monthTotal}
            </StatNumber>
            <StatHelpText>
              {analytics.totalMonthlyTarget > 0 
                ? `${((analytics.monthTotal / analytics.totalMonthlyTarget) * 100).toFixed(1)}% of target`
                : 'No target set'}
            </StatHelpText>
          </Stat>
        </SimpleGrid>
      </Box>

      {/* Main Table */}
      <Box bg="white" borderRadius="lg" shadow="sm" border="1px" borderColor="gray.200" overflow="hidden">
        <Box overflowX="auto">
          <Table size="sm" variant="simple">
            <Thead bg="gray.50">
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
              {accountsWithLeads.map((account) => (
                <Tr key={account.name} _hover={{ bg: 'gray.50' }}>
                  <Td fontWeight="medium">{account.name}</Td>
                  <Td isNumeric>{account.monthlySpendGBP.toLocaleString()}</Td>
                  <Td isNumeric>{account.weeklyActual || 0}</Td>
                  <Td isNumeric>{account.weeklyTarget || 0}</Td>
                  <Td isNumeric>{account.monthlyActual || 0}</Td>
                  <Td isNumeric>{account.monthlyTarget || 0}</Td>
                  <Td isNumeric>
                    <Text color={account.monthlyPercentage >= 100 ? 'green.600' : account.monthlyPercentage >= 50 ? 'yellow.600' : 'red.600'}>
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
                    >
                      {account.defcon}
                    </Badge>
                  </Td>
                </Tr>
              ))}
              <Tr bg="gray.100" fontWeight="bold">
                <Td>Totals ({accounts.length} accounts)</Td>
                <Td isNumeric>{accounts.reduce((sum, a) => sum + a.monthlySpendGBP, 0).toLocaleString()}</Td>
                <Td isNumeric>{accounts.reduce((sum, a) => sum + (a.weeklyActual || 0), 0)}</Td>
                <Td isNumeric>{analytics.totalWeeklyTarget}</Td>
                <Td isNumeric>{accounts.reduce((sum, a) => sum + (a.monthlyActual || 0), 0)}</Td>
                <Td isNumeric>{analytics.totalMonthlyTarget}</Td>
                <Td isNumeric>
                  {analytics.totalMonthlyTarget > 0 
                    ? ((analytics.monthTotal / analytics.totalMonthlyTarget) * 100).toFixed(1)
                    : 0}%
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
            {Object.entries(analytics.channelBreakdown)
              .sort((a, b) => b[1] - a[1])
              .map(([channel, count]) => (
                <HStack key={channel} justify="space-between">
                  <Text>{channel}</Text>
                  <Badge colorScheme="blue" fontSize="md" px={3}>
                    {count}
                  </Badge>
                </HStack>
              ))}
            {Object.keys(analytics.channelBreakdown).length === 0 && (
              <Text color="gray.400">No leads this week</Text>
            )}
          </VStack>

          <Box mt={6} p={4} bg="gray.50" borderRadius="md">
            <Text fontWeight="semibold" fontSize="lg" mb={2}>Month-to-Date</Text>
            <Text fontSize="3xl" fontWeight="bold" color="blue.600">{analytics.monthTotal}</Text>
            {Object.entries(analytics.channelBreakdown).map(([channel, count]) => {
              const percentage = analytics.monthTotal > 0 ? (count / analytics.monthTotal) * 100 : 0
              return (
                <HStack key={channel} justify="space-between" mt={2}>
                  <Text fontSize="sm">{channel}</Text>
                  <Text fontSize="sm" color="gray.600">{percentage.toFixed(0)}%</Text>
                </HStack>
              )
            })}
          </Box>
        </Box>

        {/* Week Progress */}
        <Box bg="white" p={6} borderRadius="lg" shadow="sm" border="1px" borderColor="gray.200">
          <Heading size="md" mb={4}>INCH BY INCH</Heading>
          
          <Box mb={6}>
            <HStack justify="space-between" mb={2}>
              <Text fontWeight="semibold">This Week's Target</Text>
              <Badge colorScheme={isWeekOnTrack ? 'green' : 'orange'} fontSize="md" px={3}>
                {isWeekOnTrack ? '✓ On Track' : '○ Behind'}
              </Badge>
            </HStack>
            <Text fontSize="4xl" fontWeight="bold" color="blue.600">{analytics.totalWeeklyTarget}</Text>
            <Progress 
              value={weekProgress} 
              colorScheme={weekProgress >= 80 ? 'green' : weekProgress >= 50 ? 'yellow' : 'red'}
              size="lg"
              borderRadius="md"
              mt={2}
            />
            <Text fontSize="sm" color="gray.600" mt={1}>{weekProgress.toFixed(0)}% Complete</Text>
          </Box>

          <VStack align="stretch" spacing={3}>
            <HStack justify="space-between" p={3} bg="blue.50" borderRadius="md">
              <Text fontWeight="medium">Daily Target</Text>
              <Text fontSize="xl" fontWeight="bold">{Math.ceil(analytics.totalWeeklyTarget / 7)}</Text>
            </HStack>
            
            <HStack justify="space-between" p={3} bg="green.50" borderRadius="md">
              <Text fontWeight="medium">Today's Leads</Text>
              <HStack>
                <Text fontSize="xl" fontWeight="bold">
                  {leadsWithDates.filter(
                    (entry) => entry.parsedDate >= startOfToday && entry.parsedDate < new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000)
                  ).length}
                </Text>
                {leadsWithDates.filter((entry) => entry.parsedDate >= startOfToday).length >= Math.ceil(analytics.totalWeeklyTarget / 7) ? (
                  <CheckCircleIcon color="green.500" />
                ) : (
                  <WarningIcon color="orange.500" />
                )}
              </HStack>
            </HStack>

            <HStack justify="space-between" p={3} bg="orange.50" borderRadius="md">
              <Text fontWeight="medium">Left to Go</Text>
              <Text fontSize="xl" fontWeight="bold" color="orange.600">
                {Math.max(0, analytics.totalWeeklyTarget - analytics.weekTotal)}
              </Text>
            </HStack>
          </VStack>
        </Box>
      </SimpleGrid>

      {/* Sales Leaderboard */}
      <Box bg="white" p={6} borderRadius="lg" shadow="sm" border="1px" borderColor="gray.200">
        <HStack justify="space-between" mb={4}>
          <Heading size="md">Sales Leaderboard</Heading>
          <Badge colorScheme="blue" fontSize="md">Current Week</Badge>
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
                    fontSize="md"
                  >
                    {index + 1}
                  </Badge>
                </Td>
                <Td fontWeight="medium">{entry.name}</Td>
                <Td isNumeric fontSize="lg" fontWeight="bold">{entry.leads}</Td>
              </Tr>
            ))}
            {salesLeaderboard.length === 0 && (
              <Tr>
                <Td colSpan={3} textAlign="center" color="gray.400">
                  No leads recorded this week
                </Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </Box>

      <Text fontSize="xs" color="gray.400" textAlign="center">
        Last synced: {lastRefresh.toLocaleString('en-GB')}
      </Text>
    </VStack>
  )
}
