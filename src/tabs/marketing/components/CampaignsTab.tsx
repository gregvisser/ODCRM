import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardBody,
  Flex,
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
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
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
  TimeIcon,
} from '@chakra-ui/icons'
import { api } from '../../../utils/api'
import RequireActiveClient from '../../../components/RequireActiveClient'

type CampaignMetrics = {
  totalProspects: number
  emailsSent: number
  opened: number
  bounced: number
  unsubscribed: number
  replied: number
}

type Campaign = {
  id: string
  name: string
  description?: string | null
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'running'
  listId?: string | null
  senderIdentityId?: string | null
  scheduledFor?: string
  sentAt?: string
  createdAt: string
  senderIdentity?: {
    id: string
    emailAddress: string
    displayName?: string
  } | null
  metrics?: CampaignMetrics
  templateId?: string
}

type EmailTemplate = {
  id: string
  name: string
  subjectTemplate: string
  bodyTemplateHtml: string
  bodyTemplateText?: string | null
  stepNumber?: number
}

type SnapshotList = {
  id: string
  name: string
  memberCount: number
  lastSyncAt: string
}

type SnapshotOption = SnapshotList & {
  source: 'cognism' | 'apollo' | 'blackbook'
}

type EmailIdentity = {
  id: string
  emailAddress: string
  displayName?: string | null
  isActive?: boolean
}

type StartPreview = {
  snapshot?: SnapshotOption
  template?: EmailTemplate
  sender?: EmailIdentity
  contactCount?: number
  missingEmailCount?: number
  error?: string | null
  loading?: boolean
}

const LEAD_SOURCES: SnapshotOption['source'][] = ['cognism', 'apollo', 'blackbook']

const CampaignsTab: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [snapshots, setSnapshots] = useState<SnapshotOption[]>([])
  const [senderIdentities, setSenderIdentities] = useState<EmailIdentity[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [snapshotsError, setSnapshotsError] = useState<string | null>(null)
  const [templatesError, setTemplatesError] = useState<string | null>(null)
  const [sendersError, setSendersError] = useState<string | null>(null)
  const [snapshotsLoading, setSnapshotsLoading] = useState(false)
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [sendersLoading, setSendersLoading] = useState(false)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [startPreviewCampaign, setStartPreviewCampaign] = useState<Campaign | null>(null)
  const [startPreview, setStartPreview] = useState<StartPreview | null>(null)
  const { isOpen: isStartOpen, onOpen: onStartOpen, onClose: onStartClose } = useDisclosure()
  const cancelStartRef = useRef<HTMLButtonElement | null>(null)
  const toast = useToast()

  useEffect(() => {
    loadData()
    loadFormOptions()
    maybeOpenFromSnapshot()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError(null)

    const campaignsRes = await api.get<Campaign[]>('/api/campaigns')

    if (campaignsRes.error) {
      setError(campaignsRes.error)
    } else {
      setCampaigns(campaignsRes.data || [])
    }

    setLoading(false)
  }

  const loadFormOptions = async () => {
    setSnapshotsLoading(true)
    setTemplatesLoading(true)
    setSendersLoading(true)
    setSnapshotsError(null)
    setTemplatesError(null)
    setSendersError(null)

    const [snapshotsRes, templatesRes, sendersRes] = await Promise.all([
      loadSnapshots(),
      api.get<EmailTemplate[]>('/api/templates'),
      api.get<EmailIdentity[]>('/api/outlook/identities')
    ])

    if (templatesRes.error) {
      setTemplatesError(templatesRes.error)
    } else {
      setTemplates(templatesRes.data || [])
    }

    if (sendersRes.error) {
      setSendersError(sendersRes.error)
    } else {
      setSenderIdentities((sendersRes.data || []).filter((sender) => sender.isActive !== false))
    }

    setSnapshotsLoading(false)
    setTemplatesLoading(false)
    setSendersLoading(false)
  }

  const loadSnapshots = async () => {
    const results = await Promise.all(
      LEAD_SOURCES.map((source) =>
        api.get<{ lists: SnapshotList[] }>(`/api/sheets/sources/${source}/lists`)
      )
    )

    const errors = results
      .map((res, idx) => (res.error ? `${LEAD_SOURCES[idx]}: ${res.error}` : null))
      .filter(Boolean) as string[]

    if (errors.length > 0) {
      setSnapshotsError(`Failed to load snapshots: ${errors.join(', ')}`)
    }

    const combined: SnapshotOption[] = results.flatMap((res, idx) => {
      const lists = res.data?.lists || []
      return lists.map((list) => ({
        ...list,
        source: LEAD_SOURCES[idx],
      }))
    })

    combined.sort((a, b) => new Date(b.lastSyncAt).getTime() - new Date(a.lastSyncAt).getTime())
    setSnapshots(combined)
    return combined
  }

  const getRecipientCount = (campaign: Campaign) => {
    return campaign.metrics?.totalProspects ?? 0
  }

  const getSentCount = (campaign: Campaign) => {
    return campaign.metrics?.emailsSent ?? 0
  }

  const getOpenedCount = (campaign: Campaign) => {
    return campaign.metrics?.opened ?? 0
  }

  const getClickedCount = (_campaign: Campaign) => {
    return 0
  }

  const getRepliedCount = (campaign: Campaign) => {
    return campaign.metrics?.replied ?? 0
  }

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(campaign => {
      const matchesSearch = searchQuery === '' ||
        campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (campaign.description || '').toLowerCase().includes(searchQuery.toLowerCase())

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
      totalSent: campaigns.reduce((sum, c) => sum + getSentCount(c), 0),
      totalOpens: campaigns.reduce((sum, c) => sum + getOpenedCount(c), 0),
      totalClicks: campaigns.reduce((sum, c) => sum + getClickedCount(c), 0),
      totalReplies: campaigns.reduce((sum, c) => sum + getRepliedCount(c), 0),
    }
  }, [campaigns])

  const handleCreateCampaign = () => {
    setEditingCampaign({
      id: '',
      name: '',
      description: '',
      status: 'draft',
      createdAt: new Date().toISOString(),
      listId: '',
      senderIdentityId: '',
      templateId: '',
    })
    onOpen()
  }

  const handleEditCampaign = (campaign: Campaign) => {
    setEditingCampaign({
      ...campaign,
      listId: campaign.listId || '',
      senderIdentityId: campaign.senderIdentity?.id || campaign.senderIdentityId || '',
      templateId: campaign.templateId || '',
    })
    onOpen()
    loadCampaignTemplateSelection(campaign.id)
  }

  const handleSaveDraft = async () => {
    if (!editingCampaign) return
    if (!editingCampaign.name.trim()) {
      toast({
        title: 'Campaign name is required',
        status: 'error',
        duration: 3000,
      })
      return
    }

    try {
      const payload = {
        name: editingCampaign.name.trim(),
        description: editingCampaign.description?.trim() || undefined,
        status: 'draft',
        listId: editingCampaign.listId || undefined,
        senderIdentityId: editingCampaign.senderIdentityId || undefined,
      }
      if (editingCampaign.id) {
        await api.patch(`/api/campaigns/${editingCampaign.id}`, payload)
        await saveCampaignTemplate(editingCampaign.id)
      } else {
        const response = await api.post<Campaign>('/api/campaigns', payload)
        if (response.error) {
          throw new Error(response.error)
        }
        if (response.data?.id) await saveCampaignTemplate(response.data.id)
      }
      await loadData()
      onClose()
      toast({
        title: `Campaign ${editingCampaign.id ? 'updated' : 'created'} (Draft)`,
        status: 'success',
        duration: 3000,
      })
    } catch (error: any) {
      toast({
        title: `Failed to ${editingCampaign.id ? 'update' : 'create'} campaign`,
        description: error?.message,
        status: 'error',
        duration: 3000,
      })
    }
  }

  const loadCampaignTemplateSelection = async (campaignId: string) => {
    const { data, error: apiError } = await api.get<any>(`/api/campaigns/${campaignId}`)
    if (apiError || !data) return

    const step1 = Array.isArray(data.email_campaign_templates)
      ? data.email_campaign_templates.find((t: any) => t.stepNumber === 1)
      : null

    if (!step1) return

    const matched = templates.find((template) =>
      template.subjectTemplate === step1.subjectTemplate &&
      template.bodyTemplateHtml === step1.bodyTemplateHtml
    )

    if (matched) {
      setEditingCampaign((prev) =>
        prev?.id === campaignId ? { ...prev, templateId: matched.id } as Campaign : prev
      )
    }
  }

  const saveCampaignTemplate = async (campaignId: string) => {
    const templateId = editingCampaign?.templateId
    if (!templateId) return

    const selectedTemplate = templates.find((template) => template.id === templateId)
    if (!selectedTemplate) return

    await api.post(`/api/campaigns/${campaignId}/templates`, {
      steps: [
        {
          stepNumber: 1,
          subjectTemplate: selectedTemplate.subjectTemplate,
          bodyTemplateHtml: selectedTemplate.bodyTemplateHtml,
          bodyTemplateText: selectedTemplate.bodyTemplateText || undefined,
          delayDaysMin: 0,
          delayDaysMax: 0,
        }
      ],
    })
  }

  const validateStartRequirements = (campaign: Campaign) => {
    if (!campaign.name.trim()) return 'Campaign name is required.'
    if (snapshots.length === 0) return 'No snapshots available.'
    if (!campaign.listId) return 'Select a lead snapshot.'
    if (templates.length === 0) return 'No templates available.'
    if (!campaign.templateId) return 'Select a template.'
    if (senderIdentities.length === 0) return 'No senders available.'
    if (!campaign.senderIdentityId) return 'Select a sender.'
    if (snapshotsError || templatesError || sendersError) return 'Fix the data loading errors first.'
    return null
  }

  const handleRequestStart = async (campaign: Campaign) => {
    const validationError = validateStartRequirements(campaign)
    if (validationError) {
      toast({
        title: 'Cannot start campaign',
        description: validationError,
        status: 'error',
        duration: 4000,
      })
      return
    }

    const snapshot = snapshots.find((item) => item.id === campaign.listId)
    const template = templates.find((item) => item.id === campaign.templateId)
    const sender = senderIdentities.find((item) => item.id === campaign.senderIdentityId)

    if (!snapshot || !template || !sender) {
      toast({
        title: 'Cannot start campaign',
        description: 'Snapshot, template, or sender selection is invalid.',
        status: 'error',
        duration: 4000,
      })
      return
    }

    setStartPreviewCampaign(campaign)
    setStartPreview({
      snapshot,
      template,
      sender,
      loading: true,
      error: null,
    })
    onStartOpen()

    const listRes = await api.get<{ contacts: Array<{ id: string; email: string | null }> }>(`/api/lists/${snapshot.id}`)
    if (listRes.error) {
      setStartPreview((prev) => ({
        ...prev,
        loading: false,
        error: listRes.error,
      }))
      return
    }

    const contacts = listRes.data?.contacts || []
    const missingEmailCount = contacts.filter((contact) => !contact.email).length

    setStartPreview((prev) => ({
      ...prev,
      loading: false,
      contactCount: contacts.length,
      missingEmailCount,
    }))
  }

  const handleConfirmStart = async () => {
    if (!startPreviewCampaign) return
    const campaign = startPreviewCampaign
    const listId = campaign.listId
    const senderIdentityId = campaign.senderIdentityId
    const templateId = campaign.templateId

    if (!listId || !senderIdentityId || !templateId) return

    try {
      if (!campaign.id) {
        toast({
          title: 'Save draft first',
          description: 'Save the draft before starting to lock the template selection.',
          status: 'error',
          duration: 4000,
        })
        return
      }

      let campaignId = campaign.id
      if (campaignId) {
        await api.patch(`/api/campaigns/${campaignId}`, {
          name: campaign.name.trim(),
          description: campaign.description?.trim() || undefined,
          listId,
          senderIdentityId,
        })
      }

      const listRes = await api.get<{ contacts: Array<{ id: string }> }>(`/api/lists/${listId}`)
      if (listRes.error) {
        throw new Error(listRes.error)
      }

      const contactIds = (listRes.data?.contacts || []).map((contact) => contact.id)
      if (contactIds.length > 0) {
        const attachRes = await api.post(`/api/campaigns/${campaignId}/prospects`, {
          contactIds,
        })
        if (attachRes.error) {
          throw new Error(attachRes.error)
        }
      }

      const { error: apiError } = await api.post(`/api/campaigns/${campaignId}/start`, {})
      if (apiError) {
        throw new Error(apiError)
      }

      await loadData()
      onStartClose()
      onClose()
      toast({
        title: 'Campaign started',
        description: 'Emails will be sent according to the schedule.',
        status: 'success',
        duration: 4000,
      })
    } catch (startError: any) {
      toast({
        title: 'Failed to start campaign',
        description: startError?.message || 'Unknown error',
        status: 'error',
        duration: 5000,
      })
    }
  }

  const maybeOpenFromSnapshot = () => {
    const params = new URLSearchParams(window.location.search)
    const snapshotId = params.get('snapshotId')
    const view = params.get('view')
    if (view !== 'campaigns' || !snapshotId) return
    handleCreateCampaign()
    setEditingCampaign((prev) => (prev ? { ...prev, listId: snapshotId } : prev))
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
      <RequireActiveClient>
        <Box textAlign="center" py={10}>
          <Text>Loading campaigns...</Text>
        </Box>
      </RequireActiveClient>
    )
  }

  return (
    <RequireActiveClient>
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
      {(snapshotsError || templatesError || sendersError) && (
        <Alert status="error" mb={4}>
          <AlertIcon />
          <Box flex="1">
            <AlertTitle>Failed to load campaign options</AlertTitle>
            <AlertDescription>
              {snapshotsError || templatesError || sendersError}
            </AlertDescription>
          </Box>
          <Button size="sm" onClick={loadFormOptions} ml={4}>
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
                        <Text fontSize="sm" color="gray.600">
                          {campaign.description || 'No description'}
                        </Text>
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
                    <Td isNumeric>{getRecipientCount(campaign).toLocaleString()}</Td>
                    <Td isNumeric>{getSentCount(campaign).toLocaleString()}</Td>
                    <Td isNumeric>
                      <VStack align="end" spacing={0}>
                        <Text>{getOpenedCount(campaign).toLocaleString()}</Text>
                        <Text fontSize="xs" color="gray.600">
                          {getSentCount(campaign) > 0 ? ((getOpenedCount(campaign) / getSentCount(campaign)) * 100).toFixed(1) : '0.0'}%
                        </Text>
                      </VStack>
                    </Td>
                    <Td isNumeric>
                      <VStack align="end" spacing={0}>
                        <Text>{getClickedCount(campaign).toLocaleString()}</Text>
                        <Text fontSize="xs" color="gray.600">
                          {getSentCount(campaign) > 0 ? ((getClickedCount(campaign) / getSentCount(campaign)) * 100).toFixed(1) : '0.0'}%
                        </Text>
                      </VStack>
                    </Td>
                    <Td isNumeric>
                      <VStack align="end" spacing={0}>
                        <Text>{getRepliedCount(campaign).toLocaleString()}</Text>
                        <Text fontSize="xs" color="gray.600">
                          {getSentCount(campaign) > 0 ? ((getRepliedCount(campaign) / getSentCount(campaign)) * 100).toFixed(1) : '0.0'}%
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
                            <MenuItem icon={<EmailIcon />} onClick={() => handleEditCampaign(campaign)}>
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
                <FormControl isRequired>
                  <FormLabel>Leads Snapshot</FormLabel>
                  <Select
                    value={editingCampaign.listId || ''}
                    onChange={(e) => setEditingCampaign({
                      ...editingCampaign,
                      listId: e.target.value || '',
                    })}
                    placeholder={snapshotsLoading ? 'Loading snapshots...' : 'Select a snapshot'}
                  >
                    {snapshots.map((snapshot) => (
                      <option key={snapshot.id} value={snapshot.id}>
                        {snapshot.name} ({snapshot.memberCount} leads)
                      </option>
                    ))}
                  </Select>
                  {snapshots.length === 0 && !snapshotsLoading && (
                    <Text fontSize="sm" color="gray.500" mt={2}>
                      No snapshots yet. Go to Lead Sources and click Sync.
                    </Text>
                  )}
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Template</FormLabel>
                  <Select
                    value={editingCampaign.templateId || ''}
                    onChange={(e) => setEditingCampaign({...editingCampaign, templateId: e.target.value || ''})}
                    placeholder={templatesLoading ? 'Loading templates...' : 'Select a template'}
                  >
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} — {template.subjectTemplate}
                      </option>
                    ))}
                  </Select>
                  {templates.length === 0 && !templatesLoading && (
                    <Text fontSize="sm" color="gray.500" mt={2}>
                      Create a template first.
                    </Text>
                  )}
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Sender</FormLabel>
                  <Select
                    value={editingCampaign.senderIdentityId || ''}
                    onChange={(e) => setEditingCampaign({
                      ...editingCampaign,
                      senderIdentityId: e.target.value || '',
                    })}
                    placeholder={sendersLoading ? 'Loading senders...' : 'Select a sender'}
                  >
                    {senderIdentities.map((sender) => (
                      <option key={sender.id} value={sender.id}>
                        {sender.displayName ? `${sender.displayName} — ${sender.emailAddress}` : sender.emailAddress}
                      </option>
                    ))}
                  </Select>
                  {senderIdentities.length === 0 && !sendersLoading && (
                    <Text fontSize="sm" color="gray.500" mt={2}>
                      Connect an Outlook sender first.
                    </Text>
                  )}
                </FormControl>
              </SimpleGrid>
            )}
          </ModalBody>
          <Box px={6} pb={2}>
            {editingCampaign && !editingCampaign.id && (
              <Alert status="info" variant="left-accent">
                <AlertIcon />
                <Box>
                  <AlertTitle>Save draft to enable Start</AlertTitle>
                  <AlertDescription>
                    Starting requires a saved draft. Click Save Draft once, then Start.
                  </AlertDescription>
                </Box>
              </Alert>
            )}
          </Box>
          <Flex justify="flex-end" p={6} pt={0}>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button variant="outline" mr={3} onClick={handleSaveDraft}>
              Save Draft
            </Button>
            <Button
              colorScheme="blue"
              onClick={() => editingCampaign && handleRequestStart(editingCampaign)}
              isDisabled={!editingCampaign || !editingCampaign.id || !!validateStartRequirements(editingCampaign)}
            >
              Start Campaign
            </Button>
          </Flex>
        </ModalContent>
      </Modal>

      <AlertDialog isOpen={isStartOpen} onClose={onStartClose} leastDestructiveRef={cancelStartRef}>
        <AlertDialogOverlay />
        <AlertDialogContent>
          <AlertDialogHeader fontSize="lg" fontWeight="bold">
            Confirm start
          </AlertDialogHeader>
          <AlertDialogBody>
            {startPreview?.error ? (
              <Alert status="error" mb={4}>
                <AlertIcon />
                <AlertDescription>{startPreview.error}</AlertDescription>
              </Alert>
            ) : (
              <VStack align="start" spacing={3}>
                <Text>
                  This will enroll the selected snapshot and start sending immediately.
                </Text>
                <Box>
                  <Text fontWeight="semibold">Sender</Text>
                  <Text fontSize="sm" color="gray.600">
                    {startPreview?.sender?.emailAddress || '—'}
                  </Text>
                </Box>
                <Box>
                  <Text fontWeight="semibold">Leads Snapshot</Text>
                  <Text fontSize="sm" color="gray.600">
                    {startPreview?.snapshot?.name || '—'}
                    {typeof startPreview?.snapshot?.memberCount === 'number'
                      ? ` (${startPreview.snapshot.memberCount} leads)`
                      : ''}
                  </Text>
                </Box>
                <Box>
                  <Text fontWeight="semibold">Template</Text>
                  <Text fontSize="sm" color="gray.600">
                    {startPreview?.template?.name || '—'} — {startPreview?.template?.subjectTemplate || '—'}
                  </Text>
                </Box>
                {typeof startPreview?.missingEmailCount === 'number' && startPreview.missingEmailCount > 0 && (
                  <Alert status="warning">
                    <AlertIcon />
                    <AlertDescription>
                      {startPreview.missingEmailCount} lead(s) are missing email addresses and will be skipped.
                    </AlertDescription>
                  </Alert>
                )}
              </VStack>
            )}
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button ref={cancelStartRef} onClick={onStartClose}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleConfirmStart}
              ml={3}
              isLoading={startPreview?.loading}
              isDisabled={!!startPreview?.error}
            >
              Start Campaign
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Box>
    </RequireActiveClient>
  )
}

export default CampaignsTab