/**
 * Email Accounts Enhanced Tab
 * Supports both OAuth (Outlook) and SMTP email accounts
 * Ported from OpensDoorsV2 email-accounts/ui.tsx
 */

import { useCallback, useEffect, useRef, useState } from 'react'
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
  VStack,
  Text,
  IconButton,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useToast,
  Spinner,
  Alert,
  AlertIcon,
  AlertDescription,
  FormControl,
  FormLabel,
  Input,
  NumberInput,
  NumberInputField,
  Switch,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Code,
} from '@chakra-ui/react'
import { AddIcon, DeleteIcon, EditIcon } from '@chakra-ui/icons'
import { settingsStore } from '../platform'
import { emit } from '../platform/events'
import { api } from '../utils/api'

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

type SmtpFormState = {
  id?: string
  customerId: string
  emailAddress: string
  displayName: string
  smtpHost: string
  smtpPort: number
  smtpUsername: string
  smtpPassword: string
  smtpSecure: boolean
  dailySendLimit: number
}

type EmailAccountsEnhancedTabProps = {
  customerId?: string
  /**
   * Optional preflight before starting OAuth redirect.
   * Return true to proceed; false to cancel.
   */
  onBeforeConnectOutlook?: () => Promise<boolean> | boolean
}

export default function EmailAccountsEnhancedTab({ customerId: customerIdProp, onBeforeConnectOutlook }: EmailAccountsEnhancedTabProps) {
  const [identities, setIdentities] = useState<EmailIdentity[]>([])
  const [loading, setLoading] = useState(true)
  const [customerId, setCustomerId] = useState<string>(customerIdProp || settingsStore.getCurrentCustomerId('prod-customer-1'))
  
  const [smtpForm, setSmtpForm] = useState<SmtpFormState>({
    customerId: customerIdProp || settingsStore.getCurrentCustomerId('prod-customer-1'),
    emailAddress: '',
    displayName: '',
    smtpHost: '',
    smtpPort: 587,
    smtpUsername: '',
    smtpPassword: '',
    smtpSecure: false,
    dailySendLimit: 150,
  })

  const { isOpen: isSmtpOpen, onOpen: onSmtpOpen, onClose: onSmtpClose } = useDisclosure()
  const toast = useToast()

  const fetchIdentities = useCallback(async () => {
    setLoading(true)
    const { data, error } = await api.get<EmailIdentity[]>(`/api/outlook/identities?customerId=${customerId}`)
    if (error) {
      toast({ title: 'Error', description: error, status: 'error' })
    } else if (data) {
      setIdentities(data)
    }
    setLoading(false)
  }, [customerId, toast])

  useEffect(() => {
    if (customerId) {
      fetchIdentities()
    }
  }, [customerId, fetchIdentities])

  // Keep internal state synced to provided prop (embedded onboarding mode)
  useEffect(() => {
    if (!customerIdProp) return
    setCustomerId(customerIdProp)
    setSmtpForm((prev) => ({ ...prev, customerId: customerIdProp }))
  }, [customerIdProp])

  useEffect(() => {
    // In embedded mode (prop-controlled), do not subscribe to global settingsStore.
    if (customerIdProp) return
    const unsubscribe = settingsStore.onSettingsUpdated((detail) => {
      const next = (detail as { currentCustomerId?: string } | null)?.currentCustomerId
      if (next) {
        setCustomerId(next)
        setSmtpForm((prev) => ({ ...prev, customerId: next }))
      }
    })
    return () => unsubscribe()
  }, [customerIdProp])

  const handleConnectOutlook = async () => {
    // LOCKDOWN: Require valid customerId before connecting
    if (!customerId || customerId === 'prod-customer-1' || customerId.startsWith('test-')) {
      toast({
        title: 'Select a customer first',
        description: 'You must select a valid customer before connecting an Outlook account.',
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
    
    // Use centralized API URL from environment
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    const returnTo = window.location.pathname + window.location.search + window.location.hash
    window.location.href = `${apiUrl}/api/outlook/auth?customerId=${encodeURIComponent(customerId)}&returnTo=${encodeURIComponent(returnTo)}`
  }
  
  // Check if a valid customer is selected
  const isValidCustomer = customerId && customerId !== 'prod-customer-1' && !customerId.startsWith('test-')

  // After returning from OAuth, show a toast + refresh identities, then clear URL flag.
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      if (url.searchParams.get('emailConnected') !== '1') return
      const connectedEmail = url.searchParams.get('connectedEmail') || url.searchParams.get('email') || ''
      toast({
        title: 'Email connected',
        description: connectedEmail ? `Connected ${connectedEmail}` : 'Outlook account connected successfully.',
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
  }, [fetchIdentities, toast])

  const handleCreateSMTP = () => {
    setSmtpForm({
      customerId,
      emailAddress: '',
      displayName: '',
      smtpHost: 'smtp.office365.com',
      smtpPort: 587,
      smtpUsername: '',
      smtpPassword: '',
      smtpSecure: false,
      dailySendLimit: 150,
    })
    onSmtpOpen()
  }

  const handleSaveSMTP = async () => {
    if (!smtpForm.emailAddress || !smtpForm.smtpHost || !smtpForm.smtpUsername || !smtpForm.smtpPassword) {
      toast({
        title: 'Validation Error',
        description: 'Email, SMTP host, username, and password are required',
        status: 'error',
      })
      return
    }

    // Create SMTP email identity
    const payload = {
      customerId: smtpForm.customerId,
      emailAddress: smtpForm.emailAddress,
      displayName: smtpForm.displayName,
      provider: 'smtp',
      smtpHost: smtpForm.smtpHost,
      smtpPort: smtpForm.smtpPort,
      smtpUsername: smtpForm.smtpUsername,
      smtpPassword: smtpForm.smtpPassword,
      smtpSecure: smtpForm.smtpSecure,
      dailySendLimit: smtpForm.dailySendLimit,
      isActive: true,
    }

    try {
      const { error } = await api.post('/api/outlook/identities', payload)
      if (error) throw new Error(error)
      toast({
        title: 'Success',
        description: 'SMTP account created',
        status: 'success',
      })

      onSmtpClose()
      fetchIdentities()
      if (smtpForm.customerId) emit('customerUpdated', { id: smtpForm.customerId })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create SMTP account',
        status: 'error',
      })
    }
  }

  const handleTestSend = async (identity: EmailIdentity) => {
    const testEmail = prompt('Send test email to:')
    if (!testEmail) return

    // Validate email format
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
      duration: null, // Keep open until replaced
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
        toEmail: testEmail
      })

      if (error || data?.error) {
        const errorMsg = error || data?.error || 'Unknown error'
        const errorCode = data?.code || ''
        const requestId = data?.requestId || ''
        
        console.error('[TestSend] Failed:', { error: errorMsg, code: errorCode, requestId })
        
        toast.closeAll()
        toast({
          title: 'Test send failed',
          description: `${errorMsg}${requestId ? ` (Request ID: ${requestId})` : ''}`,
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
          description: `Sent from ${identity.emailAddress} to ${testEmail}${requestId ? ` (ID: ${requestId.substring(0, 8)}...)` : ''}`,
          status: 'success',
          duration: 6000,
          isClosable: true,
        })
      }
    } catch (err: any) {
      console.error('[TestSend] Exception:', err)
      toast.closeAll()
      toast({
        title: 'Test send failed',
        description: err.message || 'Network error',
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
      toast({ title: 'Success', description: 'Account disconnected', status: 'success' })
      fetchIdentities()
      if (customerId) emit('customerUpdated', { id: customerId })
    }
  }

  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="xl" />
      </Box>
    )
  }

  return (
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
            Connect Microsoft Outlook accounts for sending emails
          </Text>
        </Box>
        <HStack>
          <Button
            leftIcon={<AddIcon />}
            colorScheme="blue"
            onClick={handleConnectOutlook}
            size="sm"
            isDisabled={!isValidCustomer || identities.length >= 5}
            title={
              !isValidCustomer 
                ? 'Select a customer first' 
                : identities.length >= 5 
                  ? 'Limit reached (5). Disconnect one to add another.'
                  : 'Connect Outlook account'
            }
          >
            Connect Outlook
          </Button>
        </HStack>
      </HStack>

      <Alert status="info" mb={6}>
        <AlertIcon />
        <AlertDescription fontSize="sm">
          <strong>Deliverability:</strong> Configure SPF, DKIM, and DMARC on your domain. Keep daily send limits
          reasonable (150-200 per account).
        </AlertDescription>
      </Alert>

      <Box bg="white" borderRadius="lg" border="1px solid" borderColor="gray.200" overflowX="auto">
        <Table size="sm">
          <Thead bg="gray.50">
            <Tr>
              <Th>Email Address</Th>
              <Th>Display Name</Th>
              <Th>Type</Th>
              <Th>Daily Limit</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {identities.length === 0 ? (
              <Tr>
                <Td colSpan={6} textAlign="center" py={8}>
                  <Text color="gray.500" mb={3}>
                    No email accounts connected yet.
                  </Text>
                  {!isValidCustomer && (
                    <Text color="orange.500" fontSize="sm" mb={3}>
                      Select a customer first to connect email accounts.
                    </Text>
                  )}
                  <HStack justify="center" spacing={3}>
                    <Button 
                      size="sm" 
                      colorScheme="blue"
                      onClick={handleConnectOutlook} 
                      isDisabled={!isValidCustomer}
                    >
                      Connect Outlook
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
                  return (
                <Tr key={identity.id}>
                  <Td fontWeight="medium">{identity.emailAddress}</Td>
                  <Td fontSize="sm">{identity.displayName || '-'}</Td>
                  <Td>
                    <HStack spacing={2}>
                      <Badge colorScheme={identity.provider === 'outlook' ? 'blue' : 'purple'}>
                        {identity.provider.toUpperCase()}
                      </Badge>
                      {needsReconnect ? (
                        <Badge colorScheme="orange" variant="subtle">
                          Needs reconnect
                        </Badge>
                      ) : null}
                    </HStack>
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
                          Reconnect
                        </Button>
                      ) : (
                        <Button size="xs" variant="ghost" onClick={() => handleTestSend(identity)}>
                        Test
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

      {/* Create SMTP Account Modal */}
      <Modal isOpen={isSmtpOpen} onClose={onSmtpClose} size="2xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add SMTP Email Account</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <Alert status="info" fontSize="sm">
                <AlertIcon />
                <Text fontSize="xs">
                  Common settings: <Code fontSize="xs">smtp.office365.com:587</Code> (Office 365),{' '}
                  <Code fontSize="xs">smtp.gmail.com:587</Code> (Gmail)
                </Text>
              </Alert>

              <FormControl isRequired>
                <FormLabel fontSize="sm">Email Address</FormLabel>
                <Input
                  value={smtpForm.emailAddress}
                  onChange={(e) => setSmtpForm({ ...smtpForm, emailAddress: e.target.value })}
                  placeholder="your@email.com"
                  type="email"
                />
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm">Display Name</FormLabel>
                <Input
                  value={smtpForm.displayName}
                  onChange={(e) => setSmtpForm({ ...smtpForm, displayName: e.target.value })}
                  placeholder="Your Name"
                />
              </FormControl>

              <HStack>
                <FormControl isRequired>
                  <FormLabel fontSize="sm">SMTP Host</FormLabel>
                  <Input
                    value={smtpForm.smtpHost}
                    onChange={(e) => setSmtpForm({ ...smtpForm, smtpHost: e.target.value })}
                    placeholder="smtp.office365.com"
                  />
                </FormControl>

                <FormControl isRequired w="30%">
                  <FormLabel fontSize="sm">Port</FormLabel>
                  <NumberInput
                    value={smtpForm.smtpPort}
                    onChange={(_, num) => setSmtpForm({ ...smtpForm, smtpPort: num || 587 })}
                    min={1}
                    max={65535}
                  >
                    <NumberInputField />
                  </NumberInput>
                </FormControl>
              </HStack>

              <FormControl display="flex" alignItems="center">
                <FormLabel fontSize="sm" mb={0}>
                  Use SSL/TLS
                </FormLabel>
                <Switch
                  isChecked={smtpForm.smtpSecure}
                  onChange={(e) => setSmtpForm({ ...smtpForm, smtpSecure: e.target.checked })}
                />
                <Text fontSize="xs" color="gray.500" ml={3}>
                  (For port 587 with STARTTLS, keep this OFF)
                </Text>
              </FormControl>

              <FormControl isRequired>
                <FormLabel fontSize="sm">SMTP Username</FormLabel>
                <Input
                  value={smtpForm.smtpUsername}
                  onChange={(e) => setSmtpForm({ ...smtpForm, smtpUsername: e.target.value })}
                  placeholder="your@email.com"
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel fontSize="sm">SMTP Password</FormLabel>
                <Input
                  type="password"
                  value={smtpForm.smtpPassword}
                  onChange={(e) => setSmtpForm({ ...smtpForm, smtpPassword: e.target.value })}
                  placeholder="••••••••"
                />
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm">Daily Send Limit</FormLabel>
                <NumberInput
                  value={smtpForm.dailySendLimit}
                  onChange={(_, num) => setSmtpForm({ ...smtpForm, dailySendLimit: num || 150 })}
                  min={1}
                  max={500}
                >
                  <NumberInputField />
                </NumberInput>
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Recommended: 150-200 emails per day per account
                </Text>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onSmtpClose}>
              Cancel
            </Button>
            <Button colorScheme="teal" onClick={handleSaveSMTP}>
              Add SMTP Account
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}
