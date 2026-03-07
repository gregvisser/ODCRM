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
import { getCurrentCustomerId, onSettingsUpdated } from '../../../platform/stores/settings'
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

type RunHistoryRow = {
  recipientEmail?: string | null
  decision?: string | null
  reason?: string | null
  sequenceName?: string | null
  identityEmail?: string | null
  createdAt?: string | null
}

type RunHistoryResponse = {
  summary?: {
    WOULD_SEND?: number
    SENT?: number
    SEND_FAILED?: number
    SKIP_SUPPRESSED?: number
    SKIP_REPLIED_STOP?: number
    hard_bounce_invalid_recipient?: number
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

const ReportsTab: React.FC = () => {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(getCurrentCustomerId() || '')
  const [windowDays, setWindowDays] = useState<WindowDays>(30)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outreachData, setOutreachData] = useState<OutreachReportResponse | null>(null)
  const [runHistoryData, setRunHistoryData] = useState<RunHistoryResponse | null>(null)
  const [identityData, setIdentityData] = useState<IdentityCapacityResponse | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>('')

  useEffect(() => {
    const unsubscribe = onSettingsUpdated((detail) => {
      const next = (detail as { currentCustomerId?: string } | null)?.currentCustomerId || ''
      setSelectedCustomerId(next)
    })
    return () => unsubscribe()
  }, [])

  const loadData = useCallback(async (isRefresh = false) => {
    if (!selectedCustomerId?.startsWith('cust_')) {
      setError('Select an active client to view reports.')
      return
    }

    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    const sinceHours = Math.min(windowDays * 24, 168)
    const headers = { 'X-Customer-Id': selectedCustomerId }

    const [outreachRes, runHistoryRes, identityRes] = await Promise.all([
      api.get<{ data?: OutreachReportResponse }>(`/api/reports/outreach?customerId=${encodeURIComponent(selectedCustomerId)}&sinceDays=${windowDays}`, { headers }),
      api.get<{ success?: boolean; data?: RunHistoryResponse }>(`/api/send-worker/run-history?sinceHours=${sinceHours}&limit=80`, { headers }),
      api.get<{ success?: boolean; data?: IdentityCapacityResponse }>(`/api/send-worker/identity-capacity?sinceHours=${sinceHours}`, { headers }),
    ])

    const firstErr = [outreachRes, runHistoryRes, identityRes].find((row) => row.error)
    if (firstErr?.error) {
      setError(firstErr.error)
      setLoading(false)
      setRefreshing(false)
      return
    }

    setOutreachData(outreachRes.data?.data ?? null)
    setRunHistoryData(runHistoryRes.data?.data ?? null)
    setIdentityData(identityRes.data?.data ?? null)
    setLastUpdatedAt(new Date().toISOString())
    setLoading(false)
    setRefreshing(false)
  }, [selectedCustomerId, windowDays])

  useEffect(() => {
    void loadData(false)
  }, [loadData])

  const bySequence = outreachData?.bySequence ?? []
  const byIdentity = outreachData?.byIdentity ?? []
  const runRows = runHistoryData?.rows ?? []

  const topReasons = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of runRows) {
      const reason = String(row.reason || row.decision || 'UNKNOWN')
      counts.set(reason, (counts.get(reason) || 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }, [runRows])

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
          <Card id="reports-tab-controls" data-testid="reports-tab-controls">
            <CardHeader>
              <HStack justify="space-between" align="center" flexWrap="wrap" gap={3}>
                <Heading size="md">Outreach Operations Reports</Heading>
                <HStack>
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
              <SimpleGrid id="reports-tab-summary-cards" data-testid="reports-tab-summary-cards" columns={{ base: 2, md: 4, lg: 6 }} spacing={3}>
                <Stat borderWidth="1px" borderRadius="md" p={3}>
                  <StatLabel>SENT</StatLabel>
                  <StatNumber>{runHistoryData?.summary?.SENT ?? 0}</StatNumber>
                </Stat>
                <Stat borderWidth="1px" borderRadius="md" p={3}>
                  <StatLabel>SEND_FAILED</StatLabel>
                  <StatNumber>{runHistoryData?.summary?.SEND_FAILED ?? 0}</StatNumber>
                </Stat>
                <Stat borderWidth="1px" borderRadius="md" p={3}>
                  <StatLabel>SKIP_SUPPRESSED</StatLabel>
                  <StatNumber>{runHistoryData?.summary?.SKIP_SUPPRESSED ?? 0}</StatNumber>
                </Stat>
                <Stat borderWidth="1px" borderRadius="md" p={3}>
                  <StatLabel>SKIP_REPLIED_STOP</StatLabel>
                  <StatNumber>{runHistoryData?.summary?.SKIP_REPLIED_STOP ?? 0}</StatNumber>
                </Stat>
                <Stat borderWidth="1px" borderRadius="md" p={3}>
                  <StatLabel>Usable Identities</StatLabel>
                  <StatNumber>{identityData?.summary?.usable ?? 0}</StatNumber>
                </Stat>
                <Stat borderWidth="1px" borderRadius="md" p={3}>
                  <StatLabel>Risky Identities</StatLabel>
                  <StatNumber>{identityData?.summary?.risky ?? 0}</StatNumber>
                </Stat>
              </SimpleGrid>
              <Text id="reports-tab-last-updated" data-testid="reports-tab-last-updated" mt={3} fontSize="xs" color="gray.500">
                Last updated: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString() : '—'} | Routes: /api/reports/outreach, /api/send-worker/run-history, /api/send-worker/identity-capacity
              </Text>
            </CardBody>
          </Card>

          <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={4}>
            <Card id="reports-tab-by-sequence" data-testid="reports-tab-by-sequence">
              <CardHeader><Heading size="sm">By Sequence</Heading></CardHeader>
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
                      </Tr>
                    </Thead>
                    <Tbody>
                      {bySequence.length === 0 ? (
                        <Tr><Td colSpan={5} color="gray.500">No sequence metrics in this window.</Td></Tr>
                      ) : (
                        bySequence.slice(0, 12).map((row, idx) => (
                          <Tr key={row.sequenceId || row.sequenceName || `seq-${idx}`}>
                            <Td>{row.sequenceName || row.sequenceId || 'Unknown sequence'}</Td>
                            <Td isNumeric>{row.sent ?? 0}</Td>
                            <Td isNumeric>{row.sendFailed ?? 0}</Td>
                            <Td isNumeric>{row.suppressed ?? 0}</Td>
                            <Td isNumeric>{row.replies ?? 0}</Td>
                          </Tr>
                        ))
                      )}
                    </Tbody>
                  </Table>
                </Box>
              </CardBody>
            </Card>

            <Card id="reports-tab-by-identity" data-testid="reports-tab-by-identity">
              <CardHeader><Heading size="sm">By Identity</Heading></CardHeader>
              <CardBody>
                <Box overflowX="auto">
                  <Table size="sm">
                    <Thead>
                      <Tr>
                        <Th>Identity</Th>
                        <Th isNumeric>Sent</Th>
                        <Th isNumeric>Failed</Th>
                        <Th isNumeric>Replies</Th>
                        <Th isNumeric>Opt-Outs</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {byIdentity.length === 0 ? (
                        <Tr><Td colSpan={5} color="gray.500">No identity metrics in this window.</Td></Tr>
                      ) : (
                        byIdentity.slice(0, 12).map((row, idx) => (
                          <Tr key={row.identityId || row.email || `identity-${idx}`}>
                            <Td>{row.name || row.email || row.identityId || 'Unknown identity'}</Td>
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

            <Card id="reports-tab-recent-reasons" data-testid="reports-tab-recent-reasons">
              <CardHeader><Heading size="sm">Recent Reasons</Heading></CardHeader>
              <CardBody>
                {topReasons.length === 0 ? (
                  <Text color="gray.500">No recent reason rows in this window.</Text>
                ) : (
                  <VStack align="stretch" spacing={2}>
                    {topReasons.map((row) => (
                      <HStack key={row.reason} justify="space-between" borderWidth="1px" borderRadius="md" p={2}>
                        <Text fontSize="sm">{row.reason}</Text>
                        <Badge>{row.count}</Badge>
                      </HStack>
                    ))}
                  </VStack>
                )}
              </CardBody>
            </Card>

            <Card id="reports-tab-recent-attempts" data-testid="reports-tab-recent-attempts">
              <CardHeader><Heading size="sm">Recent Attempts</Heading></CardHeader>
              <CardBody>
                <Box overflowX="auto">
                  <Table size="sm">
                    <Thead>
                      <Tr>
                        <Th>Recipient</Th>
                        <Th>Outcome</Th>
                        <Th>Reason</Th>
                        <Th>Time</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {runRows.length === 0 ? (
                        <Tr><Td colSpan={4} color="gray.500">No recent attempts in this window.</Td></Tr>
                      ) : (
                        runRows.slice(0, 14).map((row, idx) => (
                          <Tr key={`${row.recipientEmail || 'unknown'}-${row.createdAt || idx}`}>
                            <Td>{row.recipientEmail || 'unknown'}</Td>
                            <Td>{row.decision || '—'}</Td>
                            <Td>{row.reason || '—'}</Td>
                            <Td>{row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}</Td>
                          </Tr>
                        ))
                      )}
                    </Tbody>
                  </Table>
                </Box>
              </CardBody>
            </Card>
          </SimpleGrid>
        </VStack>
      </Box>
    </RequireActiveClient>
  )
}

export default ReportsTab
