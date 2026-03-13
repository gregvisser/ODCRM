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
import { api } from '../../../utils/api'
import RequireActiveClient from '../../../components/RequireActiveClient'

type SenderIdentity = {
  id: string
  emailAddress: string
  displayName?: string | null
  dailySendLimit: number
  sendWindowHoursStart?: number | null
  sendWindowHoursEnd?: number | null
  sendWindowTimeZone?: string | null
}

type CampaignSchedule = {
  id: string
  customerId: string
  name: string
  description?: string | null
  status: 'draft' | 'running' | 'paused' | 'completed'
  sequenceId: string | null
  sequenceName: string | null
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

const MAX_DAILY_SEND_LIMIT = 30
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

function formatSendWindow(identity: SenderIdentity | null | undefined): string {
  if (!identity) return 'No sending mailbox connected'
  return 'Sends any time'
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

const SchedulesTab: React.FC = () => {
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
    try {
      if (isManualRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)

      const [schedulesRes, emailsRes] = await Promise.all([
        api.get<CampaignSchedule[]>('/api/schedules'),
        api.get<ScheduledEmail[]>('/api/schedules/emails?limit=200'),
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
  }, [])

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

    setDetailLoading(true)
    setDetailError(null)
    try {
      const requests: Array<Promise<any>> = [api.get<ScheduleStats>(`/api/schedules/${schedule.id}/stats`)]
      if (schedule.sequenceId) {
        requests.push(
          api.get<{ success?: boolean; data?: SequencePreflightData }>(
            `/api/send-worker/sequence-preflight?sequenceId=${encodeURIComponent(schedule.sequenceId)}&sinceHours=${DETAIL_SINCE_HOURS}`,
          ),
        )
        requests.push(
          api.get<{ success?: boolean; data?: RunHistoryData }>(
            `/api/send-worker/run-history?sequenceId=${encodeURIComponent(schedule.sequenceId)}&sinceHours=${DETAIL_SINCE_HOURS}&limit=12`,
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
          setPreflightData(preflightRes?.data?.data ?? null)
        }

        if (historyRes?.error) {
          setDetailError((current) => current || historyRes.error)
          setRunHistoryData(null)
        } else {
          setRunHistoryData(historyRes?.data?.data ?? { rows: [] })
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
  }, [])

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
      const res = await api.post(`/api/schedules/${schedule.id}/${action}`, {})
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
      })
      if (res.error) {
        toast({
          title: 'Test batch failed',
          description: humanizeGateReason(res.error),
          status: 'error',
          duration: 5000,
        })
        return
      }
      const summary =
        res.data?.data?.message ||
        `Processed ${res.data?.data?.processed ?? 0}; sent ${res.data?.data?.sent ?? 0}; failed ${res.data?.data?.failed ?? 0}.`
      toast({
        title: (res.data?.data?.sent ?? 0) > 0 ? 'Test batch sent' : 'Test batch checked',
        description: summary,
        status: (res.data?.data?.sent ?? 0) > 0 ? 'success' : 'info',
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
      active: schedules.filter((schedule) => schedule.status === 'running').length,
      paused: schedules.filter((schedule) => schedule.status === 'paused').length,
      totalProspects: schedules.reduce((sum, schedule) => sum + schedule.totalProspects, 0),
      nextScheduledAt,
    }
  }, [schedules])

  const selectedOutcomeSummary = runHistoryData?.summary?.byOutcome ?? {}
  const selectedCounts = preflightData?.counts
  const selectedMessage = selectedSchedule ? getPrimaryScheduleMessage(selectedSchedule, preflightData) : null

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
              See which outreach schedules are active, which mailbox they use, what happens next, and what happened recently.
            </Text>
          </VStack>
          <Button
            leftIcon={<RepeatIcon />}
            variant="outline"
            onClick={() => void loadData(true)}
            isLoading={refreshing}
          >
            Refresh
          </Button>
        </Flex>

        <SimpleGrid columns={{ base: 2, xl: 4 }} spacing={4} mb={6}>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Active</StatLabel>
                <StatNumber>{listSummary.active}</StatNumber>
              </Stat>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Paused</StatLabel>
                <StatNumber>{listSummary.paused}</StatNumber>
              </Stat>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Total prospects</StatLabel>
                <StatNumber>{listSummary.totalProspects}</StatNumber>
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

        <Text fontSize="xs" color="gray.500" mb={4}>
          Last updated: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString() : '—'}
        </Text>

        {!schedules.length ? (
          <Card>
            <CardBody>
              <Text fontWeight="semibold">No active schedules yet</Text>
              <Text fontSize="sm" color="gray.600" mt={1}>
                Start from a live outreach campaign or linked sequence, then return here to monitor sending, pause/resume, and run a safe test batch.
              </Text>
            </CardBody>
          </Card>
        ) : (
          <Grid templateColumns={{ base: '1fr', xl: '1.3fr 1fr' }} gap={6}>
            <Card>
              <CardHeader pb={2}>
                <Heading size="md">Live schedules</Heading>
              </CardHeader>
              <CardBody pt={0}>
                <Stack spacing={4}>
                  {schedules.map((schedule) => {
                    const isSelected = schedule.id === selectedScheduleId
                    const testDisabled =
                      !schedule.senderIdentity ||
                      !schedule.sequenceId ||
                      !schedule.sequenceSenderIdentity ||
                      schedule.mailboxMismatch
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
                              <Badge colorScheme={statusColor(schedule.status)}>{humanizeStatus(schedule.status)}</Badge>
                            </HStack>
                            {schedule.sequenceName ? (
                              <Text fontSize="sm" color="gray.600">
                                Linked sequence: {schedule.sequenceName}
                              </Text>
                            ) : null}
                            {schedule.description ? (
                              <Text fontSize="sm" color="gray.600">{schedule.description}</Text>
                            ) : null}
                          </VStack>
                          <HStack spacing={2}>
                            <Button size="sm" variant={isSelected ? 'solid' : 'outline'} onClick={() => setSelectedScheduleId(schedule.id)}>
                              View results
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void handlePauseResume(schedule)}
                              isLoading={busyScheduleId === schedule.id}
                            >
                              {schedule.status === 'running' ? 'Pause' : 'Resume'}
                            </Button>
                            <Button
                              size="sm"
                              colorScheme="blue"
                              onClick={() => void handleTestNow(schedule)}
                              isDisabled={testDisabled}
                              isLoading={testSendLoadingId === schedule.id}
                            >
                              Test now
                            </Button>
                          </HStack>
                        </Flex>

                        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mt={4}>
                          <Box>
                            <Text fontSize="xs" color="gray.500" textTransform="uppercase">Mailbox</Text>
                            <Text fontSize="sm">{displayMailbox(schedule.senderIdentity)}</Text>
                          </Box>
                          <Box>
                            <Text fontSize="xs" color="gray.500" textTransform="uppercase">Daily limit</Text>
                            <Text fontSize="sm">{Math.min(MAX_DAILY_SEND_LIMIT, schedule.senderIdentity?.dailySendLimit ?? MAX_DAILY_SEND_LIMIT)} per mailbox</Text>
                          </Box>
                          <Box>
                            <Text fontSize="xs" color="gray.500" textTransform="uppercase">Sending</Text>
                            <Text fontSize="sm">{formatSendWindow(schedule.senderIdentity)}</Text>
                          </Box>
                          <Box>
                            <Text fontSize="xs" color="gray.500" textTransform="uppercase">Next send</Text>
                            <Text fontSize="sm">{formatDateTime(schedule.nextScheduledAt)}</Text>
                          </Box>
                        </SimpleGrid>

                        <HStack spacing={4} mt={4} flexWrap="wrap">
                          <Text fontSize="sm" color="gray.600">Prospects: {schedule.totalProspects}</Text>
                          <Text fontSize="sm" color="gray.600">
                            Updated: {new Date(schedule.updatedAt).toLocaleString()}
                          </Text>
                        </HStack>

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
            <Stack spacing={6}>
              <Card>
                <CardHeader pb={2}>
                  <Heading size="md">{selectedSchedule ? selectedSchedule.name : 'Schedule details'}</Heading>
                </CardHeader>
                <CardBody pt={0}>
                  {!selectedSchedule ? (
                    <Text color="gray.600">Select a schedule to review its operator summary.</Text>
                  ) : (
                    <Stack spacing={4}>
                      {detailError ? (
                        <Alert status="warning" borderRadius="md">
                          <AlertIcon />
                          <AlertDescription>{detailError}</AlertDescription>
                        </Alert>
                      ) : null}

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

                      <SimpleGrid columns={{ base: 2, md: 3 }} spacing={3}>
                        <Card variant="outline"><CardBody py={3}><Stat><StatLabel>Mailbox</StatLabel><StatNumber fontSize="sm">{selectedSchedule.senderIdentity?.emailAddress || 'Not connected'}</StatNumber></Stat></CardBody></Card>
                        <Card variant="outline"><CardBody py={3}><Stat><StatLabel>Daily cap</StatLabel><StatNumber>{scheduleStats?.dailyLimit ?? selectedSchedule.senderIdentity?.dailySendLimit ?? MAX_DAILY_SEND_LIMIT}</StatNumber></Stat></CardBody></Card>
                        <Card variant="outline"><CardBody py={3}><Stat><StatLabel>Next send</StatLabel><StatNumber fontSize="sm">{formatDateTime(scheduleStats?.nextScheduledAt ?? selectedSchedule.nextScheduledAt)}</StatNumber></Stat></CardBody></Card>
                        <Card variant="outline"><CardBody py={3}><Stat><StatLabel>Sent (recent)</StatLabel><StatNumber>{selectedOutcomeSummary.SENT ?? scheduleStats?.sentSends ?? 0}</StatNumber></Stat></CardBody></Card>
                        <Card variant="outline"><CardBody py={3}><Stat><StatLabel>Failed (recent)</StatLabel><StatNumber>{selectedOutcomeSummary.SEND_FAILED ?? 0}</StatNumber></Stat></CardBody></Card>
                        <Card variant="outline"><CardBody py={3}><Stat><StatLabel>Blocked now</StatLabel><StatNumber>{selectedCounts?.blocked ?? 0}</StatNumber></Stat></CardBody></Card>
                      </SimpleGrid>

                      <HStack spacing={3} flexWrap="wrap">
                        <Button
                          colorScheme="blue"
                          onClick={() => void handleTestNow(selectedSchedule)}
                          isDisabled={!testNowState.enabled}
                          isLoading={testSendLoadingId === selectedSchedule.id}
                        >
                          Send test batch now
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => void handlePauseResume(selectedSchedule)}
                          isLoading={busyScheduleId === selectedSchedule.id}
                        >
                          {selectedSchedule.status === 'running' ? 'Pause schedule' : 'Resume schedule'}
                        </Button>
                        <Button
                          variant="ghost"
                          leftIcon={<RepeatIcon />}
                          onClick={() => void loadSelectedDetails(selectedSchedule)}
                          isLoading={detailLoading}
                        >
                          Refresh results
                        </Button>
                      </HStack>

                      {!testNowState.enabled && testNowState.reason ? (
                        <Text fontSize="sm" color="gray.600">{testNowState.reason}</Text>
                      ) : (
                        <Text fontSize="sm" color="gray.600">
                          Test now uses the existing operator-safe test batch route and never exceeds 3 due recipients.
                        </Text>
                      )}
                    </Stack>
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardHeader pb={2}>
                  <Heading size="md">Recent outcomes</Heading>
                </CardHeader>
                <CardBody pt={0}>
                  {!selectedSchedule?.sequenceId ? (
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
                              <Td>{row.identityEmail || selectedSchedule?.senderIdentity?.emailAddress || '—'}</Td>
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
                              <Td>{email.senderIdentity?.emailAddress || selectedSchedule?.senderIdentity?.emailAddress || '—'}</Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    </Box>
                  )}
                </CardBody>
              </Card>
            </Stack>
          </Grid>
        )}
      </Box>
    </RequireActiveClient>
  )
}

export default SchedulesTab
