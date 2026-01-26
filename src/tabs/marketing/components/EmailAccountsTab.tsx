import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Grid,
  GridItem,
  Heading,
  HStack,
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
  StatHelpText,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  Badge,
  Avatar,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Textarea,
  Spacer,
  Divider,
  useToast,
  Tag,
  TagLabel,
  Alert,
  AlertIcon,
  AlertDescription,
  Switch,
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
} from '@chakra-ui/icons'
import { api } from '../../../utils/api'

type EmailAccount = {
  id: string
  emailAddress: string
  displayName?: string
  provider: 'gmail' | 'outlook' | 'smtp' | 'sendgrid'
  status: 'active' | 'inactive' | 'suspended' | 'verification_pending'
  isVerified: boolean
  dailySendLimit: number
  sentToday: number
  sentThisMonth: number
  replyRate: number
  bounceRate: number
  spamComplaints: number
  warmupProgress?: number
  lastActivity: string
  createdAt: string
}

const EmailAccountsTab: React.FC = () => {
  const [accounts, setAccounts] = useState<EmailAccount[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [editingAccount, setEditingAccount] = useState<EmailAccount | null>(null)
  const toast = useToast()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const accountsRes = await api.get<EmailAccount[]>('/api/email-accounts')
      setAccounts(accountsRes.data || mockAccounts)
    } catch (error) {
      console.error('Failed to load email accounts:', error)
      setAccounts(mockAccounts)
    } finally {
      setLoading(false)
    }
  }

  const filteredAccounts = useMemo(() => {
    return accounts.filter(account => {
      const matchesSearch = searchQuery === '' ||
        account.emailAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
        account.displayName?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus = statusFilter === 'all' || account.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [accounts, searchQuery, statusFilter])

  const stats = useMemo(() => {
    return {
      totalAccounts: accounts.length,
      activeAccounts: accounts.filter(a => a.status === 'active').length,
      totalSentToday: accounts.reduce((sum, a) => sum + a.sentToday, 0),
      totalSentThisMonth: accounts.reduce((sum, a) => sum + a.sentThisMonth, 0),
      avgReplyRate: accounts.length > 0 ? accounts.reduce((sum, a) => sum + a.replyRate, 0) / accounts.length : 0,
      totalBounces: accounts.reduce((sum, a) => sum + Math.round(a.sentThisMonth * a.bounceRate / 100), 0),
    }
  }, [accounts])

  const handleCreateAccount = () => {
    setEditingAccount({
      id: '',
      emailAddress: '',
      displayName: '',
      provider: 'gmail',
      status: 'verification_pending',
      isVerified: false,
      dailySendLimit: 500,
      sentToday: 0,
      sentThisMonth: 0,
      replyRate: 0,
      bounceRate: 0,
      spamComplaints: 0,
      lastActivity: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    })
    onOpen()
  }

  const handleEditAccount = (account: EmailAccount) => {
    setEditingAccount(account)
    onOpen()
  }

  const handleSaveAccount = async () => {
    if (!editingAccount) return

    try {
      if (editingAccount.id) {
        await api.put(`/api/email-accounts/${editingAccount.id}`, editingAccount)
      } else {
        const res = await api.post('/api/email-accounts', editingAccount)
        setEditingAccount({ ...editingAccount, id: (res.data as any).id })
      }
      await loadData()
      onClose()
      toast({
        title: `Account ${editingAccount.id ? 'updated' : 'created'}`,
        status: 'success',
        duration: 3000,
      })
    } catch (error) {
      toast({
        title: `Failed to ${editingAccount.id ? 'update' : 'create'} account`,
        status: 'error',
        duration: 3000,
      })
    }
  }

  const handleVerifyAccount = async (accountId: string) => {
    try {
      await api.post(`/api/email-accounts/${accountId}/verify`, {})
      await loadData()
      toast({
        title: 'Verification email sent',
        status: 'success',
        duration: 3000,
      } as any)
    } catch (error) {
      toast({
        title: 'Failed to send verification',
        status: 'error',
        duration: 3000,
      })
    }
  }

  const handleTestAccount = async (accountId: string) => {
    try {
      await api.post(`/api/email-accounts/${accountId}/test`, {})
      toast({
        title: 'Test email sent successfully',
        status: 'success',
        duration: 3000,
      } as any)
    } catch (error) {
      toast({
        title: 'Failed to send test email',
        status: 'error',
        duration: 3000,
      })
    }
  }

  const handleToggleAccount = async (account: EmailAccount) => {
    try {
      const newStatus = account.status === 'active' ? 'inactive' : 'active'
      await api.patch(`/api/email-accounts/${account.id}`, { status: newStatus })
      await loadData()
      toast({
        title: `Account ${newStatus === 'active' ? 'activated' : 'deactivated'}`,
        status: 'success',
        duration: 2000,
      })
    } catch (error) {
      toast({
        title: 'Failed to update account status',
        status: 'error',
        duration: 2000,
      })
    }
  }

  const handleDeleteAccount = async (accountId: string) => {
    try {
      await api.delete(`/api/email-accounts/${accountId}`)
      await loadData()
      toast({
        title: 'Account deleted',
        status: 'success',
        duration: 3000,
      })
    } catch (error) {
      toast({
        title: 'Failed to delete account',
        status: 'error',
        duration: 3000,
      })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'green'
      case 'inactive': return 'gray'
      case 'suspended': return 'red'
      case 'verification_pending': return 'yellow'
      default: return 'gray'
    }
  }

  const getProviderIcon = (provider: string) => {
    // You can add specific provider icons here
    return EmailIcon
  }

  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Text>Loading email accounts...</Text>
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Flex justify="space-between" align="center" mb={6}>
        <VStack align="start" spacing={1}>
          <Heading size="lg">Email Accounts</Heading>
          <Text color="gray.600">
            Manage your sending infrastructure and monitor deliverability
          </Text>
        </VStack>
        <Button leftIcon={<AddIcon />} colorScheme="blue" onClick={handleCreateAccount}>
          Add Account
        </Button>
      </Flex>

      {/* Stats */}
      <SimpleGrid columns={{ base: 2, md: 3, lg: 6 }} spacing={4} mb={6}>
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
              <StatLabel>Sent Today</StatLabel>
              <StatNumber>{stats.totalSentToday}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Sent This Month</StatLabel>
              <StatNumber>{stats.totalSentThisMonth.toLocaleString()}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Avg Reply Rate</StatLabel>
              <StatNumber>{stats.avgReplyRate.toFixed(1)}%</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Bounces</StatLabel>
              <StatNumber>{stats.totalBounces}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>

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
          <option value="verification_pending">Pending</option>
          <option value="suspended">Suspended</option>
        </Select>

        <Spacer />
      </Flex>

      {/* Accounts Table */}
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
                  <Th isNumeric>Sent Today</Th>
                  <Th isNumeric>Reply Rate</Th>
                  <Th isNumeric>Bounce Rate</Th>
                  <Th>Last Activity</Th>
                  <Th w="50px"></Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredAccounts.map((account) => (
                  <Tr key={account.id}>
                    <Td>
                      <VStack align="start" spacing={0}>
                        <HStack>
                          <Icon as={getProviderIcon(account.provider)} boxSize={4} color="blue.500" />
                          <Text fontWeight="semibold">{account.displayName || account.emailAddress}</Text>
                        </HStack>
                        <Text fontSize="sm" color="gray.600">{account.emailAddress}</Text>
                      </VStack>
                    </Td>
                    <Td>
                      <Badge variant="outline" size="sm">
                        {account.provider.toUpperCase()}
                      </Badge>
                    </Td>
                    <Td>
                      <HStack>
                        <Badge colorScheme={getStatusColor(account.status)} size="sm">
                          {account.status.replace('_', ' ')}
                        </Badge>
                        {account.isVerified && (
                          <Icon as={CheckCircleIcon} color="green.500" boxSize={4} />
                        )}
                      </HStack>
                    </Td>
                    <Td isNumeric>{account.dailySendLimit}</Td>
                    <Td isNumeric>
                      <VStack align="end" spacing={0}>
                        <Text>{account.sentToday}</Text>
                        <Progress
                          value={(account.sentToday / account.dailySendLimit) * 100}
                          size="sm"
                          colorScheme="blue"
                          w="60px"
                        />
                      </VStack>
                    </Td>
                    <Td isNumeric>{account.replyRate.toFixed(1)}%</Td>
                    <Td isNumeric>
                      <HStack>
                        <Text>{account.bounceRate.toFixed(1)}%</Text>
                        {account.bounceRate > 5 && (
                          <Icon as={WarningIcon} color="red.500" boxSize={3} />
                        )}
                      </HStack>
                    </Td>
                    <Td>
                      <Text fontSize="xs" color="gray.600">
                        {new Date(account.lastActivity).toLocaleDateString()}
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
                          <MenuItem icon={<EditIcon />} onClick={() => handleEditAccount(account)}>
                            Edit
                          </MenuItem>
                          {!account.isVerified && (
                            <MenuItem icon={<CheckCircleIcon />} onClick={() => handleVerifyAccount(account.id)}>
                              Verify Account
                            </MenuItem>
                          )}
                          <MenuItem icon={<EmailIcon />} onClick={() => handleTestAccount(account.id)}>
                            Send Test Email
                          </MenuItem>
                          <MenuItem icon={<CheckCircleIcon />}>
                            Refresh Stats
                          </MenuItem>
                          <MenuItem
                            as={Switch}
                            isChecked={account.status === 'active'}
                            onChange={() => handleToggleAccount(account)}
                          >
                            {account.status === 'active' ? 'Deactivate' : 'Activate'}
                          </MenuItem>
                          <MenuDivider />
                          <MenuItem icon={<DeleteIcon />} color="red.500" onClick={() => handleDeleteAccount(account.id)}>
                            Delete
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

      {/* Warnings/Alerts */}
      {accounts.some(a => a.bounceRate > 5) && (
        <Alert status="warning" mt={4}>
          <AlertIcon />
          <AlertDescription>
            Some accounts have high bounce rates (&gt;5%). Consider warming them up or checking deliverability.
          </AlertDescription>
        </Alert>
      )}

      {/* Create/Edit Account Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{editingAccount?.id ? 'Edit Email Account' : 'Add Email Account'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {editingAccount && (
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl>
                  <FormLabel>Email Address</FormLabel>
                  <Input
                    type="email"
                    value={editingAccount.emailAddress}
                    onChange={(e) => setEditingAccount({...editingAccount, emailAddress: e.target.value})}
                    placeholder="your@email.com"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Display Name</FormLabel>
                  <Input
                    value={editingAccount.displayName || ''}
                    onChange={(e) => setEditingAccount({...editingAccount, displayName: e.target.value})}
                    placeholder="Your Name"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Provider</FormLabel>
                  <Select
                    value={editingAccount.provider}
                    onChange={(e) => setEditingAccount({...editingAccount, provider: e.target.value as any})}
                  >
                    <option value="gmail">Gmail</option>
                    <option value="outlook">Outlook</option>
                    <option value="smtp">SMTP</option>
                    <option value="sendgrid">SendGrid</option>
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel>Daily Send Limit</FormLabel>
                  <Input
                    type="number"
                    value={editingAccount.dailySendLimit}
                    onChange={(e) => setEditingAccount({...editingAccount, dailySendLimit: parseInt(e.target.value) || 0})}
                  />
                </FormControl>
              </SimpleGrid>
            )}
          </ModalBody>
          <Flex justify="flex-end" p={6} pt={0}>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleSaveAccount}>
              {editingAccount?.id ? 'Save Changes' : 'Add Account'}
            </Button>
          </Flex>
        </ModalContent>
      </Modal>
    </Box>
  )
}

// Mock data for development
const mockAccounts: EmailAccount[] = [
  {
    id: '1',
    emailAddress: 'sales@company.com',
    displayName: 'Company Sales',
    provider: 'gmail',
    status: 'active',
    isVerified: true,
    dailySendLimit: 500,
    sentToday: 245,
    sentThisMonth: 5200,
    replyRate: 2.8,
    bounceRate: 1.2,
    spamComplaints: 0,
    warmupProgress: 100,
    lastActivity: '2024-01-25T14:30:00Z',
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: '2',
    emailAddress: 'marketing@company.com',
    displayName: 'Company Marketing',
    provider: 'outlook',
    status: 'active',
    isVerified: true,
    dailySendLimit: 1000,
    sentToday: 89,
    sentThisMonth: 3200,
    replyRate: 1.9,
    bounceRate: 0.8,
    spamComplaints: 1,
    warmupProgress: 100,
    lastActivity: '2024-01-25T11:15:00Z',
    createdAt: '2024-01-18T09:30:00Z',
  },
  {
    id: '3',
    emailAddress: 'outreach@company.com',
    displayName: 'Company Outreach',
    provider: 'gmail',
    status: 'verification_pending',
    isVerified: false,
    dailySendLimit: 200,
    sentToday: 0,
    sentThisMonth: 0,
    replyRate: 0,
    bounceRate: 0,
    spamComplaints: 0,
    warmupProgress: 0,
    lastActivity: '2024-01-24T16:45:00Z',
    createdAt: '2024-01-24T16:45:00Z',
  },
]

export default EmailAccountsTab