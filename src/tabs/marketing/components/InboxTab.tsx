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
  Flex,
  Heading,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  SimpleGrid,
  Text,
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
} from '@chakra-ui/react'
import {
  SearchIcon,
  EmailIcon,
} from '@chakra-ui/icons'
import { api } from '../../../utils/api'

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
  const [replies, setReplies] = useState<ReplyItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d')

  useEffect(() => {
    loadReplies()
  }, [dateRange])

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
            View replies from your outreach campaigns
          </Text>
        </VStack>
        <HStack>
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
          <Button size="sm" onClick={loadReplies}>
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
          <Button size="sm" onClick={loadReplies} ml={4}>
            Retry
          </Button>
        </Alert>
      )}

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

      {/* Replies List */}
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
    </Box>
  )
}

export default InboxTab
