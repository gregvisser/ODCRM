import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardBody,
  Flex,
  Icon,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  MenuDivider,
  Progress,
  Select,
  SimpleGrid,
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
  Badge,
  HStack,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Spacer,
  Textarea,
  useToast,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Spinner,
  NumberInput,
  NumberInputField,
} from '@chakra-ui/react'
import {
  AddIcon,
  SearchIcon,
  EditIcon,
  DeleteIcon,
  EmailIcon,
  CheckCircleIcon,
  WarningIcon,
  SettingsIcon,
  ExternalLinkIcon,
} from '@chakra-ui/icons'
import { api } from '../../../utils/api'
import { normalizeCustomersListResponse } from '../../../utils/normalizeApiResponse'
import { useScopedCustomerSelection } from '../../../hooks/useCustomerScope'
import RequireActiveClient from '../../../components/RequireActiveClient'
import SmtpEmailIdentityModal from '../../../components/SmtpEmailIdentityModal'

// Backend EmailIdentity shape from /api/outlook/identities
type EmailIdentity = {
  id: string
  emailAddress: string
  displayName: string | null
  provider: string
  isActive: boolean
  dailySendLimit: number
  sendWindowHoursStart: number
  sendWindowHoursEnd: number
  sendWindowTimeZone: string
  createdAt: string
  delegatedReady?: boolean
  tokenExpired?: boolean
  smtpHost?: string | null
  smtpPort?: number | null
  smtpUsername?: string | null
  smtpSecure?: boolean | null
  signatureHtml?: string | null
}

type Customer = {
  id: string
  name: string
}

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
  /** Max EmailEvent occurredAt for sent/delivered (campaign path; not sequence queue audits). */
  lastRecordedOutboundAt?: string | null
  /** EmailEvent bounced rows in the same window as `recent` (campaign send failures). */
  recentCampaignBounces?: number
  queuePressure?: {
    queuedNow?: number
  }
  guardrails?: {
    dailySendLimit?: number | null
    sendWindowTimeZone?: string | null
    sendWindowHoursStart?: number | null
    sendWindowHoursEnd?: number | null
  }
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
  guardrails: {
    warnings: string[]
    liveGateReasons?: string[]
  }
  rows: IdentityCapacityRow[]
  lastUpdatedAt: string
}

const MAX_DAILY_SEND_LIMIT = 30

function formatMailboxState(state?: IdentityCapacityRow['state'] | null): string {
  if (state === 'usable') return 'Ready to send'
  if (state === 'risky') return 'Needs attention'
  if (state === 'unavailable') return 'Unavailable'
  return 'Status unknown'
}

function mailboxStateColor(state?: IdentityCapacityRow['state'] | null): string {
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
      return reason.replace(/_/g, ' ').replace(/^\w/, (char) => char.toUpperCase()) + '.'
  }
}

const EmailAccountsTab: React.FC = () => {
  const [identities, setIdentities] = useState<EmailIdentity[]>([])
  const [identityCapacity, setIdentityCapacity] = useState<IdentityCapacityData | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const {
    canSelectCustomer,
    customerHeaders,
    customerId: selectedCustomerId,
    setCustomerId: setSelectedCustomerId,
  } = useScopedCustomerSelection()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [capacityLoading, setCapacityLoading] = useState(false)
  const [capacityError, setCapacityError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { isOpen: isSmtpOpen, onOpen: onSmtpOpen, onClose: onSmtpClose } = useDisclosure()
  const [editingIdentity, setEditingIdentity] = useState<EmailIdentity | null>(null)
  const toast = useToast()
  const selectedCustomerIdRef = useRef(selectedCustomerId)

  // IMPORTANT: loadIdentities must be declared BEFORE the useEffect that lists it
  // in its dependency array. Evaluating [selectedCustomerId, loadIdentities] is eager —
  // if loadIdentities is a const declared later in the function body it will be in TDZ
  // and throw "Cannot access '_' before initialization" at component mount time.
  const loadIdentities = useCallback(async () => {
    if (!selectedCustomerId) return
    const requestedCustomerId = selectedCustomerId
    setLoading(true)
    setError(null)

    const { data, error: apiError } = await api.get<EmailIdentity[]>(
      `/api/outlook/identities?customerId=${encodeURIComponent(requestedCustomerId)}`,
      { headers: { 'X-Customer-Id': requestedCustomerId } },
    )

    // Ignore stale response: user may have changed customer while request was in flight
    if (requestedCustomerId !== selectedCustomerIdRef.current) return

    if (apiError) {
      setError(apiError)
      // Keep previous data if we had any (don't wipe UI on transient errors)
    } else {
      setIdentities(data || [])
    }

    setLoading(false)
  }, [selectedCustomerId])

  const loadIdentityCapacity = useCallback(async () => {
    if (!selectedCustomerId) {
      setIdentityCapacity(null)
      setCapacityError(null)
      return
    }
    setCapacityLoading(true)
    setCapacityError(null)
    const { data, error: apiError } = await api.get<IdentityCapacityData>(
      '/api/send-worker/identity-capacity?sinceHours=72',
      { headers: customerHeaders },
    )
    if (apiError) {
      setCapacityError(apiError)
      setCapacityLoading(false)
      return
    }
    if (!data) {
      setCapacityError('No identity capacity data is available right now')
      setCapacityLoading(false)
      return
    }
    setIdentityCapacity(data)
    setCapacityLoading(false)
  }, [selectedCustomerId, customerHeaders])

  const handleRefreshAll = useCallback(async () => {
    await Promise.all([loadIdentities(), loadIdentityCapacity()])
  }, [loadIdentities, loadIdentityCapacity])

  useEffect(() => {
    selectedCustomerIdRef.current = selectedCustomerId
  }, [selectedCustomerId])

  useEffect(() => {
    loadCustomers()
  }, [])

  useEffect(() => {
    if (selectedCustomerId) {
      void Promise.all([loadIdentities(), loadIdentityCapacity()])
    } else {
      setIdentities([])
      setIdentityCapacity(null)
      setCapacityError(null)
      setError(null)
      setLoading(false)
    }
  }, [selectedCustomerId, loadIdentities, loadIdentityCapacity])

  const loadCustomers = async () => {
    const { data, error: apiError } = await api.get('/api/customers')

    if (apiError) {
      console.error('Failed to load customers:', apiError)
      setCustomers([])
      return
    }

    try {
      const customerList = normalizeCustomersListResponse(data) as Customer[]
      setCustomers(customerList)
    } catch (err: any) {
      console.error('❌ Failed to normalize customers in EmailAccountsTab:', err)
      setCustomers([])
    }
  }

  const filteredIdentities = useMemo(() => {
    const capacityById = new Map((identityCapacity?.rows ?? []).map((row) => [row.identityId, row]))
    return identities
      .filter((identity) => identity.provider !== 'outlook_app_only')
      .filter(identity => {
      const matchesSearch = searchQuery === '' ||
        identity.emailAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
        identity.displayName?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'ready' && capacityById.get(identity.id)?.state === 'usable') ||
        (statusFilter === 'attention' && ['risky', 'unavailable'].includes(capacityById.get(identity.id)?.state || ''))

      return matchesSearch && matchesStatus
    })
  }, [identities, identityCapacity?.rows, searchQuery, statusFilter])

  const mailboxSummary = useMemo(() => {
    const readyMailboxes = identityCapacity?.summary.usable ?? 0
    const needsAttention = (identityCapacity?.summary.risky ?? 0) + (identityCapacity?.summary.unavailable ?? 0)
    return {
      connectedMailboxes: identities.length,
      readyMailboxes,
      needsAttention,
      outlookMailboxes: identities.filter((identity) => identity.provider === 'outlook').length,
    }
  }, [identities, identityCapacity])

  const identityCapacityById = useMemo(
    () => new Map((identityCapacity?.rows ?? []).map((row) => [row.identityId, row])),
    [identityCapacity?.rows]
  )

  const recommendedMailboxLabel = useMemo(() => {
    const recommendedId = identityCapacity?.summary.recommendedIdentityId
    if (!recommendedId) return '—'
    const recommendedRow = identityCapacity?.rows.find((row) => row.identityId === recommendedId)
    return recommendedRow?.label ? `${recommendedRow.label} (${recommendedRow.email})` : recommendedRow?.email || recommendedId
  }, [identityCapacity])

  const handleConnectOutlook = () => {
    if (!selectedCustomerId) {
      toast({
        title: 'No client selected',
        description: 'Please select a client first',
        status: 'error',
        duration: 3000,
      })
      return
    }

    // Open OAuth flow in same window - backend will redirect back
    const apiBaseUrl = import.meta.env.VITE_API_URL || ''
    window.location.href = `${apiBaseUrl}/api/outlook/auth?customerId=${selectedCustomerId}`
  }

  const handleEditIdentity = async (identity: EmailIdentity) => {
    setEditingIdentity({ ...identity, signatureHtml: '' })
    onOpen()

    if (!selectedCustomerId) return

    const { data, error: apiError } = await api.get<{ signatureHtml?: string | null }>(
      `/api/outlook/identities/${identity.id}/signature`,
      { headers: { 'X-Customer-Id': selectedCustomerId } },
    )

    if (apiError) {
      toast({
        title: 'Failed to load signature',
        description: apiError,
        status: 'warning',
        duration: 4000,
      })
      return
    }

    setEditingIdentity((prev) => (
      prev && prev.id === identity.id
        ? { ...prev, signatureHtml: data?.signatureHtml || '' }
        : prev
    ))
  }

  const handleSaveIdentity = async () => {
    if (!editingIdentity) return
    if (!selectedCustomerId) {
      toast({
        title: 'No client selected',
        status: 'error',
        duration: 3000,
      })
      return
    }

    const [settingsResult, signatureResult] = await Promise.all([
      api.patch(`/api/outlook/identities/${editingIdentity.id}`, {
        displayName: editingIdentity.displayName,
        dailySendLimit: editingIdentity.dailySendLimit,
        sendWindowHoursStart: editingIdentity.sendWindowHoursStart,
        sendWindowHoursEnd: editingIdentity.sendWindowHoursEnd,
        sendWindowTimeZone: editingIdentity.sendWindowTimeZone,
        isActive: editingIdentity.isActive,
      }, { headers: customerHeaders }),
      api.put(
        `/api/outlook/identities/${editingIdentity.id}/signature`,
        { signatureHtml: editingIdentity.signatureHtml || null },
        { headers: customerHeaders },
      ),
    ])

    if (settingsResult.error || signatureResult.error) {
      toast({
        title: 'Failed to update account',
        description: settingsResult.error || signatureResult.error || 'Unknown error',
        status: 'error',
        duration: 5000,
      })
      return
    }

    await loadIdentities()
    onClose()
    toast({
      title: 'Account updated',
      status: 'success',
      duration: 3000,
    })
  }

  const handleTestSend = async (identity: EmailIdentity) => {
    const testEmail = window.prompt('Enter email address to send test email to:')
    if (!testEmail) return

    toast({
      title: 'Sending test email...',
      status: 'info',
      duration: 2000,
    })

    const { error: apiError } = await api.post(`/api/outlook/identities/${identity.id}/test-send`, {
      toEmail: testEmail,
    }, { headers: customerHeaders })

    if (apiError) {
      toast({
        title: 'Test send failed',
        description: (
          <Text as="span" whiteSpace="pre-line" fontSize="sm" display="block">
            {apiError}
          </Text>
        ),
        status: 'error',
        duration: 8000,
      })
      return
    }

    toast({
      title: 'Test email sent!',
      description: `Sent from ${identity.emailAddress} to ${testEmail}`,
      status: 'success',
      duration: 5000,
    })
  }

  const handleToggleActive = async (identity: EmailIdentity) => {
    const { error: apiError } = await api.patch(`/api/outlook/identities/${identity.id}`, {
      isActive: !identity.isActive,
    }, { headers: customerHeaders })

    if (apiError) {
      toast({
        title: 'Failed to update status',
        description: apiError,
        status: 'error',
        duration: 3000,
      })
      return
    }

    await loadIdentities()
    toast({
      title: identity.isActive ? 'Account deactivated' : 'Account activated',
      status: 'success',
      duration: 2000,
    })
  }

  const handleDeleteIdentity = async (identity: EmailIdentity) => {
    if (!window.confirm(`Disconnect ${identity.emailAddress}? This will stop all campaigns using this sender.`)) {
      return
    }

    const { error: apiError } = await api.delete(`/api/outlook/identities/${identity.id}`, { headers: customerHeaders })

    if (apiError) {
      toast({
        title: 'Failed to disconnect account',
        description: apiError,
        status: 'error',
        duration: 3000,
      })
      return
    }

    await loadIdentities()
    if (selectedCustomerId) emit('customerUpdated', { id: selectedCustomerId })
    toast({
      title: 'Account disconnected',
      status: 'success',
      duration: 3000,
    })
  }

  if (!selectedCustomerId) {
    return (
      <RequireActiveClient>
      <Box id="email-accounts-tab-panel" data-testid="email-accounts-tab-panel">
        <VStack align="start" spacing={1} mb={4}>
          <Text fontSize="2xl" fontWeight="bold">Email Accounts</Text>
          <Text color="gray.600">Review connected mailboxes, see which ones are usable, and manage what needs attention next.</Text>
          <FormControl w="300px" mt={2}>
            <FormLabel fontSize="sm">Client</FormLabel>
            <Select
              value=""
              onChange={(e) => {
                const id = e.target.value
                if (id) {
                  setSelectedCustomerId(id)
                }
              }}
              placeholder="Select client"
              isDisabled={!canSelectCustomer}
            >
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </Select>
          </FormControl>
        </VStack>
        <Card id="email-accounts-tab-no-customer" data-testid="email-accounts-tab-no-customer">
          <CardBody textAlign="center" py={10}>
            <Icon as={EmailIcon} boxSize={12} color="gray.400" mb={4} />
            <Text fontSize="lg" fontWeight="semibold" mb={2}>Select a client to review mailbox status</Text>
            <Text color="gray.600">
              Choose a client to review connected mailboxes, see which ones are ready, and manage mailbox actions.
            </Text>
          </CardBody>
        </Card>
      </Box>
      </RequireActiveClient>
    )
  }

  if (loading && identities.length === 0) {
    return (
      <RequireActiveClient>
        <Box textAlign="center" py={10}>
          <Spinner size="lg" mb={4} />
          <Text>Loading email accounts...</Text>
        </Box>
      </RequireActiveClient>
    )
  }

  return (
    <RequireActiveClient>
    <Box id="email-accounts-tab-panel" data-testid="email-accounts-tab-panel">
      {/* Error Banner */}
      {error && (
        <Alert status="error" mb={4}>
          <AlertIcon />
          <Box flex="1">
            <AlertTitle>Failed to load email accounts</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Box>
          <Button size="sm" onClick={loadIdentities} ml={4}>
            Retry
          </Button>
        </Alert>
      )}

      {/* Header */}
      <Flex justify="space-between" align="center" mb={6}>
        <VStack align="start" spacing={1}>
          <Text fontSize="2xl" fontWeight="bold">Email Accounts</Text>
          <Text color="gray.600">
            Outlook (OAuth) or outbound SMTP mailboxes (Google-hosted or other providers) — review health and limits per
            client.
          </Text>
          <HStack spacing={4} mt={2}>
            <FormControl w="300px">
              <FormLabel fontSize="sm">Client</FormLabel>
              <Select
                value={selectedCustomerId}
                onChange={(e) => {
                  const id = e.target.value
                  setSelectedCustomerId(id)
                }}
                placeholder="Select client"
                isDisabled={!canSelectCustomer}
              >
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </Select>
            </FormControl>
          </HStack>
        </VStack>
        <HStack>
          <Button
            id="email-accounts-tab-add-smtp-btn"
            data-testid="email-accounts-tab-add-smtp-btn"
            leftIcon={<AddIcon />}
            colorScheme="teal"
            variant="outline"
            onClick={onSmtpOpen}
            isDisabled={!selectedCustomerId || identities.filter((i) => i.isActive).length >= 5}
          >
            Add outbound mailbox
          </Button>
          <Button
            id="email-accounts-tab-connect-outlook-btn"
            data-testid="email-accounts-tab-connect-outlook-btn"
            leftIcon={<ExternalLinkIcon />}
            colorScheme="blue"
            onClick={handleConnectOutlook}
            isDisabled={identities.filter(i => i.isActive).length >= 5}
          >
            Connect Outlook mailbox
          </Button>
        </HStack>
      </Flex>

      {identities.length === 0 ? (
        <Alert status="info" mb={4}>
          <AlertIcon />
          <Box>
            <AlertTitle>No mailbox connected yet</AlertTitle>
            <AlertDescription>
              Connect a mailbox to start sending and to see mailbox health on this page.
            </AlertDescription>
          </Box>
        </Alert>
      ) : mailboxSummary.readyMailboxes < 1 ? (
        <Alert status="warning" mb={4}>
          <AlertIcon />
          <Box>
            <AlertTitle>No mailbox is ready to send</AlertTitle>
            <AlertDescription>
              Review the mailbox list below first. The follow-up section contains the deeper guardrail detail.
            </AlertDescription>
          </Box>
        </Alert>
      ) : mailboxSummary.needsAttention > 0 ? (
        <Alert status="warning" mb={4}>
          <AlertIcon />
          <Box>
            <AlertTitle>Some mailboxes need attention</AlertTitle>
            <AlertDescription>
              {`${mailboxSummary.readyMailboxes} ready to send, and ${mailboxSummary.needsAttention} need review.`}
            </AlertDescription>
          </Box>
        </Alert>
      ) : (
        <Alert status="success" mb={4}>
          <AlertIcon />
          <Box>
            <AlertTitle>Mailboxes look ready</AlertTitle>
            <AlertDescription>
              Connected mailboxes are currently available for normal sending within their configured limits.
            </AlertDescription>
          </Box>
        </Alert>
      )}

      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Connected mailboxes</StatLabel>
              <StatNumber>{mailboxSummary.connectedMailboxes}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Ready to send</StatLabel>
              <StatNumber>{mailboxSummary.readyMailboxes}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Need attention</StatLabel>
              <StatNumber>{mailboxSummary.needsAttention}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Outlook mailboxes</StatLabel>
              <StatNumber>{mailboxSummary.outlookMailboxes}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>

      {identities.filter(i => i.isActive).length >= 5 && (
        <Alert status="warning" mb={4}>
          <AlertIcon />
          <AlertDescription>
            You&apos;ve reached the maximum of 5 active sender accounts. Disconnect one before connecting another mailbox.
          </AlertDescription>
        </Alert>
      )}

      <Flex gap={4} mb={6} align="center">
        <InputGroup maxW="300px">
          <InputLeftElement>
            <Icon as={SearchIcon} color="gray.400" />
          </InputLeftElement>
          <Input
            placeholder="Search mailboxes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </InputGroup>

        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          maxW="180px"
        >
          <option value="all">All mailboxes</option>
          <option value="ready">Ready to send</option>
          <option value="attention">Need attention</option>
        </Select>

        <Spacer />

        {loading && <Spinner size="sm" />}
      </Flex>

      {identities.length === 0 && !error && (
        <Card mb={6}>
          <CardBody textAlign="center" py={10}>
            <Icon as={EmailIcon} boxSize={12} color="gray.400" mb={4} />
            <Text fontSize="lg" fontWeight="semibold" mb={2}>No mailboxes connected</Text>
            <Text color="gray.600" mb={4}>
              Connect Outlook (OAuth) or add an outbound mailbox via SMTP (Google-hosted or your provider&apos;s server).
            </Text>
            <HStack justify="center" spacing={3}>
              <Button colorScheme="teal" variant="outline" onClick={onSmtpOpen} isDisabled={!selectedCustomerId}>
                Add outbound mailbox
              </Button>
              <Button colorScheme="blue" onClick={handleConnectOutlook}>
                Connect Outlook mailbox
              </Button>
            </HStack>
          </CardBody>
        </Card>
      )}

      {identities.length > 0 && (
        <Card mb={6}>
          <CardBody p={0}>
            <Box overflowX="auto">
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>Mailbox</Th>
                    <Th>Health</Th>
                    <Th>Sending limits</Th>
                    <Th>Connected</Th>
                    <Th w="50px"></Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredIdentities.map((identity) => {
                    const capacityRow = identityCapacityById.get(identity.id)
                    const state = capacityRow?.state ?? (identity.isActive ? 'usable' : 'unavailable')
                    const reasonText = capacityRow?.reasons?.length
                      ? capacityRow.reasons.map(describeMailboxReason).join(' ')
                      : identity.isActive
                        ? 'Mailbox is available with no current warnings.'
                        : 'Mailbox is turned off.'

                    return (
                      <Tr key={identity.id}>
                        <Td>
                          <VStack align="start" spacing={1}>
                            <HStack>
                              <Icon as={EmailIcon} boxSize={4} color="blue.500" />
                              <Text fontWeight="semibold">{identity.displayName || identity.emailAddress}</Text>
                            </HStack>
                            <Text fontSize="sm" color="gray.600">{identity.emailAddress}</Text>
                            <Badge variant="outline" size="sm">
                              {identity.provider.toUpperCase()}
                            </Badge>
                          </VStack>
                        </Td>
                        <Td>
                          <VStack align="start" spacing={1}>
                            <Badge colorScheme={mailboxStateColor(state)} size="sm">
                              {formatMailboxState(state)}
                            </Badge>
                            <Text fontSize="xs" color="gray.600" maxW="260px">
                              {reasonText}
                            </Text>
                          </VStack>
                        </Td>
                        <Td>
                          <VStack align="start" spacing={0}>
                            <Text>{identity.dailySendLimit}/day</Text>
                            <Text fontSize="xs" color="gray.600">
                              {identity.sendWindowHoursStart}:00 to {identity.sendWindowHoursEnd}:00 {identity.sendWindowTimeZone || 'UTC'}
                            </Text>
                          </VStack>
                        </Td>
                        <Td>
                          <Text fontSize="xs" color="gray.600">
                            {new Date(identity.createdAt).toLocaleDateString()}
                          </Text>
                        </Td>
                        <Td>
                          <Menu>
                            <MenuButton
                              as={IconButton}
                              icon={<SettingsIcon />}
                              size="sm"
                              variant="ghost"
                            />
                            <MenuList>
                              <MenuItem icon={<EditIcon />} onClick={() => handleEditIdentity(identity)}>
                                Manage mailbox
                              </MenuItem>
                              {identity.provider === 'outlook' && (
                                <MenuItem icon={<EmailIcon />} onClick={() => handleTestSend(identity)}>
                                  Send test email
                                </MenuItem>
                              )}
                              <MenuItem
                                icon={identity.isActive ? <WarningIcon /> : <CheckCircleIcon />}
                                onClick={() => handleToggleActive(identity)}
                              >
                                {identity.isActive ? 'Turn off mailbox' : 'Turn on mailbox'}
                              </MenuItem>
                              <MenuDivider />
                              <MenuItem
                                icon={<DeleteIcon />}
                                color="red.500"
                                onClick={() => handleDeleteIdentity(identity)}
                              >
                                Disconnect mailbox
                              </MenuItem>
                            </MenuList>
                          </Menu>
                        </Td>
                      </Tr>
                    )
                  })}
                </Tbody>
              </Table>
            </Box>
          </CardBody>
        </Card>
      )}

      <Card id="email-accounts-followup" data-testid="email-accounts-followup" mb={6} variant="outline" borderColor="gray.200" bg="gray.50">
        <CardBody>
          <Flex justify="space-between" align="center" mb={4} wrap="wrap" gap={3}>
            <VStack align="start" spacing={1}>
              <Text fontSize="lg" fontWeight="semibold">Follow-up &amp; troubleshooting</Text>
              <Text fontSize="sm" color="gray.600">
                Secondary detail for deeper mailbox checks, technical guardrails, and manual inbox-message pulls.
              </Text>
            </VStack>
            <Button
              id="email-accounts-tab-refresh-btn"
              data-testid="email-accounts-tab-refresh-btn"
              variant="outline"
              onClick={() => void handleRefreshAll()}
              isLoading={loading || capacityLoading}
            >
              Refresh mailbox status
            </Button>
          </Flex>

          <Alert status="info" mb={4}>
            <AlertIcon />
            <Box>
              <AlertTitle>Mailbox safety cap</AlertTitle>
              <AlertDescription>
                Every sending address is strictly capped at {MAX_DAILY_SEND_LIMIT} emails per day. Higher values are reduced automatically in backend truth.
              </AlertDescription>
            </Box>
          </Alert>

          <Card id="email-accounts-identity-capacity-panel" data-testid="email-accounts-identity-capacity-panel">
            <CardBody>
              <Flex justify="space-between" align="center" mb={4}>
                <Text fontSize="lg" fontWeight="semibold">Mailbox health details</Text>
                {capacityLoading && <Spinner size="sm" />}
              </Flex>

              {capacityError ? (
                <Alert status="warning" mb={3}>
                  <AlertIcon />
                  <AlertDescription>{capacityError}</AlertDescription>
                </Alert>
              ) : null}

              <SimpleGrid id="email-accounts-identity-summary" data-testid="email-accounts-identity-summary" columns={{ base: 2, md: 5 }} spacing={3} mb={4}>
                <Card variant="outline"><CardBody py={3}><Stat><StatLabel>Connected</StatLabel><StatNumber>{identityCapacity?.summary.total ?? 0}</StatNumber></Stat></CardBody></Card>
                <Card variant="outline"><CardBody py={3}><Stat><StatLabel>Ready</StatLabel><StatNumber>{identityCapacity?.summary.usable ?? 0}</StatNumber></Stat></CardBody></Card>
                <Card variant="outline"><CardBody py={3}><Stat><StatLabel>Unavailable</StatLabel><StatNumber>{identityCapacity?.summary.unavailable ?? 0}</StatNumber></Stat></CardBody></Card>
                <Card variant="outline"><CardBody py={3}><Stat><StatLabel>Needs attention</StatLabel><StatNumber>{identityCapacity?.summary.risky ?? 0}</StatNumber></Stat></CardBody></Card>
                <Card variant="outline"><CardBody py={3}><Stat><StatLabel>Recommended mailbox</StatLabel><StatNumber fontSize="md">{recommendedMailboxLabel}</StatNumber></Stat></CardBody></Card>
              </SimpleGrid>

              {!capacityError && identityCapacity && identityCapacity.rows.length === 0 ? (
                <Alert status="info" mb={4}>
                  <AlertIcon />
                  <Box>
                    <AlertTitle>No sending mailbox connected</AlertTitle>
                    <AlertDescription>Connect an active mailbox for this client to see deeper mailbox health detail here.</AlertDescription>
                  </Box>
                </Alert>
              ) : null}

              {!!identityCapacity?.guardrails?.warnings?.length && (
                <Alert id="email-accounts-identity-guardrails" data-testid="email-accounts-identity-guardrails" status="warning" mb={4}>
                  <AlertIcon />
                  <Box>
                    <AlertTitle>Sending guardrail warning</AlertTitle>
                    <AlertDescription>{identityCapacity.guardrails.warnings.join(' ')}</AlertDescription>
                  </Box>
                </Alert>
              )}

              <Box id="email-accounts-identity-rows" data-testid="email-accounts-identity-rows" overflowX="auto">
                <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th>Mailbox</Th>
                      <Th>Status</Th>
                      <Th isNumeric>Queue sends (audited)</Th>
                      <Th isNumeric>Queue failures (audited)</Th>
                      <Th>Queued now</Th>
                      <Th>Last recorded campaign send</Th>
                      <Th isNumeric>Campaign bounces (window)</Th>
                      <Th>Technical detail</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {(identityCapacity?.rows ?? []).map((row) => (
                      <Tr key={row.identityId}>
                        <Td>{row.label ? `${row.label} (${row.email})` : row.email}</Td>
                        <Td>
                          <Badge id="email-accounts-identity-state" data-testid="email-accounts-identity-state" colorScheme={mailboxStateColor(row.state)}>
                            {formatMailboxState(row.state)}
                          </Badge>
                        </Td>
                        <Td isNumeric>{row.recent?.sent ?? 0}</Td>
                        <Td isNumeric>{row.recent?.sendFailed ?? 0}</Td>
                        <Td fontSize="xs">{row.queuePressure?.queuedNow ?? 0} queued</Td>
                        <Td fontSize="xs">
                          {row.lastRecordedOutboundAt
                            ? new Date(row.lastRecordedOutboundAt).toLocaleString()
                            : '—'}
                        </Td>
                        <Td isNumeric>{row.recentCampaignBounces ?? 0}</Td>
                        <Td fontSize="xs">{row.reasons?.length ? row.reasons.map(describeMailboxReason).join(' ') : 'No current guardrail issues.'}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
              <Text id="email-accounts-last-updated" data-testid="email-accounts-last-updated" fontSize="xs" color="gray.500" mt={2}>
                Last updated: {identityCapacity?.lastUpdatedAt ? new Date(identityCapacity.lastUpdatedAt).toLocaleString() : '—'}
                {' · '}
                Queue sends/failures are from sequence <strong>OutboundSendAttemptAudit</strong> rows in the window above.
                Last recorded campaign send and campaign bounces come from <strong>EmailEvent</strong> (not sequence queue
                sends).
              </Text>
            </CardBody>
          </Card>
        </CardBody>
      </Card>

      {/* Edit Identity Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Email Account</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {editingIdentity && (
              <VStack spacing={4}>
                <FormControl>
                  <FormLabel>Email Address</FormLabel>
                  <Input value={editingIdentity.emailAddress} isReadOnly bg="gray.50" />
                </FormControl>
                <FormControl>
                  <FormLabel>Display Name</FormLabel>
                  <Input
                    value={editingIdentity.displayName || ''}
                    onChange={(e) => setEditingIdentity({...editingIdentity, displayName: e.target.value})}
                    placeholder="Your Name"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Daily Send Limit</FormLabel>
                  <NumberInput
                    value={editingIdentity.dailySendLimit}
                    onChange={(_, val) => setEditingIdentity({...editingIdentity, dailySendLimit: Math.min(MAX_DAILY_SEND_LIMIT, Math.max(1, val || MAX_DAILY_SEND_LIMIT))})}
                    min={1}
                    max={MAX_DAILY_SEND_LIMIT}
                  >
                    <NumberInputField />
                  </NumberInput>
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    Strict maximum: {MAX_DAILY_SEND_LIMIT} emails per day for each sending address.
                  </Text>
                </FormControl>

                <FormControl>
                  <FormLabel>Signature HTML</FormLabel>
                  <Textarea
                    value={editingIdentity.signatureHtml || ''}
                    onChange={(e) => setEditingIdentity({ ...editingIdentity, signatureHtml: e.target.value })}
                    minH="180px"
                    fontFamily="mono"
                    fontSize="sm"
                    placeholder="<div><strong>{{sender_name}}</strong><br/><a href=&quot;mailto:{{sender_email}}&quot;>{{sender_email}}</a></div>"
                  />
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    Use {`{{email_signature}}`} in templates to insert this sender signature.
                  </Text>
                </FormControl>

                <FormControl>
                  <FormLabel>Send Window</FormLabel>
                  <HStack spacing={2}>
                    <NumberInput
                      value={editingIdentity.sendWindowHoursStart}
                      onChange={(_, val) => setEditingIdentity({...editingIdentity, sendWindowHoursStart: val || 9})}
                      min={0}
                      max={23}
                      maxW="100px"
                    >
                      <NumberInputField />
                    </NumberInput>
                    <Text fontSize="sm" color="gray.500">to</Text>
                    <NumberInput
                      value={editingIdentity.sendWindowHoursEnd}
                      onChange={(_, val) => setEditingIdentity({...editingIdentity, sendWindowHoursEnd: val || 17})}
                      min={0}
                      max={23}
                      maxW="100px"
                    >
                      <NumberInputField />
                    </NumberInput>
                    <Text fontSize="sm" color="gray.500">
                      {editingIdentity.sendWindowTimeZone || 'UTC'}
                    </Text>
                  </HStack>
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    Hours when emails can be sent (0-23, local time)
                  </Text>
                </FormControl>
                <Flex w="100%" justify="flex-end" gap={2} mt={4}>
                  <Button variant="ghost" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button colorScheme="blue" onClick={handleSaveIdentity}>
                    Save Changes
                  </Button>
                </Flex>
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      <SmtpEmailIdentityModal
        customerId={selectedCustomerId || ''}
        isOpen={isSmtpOpen}
        onClose={onSmtpClose}
        onCreated={() => void loadIdentities()}
      />
    </Box>
    </RequireActiveClient>
  )
}

export default EmailAccountsTab
