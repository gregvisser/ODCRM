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
  Select,
  SimpleGrid,
  Text,
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
  Textarea,
  Spacer,
  Divider,
  useToast,
  Tag,
  TagLabel,
  Progress,
  Checkbox,
  Stat,
  StatLabel,
  StatNumber,
} from '@chakra-ui/react'
import {
  SearchIcon,
  EmailIcon,
  StarIcon,
  DeleteIcon,
  CheckCircleIcon,
  WarningIcon,
  ChatIcon,
} from '@chakra-ui/icons'
import { api } from '../../../utils/api'

type EmailThread = {
  id: string
  subject: string
  prospect: {
    id: string
    firstName: string
    lastName: string
    email: string
    companyName: string
  }
  status: 'unread' | 'read' | 'replied' | 'archived'
  priority: 'high' | 'medium' | 'low'
  lastActivity: string
  messageCount: number
  isStarred: boolean
  tags: string[]
  sequence?: {
    id: string
    name: string
    step: number
  }
}

type EmailMessage = {
  id: string
  threadId: string
  direction: 'inbound' | 'outbound'
  sender: {
    email: string
    name?: string
  }
  recipient: {
    email: string
    name?: string
  }
  subject: string
  content: string
  sentAt: string
  isRead: boolean
}

const InboxTab: React.FC = () => {
  const [threads, setThreads] = useState<EmailThread[]>([])
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null)
  const [messages, setMessages] = useState<EmailMessage[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [replyContent, setReplyContent] = useState('')
  const toast = useToast()

  useEffect(() => {
    loadThreads()
  }, [])

  useEffect(() => {
    if (selectedThread) {
      loadMessages(selectedThread.id)
    }
  }, [selectedThread])

  const loadThreads = async () => {
    setLoading(true)
    setError(null)

    const { data, error: apiError } = await api.get<EmailThread[]>('/api/inbox/threads')
    
    if (apiError) {
      setError(apiError)
    } else {
      setThreads(data || [])
    }
    
    setLoading(false)
  }

  const loadMessages = async (threadId: string) => {
    const { data, error: apiError } = await api.get<EmailMessage[]>(`/api/inbox/threads/${threadId}/messages`)
    
    if (!apiError) {
      setMessages(data || [])
    }
  }

  const filteredThreads = useMemo(() => {
    return threads.filter(thread => {
      const matchesSearch = searchQuery === '' ||
        thread.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        thread.prospect.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        thread.prospect.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        thread.prospect.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        thread.prospect.companyName.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus = statusFilter === 'all' || thread.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [threads, searchQuery, statusFilter])

  const stats = useMemo(() => {
    return {
      total: threads.length,
      unread: threads.filter(t => t.status === 'unread').length,
      replied: threads.filter(t => t.status === 'replied').length,
      starred: threads.filter(t => t.isStarred).length,
    }
  }, [threads])

  const handleSelectThread = (thread: EmailThread) => {
    setSelectedThread(thread)
    // Mark as read if unread
    if (thread.status === 'unread') {
      handleMarkAsRead(thread.id)
    }
  }

  const handleMarkAsRead = async (threadId: string) => {
    try {
      await api.patch(`/api/inbox/threads/${threadId}`, { status: 'read' })
      await loadThreads()
    } catch (error) {
      toast({
        title: 'Failed to mark as read',
        status: 'error',
        duration: 2000,
      })
    }
  }

  const handleToggleStar = async (threadId: string) => {
    try {
      const thread = threads.find(t => t.id === threadId)
      if (!thread) return

      await api.patch(`/api/inbox/threads/${threadId}`, { isStarred: !thread.isStarred })
      await loadThreads()
    } catch (error) {
      toast({
        title: 'Failed to update star status',
        status: 'error',
        duration: 2000,
      })
    }
  }

  const handleArchiveThread = async (threadId: string) => {
    try {
      await api.patch(`/api/inbox/threads/${threadId}`, { status: 'archived' })
      await loadThreads()
      setSelectedThread(null)
      toast({
        title: 'Thread archived',
        status: 'success',
        duration: 2000,
      })
    } catch (error) {
      toast({
        title: 'Failed to archive thread',
        status: 'error',
        duration: 2000,
      })
    }
  }

  const handleSendReply = async () => {
    if (!selectedThread || !replyContent.trim()) return

    try {
      await api.post(`/api/inbox/threads/${selectedThread.id}/reply`, {
        content: replyContent
      })

      setReplyContent('')
      await loadMessages(selectedThread.id)
      await loadThreads()

      toast({
        title: 'Reply sent successfully',
        status: 'success',
        duration: 3000,
      })
    } catch (error) {
      toast({
        title: 'Failed to send reply',
        status: 'error',
        duration: 3000,
      })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'unread': return 'blue'
      case 'read': return 'gray'
      case 'replied': return 'green'
      case 'archived': return 'orange'
      default: return 'gray'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'red'
      case 'medium': return 'yellow'
      case 'low': return 'green'
      default: return 'gray'
    }
  }

  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Text>Loading inbox...</Text>
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
            Manage conversations and replies from your outreach campaigns
          </Text>
        </VStack>
        <HStack>
          <Button leftIcon={<DeleteIcon />} variant="outline">
            Archive All Read
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
          <Button size="sm" onClick={loadThreads} ml={4}>
            Retry
          </Button>
        </Alert>
      )}

      {/* Stats */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Total Conversations</StatLabel>
              <StatNumber>{stats.total}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Unread</StatLabel>
              <StatNumber color="blue.500">{stats.unread}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Replied</StatLabel>
              <StatNumber color="green.500">{stats.replied}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Starred</StatLabel>
              <StatNumber>{stats.starred}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>

      <Grid templateColumns={{ base: '1fr', lg: '350px 1fr' }} gap={6} h="calc(100vh - 300px)">
        {/* Thread List */}
        <Card>
          <CardHeader pb={2}>
            <Flex gap={4} align="center">
              <InputGroup size="sm">
                <InputLeftElement>
                  <Icon as={SearchIcon} color="gray.400" />
                </InputLeftElement>
                <Input
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </InputGroup>
              <Select
                size="sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                w="120px"
              >
                <option value="all">All</option>
                <option value="unread">Unread</option>
                <option value="read">Read</option>
                <option value="replied">Replied</option>
              </Select>
            </Flex>
          </CardHeader>
          <CardBody p={0}>
            <VStack spacing={0} align="stretch" maxH="500px" overflowY="auto">
              {filteredThreads.map((thread) => (
                <Box
                  key={thread.id}
                  p={3}
                  borderBottom="1px solid"
                  borderColor="gray.100"
                  cursor="pointer"
                  bg={selectedThread?.id === thread.id ? 'blue.50' : thread.status === 'unread' ? 'gray.50' : 'white'}
                  _hover={{ bg: 'gray.50' }}
                  onClick={() => handleSelectThread(thread)}
                >
                  <Flex justify="space-between" align="start" mb={2}>
                    <HStack spacing={2}>
                      <Avatar size="sm" name={`${thread.prospect.firstName} ${thread.prospect.lastName}`} />
                      <VStack align="start" spacing={0}>
                        <Text fontWeight="semibold" fontSize="sm">
                          {thread.prospect.firstName} {thread.prospect.lastName}
                        </Text>
                        <Text fontSize="xs" color="gray.600">
                          {thread.prospect.companyName}
                        </Text>
                      </VStack>
                    </HStack>
                    <HStack spacing={1}>
                      {thread.isStarred && <Icon as={StarIcon} color="yellow.400" boxSize={3} />}
                      <Text fontSize="xs" color="gray.500">
                        {new Date(thread.lastActivity).toLocaleDateString()}
                      </Text>
                    </HStack>
                  </Flex>

                  <Text fontSize="sm" noOfLines={2} mb={2}>
                    {thread.subject}
                  </Text>

                  <Flex justify="space-between" align="center">
                    <HStack spacing={2}>
                      <Badge size="sm" colorScheme={getStatusColor(thread.status)}>
                        {thread.status}
                      </Badge>
                      {thread.priority !== 'low' && (
                        <Badge size="sm" colorScheme={getPriorityColor(thread.priority)}>
                          {thread.priority}
                        </Badge>
                      )}
                    </HStack>
                    <HStack spacing={1}>
                      <Icon as={ChatIcon} boxSize={3} color="gray.500" />
                      <Text fontSize="xs" color="gray.500">{thread.messageCount}</Text>
                    </HStack>
                  </Flex>
                </Box>
              ))}
            </VStack>
          </CardBody>
        </Card>

        {/* Message View */}
        <Card>
          {selectedThread ? (
            <>
              <CardHeader>
                <Flex justify="space-between" align="center">
                  <VStack align="start" spacing={1}>
                    <Heading size="md">{selectedThread.subject}</Heading>
                    <HStack spacing={4}>
                      <Text fontSize="sm" color="gray.600">
                        {selectedThread.prospect.firstName} {selectedThread.prospect.lastName} • {selectedThread.prospect.companyName}
                      </Text>
                      {selectedThread.sequence && (
                        <Badge colorScheme="purple" size="sm">
                          {selectedThread.sequence.name} - Step {selectedThread.sequence.step}
                        </Badge>
                      )}
                    </HStack>
                  </VStack>
                  <HStack>
                    <IconButton
                      size="sm"
                      variant="ghost"
                      icon={<StarIcon />}
                      color={selectedThread.isStarred ? 'yellow.400' : 'gray.400'}
                      onClick={() => handleToggleStar(selectedThread.id)}
                      aria-label="Toggle star"
                    />
                    <IconButton
                      size="sm"
                      variant="ghost"
                      icon={<DeleteIcon />}
                      onClick={() => handleArchiveThread(selectedThread.id)}
                      aria-label="Archive thread"
                    />
                  </HStack>
                </Flex>
              </CardHeader>
              <CardBody>
                <VStack spacing={4} align="stretch" maxH="400px" overflowY="auto" mb={4}>
                  {messages.map((message) => (
                    <Box
                      key={message.id}
                      p={4}
                      bg={message.direction === 'inbound' ? 'blue.50' : 'gray.50'}
                      borderRadius="md"
                      borderLeft="4px solid"
                      borderLeftColor={message.direction === 'inbound' ? 'blue.500' : 'gray.500'}
                    >
                      <Flex justify="space-between" align="center" mb={2}>
                        <HStack>
                          <Icon
                            as={message.direction === 'inbound' ? EmailIcon : EmailIcon}
                            boxSize={4}
                            color={message.direction === 'inbound' ? 'blue.500' : 'gray.500'}
                          />
                          <Text fontWeight="semibold" fontSize="sm">
                            {message.direction === 'inbound' ? 'From' : 'To'}: {message.sender.name || message.sender.email}
                          </Text>
                        </HStack>
                        <Text fontSize="xs" color="gray.600">
                          {new Date(message.sentAt).toLocaleString()}
                        </Text>
                      </Flex>
                      <Box whiteSpace="pre-wrap" fontSize="sm">
                        {message.content}
                      </Box>
                    </Box>
                  ))}
                </VStack>

                <Divider my={4} />

                <VStack spacing={3} align="stretch">
                  <Text fontWeight="semibold">Reply</Text>
                  <Textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="Type your reply..."
                    minH="100px"
                  />
                  <Flex justify="flex-end">
                    <Button
                      leftIcon={<EmailIcon />}
                      colorScheme="blue"
                      onClick={handleSendReply}
                      isDisabled={!replyContent.trim()}
                    >
                      Send Reply
                    </Button>
                  </Flex>
                </VStack>
              </CardBody>
            </>
          ) : (
            <CardBody textAlign="center" py={10}>
              <Icon as={EmailIcon} boxSize={12} color="gray.400" mb={4} />
              <Text color="gray.600">Select a conversation to view messages</Text>
            </CardBody>
          )}
        </Card>
      </Grid>
    </Box>
  )
}

export default InboxTab
