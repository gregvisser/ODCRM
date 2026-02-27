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
  Textarea,
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
import { normalizeCustomersListResponse } from '../../../utils/normalizeApiResponse'
import { getCurrentCustomerId, setCurrentCustomerId } from '../../../platform/stores/settings'
import RequireActiveClient from '../../../components/RequireActiveClient'
import * as leadSourceSelectionStore from '../../../platform/stores/leadSourceSelection'
import { getLeadSourceContacts } from '../../../utils/leadSourcesApi'
import { visibleColumns } from '../../../utils/visibleColumns'

type CampaignMetrics = {
  totalProspects: number
  emailsSent: number
  opened: number
  bounced: number
  unsubscribed: number
  replied: number
}

type SequenceStep = {
  stepOrder: number
  delayDaysFromPrevious: number
  templateId?: string
  subjectTemplate: string
  bodyTemplateHtml: string
  bodyTemplateText?: string
}

type SequenceCampaign = {
  id: string
  name: string
  description?: string | null
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'running'
  listId?: string | null
  sequenceId?: string | null
  /** When set, this row is linked to a campaign (Start/Pause use this). */
  campaignId?: string | null
  senderIdentityId?: string | null
  createdAt: string
  updatedAt?: string
  senderIdentity?: {
    id: string
    emailAddress: string
    displayName?: string
  } | null
  metrics?: CampaignMetrics
  steps?: SequenceStep[]
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

type LeadSourceBatchOption = {
  batchKey: string
  sourceType: string
  displayLabel: string
  count?: number
}

type EmailIdentity = {
  id: string
  emailAddress: string
  displayName?: string | null
  isActive?: boolean
}

type EnrollmentListItem = {
  id: string
  sequenceId: string
  customerId: string
  name: string | null
  status: string
  createdAt: string
  updatedAt: string
  recipientCount: number
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
  const [leadBatches, setLeadBatches] = useState<LeadSourceBatchOption[]>([])
  const [leadBatchesLoading, setLeadBatchesLoading] = useState(false)
  const [materializedBatchKey, setMaterializedBatchKey] = useState<string | null>(null)
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
  const [leadSourceSelection, setLeadSourceSelection] = useState(leadSourceSelectionStore.getLeadSourceBatchSelection())
  const { isOpen: isPreviewOpen, onOpen: onPreviewOpen, onClose: onPreviewClose } = useDisclosure()
  const [previewContacts, setPreviewContacts] = useState<Record<string, string>[]>([])
  const [previewColumns, setPreviewColumns] = useState<string[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [enrollments, setEnrollments] = useState<EnrollmentListItem[]>([])
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false)
  const [enrollmentsError, setEnrollmentsError] = useState<string | null>(null)
  const [enrollmentActionId, setEnrollmentActionId] = useState<string | null>(null)
  const { isOpen: isCreateEnrollmentOpen, onOpen: onCreateEnrollmentOpen, onClose: onCreateEnrollmentClose } = useDisclosure()
  const [createEnrollmentName, setCreateEnrollmentName] = useState('')
  const [createEnrollmentRecipients, setCreateEnrollmentRecipients] = useState('')
  const [createEnrollmentSubmitting, setCreateEnrollmentSubmitting] = useState(false)

  function parseRecipientEmails(raw: string): string[] {
    const split = raw.split(/[\n,;\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean)
    const unique = Array.from(new Set(split))
    return unique.filter((email) => email.includes('@') && email.includes('.', email.indexOf('@')))
  }

  const handleCreateEnrollment = async () => {
    if (!editingSequence?.id || !selectedCustomerId?.startsWith('cust_')) return
    const emails = parseRecipientEmails(createEnrollmentRecipients)
    if (emails.length === 0) {
      toast({ title: 'Invalid or missing recipients', description: 'Enter at least one valid email (e.g. user@example.com).', status: 'error' })
      return
    }
    setCreateEnrollmentSubmitting(true)
    try {
      const { error } = await api.post<unknown>(
        `/api/sequences/${editingSequence.id}/enrollments`,
        { name: createEnrollmentName.trim() || undefined, recipients: emails.map((email) => ({ email })) },
        { headers: { 'X-Customer-Id': selectedCustomerId } }
      )
      if (error) {
        toast({ title: 'Create enrollment failed', description: error, status: 'error' })
        return
      }
      toast({ title: 'Enrollment created', status: 'success' })
      onCreateEnrollmentClose()
      setCreateEnrollmentName('')
      setCreateEnrollmentRecipients('')
      await loadEnrollmentsForSequence(editingSequence.id)
    } finally {
      setCreateEnrollmentSubmitting(false)
    }
  }

  useEffect(() => {
    const unsub = leadSourceSelectionStore.onLeadSourceBatchSelectionChanged(setLeadSourceSelection)
    return unsub
  }, [])

  const loadEnrollmentsForSequence = async (sequenceId: string) => {
    if (!selectedCustomerId || !selectedCustomerId.startsWith('cust_')) return
    setEnrollmentsLoading(true)
    setEnrollmentsError(null)
    const { data, error } = await api.get<EnrollmentListItem[]>(
      `/api/sequences/${sequenceId}/enrollments`,
      { headers: { 'X-Customer-Id': selectedCustomerId } }
    )
    setEnrollmentsLoading(false)
    if (error) {
      setEnrollmentsError(error)
      setEnrollments([])
      return
    }
    setEnrollments(Array.isArray(data) ? data : [])
  }

  useEffect(() => {
    if (isOpen && editingSequence?.id && selectedCustomerId?.startsWith('cust_')) {
      loadEnrollmentsForSequence(editingSequence.id)
    } else {
      setEnrollments([])
      setEnrollmentsError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load only when modal/sequence/customer change
  }, [isOpen, editingSequence?.id, selectedCustomerId])

  const handleEnrollmentPause = async (enrollmentId: string) => {
    if (!selectedCustomerId || !editingSequence?.id) return
    setEnrollmentActionId(enrollmentId)
    try {
      const { error } = await api.post(
        `/api/enrollments/${enrollmentId}/pause`,
        {},
        { headers: { 'X-Customer-Id': selectedCustomerId } }
      )
      if (error) {
        toast({ title: 'Pause failed', description: error, status: 'error' })
        return
      }
      toast({ title: 'Enrollment paused', status: 'success' })
      await loadEnrollmentsForSequence(editingSequence.id)
    } finally {
      setEnrollmentActionId(null)
    }
  }

  const handleEnrollmentResume = async (enrollmentId: string) => {
    if (!selectedCustomerId || !editingSequence?.id) return
    setEnrollmentActionId(enrollmentId)
    try {
      const { error } = await api.post(
        `/api/enrollments/${enrollmentId}/resume`,
        {},
        { headers: { 'X-Customer-Id': selectedCustomerId } }
      )
      if (error) {
        toast({ title: 'Resume failed', description: error, status: 'error' })
        return
      }
      toast({ title: 'Enrollment resumed', status: 'success' })
      await loadEnrollmentsForSequence(editingSequence.id)
    } finally {
      setEnrollmentActionId(null)
    }
  }

  const handlePreviewRecipients = async () => {
    const sel = leadSourceSelectionStore.getLeadSourceBatchSelection()
    const cid = selectedCustomerId?.startsWith('cust_') ? selectedCustomerId : ''
    if (!sel || !cid) return
    setPreviewLoading(true)
    setPreviewContacts([])
    setPreviewColumns([])
    onPreviewOpen()
    try {
      const data = await getLeadSourceContacts(cid, sel.sourceType, sel.batchKey, 1, 50)
      setPreviewContacts(data.contacts)
      setPreviewColumns(data.columns)
    } catch (e) {
      toast({ title: 'Preview failed', description: e instanceof Error ? e.message : 'Error', status: 'error' })
    } finally {
      setPreviewLoading(false)
    }
  }

  useEffect(() => {
    loadCustomers()
    maybeOpenFromSnapshot()
  }, [])

  useEffect(() => {
    if (selectedCustomerId && selectedCustomerId.startsWith('cust_')) {
      loadData()
    } else {
      setSequences([])
      setError(null)
    }
  }, [selectedCustomerId])

  useEffect(() => {
    if (selectedCustomerId && selectedCustomerId.startsWith('cust_')) {
      loadFormOptions()
    }
  }, [selectedCustomerId])

  const loadCustomers = async () => {
    const { data, error: apiError } = await api.get('/api/customers')

    if (apiError) {
      console.error('Failed to load customers:', apiError)
      setCustomers([])
      setSelectedCustomerId('')
      return
    }

    try {
      const customerList = normalizeCustomersListResponse(data) as Customer[]
      setCustomers(customerList)
      const storeCustomerId = getCurrentCustomerId()
      const currentCustomer = customerList.find(c => c.id === storeCustomerId)
      if (currentCustomer) {
        setSelectedCustomerId(currentCustomer.id)
      } else {
        setSelectedCustomerId('')
      }
    } catch (err: any) {
      console.error('❌ Failed to normalize customers in SequencesTab:', err)
      setCustomers([])
      setSelectedCustomerId('')
    }
  }

  const loadData = async () => {
    if (!selectedCustomerId || !selectedCustomerId.startsWith('cust_')) {
      setSequences([])
      setError(null)
      return
    }
    if (import.meta.env.DEV) {
      console.debug('[SequencesTab] loadData', { hasCustomerId: true })
    }
    setLoading(true)
    setError(null)
    const headers = { 'X-Customer-Id': selectedCustomerId }
    const [sequencesRes, campaignsRes] = await Promise.all([
      api.get<Array<{
        id: string
        name: string
        description?: string | null
        stepCount: number
        senderIdentityId?: string
        senderIdentity?: { id: string; emailAddress: string; displayName?: string } | null
        createdAt: string
        updatedAt: string
      }>>('/api/sequences', { headers }),
      api.get<Array<{
        id: string
        name: string
        description?: string | null
        status: string
        listId?: string | null
        sequenceId?: string | null
        senderIdentityId?: string | null
        senderIdentity?: { id: string; emailAddress: string; displayName?: string } | null
        createdAt: string
        updatedAt?: string
        metrics?: CampaignMetrics
      }>>('/api/campaigns', { headers }),
    ])
    if (sequencesRes.error) {
      setError(sequencesRes.error)
      setSequences([])
      setLoading(false)
      return
    }
    const seqList = Array.isArray(sequencesRes.data) ? sequencesRes.data : []
    const campaigns = Array.isArray(campaignsRes.data) ? campaignsRes.data : []
    const campaignBySequenceId = new Map<string, typeof campaigns[0]>()
    for (const c of campaigns) {
      if (c.sequenceId) campaignBySequenceId.set(c.sequenceId, c)
    }
    const rows: SequenceCampaign[] = seqList.map((seq) => {
      const campaign = campaignBySequenceId.get(seq.id)
      if (campaign) {
        const status = campaign.status === 'running' ? 'sending' : campaign.status === 'completed' ? 'sent' : campaign.status as SequenceCampaign['status']
        return {
          id: seq.id,
          name: seq.name,
          description: seq.description ?? campaign.description ?? null,
          status,
          listId: campaign.listId ?? null,
          sequenceId: seq.id,
          campaignId: campaign.id,
          senderIdentityId: campaign.senderIdentityId ?? seq.senderIdentityId ?? null,
          createdAt: seq.createdAt,
          updatedAt: campaign.updatedAt ?? seq.updatedAt,
          senderIdentity: campaign.senderIdentity ?? seq.senderIdentity ?? null,
          metrics: campaign.metrics,
        }
      }
      return {
        id: seq.id,
        name: seq.name,
        description: seq.description ?? null,
        status: 'draft' as const,
        listId: null,
        sequenceId: seq.id,
        campaignId: null,
        senderIdentityId: seq.senderIdentityId ?? null,
        createdAt: seq.createdAt,
        updatedAt: seq.updatedAt,
        senderIdentity: seq.senderIdentity ?? null,
        metrics: undefined,
      }
    })
    setSequences(rows)
    setLoading(false)
  }

  const loadFormOptions = async () => {
    setSnapshotsLoading(true)
    setLeadBatchesLoading(true)
    setTemplatesLoading(true)
    setSendersLoading(true)
    setSnapshotsError(null)
    setTemplatesError(null)
    setSendersError(null)

    const headers = selectedCustomerId?.startsWith('cust_') ? { 'X-Customer-Id': selectedCustomerId } : {}
    const [snapshotsRes, batchesRes, templatesRes, sendersRes] = await Promise.all([
      loadSnapshots(),
      api.get<LeadSourceBatchOption[]>('/api/lead-sources/batches', { headers }),
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
      setSenderIdentities((Array.isArray(sendersRes.data) ? sendersRes.data : []).filter((sender) => sender.isActive !== false))
    }

    if (!batchesRes.error && Array.isArray(batchesRes.data)) {
      setLeadBatches(batchesRes.data)
    } else {
      setLeadBatches([])
    }

    setSnapshotsLoading(false)
    setLeadBatchesLoading(false)
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

    setMaterializedBatchKey(null)
    setEditingSequence({
      id: '',
      name: '',
      description: '',
      status: 'draft',
      createdAt: new Date().toISOString(),
      listId: '',
      senderIdentityId: '',
      steps: [
        {
          stepOrder: 1,
          delayDaysFromPrevious: 0,
          subjectTemplate: '',
          bodyTemplateHtml: '',
          bodyTemplateText: '',
        }
      ],
    })
    onOpen()
  }

  const handleAddStep = () => {
    if (!editingSequence || !editingSequence.steps) return
    
    const maxSteps = 8
    if (editingSequence.steps.length >= maxSteps) {
      toast({
        title: `Maximum ${maxSteps} steps allowed`,
        description: 'Sequences support up to 8 email steps.',
        status: 'warning',
        duration: 4000,
      })
      return
    }

    const newStep: SequenceStep = {
      stepOrder: editingSequence.steps.length + 1,
      delayDaysFromPrevious: 2, // Default 2 days delay
      subjectTemplate: '',
      bodyTemplateHtml: '',
      bodyTemplateText: '',
    }

    setEditingSequence({
      ...editingSequence,
      steps: [...editingSequence.steps, newStep],
    })
  }

  const handleRemoveStep = (stepOrder: number) => {
    if (!editingSequence || !editingSequence.steps) return
    
    if (editingSequence.steps.length === 1) {
      toast({
        title: 'Cannot remove last step',
        description: 'Sequences must have at least one step.',
        status: 'warning',
        duration: 3000,
      })
      return
    }

    const steps = Array.isArray(editingSequence.steps) ? editingSequence.steps : []
    const updatedSteps = steps
      .filter(s => s.stepOrder !== stepOrder)
      .map((s, index) => ({ ...s, stepOrder: index + 1 }))

    setEditingSequence({
      ...editingSequence,
      steps: updatedSteps,
    })
  }

  const handleStepTemplateChange = (stepOrder: number, templateId: string) => {
    if (!editingSequence) return
    const steps = Array.isArray(editingSequence.steps) ? editingSequence.steps : []
    const template = templates.find(t => t.id === templateId)
    if (!template) return

    const updatedSteps = steps.map(step => {
      if (step.stepOrder === stepOrder) {
        return {
          ...step,
          templateId,
          subjectTemplate: template.subjectTemplate,
          bodyTemplateHtml: template.bodyTemplateHtml,
          bodyTemplateText: template.bodyTemplateText || '',
        }
      }
      return step
    })

    setEditingSequence({
      ...editingSequence,
      steps: updatedSteps,
    })
  }

  const handleStepDelayChange = (stepOrder: number, delay: number) => {
    if (!editingSequence) return
    const steps = Array.isArray(editingSequence.steps) ? editingSequence.steps : []
    const updatedSteps = steps.map(step => {
      if (step.stepOrder === stepOrder) {
        return { ...step, delayDaysFromPrevious: Math.max(0, delay) }
      }
      return step
    })

    setEditingSequence({
      ...editingSequence,
      steps: updatedSteps,
    })
  }

  const handleEditSequence = async (sequence: SequenceCampaign) => {
    setMaterializedBatchKey(null)
    setEditingSequence({
      ...sequence,
      listId: sequence.listId || '',
      senderIdentityId: sequence.senderIdentity?.id || sequence.senderIdentityId || '',
      steps: sequence.steps || [
        {
          stepOrder: 1,
          delayDaysFromPrevious: 0,
          subjectTemplate: '',
          bodyTemplateHtml: '',
          bodyTemplateText: '',
        }
      ],
    })
    onOpen()
    
    // Load steps from backend if sequenceId exists
    if (sequence.sequenceId && selectedCustomerId?.startsWith('cust_')) {
      const { data, error: apiError } = await api.get<SequenceDetail>(`/api/sequences/${sequence.sequenceId}`, {
        headers: { 'X-Customer-Id': selectedCustomerId },
      })
      if (apiError || !data) {
        console.error('Failed to load sequence steps:', apiError)
        return
      }

      const stepsArr = Array.isArray(data.steps) ? data.steps : []
      const loadedSteps: SequenceStep[] = stepsArr.map(step => ({
        stepOrder: step.stepOrder,
        delayDaysFromPrevious: step.delayDaysFromPrevious || 0,
        subjectTemplate: step.subjectTemplate,
        bodyTemplateHtml: step.bodyTemplateHtml,
        bodyTemplateText: step.bodyTemplateText || '',
      }))

      setEditingSequence(prev => prev ? { ...prev, steps: loadedSteps } : prev)
    }
  }

  const saveSequenceWithSteps = async (
    name: string,
    senderIdentityId: string,
    steps: SequenceStep[],
    sequenceId?: string | null
  ) => {
    if (!selectedCustomerId || !selectedCustomerId.startsWith('cust_')) {
      throw new Error('Select a client to save sequences.')
    }
    const headers = { 'X-Customer-Id': selectedCustomerId }

    if (!sequenceId) {
      const payload = {
        senderIdentityId,
        name,
        description: '',
        steps: steps.map(step => ({
          stepOrder: step.stepOrder,
          delayDaysFromPrevious: step.delayDaysFromPrevious,
          subjectTemplate: step.subjectTemplate,
          bodyTemplateHtml: step.bodyTemplateHtml,
          bodyTemplateText: step.bodyTemplateText || undefined,
        })),
      }

      const createRes = await api.post<{ id: string }>('/api/sequences', payload, { headers })
      
      if (createRes.error || !createRes.data?.id) {
        console.error('[SequencesTab] Create sequence failed:', createRes.error)
        throw new Error(createRes.error || 'Failed to create sequence')
      }
      
      return createRes.data.id
    }

    // Update existing sequence - need to sync steps
    const detailRes = await api.get<SequenceDetail>(`/api/sequences/${sequenceId}`, { headers })
    if (detailRes.error || !detailRes.data) {
      throw new Error(detailRes.error || 'Failed to load sequence')
    }

    const existingSteps = detailRes.data.steps || []

    // Update or create each step
    for (const step of steps) {
      const existingStep = existingSteps.find(s => s.stepOrder === step.stepOrder)
      
      if (existingStep) {
        const updateRes = await api.put(`/api/sequences/${sequenceId}/steps/${existingStep.id}`, {
          stepOrder: step.stepOrder,
          delayDaysFromPrevious: step.delayDaysFromPrevious,
          subjectTemplate: step.subjectTemplate,
          bodyTemplateHtml: step.bodyTemplateHtml,
          bodyTemplateText: step.bodyTemplateText || undefined,
        }, { headers })
        if (updateRes.error) {
          throw new Error(`Failed to update step ${step.stepOrder}: ${updateRes.error}`)
        }
      } else {
        const addRes = await api.post(`/api/sequences/${sequenceId}/steps`, {
          stepOrder: step.stepOrder,
          delayDaysFromPrevious: step.delayDaysFromPrevious,
          subjectTemplate: step.subjectTemplate,
          bodyTemplateHtml: step.bodyTemplateHtml,
          bodyTemplateText: step.bodyTemplateText || undefined,
        }, { headers })
        if (addRes.error) {
          throw new Error(`Failed to add step ${step.stepOrder}: ${addRes.error}`)
        }
      }
    }

    const stepsToDelete = existingSteps.filter(
      existing => !steps.some(s => s.stepOrder === existing.stepOrder)
    )
    for (const step of stepsToDelete) {
      const deleteRes = await api.delete(`/api/sequences/${sequenceId}/steps/${step.id}`, { headers })
      if (deleteRes.error) {
        console.error(`Failed to delete step ${step.stepOrder}:`, deleteRes.error)
      }
    }

    return sequenceId
  }


  const handleSaveDraft = async () => {
    if (!editingSequence) return
    
    // Validate name
    if (!editingSequence.name.trim()) {
      toast({
        title: 'Sequence name is required',
        status: 'error',
        duration: 3000,
      })
      return
    }

    // Validate sender identity
    if (!editingSequence.senderIdentityId) {
      toast({
        title: 'Sender identity is required',
        status: 'error',
        duration: 3000,
      })
      return
    }

    // Validate steps
    if (!editingSequence.steps || editingSequence.steps.length === 0) {
      toast({
        title: 'At least one step is required',
        status: 'error',
        duration: 3000,
      })
      return
    }

    // Validate each step has content
    const emptySteps = editingSequence.steps.filter(
      step => !step.subjectTemplate.trim() || !step.bodyTemplateHtml.trim()
    )
    
    if (emptySteps.length > 0) {
      toast({
        title: 'All steps must have subject and body',
        description: `Step${emptySteps.length > 1 ? 's' : ''} ${emptySteps.map(s => s.stepOrder).join(', ')} ${emptySteps.length > 1 ? 'are' : 'is'} incomplete.`,
        status: 'error',
        duration: 4000,
      })
      return
    }

    try {
      // Save sequence with all steps
      const sequenceId = await saveSequenceWithSteps(
        editingSequence.name.trim(),
        editingSequence.senderIdentityId,
        editingSequence.steps,
        editingSequence.sequenceId
      )

      // Update campaign with sequence reference
      const payload = {
        name: editingSequence.name.trim(),
        description: editingSequence.description?.trim() || undefined,
        status: 'draft',
        listId: editingSequence.listId || undefined,
        senderIdentityId: editingSequence.senderIdentityId || undefined,
        sequenceId: sequenceId || undefined,
      }

      if (!selectedCustomerId || !selectedCustomerId.startsWith('cust_')) {
        throw new Error('Select a client to save.')
      }
      const campaignHeaders = { 'X-Customer-Id': selectedCustomerId }
      if (editingSequence.campaignId) {
        await api.patch(`/api/campaigns/${editingSequence.campaignId}`, payload, { headers: campaignHeaders })
      } else {
        const response = await api.post<SequenceCampaign>('/api/campaigns', payload, { headers: campaignHeaders })
        if (response.error) {
          throw new Error(response.error)
        }
      }

      await loadData()
      onClose()
      toast({
        title: `Sequence ${editingSequence.id ? 'updated' : 'created'} (Draft)`,
        description: `${editingSequence.steps.length} step${editingSequence.steps.length > 1 ? 's' : ''} saved`,
        status: 'success',
        duration: 3000,
      })
    } catch (error: any) {
      toast({
        title: `Failed to ${editingSequence.id ? 'update' : 'create'} sequence`,
        description: error?.message,
        status: 'error',
        duration: 4000,
      })
    }
  }

  const validateStartRequirements = (sequence: SequenceCampaign) => {
    if (!sequence.name.trim()) return 'Sequence name is required.'
    if (!sequence.listId) return leadBatches.length === 0 ? 'No lead batches yet. Go to Lead Sources and click Sync.' : 'Select a lead batch.'
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

    const sender = senderIdentities.find((item) => item.id === sequence.senderIdentityId)
    if (!sender || !sequence.steps || sequence.steps.length === 0) {
      toast({
        title: 'Cannot start sequence',
        description: 'Steps or sender selection is invalid.',
        status: 'error',
        duration: 4000,
      })
      return
    }

    setStartPreviewCampaign(sequence)
    setStartPreview({
      snapshot: undefined,
      sender,
      loading: true,
      error: null,
    })
    onStartOpen()

    const listRes = await api.get<{ name?: string; contacts: Array<{ id: string; email: string | null }> }>(`/api/lists/${sequence.listId}`, sequence.listId && selectedCustomerId?.startsWith('cust_') ? { headers: { 'X-Customer-Id': selectedCustomerId } } : undefined)
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
    const listName = listRes.data?.name ?? 'List'

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

    const snapshot: SnapshotOption = {
      id: sequence.listId!,
      name: listName,
      memberCount: contacts.length,
      lastSyncAt: new Date().toISOString(),
      source: 'cognism',
    }
    setStartPreview((prev) => ({
      ...prev,
      loading: false,
      snapshot,
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
    const sequenceId = sequence.sequenceId
    const campaignId = sequence.campaignId

    if (!listId || !senderIdentityId || !sequenceId) {
      toast({
        title: 'Sequence not fully configured',
        description: 'Save the draft first to create the sequence.',
        status: 'error',
        duration: 4000,
      })
      return
    }

    try {
      if (!campaignId) {
        toast({
          title: 'Save draft first',
          description: 'Save the draft before starting.',
          status: 'error',
          duration: 4000,
        })
        return
      }

      if (!selectedCustomerId || !selectedCustomerId.startsWith('cust_')) {
        toast({ title: 'Select a client to start sequence', status: 'error' })
        return
      }
      const startHeaders = { 'X-Customer-Id': selectedCustomerId }

      const verifyRes = await api.get<SequenceDetail>(`/api/sequences/${sequenceId}`, { headers: startHeaders })
      if (verifyRes.error || !verifyRes.data || !verifyRes.data.steps || verifyRes.data.steps.length === 0) {
        throw new Error('Sequence has no steps. Save draft again.')
      }

      await api.patch(`/api/campaigns/${campaignId}`, {
        name: sequence.name.trim(),
        description: sequence.description?.trim() || undefined,
        listId,
        senderIdentityId,
        sequenceId,
      }, { headers: startHeaders })

      const listRes = await api.get<{ contacts: Array<{ id: string }> }>(`/api/lists/${listId}`, { headers: startHeaders })
      if (listRes.error) {
        throw new Error(listRes.error)
      }

      const contactIds = (listRes.data?.contacts || []).map((contact) => contact.id)
      if (contactIds.length > 0) {
        const attachRes = await api.post(`/api/campaigns/${campaignId}/prospects`, {
          contactIds,
        }, { headers: startHeaders })
        if (attachRes.error) {
          throw new Error(attachRes.error)
        }
      }

      const { error: apiError } = await api.post(`/api/campaigns/${campaignId}/start`, {}, { headers: startHeaders })
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
    if (!selectedCustomerId || !selectedCustomerId.startsWith('cust_')) return
    const { error: apiError } = await api.post(`/api/campaigns/${campaignId}/pause`, {}, { headers: { 'X-Customer-Id': selectedCustomerId } })
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

  const handleDeleteSequence = async (sequenceId: string) => {
    if (!selectedCustomerId || !selectedCustomerId.startsWith('cust_')) return
    const deleteHeaders = { 'X-Customer-Id': selectedCustomerId }
    try {
      await api.delete(`/api/sequences/${sequenceId}`, { headers: deleteHeaders })
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

  if (!selectedCustomerId || !selectedCustomerId.startsWith('cust_')) {
    return (
      <RequireActiveClient>
        <Box textAlign="center" py={10}>
          <Text>Please select a client to view sequences.</Text>
        </Box>
      </RequireActiveClient>
    )
  }

  if (loading && sequences.length === 0) {
    return (
      <RequireActiveClient>
        <Box textAlign="center" py={10}>
          <Text>Loading sequences...</Text>
        </Box>
      </RequireActiveClient>
    )
  }

  return (
    <RequireActiveClient>
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

      {leadSourceSelection && (
        <Alert status="info" mb={4}>
          <AlertIcon />
          <Box flex="1">
            <AlertTitle>Lead source batch selected</AlertTitle>
            <AlertDescription>
              {leadSourceSelection.sourceType} — {leadSourceSelection.batchKey}. Preview recipients or clear to choose another.
            </AlertDescription>
          </Box>
          <Button size="sm" colorScheme="blue" mr={2} onClick={handlePreviewRecipients} isLoading={previewLoading}>
            Preview recipients
          </Button>
          <Button size="sm" variant="ghost" onClick={() => leadSourceSelectionStore.clearLeadSourceBatchSelection()}>
            Clear
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
              <FormLabel fontSize="sm">Client</FormLabel>
              <Select
                value={selectedCustomerId}
                onChange={(e) => {
                  const newCustomerId = e.target.value
                  setSelectedCustomerId(newCustomerId)
                  // Update the global settings store so API calls use the correct customer
                  setCurrentCustomerId(newCustomerId)
                }}
                placeholder="Select client"
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
                          {(sequence.status === 'draft' || sequence.status === 'paused') && sequence.campaignId && sequence.listId && (
                            <MenuItem icon={<EmailIcon />} onClick={() => handleEditSequence(sequence)}>
                              Start Sequence
                            </MenuItem>
                          )}
                          {sequence.status === 'sending' && sequence.campaignId && (
                            <MenuItem icon={<TimeIcon />} onClick={() => handlePauseSequence(sequence.campaignId!)}>
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

      <Modal isOpen={isOpen} onClose={onClose} size="6xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent maxH="90vh">
          <ModalHeader borderBottom="1px solid" borderColor="gray.200" pb={4}>
            {editingSequence?.id ? 'Edit Sequence' : 'Create Sequence'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody p={0}>
            {editingSequence && (
              <>
              <SimpleGrid columns={{ base: 1, lg: 2 }} minH="0" h="full">
                {/* LEFT COLUMN — Sequence steps */}
                <Box
                  borderRight={{ lg: '1px solid' }}
                  borderColor={{ lg: 'gray.200' }}
                  p={6}
                  overflowY="auto"
                >
                  <Flex justify="space-between" align="center" mb={4}>
                    <Heading size="sm">
                      Steps ({editingSequence.steps?.length || 0} / 8)
                    </Heading>
                    <Button
                      size="sm"
                      leftIcon={<AddIcon />}
                      onClick={handleAddStep}
                      isDisabled={!editingSequence.steps || editingSequence.steps.length >= 8}
                    >
                      Add Step
                    </Button>
                  </Flex>

                  {templates.length === 0 && !templatesLoading && (
                    <Alert status="warning" mb={4}>
                      <AlertIcon />
                      <AlertDescription fontSize="sm">
                        Create templates first before building sequence steps.
                      </AlertDescription>
                    </Alert>
                  )}

                  {(!editingSequence.steps || editingSequence.steps.length === 0) && (
                    <Box
                      textAlign="center"
                      py={10}
                      borderWidth="2px"
                      borderStyle="dashed"
                      borderColor="gray.200"
                      borderRadius="lg"
                    >
                      <Text color="gray.500" fontSize="sm">
                        No steps yet. Click "Add Step" to begin.
                      </Text>
                    </Box>
                  )}

                  {editingSequence.steps?.map((step) => (
                    <Box
                      key={step.stepOrder}
                      borderWidth="1px"
                      borderRadius="md"
                      p={4}
                      mb={3}
                      bg="gray.50"
                    >
                      <Flex justify="space-between" align="center" mb={3}>
                        <Text fontWeight="bold" fontSize="sm" color="blue.700">
                          Step {step.stepOrder}
                        </Text>
                        {editingSequence.steps && editingSequence.steps.length > 1 && (
                          <IconButton
                            aria-label="Remove step"
                            icon={<DeleteIcon />}
                            size="xs"
                            variant="ghost"
                            colorScheme="red"
                            onClick={() => handleRemoveStep(step.stepOrder)}
                          />
                        )}
                      </Flex>

                      {step.stepOrder > 1 && (
                        <FormControl mb={3}>
                          <FormLabel fontSize="xs" color="gray.600">
                            Delay after previous step (days)
                          </FormLabel>
                          <Input
                            type="number"
                            min={0}
                            value={step.delayDaysFromPrevious}
                            onChange={(e) =>
                              handleStepDelayChange(step.stepOrder, parseInt(e.target.value) || 0)
                            }
                            size="sm"
                          />
                        </FormControl>
                      )}

                      <FormControl isRequired>
                        <FormLabel fontSize="xs" color="gray.600">
                          Template
                        </FormLabel>
                        <Select
                          value={step.templateId || ''}
                          onChange={(e) => handleStepTemplateChange(step.stepOrder, e.target.value)}
                          placeholder={templatesLoading ? 'Loading…' : 'Select a template'}
                          size="sm"
                        >
                          {templates.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} — {t.subjectTemplate.substring(0, 45)}
                            </option>
                          ))}
                        </Select>
                      </FormControl>

                      {step.subjectTemplate && (
                        <Box mt={2} p={2} bg="white" borderRadius="sm" fontSize="xs" color="gray.600">
                          <Text fontWeight="semibold">Subject:</Text>
                          <Text noOfLines={1}>{step.subjectTemplate}</Text>
                        </Box>
                      )}
                    </Box>
                  ))}
                </Box>

                {/* RIGHT COLUMN — Config (name, leads, sender) */}
                <Box p={6} overflowY="auto">
                  <Heading size="sm" mb={4}>
                    Configuration
                  </Heading>

                  <VStack spacing={5} align="stretch">
                    <FormControl isRequired>
                      <FormLabel>Sequence Name</FormLabel>
                      <Input
                        value={editingSequence.name}
                        onChange={(e) =>
                          setEditingSequence({ ...editingSequence, name: e.target.value })
                        }
                        placeholder="e.g. Q1 Outreach — UK Property Managers"
                      />
                    </FormControl>

                    <FormControl isRequired>
                      <FormLabel>Leads Snapshot</FormLabel>
                      <Select
                        value={materializedBatchKey ?? ''}
                        onChange={async (e) => {
                          const batchKey = e.target.value || ''
                          if (!batchKey || !selectedCustomerId?.startsWith('cust_')) return
                          try {
                            const { data, error: matError } = await api.post<{
                              listId: string
                              name: string
                            }>(
                              `/api/lead-sources/batches/${encodeURIComponent(batchKey)}/materialize-list`,
                              {},
                              { headers: { 'X-Customer-Id': selectedCustomerId } }
                            )
                            if (matError || !data?.listId) {
                              toast({
                                title: 'Failed to load list',
                                description: matError ?? 'No list returned',
                                status: 'error',
                              })
                              return
                            }
                            setMaterializedBatchKey(batchKey)
                            setEditingSequence((prev) =>
                              prev ? { ...prev, listId: data.listId } : prev
                            )
                          } catch (err) {
                            toast({
                              title: 'Failed to load list',
                              description: err instanceof Error ? err.message : 'Error',
                              status: 'error',
                            })
                          }
                        }}
                        placeholder={
                          leadBatchesLoading ? 'Loading lead batches…' : 'Select a lead batch'
                        }
                      >
                        {leadBatches.map((b) => (
                          <option key={b.batchKey} value={b.batchKey}>
                            {b.displayLabel} ({b.count ?? 0} leads)
                          </option>
                        ))}
                      </Select>
                      {leadBatches.length === 0 && !leadBatchesLoading && (
                        <Text fontSize="sm" color="gray.500" mt={1}>
                          No lead batches yet — go to Lead Sources and click Sync.
                        </Text>
                      )}
                    </FormControl>

                    <FormControl isRequired>
                      <FormLabel>Sender</FormLabel>
                      <Select
                        value={editingSequence.senderIdentityId || ''}
                        onChange={(e) =>
                          setEditingSequence({
                            ...editingSequence,
                            senderIdentityId: e.target.value || '',
                          })
                        }
                        placeholder={sendersLoading ? 'Loading senders…' : 'Select a sender'}
                      >
                        {senderIdentities.map((sender) => (
                          <option key={sender.id} value={sender.id}>
                            {sender.displayName
                              ? `${sender.displayName} — ${sender.emailAddress}`
                              : sender.emailAddress}
                          </option>
                        ))}
                      </Select>
                      {senderIdentities.length === 0 && !sendersLoading && (
                        <Text fontSize="sm" color="gray.500" mt={1}>
                          Connect an Outlook sender first in Email Accounts.
                        </Text>
                      )}
                    </FormControl>

                    {/* Save-first notice — only shown for new (unsaved) sequences */}
                    {!editingSequence.id && (
                      <Alert status="info" variant="left-accent" fontSize="sm">
                        <AlertIcon />
                        <Box>
                          <AlertTitle fontSize="sm">Save draft to enable Start</AlertTitle>
                          <AlertDescription fontSize="xs">
                            Save first, then use "Start Sequence" to launch.
                          </AlertDescription>
                        </Box>
                      </Alert>
                    )}
                  </VStack>
                </Box>
              </SimpleGrid>

              {editingSequence.id && (
                <Box borderTop="1px solid" borderColor="gray.200" p={6}>
                  <Flex justify="space-between" align="center" mb={4}>
                    <Heading size="sm">Enrollments</Heading>
                    <Button size="sm" leftIcon={<AddIcon />} onClick={onCreateEnrollmentOpen}>
                      Create enrollment
                    </Button>
                  </Flex>
                  {enrollmentsError && (
                    <Alert status="error" mb={4}>
                      <AlertIcon />
                      <AlertDescription>{enrollmentsError}</AlertDescription>
                    </Alert>
                  )}
                  {enrollmentsLoading ? (
                    <Text color="gray.500" fontSize="sm">Loading enrollments…</Text>
                  ) : enrollments.length === 0 && !enrollmentsError ? (
                    <Text color="gray.500" fontSize="sm">No enrollments yet.</Text>
                  ) : (
                    <Box overflowX="auto">
                      <Table size="sm">
                        <Thead>
                          <Tr>
                            <Th>Name</Th>
                            <Th>Status</Th>
                            <Th>Recipients</Th>
                            <Th>Created</Th>
                            <Th>Actions</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {enrollments.map((e) => (
                            <Tr key={e.id}>
                              <Td>{e.name || e.id}</Td>
                              <Td>
                                <Badge colorScheme={e.status === 'ACTIVE' ? 'green' : e.status === 'PAUSED' ? 'yellow' : 'gray'} size="sm">
                                  {e.status}
                                </Badge>
                              </Td>
                              <Td>{e.recipientCount}</Td>
                              <Td fontSize="xs" color="gray.600">
                                {e.createdAt ? new Date(e.createdAt).toLocaleString() : '—'}
                              </Td>
                              <Td>
                                <HStack gap={2}>
                                  <Button
                                    size="xs"
                                    variant="outline"
                                    colorScheme="yellow"
                                    isDisabled={e.status !== 'DRAFT' && e.status !== 'ACTIVE'}
                                    isLoading={enrollmentActionId === e.id}
                                    onClick={() => handleEnrollmentPause(e.id)}
                                  >
                                    Pause
                                  </Button>
                                  <Button
                                    size="xs"
                                    variant="outline"
                                    colorScheme="green"
                                    isDisabled={e.status !== 'PAUSED'}
                                    isLoading={enrollmentActionId === e.id}
                                    onClick={() => handleEnrollmentResume(e.id)}
                                  >
                                    Resume
                                  </Button>
                                </HStack>
                              </Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    </Box>
                  )}
                </Box>
              )}
              </>
            )}
          </ModalBody>

          {/* CTA row */}
          <Flex
            justify="flex-end"
            align="center"
            gap={3}
            px={6}
            py={4}
            borderTop="1px solid"
            borderColor="gray.200"
          >
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="outline" onClick={handleSaveDraft}>
              Save Draft
            </Button>
            <Button
              colorScheme="blue"
              onClick={() => editingSequence && handleRequestStart(editingSequence)}
              isDisabled={
                !editingSequence ||
                !editingSequence.id ||
                !!validateStartRequirements(editingSequence)
              }
            >
              Start Sequence
            </Button>
          </Flex>
        </ModalContent>
      </Modal>

      <Modal isOpen={isCreateEnrollmentOpen} onClose={onCreateEnrollmentClose} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create enrollment</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <FormControl mb={4}>
              <FormLabel>Enrollment name (optional)</FormLabel>
              <Input
                value={createEnrollmentName}
                onChange={(e) => setCreateEnrollmentName(e.target.value)}
                placeholder="e.g. Q1 batch"
              />
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Recipients</FormLabel>
              <Textarea
                value={createEnrollmentRecipients}
                onChange={(e) => setCreateEnrollmentRecipients(e.target.value)}
                placeholder="one@example.com&#10;two@example.com"
                rows={6}
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Paste emails separated by new lines or commas.
              </Text>
            </FormControl>
            <Flex justify="flex-end" gap={2} mt={4}>
              <Button variant="ghost" onClick={onCreateEnrollmentClose} isDisabled={createEnrollmentSubmitting}>
                Cancel
              </Button>
              <Button colorScheme="blue" onClick={handleCreateEnrollment} isLoading={createEnrollmentSubmitting}>
                Create
              </Button>
            </Flex>
          </ModalBody>
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
                  <Text fontWeight="semibold">Sequence Steps</Text>
                  {startPreviewCampaign?.steps && startPreviewCampaign.steps.length > 0 ? (
                    <VStack align="stretch" spacing={1} mt={1}>
                      {startPreviewCampaign.steps.map(step => (
                        <Text key={step.stepOrder} fontSize="sm" color="gray.600">
                          Step {step.stepOrder}: {step.subjectTemplate}
                          {step.stepOrder > 1 && ` (${step.delayDaysFromPrevious}d delay)`}
                        </Text>
                      ))}
                    </VStack>
                  ) : (
                    <Text fontSize="sm" color="gray.600">No steps configured</Text>
                  )}
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

      <Modal isOpen={isPreviewOpen} onClose={onPreviewClose} size="full" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent maxW="90vw">
          <ModalHeader>Preview recipients — Lead source batch</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {previewLoading ? (
              <Text>Loading...</Text>
            ) : (
              (() => {
                const computed = previewContacts.length ? visibleColumns(previewColumns, previewContacts) : previewColumns
                const previewCols = computed.length ? computed : previewColumns
                return (
                  <Box overflowX="auto" overflowY="auto" maxH="70vh" borderWidth="1px" borderRadius="md">
                    <Table size="sm" minW="max-content">
                      <Thead position="sticky" top={0} zIndex={2} bg="gray.50" _dark={{ bg: 'gray.800' }}>
                        <Tr>
                          {previewCols.map((col) => (
                            <Th key={col} whiteSpace="nowrap">
                              {col}
                            </Th>
                          ))}
                        </Tr>
                      </Thead>
                      <Tbody>
                        {previewContacts.length === 0 ? (
                          <Tr>
                            <Td colSpan={previewCols.length || 1} color="gray.500">
                              No contacts
                            </Td>
                          </Tr>
                        ) : (
                          previewContacts.map((row, i) => (
                            <Tr key={i}>
                              {previewCols.map((col) => (
                                <Td key={col} whiteSpace="nowrap">
                                  {row[col] ?? ''}
                                </Td>
                              ))}
                            </Tr>
                          ))
                        )}
                      </Tbody>
                    </Table>
                  </Box>
                )
              })()
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
    </RequireActiveClient>
  )
}

export default SequencesTab
