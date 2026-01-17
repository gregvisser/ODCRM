/**
 * Email Accounts Enhanced Tab
 * Supports both OAuth (Outlook) and SMTP email accounts
 * Ported from OpensDoorsV2 email-accounts/ui.tsx
 */

import { useState, useEffect, useRef } from 'react'
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
import { api } from '../utils/api'

interface EmailIdentity {
  id: string
  emailAddress: string
  displayName?: string
  provider: string // 'outlook' or 'smtp'
  isActive: boolean
  dailySendLimit: number
  createdAt: string
  
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

export default function EmailAccountsEnhancedTab() {
  const [identities, setIdentities] = useState<EmailIdentity[]>([])
  const [loading, setLoading] = useState(true)
  const [customerId, setCustomerId] = useState<string>('prod-customer-1')
  
  const [smtpForm, setSmtpForm] = useState<SmtpFormState>({
    customerId: 'prod-customer-1',
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

  const fetchIdentities = async () => {
    setLoading(true)
    const { data, error } = await api.get<EmailIdentity[]>(`/api/outlook/identities?customerId=${customerId}`)
    if (error) {
      toast({ title: 'Error', description: error, status: 'error' })
    } else if (data) {
      setIdentities(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (customerId) {
      fetchIdentities()
    }
  }, [customerId])

  const handleConnectOutlook = () => {
    window.location.href = `http://${window.location.hostname.includes('localhost') ? 'localhost:3001' : 'odcrm-api.onrender.com'}/api/outlook/auth?customerId=${customerId}`
  }

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
    // This would need a dedicated endpoint - for now using a placeholder
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
      const apiUrl = window.location.hostname.includes('localhost') 
        ? 'http://localhost:3001' 
        : 'https://odcrm-api.onrender.com'
      const response = await fetch(`${apiUrl}/api/outlook/identities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error('Failed to create SMTP account')
      }

      toast({
        title: 'Success',
        description: 'SMTP account created',
        status: 'success',
      })

      onSmtpClose()
      fetchIdentities()
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

    toast({
      title: 'Sending test email...',
      status: 'info',
      duration: 2000,
    })

    // Would need a test send endpoint
    setTimeout(() => {
      toast({
        title: 'Test Send',
        description: 'Test send functionality would be implemented here',
        status: 'info',
      })
    }, 2000)
  }

  const handleDisconnect = async (id: string) => {
    if (!confirm('Disconnect this email account?')) return

    const { error } = await api.delete(`/api/outlook/identities/${id}`)
    if (error) {
      toast({ title: 'Error', description: error, status: 'error' })
    } else {
      toast({ title: 'Success', description: 'Account disconnected', status: 'success' })
      fetchIdentities()
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
          <Heading size="lg">Email Accounts</Heading>
          <Text fontSize="sm" color="gray.600">
            Manage OAuth and SMTP email accounts for sending
          </Text>
        </Box>
        <HStack>
          <Button leftIcon={<AddIcon />} colorScheme="gray" onClick={handleConnectOutlook} size="sm">
            Connect Outlook
          </Button>
          <Button leftIcon={<AddIcon />} colorScheme="teal" onClick={handleCreateSMTP} size="sm">
            Add SMTP Account
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
                  <HStack justify="center" spacing={3}>
                    <Button size="sm" onClick={handleConnectOutlook}>
                      Connect Outlook
                    </Button>
                    <Button size="sm" colorScheme="teal" onClick={handleCreateSMTP}>
                      Add SMTP Account
                    </Button>
                  </HStack>
                </Td>
              </Tr>
            ) : (
              identities.map((identity) => (
                <Tr key={identity.id}>
                  <Td fontWeight="medium">{identity.emailAddress}</Td>
                  <Td fontSize="sm">{identity.displayName || '-'}</Td>
                  <Td>
                    <Badge colorScheme={identity.provider === 'outlook' ? 'blue' : 'purple'}>
                      {identity.provider.toUpperCase()}
                    </Badge>
                  </Td>
                  <Td fontSize="sm">{identity.dailySendLimit}/day</Td>
                  <Td>
                    <Badge colorScheme={identity.isActive ? 'green' : 'red'}>
                      {identity.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </Td>
                  <Td>
                    <HStack spacing={1}>
                      <Button size="xs" variant="ghost" onClick={() => handleTestSend(identity)}>
                        Test
                      </Button>
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
              ))
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
