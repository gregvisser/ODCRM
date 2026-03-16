/**
 * Reporting Dashboard — operator-grade analytics for ODCRM.
 * All metrics from backend truth (/api/reporting/*). No frontend-only calculations.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Heading,
  HStack,
  Progress,
  Select,
  SimpleGrid,
  Spinner,
  Stat,
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
      setError('Select an active client to view the reporting dashboard.')
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
          api.get<{ bySequence: OutreachSequenceRow[]; totalSent: number; totalReplies: number; topSequence: OutreachSequenceRow | null }>(
            `${base}/outreach-performance?sinceDays=${sinceDays}`,
            opts,
          ),
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

  if (!selectedCustomerId || !selectedCustomerId.startsWith('cust_')) {
    return (
      <RequireActiveClient>
        <Box py={6}>
          <Text>Select an active client to open the Reporting Dashboard.</Text>
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
            All numbers come from your data. Metrics that are not yet available show “Not available yet” or are omitted.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <HStack justify="space-between" flexWrap="wrap" gap={3}>
              <Heading size="md">Reporting Dashboard</Heading>
              <HStack>
                <Select
                  size="sm"
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  minW="220px"
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
                  minW="140px"
                >
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                </Select>
                <Button size="sm" onClick={() => void loadData(true)} isLoading={refreshing}>
                  Refresh
                </Button>
              </HStack>
            </HStack>
          </CardHeader>
          <CardBody>
            {error && (
              <Alert status="error" mb={3}>
                <AlertIcon />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {loading ? (
              <HStack><Spinner size="sm" /><Text>Loading dashboard…</Text></HStack>
            ) : (
              <>
                <Text fontSize="xs" color="gray.500" mb={4}>
                  Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : '—'}
                </Text>

                {/* 1. Executive summary cards */}
                <Heading size="sm" mb={3}>Overview</Heading>
                <SimpleGrid columns={{ base: 2, md: 4, xl: 6 }} spacing={3} mb={6}>
                  <Stat borderWidth="1px" borderRadius="md" p={3}>
                    <StatLabel>Leads created</StatLabel>
                    <StatNumber>{summary?.leadsCreated ?? '—'}</StatNumber>
                  </Stat>
                  <Stat borderWidth="1px" borderRadius="md" p={3}>
                    <StatLabel>Leads target</StatLabel>
                    <StatNumber>{summary?.leadsTarget != null ? summary.leadsTarget : 'No target set'}</StatNumber>
                  </Stat>
                  <Stat borderWidth="1px" borderRadius="md" p={3}>
                    <StatLabel>% to target</StatLabel>
                    <StatNumber>
                      {summary?.percentToTarget != null ? `${summary.percentToTarget}%` : '—'}
                    </StatNumber>
                  </Stat>
                  <Stat borderWidth="1px" borderRadius="md" p={3}>
                    <StatLabel>Emails sent</StatLabel>
                    <StatNumber>{summary?.emailsSent ?? '—'}</StatNumber>
                  </Stat>
                  <Stat borderWidth="1px" borderRadius="md" p={3}>
                    <StatLabel>Delivered</StatLabel>
                    <StatNumber>{summary?.delivered != null ? summary.delivered : '—'}</StatNumber>
                  </Stat>
                  <Stat borderWidth="1px" borderRadius="md" p={3}>
                    <StatLabel>Open rate</StatLabel>
                    <StatNumber>{summary?.openRate != null ? `${summary.openRate}%` : 'Not available yet'}</StatNumber>
                  </Stat>
                  <Stat borderWidth="1px" borderRadius="md" p={3}>
                    <StatLabel>Reply rate</StatLabel>
                    <StatNumber>{summary?.replyRate != null ? `${summary.replyRate}%` : '—'}</StatNumber>
                  </Stat>
                  <Stat borderWidth="1px" borderRadius="md" p={3}>
                    <StatLabel>Replies</StatLabel>
                    <StatNumber>{summary?.replyCount ?? '—'}</StatNumber>
                  </Stat>
                  <Stat borderWidth="1px" borderRadius="md" p={3}>
                    <StatLabel>Positive replies</StatLabel>
                    <StatNumber>{summary?.positiveReplyCount != null ? summary.positiveReplyCount : 'Not available yet'}</StatNumber>
                  </Stat>
                  <Stat borderWidth="1px" borderRadius="md" p={3}>
                    <StatLabel>Meetings booked</StatLabel>
                    <StatNumber>{summary?.meetingsBooked != null ? summary.meetingsBooked : 'Not available yet'}</StatNumber>
                  </Stat>
                  <Stat borderWidth="1px" borderRadius="md" p={3}>
                    <StatLabel>Bounces</StatLabel>
                    <StatNumber>{summary?.bounces ?? '—'}</StatNumber>
                  </Stat>
                  <Stat borderWidth="1px" borderRadius="md" p={3}>
                    <StatLabel>Unsubscribes</StatLabel>
                    <StatNumber>{summary?.unsubscribes ?? '—'}</StatNumber>
                  </Stat>
                  <Stat borderWidth="1px" borderRadius="md" p={3}>
                    <StatLabel>Suppressions (emails)</StatLabel>
                    <StatNumber>{summary?.suppressedEmails ?? '—'}</StatNumber>
                  </Stat>
                  <Stat borderWidth="1px" borderRadius="md" p={3}>
                    <StatLabel>Send failures</StatLabel>
                    <StatNumber>{summary?.sendFailures ?? '—'}</StatNumber>
                  </Stat>
                </SimpleGrid>

                {/* 2. Leads vs target */}
                <Heading size="sm" mb={3}>Leads vs target</Heading>
                <Card variant="outline" mb={6}>
                  <CardBody>
                    {leadsVsTarget ? (
                      <VStack align="stretch" spacing={3}>
                        <HStack justify="space-between">
                          <Text fontWeight="medium">Leads this period: {leadsVsTarget.leadsCreated}</Text>
                          <Text color="gray.600">
                            Target: {leadsVsTarget.leadsTarget != null ? leadsVsTarget.leadsTarget : 'No target set'}
                          </Text>
                        </HStack>
                        {leadsVsTarget.leadsTarget != null && leadsVsTarget.leadsTarget > 0 && (
                          <Box>
                            <Progress
                              value={Math.min((leadsVsTarget.leadsCreated / leadsVsTarget.leadsTarget) * 100, 100)}
                              colorScheme={leadsVsTarget.percentToTarget != null && leadsVsTarget.percentToTarget >= 100 ? 'green' : 'blue'}
                              size="sm"
                              borderRadius="md"
                            />
                            <Text fontSize="xs" mt={1}>
                              {leadsVsTarget.percentToTarget != null ? `${leadsVsTarget.percentToTarget}% of target` : ''}
                              {leadsVsTarget.trendVsPrevious != null && ` · Trend vs previous period: ${leadsVsTarget.trendVsPrevious >= 0 ? '+' : ''}${leadsVsTarget.trendVsPrevious}`}
                            </Text>
                          </Box>
                        )}
                        {(!leadsVsTarget.leadsTarget || leadsVsTarget.leadsTarget === 0) && (
                          <Text fontSize="sm" color="gray.600">Set a lead target in the client record to see progress.</Text>
                        )}
                      </VStack>
                    ) : (
                      <Text color="gray.500">No data for this period.</Text>
                    )}
                  </CardBody>
                </Card>

                {/* 3. Lead source reporting */}
                <Heading size="sm" mb={3}>Leads by source</Heading>
                <Card variant="outline" mb={6}>
                  <CardHeader py={2}>
                    <HStack justify="space-between">
                      <Text fontSize="sm">Source contribution</Text>
                      {leadsBySource.length > 0 && (
                        <Button size="xs" variant="outline" onClick={exportLeadsBySourceCsv}>
                          Export CSV
                        </Button>
                      )}
                    </HStack>
                  </CardHeader>
                  <CardBody pt={0}>
                    {leadsBySource.length === 0 ? (
                      <Text color="gray.500">No leads in this period.</Text>
                    ) : (
                      <Table size="sm">
                        <Thead>
                          <Tr>
                            <Th>Source</Th>
                            <Th isNumeric>Count</Th>
                            <Th isNumeric>%</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {leadsBySource.map((r) => (
                            <Tr key={r.source}>
                              <Td>{r.source}</Td>
                              <Td isNumeric>{r.count}</Td>
                              <Td isNumeric>{r.percent}%</Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    )}
                  </CardBody>
                </Card>

                {/* 4. Top users who sourced leads */}
                <Heading size="sm" mb={3}>Top sourcers (by lead count)</Heading>
                <Card variant="outline" mb={6}>
                  <CardHeader py={2}>
                    <HStack justify="space-between">
                      <Text fontSize="sm">Owner / operator</Text>
                      {topSourcers.length > 0 && (
                        <Button size="xs" variant="outline" onClick={exportTopSourcersCsv}>
                          Export CSV
                        </Button>
                      )}
                    </HStack>
                  </CardHeader>
                  <CardBody pt={0}>
                    {topSourcers.length === 0 ? (
                      <Text color="gray.500">No lead ownership data in this period.</Text>
                    ) : (
                      <Table size="sm">
                        <Thead>
                          <Tr>
                            <Th>Owner</Th>
                            <Th isNumeric>Leads</Th>
                            <Th isNumeric>% of total</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {topSourcers.map((r) => (
                            <Tr key={r.owner}>
                              <Td>{r.owner}</Td>
                              <Td isNumeric>{r.count}</Td>
                              <Td isNumeric>{r.percent}%</Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    )}
                  </CardBody>
                </Card>

                {/* 5. Outreach performance */}
                <Heading size="sm" mb={3}>Outreach performance</Heading>
                <Card variant="outline" mb={6}>
                  <CardHeader py={2}>
                    <HStack justify="space-between">
                      <Text fontSize="sm">By sequence · Total sent: {outreach?.totalSent ?? 0} · Replies: {outreach?.totalReplies ?? 0}</Text>
                      {outreach?.bySequence && outreach.bySequence.length > 0 && (
                        <Button size="xs" variant="outline" onClick={exportOutreachCsv}>
                          Export CSV
                        </Button>
                      )}
                    </HStack>
                  </CardHeader>
                  <CardBody pt={0}>
                    {!outreach?.bySequence?.length ? (
                      <Text color="gray.500">No sequence activity in this period.</Text>
                    ) : (
                      <Table size="sm">
                        <Thead>
                          <Tr>
                            <Th>Sequence</Th>
                            <Th isNumeric>Sent</Th>
                            <Th isNumeric>Failed</Th>
                            <Th isNumeric>Suppressed</Th>
                            <Th isNumeric>Replies</Th>
                            <Th isNumeric>Opt-outs</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {outreach.bySequence.slice(0, 15).map((r) => (
                            <Tr key={r.sequenceId}>
                              <Td>{r.sequenceName}</Td>
                              <Td isNumeric>{r.sent}</Td>
                              <Td isNumeric>{r.failed}</Td>
                              <Td isNumeric>{r.suppressed}</Td>
                              <Td isNumeric>{r.replies}</Td>
                              <Td isNumeric>{r.optOuts}</Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    )}
                  </CardBody>
                </Card>

                {/* 6. Pipeline / funnel */}
                <Heading size="sm" mb={3}>Pipeline</Heading>
                <Card variant="outline" mb={6}>
                  <CardBody>
                    {funnel ? (
                      <SimpleGrid columns={{ base: 2, md: 5 }} spacing={3}>
                        <Stat size="sm">
                          <StatLabel>Leads created</StatLabel>
                          <StatNumber>{funnel.leadsCreated}</StatNumber>
                        </Stat>
                        <Stat size="sm">
                          <StatLabel>Contacted</StatLabel>
                          <StatNumber>{funnel.contacted}</StatNumber>
                        </Stat>
                        <Stat size="sm">
                          <StatLabel>Replied</StatLabel>
                          <StatNumber>{funnel.replied}</StatNumber>
                        </Stat>
                        <Stat size="sm">
                          <StatLabel>Positive replies</StatLabel>
                          <StatNumber>{funnel.positiveReplies != null ? funnel.positiveReplies : '—'}</StatNumber>
                        </Stat>
                        <Stat size="sm">
                          <StatLabel>Converted</StatLabel>
                          <StatNumber>{funnel.converted}</StatNumber>
                        </Stat>
                      </SimpleGrid>
                    ) : (
                      <Text color="gray.500">No funnel data for this period.</Text>
                    )}
                  </CardBody>
                </Card>

                {/* 7. Mailbox / identity */}
                <Heading size="sm" mb={3}>Performance by mailbox</Heading>
                <Card variant="outline" mb={6}>
                  <CardBody pt={2}>
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
                            <Th isNumeric>Failed</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {mailboxes.slice(0, 10).map((r) => (
                            <Tr key={r.identityId}>
                              <Td>{r.name || r.email || r.identityId}</Td>
                              <Td isNumeric>{r.sent}</Td>
                              <Td isNumeric>{r.replied}</Td>
                              <Td isNumeric>{r.bounced}</Td>
                              <Td isNumeric>{r.optedOut}</Td>
                              <Td isNumeric>{r.failed}</Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    )}
                  </CardBody>
                </Card>

                {/* 8. Compliance / health */}
                <Heading size="sm" mb={3}>Compliance & health</Heading>
                <Card variant="outline" mb={6}>
                  <CardBody>
                    {compliance ? (
                      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
                        <Stat size="sm">
                          <StatLabel>Suppressed emails</StatLabel>
                          <StatNumber>{compliance.suppressedEmails}</StatNumber>
                        </Stat>
                        <Stat size="sm">
                          <StatLabel>Suppressed domains</StatLabel>
                          <StatNumber>{compliance.suppressedDomains}</StatNumber>
                        </Stat>
                        <Stat size="sm">
                          <StatLabel>Unsubscribes (period)</StatLabel>
                          <StatNumber>{compliance.unsubscribesInPeriod}</StatNumber>
                        </Stat>
                        <Stat size="sm">
                          <StatLabel>Suppression blocks (period)</StatLabel>
                          <StatNumber>{compliance.suppressionBlocksInPeriod}</StatNumber>
                        </Stat>
                      </SimpleGrid>
                    ) : (
                      <Text color="gray.500">No compliance data.</Text>
                    )}
                  </CardBody>
                </Card>

                {/* 9. Activity trend */}
                <Heading size="sm" mb={3}>Activity trend</Heading>
                <Card variant="outline" mb={6}>
                  <CardBody>
                    {trends.length === 0 ? (
                      <Text color="gray.500">No trend data for this period.</Text>
                    ) : (
                      <Box overflowX="auto">
                        <Table size="sm">
                          <Thead>
                            <Tr>
                              <Th>Day</Th>
                              <Th isNumeric>Leads</Th>
                              <Th isNumeric>Sent</Th>
                              <Th isNumeric>Replies</Th>
                            </Tr>
                          </Thead>
                          <Tbody>
                            {[...trends].reverse().slice(0, 30).map((r) => (
                              <Tr key={r.day}>
                                <Td>{r.day}</Td>
                                <Td isNumeric>{r.leads}</Td>
                                <Td isNumeric>{r.sent}</Td>
                                <Td isNumeric>{r.replied}</Td>
                              </Tr>
                            ))}
                          </Tbody>
                        </Table>
                      </Box>
                    )}
                  </CardBody>
                </Card>
              </>
            )}
          </CardBody>
        </Card>
      </VStack>
    </RequireActiveClient>
  )
}

export default ReportingDashboard
