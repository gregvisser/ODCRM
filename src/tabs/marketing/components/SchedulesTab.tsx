import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Grid,
  Heading,
  HStack,
  SimpleGrid,
  Spinner,
  Stack,
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
  useToast,
} from '@chakra-ui/react'
import { RepeatIcon } from '@chakra-ui/icons'
import RequireActiveClient from '../../../components/RequireActiveClient'
import { useScopedCustomerSelection } from '../../../hooks/useCustomerScope'
import { api } from '../../../utils/api'

type SenderIdentity = {
  id: string
  emailAddress: string
  displayName?: string | null
  dailySendLimit: number
  sendWindowHoursStart?: number | null
  sendWindowHoursEnd?: number | null
  sendWindowTimeZone?: string | null
  warmup?: {
    effectiveDailySendCap: number
    warmupStatus: 'paused' | 'active' | 'complete'
    warmupLimitReason: string | null
  } | null
}

type CampaignSchedule = {
  id: string
  customerId: string
  name: string
  description?: string | null
  status: 'draft' | 'running' | 'paused' | 'completed'
  sequenceId: string | null
  sequenceName: string | null
  listName?: string | null
  senderIdentity: SenderIdentity | null
  sequenceSenderIdentity: SenderIdentity | null
  mailboxMismatch: boolean
  nextScheduledAt: string | null
  totalProspects: number
  createdAt: string
  updatedAt: string
}

type ScheduledEmail = {
  id: string
  campaignId: string
  campaignName: string
  prospectEmail: string
  prospectName: string
  scheduledFor: string | null
  status: 'scheduled' | 'sent' | 'failed'
  senderIdentity?: {
    id: string
    emailAddress: string
    displayName?: string | null
  } | null
  stepNumber: number
}

type ScheduleStats = {
  campaignId: string
  status: string
  sequenceId: string | null
  sequenceName: string | null
  totalProspects: number
  upcomingSends: number
  nextScheduledAt: string | null
  sentSends: number
  todaySent: number
  dailyLimit: number
  senderIdentity: {
    id: string
    emailAddress: string
    dailySendLimit: number
  } | null
}

type SequencePreflightData = {
  overallStatus: 'GO' | 'WARNING' | 'NO_GO'
  blockers: string[]
  warnings: string[]
  counts: {
    eligible: number
    blocked: number
    suppressed: number
    replyStopped: number
    failedRecently: number
    sentRecently: number
  }
  lastUpdatedAt?: string
}

type RunHistoryRow = {
  auditId: string
  recipientEmail: string | null
  outcome: string
  reason: string | null
  occurredAt: string
  identityEmail: string | null
  lastError: string | null
}

type RunHistoryData = {
  summary?: {
    byOutcome?: Record<string, number>
  }
  rows: RunHistoryRow[]
}

const DETAIL_SINCE_HOURS = 72

function statusColor(status: CampaignSchedule['status']): string {
  switch (status) {
    case 'running':
      return 'green'
    case 'paused':
      return 'yellow'
    case 'completed':
      return 'gray'
    default:
      return 'purple'
  }
}

function humanizeStatus(status: CampaignSchedule['status']): string {
  switch (status) {
    case 'running':
      return 'Active'
    case 'paused':
      return 'Paused'
    case 'completed':
      return 'Stopped'
    default:
      return 'Draft'
  }
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Not scheduled'
  return new Date(value).toLocaleString()
}

function displayMailbox(identity: SenderIdentity | null | undefined): string {
  if (!identity) return 'No mailbox connected'
  return identity.displayName ? `${identity.displayName} <${identity.emailAddress}>` : identity.emailAddress
}

function humanizeGateReason(reason: string | null | undefined): string {
  switch ((reason || '').trim()) {
    case 'manual_live_tick_not_allowed':
    case 'live_send_not_allowed':
      return 'Immediate live sending is not allowed for this client right now.'
    case 'customer_not_in_canary':
      return 'Live sending is not enabled for this client right now.'
    case 'identity_not_in_canary':
      return 'The sending mailbox is not enabled for live sending right now.'
    case 'live_send_disabled':
    case 'ENABLE_LIVE_SENDING is not true':
      return 'Live sending is disabled right now.'
    case 'ENABLE_SEND_QUEUE_SENDING is not true':
      return 'The sending engine is currently disabled.'
    case 'ignore_window_not_enabled':
      return 'Immediate send override is not enabled in this environment.'
    case 'sequence_has_no_sender_identity':
      return 'This linked sequence does not have a sending mailbox yet.'
    case 'sequence_not_found':
      return 'The linked sequence was not found for this client.'
    default:
      return reason || 'This action is currently blocked.'
  }
}

function humanizeRunOutcome(outcome: string): string {
  switch (outcome) {
    case 'SENT':
      return 'Sent'
    case 'SEND_FAILED':
      return 'Failed'
    case 'SKIP_SUPPRESSED':
      return 'Suppressed'
    case 'SKIP_REPLIED_STOP':
      return 'Reply stopped'
    case 'SKIP_INVALID_RECIPIENT':
      return 'Invalid recipient'
    default:
      return outcome.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
  }
}

function humanizeRunReason(reason: string | null | undefined): string {
  switch ((reason || '').trim()) {
    case 'outside_send_window':
    case 'outside_window':
      return 'Queued for a later retry.'
    case 'daily_cap_reached':
      return 'Blocked because the mailbox reached its daily limit.'
    case 'per_minute_cap_reached':
      return 'Blocked because the mailbox hit its short-term send cap.'
    case 'suppressed':
      return 'Blocked by the client suppression list.'
    case 'SKIP_REPLIED_STOP':
      return 'Stopped because the contact already replied.'
    case 'hard_bounce_invalid_recipient':
    case 'invalid_recipient':
      return 'Blocked because the recipient address is invalid.'
    case 'no_sender_identity':
      return 'Blocked because no active sending mailbox is available.'
    case 'canary_required_when_live_sending':
    case 'customer_not_in_canary':
      return 'Blocked because live sending is not enabled for this client right now.'
    default:
      return reason || 'No extra detail available.'
  }
}

function getPrimaryScheduleMessage(
  schedule: CampaignSchedule,
  preflight: SequencePreflightData | null,
): { tone: 'info' | 'warning' | 'error' | 'success'; text: string } {
  if (!schedule.senderIdentity) {
    return { tone: 'warning', text: 'This schedule does not have a sending mailbox connected yet.' }
  }
  if (schedule.status === 'paused') {
    return { tone: 'info', text: 'This schedule is paused and will not send until you resume it.' }
  }
  if (schedule.mailboxMismatch) {
    return {
      tone: 'warning',
      text: 'This schedule and its linked sequence use different mailboxes. Test now is disabled until they match.',
    }
  }
  if (preflight?.overallStatus === 'NO_GO' && preflight.blockers.length > 0) {
    return { tone: 'error', text: preflight.blockers[0] }
  }
  if (preflight?.overallStatus === 'WARNING' && preflight.warnings.length > 0) {
    return { tone: 'warning', text: preflight.warnings[0] }
  }
  if (schedule.nextScheduledAt) {
    return { tone: 'success', text: `Next send is due ${formatDateTime(schedule.nextScheduledAt)}.` }
  }
  return { tone: 'info', text: 'No send is currently queued for this schedule.' }
}

function scheduleNeedsAttention(schedule: CampaignSchedule): boolean {
  return !schedule.senderIdentity || schedule.mailboxMismatch
}

function getOperatorScheduleStatus(schedule: CampaignSchedule): {
  colorScheme: 'green' | 'yellow' | 'orange' | 'gray'
  label: string
  description: string
} {
  if (!schedule.senderIdentity) {
    return {
      colorScheme: 'orange',
      label: 'Needs mailbox',
      description: 'Connect a sending mailbox before this schedule can send.',
    }
  }
  if (schedule.mailboxMismatch) {
    return {
      colorScheme: 'orange',
      label: 'Needs attention',
      description: 'The schedule and linked sequence are using different mailboxes.',
    }
  }
  if (schedule.status === 'paused') {
    return {
      colorScheme: 'yellow',
      label: 'Paused',
      description: 'This schedule is paused until you resume it.',
    }
  }
  if (schedule.nextScheduledAt) {
    return {
      colorScheme: 'green',
      label: 'Sending next',
      description: `Next send is due ${formatDateTime(schedule.nextScheduledAt)}.`,
    }
  }
  return {
    colorScheme: 'gray',
    label: 'Waiting',
    description: 'This schedule is active but nothing is queued to send right now.',
  }
}

const SchedulesTab: React.FC = () => {
  const { customerId: scopedCustomerId, customerHeaders } = useScopedCustomerSelection()
  const [schedules, setSchedules] = useState<CampaignSchedule[]>([])
  const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmail[]>([])
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null)
  const [scheduleStats, setScheduleStats] = useState<ScheduleStats | null>(null)
  const [preflightData, setPreflightData] = useState<SequencePreflightData | null>(null)
  const [runHistoryData, setRunHistoryData] = useState<RunHistoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)
  const [busyScheduleId, setBusyScheduleId] = useState<string | null>(null)
  const [testSendLoadingId, setTestSendLoadingId] = useState<string | null>(null)
  const toast = useToast()

  const loadData = useCallback(async (isManualRefresh = false) => {
    if (!scopedCustomerId?.startsWith('cust_')) {
      setSchedules([])
      setScheduledEmails([])
      setSelectedScheduleId(null)
      setError(null)
      setLoading(false)
      setRefreshing(false)
      return
    }

    try {
      if (isManualRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)

      const [schedulesRes, emailsRes] = await Promise.all([
        api.get<CampaignSchedule[]>('/api/schedules', { headers: customerHeaders }),
        api.get<ScheduledEmail[]>('/api/schedules/emails?limit=200', { headers: customerHeaders }),
      ])

      const firstError = schedulesRes.error || emailsRes.error || null
      if (firstError) setError(firstError)

      const nextSchedules = schedulesRes.data || []
      setSchedules(nextSchedules)
      setScheduledEmails(emailsRes.data || [])
      setSelectedScheduleId((current) => {
        if (current && nextSchedules.some((schedule) => schedule.id === current)) return current
        return nextSchedules[0]?.id ?? null
      })
      setLastUpdatedAt(new Date().toISOString())
    } catch (err) {
      console.error('Error loading schedules:', err)
      setError('Failed to load schedules')
      setSchedules([])
      setScheduledEmails([])
      setSelectedScheduleId(null)
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }, [scopedCustomerId, customerHeaders])

  const selectedSchedule = useMemo(
    () => schedules.find((schedule) => schedule.id === selectedScheduleId) ?? null,
    [schedules, selectedScheduleId],
  )

  const loadSelectedDetails = useCallback(async (schedule: CampaignSchedule | null) => {
    if (!schedule) {
      setScheduleStats(null)
      setPreflightData(null)
      setRunHistoryData(null)
      setDetailError(null)
      return
    }

    if (!scopedCustomerId?.startsWith('cust_')) {
      setScheduleStats(null)
      setPreflightData(null)
      setRunHistoryData(null)
      setDetailError(null)
      return
    }

    setDetailLoading(true)
    setDetailError(null)
    try {
      const requests: Array<Promise<any>> = [
        api.get<ScheduleStats>(`/api/schedules/${schedule.id}/stats`, { headers: customerHeaders }),
      ]
      if (schedule.sequenceId) {
        requests.push(
          api.get<SequencePreflightData>(
            `/api/send-worker/sequence-preflight?sequenceId=${encodeURIComponent(schedule.sequenceId)}&sinceHours=${DETAIL_SINCE_HOURS}`,
            { headers: customerHeaders },
          ),
        )
        requests.push(
          api.get<RunHistoryData>(
            `/api/send-worker/run-history?sequenceId=${encodeURIComponent(schedule.sequenceId)}&sinceHours=${DETAIL_SINCE_HOURS}&limit=12`,
            { headers: customerHeaders },
          ),
        )
      }

      const [statsRes, preflightRes, historyRes] = await Promise.all(requests)
      if (statsRes.error) {
        setDetailError(statsRes.error)
        setScheduleStats(null)
      } else {
        setScheduleStats(statsRes.data || null)
      }

      if (schedule.sequenceId) {
        if (preflightRes?.error) {
          setDetailError((current) => current || preflightRes.error)
          setPreflightData(null)
        } else {
          setPreflightData(preflightRes?.data ?? null)
        }

        if (historyRes?.error) {
          setDetailError((current) => current || historyRes.error)
          setRunHistoryData(null)
        } else {
          setRunHistoryData(historyRes?.data ?? { rows: [] })
        }
      } else {
        setPreflightData(null)
        setRunHistoryData(null)
      }
    } catch (err) {
      console.error('Error loading schedule detail:', err)
      setDetailError('Failed to load schedule detail')
      setScheduleStats(null)
      setPreflightData(null)
      setRunHistoryData(null)
    } finally {
      setDetailLoading(false)
    }
  }, [scopedCustomerId, customerHeaders])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    void loadSelectedDetails(selectedSchedule)
  }, [loadSelectedDetails, selectedSchedule])

  const handlePauseResume = async (schedule: CampaignSchedule) => {
    const action = schedule.status === 'running' ? 'pause' : 'resume'
    setBusyScheduleId(schedule.id)
    try {
      const res = await api.post(`/api/schedules/${schedule.id}/${action}`, {}, { headers: customerHeaders })
      if (res.error) {
        toast({
          title: `Failed to ${action} schedule`,
          description: res.error,
          status: 'error',
          duration: 5000,
        })
        return
      }
      toast({
        title: action === 'pause' ? 'Schedule paused' : 'Schedule resumed',
        description:
          action === 'pause'
            ? 'The schedule will stop sending until you resume it.'
            : 'The schedule is active again and can send when recipients are due.',
        status: 'success',
        duration: 4000,
      })
      await loadData(true)
    } catch (err) {
      console.error(`Error trying to ${action} schedule:`, err)
      toast({
        title: `Failed to ${action} schedule`,
        description: 'Please try again.',
        status: 'error',
        duration: 5000,
      })
    } finally {
      setBusyScheduleId(null)
    }
  }

  const handleTestNow = async (schedule: CampaignSchedule) => {
    if (!schedule.sequenceId) return
    setTestSendLoadingId(schedule.id)
    try {
      const res = await api.post<{
        success?: boolean
        data?: {
          sent?: number
          processed?: number
          requeued?: number
          failed?: number
          message?: string
        }
      }>('/api/send-worker/sequence-test-send', {
        sequenceId: schedule.sequenceId,
        limit: 3,
      }, { headers: customerHeaders })
      if (res.error) {
        toast({
          title: 'Test batch failed',
          description: humanizeGateReason(res.error),
          status: 'error',
          duration: 5000,
        })
        return
      }
      const payload = res.data
      const summary =
        payload?.message ||
        `Processed ${payload?.processed ?? 0}; sent ${payload?.sent ?? 0}; failed ${payload?.failed ?? 0}.`
      toast({
        title: (payload?.sent ?? 0) > 0 ? 'Test batch sent' : 'Test batch checked',
        description: summary,
        status: (payload?.sent ?? 0) > 0 ? 'success' : 'info',
        duration: 6000,
      })
      await loadData(true)
      await loadSelectedDetails(schedules.find((item) => item.id === schedule.id) ?? schedule)
    } catch (err) {
      console.error('Error sending schedule test batch:', err)
      toast({
        title: 'Test batch failed',
        description: 'Please try again.',
        status: 'error',
        duration: 5000,
      })
    } finally {
      setTestSendLoadingId(null)
    }
  }

  const selectedUpcomingEmails = useMemo(() => {
    if (!selectedSchedule) return []
    return scheduledEmails
      .filter((email) => email.campaignId === selectedSchedule.id)
      .slice(0, 8)
  }, [scheduledEmails, selectedSchedule])

  const listSummary = useMemo(() => {
    const nextScheduledAt = schedules
      .map((schedule) => schedule.nextScheduledAt)
      .filter((value): value is string => Boolean(value))
      .sort()[0] ?? null
    return {
      total: schedules.length,
      active: schedules.filter((schedule) => schedule.status === 'running').length,
      needsAttention: schedules.filter((schedule) => scheduleNeedsAttention(schedule)).length,
      nextScheduledAt,
    }
  }, [schedules])

  const selectedOutcomeSummary = runHistoryData?.summary?.byOutcome ?? {}
  const selectedCounts = preflightData?.counts
  const selectedMessage = selectedSchedule ? getPrimaryScheduleMessage(selectedSchedule, preflightData) : null
  const selectedOperatorStatus = selectedSchedule ? getOperatorScheduleStatus(selectedSchedule) : null

  const testNowState = useMemo(() => {
    if (!selectedSchedule) {
      return { enabled: false, reason: 'Select a schedule first.' }
    }
    if (!selectedSchedule.senderIdentity) {
      return { enabled: false, reason: 'This schedule does not have a sending mailbox connected yet.' }
    }
    if (!selectedSchedule.sequenceId) {
      return { enabled: false, reason: 'This schedule is not linked to a queue-backed sequence yet.' }
    }
    if (!selectedSchedule.sequenceSenderIdentity) {
      return { enabled: false, reason: 'The linked sequence does not have a sending mailbox yet.' }
    }
    if (selectedSchedule.mailboxMismatch) {
      return {
        enabled: false,
        reason: 'Test now is disabled because the schedule mailbox and sequence mailbox do not match.',
      }
    }
    return { enabled: true, reason: null }
  }, [selectedSchedule])

  if (loading) {
    return (
      <RequireActiveClient>
        <Box textAlign="center" py={10}>
          <Spinner size="lg" />
          <Text mt={3}>Loading schedules...</Text>
        </Box>
      </RequireActiveClient>
    )
  }

  return (
    <RequireActiveClient>
      <Box id="schedules-tab-panel" data-testid="schedules-tab-panel">
        {error ? (
          <Alert status="warning" mb={4} borderRadius="md">
            <AlertIcon />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Flex justify="space-between" align={{ base: 'start', md: 'center' }} mb={6} gap={4} wrap="wrap">
          <VStack align="start" spacing={1}>
            <Heading size="lg">Schedules</Heading>
            <Text color="gray.600">
              See which schedules are active or paused, which mailbox and sequence each one uses, and what should happen next.
            </Text>
          </VStack>
        </Flex>

        {!schedules.length ? (
          <Alert status="info" mb={4} borderRadius="md">
            <AlertIcon />
            <Box>
              <AlertTitle>No schedules to review yet</AlertTitle>
              <AlertDescription>
                This list only shows <strong>running or paused</strong> campaigns that are <strong>linked to a sequence</strong>. Draft or completed campaigns won’t appear here. Start from a live outreach campaign or linked sequence, then return here to monitor sending and manage schedule status.
              </AlertDescription>
            </Box>
          </Alert>
        ) : listSummary.needsAttention > 0 ? (
          <Alert status="warning" mb={4} borderRadius="md">
            <AlertIcon />
            <Box>
              <AlertTitle>Some schedules need attention</AlertTitle>
              <AlertDescription>
                {listSummary.needsAttention} schedule{listSummary.needsAttention === 1 ? '' : 's'} need review before normal sending can continue.
              </AlertDescription>
            </Box>
          </Alert>
        ) : listSummary.active > 0 ? (
          <Alert status="success" mb={4} borderRadius="md">
            <AlertIcon />
            <Box>
              <AlertTitle>Schedules are ready to monitor</AlertTitle>
              <AlertDescription>
                Active schedules have a mailbox assigned and can keep sending when recipients are due.
              </AlertDescription>
            </Box>
          </Alert>
        ) : (
          <Alert status="info" mb={4} borderRadius="md">
            <AlertIcon />
            <Box>
              <AlertTitle>All schedules are paused</AlertTitle>
              <AlertDescription>
                Review a schedule below when you are ready to resume sending or check what will happen next.
              </AlertDescription>
            </Box>
          </Alert>
        )}

        <SimpleGrid columns={{ base: 2, xl: 4 }} spacing={4} mb={6}>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Schedules</StatLabel>
                <StatNumber>{listSummary.total}</StatNumber>
              </Stat>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Active now</StatLabel>
                <StatNumber>{listSummary.active}</StatNumber>
              </Stat>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Need attention</StatLabel>
                <StatNumber>{listSummary.needsAttention}</StatNumber>
              </Stat>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Next send due</StatLabel>
                <StatNumber fontSize="lg">{listSummary.nextScheduledAt ? formatDateTime(listSummary.nextScheduledAt) : 'None queued'}</StatNumber>
              </Stat>
            </CardBody>
          </Card>
        </SimpleGrid>

        {!schedules.length ? (
          <Card>
            <CardBody>
              <Text fontWeight="semibold">No schedules yet</Text>
              <Text fontSize="sm" color="gray.600" mt={1}>
                Only running or paused campaigns with a linked sequence are listed. Draft or completed campaigns are hidden. Start from a live outreach campaign or linked sequence, then return here to monitor sending and manage schedule status.
              </Text>
            </CardBody>
          </Card>
        ) : (
          <>
          <Grid templateColumns={{ base: '1fr', xl: '1.3fr 1fr' }} gap={6}>
            <Card>
              <CardHeader pb={2}>
                <Heading size="md">Schedules to review</Heading>
              </CardHeader>
              <CardBody pt={0}>
                <Stack spacing={4}>
                  {schedules.map((schedule) => {
                    const isSelected = schedule.id === selectedScheduleId
                    const operatorStatus = getOperatorScheduleStatus(schedule)
                    return (
                      <Box
                        key={schedule.id}
                        borderWidth="1px"
                        borderRadius="lg"
                        p={4}
                        borderColor={isSelected ? 'blue.400' : 'gray.200'}
                        bg={isSelected ? 'blue.50' : 'white'}
                      >
                        <Flex justify="space-between" align="start" gap={3} wrap="wrap">
                          <VStack align="start" spacing={1}>
                            <HStack>
                              <Heading size="sm">{schedule.name}</Heading>
                              <Badge colorScheme={operatorStatus.colorScheme}>{operatorStatus.label}</Badge>
                              <Badge colorScheme={statusColor(schedule.status)} variant="subtle">{humanizeStatus(schedule.status)}</Badge>
                            </HStack>
                            {schedule.sequenceName ? (
                              <Text fontSize="sm" color="gray.600">
                                Sequence: {schedule.sequenceName}
                              </Text>
                            ) : null}
                            {schedule.description ? (
                              <Text fontSize="sm" color="gray.600">{schedule.description}</Text>
                            ) : null}
                            <Text fontSize="sm" color="gray.600">{operatorStatus.description}</Text>
                          </VStack>
                          <HStack spacing={2}>
                            <Button size="sm" variant={isSelected ? 'solid' : 'outline'} onClick={() => setSelectedScheduleId(schedule.id)}>
                              {isSelected ? 'Summary open' : 'Open summary'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void handlePauseResume(schedule)}
                              isLoading={busyScheduleId === schedule.id}
                            >
                              {schedule.status === 'running' ? 'Pause' : 'Resume'}
                            </Button>
                          </HStack>
                        </Flex>

                        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mt={4}>
                          <Box>
                            <Text fontSize="xs" color="gray.500" textTransform="uppercase">Mailbox</Text>
                            <Text fontSize="sm">{displayMailbox(schedule.senderIdentity)}</Text>
                          </Box>
                          <Box>
                            <Text fontSize="xs" color="gray.500" textTransform="uppercase">Linked sequence</Text>
                            <Text fontSize="sm">{schedule.sequenceName || 'Not linked'}</Text>
                          </Box>
                          <Box>
                            <Text fontSize="xs" color="gray.500" textTransform="uppercase">Status</Text>
                            <Text fontSize="sm">{humanizeStatus(schedule.status)}</Text>
                          </Box>
                          <Box>
                            <Text fontSize="xs" color="gray.500" textTransform="uppercase">Next send</Text>
                            <Text fontSize="sm">{formatDateTime(schedule.nextScheduledAt)}</Text>
                          </Box>
                        </SimpleGrid>

                        {schedule.mailboxMismatch ? (
                          <Alert status="warning" mt={4} borderRadius="md">
                            <AlertIcon />
                            <AlertDescription fontSize="sm">
                              This schedule uses {displayMailbox(schedule.senderIdentity)}, but the linked sequence uses {displayMailbox(schedule.sequenceSenderIdentity)}.
                              Align them before using Test now.
                            </AlertDescription>
                          </Alert>
                        ) : null}
                      </Box>
                    )
                  })}
                </Stack>
              </CardBody>
            </Card>
            <Card>
              <CardHeader pb={2}>
                <Heading size="md">{selectedSchedule ? selectedSchedule.name : 'Schedule summary'}</Heading>
              </CardHeader>
              <CardBody pt={0}>
                {!selectedSchedule ? (
                  <Text color="gray.600">Select a schedule to review its operator summary and next action.</Text>
                ) : (
                  <Stack spacing={4}>
                    {selectedMessage ? (
                      <Alert
                        status={
                          selectedMessage.tone === 'success'
                            ? 'success'
                            : selectedMessage.tone === 'error'
                              ? 'error'
                              : 'warning'
                        }
                        borderRadius="md"
                      >
                        <AlertIcon />
                        <AlertDescription>{selectedMessage.text}</AlertDescription>
                      </Alert>
                    ) : null}

                    <SimpleGrid columns={{ base: 2, md: 2 }} spacing={3}>
                      <Card variant="outline"><CardBody py={3}><Stat><StatLabel>Status</StatLabel><StatNumber fontSize="sm">{selectedOperatorStatus?.label || humanizeStatus(selectedSchedule.status)}</StatNumber></Stat></CardBody></Card>
                      <Card variant="outline"><CardBody py={3}><Stat><StatLabel>Mailbox</StatLabel><StatNumber fontSize="sm">{selectedSchedule.senderIdentity?.emailAddress || 'Not connected'}</StatNumber></Stat></CardBody></Card>
                      <Card variant="outline">
                        <CardBody py={3}>
                          <Stat>
                            <StatLabel>Effective daily cap</StatLabel>
                            <StatNumber fontSize="sm">
                              {selectedSchedule.senderIdentity?.warmup?.effectiveDailySendCap ??
                                selectedSchedule.senderIdentity?.dailySendLimit ??
                                '—'}
                              /day
                            </StatNumber>
                          </Stat>
                          {selectedSchedule.senderIdentity?.warmup?.warmupStatus === 'active' && (
                            <Text fontSize="xs" color="gray.600" mt={2}>
                              Warm-up is capping daily volume. Unsubscribe and compliance behavior are unchanged.
                            </Text>
                          )}
                        </CardBody>
                      </Card>
                      <Card variant="outline"><CardBody py={3}><Stat><StatLabel>Linked sequence</StatLabel><StatNumber fontSize="sm">{selectedSchedule.sequenceName || 'Not linked'}</StatNumber></Stat></CardBody></Card>
                      {selectedSchedule.listName ? (
                        <Card variant="outline"><CardBody py={3}><Stat><StatLabel>Audience</StatLabel><StatNumber fontSize="sm">{selectedSchedule.listName}</StatNumber></Stat></CardBody></Card>
                      ) : null}
                      <Card variant="outline"><CardBody py={3}><Stat><StatLabel>Next send</StatLabel><StatNumber fontSize="sm">{formatDateTime(scheduleStats?.nextScheduledAt ?? selectedSchedule.nextScheduledAt)}</StatNumber></Stat></CardBody></Card>
                    </SimpleGrid>

                    <HStack spacing={3} flexWrap="wrap">
                      <Button
                        colorScheme="blue"
                        onClick={() => void handleTestNow(selectedSchedule)}
                        isDisabled={!testNowState.enabled}
                        isLoading={testSendLoadingId === selectedSchedule.id}
                      >
                        Run safe test batch
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => void handlePauseResume(selectedSchedule)}
                        isLoading={busyScheduleId === selectedSchedule.id}
                      >
                        {selectedSchedule.status === 'running' ? 'Pause schedule' : 'Resume schedule'}
                      </Button>
                    </HStack>

                    {!testNowState.enabled && testNowState.reason ? (
                      <Text fontSize="sm" color="gray.600">{testNowState.reason}</Text>
                    ) : (
                      <Text fontSize="sm" color="gray.600">
                        This uses the existing capped test-send route and never exceeds 3 due recipients.
                      </Text>
                    )}
                  </Stack>
                )}
              </CardBody>
            </Card>
          </Grid>

          <Card mt={6} variant="outline" borderColor="gray.200" bg="gray.50">
            <CardHeader pb={2}>
              <Flex justify="space-between" align={{ base: 'start', md: 'center' }} gap={3} wrap="wrap">
                <VStack align="start" spacing={1}>
                  <Heading size="md">Follow-up & troubleshooting</Heading>
                  <Text fontSize="sm" color="gray.600">
                    Deeper queue detail, recent outcomes, and refresh actions for the selected schedule.
                  </Text>
                </VStack>
                <HStack spacing={3} flexWrap="wrap">
                  <Text fontSize="xs" color="gray.500">
                    Last updated: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString() : '—'}
                  </Text>
                  <Button
                    leftIcon={<RepeatIcon />}
                    variant="outline"
                    onClick={() => void loadData(true)}
                    isLoading={refreshing}
                  >
                    Refresh schedules
                  </Button>
                  <Button
                    variant="ghost"
                    leftIcon={<RepeatIcon />}
                    onClick={() => selectedSchedule ? void loadSelectedDetails(selectedSchedule) : undefined}
                    isLoading={detailLoading}
                    isDisabled={!selectedSchedule}
                  >
                    Refresh follow-up detail
                  </Button>
                </HStack>
              </Flex>
            </CardHeader>
            <CardBody pt={0}>
              {!selectedSchedule ? (
                <Text color="gray.600">Select a schedule above to review deeper follow-up detail.</Text>
              ) : (
                <Stack spacing={6}>
                  {detailError ? (
                    <Alert status="warning" borderRadius="md">
                      <AlertIcon />
                      <AlertDescription>{detailError}</AlertDescription>
                    </Alert>
                  ) : null}

                  <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
                    <Card variant="outline"><CardBody py={3}><Stat><StatLabel>Queued now</StatLabel><StatNumber>{scheduleStats?.upcomingSends ?? selectedUpcomingEmails.length}</StatNumber></Stat></CardBody></Card>
                    <Card variant="outline"><CardBody py={3}><Stat><StatLabel>Sent recently</StatLabel><StatNumber>{selectedOutcomeSummary.SENT ?? scheduleStats?.sentSends ?? 0}</StatNumber></Stat></CardBody></Card>
                    <Card variant="outline"><CardBody py={3}><Stat><StatLabel>Failed recently</StatLabel><StatNumber>{selectedOutcomeSummary.SEND_FAILED ?? 0}</StatNumber></Stat></CardBody></Card>
                    <Card variant="outline"><CardBody py={3}><Stat><StatLabel>Blocked now</StatLabel><StatNumber>{selectedCounts?.blocked ?? 0}</StatNumber></Stat></CardBody></Card>
                  </SimpleGrid>

                  <Card>
                    <CardHeader pb={2}>
                      <Heading size="md">Recent outcomes</Heading>
                    </CardHeader>
                    <CardBody pt={0}>
                      {!selectedSchedule.sequenceId ? (
                        <Text color="gray.600">This schedule does not have a linked sequence outcome stream yet.</Text>
                      ) : !runHistoryData?.rows?.length ? (
                        <Text color="gray.600">No recent results yet for this schedule in the last {DETAIL_SINCE_HOURS} hours.</Text>
                      ) : (
                        <Box overflowX="auto">
                          <Table size="sm">
                            <Thead>
                              <Tr>
                                <Th>When</Th>
                                <Th>Recipient</Th>
                                <Th>Mailbox</Th>
                                <Th>Outcome</Th>
                                <Th>Why</Th>
                              </Tr>
                            </Thead>
                            <Tbody>
                              {runHistoryData.rows.slice(0, 8).map((row) => (
                                <Tr key={row.auditId}>
                                  <Td>{formatDateTime(row.occurredAt)}</Td>
                                  <Td>{row.recipientEmail || 'Unknown recipient'}</Td>
                                  <Td>{row.identityEmail || selectedSchedule.senderIdentity?.emailAddress || '—'}</Td>
                                  <Td>{humanizeRunOutcome(row.outcome)}</Td>
                                  <Td>{humanizeRunReason(row.reason || row.lastError)}</Td>
                                </Tr>
                              ))}
                            </Tbody>
                          </Table>
                        </Box>
                      )}
                    </CardBody>
                  </Card>

                  <Card>
                    <CardHeader pb={2}>
                      <Heading size="md">Upcoming sends</Heading>
                    </CardHeader>
                    <CardBody pt={0}>
                      {!selectedUpcomingEmails.length ? (
                        <Text color="gray.600">No queued sends are currently scheduled for this campaign.</Text>
                      ) : (
                        <Box overflowX="auto">
                          <Table size="sm">
                            <Thead>
                              <Tr>
                                <Th>When</Th>
                                <Th>Recipient</Th>
                                <Th>Step</Th>
                                <Th>Mailbox</Th>
                              </Tr>
                            </Thead>
                            <Tbody>
                              {selectedUpcomingEmails.map((email) => (
                                <Tr key={email.id}>
                                  <Td>{formatDateTime(email.scheduledFor)}</Td>
                                  <Td>
                                    <VStack align="start" spacing={0}>
                                      <Text fontSize="sm">{email.prospectName}</Text>
                                      <Text fontSize="xs" color="gray.500">{email.prospectEmail}</Text>
                                    </VStack>
                                  </Td>
                                  <Td>Step {email.stepNumber + 1}</Td>
                                  <Td>{email.senderIdentity?.emailAddress || selectedSchedule.senderIdentity?.emailAddress || '—'}</Td>
                                </Tr>
                              ))}
                            </Tbody>
                          </Table>
                        </Box>
                      )}
                    </CardBody>
                  </Card>
                </Stack>
              )}
            </CardBody>
          </Card>
          </>
        )}
      </Box>
    </RequireActiveClient>
  )
}

export default SchedulesTab
