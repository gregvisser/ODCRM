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
import { getItem, setItem } from '../../../platform/storage'
import { OdcrmStorageKeys } from '../../../platform/keys'
import { emit } from '../../../platform/events'

// Leaf helpers to avoid circular dependency with platform/stores/settings (TDZ crash when loading marketing tab).
function getCurrentCustomerId(fallback = 'prod-customer-1'): string {
  const v = getItem(OdcrmStorageKeys.currentCustomerId)
  if (v && String(v).trim()) return String(v)
  if (fallback && String(fallback).trim()) setItem(OdcrmStorageKeys.currentCustomerId, String(fallback).trim())
  return fallback
}
function setCurrentCustomerId(customerId: string): void {
  setItem(OdcrmStorageKeys.currentCustomerId, String(customerId || '').trim())
  emit('settingsUpdated', { currentCustomerId: String(customerId || '').trim() })
}

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
}

type Customer = {
  id: string
  name: string
}

const EmailAccountsTab: React.FC = () => {
  const [identities, setIdentities] = useState<EmailIdentity[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [editingIdentity, setEditingIdentity] = useState<EmailIdentity | null>(null)
  const toast = useToast()
  const selectedCustomerIdRef = useRef(selectedCustomerId)

  useEffect(() => {
    selectedCustomerIdRef.current = selectedCustomerId
  }, [selectedCustomerId])

  useEffect(() => {
    loadCustomers()
  }, [])

  useEffect(() => {
    if (selectedCustomerId) {
      loadIdentities()
    } else {
      setIdentities([])
      setError(null)
      setLoading(false)
    }
  }, [selectedCustomerId, loadIdentities])

  const loadCustomers = async () => {
    const { data, error: apiError } = await api.get('/api/customers')

    if (apiError) {
      console.error('Failed to load customers:', apiError)
      const defaultCustomerId = getCurrentCustomerId('prod-customer-1')
      setSelectedCustomerId(defaultCustomerId)
      setCustomers([{ id: defaultCustomerId, name: 'Default Customer' }])
      return
    }

    try {
      const customerList = normalizeCustomersListResponse(data) as Customer[]
      setCustomers(customerList)

      const currentCustomerId = getCurrentCustomerId('prod-customer-1')
      const currentCustomer = customerList.find(c => c.id === currentCustomerId)
      if (currentCustomer) {
        setSelectedCustomerId(currentCustomerId)
      } else if (customerList.length > 0) {
        setSelectedCustomerId(customerList[0].id)
      }
    } catch (err: any) {
      console.error('❌ Failed to normalize customers in EmailAccountsTab:', err)
      const defaultCustomerId = getCurrentCustomerId('prod-customer-1')
      setSelectedCustomerId(defaultCustomerId)
      setCustomers([{ id: defaultCustomerId, name: 'Default Customer' }])
    }
  }

  const loadIdentities = useCallback(async () => {
    if (!selectedCustomerId) return
    const requestedCustomerId = selectedCustomerId
    setLoading(true)
    setError(null)

    const { data, error: apiError } = await api.get<EmailIdentity[]>(
      `/api/outlook/identities?customerId=${encodeURIComponent(requestedCustomerId)}`
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

  const filteredIdentities = useMemo(() => {
    return identities
      .filter((identity) => identity.provider !== 'outlook_app_only')
      .filter(identity => {
      const matchesSearch = searchQuery === '' ||
        identity.emailAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
        identity.displayName?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'active' && identity.isActive) ||
        (statusFilter === 'inactive' && !identity.isActive)

      return matchesSearch && matchesStatus
    })
  }, [identities, searchQuery, statusFilter])

  const stats = useMemo(() => {
    return {
      totalAccounts: identities.length,
      activeAccounts: identities.filter(a => a.isActive).length,
      outlookAccounts: identities.filter(a => a.provider === 'outlook').length,
      smtpAccounts: identities.filter(a => a.provider === 'smtp').length,
    }
  }, [identities])

  const handleConnectOutlook = () => {
    if (!selectedCustomerId) {
      toast({
        title: 'No customer selected',
        description: 'Please select a customer first',
        status: 'error',
        duration: 3000,
      })
      return
    }

    // Open OAuth flow in same window - backend will redirect back
    const apiBaseUrl = import.meta.env.VITE_API_URL || ''
    window.location.href = `${apiBaseUrl}/api/outlook/auth?customerId=${selectedCustomerId}`
  }

  const handleEditIdentity = (identity: EmailIdentity) => {
    setEditingIdentity(identity)
    onOpen()
  }

  const handleSaveIdentity = async () => {
    if (!editingIdentity) return

    const { error: apiError } = await api.patch(`/api/outlook/identities/${editingIdentity.id}`, {
      displayName: editingIdentity.displayName,
      dailySendLimit: editingIdentity.dailySendLimit,
      sendWindowHoursStart: editingIdentity.sendWindowHoursStart,
      sendWindowHoursEnd: editingIdentity.sendWindowHoursEnd,
      sendWindowTimeZone: editingIdentity.sendWindowTimeZone,
      isActive: editingIdentity.isActive,
    })

    if (apiError) {
      toast({
        title: 'Failed to update account',
        description: apiError,
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
    })

    if (apiError) {
      toast({
        title: 'Test send failed',
        description: apiError,
        status: 'error',
        duration: 5000,
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
    })

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

    const { error: apiError } = await api.delete(`/api/outlook/identities/${identity.id}`)

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
      <Box>
        <VStack align="start" spacing={1} mb={4}>
          <Text fontSize="2xl" fontWeight="bold">Email Accounts</Text>
          <Text color="gray.600">Connect Outlook accounts to send campaigns (max 5 per customer)</Text>
          <FormControl w="300px" mt={2}>
            <FormLabel fontSize="sm">Customer</FormLabel>
            <Select
              value=""
              onChange={(e) => {
                const id = e.target.value
                if (id) {
                  setSelectedCustomerId(id)
                  setCurrentCustomerId(id)
                }
              }}
              placeholder="Select customer"
            >
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </Select>
          </FormControl>
        </VStack>
        <Card>
          <CardBody textAlign="center" py={10}>
            <Icon as={EmailIcon} boxSize={12} color="gray.400" mb={4} />
            <Text fontSize="lg" fontWeight="semibold" mb={2}>Select a customer to view email accounts</Text>
            <Text color="gray.600">
              Choose a customer from the dropdown above to see their connected email accounts, or connect new ones.
            </Text>
          </CardBody>
        </Card>
      </Box>
    )
  }

  if (loading && identities.length === 0) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="lg" mb={4} />
        <Text>Loading email accounts...</Text>
      </Box>
    )
  }

  return (
    <Box>
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
            Connect Outlook accounts to send campaigns (max 5 per customer)
          </Text>
          <HStack spacing={4} mt={2}>
            <FormControl w="300px">
              <FormLabel fontSize="sm">Customer</FormLabel>
              <Select
                value={selectedCustomerId}
                onChange={(e) => {
                  const id = e.target.value
                  setSelectedCustomerId(id)
                  setCurrentCustomerId(id)
                }}
                placeholder="Select customer"
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
        <Button
          leftIcon={<ExternalLinkIcon />}
          colorScheme="blue"
          onClick={handleConnectOutlook}
          isDisabled={identities.filter(i => i.isActive).length >= 5}
        >
          Connect Outlook
        </Button>
      </Flex>

      {/* Stats */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Total Accounts</StatLabel>
              <StatNumber>{stats.totalAccounts}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Active</StatLabel>
              <StatNumber>{stats.activeAccounts}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Outlook</StatLabel>
              <StatNumber>{stats.outlookAccounts}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>SMTP</StatLabel>
              <StatNumber>{stats.smtpAccounts}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* Limit warning */}
      {identities.filter(i => i.isActive).length >= 5 && (
        <Alert status="warning" mb={4}>
          <AlertIcon />
          <AlertDescription>
            You've reached the maximum of 5 active sender accounts. Deactivate one to connect another.
          </AlertDescription>
        </Alert>
      )}

      {/* Controls */}
      <Flex gap={4} mb={6} align="center">
        <InputGroup maxW="300px">
          <InputLeftElement>
            <Icon as={SearchIcon} color="gray.400" />
          </InputLeftElement>
          <Input
            placeholder="Search accounts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </InputGroup>

        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          maxW="150px"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>

        <Spacer />

        {loading && <Spinner size="sm" />}
      </Flex>

      {/* Empty state */}
      {identities.length === 0 && !error && (
        <Card>
          <CardBody textAlign="center" py={10}>
            <Icon as={EmailIcon} boxSize={12} color="gray.400" mb={4} />
            <Text fontSize="lg" fontWeight="semibold" mb={2}>No email accounts connected</Text>
            <Text color="gray.600" mb={4}>
              Connect an Outlook account to start sending campaigns.
            </Text>
            <Button colorScheme="blue" onClick={handleConnectOutlook}>
              Connect Outlook Account
            </Button>
          </CardBody>
        </Card>
      )}

      {/* Accounts Table */}
      {identities.length > 0 && (
        <Card>
          <CardBody p={0}>
            <Box overflowX="auto">
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>Account</Th>
                    <Th>Provider</Th>
                    <Th>Status</Th>
                    <Th isNumeric>Daily Limit</Th>
                    <Th>Connected</Th>
                    <Th w="50px"></Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredIdentities.map((identity) => (
                    <Tr key={identity.id}>
                      <Td>
                        <VStack align="start" spacing={0}>
                          <HStack>
                            <Icon as={EmailIcon} boxSize={4} color="blue.500" />
                            <Text fontWeight="semibold">{identity.displayName || identity.emailAddress}</Text>
                          </HStack>
                          {identity.displayName && (
                            <Text fontSize="sm" color="gray.600">{identity.emailAddress}</Text>
                          )}
                        </VStack>
                      </Td>
                      <Td>
                        <Badge variant="outline" size="sm">
                          {identity.provider.toUpperCase()}
                        </Badge>
                      </Td>
                      <Td>
                        <HStack>
                          <Badge colorScheme={identity.isActive ? 'green' : 'gray'} size="sm">
                            {identity.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          {identity.isActive && identity.provider === 'outlook' && (
                            <Icon as={CheckCircleIcon} color="green.500" boxSize={4} />
                          )}
                        </HStack>
                      </Td>
                      <Td isNumeric>
                        <VStack align="end" spacing={0}>
                          <Text>{identity.dailySendLimit}/day</Text>
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
                              Edit Settings
                            </MenuItem>
                            {identity.provider === 'outlook' && (
                              <MenuItem icon={<EmailIcon />} onClick={() => handleTestSend(identity)}>
                                Send Test Email
                              </MenuItem>
                            )}
                            <MenuItem
                              icon={identity.isActive ? <WarningIcon /> : <CheckCircleIcon />}
                              onClick={() => handleToggleActive(identity)}
                            >
                              {identity.isActive ? 'Deactivate' : 'Activate'}
                            </MenuItem>
                            <MenuDivider />
                            <MenuItem 
                              icon={<DeleteIcon />} 
                              color="red.500" 
                              onClick={() => handleDeleteIdentity(identity)}
                            >
                              Disconnect
                            </MenuItem>
                          </MenuList>
                        </Menu>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          </CardBody>
        </Card>
      )}

      {/* Edit Identity Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="md">
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
                    onChange={(_, val) => setEditingIdentity({...editingIdentity, dailySendLimit: val || 50})}
                    min={1}
                    max={500}
                  >
                    <NumberInputField />
                  </NumberInput>
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    Recommended: 50-150 for new accounts, up to 500 for warmed accounts
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
    </Box>
  )
}

export default EmailAccountsTab
