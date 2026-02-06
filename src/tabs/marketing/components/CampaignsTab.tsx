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
  TagCloseButton,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from '@chakra-ui/react'
import {
  AddIcon,
  SearchIcon,
  EditIcon,
  DeleteIcon,
  CalendarIcon,
  EmailIcon,
  CheckCircleIcon,
  SettingsIcon,
  TriangleUpIcon,
  TriangleDownIcon,
  TimeIcon,
} from '@chakra-ui/icons'
import { api } from '../../../utils/api'

type Campaign = {
  id: string
  name: string
  subject: string
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused'
  recipientCount: number
  sentCount: number
  openedCount: number
  clickedCount: number
  repliedCount: number
  openRate: number
  clickRate: number
  replyRate: number
  scheduledFor?: string
  sentAt?: string
  createdAt: string
  templateId?: string
  senderIdentity: {
    id: string
    emailAddress: string
    displayName?: string
  }
  tags: string[]
}

type CampaignTemplate = {
  id: string
  name: string
  subject: string
  previewText?: string
}

const CampaignsTab: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [templates, setTemplates] = useState<CampaignTemplate[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const toast = useToast()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError(null)

    const [campaignsRes, templatesRes] = await Promise.all([
      api.get<Campaign[]>('/api/campaigns'),
      api.get<CampaignTemplate[]>('/api/templates')
    ])

    if (campaignsRes.error) {
      setError(campaignsRes.error)
    } else {
      setCampaigns(campaignsRes.data || [])
    }

    if (!templatesRes.error) {
      setTemplates(templatesRes.data || [])
    }

    setLoading(false)
  }

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(campaign => {
      const matchesSearch = searchQuery === '' ||
        campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        campaign.subject.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [campaigns, searchQuery, statusFilter])

  const stats = useMemo(() => {
    return {
      total: campaigns.length,
      sent: campaigns.filter(c => c.status === 'sent').length,
      scheduled: campaigns.filter(c => c.status === 'scheduled').length,
      drafts: campaigns.filter(c => c.status === 'draft').length,
      totalSent: campaigns.reduce((sum, c) => sum + c.sentCount, 0),
      totalOpens: campaigns.reduce((sum, c) => sum + c.openedCount, 0),
      totalClicks: campaigns.reduce((sum, c) => sum + c.clickedCount, 0),
      totalReplies: campaigns.reduce((sum, c) => sum + c.repliedCount, 0),
    }
  }, [campaigns])

  const handleCreateCampaign = () => {
    setEditingCampaign({
      id: '',
      name: '',
      subject: '',
      status: 'draft',
      recipientCount: 0,
      sentCount: 0,
      openedCount: 0,
      clickedCount: 0,
      repliedCount: 0,
      openRate: 0,
      clickRate: 0,
      replyRate: 0,
      createdAt: new Date().toISOString(),
      senderIdentity: {
        id: 'default',
        emailAddress: 'noreply@company.com',
        displayName: 'Company Name',
      },
      tags: [],
    })
    onOpen()
  }

  const handleEditCampaign = (campaign: Campaign) => {
    setEditingCampaign(campaign)
    onOpen()
  }

  const handleSaveCampaign = async () => {
    if (!editingCampaign) return

    try {
      if (editingCampaign.id) {
        await api.put(`/api/campaigns/${editingCampaign.id}`, editingCampaign)
      } else {
        await api.post('/api/campaigns', editingCampaign)
      }
      await loadData()
      onClose()
      toast({
        title: `Campaign ${editingCampaign.id ? 'updated' : 'created'}`,
        status: 'success',
        duration: 3000,
      })
    } catch (error) {
      toast({
        title: `Failed to ${editingCampaign.id ? 'update' : 'create'} campaign`,
        status: 'error',
        duration: 3000,
      })
    }
  }

  const handleStartCampaign = async (campaignId: string) => {
    const { error: apiError } = await api.post(`/api/campaigns/${campaignId}/start`, {})
    
    if (apiError) {
      toast({
        title: 'Failed to start campaign',
        description: apiError,
        status: 'error',
        duration: 5000,
      })
      return
    }

    await loadData()
    toast({
      title: 'Campaign started',
      description: 'Emails will be sent according to the schedule.',
      status: 'success',
      duration: 3000,
    })
  }

  const handlePauseCampaign = async (campaignId: string) => {
    const { error: apiError } = await api.post(`/api/campaigns/${campaignId}/pause`, {})
    
    if (apiError) {
      toast({
        title: 'Failed to pause campaign',
        description: apiError,
        status: 'error',
        duration: 5000,
      })
      return
    }

    await loadData()
    toast({
      title: 'Campaign paused',
      status: 'info',
      duration: 3000,
    })
  }

  const handleDeleteCampaign = async (campaignId: string) => {
    try {
      await api.delete(`/api/campaigns/${campaignId}`)
      await loadData()
      toast({
        title: 'Campaign deleted',
        status: 'success',
        duration: 3000,
      })
    } catch (error) {
      toast({
        title: 'Failed to delete campaign',
        status: 'error',
        duration: 3000,
      })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'gray'
      case 'scheduled': return 'blue'
      case 'sending': return 'yellow'
      case 'sent': return 'green'
      case 'paused': return 'orange'
      default: return 'gray'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return EditIcon
      case 'scheduled': return CalendarIcon
      case 'sending': return EmailIcon
      case 'sent': return CheckCircleIcon
      case 'paused': return SettingsIcon
      default: return TimeIcon
    }
  }

  if (loading && campaigns.length === 0) {
    return (
      <Box textAlign="center" py={10}>
        <Text>Loading campaigns...</Text>
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
            <AlertTitle>Failed to load campaigns</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Box>
          <Button size="sm" onClick={loadData} ml={4}>
            Retry
          </Button>
        </Alert>
      )}

      {/* Header */}
      <Flex justify="space-between" align="center" mb={6}>
        <VStack align="start" spacing={1}>
          <Heading size="lg">Campaigns</Heading>
          <Text color="gray.600">
            Create and manage one-off email campaigns to reach your audience
          </Text>
        </VStack>
        <Button leftIcon={<AddIcon />} colorScheme="blue" onClick={handleCreateCampaign}>
          New Campaign
        </Button>
      </Flex>

      {/* Stats */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Total Campaigns</StatLabel>
              <StatNumber>{stats.total}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Sent</StatLabel>
              <StatNumber>{stats.sent}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Scheduled</StatLabel>
              <StatNumber>{stats.scheduled}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Drafts</StatLabel>
              <StatNumber>{stats.drafts}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* Performance Overview */}
      <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4} mb={6}>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Total Sent</StatLabel>
              <StatNumber>{stats.totalSent.toLocaleString()}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Total Opens</StatLabel>
              <StatNumber>{stats.totalOpens.toLocaleString()}</StatNumber>
              <StatHelpText>
                {stats.totalSent > 0 ? ((stats.totalOpens / stats.totalSent) * 100).toFixed(1) : '0.0'}% avg rate
              </StatHelpText>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Total Clicks</StatLabel>
              <StatNumber>{stats.totalClicks.toLocaleString()}</StatNumber>
              <StatHelpText>
                {stats.totalSent > 0 ? ((stats.totalClicks / stats.totalSent) * 100).toFixed(1) : '0.0'}% avg rate
              </StatHelpText>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Total Replies</StatLabel>
              <StatNumber>{stats.totalReplies.toLocaleString()}</StatNumber>
              <StatHelpText>
                {stats.totalSent > 0 ? ((stats.totalReplies / stats.totalSent) * 100).toFixed(1) : '0.0'}% avg rate
              </StatHelpText>
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
            placeholder="Search campaigns..."
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
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="sending">Sending</option>
          <option value="sent">Sent</option>
          <option value="paused">Paused</option>
        </Select>

        <Spacer />
      </Flex>

      {/* Campaigns Table */}
      <Card>
        <CardBody p={0}>
          <Box overflowX="auto">
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Campaign</Th>
                  <Th>Status</Th>
                  <Th isNumeric>Recipients</Th>
                  <Th isNumeric>Sent</Th>
                  <Th isNumeric>Opens</Th>
                  <Th isNumeric>Clicks</Th>
                  <Th isNumeric>Replies</Th>
                  <Th>Scheduled/Sent</Th>
                  <Th w="50px"></Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredCampaigns.map((campaign) => (
                  <Tr key={campaign.id}>
                    <Td>
                      <VStack align="start" spacing={1}>
                        <Text fontWeight="semibold">{campaign.name}</Text>
                        <Text fontSize="sm" color="gray.600">{campaign.subject}</Text>
                        <HStack spacing={1}>
                          {campaign.tags.slice(0, 2).map((tag) => (
                            <Tag key={tag} size="sm" variant="subtle">
                              <TagLabel>{tag}</TagLabel>
                            </Tag>
                          ))}
                          {campaign.tags.length > 2 && (
                            <Tag size="sm" variant="subtle">
                              <TagLabel>+{campaign.tags.length - 2}</TagLabel>
                            </Tag>
                          )}
                        </HStack>
                      </VStack>
                    </Td>
                    <Td>
                      <HStack>
                        <Icon as={getStatusIcon(campaign.status)} color={`${getStatusColor(campaign.status)}.500`} boxSize={4} />
                        <Badge colorScheme={getStatusColor(campaign.status)} size="sm">
                          {campaign.status}
                        </Badge>
                      </HStack>
                    </Td>
                    <Td isNumeric>{campaign.recipientCount.toLocaleString()}</Td>
                    <Td isNumeric>{campaign.sentCount.toLocaleString()}</Td>
                    <Td isNumeric>
                      <VStack align="end" spacing={0}>
                        <Text>{campaign.openedCount.toLocaleString()}</Text>
                        <Text fontSize="xs" color="gray.600">
                          {campaign.sentCount > 0 ? ((campaign.openedCount / campaign.sentCount) * 100).toFixed(1) : '0.0'}%
                        </Text>
                      </VStack>
                    </Td>
                    <Td isNumeric>
                      <VStack align="end" spacing={0}>
                        <Text>{campaign.clickedCount.toLocaleString()}</Text>
                        <Text fontSize="xs" color="gray.600">
                          {campaign.sentCount > 0 ? ((campaign.clickedCount / campaign.sentCount) * 100).toFixed(1) : '0.0'}%
                        </Text>
                      </VStack>
                    </Td>
                    <Td isNumeric>
                      <VStack align="end" spacing={0}>
                        <Text>{campaign.repliedCount.toLocaleString()}</Text>
                        <Text fontSize="xs" color="gray.600">
                          {campaign.sentCount > 0 ? ((campaign.repliedCount / campaign.sentCount) * 100).toFixed(1) : '0.0'}%
                        </Text>
                      </VStack>
                    </Td>
                    <Td>
                      <VStack align="start" spacing={0}>
                        {campaign.scheduledFor && (
                          <HStack>
                            <Icon as={CalendarIcon} boxSize={3} color="blue.500" />
                            <Text fontSize="xs">
                              {new Date(campaign.scheduledFor).toLocaleDateString()}
                            </Text>
                          </HStack>
                        )}
                        {campaign.sentAt && (
                          <HStack>
                            <Icon as={CheckCircleIcon} boxSize={3} color="green.500" />
                            <Text fontSize="xs">
                              {new Date(campaign.sentAt).toLocaleString()}
                            </Text>
                          </HStack>
                        )}
                      </VStack>
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
                          <MenuItem icon={<EditIcon />} onClick={() => handleEditCampaign(campaign)}>
                            Edit
                          </MenuItem>
                          {(campaign.status === 'draft' || campaign.status === 'paused') && (
                            <MenuItem icon={<EmailIcon />} onClick={() => handleStartCampaign(campaign.id)}>
                              Start Campaign
                            </MenuItem>
                          )}
                          {campaign.status === 'sending' && (
                            <MenuItem icon={<TimeIcon />} onClick={() => handlePauseCampaign(campaign.id)}>
                              Pause Campaign
                            </MenuItem>
                          )}
                          <MenuDivider />
                          <MenuItem icon={<DeleteIcon />} color="red.500" onClick={() => handleDeleteCampaign(campaign.id)}>
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

      {/* Create/Edit Campaign Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{editingCampaign?.id ? 'Edit Campaign' : 'Create Campaign'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {editingCampaign && (
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl>
                  <FormLabel>Campaign Name</FormLabel>
                  <Input
                    value={editingCampaign.name}
                    onChange={(e) => setEditingCampaign({...editingCampaign, name: e.target.value})}
                    placeholder="Enter campaign name"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Email Subject</FormLabel>
                  <Input
                    value={editingCampaign.subject}
                    onChange={(e) => setEditingCampaign({...editingCampaign, subject: e.target.value})}
                    placeholder="Enter email subject line"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Sender</FormLabel>
                  <Select
                    value={editingCampaign.senderIdentity.id}
                    onChange={(e) => setEditingCampaign({
                      ...editingCampaign,
                      senderIdentity: { ...editingCampaign.senderIdentity, id: e.target.value }
                    })}
                  >
                    <option value="default">noreply@company.com</option>
                    <option value="sales">sales@company.com</option>
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel>Status</FormLabel>
                  <Select
                    value={editingCampaign.status}
                    onChange={(e) => setEditingCampaign({...editingCampaign, status: e.target.value as any})}
                  >
                    <option value="draft">Draft</option>
                    <option value="scheduled">Scheduled</option>
                  </Select>
                </FormControl>
                <FormControl gridColumn="span 2">
                  <FormLabel>Tags</FormLabel>
                  <HStack spacing={2} wrap="wrap">
                    {editingCampaign.tags.map((tag) => (
                      <Tag key={tag} size="md" variant="solid">
                        <TagLabel>{tag}</TagLabel>
                        <TagCloseButton
                          onClick={() => setEditingCampaign({
                            ...editingCampaign,
                            tags: editingCampaign.tags.filter(t => t !== tag)
                          })}
                        />
                      </Tag>
                    ))}
                    <Input
                      size="sm"
                      placeholder="Add tag..."
                      w="120px"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                          const newTag = e.currentTarget.value.trim()
                          if (!editingCampaign.tags.includes(newTag)) {
                            setEditingCampaign({
                              ...editingCampaign,
                              tags: [...editingCampaign.tags, newTag]
                            })
                          }
                          e.currentTarget.value = ''
                        }
                      }}
                    />
                  </HStack>
                </FormControl>
              </SimpleGrid>
            )}
          </ModalBody>
          <Flex justify="flex-end" p={6} pt={0}>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleSaveCampaign}>
              {editingCampaign?.id ? 'Save Changes' : 'Create Campaign'}
            </Button>
          </Flex>
        </ModalContent>
      </Modal>
    </Box>
  )
}

export default CampaignsTab