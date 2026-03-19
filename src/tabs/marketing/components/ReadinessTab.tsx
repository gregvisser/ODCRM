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
import { useEffectiveCustomerId } from '../../../hooks/useCustomerScope'
import RequireActiveClient from '../../../components/RequireActiveClient'

type SequenceOption = {
  id: string
  name?: string | null
}

type ExceptionCenterData = {
  statusSummary?: {
    openGroups?: number
    high?: number
    medium?: number
    low?: number
  }
  groups?: Array<{
    key?: string
    title?: string
    severity?: string
    count?: number
    nextStep?: {
      target?: string
      label?: string
    }
    samples?: Array<{
      recipientEmail?: string | null
      reason?: string | null
      sequenceName?: string | null
    }>
  }>
  lastUpdatedAt?: string
}

type SequencePreflightData = {
  overallStatus?: string
  blockers?: string[]
  warnings?: string[]
  counts?: {
    eligible?: number
    excluded?: number
    blocked?: number
  }
  lastUpdatedAt?: string
}

type LaunchPreviewData = {
  summary?: {
    firstBatchCount?: number
    excludedCount?: number
    notReadyCount?: number
  }
  firstBatch?: Array<{
    recipientEmail?: string | null
    identityEmail?: string | null
    reason?: string | null
  }>
  excluded?: Array<{
    recipientEmail?: string | null
    reason?: string | null
  }>
  lastUpdatedAt?: string
}

type PreviewVsOutcomeData = {
  summary?: {
    matched?: number
    previewOnly?: number
    outcomeOnly?: number
  }
  lastUpdatedAt?: string
}

type IdentityCapacityData = {
  summary?: {
    total?: number
    usable?: number
    unavailable?: number
    risky?: number
  }
  lastUpdatedAt?: string
}

type RunHistoryData = {
  summary?: {
    totalRows?: number
    SENT?: number
    SEND_FAILED?: number
    SKIP_SUPPRESSED?: number
    SKIP_REPLIED_STOP?: number
  }
  rows?: Array<{
    recipientEmail?: string | null
    decision?: string | null
    reason?: string | null
    createdAt?: string | null
  }>
  lastUpdatedAt?: string
}

const ReadinessTab: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sequences, setSequences] = useState<SequenceOption[]>([])
  const [selectedSequenceId, setSelectedSequenceId] = useState<string>('')
  const [exceptionCenterData, setExceptionCenterData] = useState<ExceptionCenterData | null>(null)
  const [preflightData, setPreflightData] = useState<SequencePreflightData | null>(null)
  const [launchPreviewData, setLaunchPreviewData] = useState<LaunchPreviewData | null>(null)
  const [comparisonData, setComparisonData] = useState<PreviewVsOutcomeData | null>(null)
  const [identityCapacityData, setIdentityCapacityData] = useState<IdentityCapacityData | null>(null)
  const [runHistoryData, setRunHistoryData] = useState<RunHistoryData | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>('')

  const customerId = useEffectiveCustomerId()

  const openSequencesTab = useCallback((target?: string) => {
    const focusPanelByTarget: Record<string, string> = {
      'preflight': 'sequence-preflight-panel',
      'launch-preview': 'launch-preview-panel',
      'preview-vs-outcome': 'preview-vs-outcome-panel',
      'run-history': 'run-history-panel',
      'queue-workbench-blocked': 'queue-workbench-panel',
      'queue-workbench-failed': 'queue-workbench-panel',
      'identity-capacity': 'identity-capacity-panel',
      'exception-center': 'exception-center-panel',
    }
    const params = new URLSearchParams(window.location.search)
    params.set('view', 'sequences')
    if (selectedSequenceId) {
      params.set('sequenceId', selectedSequenceId)
    }
    if (target) {
      const panelId = focusPanelByTarget[target] || target
      params.set('focusPanel', panelId)
    }
    window.location.search = params.toString()
  }, [selectedSequenceId])

  const openMarketingTab = useCallback((view: 'sequences' | 'inbox' | 'reports', target?: string) => {
    const params = new URLSearchParams(window.location.search)
    params.set('view', view)
    if (selectedSequenceId) {
      params.set('sequenceId', selectedSequenceId)
    }
    if (target) {
      params.set('focusPanel', target)
    }
    window.location.search = params.toString()
  }, [selectedSequenceId])

  const loadData = useCallback(async (isRefresh = false) => {
    if (!customerId?.startsWith('cust_')) {
      setError('Select an active client to view readiness.')
      return
    }

    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)

    const headers = { 'X-Customer-Id': customerId }
    const sequenceRes = await api.get<SequenceOption[] | { data?: SequenceOption[] }>('/api/sequences', { headers })
    if (sequenceRes.error) {
      setError(sequenceRes.error)
      setLoading(false)
      setRefreshing(false)
      return
    }
    const rawSequences = Array.isArray(sequenceRes.data) ? sequenceRes.data : Array.isArray(sequenceRes.data?.data) ? sequenceRes.data.data : []
    const validSequences = rawSequences.filter((row) => typeof row?.id === 'string' && String(row.id).trim().length > 0)
    setSequences(validSequences)
    const effectiveSequenceId = selectedSequenceId || validSequences[0]?.id || ''
    if (!selectedSequenceId && effectiveSequenceId) {
      setSelectedSequenceId(effectiveSequenceId)
    }

    const sinceHours = 24
    const queries: Array<Promise<any>> = [
      api.get<{ success?: boolean; data?: ExceptionCenterData }>(`/api/send-worker/exception-center?sinceHours=${sinceHours}${effectiveSequenceId ? `&sequenceId=${encodeURIComponent(effectiveSequenceId)}` : ''}`, { headers }),
      api.get<{ success?: boolean; data?: IdentityCapacityData }>(`/api/send-worker/identity-capacity?sinceHours=${sinceHours}`, { headers }),
      api.get<{ success?: boolean; data?: RunHistoryData }>(`/api/send-worker/run-history?sinceHours=${sinceHours}&limit=30${effectiveSequenceId ? `&sequenceId=${encodeURIComponent(effectiveSequenceId)}` : ''}`, { headers }),
    ]
    if (effectiveSequenceId) {
      queries.push(api.get<{ success?: boolean; data?: SequencePreflightData }>(`/api/send-worker/sequence-preflight?sequenceId=${encodeURIComponent(effectiveSequenceId)}&sinceHours=${sinceHours}`, { headers }))
      queries.push(api.get<{ success?: boolean; data?: LaunchPreviewData }>(`/api/send-worker/launch-preview?sequenceId=${encodeURIComponent(effectiveSequenceId)}&sinceHours=${sinceHours}&batchLimit=15`, { headers }))
      queries.push(api.get<{ success?: boolean; data?: PreviewVsOutcomeData }>(`/api/send-worker/preview-vs-outcome?sequenceId=${encodeURIComponent(effectiveSequenceId)}&sinceHours=${sinceHours}&batchLimit=15&outcomeLimit=80`, { headers }))
    }

    const results = await Promise.all(queries)
    const firstErr = results.find((res) => res?.error)
    if (firstErr?.error) {
      setError(firstErr.error)
      setLoading(false)
      setRefreshing(false)
      return
    }

    // api.get unwraps { data: T } — payload is results[i].data, not .data.data
    setExceptionCenterData(results[0]?.data ?? null)
    setIdentityCapacityData(results[1]?.data ?? null)
    setRunHistoryData(results[2]?.data ?? null)
    setPreflightData(results[3]?.data ?? null)
    setLaunchPreviewData(results[4]?.data ?? null)
    setComparisonData(results[5]?.data ?? null)
    setLastUpdatedAt(new Date().toISOString())
    setLoading(false)
    setRefreshing(false)
  }, [customerId, selectedSequenceId])

  useEffect(() => {
    void loadData(false)
  }, [loadData])

  useEffect(() => {
    if (!selectedSequenceId) return
    if (!customerId?.startsWith('cust_')) return
    const sequenceStillExists = sequences.some((row) => row.id === selectedSequenceId)
    if (!sequenceStillExists && sequences[0]?.id) {
      setSelectedSequenceId(sequences[0].id)
    }
  }, [selectedSequenceId, sequences, customerId])

  const topExceptionGroups = useMemo(() => (exceptionCenterData?.groups ?? []).slice(0, 4), [exceptionCenterData])

  const runHistoryRows = runHistoryData?.rows ?? []
  const previewCandidates = launchPreviewData?.firstBatch ?? []
  const previewExcluded = launchPreviewData?.excluded ?? []
  const preflightBlockers = preflightData?.blockers ?? []
  const preflightWarnings = preflightData?.warnings ?? []
  const hasSelectedSequence = selectedSequenceId.trim().length > 0

  if (!customerId || !customerId.startsWith('cust_')) {
    return (
      <RequireActiveClient>
        <Box py={6}>
          <Text>Select an active client to open Readiness.</Text>
        </Box>
      </RequireActiveClient>
    )
  }

  return (
    <RequireActiveClient>
      <Box id="readiness-tab-panel" data-testid="readiness-tab-panel">
        <VStack align="stretch" spacing={4}>
          <Card id="readiness-tab-cockpit" data-testid="readiness-tab-cockpit">
            <CardHeader>
              <HStack justify="space-between" align="center" flexWrap="wrap" gap={3}>
                <VStack align="start" spacing={0}>
                  <Heading size="md">Readiness: Is this sequence ready to run?</Heading>
                  <Text fontSize="sm" color="gray.600" data-testid="readiness-tab-operator-cue">
                    Start with launch status, blockers, and the first-batch preview. Troubleshooting and follow-up details are kept lower down.
                  </Text>
                </VStack>
                <HStack>
                  <Select
                    id="readiness-tab-sequence-select"
                    data-testid="readiness-tab-sequence-select"
                    size="sm"
                    value={selectedSequenceId}
                    onChange={(event) => setSelectedSequenceId(event.target.value)}
                    minW="240px"
                  >
                    {sequences.length === 0 ? (
                      <option value="">No sequence available</option>
                    ) : (
                      sequences.map((row) => (
                        <option key={row.id} value={row.id}>{row.name || row.id}</option>
                      ))
                    )}
                  </Select>
                  <Button
                    size="sm"
                    leftIcon={refreshing ? <Spinner size="xs" /> : undefined}
                    id="readiness-tab-refresh-btn"
                    data-testid="readiness-tab-refresh-btn"
                    onClick={() => void loadData(true)}
                    isLoading={refreshing}
                  >
                    Refresh
                  </Button>
                </HStack>
              </HStack>
            </CardHeader>
            <CardBody>
              {loading ? (
                <HStack><Spinner size="sm" /><Text>Loading readiness checks…</Text></HStack>
              ) : null}
              {error ? (
                <Alert status="error" mb={3}>
                  <AlertIcon />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <SimpleGrid id="readiness-tab-summary-cards" data-testid="readiness-tab-summary-cards" columns={{ base: 2, md: 2, lg: 4 }} spacing={3}>
                <Stat borderWidth="1px" borderRadius="md" p={3}>
                  <StatLabel>Launch Status</StatLabel>
                  <StatNumber id="readiness-tab-launch-status" data-testid="readiness-tab-launch-status">
                    {preflightData?.overallStatus || 'UNKNOWN'}
                  </StatNumber>
                </Stat>
                <Stat borderWidth="1px" borderRadius="md" p={3}>
                  <StatLabel>Issues to Review</StatLabel>
                  <StatNumber>{exceptionCenterData?.statusSummary?.openGroups ?? 0}</StatNumber>
                </Stat>
                <Stat borderWidth="1px" borderRadius="md" p={3}>
                  <StatLabel>Ready Mailboxes</StatLabel>
                  <StatNumber>{identityCapacityData?.summary?.usable ?? 0}</StatNumber>
                </Stat>
                <Stat borderWidth="1px" borderRadius="md" p={3}>
                  <StatLabel>Ready in First Batch</StatLabel>
                  <StatNumber>{launchPreviewData?.summary?.firstBatchCount ?? previewCandidates.length}</StatNumber>
                </Stat>
              </SimpleGrid>

              {hasSelectedSequence && !error && !loading ? (
                <HStack mt={3} spacing={3} flexWrap="wrap" align="stretch">
                  <Alert status={preflightBlockers.length > 0 ? 'error' : preflightWarnings.length > 0 ? 'warning' : 'success'} variant="left-accent" flex="1" minW="280px">
                    <AlertIcon />
                    <AlertDescription>
                      {preflightBlockers.length > 0
                        ? `${preflightBlockers.length} blocker${preflightBlockers.length === 1 ? '' : 's'} must be cleared before launch.`
                        : preflightWarnings.length > 0
                          ? `${preflightWarnings.length} warning${preflightWarnings.length === 1 ? '' : 's'} should be reviewed before launch.`
                          : 'No launch blockers are showing for the selected sequence.'}
                    </AlertDescription>
                  </Alert>
                  <Alert status={(launchPreviewData?.summary?.notReadyCount ?? 0) > 0 ? 'warning' : 'info'} variant="left-accent" flex="1" minW="280px">
                    <AlertIcon />
                    <AlertDescription>
                      {(launchPreviewData?.summary?.notReadyCount ?? 0) > 0
                        ? `${launchPreviewData?.summary?.notReadyCount ?? 0} recipient${(launchPreviewData?.summary?.notReadyCount ?? 0) === 1 ? '' : 's'} are still not ready in the current launch preview.`
                        : `${launchPreviewData?.summary?.firstBatchCount ?? previewCandidates.length} recipient${(launchPreviewData?.summary?.firstBatchCount ?? previewCandidates.length) === 1 ? '' : 's'} are currently lined up in the first batch preview.`}
                    </AlertDescription>
                  </Alert>
                </HStack>
              ) : null}

              {!hasSelectedSequence && (
                <Alert status="info" mt={3} id="readiness-tab-no-sequence" data-testid="readiness-tab-no-sequence">
                  <AlertIcon />
                  <AlertDescription>
                    No sequence is selected yet. Choose or create a sequence in Sequences before running preflight and launch checks.
                  </AlertDescription>
                </Alert>
              )}

              <Text id="readiness-tab-last-updated" data-testid="readiness-tab-last-updated" fontSize="xs" color="gray.500" mt={3}>
                Last updated: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString() : '—'}
              </Text>
            </CardBody>
          </Card>

          <Card id="readiness-tab-next-actions" data-testid="readiness-tab-next-actions">
            <CardHeader>
              <Heading size="sm">What to fix first</Heading>
            </CardHeader>
            <CardBody>
              {topExceptionGroups.length === 0 ? (
                <VStack align="stretch" spacing={2}>
                  <Text color="gray.500">No priority issues were found in this window. If the checks below also look clear, continue in Sequences or review recent results.</Text>
                  <HStack>
                    <Button size="xs" variant="outline" data-testid="readiness-tab-go-reports" onClick={() => openMarketingTab('reports')}>
                      Open Reports
                    </Button>
                    <Button size="xs" variant="outline" data-testid="readiness-tab-go-inbox" onClick={() => openMarketingTab('inbox')}>
                      Open Inbox
                    </Button>
                  </HStack>
                </VStack>
              ) : (
                <VStack align="stretch" spacing={2}>
                  {topExceptionGroups.map((group, index) => (
                    <HStack key={`${group.key || 'group'}-${index}`} justify="space-between" borderWidth="1px" borderRadius="md" p={2}>
                      <HStack>
                        <Badge colorScheme={group.severity === 'high' ? 'red' : group.severity === 'medium' ? 'orange' : 'blue'}>
                          {(group.severity || 'info').toUpperCase()}
                        </Badge>
                        <Text>{group.title || group.key || 'Exception group'}</Text>
                        <Badge>{group.count ?? 0}</Badge>
                      </HStack>
                      <Button
                        size="xs"
                        id="readiness-tab-next-step-link"
                        data-testid="readiness-tab-next-step-link"
                        data-next-target={group.nextStep?.target || 'sequences'}
                        onClick={() => openSequencesTab(group.nextStep?.target)}
                      >
                        {group.nextStep?.label || 'Open Sequences'}
                      </Button>
                    </HStack>
                  ))}
                </VStack>
              )}
            </CardBody>
          </Card>

          <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={4}>
            <Card id="readiness-tab-preflight" data-testid="readiness-tab-preflight">
              <CardHeader><Heading size="sm">Check before launch</Heading></CardHeader>
              <CardBody>
                <VStack align="stretch" spacing={2}>
                  <Text fontSize="sm" color="gray.600">
                    Review launch blockers first. If this section is clear, move on to the launch preview.
                  </Text>
                  <Box>
                    <Text fontWeight="semibold">Blockers</Text>
                    {preflightBlockers.length === 0 ? <Text color="gray.500">None</Text> : preflightBlockers.slice(0, 5).map((row, idx) => <Text key={`b-${idx}`}>• {row}</Text>)}
                  </Box>
                  <Box>
                    <Text fontWeight="semibold">Warnings</Text>
                    {preflightWarnings.length === 0 ? <Text color="gray.500">None</Text> : preflightWarnings.slice(0, 5).map((row, idx) => <Text key={`w-${idx}`}>• {row}</Text>)}
                  </Box>
                  <Button
                    size="sm"
                    variant="outline"
                    id="readiness-tab-open-preflight"
                    data-testid="readiness-tab-open-preflight"
                    data-focus-target="sequence-preflight-panel"
                    isDisabled={!hasSelectedSequence}
                    onClick={() => openSequencesTab('preflight')}
                  >
                    Review full preflight
                  </Button>
                </VStack>
              </CardBody>
            </Card>

            <Card id="readiness-tab-launch-preview" data-testid="readiness-tab-launch-preview">
              <CardHeader><Heading size="sm">Who would send next</Heading></CardHeader>
              <CardBody>
                <VStack align="stretch" spacing={2}>
                  <Text fontSize="sm" color="gray.600">
                    Confirm who is up first and which rows are excluded before you run anything.
                  </Text>
                  <HStack>
                    <Badge>Candidates {launchPreviewData?.summary?.firstBatchCount ?? previewCandidates.length}</Badge>
                    <Badge colorScheme="orange">Excluded {launchPreviewData?.summary?.excludedCount ?? previewExcluded.length}</Badge>
                  </HStack>
                  <Box>
                    <Text fontWeight="semibold">First up</Text>
                    {previewCandidates.length === 0 ? (
                      <Text color="gray.500">No candidate rows for this window.</Text>
                    ) : (
                      previewCandidates.slice(0, 4).map((row, idx) => (
                        <Text key={`pc-${idx}`}>{row.recipientEmail || 'unknown'} {row.identityEmail ? `via ${row.identityEmail}` : ''}</Text>
                      ))
                    )}
                  </Box>
                  <Button
                    size="sm"
                    variant="outline"
                    id="readiness-tab-open-launch-preview"
                    data-testid="readiness-tab-open-launch-preview"
                    data-focus-target="launch-preview-panel"
                    isDisabled={!hasSelectedSequence}
                    onClick={() => openSequencesTab('launch-preview')}
                  >
                    Review full launch preview
                  </Button>
                </VStack>
              </CardBody>
            </Card>
          </SimpleGrid>

          <Card
            id="readiness-tab-troubleshooting"
            data-testid="readiness-tab-troubleshooting"
            variant="outline"
            borderColor="gray.200"
            bg="gray.50"
          >
            <CardHeader>
              <VStack align="start" spacing={1}>
                <Heading size="sm">Troubleshooting & follow-up</Heading>
                <Text fontSize="sm" color="gray.600">
                  Secondary checks for explaining unexpected results, reviewing recent send outcomes, and deciding where to investigate next.
                </Text>
              </VStack>
            </CardHeader>
            <CardBody pt={0}>
              <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={4}>
                <Card id="readiness-tab-preview-vs-outcome" data-testid="readiness-tab-preview-vs-outcome">
                  <CardHeader><Heading size="sm">Did actual sends match the preview?</Heading></CardHeader>
                  <CardBody>
                    <Text fontSize="sm" color="gray.600" mb={2}>
                      Use this after a run when the outcome looks different from what the launch preview suggested.
                    </Text>
                    <SimpleGrid columns={3} spacing={2}>
                      <Stat borderWidth="1px" borderRadius="md" p={2}><StatLabel>Matched</StatLabel><StatNumber>{comparisonData?.summary?.matched ?? 0}</StatNumber></Stat>
                      <Stat borderWidth="1px" borderRadius="md" p={2}><StatLabel>Preview Only</StatLabel><StatNumber>{comparisonData?.summary?.previewOnly ?? 0}</StatNumber></Stat>
                      <Stat borderWidth="1px" borderRadius="md" p={2}><StatLabel>Outcome Only</StatLabel><StatNumber>{comparisonData?.summary?.outcomeOnly ?? 0}</StatNumber></Stat>
                    </SimpleGrid>
                    <Button
                      mt={3}
                      size="sm"
                      variant="outline"
                      id="readiness-tab-open-comparison"
                      data-testid="readiness-tab-open-comparison"
                      data-focus-target="preview-vs-outcome-panel"
                      isDisabled={!hasSelectedSequence}
                      onClick={() => openSequencesTab('preview-vs-outcome')}
                    >
                      Open preview comparison
                    </Button>
                  </CardBody>
                </Card>

                <Card id="readiness-tab-run-history" data-testid="readiness-tab-run-history">
                  <CardHeader><Heading size="sm">Recent send outcomes</Heading></CardHeader>
                  <CardBody>
                    <Text fontSize="sm" color="gray.600" mb={2}>
                      Use recent outcomes to review failures, skipped sends, or follow-up work after a run.
                    </Text>
                    <SimpleGrid columns={{ base: 2, md: 4 }} spacing={2} mb={3}>
                      <Stat borderWidth="1px" borderRadius="md" p={2}>
                        <StatLabel>Recent failures</StatLabel>
                        <StatNumber>{runHistoryData?.summary?.SEND_FAILED ?? 0}</StatNumber>
                      </Stat>
                      <Stat borderWidth="1px" borderRadius="md" p={2}>
                        <StatLabel>Matched preview</StatLabel>
                        <StatNumber>{comparisonData?.summary?.matched ?? 0}</StatNumber>
                      </Stat>
                      <Stat borderWidth="1px" borderRadius="md" p={2}>
                        <StatLabel>Suppressed</StatLabel>
                        <StatNumber>{runHistoryData?.summary?.SKIP_SUPPRESSED ?? 0}</StatNumber>
                      </Stat>
                      <Stat borderWidth="1px" borderRadius="md" p={2}>
                        <StatLabel>Reply stopped</StatLabel>
                        <StatNumber>{runHistoryData?.summary?.SKIP_REPLIED_STOP ?? 0}</StatNumber>
                      </Stat>
                    </SimpleGrid>
                    <Box overflowX="auto">
                      <Table size="sm">
                        <Thead>
                          <Tr>
                            <Th>Recipient</Th>
                            <Th>Outcome</Th>
                            <Th>Reason</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {runHistoryRows.length === 0 ? (
                            <Tr><Td colSpan={3} color="gray.500">No recent outcome rows.</Td></Tr>
                          ) : (
                            runHistoryRows.slice(0, 6).map((row, idx) => (
                              <Tr key={`rh-${idx}`}>
                                <Td>{row.recipientEmail || 'unknown'}</Td>
                                <Td>{row.decision || '—'}</Td>
                                <Td>{row.reason || '—'}</Td>
                              </Tr>
                            ))
                          )}
                        </Tbody>
                      </Table>
                    </Box>
                    <Button
                      mt={3}
                      size="sm"
                      variant="outline"
                      id="readiness-tab-open-run-history"
                      data-testid="readiness-tab-open-run-history"
                      data-focus-target="run-history-panel"
                      isDisabled={!hasSelectedSequence}
                      onClick={() => openSequencesTab('run-history')}
                    >
                      Open run history
                    </Button>
                    <HStack mt={2}>
                      <Button size="xs" variant="ghost" onClick={() => openMarketingTab('reports')} data-testid="readiness-tab-open-reports-followup">
                        Review Reports
                      </Button>
                      <Button size="xs" variant="ghost" onClick={() => openMarketingTab('inbox')} data-testid="readiness-tab-open-inbox-followup">
                        Review Inbox
                      </Button>
                    </HStack>
                  </CardBody>
                </Card>
              </SimpleGrid>
            </CardBody>
          </Card>
        </VStack>
      </Box>
    </RequireActiveClient>
  )
}

export default ReadinessTab
