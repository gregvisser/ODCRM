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
  Divider,
  Flex,
  Heading,
  HStack,
  Progress,
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
import { normalizeCustomersListResponse } from '../../../utils/normalizeApiResponse'
import { useScopedCustomerSelection } from '../../../hooks/useCustomerScope'
import RequireActiveClient from '../../../components/RequireActiveClient'

type WindowDays = 7 | 30 | 90

type SummaryData = {
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

type LeadsVsTargetData = {
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
  sent: number
  failed: number
  suppressed: number
  skipped: number
  replies: number
  optOuts: number
}
type FunnelData = {
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
  sent: number
  delivered: number
  replied: number
  bounced: number
  optedOut: number
  failed: number
}
type ComplianceData = {
  suppressedEmails: number
  suppressedDomains: number
  unsubscribesInPeriod: number
  suppressionBlocksInPeriod: number
}
type TrendRow = { day: string; leads: number; sent: number; replied: number }

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

function statusTone(value: number, warnAt: number, criticalAt: number): LaneItem['tone'] {
  if (value >= criticalAt) return 'red'
  if (value >= warnAt) return 'orange'
  return 'green'
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

function TrendChart({
  rows,
}: {
  rows: TrendRow[]
}) {
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
              <text key={label} x={x} y={CHART_HEIGHT - 4} fill="rgba(255,255,255,0.72)" fontSize="12" textAnchor="middle">
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

const ReportingDashboard: React.FC = () => {
  const {
    canSelectCustomer,
    customerHeaders,
    customerId: selectedCustomerId,
    setCustomerId: setSelectedCustomerId,
  } = useScopedCustomerSelection()
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([])
  const [windowDays, setWindowDays] = useState<WindowDays>(30)
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

  const loadCustomers = useCallback(async () => {
    const { data, error: apiError } = await api.get('/api/customers')
    if (apiError) {
      setCustomers([])
      return
    }
    try {
      const list = normalizeCustomersListResponse(data) as Array<{ id: string; name: string }>
      setCustomers(list)
    } catch {
      setCustomers([])
    }
  }, [])

  useEffect(() => {
    void loadCustomers()
  }, [loadCustomers])

  const loadData = useCallback(async (isRefresh = false) => {
    if (!selectedCustomerId?.startsWith('cust_')) {
      setError('Select an active client to view the dashboard.')
      return
    }
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    const sinceDays = windowDays
    const base = '/api/reporting'
    const opts = { headers: customerHeaders }
    try {
      const [summaryRes, leadsVsTargetRes, leadsBySourceRes, topSourcersRes, outreachRes, funnelRes, mailboxesRes, complianceRes, trendsRes] =
        await Promise.all([
          api.get<SummaryData>(`${base}/summary?sinceDays=${sinceDays}`, opts),
          api.get<LeadsVsTargetData>(`${base}/leads-vs-target?sinceDays=${sinceDays}`, opts),
          api.get<{ bySource: LeadsBySourceRow[] }>(`${base}/leads-by-source?sinceDays=${sinceDays}`, opts),
          api.get<{ sourcers: TopSourcerRow[] }>(`${base}/top-sourcers?sinceDays=${sinceDays}`, opts),
          api.get<{
            bySequence: OutreachSequenceRow[]
            byIdentity: OutreachIdentityRow[]
            totalSent: number
            totalReplies: number
            topSequence: OutreachSequenceRow | null
          }>(`${base}/outreach-performance?sinceDays=${sinceDays}`, opts),
          api.get<FunnelData>(`${base}/funnel?sinceDays=${sinceDays}`, opts),
          api.get<{ mailboxes: MailboxRow[] }>(`${base}/mailboxes?sinceDays=${sinceDays}`, opts),
          api.get<ComplianceData>(`${base}/compliance?sinceDays=${sinceDays}`, opts),
          api.get<{ trend: TrendRow[] }>(`${base}/trends?sinceDays=${sinceDays}`, opts),
        ])
      const firstErr = [summaryRes, leadsVsTargetRes, leadsBySourceRes, topSourcersRes, outreachRes, funnelRes, mailboxesRes, complianceRes, trendsRes].find(
        (r) => r.error,
      )
      if (firstErr?.error) {
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
  }, [selectedCustomerId, windowDays, customerHeaders])

  useEffect(() => {
    void loadData(false)
  }, [loadData])

  const exportLeadsBySourceCsv = useCallback(() => {
    downloadCsv(
      `leads-by-source-${windowDays}d.csv`,
      ['Source', 'Count', 'Percent'],
      leadsBySource.map((r) => [r.source, r.count, `${r.percent}%`]),
    )
  }, [leadsBySource, windowDays])

  const exportTopSourcersCsv = useCallback(() => {
    downloadCsv(
      `top-sourcers-${windowDays}d.csv`,
      ['Owner', 'Leads', 'Percent'],
      topSourcers.map((r) => [r.owner, r.count, `${r.percent}%`]),
    )
  }, [topSourcers, windowDays])

  const exportOutreachCsv = useCallback(() => {
    if (!outreach?.bySequence.length) return
    downloadCsv(
      `outreach-by-sequence-${windowDays}d.csv`,
      ['Sequence', 'Sent', 'Failed', 'Suppressed', 'Replies', 'Opt-outs'],
      outreach.bySequence.map((r) => [r.sequenceName, r.sent, r.failed, r.suppressed, r.replies, r.optOuts]),
    )
  }, [outreach, windowDays])

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
        label: row.name || row.email || row.identityId,
        value: row.sent,
        helper: `${row.replied} replies · ${row.failed + row.bounced + row.optedOut} risk signals`,
        color: '#38a169',
      })),
    [mailboxes],
  )

  const recentTrends = useMemo(() => trends.slice(-Math.min(trends.length, 14)), [trends])

  const riskSignals = (summary?.bounces ?? 0) + (summary?.unsubscribes ?? 0) + (summary?.sendFailures ?? 0)
  const targetPercent = leadsVsTarget?.percentToTarget ?? summary?.percentToTarget ?? null
  const topSequence = outreach?.topSequence
  const replyLeader = mailboxes[0] ?? null
  const topStatus = funnel ? Object.entries(funnel.byLeadStatus).sort((a, b) => b[1] - a[1])[0] : null

  const lanes = useMemo(
    () => [
      {
        title: 'Leads',
        accent: 'blue.400',
        items: [
          {
            label: 'Created',
            value: formatNumber(summary?.leadsCreated),
            helper: `${windowDays}-day sourced lead volume`,
            tone: 'blue' as const,
          },
          {
            label: 'Target progress',
            value: targetPercent != null ? `${targetPercent}%` : 'No target',
            helper: targetPercent != null ? formatDelta(leadsVsTarget?.trendVsPrevious) : 'Set a client target to unlock pacing',
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
            helper: topSequence ? `${topSequence.sequenceName} leads sequence output` : 'No sequence activity yet',
            tone: (summary?.emailsSent ?? 0) > 0 ? 'green' : 'gray',
          },
          {
            label: 'Delivered',
            value: formatNumber(summary?.delivered),
            helper: `Delivery view for ${windowDays} days`,
            tone: (summary?.delivered ?? 0) > 0 ? 'blue' : 'gray',
          },
          {
            label: 'Top sequence',
            value: topSequence ? `${topSequence.sequenceName}` : 'No sequence data',
            helper: topSequence ? `${topSequence.sent} sent · ${topSequence.replies} replies` : 'Sequence runs have not generated recent sends',
            tone: topSequence ? 'purple' as LaneItem['tone'] : 'gray',
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
            value: replyLeader ? `${replyLeader.name || replyLeader.email || 'Mailbox'}` : 'No mailbox activity',
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
      funnel?.contacted,
      funnel?.converted,
      leadsVsTarget?.trendVsPrevious,
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
      windowDays,
    ],
  )

  if (!selectedCustomerId || !selectedCustomerId.startsWith('cust_')) {
    return (
      <RequireActiveClient>
        <Box py={6}>
          <Text>Select an active client to open the Dashboard.</Text>
        </Box>
      </RequireActiveClient>
    )
  }

  return (
    <RequireActiveClient>
      <VStack align="stretch" spacing={6} id="reporting-dashboard">
        <Alert status="info">
          <AlertIcon />
          <AlertDescription>
            All dashboard numbers come from backend truth. If a metric is not yet supported, it stays explicit instead of being guessed.
          </AlertDescription>
        </Alert>

        <Box
          data-testid="dashboard-hero"
          borderRadius="2xl"
          bgGradient="linear(to-br, gray.900, blue.900, purple.800)"
          color="white"
          px={{ base: 5, md: 6 }}
          py={{ base: 5, md: 6 }}
        >
          <Stack direction={{ base: 'column', xl: 'row' }} spacing={6} justify="space-between">
            <VStack align="start" spacing={2} maxW="700px">
              <Badge colorScheme="whiteAlpha" variant="subtle">
                Dashboard
              </Badge>
              <Heading size="lg">Operator command view for truthful pipeline, outreach, and compliance</Heading>
              <Text color="whiteAlpha.800" maxW="2xl">
                Use this surface to monitor lead creation, outreach throughput, reply momentum, conversion movement, and risk signals for the active client.
              </Text>
              <HStack spacing={3} flexWrap="wrap">
                <Badge colorScheme="whiteAlpha" variant="outline">
                  Window: last {windowDays} days
                </Badge>
                <Badge colorScheme="whiteAlpha" variant="outline">
                  Last updated: {formatLastUpdated(lastUpdated)}
                </Badge>
              </HStack>
            </VStack>
            <Stack direction={{ base: 'column', md: 'row' }} spacing={3} align="stretch">
              <Select
                size="sm"
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                minW="220px"
                bg="white"
                color="gray.800"
                isDisabled={!canSelectCustomer}
              >
                <option value="">Select client</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Select
                size="sm"
                value={String(windowDays)}
                onChange={(e) => setWindowDays(Number(e.target.value) as WindowDays)}
                minW="150px"
                bg="white"
                color="gray.800"
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </Select>
              <Button size="sm" onClick={() => void loadData(true)} isLoading={refreshing} colorScheme="blue">
                Refresh
              </Button>
            </Stack>
          </Stack>

          <SimpleGrid columns={{ base: 1, md: 2, xl: 6 }} spacing={3} mt={6}>
            <OverviewStat label="Leads created" value={formatNumber(summary?.leadsCreated)} helper="Lead records created in this window" />
            <OverviewStat label="Target progress" value={targetPercent != null ? `${targetPercent}%` : 'No target'} helper={formatDelta(leadsVsTarget?.trendVsPrevious)} />
            <OverviewStat label="Emails sent" value={formatNumber(summary?.emailsSent)} helper={`${formatNumber(summary?.delivered)} delivered`} />
            <OverviewStat label="Replies" value={formatNumber(summary?.replyCount)} helper={formatPercent(summary?.replyRate, 'No reply rate')} />
            <OverviewStat label="Converted" value={formatNumber(funnel?.converted)} helper={`${formatNumber(funnel?.contacted)} contacted`} />
            <OverviewStat label="Risk signals" value={formatNumber(riskSignals)} helper={`${formatNumber(summary?.unsubscribes)} opt-outs + failures + bounces`} />
          </SimpleGrid>
        </Box>

        {error ? (
          <Alert status="error">
            <AlertIcon />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

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
            <SimpleGrid columns={{ base: 1, xl: 3 }} spacing={6}>
              <Card variant="outline" gridColumn={{ xl: 'span 2' }}>
                <CardHeader pb={2}>
                  <Heading size="md">Activity trend</Heading>
                  <Text color="gray.600" fontSize="sm">
                    Leads, sends, and replies over the most recent slice of the selected window.
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
                    Kanban-style operator lanes for the most important truth-based signals.
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
                  <RankedBars
                    items={(outreach?.bySequence ?? []).slice(0, 6).map((row) => ({
                      label: row.sequenceName,
                      value: row.sent,
                      helper: `${row.replies} replies · ${row.optOuts} opt-outs · ${row.failed + row.suppressed} blocked/fail`,
                      color: '#dd6b20',
                    }))}
                    emptyMessage="No sequence activity in this period."
                  />
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
                  Raw day-by-day lead, send, and reply counts for the selected window.
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
    </RequireActiveClient>
  )
}

export default ReportingDashboard
