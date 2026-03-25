/**
 * Email Accounts Enhanced Tab
 * Supports both OAuth (Outlook) and SMTP email accounts
 * Ported from OpensDoorsV2 email-accounts/ui.tsx
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  HStack,
  Text,
  IconButton,
  useDisclosure,
  useToast,
  Spinner,
  Alert,
  AlertIcon,
  AlertDescription,
} from '@chakra-ui/react'
import { AddIcon, DeleteIcon } from '@chakra-ui/icons'
import { getCurrentCustomerId, onSettingsUpdated } from '../platform/stores/settings'
import { emit } from '../platform/events'
import { api } from '../utils/api'
import RequireActiveClient from './RequireActiveClient'
import SmtpEmailIdentityModal from './SmtpEmailIdentityModal'

interface EmailIdentity {
  id: string
  emailAddress: string
  displayName?: string
  provider: string // 'outlook' or 'smtp'
  isActive: boolean
  dailySendLimit: number
  createdAt: string

  // Delegated OAuth health (Outlook only; provided by backend as booleans)
  delegatedReady?: boolean
  tokenExpired?: boolean

  // SMTP fields
  smtpHost?: string
  smtpPort?: number
  smtpUsername?: string
  smtpSecure?: boolean
}

/** Matches GET /api/send-worker/identity-capacity inner `data` payload (unwrapped by api client). */
type IdentityCapacityRow = {
  identityId: string
  email: string
  label: string | null
  provider: string
  isActive: boolean
  state: 'usable' | 'unavailable' | 'risky'
  reasons: string[]
  recent: {
    windowHours: number
    sent: number
    sendFailed: number
    wouldSend: number
    skipped: number
  }
  /** Max EmailEvent occurredAt for sent/delivered (campaign path; not sequence queue). */
  lastRecordedOutboundAt?: string | null
  /** EmailEvent bounced count in window (campaign failures). */
  recentCampaignBounces?: number
  queuePressure?: { queuedNow?: number }
}

type IdentityCapacityData = {
  sinceHours: number
  summary: {
    total: number
    usable: number
    unavailable: number
    risky: number
    preferredIdentityId: string | null
    preferredIdentityState: 'usable' | 'unavailable' | 'risky' | null
    recommendedIdentityId: string | null
  }
  rows: IdentityCapacityRow[]
  lastUpdatedAt: string
}

function formatMailboxState(state: IdentityCapacityRow['state']): string {
  if (state === 'usable') return 'Ready'
  if (state === 'risky') return 'Needs attention'
  if (state === 'unavailable') return 'Unavailable'
  return 'Unknown'
}

function mailboxStateColor(state: IdentityCapacityRow['state']): string {
  if (state === 'usable') return 'green'
  if (state === 'risky') return 'orange'
  if (state === 'unavailable') return 'red'
  return 'gray'
}

function describeMailboxReason(reason: string): string {
  switch (reason) {
    case 'identity_inactive':
      return 'Mailbox is turned off.'
    case 'recent_failure_rate_high':
      return 'Recent sending failures are above the safe range.'
    case 'recent_send_failures_detected':
      return 'Recent sending failures need review.'
    case 'daily_limit_reached_in_window':
      return 'Mailbox has already reached its daily send limit.'
    default:
      return reason.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) + '.'
  }
}

type EmailAccountsEnhancedTabProps = {
  customerId?: string
  /**
   * Optional preflight before starting OAuth redirect.
   * Return true to proceed; false to cancel.
   */
  onBeforeConnectOutlook?: () => Promise<boolean> | boolean
}

export default function EmailAccountsEnhancedTab({
  customerId: customerIdProp,
  onBeforeConnectOutlook,
}: EmailAccountsEnhancedTabProps) {
  const [identities, setIdentities] = useState<EmailIdentity[]>([])
  const [identityCapacity, setIdentityCapacity] = useState<IdentityCapacityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [customerId, setCustomerId] = useState<string>(customerIdProp || (getCurrentCustomerId() ?? ''))

  const { isOpen: isSmtpOpen, onOpen: onSmtpOpen, onClose: onSmtpClose } = useDisclosure()
  const toast = useToast()

  const fetchIdentities = useCallback(async () => {
    if (!customerId) return
    setLoading(true)
    const [idRes, capRes] = await Promise.all([
      api.get<EmailIdentity[]>(`/api/outlook/identities?customerId=${encodeURIComponent(customerId)}`, {
        headers: { 'X-Customer-Id': customerId },
      }),
      api.get<IdentityCapacityData>(`/api/send-worker/identity-capacity?sinceHours=168`, {
        headers: { 'X-Customer-Id': customerId },
      }),
    ])
    if (idRes.error) {
      toast({ title: 'Error', description: idRes.error, status: 'error' })
    } else if (idRes.data) {
      setIdentities(idRes.data)
    }
    if (!capRes.error && capRes.data) {
      setIdentityCapacity(capRes.data)
    } else {
      setIdentityCapacity(null)
    }
    setLoading(false)
  }, [customerId, toast])

  const capacityById = useMemo(
    () => new Map((identityCapacity?.rows ?? []).map((row) => [row.identityId, row])),
    [identityCapacity?.rows],
  )

  useEffect(() => {
    if (customerId) {
      fetchIdentities()
    }
  }, [customerId, fetchIdentities])

  // Keep internal state synced to provided prop (embedded onboarding mode)
  useEffect(() => {
    if (!customerIdProp) return
    setCustomerId(customerIdProp)
  }, [customerIdProp])

  useEffect(() => {
    // In embedded mode (prop-controlled), do not subscribe to global settingsStore.
    if (customerIdProp) return
    const unsubscribe = onSettingsUpdated((detail) => {
      const next = (detail as { currentCustomerId?: string } | null)?.currentCustomerId
      if (next) {
        setCustomerId(next)
      }
    })
    return () => unsubscribe()
  }, [customerIdProp])

  const handleConnectOutlook = async () => {
    if (!customerId || customerId.startsWith('test-')) {
      toast({
        title: 'Select a client first.',
        description:
          'Choose a client to review connected mailboxes, see which ones are ready, and manage mailbox actions.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      return
    }

    try {
      if (onBeforeConnectOutlook) {
        const ok = await onBeforeConnectOutlook()
        if (!ok) return
      }
    } catch {
      return
    }

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    const returnTo = window.location.pathname + window.location.search + window.location.hash
    window.location.href = `${apiUrl}/api/outlook/auth?customerId=${encodeURIComponent(customerId)}&returnTo=${encodeURIComponent(returnTo)}`
  }

  const isValidCustomer = !!customerId && !customerId.startsWith('test-')

  // After returning from OAuth, show a toast + refresh identities, then clear URL flag.
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      if (url.searchParams.get('emailConnected') !== '1') return
      const connectedEmail = url.searchParams.get('connectedEmail') || url.searchParams.get('email') || ''
      toast({
        title: 'Connected',
        description: connectedEmail ? `Connected ${connectedEmail}` : 'Connect Outlook mailbox',
        status: 'success',
        duration: 4500,
        isClosable: true,
      })
      void fetchIdentities()
      if (customerId) emit('customerUpdated', { id: customerId })
      url.searchParams.delete('emailConnected')
      url.searchParams.delete('connectedEmail')
      url.searchParams.delete('oauth')
      url.searchParams.delete('email')
      window.history.replaceState({}, document.title, url.pathname + url.search + url.hash)
    } catch {
      // ignore
    }
  }, [customerId, fetchIdentities, toast])

  const handleTestSend = async (identity: EmailIdentity) => {
    const testEmail = prompt('Send test email to:')
    if (!testEmail) return

    if (!testEmail.includes('@')) {
      toast({
        title: 'Invalid email',
        description: 'Please enter a valid email address',
        status: 'error',
        duration: 4000,
      })
      return
    }

    toast({
      title: 'Sending test email...',
      description: `From ${identity.emailAddress} to ${testEmail}`,
      status: 'info',
      duration: null,
      isClosable: true,
    })

    try {
      const { data, error } = await api.post<{
        success?: boolean
        message?: string
        error?: string
        code?: string
        requestId?: string
        from?: string
      }>(`/api/outlook/identities/${identity.id}/test-send?customerId=${customerId}`, {
        toEmail: testEmail,
      })

      if (error || data?.error) {
        const errorMsg = error || data?.error || 'Unknown error'
        const requestId = data?.requestId || ''

        console.error('[TestSend] Failed:', { error: errorMsg, requestId })

        toast.closeAll()
        toast({
          title: 'Test send failed',
          description: (
            <Text as="span" whiteSpace="pre-line" fontSize="sm" display="block">
              {errorMsg}
              {requestId ? `\n(Request ID: ${requestId})` : ''}
            </Text>
          ),
          status: 'error',
          duration: 8000,
          isClosable: true,
        })
      } else {
        const requestId = data?.requestId || ''

        if (import.meta.env.DEV) {
          console.log('[TestSend] Success:', data)
        }

        toast.closeAll()
        toast({
          title: 'Test email sent!',
          description: `Sent from ${identity.emailAddress} to ${testEmail}${requestId ? ` (ref: ${requestId.substring(0, 12)}…)` : ''}`,
          status: 'success',
          duration: 6000,
          isClosable: true,
        })
      }
    } catch (err: unknown) {
      console.error('[TestSend] Exception:', err)
      toast.closeAll()
      toast({
        title: 'Test send failed',
        description: err instanceof Error ? err.message : 'Network error',
        status: 'error',
        duration: 6000,
        isClosable: true,
      })
    }
  }

  const handleDisconnect = async (id: string) => {
    if (!confirm('Disconnect this email account?')) return

    const { error } = await api.delete(`/api/outlook/identities/${id}?customerId=${customerId}`)
    if (error) {
      toast({ title: 'Error', description: error, status: 'error' })
    } else {
      toast({ title: 'Update', description: 'Account disconnected', status: 'success' })
      fetchIdentities()
      if (customerId) emit('customerUpdated', { id: customerId })
    }
  }

  return (
    <RequireActiveClient>
      {loading ? (
        <Box textAlign="center" py={10}>
          <Spinner size="xl" />
        </Box>
      ) : (
        <Box>
          <HStack justify="space-between" mb={6}>
            <Box>
              <HStack spacing={2} mb={1}>
                <Heading size="lg">Email Accounts</Heading>
                <Badge colorScheme={identities.length >= 5 ? 'orange' : 'green'} fontSize="xs" px={2} py={1}>
                  {identities.length}/5
                </Badge>
              </HStack>
              <Text fontSize="sm" color="gray.600">
                Connect Microsoft Outlook (OAuth), or add an outbound mailbox via SMTP (Google-hosted or any provider)
                — for sending from this client.
              </Text>
            </Box>
            <HStack flexShrink={0}>
              <Button
                leftIcon={<AddIcon />}
                colorScheme="teal"
                variant="outline"
                onClick={onSmtpOpen}
                size="sm"
                isDisabled={!isValidCustomer || identities.length >= 5}
                title={
                  !isValidCustomer
                    ? 'Select a client first.'
                    : identities.length >= 5
                      ? 'Limit reached (5). Disconnect one to add another.'
                      : 'Add outbound mailbox (SMTP)'
                }
              >
                Add outbound mailbox
              </Button>
              <Button
                leftIcon={<AddIcon />}
                colorScheme="blue"
                onClick={handleConnectOutlook}
                size="sm"
                isDisabled={!isValidCustomer || identities.length >= 5}
                title={
                  !isValidCustomer
                    ? 'Select a client first.'
                    : identities.length >= 5
                      ? 'Limit reached (5). Disconnect one to add another.'
                      : 'Connect Outlook mailbox'
                }
              >
                Connect Outlook mailbox
              </Button>
            </HStack>
          </HStack>

          <Alert status="info" mb={6}>
            <AlertIcon />
            <AlertDescription fontSize="sm">
              <strong>Deliverability:</strong> Configure SPF, DKIM, and DMARC on your domain. Keep daily send limits
              reasonable (150–200 per account). Google-hosted SMTP often needs an app password when 2FA is enabled.
            </AlertDescription>
          </Alert>

          <Alert status="info" mb={4} fontSize="sm">
            <AlertIcon />
            <AlertDescription fontSize="xs">
              <strong>Mailbox readiness</strong> (Ready / Needs attention / Unavailable) uses identity state plus{' '}
              <strong>sequence queue send audits</strong> and limits. <strong>Queue sends/fails</strong> count only
              audited sequence sends. <strong>Last recorded campaign send</strong> and <strong>campaign bounces</strong>{' '}
              come from <strong>EmailEvent</strong> (campaign path); sequence-only mailboxes may show “—” for those until a
              campaign send is recorded.
            </AlertDescription>
          </Alert>

          <Box bg="white" borderRadius="lg" border="1px solid" borderColor="gray.200" overflowX="auto">
            <Table size="sm">
              <Thead bg="gray.50">
                <Tr>
                  <Th>Email Address</Th>
                  <Th>Display Name</Th>
                  <Th>Type</Th>
                  <Th>Mailbox readiness</Th>
                  <Th>Queue sends / fails (7d)</Th>
                  <Th>Last recorded campaign send</Th>
                  <Th isNumeric>Campaign bounces (7d)</Th>
                  <Th>Daily Limit</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {identities.length === 0 ? (
                  <Tr>
                    <Td colSpan={10} textAlign="center" py={8}>
                      <Text color="gray.500" mb={3}>
                        No mailbox connected yet
                      </Text>
                      {!isValidCustomer && (
                        <Text color="orange.500" fontSize="sm" mb={3}>
                          Choose a client to review connected mailboxes, see which ones are ready, and manage mailbox
                          actions.
                        </Text>
                      )}
                      <HStack justify="center" spacing={3}>
                        <Button size="sm" colorScheme="teal" variant="outline" onClick={onSmtpOpen} isDisabled={!isValidCustomer}>
                          Add outbound mailbox
                        </Button>
                        <Button size="sm" colorScheme="blue" onClick={handleConnectOutlook} isDisabled={!isValidCustomer}>
                          Connect Outlook mailbox
                        </Button>
                      </HStack>
                    </Td>
                  </Tr>
                ) : (
                  identities
                    .filter((identity) => identity.provider !== 'outlook_app_only')
                    .map((identity) => {
                      const needsReconnect =
                        identity.provider === 'outlook' && identity.delegatedReady === false
                      const cap = capacityById.get(identity.id)
                      const state =
                        cap?.state ?? (identity.isActive ? ('usable' as const) : ('unavailable' as const))
                      return (
                        <Tr key={identity.id}>
                          <Td fontWeight="medium">{identity.emailAddress}</Td>
                          <Td fontSize="sm">{identity.displayName || '-'}</Td>
                          <Td>
                            <HStack spacing={2}>
                              <Badge colorScheme={identity.provider === 'outlook' ? 'blue' : 'purple'}>
                                {identity.provider === 'smtp' ? 'SMTP' : identity.provider.toUpperCase()}
                              </Badge>
                              {needsReconnect ? (
                                <Badge colorScheme="orange" variant="subtle">
                                  Refresh
                                </Badge>
                              ) : null}
                            </HStack>
                          </Td>
                          <Td>
                            <HStack align="start" spacing={2}>
                              {needsReconnect ? (
                                <Badge colorScheme="orange">OAuth refresh</Badge>
                              ) : (
                                <Badge colorScheme={mailboxStateColor(state)}>{formatMailboxState(state)}</Badge>
                              )}
                              <Text fontSize="xs" color="gray.600" maxW="200px">
                                {cap?.reasons?.length
                                  ? cap.reasons.map(describeMailboxReason).join(' ')
                                  : 'No capacity warnings.'}
                              </Text>
                            </HStack>
                          </Td>
                          <Td fontSize="xs">
                            {cap ? (
                              <>
                                {cap.recent.sent} sent · {cap.recent.sendFailed} failed
                                <br />
                                {cap.queuePressure?.queuedNow ?? 0} queued
                              </>
                            ) : (
                              '—'
                            )}
                          </Td>
                          <Td fontSize="xs">
                            {cap?.lastRecordedOutboundAt
                              ? new Date(cap.lastRecordedOutboundAt).toLocaleString()
                              : '—'}
                          </Td>
                          <Td isNumeric fontSize="sm">
                            {cap?.recentCampaignBounces ?? 0}
                          </Td>
                          <Td fontSize="sm">{identity.dailySendLimit}/day</Td>
                          <Td>
                            <Badge colorScheme={identity.isActive ? 'green' : 'red'}>
                              {identity.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </Td>
                          <Td>
                            <HStack spacing={1}>
                              {needsReconnect ? (
                                <Button size="xs" colorScheme="orange" variant="ghost" onClick={handleConnectOutlook}>
                                  Refresh
                                </Button>
                              ) : (
                                <Button size="xs" variant="ghost" onClick={() => handleTestSend(identity)}>
                                  Send Test
                                </Button>
                              )}
                              <IconButton
                                aria-label="Delete"
                                icon={<DeleteIcon />}
                                size="xs"
                                variant="ghost"
                                colorScheme="red"
                                onClick={() => handleDisconnect(identity.id)}
                              />
                            </HStack>
                          </Td>
                        </Tr>
                      )
                    })
                )}
              </Tbody>
            </Table>
          </Box>

          <SmtpEmailIdentityModal
            customerId={customerId}
            isOpen={isSmtpOpen}
            onClose={onSmtpClose}
            onCreated={fetchIdentities}
          />
        </Box>
      )}
    </RequireActiveClient>
  )
}
