import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Grid,
  Heading,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  SimpleGrid,
  Text,
  Textarea,
  VStack,
  Badge,
  Avatar,
  Stat,
  StatLabel,
  StatNumber,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Spinner,
  useToast,
} from '@chakra-ui/react'
import {
  SearchIcon,
  EmailIcon,
  NotAllowedIcon,
} from '@chakra-ui/icons'
import { api } from '../../../utils/api'
import { normalizeCustomersListResponse } from '../../../utils/normalizeApiResponse'
import { getCurrentCustomerId, setCurrentCustomerId } from '../../../platform/stores/settings'
import NoActiveClientEmptyState from '../../../components/NoActiveClientEmptyState'

// Customer type
type Customer = {
  id: string
  name: string
}

// Thread types
type EmailThread = {
  threadId: string
  subject: string
  participantEmail: string
  participantName?: string | null
  mailboxEmail: string
  mailboxName?: string | null
  campaignId?: string
  campaignName?: string
  latestMessageAt: string
  messageCount: number
  hasReplies: boolean
}

type EmailMessage = {
  id: string
  direction: 'inbound' | 'outbound'
  fromAddress: string
  toAddress: string
  subject: string
  rawHeaders?: any
  createdAt: string
  senderIdentity?: {
    id: string
    emailAddress: string
    displayName?: string | null
  }
  campaignProspect?: {
    id: string
    contact: {
      id: string
      firstName: string
      lastName: string
      companyName?: string
      email: string
    }
  }
}

// Backend reply item shape from /api/inbox/replies
type ReplyItem = {
  prospectId: string
  campaignId: string
  campaignName?: string
  senderEmail?: string
  senderName?: string
  contact: {
    id: string
    firstName: string
    lastName: string
    companyName: string
    email: string
  }
  replyDetectedAt: string
  replyCount: number
  lastReplySnippet?: string
}

type RepliesResponse = {
  range: {
    start: string
    end: string
  }
  items: ReplyItem[]
}

const InboxTab: React.FC = () => {
  const toast = useToast()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [replies, setReplies] = useState<ReplyItem[]>([])
  const [threads, setThreads] = useState<EmailThread[]>([])
  const [selectedThread, setSelectedThread] = useState<EmailMessage[] | null>(null)
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [threadsLoading, setThreadsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d')
  const [view, setView] = useState<'replies' | 'threads'>('threads')
  const [replyContent, setReplyContent] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [unreadOnly, setUnreadOnly] = useState(false)

  useEffect(() => {
    loadCustomers()
  }, [])

  useEffect(() => {
    if (selectedCustomerId) {
      if (view === 'replies') {
        loadReplies()
      } else {
        loadThreads()
      }
    }
  }, [selectedCustomerId, view, dateRange])

  const loadReplies = async () => {
    setLoading(true)
    setError(null)

    // Calculate date range
    const end = new Date()
    const start = new Date()
    switch (dateRange) {
      case '7d':
        start.setDate(start.getDate() - 7)
        break
      case '30d':
        start.setDate(start.getDate() - 30)
        break
      case '90d':
        start.setDate(start.getDate() - 90)
        break
    }

    const { data, error: apiError } = await api.get<RepliesResponse>(
      `/api/inbox/replies?start=${start.toISOString()}&end=${end.toISOString()}`
    )
    
    if (apiError) {
      setError(apiError)
    } else {
      setReplies(data?.items || [])
    }
    
    setLoading(false)
  }

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

      const storedCustomerId = getCurrentCustomerId()
      const currentCustomer = customerList.find((c) => c.id === storedCustomerId)
      if (currentCustomer) {
        setSelectedCustomerId(storedCustomerId)
      }
    } catch (err: any) {
      console.error('❌ Failed to normalize customers in InboxTab:', err)
      setCustomers([])
    }
  }

  const loadThreads = async () => {
    setThreadsLoading(true)
    setError(null)

    const { data, error: apiError } = await api.get<{ threads: EmailThread[]; hasMore: boolean; offset: number }>('/api/inbox/threads', {
      limit: 50,
      offset: 0
    })

    if (apiError) {
      setError(apiError)
    } else {
      setThreads(data?.threads || [])
    }

    setThreadsLoading(false)
  }

  const loadThreadMessages = async (threadId: string) => {
    const { data, error: apiError } = await api.get<{ threadId: string; messages: EmailMessage[] }>(`/api/inbox/threads/${threadId}/messages`)

    if (apiError) {
      toast({
        title: 'Failed to load thread',
        description: apiError,
        status: 'error',
        duration: 3000,
      })
      return
    }

    const messages = data?.messages || []
    setSelectedThread(messages)
    setSelectedThreadId(threadId)
    // Mark inbound messages as read
    if (messages.length > 0) markThreadRead(messages)
  }

  const sendReply = async () => {
    if (!selectedThreadId || !replyContent.trim()) return

    const lastMessage = selectedThread?.[selectedThread.length - 1]
    if (!lastMessage) return

    const toAddress = lastMessage.direction === 'inbound' ? lastMessage.fromAddress : lastMessage.toAddress

    const { error: apiError } = await api.post(`/api/inbox/threads/${selectedThreadId}/reply`, {
      content: replyContent,
      toAddress,
    })

    if (apiError) {
      toast({
        title: 'Failed to send reply',
        description: apiError,
        status: 'error',
        duration: 3000,
      })
      return
    }

    toast({
      title: 'Reply sent',
      description: 'Your reply has been sent successfully',
      status: 'success',
      duration: 3000,
    })

    setReplyContent('')
    // Reload the thread to show the new message
    loadThreadMessages(selectedThreadId)
  }

  const handleRefresh = async () => {
    if (!selectedCustomerId) return
    setIsRefreshing(true)
    try {
      const headers = { 'X-Customer-Id': selectedCustomerId }
      const { data, error } = await api.post('/api/inbox/refresh', {}, { headers })
      if (error) {
        toast({ title: 'Refresh failed', description: error, status: 'error', duration: 3000 })
      } else {
        toast({
          title: 'Inbox refreshed',
          description: `Checked ${(data as any)?.identitiesChecked ?? 0} mailbox(es) for new messages`,
          status: 'success',
          duration: 3000,
        })
      }
    } finally {
      setIsRefreshing(false)
      // Reload the thread list
      if (view === 'threads') loadThreads()
      else loadReplies()
    }
  }

  const markThreadRead = async (messages: EmailMessage[]) => {
    if (!selectedCustomerId) return
    const headers = { 'X-Customer-Id': selectedCustomerId }
    const inbound = messages.filter((m) => m.direction === 'inbound')
    for (const msg of inbound) {
      if ((msg as any).isRead === false) {
        await api.post(`/api/inbox/messages/${msg.id}/read`, { isRead: true }, { headers })
      }
    }
  }

  const filteredReplies = useMemo(() => {
    if (!searchQuery) return replies
    
    const query = searchQuery.toLowerCase()
    return replies.filter(reply => 
      reply.contact.firstName.toLowerCase().includes(query) ||
      reply.contact.lastName.toLowerCase().includes(query) ||
      reply.contact.email.toLowerCase().includes(query) ||
      reply.contact.companyName.toLowerCase().includes(query) ||
      reply.campaignName?.toLowerCase().includes(query) ||
      reply.lastReplySnippet?.toLowerCase().includes(query)
    )
  }, [replies, searchQuery])

  const stats = useMemo(() => ({
    total: replies.length,
    today: replies.filter(r => {
      const today = new Date()
      const replyDate = new Date(r.replyDetectedAt)
      return replyDate.toDateString() === today.toDateString()
    }).length,
    thisWeek: replies.filter(r => {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return new Date(r.replyDetectedAt) >= weekAgo
    }).length,
  }), [replies])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  if (!getCurrentCustomerId()) {
    return <NoActiveClientEmptyState />
  }
  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="lg" />
        <Text mt={4}>Loading inbox...</Text>
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Flex justify="space-between" align="center" mb={6}>
        <VStack align="start" spacing={1}>
          <Heading size="lg">Inbox</Heading>
          <Text color="gray.600">
            View email threads from your connected mailboxes
          </Text>
        </VStack>
        <HStack>
          <Select
            size="sm"
            value={selectedCustomerId}
            onChange={(e) => {
              setSelectedCustomerId(e.target.value)
              setCurrentCustomerId(e.target.value)
            }}
            w="200px"
          >
            {customers.map(customer => (
              <option key={customer.id} value={customer.id}>{customer.name}</option>
            ))}
          </Select>
          <Select
            size="sm"
            value={view}
            onChange={(e) => setView(e.target.value as 'replies' | 'threads')}
            w="120px"
          >
            <option value="threads">Threads</option>
            <option value="replies">Replies</option>
          </Select>
          <Select
            size="sm"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as '7d' | '30d' | '90d')}
            w="140px"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </Select>
          <Button size="sm" isLoading={isRefreshing} onClick={handleRefresh}>
            Refresh
          </Button>
        </HStack>
      </Flex>

      {/* Error Display */}
      {error && (
        <Alert status="error" mb={4}>
          <AlertIcon />
          <Box flex="1">
            <AlertTitle>Failed to load inbox</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Box>
          <Button size="sm" onClick={() => view === 'replies' ? loadReplies() : loadThreads()} ml={4}>
            Retry
          </Button>
        </Alert>
      )}

      {view === 'threads' ? (
        <Grid templateColumns={{ base: '1fr', lg: '300px 1fr' }} gap={6}>
          {/* Thread List */}
          <Card>
            <CardHeader>
              <Flex justify="space-between" align="center">
                <Heading size="md">Email Threads</Heading>
                <Button
                  size="xs"
                  variant={unreadOnly ? 'solid' : 'outline'}
                  colorScheme="blue"
                  onClick={() => setUnreadOnly((v) => !v)}
                >
                  {unreadOnly ? 'Unread only' : 'All'}
                </Button>
              </Flex>
            </CardHeader>
            <CardBody p={0}>
              {threadsLoading ? (
                <VStack py={8}>
                  <Spinner />
                  <Text>Loading threads...</Text>
                </VStack>
              ) : threads.length === 0 ? (
                <VStack py={8}>
                  <Text color="gray.500">No email threads found</Text>
                </VStack>
              ) : (
                <VStack spacing={0} align="stretch">
                  {threads.map(thread => (
                    <Box
                      key={thread.threadId}
                      p={4}
                      borderBottom="1px"
                      borderColor="gray.100"
                      cursor="pointer"
                      bg={selectedThreadId === thread.threadId ? "blue.50" : "white"}
                      _hover={{ bg: "gray.50" }}
                      onClick={() => loadThreadMessages(thread.threadId)}
                    >
                      <HStack spacing={3} align="start">
                        <Avatar size="sm" name={thread.participantName || thread.participantEmail} />
                        <VStack align="start" spacing={1} flex={1}>
                          <HStack justify="space-between" w="full">
                            <Text fontWeight="medium" fontSize="sm" noOfLines={1}>
                              {thread.participantName || thread.participantEmail}
                            </Text>
                            <Text fontSize="xs" color="gray.500">
                              {new Date(thread.latestMessageAt).toLocaleDateString()}
                            </Text>
                          </HStack>
                          <Text fontSize="sm" color="gray.600" noOfLines={1}>
                            {thread.subject}
                          </Text>
                          <HStack spacing={2}>
                            <Badge size="sm" colorScheme="blue">
                              {thread.mailboxName || thread.mailboxEmail}
                            </Badge>
                            {thread.hasReplies && <Badge size="sm" colorScheme="green">Reply</Badge>}
                          </HStack>
                        </VStack>
                      </HStack>
                    </Box>
                  ))}
                </VStack>
              )}
            </CardBody>
          </Card>

          {/* Thread Messages */}
          <Card>
            <CardHeader>
              <Heading size="md">
                {selectedThread ? 'Thread Messages' : 'Select a thread'}
              </Heading>
            </CardHeader>
            <CardBody>
              {selectedThread ? (
                <VStack spacing={4} align="stretch">
                  {selectedThread.map(message => (
                    <Box
                      key={message.id}
                      p={4}
                      bg={message.direction === 'inbound' ? 'blue.50' : 'gray.50'}
                      borderRadius="md"
                    >
                      <HStack justify="space-between" mb={2}>
                        <HStack>
                          <Text fontWeight="medium">
                            {message.direction === 'inbound' ? 'From:' : 'To:'}
                            {message.direction === 'inbound' ? message.fromAddress : message.toAddress}
                          </Text>
                          {message.senderIdentity && (
                            <Badge size="sm" colorScheme="blue">
                              {message.senderIdentity.displayName || message.senderIdentity.emailAddress}
                            </Badge>
                          )}
                        </HStack>
                        <Text fontSize="sm" color="gray.500">
                          {new Date(message.createdAt).toLocaleString()}
                        </Text>
                      </HStack>
                      <Text fontSize="sm" whiteSpace="pre-wrap">
                        {message.rawHeaders?.body || 'No message content'}
                      </Text>
                    </Box>
                  ))}

                  {/* Reply Form */}
                  <Box borderTop="1px" borderColor="gray.200" pt={4}>
                    <Heading size="sm" mb={3}>Reply</Heading>
                    <Textarea
                      placeholder="Type your reply..."
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      rows={4}
                      mb={3}
                    />
                    <HStack spacing={3}>
                      <Button
                        colorScheme="blue"
                        onClick={sendReply}
                        isDisabled={!replyContent.trim()}
                      >
                        Send Reply
                      </Button>
                      {selectedThread && selectedThread.length > 0 && (() => {
                        const firstInbound = selectedThread.find((m) => m.direction === 'inbound')
                        const contactEmail = firstInbound?.fromAddress
                        if (!contactEmail) return null
                        return (
                          <Button
                            leftIcon={<NotAllowedIcon />}
                            colorScheme="red"
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              const { error } = await api.post(
                                `/api/suppression?customerId=${selectedCustomerId}`,
                                {
                                  type: 'email',
                                  value: contactEmail,
                                  reason: 'Opted out via inbox',
                                  source: 'inbox-optout',
                                },
                              )
                              if (error) {
                                toast({ title: 'Failed to opt out', description: error, status: 'error', duration: 3000 })
                              } else {
                                toast({
                                  title: 'Opt-out recorded',
                                  description: `${contactEmail} added to suppression list`,
                                  status: 'success',
                                  duration: 4000,
                                })
                              }
                            }}
                          >
                            Mark as Opt-out
                          </Button>
                        )
                      })()}
                    </HStack>
                  </Box>
                </VStack>
              ) : (
                <Text color="gray.500">Select a thread from the list to view messages</Text>
              )}
            </CardBody>
          </Card>
        </Grid>
      ) : (
        <>
          {/* Stats */}
          <SimpleGrid columns={{ base: 2, md: 3 }} spacing={4} mb={6}>
            <Card>
              <CardBody>
                <Stat>
                  <StatLabel>Total Replies</StatLabel>
                  <StatNumber>{stats.total}</StatNumber>
                </Stat>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <Stat>
                  <StatLabel>Today</StatLabel>
                  <StatNumber>{stats.today}</StatNumber>
                </Stat>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <Stat>
                  <StatLabel>This Week</StatLabel>
                  <StatNumber>{stats.thisWeek}</StatNumber>
                </Stat>
              </CardBody>
            </Card>
          </SimpleGrid>

          {/* Search */}
          <InputGroup mb={6}>
            <InputLeftElement pointerEvents="none">
              <SearchIcon color="gray.300" />
            </InputLeftElement>
            <Input
              placeholder="Search by name, email, company, or campaign..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </InputGroup>
        </>
      )}

      {/* Replies List - Only show when view is replies */}
      {view === 'replies' && (
        <>
          {filteredReplies.length === 0 ? (
        <Card>
          <CardBody textAlign="center" py={10}>
            <EmailIcon boxSize={12} color="gray.300" mb={4} />
            <Text color="gray.500" fontSize="lg">
              {searchQuery ? 'No replies match your search' : 'No replies yet'}
            </Text>
            <Text color="gray.400" mt={2}>
              Replies will appear here when prospects respond to your campaigns
            </Text>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody p={0}>
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>Contact</Th>
                  <Th>Campaign</Th>
                  <Th>Reply Preview</Th>
                  <Th isNumeric>Replies</Th>
                  <Th>When</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredReplies.map((reply) => (
                  <Tr key={reply.prospectId} _hover={{ bg: 'gray.50' }}>
                    <Td>
                      <HStack>
                        <Avatar
                          size="sm"
                          name={`${reply.contact.firstName} ${reply.contact.lastName}`}
                        />
                        <Box>
                          <Text fontWeight="medium">
                            {reply.contact.firstName} {reply.contact.lastName}
                          </Text>
                          <Text fontSize="sm" color="gray.500">
                            {reply.contact.email}
                          </Text>
                          <Text fontSize="xs" color="gray.400">
                            {reply.contact.companyName}
                          </Text>
                        </Box>
                      </HStack>
                    </Td>
                    <Td>
                      <Text fontSize="sm">{reply.campaignName || 'Unknown Campaign'}</Text>
                      {reply.senderEmail && (
                        <Text fontSize="xs" color="gray.400">
                          via {reply.senderName || reply.senderEmail}
                        </Text>
                      )}
                    </Td>
                    <Td maxW="300px">
                      <Text fontSize="sm" noOfLines={2} color="gray.600">
                        {reply.lastReplySnippet || 'No preview available'}
                      </Text>
                    </Td>
                    <Td isNumeric>
                      <Badge colorScheme="green" variant="subtle">
                        {reply.replyCount}
                      </Badge>
                    </Td>
                    <Td>
                      <Text fontSize="sm" color="gray.500">
                        {formatDate(reply.replyDetectedAt)}
                      </Text>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </CardBody>
        </Card>
      )}
        </>
      )}
    </Box>
  )
}

export default InboxTab
