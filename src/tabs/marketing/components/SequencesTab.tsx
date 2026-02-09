import React, { useEffect, useMemo, useRef, useState } from 'react'
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
  Icon,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
  Select,
  SimpleGrid,
  Spacer,
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
  useToast,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
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
import { settingsStore } from '../../../platform'
import { getCurrentCustomerId } from '../../../platform/stores/settings'

type CampaignMetrics = {
  totalProspects: number
  emailsSent: number
  opened: number
  bounced: number
  unsubscribed: number
  replied: number
}

type SequenceCampaign = {
  id: string
  name: string
  description?: string | null
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'running'
  listId?: string | null
  sequenceId?: string | null
  senderIdentityId?: string | null
  createdAt: string
  updatedAt?: string
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
  suppressedCount?: number
  error?: string | null
  loading?: boolean
}

type SequenceDetail = {
  id: string
  steps: Array<{
    id: string
    stepOrder: number
    subjectTemplate: string
    bodyTemplateHtml: string
    bodyTemplateText?: string | null
  }>
}

const LEAD_SOURCES: SnapshotOption['source'][] = ['cognism', 'apollo', 'blackbook']

type Customer = {
  id: string
  name: string
}

const SequencesTab: React.FC = () => {
  const [sequences, setSequences] = useState<SequenceCampaign[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
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
  const [editingSequence, setEditingSequence] = useState<SequenceCampaign | null>(null)
  const [startPreviewCampaign, setStartPreviewCampaign] = useState<SequenceCampaign | null>(null)
  const [startPreview, setStartPreview] = useState<StartPreview | null>(null)
  const { isOpen: isStartOpen, onOpen: onStartOpen, onClose: onStartClose } = useDisclosure()
  const cancelStartRef = useRef<HTMLButtonElement | null>(null)
  const toast = useToast()

  useEffect(() => {
    loadCustomers()
    loadData()
    maybeOpenFromSnapshot()
  }, [])

  useEffect(() => {
    if (selectedCustomerId) {
      loadFormOptions()
    }
  }, [selectedCustomerId])

  const loadCustomers = async () => {
    const { data, error: apiError } = await api.get<Customer[]>('/api/customers')

    if (apiError) {
      console.error('Failed to load customers:', apiError)
      const defaultCustomerId = getCurrentCustomerId('prod-customer-1')
      setSelectedCustomerId(defaultCustomerId)
      setCustomers([{ id: defaultCustomerId, name: 'Default Customer' }])
    } else {
      const customerList = data || []
      setCustomers(customerList)

      const currentCustomerId = getCurrentCustomerId('prod-customer-1')
      const currentCustomer = customerList.find(c => c.id === currentCustomerId)
      if (currentCustomer) {
        setSelectedCustomerId(currentCustomerId)
      } else if (customerList.length > 0) {
        setSelectedCustomerId(customerList[0].id)
      }
    }
  }

  const loadData = async () => {
    setLoading(true)
    setError(null)
    const campaignsRes = await api.get<SequenceCampaign[]>('/api/campaigns')
    if (campaignsRes.error) {
      setError(campaignsRes.error)
    } else {
      const allCampaigns = campaignsRes.data || []
      setSequences(allCampaigns.filter((campaign) => !!campaign.sequenceId))
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

    const headers = selectedCustomerId ? { 'X-Customer-Id': selectedCustomerId } : {}
    const [snapshotsRes, templatesRes, sendersRes] = await Promise.all([
      loadSnapshots(),
      api.get<EmailTemplate[]>('/api/templates', { headers }),
      api.get<EmailIdentity[]>('/api/outlook/identities', { headers })
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

  const getRecipientCount = (campaign: SequenceCampaign) => {
    return campaign.metrics?.totalProspects ?? 0
  }

  const getSentCount = (campaign: SequenceCampaign) => {
    return campaign.metrics?.emailsSent ?? 0
  }

  const getOpenedCount = (campaign: SequenceCampaign) => {
    return campaign.metrics?.opened ?? 0
  }

  const getRepliedCount = (campaign: SequenceCampaign) => {
    return campaign.metrics?.replied ?? 0
  }

  const filteredSequences = useMemo(() => {
    return sequences.filter((sequence) => {
      const matchesSearch = searchQuery === '' ||
        sequence.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (sequence.description || '').toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus = statusFilter === 'all' || sequence.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [sequences, searchQuery, statusFilter])

  const stats = useMemo(() => {
    return {
      total: sequences.length,
      sent: sequences.filter(c => c.status === 'sent').length,
      scheduled: sequences.filter(c => c.status === 'scheduled').length,
      drafts: sequences.filter(c => c.status === 'draft').length,
      totalSent: sequences.reduce((sum, c) => sum + getSentCount(c), 0),
      totalOpens: sequences.reduce((sum, c) => sum + getOpenedCount(c), 0),
      totalReplies: sequences.reduce((sum, c) => sum + getRepliedCount(c), 0),
    }
  }, [sequences])

  const handleCreateSequence = () => {
    // Check if templates exist
    if (templates.length === 0) {
      toast({
        title: 'No templates available',
        description: 'You need at least one template to create a sequence. Please create a template first.',
        status: 'warning',
        duration: 5000,
        isClosable: true,
      })
      return
    }

    setEditingSequence({
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

  const handleEditSequence = (sequence: SequenceCampaign) => {
    setEditingSequence({
      ...sequence,
      listId: sequence.listId || '',
      senderIdentityId: sequence.senderIdentity?.id || sequence.senderIdentityId || '',
      templateId: sequence.templateId || '',
    })
    onOpen()
    if (sequence.sequenceId) {
      loadSequenceTemplateSelection(sequence.sequenceId)
    }
  }

  const loadSequenceTemplateSelection = async (sequenceId: string) => {
    const { data, error: apiError } = await api.get<SequenceDetail>(`/api/sequences/${sequenceId}`)
    if (apiError || !data) return

    const step1 = data.steps?.find((step) => step.stepOrder === 1)
    if (!step1) return

    const matched = templates.find((template) =>
      template.subjectTemplate === step1.subjectTemplate &&
      template.bodyTemplateHtml === step1.bodyTemplateHtml
    )

    if (matched) {
      setEditingSequence((prev) =>
        prev ? { ...prev, templateId: matched.id } : prev
      )
    }
  }

  const ensureSequenceFromTemplate = async (template: EmailTemplate, name: string, senderIdentityId: string, sequenceId?: string | null) => {
    if (!sequenceId) {
      const createRes = await api.post<{ id: string }>('/api/sequences', {
        senderIdentityId,
        name,
        description: '',
        steps: [
          {
            stepOrder: 1,
            delayDaysFromPrevious: 0,
            subjectTemplate: template.subjectTemplate,
            bodyTemplateHtml: template.bodyTemplateHtml,
            bodyTemplateText: template.bodyTemplateText || undefined,
          }
        ],
      })
      if (createRes.error || !createRes.data?.id) {
        throw new Error(createRes.error || 'Failed to create sequence')
      }
      return createRes.data.id
    }

    const detailRes = await api.get<SequenceDetail>(`/api/sequences/${sequenceId}`)
    if (detailRes.error || !detailRes.data) {
      throw new Error(detailRes.error || 'Failed to load sequence')
    }

    const step1 = detailRes.data.steps.find((step) => step.stepOrder === 1)
    if (step1) {
      const updateRes = await api.put(`/api/sequences/${sequenceId}/steps/${step1.id}`, {
        stepOrder: 1,
        delayDaysFromPrevious: 0,
        subjectTemplate: template.subjectTemplate,
        bodyTemplateHtml: template.bodyTemplateHtml,
        bodyTemplateText: template.bodyTemplateText || undefined,
      })
      if (updateRes.error) {
        throw new Error(updateRes.error)
      }
    } else {
      const addRes = await api.post(`/api/sequences/${sequenceId}/steps`, {
        stepOrder: 1,
        delayDaysFromPrevious: 0,
        subjectTemplate: template.subjectTemplate,
        bodyTemplateHtml: template.bodyTemplateHtml,
        bodyTemplateText: template.bodyTemplateText || undefined,
      })
      if (addRes.error) {
        throw new Error(addRes.error)
      }
    }

    return sequenceId
  }

  const saveCampaignTemplate = async (campaignId: string, template: EmailTemplate) => {
    await api.post(`/api/campaigns/${campaignId}/templates`, {
      steps: [
        {
          stepNumber: 1,
          subjectTemplate: template.subjectTemplate,
          bodyTemplateHtml: template.bodyTemplateHtml,
          bodyTemplateText: template.bodyTemplateText || undefined,
          delayDaysMin: 0,
          delayDaysMax: 0,
        }
      ],
    })
  }

  const handleSaveDraft = async () => {
    if (!editingSequence) return
    if (!editingSequence.name.trim()) {
      toast({
        title: 'Sequence name is required',
        status: 'error',
        duration: 3000,
      })
      return
    }

    try {
      let sequenceId = editingSequence.sequenceId
      const template = templates.find((item) => item.id === editingSequence.templateId)
      if (template) {
        sequenceId = await ensureSequenceFromTemplate(template, editingSequence.name.trim(), sequenceId)
      }

      const payload = {
        name: editingSequence.name.trim(),
        description: editingSequence.description?.trim() || undefined,
        status: 'draft',
        listId: editingSequence.listId || undefined,
        senderIdentityId: editingSequence.senderIdentityId || undefined,
        sequenceId: sequenceId || undefined,
      }

      if (editingSequence.id) {
        await api.patch(`/api/campaigns/${editingSequence.id}`, payload)
        if (template) await saveCampaignTemplate(editingSequence.id, template)
      } else {
        const response = await api.post<SequenceCampaign>('/api/campaigns', payload)
        if (response.error) {
          throw new Error(response.error)
        }
        if (response.data?.id && template) await saveCampaignTemplate(response.data.id, template)
      }

      await loadData()
      onClose()
      toast({
        title: `Sequence ${editingSequence.id ? 'updated' : 'created'} (Draft)`,
        status: 'success',
        duration: 3000,
      })
    } catch (error: any) {
      toast({
        title: `Failed to ${editingSequence.id ? 'update' : 'create'} sequence`,
        description: error?.message,
        status: 'error',
        duration: 3000,
      })
    }
  }

  const validateStartRequirements = (sequence: SequenceCampaign) => {
    if (!sequence.name.trim()) return 'Sequence name is required.'
    if (snapshots.length === 0) return 'No snapshots available.'
    if (!sequence.listId) return 'Select a lead snapshot.'
    if (templates.length === 0) return 'No templates available.'
    if (!sequence.templateId) return 'Select a template.'
    if (senderIdentities.length === 0) return 'No senders available.'
    if (!sequence.senderIdentityId) return 'Select a sender.'
    if (snapshotsError || templatesError || sendersError) return 'Fix the data loading errors first.'
    return null
  }

  const handleRequestStart = async (sequence: SequenceCampaign) => {
    const validationError = validateStartRequirements(sequence)
    if (validationError) {
      toast({
        title: 'Cannot start sequence',
        description: validationError,
        status: 'error',
        duration: 4000,
      })
      return
    }

    const snapshot = snapshots.find((item) => item.id === sequence.listId)
    const template = templates.find((item) => item.id === sequence.templateId)
    const sender = senderIdentities.find((item) => item.id === sequence.senderIdentityId)

    if (!snapshot || !template || !sender) {
      toast({
        title: 'Cannot start sequence',
        description: 'Snapshot, template, or sender selection is invalid.',
        status: 'error',
        duration: 4000,
      })
      return
    }

    setStartPreviewCampaign(sequence)
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

    // Check suppression
    const validEmails = contacts.filter((c) => c.email).map((c) => c.email!)
    let suppressedCount = 0

    if (validEmails.length > 0 && selectedCustomerId) {
      try {
        const suppressionRes = await api.post('/api/suppression/check', {
          emails: validEmails
        }, {
          headers: { 'X-Customer-Id': selectedCustomerId }
        })

        if (suppressionRes.data) {
          suppressedCount = suppressionRes.data.suppressedCount || 0
        }
      } catch (err) {
        console.error('Failed to check suppression:', err)
        // Don't block on suppression check failure
      }
    }

    setStartPreview((prev) => ({
      ...prev,
      loading: false,
      contactCount: contacts.length,
      missingEmailCount,
      suppressedCount,
    }))
  }

  const handleConfirmStart = async () => {
    if (!startPreviewCampaign) return
    const sequence = startPreviewCampaign
    const listId = sequence.listId
    const senderIdentityId = sequence.senderIdentityId
    const templateId = sequence.templateId

    if (!listId || !senderIdentityId || !templateId) return

    try {
      if (!sequence.id) {
        toast({
          title: 'Save draft first',
          description: 'Save the draft before starting to lock the template selection.',
          status: 'error',
          duration: 4000,
        })
        return
      }

      const template = templates.find((item) => item.id === templateId)
      if (!template) {
        throw new Error('Template not found')
      }

      const sequenceId = await ensureSequenceFromTemplate(template, sequence.name.trim(), senderIdentityId, sequence.sequenceId)

      let campaignId = sequence.id
      if (campaignId) {
        await api.patch(`/api/campaigns/${campaignId}`, {
          name: sequence.name.trim(),
          description: sequence.description?.trim() || undefined,
          listId,
          senderIdentityId,
          sequenceId,
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
        title: 'Sequence started',
        description: 'Emails will be sent according to the schedule.',
        status: 'success',
        duration: 4000,
      })
    } catch (startError: any) {
      toast({
        title: 'Failed to start sequence',
        description: startError?.message || 'Unknown error',
        status: 'error',
        duration: 5000,
      })
    }
  }

  const handlePauseSequence = async (campaignId: string) => {
    const { error: apiError } = await api.post(`/api/campaigns/${campaignId}/pause`, {})
    if (apiError) {
      toast({
        title: 'Failed to pause sequence',
        description: apiError,
        status: 'error',
        duration: 5000,
      })
      return
    }

    await loadData()
    toast({
      title: 'Sequence paused',
      status: 'info',
      duration: 3000,
    })
  }

  const handleDeleteSequence = async (campaignId: string) => {
    try {
      await api.delete(`/api/campaigns/${campaignId}`)
      await loadData()
      toast({
        title: 'Sequence deleted',
        status: 'success',
        duration: 3000,
      })
    } catch (deleteError) {
      toast({
        title: 'Failed to delete sequence',
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

  const maybeOpenFromSnapshot = () => {
    const params = new URLSearchParams(window.location.search)
    const snapshotId = params.get('snapshotId')
    const view = params.get('view')
    if (view !== 'sequences' || !snapshotId) return
    handleCreateSequence()
    setEditingSequence((prev) => (prev ? { ...prev, listId: snapshotId } : prev))
  }

  if (loading && sequences.length === 0) {
    return (
      <Box textAlign="center" py={10}>
        <Text>Loading sequences...</Text>
      </Box>
    )
  }

  return (
    <Box>
      {error && (
        <Alert status="error" mb={4}>
          <AlertIcon />
          <Box flex="1">
            <AlertTitle>Failed to load sequences</AlertTitle>
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
            <AlertTitle>Failed to load sequence options</AlertTitle>
            <AlertDescription>
              {snapshotsError || templatesError || sendersError}
            </AlertDescription>
          </Box>
          <Button size="sm" onClick={loadFormOptions} ml={4}>
            Retry
          </Button>
        </Alert>
      )}

      {!templatesLoading && !templatesError && templates.length === 0 && selectedCustomerId && (
        <Alert status="warning" mb={4}>
          <AlertIcon />
          <Box flex="1">
            <AlertTitle>No email templates found</AlertTitle>
            <AlertDescription>
              You need at least one email template to create a sequence. Please create a template first in the Templates tab.
            </AlertDescription>
          </Box>
          <Button 
            size="sm" 
            colorScheme="blue" 
            ml={4}
            onClick={() => {
              // Navigate to templates tab
              const event = new CustomEvent('navigate-to-view', { detail: { view: 'templates' } })
              window.dispatchEvent(event)
            }}
          >
            Go to Templates
          </Button>
        </Alert>
      )}

      <Flex justify="space-between" align="center" mb={6}>
        <VStack align="start" spacing={1}>
          <Heading size="lg">Sequences</Heading>
          <Text color="gray.600">
            Create and manage multi-step outreach sequences from lead snapshots
          </Text>
          <HStack spacing={4} mt={2}>
            <FormControl w="300px">
              <FormLabel fontSize="sm">Customer</FormLabel>
              <Select
                value={selectedCustomerId}
                onChange={(e) => {
                  const newCustomerId = e.target.value
                  setSelectedCustomerId(newCustomerId)
                  // Update the global settings store so API calls use the correct customer
                  settingsStore.setCurrentCustomerId(newCustomerId)
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
          leftIcon={<AddIcon />}
          colorScheme="blue"
          onClick={handleCreateSequence}
          isDisabled={!selectedCustomerId}
        >
          New Sequence
        </Button>
      </Flex>

      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Total Sequences</StatLabel>
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

      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} mb={6}>
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
              <StatLabel>Total Replies</StatLabel>
              <StatNumber>{stats.totalReplies.toLocaleString()}</StatNumber>
              <StatHelpText>
                {stats.totalSent > 0 ? ((stats.totalReplies / stats.totalSent) * 100).toFixed(1) : '0.0'}% avg rate
              </StatHelpText>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>

      <Flex gap={4} mb={6} align="center">
        <InputGroup maxW="300px">
          <InputLeftElement>
            <Icon as={SearchIcon} color="gray.400" />
          </InputLeftElement>
          <Input
            placeholder="Search sequences..."
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

      <Card>
        <CardBody p={0}>
          <Box overflowX="auto">
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Sequence</Th>
                  <Th>Status</Th>
                  <Th isNumeric>Recipients</Th>
                  <Th isNumeric>Sent</Th>
                  <Th isNumeric>Opens</Th>
                  <Th isNumeric>Replies</Th>
                  <Th w="50px"></Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredSequences.map((sequence) => (
                  <Tr key={sequence.id}>
                    <Td>
                      <VStack align="start" spacing={1}>
                        <Text fontWeight="semibold">{sequence.name}</Text>
                        <Text fontSize="sm" color="gray.600">
                          {sequence.description || 'No description'}
                        </Text>
                      </VStack>
                    </Td>
                    <Td>
                      <HStack>
                        <Icon as={getStatusIcon(sequence.status)} color={`${getStatusColor(sequence.status)}.500`} boxSize={4} />
                        <Badge colorScheme={getStatusColor(sequence.status)} size="sm">
                          {sequence.status}
                        </Badge>
                      </HStack>
                    </Td>
                    <Td isNumeric>{getRecipientCount(sequence).toLocaleString()}</Td>
                    <Td isNumeric>{getSentCount(sequence).toLocaleString()}</Td>
                    <Td isNumeric>
                      <VStack align="end" spacing={0}>
                        <Text>{getOpenedCount(sequence).toLocaleString()}</Text>
                        <Text fontSize="xs" color="gray.600">
                          {getSentCount(sequence) > 0 ? ((getOpenedCount(sequence) / getSentCount(sequence)) * 100).toFixed(1) : '0.0'}%
                        </Text>
                      </VStack>
                    </Td>
                    <Td isNumeric>
                      <VStack align="end" spacing={0}>
                        <Text>{getRepliedCount(sequence).toLocaleString()}</Text>
                        <Text fontSize="xs" color="gray.600">
                          {getSentCount(sequence) > 0 ? ((getRepliedCount(sequence) / getSentCount(sequence)) * 100).toFixed(1) : '0.0'}%
                        </Text>
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
                          <MenuItem icon={<EditIcon />} onClick={() => handleEditSequence(sequence)}>
                            Edit
                          </MenuItem>
                          {(sequence.status === 'draft' || sequence.status === 'paused') && (
                            <MenuItem icon={<EmailIcon />} onClick={() => handleEditSequence(sequence)}>
                              Start Sequence
                            </MenuItem>
                          )}
                          {sequence.status === 'sending' && (
                            <MenuItem icon={<TimeIcon />} onClick={() => handlePauseSequence(sequence.id)}>
                              Pause Sequence
                            </MenuItem>
                          )}
                          <MenuDivider />
                          <MenuItem icon={<DeleteIcon />} color="red.500" onClick={() => handleDeleteSequence(sequence.id)}>
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

      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{editingSequence?.id ? 'Edit Sequence' : 'Create Sequence'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {editingSequence && (
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl>
                  <FormLabel>Sequence Name</FormLabel>
                  <Input
                    value={editingSequence.name}
                    onChange={(e) => setEditingSequence({ ...editingSequence, name: e.target.value })}
                    placeholder="Enter sequence name"
                  />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Leads Snapshot</FormLabel>
                  <Select
                    value={editingSequence.listId || ''}
                    onChange={(e) => setEditingSequence({
                      ...editingSequence,
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
                    value={editingSequence.templateId || ''}
                    onChange={(e) => setEditingSequence({ ...editingSequence, templateId: e.target.value || '' })}
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
                    value={editingSequence.senderIdentityId || ''}
                    onChange={(e) => setEditingSequence({
                      ...editingSequence,
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
            {editingSequence && !editingSequence.id && (
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
              onClick={() => editingSequence && handleRequestStart(editingSequence)}
              isDisabled={!editingSequence || !editingSequence.id || !!validateStartRequirements(editingSequence)}
            >
              Start Sequence
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
                {typeof startPreview?.suppressedCount === 'number' && startPreview.suppressedCount > 0 && (
                  <Alert status="info">
                    <AlertIcon />
                    <AlertDescription>
                      {startPreview.suppressedCount} contact(s) are on the suppression list and will be excluded.
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
              Start Sequence
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Box>
  )
}

export default SequencesTab
