/**
 * Reporting Dashboard — operator-grade analytics for ODCRM.
 * All metrics from backend truth (/api/reporting/*). No frontend-only calculations.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Heading,
  HStack,
  Select,
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
  VStack,
} from '@chakra-ui/react'
import { api } from '../../../utils/api'
import { useScopedCustomerSelection } from '../../../hooks/useCustomerScope'
import { normalizeCustomersListResponse } from '../../../utils/normalizeApiResponse'

type WindowDays = 7 | 30 | 90
type DashboardPeriodType = 'days' | 'week' | 'month'
type DashboardScope = 'single' | 'all'
type ScopeMeta = {
  customerId?: string
  customerCount?: number
  scope?: DashboardScope
  periodType?: DashboardPeriodType
  periodStart?: string
  periodEnd?: string
}

type SummaryData = ScopeMeta & {
  leadsCreated: number
  leadsTarget: number | null
  percentToTarget: number | null
  emailsSent: number
  delivered: number | null
  openRate: number | null
  replyRate: number | null
  replyCount: number
  positiveReplyCount: number | null
  meetingsBooked: number | null
  bounces: number
  unsubscribes: number
  suppressedEmails: number
  suppressedDomains: number
  sendFailures: number
}

type LeadsVsTargetData = ScopeMeta & {
  leadsCreated: number
  leadsTarget: number | null
  percentToTarget: number | null
  previousPeriodLeads: number
  trendVsPrevious: number | null
}

type LeadsBySourceRow = { source: string; count: number; percent: number }
type TopSourcerRow = { owner: string; count: number; percent: number }
type OutreachSequenceRow = {
  sequenceId: string
  sequenceName: string
  customerName?: string | null
  sent: number
  failed: number
  suppressed: number
  skipped: number
  replies: number
  optOuts: number
}
type OutreachIdentityRow = {
  identityId: string
  email: string | null
  name: string | null
  customerName?: string | null
  sent: number
  failed: number
  suppressed: number
  skipped: number
  replies: number
  optOuts: number
}
type FunnelData = ScopeMeta & {
  leadsCreated: number
  contacted: number
  replied: number
  positiveReplies: number | null
  converted: number
  byLeadStatus: Record<string, number>
}
type MailboxRow = {
  identityId: string
  email: string | null
  name: string | null
  customerName?: string | null
  sent: number
  delivered: number
  replied: number
  bounced: number
  optedOut: number
  failed: number
}
type ComplianceData = ScopeMeta & {
  suppressedEmails: number
  suppressedDomains: number
  unsubscribesInPeriod: number
  suppressionBlocksInPeriod: number
}
type TrendRow = { day: string; leads: number; sent: number; replied: number }
type CustomerOption = { id: string; name: string }

type RankedItem = {
  label: string
  value: number
  helper?: string
  color: string
}

type LaneItem = {
  label: string
  value: string
  helper: string
  tone: 'blue' | 'green' | 'orange' | 'red' | 'gray'
}

type AttentionItem = {
  title: string
  detail: string
  tone: LaneItem['tone']
}

const ALL_CLIENTS_VALUE = '__all_clients__'
const CHART_HEIGHT = 220
const CHART_WIDTH = 640
const CHART_PADDING = 20

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const escape = (v: string | number) => {
    const s = String(v)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const line = (row: (string | number)[]) => row.map(escape).join(',')
  const csv = [line(headers), ...rows.map((r) => line(r))].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function sanitizeFilePart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'dashboard'
}

function formatNumber(value: number | null | undefined): string {
  if (value == null) return 'Not available'
  return value.toLocaleString()
}

function formatPercent(value: number | null | undefined, fallback = 'Not available'): string {
  if (value == null) return fallback
  return `${value}%`
}

function formatDelta(value: number | null | undefined): string {
  if (value == null) return 'No previous-period baseline'
  return `${value >= 0 ? '+' : ''}${value.toLocaleString()} vs previous window`
}

function formatLastUpdated(value: string): string {
  if (!value) return 'Not refreshed yet'
  return new Date(value).toLocaleString()
}

function formatUtcDate(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return 'Invalid date'
  return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(date)
}

function getDefaultWeekStart(): string {
  const now = new Date()
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const day = todayUtc.getUTCDay()
  todayUtc.setUTCDate(todayUtc.getUTCDate() - (day === 0 ? 6 : day - 1))
  return todayUtc.toISOString().slice(0, 10)
}

function normalizeWeekStartValue(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return getDefaultWeekStart()
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return getDefaultWeekStart()
  const day = date.getUTCDay()
  date.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1))
  return date.toISOString().slice(0, 10)
}

function getWeekRange(weekStart: string): { start: string; end: string } {
  const start = normalizeWeekStartValue(weekStart)
  const endDate = new Date(`${start}T00:00:00Z`)
  endDate.setUTCDate(endDate.getUTCDate() + 6)
  return { start, end: endDate.toISOString().slice(0, 10) }
}

function getDefaultMonthValue(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

function getMonthRange(month: string): { start: string; end: string } {
  const safeMonth = /^\d{4}-\d{2}$/.test(month) ? month : getDefaultMonthValue()
  const startDate = new Date(`${safeMonth}-01T00:00:00Z`)
  const endDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 0, 0, 0, 0, 0))
  return {
    start: startDate.toISOString().slice(0, 10),
    end: endDate.toISOString().slice(0, 10),
  }
}

function formatPeriodRangeLabel(start: string, end: string): string {
  return `${formatUtcDate(start, { day: 'numeric', month: 'short' })} - ${formatUtcDate(end, { day: 'numeric', month: 'short', year: 'numeric' })}`
}

function formatMonthLabel(monthOrStart: string): string {
  const value = /^\d{4}-\d{2}$/.test(monthOrStart) ? `${monthOrStart}-01T00:00:00Z` : monthOrStart
  return formatUtcDate(value, { month: 'long', year: 'numeric' })
}

function statusTone(value: number, warnAt: number, criticalAt: number): LaneItem['tone'] {
  if (value >= criticalAt) return 'red'
  if (value >= warnAt) return 'orange'
  return value > 0 ? 'green' : 'gray'
}

function statusScheme(tone: LaneItem['tone']): string {
  switch (tone) {
    case 'green':
      return 'green'
    case 'orange':
      return 'orange'
    case 'red':
      return 'red'
    case 'blue':
      return 'blue'
    default:
      return 'gray'
  }
}

function trendPath(values: number[], height = CHART_HEIGHT, width = CHART_WIDTH): string {
  if (values.length === 0) return ''
  const max = Math.max(...values, 1)
  const usableWidth = width - CHART_PADDING * 2
  const usableHeight = height - CHART_PADDING * 2
  return values
    .map((value, index) => {
      const x = CHART_PADDING + (values.length === 1 ? usableWidth / 2 : (index / (values.length - 1)) * usableWidth)
      const y = height - CHART_PADDING - (value / max) * usableHeight
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')
}

function formatEntityLabel(label: string | null | undefined, customerName: string | null | undefined, aggregate: boolean): string {
  const cleanLabel = String(label || '').trim()
  const cleanCustomerName = String(customerName || '').trim()
  if (aggregate && cleanCustomerName && cleanLabel) return `${cleanCustomerName} · ${cleanLabel}`
  if (cleanLabel) return cleanLabel
  if (cleanCustomerName) return cleanCustomerName
  return 'Unknown'
}

function TrendChart({ rows }: { rows: TrendRow[] }) {
  const labels = rows.map((row) => row.day.slice(5))
  const leadValues = rows.map((row) => row.leads)
  const sentValues = rows.map((row) => row.sent)
  const replyValues = rows.map((row) => row.replied)
  const max = Math.max(...leadValues, ...sentValues, ...replyValues, 1)

  if (rows.length === 0) {
    return <Text color="gray.500">No trend data for this period.</Text>
  }

  return (
    <VStack align="stretch" spacing={3} data-testid="dashboard-trend-chart">
      <HStack spacing={4} flexWrap="wrap">
        <HStack spacing={2}>
          <Box w={3} h={3} borderRadius="full" bg="blue.400" />
          <Text fontSize="sm">Leads</Text>
        </HStack>
        <HStack spacing={2}>
          <Box w={3} h={3} borderRadius="full" bg="purple.400" />
          <Text fontSize="sm">Sends</Text>
        </HStack>
        <HStack spacing={2}>
          <Box w={3} h={3} borderRadius="full" bg="green.400" />
          <Text fontSize="sm">Replies</Text>
        </HStack>
      </HStack>
      <Box borderRadius="xl" bg="gray.900" px={4} py={4}>
        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} width="100%" height={CHART_HEIGHT} role="img" aria-label="Dashboard activity trend">
          {[0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = CHART_HEIGHT - CHART_PADDING - ratio * (CHART_HEIGHT - CHART_PADDING * 2)
            return <line key={ratio} x1={CHART_PADDING} y1={y} x2={CHART_WIDTH - CHART_PADDING} y2={y} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
          })}
          <path d={trendPath(sentValues)} fill="none" stroke="#9f7aea" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <path d={trendPath(leadValues)} fill="none" stroke="#63b3ed" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <path d={trendPath(replyValues)} fill="none" stroke="#68d391" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          {labels.map((label, index) => {
            const usableWidth = CHART_WIDTH - CHART_PADDING * 2
            const x = CHART_PADDING + (labels.length === 1 ? usableWidth / 2 : (index / (labels.length - 1)) * usableWidth)
            return (
              <text key={`${label}-${index}`} x={x} y={CHART_HEIGHT - 4} fill="rgba(255,255,255,0.72)" fontSize="12" textAnchor="middle">
                {label}
              </text>
            )
          })}
          <text x={CHART_WIDTH - CHART_PADDING} y={16} fill="rgba(255,255,255,0.72)" fontSize="12" textAnchor="end">
            Peak {max.toLocaleString()}
          </text>
        </svg>
      </Box>
    </VStack>
  )
}

function RankedBars({
  items,
  emptyMessage,
  testId,
}: {
  items: RankedItem[]
  emptyMessage: string
  testId?: string
}) {
  if (items.length === 0) {
    return <Text color="gray.500">{emptyMessage}</Text>
  }

  const max = Math.max(...items.map((item) => item.value), 1)

  return (
    <VStack align="stretch" spacing={3} data-testid={testId}>
      {items.map((item) => {
        const width = `${Math.max((item.value / max) * 100, item.value > 0 ? 8 : 0)}%`
        return (
          <Box key={item.label}>
            <HStack justify="space-between" mb={1}>
              <Text fontSize="sm" fontWeight="600" noOfLines={1}>
                {item.label}
              </Text>
              <Text fontSize="sm" color="gray.600">
                {item.value.toLocaleString()}
              </Text>
            </HStack>
            <Box h={2.5} bg="gray.100" borderRadius="full" overflow="hidden">
              <Box h="100%" w={width} bg={item.color} borderRadius="full" />
            </Box>
            {item.helper ? (
              <Text fontSize="xs" color="gray.500" mt={1}>
                {item.helper}
              </Text>
            ) : null}
          </Box>
        )
      })}
    </VStack>
  )
}

function LaneColumn({
  title,
  accent,
  items,
}: {
  title: string
  accent: string
  items: LaneItem[]
}) {
  return (
    <Card variant="outline" h="100%" bg="gray.50">
      <CardHeader pb={2}>
        <HStack justify="space-between">
          <Heading size="sm">{title}</Heading>
          <Box w={3} h={3} borderRadius="full" bg={accent} />
        </HStack>
      </CardHeader>
      <CardBody pt={0}>
        <VStack align="stretch" spacing={3}>
          {items.map((item) => (
            <Box key={`${title}-${item.label}`} borderWidth="1px" borderColor="gray.200" borderRadius="xl" bg="white" px={3} py={3}>
              <HStack justify="space-between" align="start">
                <VStack align="start" spacing={0.5}>
                  <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.08em" color="gray.500">
                    {item.label}
                  </Text>
                  <Text fontSize="xl" fontWeight="700">
                    {item.value}
                  </Text>
                </VStack>
                <Badge colorScheme={statusScheme(item.tone)} variant="subtle">
                  {item.tone === 'green' ? 'Healthy' : item.tone === 'orange' ? 'Watch' : item.tone === 'red' ? 'Action' : item.tone === 'blue' ? 'Info' : 'Baseline'}
                </Badge>
              </HStack>
              <Text fontSize="xs" color="gray.500" mt={2}>
                {item.helper}
              </Text>
            </Box>
          ))}
        </VStack>
      </CardBody>
    </Card>
  )
}

function FunnelPanel({ funnel }: { funnel: FunnelData | null }) {
  if (!funnel) {
    return <Text color="gray.500">No funnel data for this period.</Text>
  }

  const steps = [
    { label: 'Leads', value: funnel.leadsCreated, color: 'blue.500' },
    { label: 'Contacted', value: funnel.contacted, color: 'purple.500' },
    { label: 'Replies', value: funnel.replied, color: 'green.500' },
    { label: 'Positive', value: funnel.positiveReplies ?? 0, color: 'teal.500' },
    { label: 'Converted', value: funnel.converted, color: 'orange.500' },
  ]
  const max = Math.max(...steps.map((step) => step.value), 1)

  return (
    <VStack align="stretch" spacing={3} data-testid="dashboard-funnel-panel">
      {steps.map((step) => (
        <Box key={step.label}>
          <HStack justify="space-between" mb={1}>
            <Text fontWeight="600">{step.label}</Text>
            <Text color="gray.600">{step.value.toLocaleString()}</Text>
          </HStack>
          <Box h={10} bg="gray.100" borderRadius="xl" overflow="hidden">
            <Flex h="100%" align="center" px={3} borderRadius="xl" bg={step.color} w={`${Math.max((step.value / max) * 100, step.value > 0 ? 10 : 0)}%`}>
              <Text color="white" fontSize="sm" fontWeight="700">
                {step.value.toLocaleString()}
              </Text>
            </Flex>
          </Box>
        </Box>
      ))}
    </VStack>
  )
}

function OverviewStat({
  label,
  value,
  helper,
}: {
  label: string
  value: string
  helper: string
}) {
  return (
    <Box borderRadius="xl" bg="whiteAlpha.160" px={4} py={4} backdropFilter="blur(6px)">
      <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.08em" color="whiteAlpha.800">
        {label}
      </Text>
      <Text fontSize="2xl" fontWeight="700" color="white" mt={1}>
        {value}
      </Text>
      <Text fontSize="xs" color="whiteAlpha.800" mt={1}>
        {helper}
      </Text>
    </Box>
  )
}

function AttentionPanel({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return null
  }

  return (
    <Card variant="outline" bg="white">
      <CardHeader pb={2}>
        <Heading size="md">What matters now</Heading>
        <Text color="gray.600" fontSize="sm">
          High-signal operator guidance based on the selected scope and window.
        </Text>
      </CardHeader>
      <CardBody pt={0}>
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
          {items.map((item) => (
            <Box key={item.title} borderWidth="1px" borderColor="gray.200" borderRadius="xl" px={4} py={4} bg="gray.50">
              <HStack justify="space-between" align="start" mb={2}>
                <Text fontWeight="700">{item.title}</Text>
                <Badge colorScheme={statusScheme(item.tone)} variant="subtle">
                  {item.tone === 'red' ? 'Priority' : item.tone === 'orange' ? 'Watch' : item.tone === 'green' ? 'Healthy' : 'Info'}
                </Badge>
              </HStack>
              <Text fontSize="sm" color="gray.600">
                {item.detail}
              </Text>
            </Box>
          ))}
        </SimpleGrid>
      </CardBody>
    </Card>
  )
}

const ReportingDashboard: React.FC = () => {
  const {
    canSelectCustomer,
    customerId: scopedCustomerId,
    setCustomerId: setScopedCustomerId,
  } = useScopedCustomerSelection()
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [scopeSelection, setScopeSelection] = useState<string>(() => scopedCustomerId || '')
  const [windowDays, setWindowDays] = useState<WindowDays>(30)
  const [periodType, setPeriodType] = useState<DashboardPeriodType>('days')
  const [weekStart, setWeekStart] = useState<string>(() => getDefaultWeekStart())
  const [month, setMonth] = useState<string>(() => getDefaultMonthValue())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [leadsVsTarget, setLeadsVsTarget] = useState<LeadsVsTargetData | null>(null)
  const [leadsBySource, setLeadsBySource] = useState<LeadsBySourceRow[]>([])
  const [topSourcers, setTopSourcers] = useState<TopSourcerRow[]>([])
  const [outreach, setOutreach] = useState<{
    bySequence: OutreachSequenceRow[]
    byIdentity: OutreachIdentityRow[]
    totalSent: number
    totalReplies: number
    topSequence: OutreachSequenceRow | null
  } | null>(null)
  const [funnel, setFunnel] = useState<FunnelData | null>(null)
  const [mailboxes, setMailboxes] = useState<MailboxRow[]>([])
  const [compliance, setCompliance] = useState<ComplianceData | null>(null)
  const [trends, setTrends] = useState<TrendRow[]>([])
  const [lastUpdated, setLastUpdated] = useState<string>('')

  const isAllClientsScope = scopeSelection === ALL_CLIENTS_VALUE
  const effectiveCustomerId = isAllClientsScope ? '' : scopeSelection || scopedCustomerId || ''
  const currentScope: DashboardScope = isAllClientsScope ? 'all' : 'single'

  // CRITICAL FIX: Pass X-Customer-Id: 'all' when scope=all to prevent auto-injection of active client ID
  // This allows backend to distinguish intentional all-clients mode from accidental mixed scope
  const requestHeaders = useMemo(
    () => {
      if (isAllClientsScope) return { 'X-Customer-Id': 'all' }
      return effectiveCustomerId.startsWith('cust_') ? { 'X-Customer-Id': effectiveCustomerId } : undefined
    },
    [isAllClientsScope, effectiveCustomerId],
  )

  const loadCustomers = useCallback(async () => {
    const { data, error: apiError } = await api.get('/api/customers')
    if (apiError) {
      setCustomers([])
      return
    }
    try {
      const list = normalizeCustomersListResponse(data)
      const visibleCustomers = !canSelectCustomer && scopedCustomerId
        ? list.filter((customer) => customer.id === scopedCustomerId)
        : list
      setCustomers(visibleCustomers.map((customer) => ({ id: customer.id, name: customer.name })))
    } catch {
      setCustomers([])
    }
  }, [canSelectCustomer, scopedCustomerId])

  useEffect(() => {
    void loadCustomers()
  }, [loadCustomers])

  useEffect(() => {
    setScopeSelection((current) => (current === ALL_CLIENTS_VALUE ? current : scopedCustomerId || ''))
  }, [scopedCustomerId])

  const currentCustomerName = useMemo(
    () => customers.find((customer) => customer.id === effectiveCustomerId)?.name ?? '',
    [customers, effectiveCustomerId],
  )

  const includedCustomerCount = summary?.customerCount ?? (currentScope === 'all' ? customers.length : effectiveCustomerId ? 1 : 0)

  const buildRequestSuffix = useCallback((): string => {
    const params = new URLSearchParams()

    if (periodType === 'week') {
      params.append('periodType', 'week')
      params.append('weekStart', normalizeWeekStartValue(weekStart))
    } else if (periodType === 'month') {
      params.append('periodType', 'month')
      params.append('month', month)
    } else {
      params.append('sinceDays', String(windowDays))
    }

    if (currentScope === 'all') {
      params.append('scope', 'all')
    }

    return params.toString()
  }, [periodType, weekStart, month, windowDays, currentScope])

  const requestSuffix = buildRequestSuffix()

  const handleScopeSelectionChange = useCallback(
    (nextValue: string) => {
      setScopeSelection(nextValue)
      if (nextValue === ALL_CLIENTS_VALUE) return
      setScopedCustomerId(nextValue)
    },
    [setScopedCustomerId],
  )

  const clearData = useCallback(() => {
    setSummary(null)
    setLeadsVsTarget(null)
    setLeadsBySource([])
    setTopSourcers([])
    setOutreach(null)
    setFunnel(null)
    setMailboxes([])
    setCompliance(null)
    setTrends([])
  }, [])

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (currentScope === 'single' && !effectiveCustomerId.startsWith('cust_')) {
        clearData()
        setError(canSelectCustomer ? 'Select a client or choose All Clients to view the dashboard.' : 'Select an active client to view the dashboard.')
        setLoading(false)
        setRefreshing(false)
        return
      }

      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)
      const base = '/api/reporting'
      const opts = requestHeaders ? { headers: requestHeaders } : undefined

      try {
        const [summaryRes, leadsVsTargetRes, leadsBySourceRes, topSourcersRes, outreachRes, funnelRes, mailboxesRes, complianceRes, trendsRes] =
          await Promise.all([
            api.get<SummaryData>(`${base}/summary?${requestSuffix}`, opts),
            api.get<LeadsVsTargetData>(`${base}/leads-vs-target?${requestSuffix}`, opts),
            api.get<{ bySource: LeadsBySourceRow[] }>(`${base}/leads-by-source?${requestSuffix}`, opts),
            api.get<{ sourcers: TopSourcerRow[] }>(`${base}/top-sourcers?${requestSuffix}`, opts),
            api.get<{
              bySequence: OutreachSequenceRow[]
              byIdentity: OutreachIdentityRow[]
              totalSent: number
              totalReplies: number
              topSequence: OutreachSequenceRow | null
            }>(`${base}/outreach-performance?${requestSuffix}`, opts),
            api.get<FunnelData>(`${base}/funnel?${requestSuffix}`, opts),
            api.get<{ mailboxes: MailboxRow[] }>(`${base}/mailboxes?${requestSuffix}`, opts),
            api.get<ComplianceData>(`${base}/compliance?${requestSuffix}`, opts),
            api.get<{ trend: TrendRow[] }>(`${base}/trends?${requestSuffix}`, opts),
          ])

        const firstErr = [summaryRes, leadsVsTargetRes, leadsBySourceRes, topSourcersRes, outreachRes, funnelRes, mailboxesRes, complianceRes, trendsRes].find(
          (result) => result.error,
        )

        if (firstErr?.error) {
          clearData()
          setError(firstErr.error)
          return
        }

        setSummary(summaryRes.data ?? null)
        setLeadsVsTarget(leadsVsTargetRes.data ?? null)
        setLeadsBySource(leadsBySourceRes.data?.bySource ?? [])
        setTopSourcers(topSourcersRes.data?.sourcers ?? [])
        setOutreach(outreachRes.data ?? null)
        setFunnel(funnelRes.data ?? null)
        setMailboxes(mailboxesRes.data?.mailboxes ?? [])
        setCompliance(complianceRes.data ?? null)
        setTrends(trendsRes.data?.trend ?? [])
        setLastUpdated(new Date().toISOString())
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [canSelectCustomer, clearData, currentScope, effectiveCustomerId, requestHeaders, requestSuffix],
  )

  useEffect(() => {
    void loadData(false)
  }, [loadData])

  const selectedWeekRange = useMemo(() => getWeekRange(weekStart), [weekStart])
  const selectedMonthRange = useMemo(() => getMonthRange(month), [month])
  const appliedPeriodStart =
    summary?.periodStart ??
    leadsVsTarget?.periodStart ??
    (periodType === 'week'
      ? `${selectedWeekRange.start}T00:00:00.000Z`
      : periodType === 'month'
        ? `${selectedMonthRange.start}T00:00:00.000Z`
        : '')
  const appliedPeriodEnd =
    summary?.periodEnd ??
    leadsVsTarget?.periodEnd ??
    (periodType === 'week'
      ? `${selectedWeekRange.end}T23:59:59.999Z`
      : periodType === 'month'
        ? `${selectedMonthRange.end}T23:59:59.999Z`
        : '')
  const periodBadgeLabel = useMemo(() => {
    if (periodType === 'week') {
      const start = appliedPeriodStart || `${selectedWeekRange.start}T00:00:00.000Z`
      const end = appliedPeriodEnd || `${selectedWeekRange.end}T23:59:59.999Z`
      return `Week: ${formatPeriodRangeLabel(start, end)}`
    }
    if (periodType === 'month') {
      return `Month: ${formatMonthLabel(appliedPeriodStart || month)}`
    }
    return `Last ${windowDays} days`
  }, [appliedPeriodEnd, appliedPeriodStart, month, periodType, selectedWeekRange.end, selectedWeekRange.start, windowDays])
  const selectedPeriodDescription = useMemo(() => {
    if (periodType === 'week') {
      const start = appliedPeriodStart || `${selectedWeekRange.start}T00:00:00.000Z`
      const end = appliedPeriodEnd || `${selectedWeekRange.end}T23:59:59.999Z`
      return `the selected week (${formatPeriodRangeLabel(start, end)})`
    }
    if (periodType === 'month') {
      return `the selected month (${formatMonthLabel(appliedPeriodStart || month)})`
    }
    return `the last ${windowDays} days`
  }, [appliedPeriodEnd, appliedPeriodStart, month, periodType, selectedWeekRange.end, selectedWeekRange.start, windowDays])
  const leadsVolumeLabel = useMemo(() => {
    if (periodType === 'week') return `Week of ${formatPeriodRangeLabel(appliedPeriodStart, appliedPeriodEnd)}`
    if (periodType === 'month') return `Month of ${formatMonthLabel(appliedPeriodStart || month)}`
    return `${windowDays}-day`
  }, [appliedPeriodEnd, appliedPeriodStart, month, periodType, windowDays])
  const exportPeriodSuffix = useMemo(() => {
    if (periodType === 'week') return `week-${selectedWeekRange.start}`
    if (periodType === 'month') return `month-${month}`
    return `${windowDays}d`
  }, [month, periodType, selectedWeekRange.start, windowDays])
  const exportPrefix = useMemo(() => {
    const scopePrefix = currentScope === 'all' ? 'all-clients' : sanitizeFilePart(currentCustomerName || effectiveCustomerId || 'client')
    return `${scopePrefix}-${exportPeriodSuffix}`
  }, [currentCustomerName, currentScope, effectiveCustomerId, exportPeriodSuffix])

  const exportLeadsBySourceCsv = useCallback(() => {
    downloadCsv(
      `leads-by-source-${exportPrefix}.csv`,
      ['Source', 'Count', 'Percent'],
      leadsBySource.map((row) => [row.source, row.count, `${row.percent}%`]),
    )
  }, [exportPrefix, leadsBySource])

  const exportTopSourcersCsv = useCallback(() => {
    downloadCsv(
      `top-sourcers-${exportPrefix}.csv`,
      ['Owner', 'Leads', 'Percent'],
      topSourcers.map((row) => [row.owner, row.count, `${row.percent}%`]),
    )
  }, [exportPrefix, topSourcers])

  const exportOutreachCsv = useCallback(() => {
    if (!outreach?.bySequence.length) return
    downloadCsv(
      `outreach-by-sequence-${exportPrefix}.csv`,
      ['Sequence', 'Customer', 'Sent', 'Failed', 'Suppressed', 'Replies', 'Opt-outs'],
      outreach.bySequence.map((row) => [row.sequenceName, row.customerName ?? '', row.sent, row.failed, row.suppressed, row.replies, row.optOuts]),
    )
  }, [exportPrefix, outreach])

  const topSources = useMemo<RankedItem[]>(
    () =>
      leadsBySource.slice(0, 6).map((row) => ({
        label: row.source,
        value: row.count,
        helper: `${row.percent}% of sourced leads`,
        color: '#4299e1',
      })),
    [leadsBySource],
  )

  const topOperators = useMemo<RankedItem[]>(
    () =>
      topSourcers.slice(0, 6).map((row) => ({
        label: row.owner,
        value: row.count,
        helper: `${row.percent}% of lead creation`,
        color: '#805ad5',
      })),
    [topSourcers],
  )

  const topMailboxes = useMemo<RankedItem[]>(
    () =>
      mailboxes.slice(0, 6).map((row) => ({
        label: formatEntityLabel(row.name || row.email || row.identityId, row.customerName, currentScope === 'all'),
        value: row.sent,
        helper: `${row.replied} replies · ${row.failed + row.bounced + row.optedOut} risk signals`,
        color: '#38a169',
      })),
    [currentScope, mailboxes],
  )

  const topSequences = useMemo<RankedItem[]>(
    () =>
      (outreach?.bySequence ?? []).slice(0, 6).map((row) => ({
        label: formatEntityLabel(row.sequenceName, row.customerName, currentScope === 'all'),
        value: row.sent,
        helper: `${row.replies} replies · ${row.optOuts} opt-outs · ${row.failed + row.suppressed} blocked/fail`,
        color: '#dd6b20',
      })),
    [currentScope, outreach],
  )

  const recentTrends = useMemo(() => trends.slice(-Math.min(trends.length, 14)), [trends])
  const riskSignals = (summary?.bounces ?? 0) + (summary?.unsubscribes ?? 0) + (summary?.sendFailures ?? 0)
  const targetPercent = leadsVsTarget?.percentToTarget ?? summary?.percentToTarget ?? null
  const topSequence = outreach?.topSequence
  const replyLeader = mailboxes[0] ?? null
  const topStatus = funnel ? Object.entries(funnel.byLeadStatus).sort((a, b) => b[1] - a[1])[0] : null
  const noTargetsSet = summary?.leadsTarget === 0 && currentScope === 'all'

  const scopeBadgeLabel = currentScope === 'all' ? 'All Clients' : currentCustomerName || 'Single Client'
  const heroTitle = currentScope === 'all'
    ? 'Combined operator view across all accessible clients'
    : 'Operator command view for truthful pipeline, outreach, and compliance'
  const heroDescription = currentScope === 'all'
    ? `Combined reporting across ${includedCustomerCount} accessible clients. Totals, rankings, and trends are aggregated from the same backend truth used in single-client mode.`
    : `Use this surface to monitor lead creation, outreach throughput, reply momentum, conversion movement, and risk signals for ${currentCustomerName || 'the selected client'}.`

  const attentionItems = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = []
    items.push({
      title: currentScope === 'all' ? 'Scope confirmation' : 'Active client focus',
      detail: currentScope === 'all'
        ? `You are viewing combined totals across ${includedCustomerCount} active clients.`
        : `You are viewing single-client truth for ${currentCustomerName || 'the selected client'}.`,
      tone: 'blue',
    })
    items.push({
      title: 'Target pacing',
      detail: noTargetsSet
        ? 'No client targets are set in the selected aggregate scope.'
        : targetPercent == null
          ? 'Target progress is unavailable until a valid lead target exists.'
          : `${targetPercent}% to target. ${formatDelta(leadsVsTarget?.trendVsPrevious)}`,
      tone: targetPercent == null ? 'gray' : targetPercent >= 100 ? 'green' : targetPercent >= 70 ? 'orange' : 'red',
    })
    items.push({
      title: 'Risk watch',
      detail: `${formatNumber(summary?.unsubscribes)} opt-outs, ${formatNumber(summary?.sendFailures)} failures, and ${formatNumber(summary?.bounces)} bounces in ${selectedPeriodDescription}.`,
      tone: statusTone(riskSignals, 1, 5),
    })
    return items
  }, [
    currentCustomerName,
    currentScope,
    includedCustomerCount,
    leadsVsTarget?.trendVsPrevious,
    noTargetsSet,
    riskSignals,
    summary?.bounces,
    summary?.sendFailures,
    summary?.unsubscribes,
    targetPercent,
    selectedPeriodDescription,
  ])

  const lanes = useMemo(
    () => [
      {
        title: 'Leads',
        accent: 'blue.400',
        items: [
          {
            label: 'Created',
            value: formatNumber(summary?.leadsCreated),
            helper: currentScope === 'all' ? `${leadsVolumeLabel} sourced lead volume across all included clients` : `${leadsVolumeLabel} sourced lead volume`,
            tone: 'blue' as const,
          },
          {
            label: 'Target progress',
            value: noTargetsSet ? 'No targets set' : targetPercent != null ? `${targetPercent}%` : 'No target',
            helper: noTargetsSet
              ? 'Aggregate targets sum all valid client targets and ignore missing values.'
              : targetPercent != null
                ? formatDelta(leadsVsTarget?.trendVsPrevious)
                : 'Set a lead target to unlock pacing',
            tone: targetPercent == null ? 'gray' : targetPercent >= 100 ? 'green' : targetPercent >= 70 ? 'orange' : 'red',
          },
          {
            label: 'Top source',
            value: topSources[0] ? `${topSources[0].label} (${topSources[0].value})` : 'No source data',
            helper: topSources[0]?.helper ?? 'Awaiting new lead creation',
            tone: topSources[0] ? 'blue' : 'gray',
          },
        ],
      },
      {
        title: 'Outreach',
        accent: 'purple.400',
        items: [
          {
            label: 'Sends',
            value: formatNumber(summary?.emailsSent),
            helper: topSequence
              ? `${formatEntityLabel(topSequence.sequenceName, topSequence.customerName, currentScope === 'all')} leads sequence output`
              : 'No sequence activity yet',
            tone: (summary?.emailsSent ?? 0) > 0 ? 'green' : 'gray',
          },
          {
            label: 'Delivered',
            value: formatNumber(summary?.delivered),
            helper: `Delivery view for ${selectedPeriodDescription}`,
            tone: (summary?.delivered ?? 0) > 0 ? 'blue' : 'gray',
          },
          {
            label: 'Top sequence',
            value: topSequence ? formatEntityLabel(topSequence.sequenceName, topSequence.customerName, currentScope === 'all') : 'No sequence data',
            helper: topSequence ? `${topSequence.sent} sent · ${topSequence.replies} replies` : 'Sequence runs have not generated recent sends',
            tone: topSequence ? 'blue' : 'gray',
          },
        ],
      },
      {
        title: 'Replies',
        accent: 'green.400',
        items: [
          {
            label: 'Reply rate',
            value: formatPercent(summary?.replyRate, 'No reply rate'),
            helper: `${formatNumber(summary?.replyCount)} total replies`,
            tone: (summary?.replyRate ?? 0) >= 5 ? 'green' : (summary?.replyRate ?? 0) > 0 ? 'orange' : 'gray',
          },
          {
            label: 'Positive replies',
            value: formatNumber(summary?.positiveReplyCount),
            helper: 'Only shown when the backend can classify reply intent',
            tone: summary?.positiveReplyCount != null ? 'blue' : 'gray',
          },
          {
            label: 'Leading mailbox',
            value: replyLeader
              ? formatEntityLabel(replyLeader.name || replyLeader.email || 'Mailbox', replyLeader.customerName, currentScope === 'all')
              : 'No mailbox activity',
            helper: replyLeader ? `${replyLeader.replied} replies from ${replyLeader.sent} sends` : 'No reply-producing mailbox this window',
            tone: replyLeader ? 'green' : 'gray',
          },
        ],
      },
      {
        title: 'Conversions',
        accent: 'orange.400',
        items: [
          {
            label: 'Contacted',
            value: formatNumber(funnel?.contacted),
            helper: 'Contacts reached via send queue truth',
            tone: (funnel?.contacted ?? 0) > 0 ? 'blue' : 'gray',
          },
          {
            label: 'Converted',
            value: formatNumber(funnel?.converted),
            helper: topStatus ? `Largest lead status: ${topStatus[0]} (${topStatus[1]})` : 'No pipeline status mix yet',
            tone: (funnel?.converted ?? 0) > 0 ? 'green' : 'gray',
          },
          {
            label: 'Meetings booked',
            value: formatNumber(summary?.meetingsBooked),
            helper: 'Shown when the backend truth surface exposes meeting booking data',
            tone: summary?.meetingsBooked != null ? 'blue' : 'gray',
          },
        ],
      },
      {
        title: 'Risk / Compliance',
        accent: 'red.400',
        items: [
          {
            label: 'Risk signals',
            value: formatNumber(riskSignals),
            helper: `${formatNumber(summary?.bounces)} bounces · ${formatNumber(summary?.sendFailures)} failures · ${formatNumber(summary?.unsubscribes)} opt-outs`,
            tone: statusTone(riskSignals, 1, 5),
          },
          {
            label: 'Suppressions',
            value: formatNumber((compliance?.suppressedEmails ?? 0) + (compliance?.suppressedDomains ?? 0)),
            helper: `${formatNumber(compliance?.suppressedEmails)} emails · ${formatNumber(compliance?.suppressedDomains)} domains`,
            tone: statusTone((compliance?.suppressedEmails ?? 0) + (compliance?.suppressedDomains ?? 0), 10, 30),
          },
          {
            label: 'Blocked sends',
            value: formatNumber(compliance?.suppressionBlocksInPeriod),
            helper: `${formatNumber(compliance?.unsubscribesInPeriod)} opt-outs in this window`,
            tone: statusTone(compliance?.suppressionBlocksInPeriod ?? 0, 1, 10),
          },
        ],
      },
    ],
    [
      compliance?.suppressedDomains,
      compliance?.suppressedEmails,
      compliance?.suppressionBlocksInPeriod,
      compliance?.unsubscribesInPeriod,
      currentScope,
      funnel?.contacted,
      funnel?.converted,
      leadsVsTarget?.trendVsPrevious,
      noTargetsSet,
      replyLeader,
      riskSignals,
      summary?.bounces,
      summary?.delivered,
      summary?.emailsSent,
      summary?.leadsCreated,
      summary?.meetingsBooked,
      summary?.positiveReplyCount,
      summary?.replyCount,
      summary?.replyRate,
      summary?.sendFailures,
      summary?.unsubscribes,
      targetPercent,
      topSequence,
      topSources,
      topStatus,
      leadsVolumeLabel,
      selectedPeriodDescription,
    ],
  )

  if (currentScope === 'single' && !effectiveCustomerId.startsWith('cust_')) {
    return (
      <VStack align="stretch" spacing={6} id="reporting-dashboard">
        <Alert status="info">
          <AlertIcon />
          <AlertDescription>
            All dashboard numbers come from backend truth. Choose a client to open the single-client view{canSelectCustomer ? ' or switch to All Clients for combined totals.' : '.'}
          </AlertDescription>
        </Alert>

        <Card variant="outline">
          <CardHeader pb={2}>
            <Heading size="md">Choose a reporting scope</Heading>
            <Text color="gray.600" fontSize="sm">
              Dashboard stays explicit: no client is selected yet, so no aggregate or single-client numbers are being inferred.
            </Text>
          </CardHeader>
          <CardBody pt={0}>
            <Stack direction={{ base: 'column', md: 'row' }} spacing={3}>
              <Select
                size="sm"
                value={scopeSelection}
                onChange={(event) => handleScopeSelectionChange(event.target.value)}
                minW="260px"
                isDisabled={!canSelectCustomer && !scopedCustomerId}
              >
                <option value="">Select client</option>
                {canSelectCustomer ? <option value={ALL_CLIENTS_VALUE}>All Clients</option> : null}
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </Select>
              <Select
                size="sm"
                value={String(windowDays)}
                onChange={(event) => setWindowDays(Number(event.target.value) as WindowDays)}
                minW="150px"
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </Select>
            </Stack>
          </CardBody>
        </Card>
      </VStack>
    )
  }

  return (
    <VStack align="stretch" spacing={6} id="reporting-dashboard">
      <Alert status="info">
        <AlertIcon />
        <AlertDescription>
          All dashboard numbers come from backend truth. Aggregate mode sums real customer data only for agency operators and is blocked in fixed-customer client mode.
        </AlertDescription>
      </Alert>

      <Box
        data-testid="dashboard-hero"
        borderRadius="2xl"
        bgGradient="linear(to-br, gray.900, blue.900, purple.800)"
        color="whiteAlpha.900"
        px={{ base: 5, md: 6 }}
        py={{ base: 5, md: 6 }}
      >
        <Stack direction={{ base: 'column', xl: 'row' }} spacing={6} justify="space-between">
          <VStack align="start" spacing={2} maxW="760px">
            <HStack spacing={2} flexWrap="wrap">
              <Badge colorScheme="whiteAlpha" variant="subtle">
                Dashboard
              </Badge>
              <Badge colorScheme="whiteAlpha" variant="outline" data-testid="dashboard-scope-badge">
                Scope: {scopeBadgeLabel}
              </Badge>
              <Badge colorScheme="whiteAlpha" variant="outline">
                {periodBadgeLabel}
              </Badge>
            </HStack>
            <Heading size="lg" fontWeight="700" color="yellow.300">{heroTitle}</Heading>
            <Text color="yellow.100" maxW="2xl" fontSize="md" lineHeight="1.6">
              {heroDescription}
            </Text>
            <HStack spacing={3} flexWrap="wrap">
              <Badge colorScheme="whiteAlpha" variant="outline">
                Included clients: {includedCustomerCount.toLocaleString()}
              </Badge>
              <Badge colorScheme="whiteAlpha" variant="outline">
                Last updated: {formatLastUpdated(lastUpdated)}
              </Badge>
            </HStack>
          </VStack>

          <Stack direction={{ base: 'column', md: 'row' }} spacing={3} align="stretch">
            <Select
              size="sm"
              value={scopeSelection}
              onChange={(event) => handleScopeSelectionChange(event.target.value)}
              minW="260px"
              bg="white"
              color="gray.800"
              data-testid="dashboard-client-selector"
              isDisabled={!canSelectCustomer && !scopedCustomerId}
            >
              <option value="">Select client</option>
              {canSelectCustomer ? <option value={ALL_CLIENTS_VALUE}>All Clients</option> : null}
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </Select>
            <Select
              size="sm"
              value={periodType}
              onChange={(e) => {
                setPeriodType(e.target.value as DashboardPeriodType)
              }}
              minW="120px"
              bg="white"
              color="gray.800"
              title="Period type"
            >
              <option value="days">Days</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </Select>
            {periodType === 'days' && (
              <Select
                size="sm"
                value={String(windowDays)}
                onChange={(event) => setWindowDays(Number(event.target.value) as WindowDays)}
                minW="150px"
                bg="white"
                color="gray.800"
                title="Rolling day range"
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </Select>
            )}
            {periodType === 'week' && (
              <Box>
                <input
                  type="date"
                  value={weekStart}
                  onChange={(e) => setWeekStart(normalizeWeekStartValue(e.target.value))}
                  style={{
                    padding: '0.375rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #cbd5e0',
                    fontSize: '0.875rem',
                  }}
                  title="Week start date (Monday)"
                />
              </Box>
            )}
            {periodType === 'month' && (
              <Box>
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  style={{
                    padding: '0.375rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #cbd5e0',
                    fontSize: '0.875rem',
                  }}
                  title="Month selection"
                />
              </Box>
            )}
            <Button size="sm" onClick={() => void loadData(true)} isLoading={refreshing} colorScheme="blue">
              Refresh
            </Button>
          </Stack>
        </Stack>

        <SimpleGrid columns={{ base: 1, md: 2, xl: 7 }} spacing={3} mt={6}>
          <OverviewStat label="Leads created" value={formatNumber(summary?.leadsCreated)} helper={currentScope === 'all' ? `Aggregate lead records in ${selectedPeriodDescription}` : `Lead records created in ${selectedPeriodDescription}`} />
          <OverviewStat label="Target progress" value={noTargetsSet ? 'No targets set' : targetPercent != null ? `${targetPercent}%` : 'No target'} helper={noTargetsSet ? 'Aggregate targets sum valid client targets only' : formatDelta(leadsVsTarget?.trendVsPrevious)} />
          <OverviewStat label="Emails sent" value={formatNumber(summary?.emailsSent)} helper={`${formatNumber(summary?.delivered)} delivered`} />
          <OverviewStat label="Replies" value={formatNumber(summary?.replyCount)} helper={formatPercent(summary?.replyRate, 'No reply rate')} />
          <OverviewStat label="Converted" value={formatNumber(funnel?.converted)} helper={`${formatNumber(funnel?.contacted)} contacted`} />
          <OverviewStat label="Risk signals" value={formatNumber(riskSignals)} helper={`${formatNumber(summary?.unsubscribes)} opt-outs + failures + bounces`} />
          <OverviewStat label="Included clients" value={formatNumber(includedCustomerCount)} helper={currentScope === 'all' ? 'Non-archived accessible clients in aggregate scope' : 'Single-client truth surface'} />
        </SimpleGrid>
      </Box>

      {error ? (
        <Alert status="error">
          <AlertIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <AttentionPanel items={attentionItems} />

      {loading ? (
        <Card>
          <CardBody>
            <HStack>
              <Spinner size="sm" />
              <Text>Loading dashboard…</Text>
            </HStack>
          </CardBody>
        </Card>
      ) : (
        <>
          <SimpleGrid columns={{ base: 1, xl: 4 }} spacing={6}>
            <Card variant="outline" gridColumn={{ xl: 'span 3' }}>
              <CardHeader pb={2}>
                <Heading size="md">Activity trend</Heading>
                <Text color="gray.600" fontSize="sm">
                  Leads, sends, and replies inside {selectedPeriodDescription}.
                </Text>
              </CardHeader>
              <CardBody pt={0}>
                <TrendChart rows={recentTrends} />
              </CardBody>
            </Card>

            <Card variant="outline">
              <CardHeader pb={2}>
                <HStack justify="space-between">
                  <Box>
                    <Heading size="md">Source mix</Heading>
                    <Text color="gray.600" fontSize="sm">
                      Contribution by lead source.
                    </Text>
                  </Box>
                  {leadsBySource.length > 0 ? (
                    <Button size="xs" variant="outline" onClick={exportLeadsBySourceCsv}>
                      Export CSV
                    </Button>
                  ) : null}
                </HStack>
              </CardHeader>
              <CardBody pt={0}>
                <RankedBars items={topSources} emptyMessage="No leads in this period." testId="dashboard-source-mix-chart" />
              </CardBody>
            </Card>
          </SimpleGrid>

          <Box data-testid="dashboard-kanban-board">
            <HStack justify="space-between" mb={3} flexWrap="wrap">
              <Box>
                <Heading size="md">Performance lanes</Heading>
                <Text color="gray.600" fontSize="sm">
                  Each lane summarizes what operators should watch right now in {currentScope === 'all' ? 'aggregate mode' : 'single-client mode'} for {selectedPeriodDescription}.
                </Text>
              </Box>
            </HStack>
            <SimpleGrid columns={{ base: 1, md: 2, xl: 5 }} spacing={4}>
              {lanes.map((lane) => (
                <LaneColumn key={lane.title} title={lane.title} accent={lane.accent} items={lane.items} />
              ))}
            </SimpleGrid>
          </Box>

          <SimpleGrid columns={{ base: 1, xl: 3 }} spacing={6} data-testid="dashboard-team-performance">
            <Card variant="outline">
              <CardHeader pb={2}>
                <HStack justify="space-between">
                  <Box>
                    <Heading size="md">Top sourcers</Heading>
                    <Text color="gray.600" fontSize="sm">
                      Operators ranked by lead creation.
                    </Text>
                  </Box>
                  {topSourcers.length > 0 ? (
                    <Button size="xs" variant="outline" onClick={exportTopSourcersCsv}>
                      Export CSV
                    </Button>
                  ) : null}
                </HStack>
              </CardHeader>
              <CardBody pt={0}>
                <RankedBars items={topOperators} emptyMessage="No lead ownership data in this period." />
              </CardBody>
            </Card>

            <Card variant="outline">
              <CardHeader pb={2}>
                <Heading size="md">Mailbox output</Heading>
                <Text color="gray.600" fontSize="sm">
                  Highest sending mailboxes with reply context.
                </Text>
              </CardHeader>
              <CardBody pt={0}>
                <RankedBars items={topMailboxes} emptyMessage="No mailbox activity in this period." />
              </CardBody>
            </Card>

            <Card variant="outline">
              <CardHeader pb={2}>
                <Heading size="md">Outreach pulse</Heading>
                <Text color="gray.600" fontSize="sm">
                  Sequence performance by recent send volume.
                </Text>
              </CardHeader>
              <CardBody pt={0}>
                <RankedBars items={topSequences} emptyMessage="No sequence activity in this period." />
              </CardBody>
            </Card>
          </SimpleGrid>

          <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={6} data-testid="dashboard-operational-health">
            <Card variant="outline">
              <CardHeader pb={2}>
                <Heading size="md">Operational health</Heading>
                <Text color="gray.600" fontSize="sm">
                  Compliance, suppression, and delivery pressure.
                </Text>
              </CardHeader>
              <CardBody pt={0}>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                  <Stat borderWidth="1px" borderColor="gray.100" borderRadius="xl" px={4} py={3}>
                    <StatLabel>Suppressed emails</StatLabel>
                    <StatNumber>{formatNumber(compliance?.suppressedEmails)}</StatNumber>
                    <StatHelpText mb={0}>Database suppression list truth</StatHelpText>
                  </Stat>
                  <Stat borderWidth="1px" borderColor="gray.100" borderRadius="xl" px={4} py={3}>
                    <StatLabel>Suppressed domains</StatLabel>
                    <StatNumber>{formatNumber(compliance?.suppressedDomains)}</StatNumber>
                    <StatHelpText mb={0}>Domain-level risk blocks</StatHelpText>
                  </Stat>
                  <Stat borderWidth="1px" borderColor="gray.100" borderRadius="xl" px={4} py={3}>
                    <StatLabel>Opt-outs in window</StatLabel>
                    <StatNumber>{formatNumber(compliance?.unsubscribesInPeriod)}</StatNumber>
                    <StatHelpText mb={0}>Counts both legacy and current opt-out events</StatHelpText>
                  </Stat>
                  <Stat borderWidth="1px" borderColor="gray.100" borderRadius="xl" px={4} py={3}>
                    <StatLabel>Suppression blocks</StatLabel>
                    <StatNumber>{formatNumber(compliance?.suppressionBlocksInPeriod)}</StatNumber>
                    <StatHelpText mb={0}>Send attempts blocked by suppressions</StatHelpText>
                  </Stat>
                </SimpleGrid>
              </CardBody>
            </Card>

            <Card variant="outline">
              <CardHeader pb={2}>
                <Heading size="md">Funnel / pipeline</Heading>
                <Text color="gray.600" fontSize="sm">
                  Visual progression from created leads to conversion.
                </Text>
              </CardHeader>
              <CardBody pt={0}>
                <FunnelPanel funnel={funnel} />
              </CardBody>
            </Card>
          </SimpleGrid>

          <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={6}>
            <Card variant="outline">
              <CardHeader pb={2}>
                <HStack justify="space-between">
                  <Box>
                    <Heading size="md">Sequence detail</Heading>
                    <Text color="gray.600" fontSize="sm">
                      Detailed outreach performance by sequence.
                    </Text>
                  </Box>
                  {outreach?.bySequence.length ? (
                    <Button size="xs" variant="outline" onClick={exportOutreachCsv}>
                      Export CSV
                    </Button>
                  ) : null}
                </HStack>
              </CardHeader>
              <CardBody pt={0}>
                {!outreach?.bySequence.length ? (
                  <Text color="gray.500">No sequence activity in this period.</Text>
                ) : (
                  <Table size="sm">
                    <Thead>
                      <Tr>
                        {currentScope === 'all' ? <Th>Client</Th> : null}
                        <Th>Sequence</Th>
                        <Th isNumeric>Sent</Th>
                        <Th isNumeric>Replies</Th>
                        <Th isNumeric>Opt-outs</Th>
                        <Th isNumeric>Failed</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {outreach.bySequence.slice(0, 10).map((row) => (
                        <Tr key={row.sequenceId}>
                          {currentScope === 'all' ? <Td>{row.customerName ?? 'Unknown client'}</Td> : null}
                          <Td>{row.sequenceName}</Td>
                          <Td isNumeric>{row.sent}</Td>
                          <Td isNumeric>{row.replies}</Td>
                          <Td isNumeric>{row.optOuts}</Td>
                          <Td isNumeric>{row.failed}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                )}
              </CardBody>
            </Card>

            <Card variant="outline">
              <CardHeader pb={2}>
                <Heading size="md">Mailbox detail</Heading>
                <Text color="gray.600" fontSize="sm">
                  Mailbox-level send and reply table for operators.
                </Text>
              </CardHeader>
              <CardBody pt={0}>
                {mailboxes.length === 0 ? (
                  <Text color="gray.500">No mailbox activity in this period.</Text>
                ) : (
                  <Table size="sm">
                    <Thead>
                      <Tr>
                        {currentScope === 'all' ? <Th>Client</Th> : null}
                        <Th>Mailbox</Th>
                        <Th isNumeric>Sent</Th>
                        <Th isNumeric>Replies</Th>
                        <Th isNumeric>Bounces</Th>
                        <Th isNumeric>Opt-outs</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {mailboxes.slice(0, 10).map((row) => (
                        <Tr key={row.identityId}>
                          {currentScope === 'all' ? <Td>{row.customerName ?? 'Unknown client'}</Td> : null}
                          <Td>{row.name || row.email || row.identityId}</Td>
                          <Td isNumeric>{row.sent}</Td>
                          <Td isNumeric>{row.replied}</Td>
                          <Td isNumeric>{row.bounced}</Td>
                          <Td isNumeric>{row.optedOut}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                )}
              </CardBody>
            </Card>
          </SimpleGrid>

          <Card variant="outline">
            <CardHeader pb={2}>
              <Heading size="md">Daily truth table</Heading>
              <Text color="gray.600" fontSize="sm">
                Raw day-by-day lead, send, and reply counts for {selectedPeriodDescription}.
              </Text>
            </CardHeader>
            <CardBody pt={0}>
              {trends.length === 0 ? (
                <Text color="gray.500">No trend data for this period.</Text>
              ) : (
                <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th>Day</Th>
                      <Th isNumeric>Leads</Th>
                      <Th isNumeric>Sends</Th>
                      <Th isNumeric>Replies</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {[...trends].reverse().slice(0, 30).map((row) => (
                      <Tr key={row.day}>
                        <Td>{row.day}</Td>
                        <Td isNumeric>{row.leads}</Td>
                        <Td isNumeric>{row.sent}</Td>
                        <Td isNumeric>{row.replied}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </VStack>
  )
}

export default ReportingDashboard
