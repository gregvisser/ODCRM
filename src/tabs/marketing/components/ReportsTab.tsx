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

type OutreachMetricsRow = {
  sequenceId?: string | null
  sequenceName?: string | null
  identityId?: string | null
  email?: string | null
  name?: string | null
  sent: number
  sendFailed: number
  suppressed: number
  skipped: number
  replies: number
  optOuts: number
}

type OutreachReportResponse = {
  customerId: string
  sinceDays: number
  bySequence: OutreachMetricsRow[]
  byIdentity: OutreachMetricsRow[]
  recentReasons?: Array<{ reason: string; count: number }>
  generatedAt?: string
}

type Customer = {
  id: string
  name: string
}

type RunHistoryRow = {
  auditId?: string | null
  recipientEmail?: string | null
  decision?: string | null
  outcome?: string | null
  reason?: string | null
  sequenceName?: string | null
  identityEmail?: string | null
  occurredAt?: string | null
}

type RunHistoryResponse = {
  summary?: {
    byDecision?: Record<string, number>
    byOutcome?: Record<string, number>
  }
  rows?: RunHistoryRow[]
}

type IdentityCapacityResponse = {
  summary?: {
    total?: number
    usable?: number
    unavailable?: number
    risky?: number
  }
}

type OperatorConsoleResponse = {
  lastUpdatedAt?: string
  queue?: {
    totalQueued?: number
    readyNow?: number
    scheduledLater?: number
    suppressed?: number
    replyStopped?: number
    failedRecently?: number
    sentRecently?: number
    blocked?: number
  }
}

type QueueWorkbenchRow = {
  queueItemId?: string | null
  sequenceName?: string | null
  identityEmail?: string | null
  recipientEmail?: string | null
  reason?: string | null
  scheduledFor?: string | null
  sentAt?: string | null
  updatedAt?: string | null
}

type QueueWorkbenchResponse = {
  rows?: QueueWorkbenchRow[]
}

const EMPTY_RUN_ROWS: RunHistoryRow[] = []
const EMPTY_QUEUE_ROWS: QueueWorkbenchRow[] = []

function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}

function humanizeOutcome(outcome?: string | null): string {
  switch (outcome) {
    case 'SENT':
      return 'Sent'
    case 'SEND_FAILED':
      return 'Failed'
    case 'SKIP_SUPPRESSED':
      return 'Suppressed'
    case 'SKIP_REPLIED_STOP':
      return 'Reply stopped'
    case 'hard_bounce_invalid_recipient':
      return 'Invalid recipient'
    case 'WOULD_SEND':
      return 'Test preview'
    default:
      return String(outcome || 'Unknown').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
  }
}

function humanizeReason(reason?: string | null): string {
  const normalized = String(reason || '').trim().toLowerCase()
  if (!normalized) return '—'
  if (normalized.includes('unsubscribe')) return 'Recipient unsubscribed.'
  if (normalized.includes('suppress')) return 'Recipient is on the suppression list.'
  if (normalized.includes('replied_stop')) return 'Stopped because the recipient already replied.'
  if (normalized.includes('outside_window')) return 'Queued for a later retry.'
  if (normalized.includes('daily_cap_reached')) return 'Mailbox is at its daily limit.'
  if (normalized.includes('per_minute_cap_reached')) return 'Mailbox is pacing sends right now.'
  if (normalized.includes('no_sender_identity')) return 'No active sender mailbox is available.'
  if (normalized.includes('hard_bounce_invalid_recipient') || normalized.includes('invalid_recipient')) return 'Recipient email address is invalid.'
  if (normalized.includes('canary')) return 'Live sending is not enabled for this client right now.'
  if (normalized.includes('kill_switch') || normalized.includes('live_send_disabled')) return 'Live sending is disabled.'
  if (normalized.includes('scheduled_later')) return 'Queued for a later scheduled time.'
  if (normalized.includes('failed_recently')) return 'A recent send failed and needs attention.'
  if (normalized.includes('blocked_other')) return 'Blocked by current sending rules.'
  return normalized.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) + '.'
}

const ReportsTab: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([])
  const {
    canSelectCustomer,
    customerHeaders,
    customerId: selectedCustomerId,
    setCustomerId: setSelectedCustomerId,
  } = useScopedCustomerSelection()
  const [windowDays, setWindowDays] = useState<WindowDays>(30)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outreachData, setOutreachData] = useState<OutreachReportResponse | null>(null)
  const [runHistoryData, setRunHistoryData] = useState<RunHistoryResponse | null>(null)
  const [identityData, setIdentityData] = useState<IdentityCapacityResponse | null>(null)
  const [consoleData, setConsoleData] = useState<OperatorConsoleResponse | null>(null)
  const [scheduledQueueData, setScheduledQueueData] = useState<QueueWorkbenchResponse | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>('')

  const goToMarketingReadiness = useCallback(() => {
    const params = new URLSearchParams(window.location.search)
    params.set('view', 'readiness')
    window.location.search = params.toString()
  }, [])

  const openMarketingTab = useCallback((view: 'readiness' | 'sequences' | 'inbox', focusPanel?: string) => {
    const params = new URLSearchParams(window.location.search)
    params.set('view', view)
    if (focusPanel) params.set('focusPanel', focusPanel)
    window.location.search = params.toString()
  }, [])

  const loadCustomers = useCallback(async () => {
    const { data, error: apiError } = await api.get('/api/customers')
    if (apiError) {
      setCustomers([])
      return
    }

    try {
      const customerList = normalizeCustomersListResponse(data) as Customer[]
      setCustomers(customerList)
    } catch {
      setCustomers([])
    }
  }, [])

  useEffect(() => {
    void loadCustomers()
  }, [loadCustomers])

  const loadData = useCallback(async (isRefresh = false) => {
    if (!selectedCustomerId?.startsWith('cust_')) {
      setError('Select an active client to view reports.')
      return
    }

    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    const sinceHours = Math.min(windowDays * 24, 168)
    const [outreachRes, runHistoryRes, identityRes, consoleRes, scheduledQueueRes] = await Promise.all([
      api.get<{ data?: OutreachReportResponse }>(`/api/reports/outreach?customerId=${encodeURIComponent(selectedCustomerId)}&sinceDays=${windowDays}`, { headers: customerHeaders }),
      api.get<{ success?: boolean; data?: RunHistoryResponse }>(`/api/send-worker/run-history?sinceHours=${sinceHours}&limit=80`, { headers: customerHeaders }),
      api.get<{ success?: boolean; data?: IdentityCapacityResponse }>(`/api/send-worker/identity-capacity?sinceHours=${sinceHours}`, { headers: customerHeaders }),
      api.get<{ success?: boolean; data?: OperatorConsoleResponse }>(`/api/send-worker/console?sinceHours=${sinceHours}`, { headers: customerHeaders }),
      api.get<{ success?: boolean; data?: QueueWorkbenchResponse }>(`/api/send-worker/queue-workbench?state=scheduled&limit=5&sinceHours=${sinceHours}`, { headers: customerHeaders }),
    ])

    const firstErr = [outreachRes, runHistoryRes, identityRes, consoleRes, scheduledQueueRes].find((row) => row.error)
    if (firstErr?.error) {
      setError(firstErr.error)
      setLoading(false)
      setRefreshing(false)
      return
    }

    setOutreachData(outreachRes.data?.data ?? null)
    setRunHistoryData(runHistoryRes.data?.data ?? null)
    setIdentityData(identityRes.data?.data ?? null)
    setConsoleData(consoleRes.data?.data ?? null)
    setScheduledQueueData(scheduledQueueRes.data?.data ?? null)
    setLastUpdatedAt(new Date().toISOString())
    setLoading(false)
    setRefreshing(false)
  }, [selectedCustomerId, windowDays, customerHeaders])

  useEffect(() => {
    void loadData(false)
  }, [loadData])

  const bySequence = useMemo(() => outreachData?.bySequence ?? [], [outreachData?.bySequence])
  const byIdentity = useMemo(() => outreachData?.byIdentity ?? [], [outreachData?.byIdentity])
  const runRows = runHistoryData?.rows ?? EMPTY_RUN_ROWS
  const scheduledRows = scheduledQueueData?.rows ?? EMPTY_QUEUE_ROWS

  const operatorRows = useMemo(
    () => runRows.filter((row) => row.outcome && row.outcome !== 'WOULD_SEND').slice(0, 14),
    [runRows],
  )

  const sequenceTotals = useMemo(() => bySequence.reduce(
    (acc, row) => ({
      sent: acc.sent + (row.sent ?? 0),
      failed: acc.failed + (row.sendFailed ?? 0),
      suppressed: acc.suppressed + (row.suppressed ?? 0),
      replies: acc.replies + (row.replies ?? 0),
      optOuts: acc.optOuts + (row.optOuts ?? 0),
    }),
    { sent: 0, failed: 0, suppressed: 0, replies: 0, optOuts: 0 },
  ), [bySequence])

  const queueSummary = consoleData?.queue ?? {}
  const nextScheduled = scheduledRows[0] ?? null

  const attentionItems = useMemo(() => {
    const items: string[] = []
    if ((queueSummary.blocked ?? 0) > 0) items.push(`${queueSummary.blocked} queued sends are blocked right now.`)
    if ((queueSummary.failedRecently ?? 0) > 0) items.push(`${queueSummary.failedRecently} sends failed recently and need review.`)
    if ((queueSummary.suppressed ?? 0) > 0) items.push(`${queueSummary.suppressed} recipients were skipped because they are suppressed or unsubscribed.`)
    if ((queueSummary.replyStopped ?? 0) > 0) items.push(`${queueSummary.replyStopped} recipients were stopped because they already replied.`)
    if ((identityData?.summary?.usable ?? 0) < 1) items.push('No active sender mailbox is available right now.')
    else if ((identityData?.summary?.risky ?? 0) > 0) items.push(`${identityData?.summary?.risky} mailbox${identityData?.summary?.risky === 1 ? '' : 'es'} need attention.`)
    if ((queueSummary.readyNow ?? 0) < 1 && (queueSummary.scheduledLater ?? 0) > 0) items.push('Queued recipients are scheduled for later.')
    return items
  }, [identityData?.summary?.risky, identityData?.summary?.usable, queueSummary.blocked, queueSummary.failedRecently, queueSummary.readyNow, queueSummary.replyStopped, queueSummary.scheduledLater, queueSummary.suppressed])

  const mailboxRows = useMemo(
    () => byIdentity
      .filter((row) => (row.sent ?? 0) + (row.sendFailed ?? 0) + (row.replies ?? 0) + (row.optOuts ?? 0) + (row.suppressed ?? 0) > 0)
      .slice(0, 10),
    [byIdentity],
  )

  if (!selectedCustomerId || !selectedCustomerId.startsWith('cust_')) {
    return (
      <RequireActiveClient>
        <Box py={6}>
          <Text>Select an active client to open Reports.</Text>
        </Box>
      </RequireActiveClient>
    )
  }

  return (
    <RequireActiveClient>
      <Box id="reports-tab-panel" data-testid="reports-tab-panel">
        <VStack align="stretch" spacing={4}>
          <Alert status="info" data-testid="reports-retrospective-role-separation">
            <AlertIcon />
            <AlertDescription>
              Review what sent, what failed, who replied, and who opted out for the selected client. Operational follow-up is shown separately below when action is needed.
            </AlertDescription>
          </Alert>
          <Card id="reports-tab-controls" data-testid="reports-tab-controls">
            <CardHeader>
              <HStack justify="space-between" align="center" flexWrap="wrap" gap={3}>
                <VStack align="start" spacing={0}>
                  <Heading size="md">Outreach reporting</Heading>
                  <Text fontSize="sm" color="gray.600" data-testid="reports-tab-operator-cue">
                    Review send volume, replies, opt-outs, mailbox performance, and recent outcomes. Queue detail and follow-up tools are kept in a secondary section.
                  </Text>
                </VStack>
                <HStack>
                  <Select
                    id="reports-tab-customer-select"
                    data-testid="reports-tab-customer-select"
                    size="sm"
                    value={selectedCustomerId}
                    onChange={(event) => setSelectedCustomerId(event.target.value)}
                    minW="220px"
                    isDisabled={!canSelectCustomer}
                  >
                    <option value="">Select client</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={goToMarketingReadiness}
                    data-testid="reports-go-dashboard-triage"
                  >
                    Open Marketing Readiness
                  </Button>
                  <Select
                    id="reports-tab-window-select"
                    data-testid="reports-tab-window-select"
                    size="sm"
                    value={String(windowDays)}
                    onChange={(event) => setWindowDays(Number(event.target.value) as WindowDays)}
                    minW="180px"
                  >
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                  </Select>
                  <Button
                    size="sm"
                    id="reports-tab-refresh-btn"
                    data-testid="reports-tab-refresh-btn"
                    onClick={() => void loadData(true)}
                    isLoading={refreshing}
                    leftIcon={refreshing ? <Spinner size="xs" /> : undefined}
                  >
                    Refresh
                  </Button>
                </HStack>
              </HStack>
            </CardHeader>
            <CardBody>
              {loading ? (
                <HStack><Spinner size="sm" /><Text>Loading reports…</Text></HStack>
              ) : null}
              {error ? (
                <Alert status="error" mb={3}>
                  <AlertIcon />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <SimpleGrid id="reports-tab-summary-cards" data-testid="reports-tab-summary-cards" columns={{ base: 2, md: 4, xl: 8 }} spacing={3}>
                <Stat borderWidth="1px" borderRadius="md" p={3}>
                  <StatLabel>Sent</StatLabel>
                  <StatNumber>{sequenceTotals.sent}</StatNumber>
                </Stat>
                <Stat borderWidth="1px" borderRadius="md" p={3}>
                  <StatLabel>Send failures</StatLabel>
                  <StatNumber>{sequenceTotals.failed}</StatNumber>
                </Stat>
                <Stat borderWidth="1px" borderRadius="md" p={3}>
                  <StatLabel>Blocked right now</StatLabel>
                  <StatNumber>{queueSummary.blocked ?? 0}</StatNumber>
                </Stat>
                <Stat borderWidth="1px" borderRadius="md" p={3}>
                  <StatLabel>Suppressed or unsubscribed</StatLabel>
                  <StatNumber>{(queueSummary.suppressed ?? 0) || sequenceTotals.suppressed}</StatNumber>
                </Stat>
                <Stat borderWidth="1px" borderRadius="md" p={3}>
                  <StatLabel>Replies received</StatLabel>
                  <StatNumber>{sequenceTotals.replies}</StatNumber>
                </Stat>
                <Stat borderWidth="1px" borderRadius="md" p={3}>
                  <StatLabel>Opt-outs</StatLabel>
                  <StatNumber>{sequenceTotals.optOuts}</StatNumber>
                </Stat>
                <Stat borderWidth="1px" borderRadius="md" p={3}>
                  <StatLabel>Still queued</StatLabel>
                  <StatNumber>{queueSummary.totalQueued ?? 0}</StatNumber>
                </Stat>
                <Stat borderWidth="1px" borderRadius="md" p={3}>
                  <StatLabel>Reply stopped</StatLabel>
                  <StatNumber>{queueSummary.replyStopped ?? 0}</StatNumber>
                </Stat>
              </SimpleGrid>
              <Text id="reports-tab-last-updated" data-testid="reports-tab-last-updated" mt={3} fontSize="xs" color="gray.500">
                Last updated: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString() : '—'}
              </Text>
            </CardBody>
          </Card>

          <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={4}>
            <Card id="reports-tab-recent-attempts" data-testid="reports-tab-recent-attempts">
              <CardHeader><Heading size="sm">Latest send outcomes</Heading></CardHeader>
              <CardBody>
                <Box overflowX="auto">
                  <Table size="sm">
                    <Thead>
                      <Tr>
                        <Th>Time</Th>
                        <Th>Sequence</Th>
                        <Th>Mailbox</Th>
                        <Th>Recipient</Th>
                        <Th>Outcome</Th>
                        <Th>Why</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {operatorRows.length === 0 ? (
                        <Tr><Td colSpan={6} color="gray.500">No recent send outcomes yet in this window.</Td></Tr>
                      ) : (
                        operatorRows.map((row, idx) => (
                          <Tr key={row.auditId || `${row.recipientEmail || 'unknown'}-${row.occurredAt || idx}`}>
                            <Td whiteSpace="nowrap">{formatDateTime(row.occurredAt)}</Td>
                            <Td>{row.sequenceName || 'Unknown sequence'}</Td>
                            <Td>{row.identityEmail || 'No mailbox recorded'}</Td>
                            <Td>{row.recipientEmail || 'Unknown recipient'}</Td>
                            <Td>{humanizeOutcome(row.outcome)}</Td>
                            <Td>{humanizeReason(row.reason)}</Td>
                          </Tr>
                        ))
                      )}
                    </Tbody>
                  </Table>
                </Box>
              </CardBody>
            </Card>

            <Card id="reports-tab-by-sequence" data-testid="reports-tab-by-sequence">
              <CardHeader><Heading size="sm">Results by sequence</Heading></CardHeader>
              <CardBody>
                <Box overflowX="auto">
                  <Table size="sm">
                    <Thead>
                      <Tr>
                        <Th>Sequence</Th>
                        <Th isNumeric>Sent</Th>
                        <Th isNumeric>Failed</Th>
                        <Th isNumeric>Suppressed</Th>
                        <Th isNumeric>Replies</Th>
                        <Th isNumeric>Opt-Outs</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {bySequence.length === 0 ? (
                        <Tr><Td colSpan={6} color="gray.500">No sequence metrics in this window yet.</Td></Tr>
                      ) : (
                        bySequence.slice(0, 12).map((row, idx) => (
                          <Tr key={row.sequenceId || row.sequenceName || `seq-${idx}`}>
                            <Td>{row.sequenceName || row.sequenceId || 'Unknown sequence'}</Td>
                            <Td isNumeric>{row.sent ?? 0}</Td>
                            <Td isNumeric>{row.sendFailed ?? 0}</Td>
                            <Td isNumeric>{row.suppressed ?? 0}</Td>
                            <Td isNumeric>{row.replies ?? 0}</Td>
                            <Td isNumeric>{row.optOuts ?? 0}</Td>
                          </Tr>
                        ))
                      )}
                    </Tbody>
                  </Table>
                </Box>
              </CardBody>
            </Card>

            <Card id="reports-tab-by-identity" data-testid="reports-tab-by-identity">
              <CardHeader><Heading size="sm">Results by mailbox</Heading></CardHeader>
              <CardBody>
                <Box overflowX="auto">
                  <Table size="sm">
                    <Thead>
                      <Tr>
                        <Th>Mailbox</Th>
                        <Th isNumeric>Sent</Th>
                        <Th isNumeric>Failed</Th>
                        <Th isNumeric>Replies</Th>
                        <Th isNumeric>Opt-Outs</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {mailboxRows.length === 0 ? (
                        <Tr><Td colSpan={5} color="gray.500">No mailbox activity in this window yet.</Td></Tr>
                      ) : (
                        mailboxRows.map((row, idx) => (
                          <Tr key={row.identityId || row.email || `identity-${idx}`}>
                            <Td>{row.name || row.email || row.identityId || 'Unknown mailbox'}</Td>
                            <Td isNumeric>{row.sent ?? 0}</Td>
                            <Td isNumeric>{row.sendFailed ?? 0}</Td>
                            <Td isNumeric>{row.replies ?? 0}</Td>
                            <Td isNumeric>{row.optOuts ?? 0}</Td>
                          </Tr>
                        ))
                      )}
                    </Tbody>
                  </Table>
                </Box>
              </CardBody>
            </Card>
          </SimpleGrid>

          <Card
            id="reports-tab-operations-context"
            data-testid="reports-tab-operations-context"
            variant="outline"
            borderColor="gray.200"
            bg="gray.50"
          >
            <CardHeader>
              <VStack align="start" spacing={1}>
                <Heading size="sm">Operational follow-up</Heading>
                <Text fontSize="sm" color="gray.600">
                  Secondary queue and follow-up context for operators. Use this section when the reporting results above need explanation or action.
                </Text>
              </VStack>
            </CardHeader>
            <CardBody pt={0}>
              <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={4}>
                <Card id="reports-tab-next-up" data-testid="reports-tab-next-up">
                  <CardHeader><Heading size="sm">Queue outlook</Heading></CardHeader>
                  <CardBody>
                    <VStack align="stretch" spacing={3}>
                      <SimpleGrid columns={{ base: 2, md: 3 }} spacing={3}>
                        <Stat borderWidth="1px" borderRadius="md" p={3}>
                          <StatLabel>Ready now</StatLabel>
                          <StatNumber>{queueSummary.readyNow ?? 0}</StatNumber>
                        </Stat>
                        <Stat borderWidth="1px" borderRadius="md" p={3}>
                          <StatLabel>Queued later</StatLabel>
                          <StatNumber>{queueSummary.scheduledLater ?? 0}</StatNumber>
                        </Stat>
                        <Stat borderWidth="1px" borderRadius="md" p={3}>
                          <StatLabel>Active mailboxes</StatLabel>
                          <StatNumber>{identityData?.summary?.usable ?? 0}</StatNumber>
                        </Stat>
                      </SimpleGrid>
                      {queueSummary.readyNow ? (
                        <Alert status="success" variant="left-accent">
                          <AlertIcon />
                          <AlertDescription>{queueSummary.readyNow} recipient{queueSummary.readyNow === 1 ? '' : 's'} can send now in the active window.</AlertDescription>
                        </Alert>
                      ) : nextScheduled ? (
                        <Alert status="info" variant="left-accent">
                          <AlertIcon />
                          <AlertDescription>
                            Next queued send: {formatDateTime(nextScheduled.scheduledFor)} to {nextScheduled.recipientEmail || 'unknown recipient'}
                            {nextScheduled.sequenceName ? ` for ${nextScheduled.sequenceName}` : ''}{nextScheduled.identityEmail ? ` via ${nextScheduled.identityEmail}` : ''}.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <Alert status="info" variant="left-accent">
                          <AlertIcon />
                          <AlertDescription>No pending recipients are due now.</AlertDescription>
                        </Alert>
                      )}
                    </VStack>
                  </CardBody>
                </Card>

                <Card id="reports-tab-attention-needed" data-testid="reports-tab-attention-needed">
                  <CardHeader><Heading size="sm">Needs follow-up</Heading></CardHeader>
                  <CardBody>
                    {attentionItems.length === 0 ? (
                      <Text color="gray.600">No immediate operator issues from the current reporting window.</Text>
                    ) : (
                      <VStack align="stretch" spacing={2}>
                        {attentionItems.map((item) => (
                          <Alert key={item} status="warning" variant="left-accent">
                            <AlertIcon />
                            <AlertDescription>{item}</AlertDescription>
                          </Alert>
                        ))}
                      </VStack>
                    )}
                  </CardBody>
                </Card>
              </SimpleGrid>

              <Card id="reports-tab-next-steps" data-testid="reports-tab-next-steps" mt={4}>
                <CardHeader><Heading size="sm">Open another workspace</Heading></CardHeader>
                <CardBody>
                  <Text fontSize="sm" color="gray.600" mb={3}>
                    Open Sequences to fix sending or queued items. Open Inbox to handle replies. Return to Readiness for client-level checks.
                  </Text>
                  <HStack flexWrap="wrap">
                    <Button size="sm" variant="outline" data-testid="reports-tab-open-sequences" onClick={() => openMarketingTab('sequences', 'run-history-panel')}>
                      Open Sequences
                    </Button>
                    <Button size="sm" variant="outline" data-testid="reports-tab-open-inbox" onClick={() => openMarketingTab('inbox')}>
                      Open Inbox
                    </Button>
                    <Button size="sm" variant="ghost" data-testid="reports-tab-open-readiness" onClick={() => openMarketingTab('readiness')}>
                      Back to Readiness
                    </Button>
                  </HStack>
                </CardBody>
              </Card>
            </CardBody>
          </Card>
        </VStack>
      </Box>
    </RequireActiveClient>
  )
}

export default ReportsTab
