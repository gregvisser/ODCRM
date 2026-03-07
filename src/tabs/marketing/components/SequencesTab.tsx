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
  Collapse,
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
  Spinner,
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
  FormHelperText,
  FormLabel,
  Radio,
  RadioGroup,
  Textarea,
  useToast,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Tooltip,
  Code,
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
  ViewIcon,
  RepeatIcon,
  InfoIcon,
  CopyIcon,
} from '@chakra-ui/icons'
import { api } from '../../../utils/api'
import { normalizeCustomersListResponse } from '../../../utils/normalizeApiResponse'
import { getCurrentCustomerId, setCurrentCustomerId } from '../../../platform/stores/settings'
import { isAgencyUI } from '../../../platform/mode'
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
const MAX_STEP_DELAY_DAYS = 365

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
  const [createEnrollmentRecipientSource, setCreateEnrollmentRecipientSource] = useState<'snapshot' | 'manual'>('manual')
  const [createEnrollmentSubmitting, setCreateEnrollmentSubmitting] = useState(false)
  const [lastCreatedEnrollment, setLastCreatedEnrollment] = useState<{ id: string; recipientCount?: number } | null>(null)
  const { isOpen: isRecipientsModalOpen, onOpen: onRecipientsModalOpen, onClose: onRecipientsModalClose } = useDisclosure()
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string | null>(null)
  const [selectedEnrollment, setSelectedEnrollment] = useState<{
    id: string
    name: string | null
    status: string
    recipients?: { email: string }[]
  } | null>(null)
  const [recipientsLoading, setRecipientsLoading] = useState(false)
  const [recipientsError, setRecipientsError] = useState<string | null>(null)
  const { isOpen: isDryRunOpen, onOpen: onDryRunOpen, onClose: onDryRunClose } = useDisclosure()
  const [dryRunEnrollmentId, setDryRunEnrollmentId] = useState<string | null>(null)
  const [dryRunLoading, setDryRunLoading] = useState(false)
  const [dryRunError, setDryRunError] = useState<string | null>(null)
  const [dryRunData, setDryRunData] = useState<{
    enrollmentId: string
    plannedAt: string
    items: Array<{
      recipientId: string
      email: string
      stepOrder: number
      status: 'WouldSend' | 'Skipped'
      templateId?: string
      identityId?: string
      suppressionResult?: string
      reason?: string
    }>
  } | null>(null)
  const { isOpen: isAuditOpen, onOpen: onAuditOpen, onClose: onAuditClose } = useDisclosure()
  const [auditEnrollmentId, setAuditEnrollmentId] = useState<string | null>(null)
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditError, setAuditError] = useState<string | null>(null)
  const [auditData, setAuditData] = useState<{
    enrollmentId: string
    entries: Array<{ id: string; eventType: string; timestamp: string; customerId: string; payload: Record<string, unknown> }>
  } | null>(null)
  const { isOpen: isQueueOpen, onOpen: onQueueOpen, onClose: onQueueClose } = useDisclosure()
  const { isOpen: isAuditPanelOpen, onOpen: onAuditPanelOpen, onClose: onAuditPanelClose } = useDisclosure({ defaultIsOpen: false })
  const { isOpen: isQueuePreviewPanelOpen, onOpen: onQueuePreviewPanelOpen, onClose: onQueuePreviewPanelClose } = useDisclosure({ defaultIsOpen: false })
  const {
    isOpen: isOperatorConsolePanelOpen,
    onOpen: onOperatorConsolePanelOpen,
    onClose: onOperatorConsolePanelClose,
  } = useDisclosure({ defaultIsOpen: true })
  const [queueEnrollmentId, setQueueEnrollmentId] = useState<string | null>(null)
  const [queueLoading, setQueueLoading] = useState(false)
  const [queueRefreshing, setQueueRefreshing] = useState(false)
  const [queueError, setQueueError] = useState<string | null>(null)
  const [queueData, setQueueData] = useState<{
    enrollmentId: string
    items: Array<{
      id?: string
      recipientEmail?: string
      stepIndex?: number
      status?: string
      attemptCount?: number
      lastError?: string | null
      createdAt?: string
      scheduledFor?: string | null
      sentAt?: string | null
    }>
    countsByStatus?: Record<string, number>
  } | null>(null)
  const [queueActionId, setQueueActionId] = useState<string | null>(null)
  const [queueOperatorActionId, setQueueOperatorActionId] = useState<string | null>(null)
  const [queueTickLoading, setQueueTickLoading] = useState(false)

  // Send Queue Preview (dry-run, read-only)
  type SendQueuePreviewItem = {
    id: string
    enrollmentId: string
    stepIndex: number
    scheduledFor: string | null
    status: string
    action: 'WAIT' | 'SKIP' | 'SEND'
    reasons: string[]
    reasonDetails?: string[]
    recipientEmail?: string
  }
  type SendQueuePreviewSummary = {
    totalReturned: number
    countsByAction: { SEND: number; WAIT: number; SKIP: number }
    countsByReason: Record<string, number>
  }
  type OperatorConsoleSampleRow = {
    queueItemId: string
    enrollmentId: string
    recipientEmail: string
    status: string
    scheduledFor: string | null
    lastError: string | null
  }
  type OperatorConsoleData = {
    lastUpdatedAt?: string
    status: {
      scheduledEngineMode: string
      scheduledEnabled: boolean
      scheduledLiveAllowed: boolean
      scheduledLiveReason?: string | null
      liveGateReasons?: string[]
      manualLiveTickAllowed?: boolean
      manualLiveTickReason?: string | null
      activeIdentityCount?: number
      dueNowCount?: number
      cron: string
      canaryCustomerIdPresent: boolean
      liveSendCap: number
    }
    queue: {
      totalQueued: number
      readyNow: number
      scheduledLater: number
      suppressed: number
      replyStopped: number
      failedRecently: number
      sentRecently: number
      blocked: number
    }
    recent: {
      windowHours: number
      total?: number
      counts: Record<string, number>
    }
    samples: {
      readyNow: OperatorConsoleSampleRow[]
      failedRecently: OperatorConsoleSampleRow[]
      blocked: OperatorConsoleSampleRow[]
    }
  }
  type SendQueuePreviewResponse = { items: SendQueuePreviewItem[]; summary?: SendQueuePreviewSummary }
  const [queuePreviewLimit, setQueuePreviewLimit] = useState(20)
  const [queuePreviewEnrollmentId, setQueuePreviewEnrollmentId] = useState('')
  const [queuePreviewData, setQueuePreviewData] = useState<SendQueuePreviewItem[] | null>(null)
  const [queuePreviewError, setQueuePreviewError] = useState<string | null>(null)
  const [queuePreviewLoading, setQueuePreviewLoading] = useState(false)
  const [queuePreviewLastEndpoint, setQueuePreviewLastEndpoint] = useState<string>('')
  const [queuePreviewSummary, setQueuePreviewSummary] = useState<SendQueuePreviewSummary | null>(null)
  const [operatorConsoleData, setOperatorConsoleData] = useState<OperatorConsoleData | null>(null)
  const [operatorConsoleLoading, setOperatorConsoleLoading] = useState(false)
  const [operatorConsoleError, setOperatorConsoleError] = useState<string | null>(null)
  const [operatorConsoleSinceHours, setOperatorConsoleSinceHours] = useState<number>(24)
  const [operatorConsoleLastUpdatedAt, setOperatorConsoleLastUpdatedAt] = useState<string | null>(null)
  const [operatorActionStatus, setOperatorActionStatus] = useState<string | null>(null)
  const [liveCanaryTickLoading, setLiveCanaryTickLoading] = useState(false)

  // drill-down from preview row to enrollment queue
  const [queueDrillOpen, setQueueDrillOpen] = useState(false)
  const [queueDrillEnrollmentId, setQueueDrillEnrollmentId] = useState<string>('')
  const [queueDrillLoading, setQueueDrillLoading] = useState(false)
  const [queueDrillError, setQueueDrillError] = useState<string | null>(null)
  const [queueDrillData, setQueueDrillData] = useState<unknown>(null)
  // dry-run render preview (read-only)
  const [renderLoading, setRenderLoading] = useState(false)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [renderData, setRenderData] = useState<{ subject: string; bodyHtml: string; stepIndex: number; enrollmentId: string; queueItemId?: string; recipientEmail?: string } | null>(null)
  const [renderViewMode, setRenderViewMode] = useState<'code' | 'rendered'>('code')
  // admin secret for retry/skip (local only, sessionStorage)
  const [adminSecret, setAdminSecret] = useState<string>(() => {
    if (typeof sessionStorage === 'undefined') return ''
    return sessionStorage.getItem('odcrm_admin_secret') ?? ''
  })
  // queue item detail (read-only)
  const [queueItemDetail, setQueueItemDetail] = useState<{ id: string; status: string; scheduledFor: string | null; sentAt: string | null; attemptCount: number; lastError: string | null } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  // Send Queue drawer per-row detail (read-only)
  const [queueDrawerDetail, setQueueDrawerDetail] = useState<{ id: string; status: string; scheduledFor: string | null; sentAt: string | null; attemptCount: number; lastError: string | null } | null>(null)
  const [queueDrawerDetailLoading, setQueueDrawerDetailLoading] = useState(false)
  const [queueDrawerDetailError, setQueueDrawerDetailError] = useState<string | null>(null)
  const [dryRunWorkerLoading, setDryRunWorkerLoading] = useState(false)

  // dry-run audit viewer (read-only)
  const [auditItems, setAuditItems] = useState<Array<{ id: string; decidedAt: string; decision: string; reason: string | null; queueItemId: string; snapshot?: unknown }>>([])
  const [auditViewerLoading, setAuditViewerLoading] = useState(false)
  const [auditViewerError, setAuditViewerError] = useState<string | null>(null)
  const [auditNextCursor, setAuditNextCursor] = useState<string | null>(null)
  const [auditQueueItemIdFilter, setAuditQueueItemIdFilter] = useState('')
  const [auditDecisionFilter, setAuditDecisionFilter] = useState<string>('all')
  const [auditSummary, setAuditSummary] = useState<{ total: number; byDecision: Record<string, number>; sinceHours?: number } | null>(null)
  const auditSummarySinceHours = 24

  function parseRecipientEmails(raw: string): string[] {
    const split = raw.split(/[\n,;\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean)
    const unique = Array.from(new Set(split))
    return unique.filter((email) => email.includes('@') && email.includes('.', email.indexOf('@')))
  }

  const loadSendQueuePreview = async () => {
    if (!selectedCustomerId?.startsWith('cust_')) return
    setQueuePreviewLoading(true)
    setQueuePreviewError(null)
    const limit = Math.min(100, Math.max(1, queuePreviewLimit))
    const params = new URLSearchParams()
    params.set('limit', String(limit))
    if (queuePreviewEnrollmentId.trim()) params.set('enrollmentId', queuePreviewEnrollmentId.trim())
    const qs = params.toString()
    const endpoint = `/api/send-queue/preview${qs ? `?${qs}` : ''}`
    setQueuePreviewLastEndpoint(endpoint)
    const res = await api.get<SendQueuePreviewResponse>(endpoint, { headers: { 'X-Customer-Id': selectedCustomerId } })
    setQueuePreviewLoading(false)
    if (res.error) {
      const status = res.errorDetails?.status
      if (status === 400) setQueuePreviewError('Select a client.')
      else if (status === 401 || status === 403) setQueuePreviewError(`Not authorized. Preview requires you to be signed in. (${status})`)
      else setQueuePreviewError(`${res.error}${res.errorDetails?.details ? ` — ${String(res.errorDetails.details).slice(0, 200)}` : ''}`)
      setQueuePreviewData(null)
      setQueuePreviewSummary(null)
      return
    }
    const items = res.data?.items ?? []
    setQueuePreviewData(Array.isArray(items) ? items : [])
    setQueuePreviewSummary(res.data?.summary ?? null)
    setQueuePreviewError(null)
  }

  const loadOperatorConsole = async (opts?: { silent?: boolean }) => {
    if (!selectedCustomerId?.startsWith('cust_')) return
    if (!opts?.silent) setOperatorConsoleLoading(true)
    setOperatorConsoleError(null)
    const hours = Math.min(168, Math.max(1, operatorConsoleSinceHours || 24))
    const endpoint = `/api/send-worker/console?sinceHours=${hours}`
    const res = await api.get<OperatorConsoleData>(endpoint, {
      headers: { 'X-Customer-Id': selectedCustomerId },
    })
    if (!opts?.silent) setOperatorConsoleLoading(false)
    if (res.error) {
      const status = res.errorDetails?.status
      if (status === 400) setOperatorConsoleError('Select a client.')
      else if (status === 401 || status === 403) setOperatorConsoleError(`Not authorized (${status}).`)
      else setOperatorConsoleError(`${res.error}${res.errorDetails?.details ? ` — ${String(res.errorDetails.details).slice(0, 200)}` : ''}`)
      setOperatorConsoleData(null)
      return
    }
    setOperatorConsoleData(res.data ?? null)
    const refreshedAt = res.data?.lastUpdatedAt ?? new Date().toISOString()
    setOperatorConsoleLastUpdatedAt(refreshedAt)
    setOperatorConsoleError(null)
  }

  const refreshControlLoopTruth = async (opts?: { silent?: boolean }) => {
    await loadOperatorConsole(opts)
    loadAuditSummary()
    loadAudits()
    loadSendQueuePreview()
    if (queueEnrollmentId) {
      loadQueue(queueEnrollmentId)
    }
  }

  function maskEmail(email: string): string {
    const t = email.trim()
    if (!t) return '—'
    const at = t.indexOf('@')
    if (at <= 0) return '***'
    const local = t.slice(0, at)
    const domain = t.slice(at)
    if (local.length <= 2) return '***' + domain
    return local.slice(0, 1) + '***' + domain
  }

  const queuePreviewApiBase = (import.meta.env.VITE_API_URL?.toString().replace(/\/$/, '') || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').trim()

  const handleCopyPreviewCurl = () => {
    if (!selectedCustomerId?.startsWith('cust_')) return
    const path = queuePreviewLastEndpoint || '/api/send-queue/preview?limit=20'
    const url = `${queuePreviewApiBase}${path.startsWith('/') ? path : `/${path}`}`
    const curl = `curl -s -H "X-Customer-Id: ${selectedCustomerId}" "${url}"`
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(curl).then(
        () => toast({ title: 'Copied curl to clipboard', status: 'success', duration: 2000 }),
        () => toast({ title: 'Could not copy', description: curl.length > 200 ? curl.slice(0, 200) + '...' : curl, status: 'warning', duration: 5000 })
      )
    } else {
      toast({ title: 'Could not copy', description: curl.length > 200 ? curl.slice(0, 200) + '...' : curl, status: 'warning', duration: 5000 })
    }
  }

  const dryRunActionDisabledReason =
    !selectedCustomerId?.startsWith('cust_')
      ? 'Select a client.'
      : !adminSecret
        ? 'Admin secret required.'
        : null

  const liveCanaryActionDisabledReason =
    !selectedCustomerId?.startsWith('cust_')
      ? 'Select a client.'
      : !adminSecret
        ? 'Admin secret required.'
        : !operatorConsoleData?.status.manualLiveTickAllowed
          ? operatorConsoleData?.status.manualLiveTickReason || operatorConsoleData?.status.scheduledLiveReason || 'Live canary tick is blocked by current gates.'
          : null

  const loadEnrollmentQueue = async (enrollmentId: string) => {
    if (!selectedCustomerId?.startsWith('cust_') || !enrollmentId) return
    setQueueItemDetail(null)
    setDetailError(null)
    setQueueDrillLoading(true)
    setQueueDrillError(null)
    const res = await api.get<unknown>(`/api/enrollments/${enrollmentId}/queue`, { headers: { 'X-Customer-Id': selectedCustomerId } })
    setQueueDrillLoading(false)
    if (res.error) {
      const status = res.errorDetails?.status
      if (status === 400) setQueueDrillError('Select a client.')
      else if (status === 401 || status === 403) setQueueDrillError('Not authorized.')
      else if (status === 404) setQueueDrillError('Queue endpoint not available for this enrollment.')
      else setQueueDrillError(`${res.error}${res.errorDetails?.details ? ` — ${String(res.errorDetails.details).slice(0, 200)}` : ''}`)
      setQueueDrillData(null)
      return
    }
    setQueueDrillData(res.data ?? null)
    setQueueDrillError(null)
  }

  const loadAudits = async (cursor?: string | null) => {
    if (!selectedCustomerId?.startsWith('cust_')) return
    if (!cursor) {
      setAuditViewerLoading(true)
      setAuditError(null)
      setAuditItems([])
      setAuditNextCursor(null)
    }
    const params = new URLSearchParams()
    params.set('limit', '50')
    if (auditQueueItemIdFilter.trim()) params.set('queueItemId', auditQueueItemIdFilter.trim())
    if (auditDecisionFilter && auditDecisionFilter !== 'all') params.set('decision', auditDecisionFilter)
    if (cursor) params.set('cursor', cursor)
    const res = await api.get<{ success: boolean; data?: { items: Array<{ id: string; decidedAt: string; decision: string; reason: string | null; queueItemId: string; snapshot?: unknown }>; nextCursor?: string | null } }>(
      `/api/send-worker/audits?${params.toString()}`,
      { headers: { 'X-Customer-Id': selectedCustomerId } }
    )
    if (!cursor) setAuditViewerLoading(false)
    if (res.error) {
      setAuditViewerError(res.error + (res.errorDetails?.status ? ` (${res.errorDetails.status})` : ''))
      if (!cursor) setAuditItems([])
      return
    }
    const items = res.data?.data?.items ?? []
    const next = res.data?.data?.nextCursor ?? null
    if (cursor) {
      setAuditItems((prev) => [...prev, ...items])
    } else {
      setAuditItems(items)
    }
    setAuditNextCursor(next)
    setAuditViewerError(null)
  }

  const loadAuditsMore = () => {
    if (auditNextCursor) loadAudits(auditNextCursor)
  }

  const loadAuditSummary = async () => {
    if (!selectedCustomerId?.startsWith('cust_')) return
    const params = new URLSearchParams()
    params.set('sinceHours', String(auditSummarySinceHours))
    if (auditQueueItemIdFilter.trim()) params.set('queueItemId', auditQueueItemIdFilter.trim())
    if (auditDecisionFilter && auditDecisionFilter !== 'all') params.set('decision', auditDecisionFilter)
    const res = await api.get<{ success: boolean; data?: { sinceHours: number; total: number; byDecision: Record<string, number> } }>(
      `/api/send-worker/audits/summary?${params.toString()}`,
      { headers: { 'X-Customer-Id': selectedCustomerId } }
    )
    if (res.error) {
      setAuditSummary(null)
      return
    }
    const d = res.data?.data
    setAuditSummary(d ? { total: d.total, byDecision: d.byDecision ?? {}, sinceHours: d.sinceHours } : null)
  }

  const handleExportAuditCsv = () => {
    if (!selectedCustomerId?.startsWith('cust_')) return
    const params = new URLSearchParams()
    params.set('sinceHours', String(auditSummarySinceHours))
    if (auditQueueItemIdFilter.trim()) params.set('queueItemId', auditQueueItemIdFilter.trim())
    if (auditDecisionFilter && auditDecisionFilter !== 'all') params.set('decision', auditDecisionFilter)
    const base = (import.meta.env.VITE_API_URL ?? '').toString().replace(/\/$/, '')
    const path = `/api/send-worker/audits.csv?${params.toString()}`
    const url = base ? `${base}${path}` : path
    fetch(url, { headers: { 'X-Customer-Id': selectedCustomerId } })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.blob()
      })
      .then((blob) => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = 'send_attempt_audits.csv'
        a.click()
        URL.revokeObjectURL(a.href)
        toast({ title: 'CSV downloaded', status: 'success', duration: 2000 })
      })
      .catch(() => toast({ title: 'Export failed', status: 'error' }))
  }

  useEffect(() => {
    if (isAuditPanelOpen && selectedCustomerId?.startsWith('cust_')) {
      loadAuditSummary()
    }
  }, [isAuditPanelOpen, selectedCustomerId, auditQueueItemIdFilter, auditDecisionFilter])

  useEffect(() => {
    if (!isQueuePreviewPanelOpen) return
    if (!selectedCustomerId?.startsWith('cust_')) return
    loadSendQueuePreview()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: trigger on panel open + tenant only
  }, [isQueuePreviewPanelOpen, selectedCustomerId])

  useEffect(() => {
    if (!isOperatorConsolePanelOpen) return
    if (!selectedCustomerId?.startsWith('cust_')) return
    refreshControlLoopTruth()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: trigger on panel open + tenant + window only
  }, [isOperatorConsolePanelOpen, selectedCustomerId, operatorConsoleSinceHours])

  useEffect(() => {
    if (!isOperatorConsolePanelOpen) return
    if (!selectedCustomerId?.startsWith('cust_')) return
    const timer = setInterval(() => {
      refreshControlLoopTruth({ silent: true })
    }, 30000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- polling should track panel + tenant only
  }, [isOperatorConsolePanelOpen, selectedCustomerId])

  const openQueueDrill = (enrollmentId: string) => {
    setQueueDrillEnrollmentId(enrollmentId)
    setQueueDrillOpen(true)
    setQueueDrillData(null)
    setQueueDrillError(null)
    setQueueItemDetail(null)
    setDetailLoading(false)
    setDetailError(null)
    setRenderLoading(false)
    setRenderError(null)
    setRenderData(null)
    setRenderViewMode('code')
    if (enrollmentId && selectedCustomerId?.startsWith('cust_')) loadEnrollmentQueue(enrollmentId)
  }

  const openAuditPanelForQueueItem = (queueItemId: string) => {
    setAuditQueueItemIdFilter(queueItemId)
    if (!isAuditPanelOpen) onAuditPanelOpen()
    if (selectedCustomerId?.startsWith('cust_')) {
      loadAudits()
      loadAuditSummary()
    }
  }

  useEffect(() => {
    if (selectedCustomerId?.startsWith('cust_')) loadSendQueuePreview()
    else {
      setQueuePreviewData(null)
      setQueuePreviewError(null)
      setQueuePreviewLastEndpoint('')
      setQueuePreviewSummary(null)
      setOperatorConsoleData(null)
      setOperatorConsoleError(null)
      setOperatorConsoleLastUpdatedAt(null)
      setOperatorActionStatus(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load when client changes
  }, [selectedCustomerId])

  const handleCreateEnrollment = async () => {
    if (!editingSequence?.id || !selectedCustomerId?.startsWith('cust_')) return
    if (createEnrollmentRecipientSource === 'snapshot') {
      if (!editingSequence.listId) {
        toast({ title: 'No Leads Snapshot selected', description: 'Select one in Configuration first.', status: 'error' })
        return
      }
      setCreateEnrollmentSubmitting(true)
      try {
        const { data, error } = await api.post<{ data?: { id?: string; enrollmentId?: string; recipientCount?: number; recipientSource?: string } }>(
          `/api/sequences/${editingSequence.id}/enrollments`,
          { name: createEnrollmentName.trim() || undefined, recipientSource: 'snapshot' },
          { headers: { 'X-Customer-Id': selectedCustomerId } }
        )
        if (error) {
          toast({ title: 'Create enrollment failed', description: error, status: 'error' })
          return
        }
        const enrollmentId = data?.data?.id || data?.data?.enrollmentId
        const count = data?.data?.recipientCount ?? 0
        if (enrollmentId) setLastCreatedEnrollment({ id: enrollmentId, recipientCount: count })
        toast({ title: 'Enrollment created', description: count ? `${count} recipients from snapshot.` : undefined, status: 'success' })
        onCreateEnrollmentClose()
        setCreateEnrollmentName('')
        setCreateEnrollmentRecipients('')
        await loadEnrollmentsForSequence(editingSequence.id)
      } finally {
        setCreateEnrollmentSubmitting(false)
      }
      return
    }
    const emails = parseRecipientEmails(createEnrollmentRecipients)
    if (emails.length === 0) {
      toast({ title: 'Invalid or missing recipients', description: 'Enter at least one valid email (e.g. user@example.com).', status: 'error' })
      return
    }
    setCreateEnrollmentSubmitting(true)
    try {
      const { data, error } = await api.post<{ data?: { id?: string; enrollmentId?: string; recipientCount?: number } }>(
        `/api/sequences/${editingSequence.id}/enrollments`,
        { name: createEnrollmentName.trim() || undefined, recipientSource: 'manual', recipients: emails.map((email) => ({ email })) },
        { headers: { 'X-Customer-Id': selectedCustomerId } }
      )
      if (error) {
        toast({ title: 'Create enrollment failed', description: error, status: 'error' })
        return
      }
      const enrollmentId = data?.data?.id || data?.data?.enrollmentId
      if (enrollmentId) setLastCreatedEnrollment({ id: enrollmentId, recipientCount: data?.data?.recipientCount ?? emails.length })
      toast({ title: 'Enrollment created', description: `${emails.length} recipients queued for enrollment processing.`, status: 'success' })
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

  useEffect(() => {
    if (isCreateEnrollmentOpen && editingSequence) {
      const useSnapshot = !!editingSequence.listId
      setCreateEnrollmentRecipientSource(useSnapshot ? 'snapshot' : 'manual')
      if (!useSnapshot) setCreateEnrollmentRecipients('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only sync when modal opens or listId changes
  }, [isCreateEnrollmentOpen, editingSequence?.listId])

  const handleEnrollmentPause = async (enrollmentId: string) => {
    if (!selectedCustomerId?.startsWith('cust_') || !editingSequence?.id) return
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
    if (!selectedCustomerId?.startsWith('cust_') || !editingSequence?.id) return
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

  const handleEnrollmentCancel = async (enrollmentId: string) => {
    if (!selectedCustomerId?.startsWith('cust_') || !editingSequence?.id) return
    const confirmed = typeof window !== 'undefined' && window.confirm?.('Cancel this enrollment? This cannot be undone.')
    if (!confirmed) return
    setEnrollmentActionId(enrollmentId)
    try {
      const { error } = await api.post(
        `/api/enrollments/${enrollmentId}/cancel`,
        {},
        { headers: { 'X-Customer-Id': selectedCustomerId } }
      )
      if (error) {
        toast({ title: 'Cancel failed', description: error, status: 'error' })
        return
      }
      toast({ title: 'Enrollment cancelled', status: 'success' })
      await loadEnrollmentsForSequence(editingSequence.id)
    } finally {
      setEnrollmentActionId(null)
    }
  }

  const loadEnrollmentRecipients = async (enrollmentId: string) => {
    if (!selectedCustomerId?.startsWith('cust_')) return
    setRecipientsLoading(true)
    setRecipientsError(null)
    setSelectedEnrollment(null)
    try {
      const { data, error } = await api.get<{
        id: string
        name: string | null
        status: string
        recipients?: { email: string }[]
      }>(`/api/enrollments/${enrollmentId}`, { headers: { 'X-Customer-Id': selectedCustomerId } })
      if (error) {
        setRecipientsError(error)
        toast({ title: 'Failed to load recipients', description: error, status: 'error' })
        return
      }
      setSelectedEnrollment(data ?? null)
    } finally {
      setRecipientsLoading(false)
    }
  }

  const openRecipientsModal = (enrollmentId: string) => {
    setSelectedEnrollmentId(enrollmentId)
    onRecipientsModalOpen()
    loadEnrollmentRecipients(enrollmentId)
  }

  const closeRecipientsModal = () => {
    onRecipientsModalClose()
    setSelectedEnrollmentId(null)
    setSelectedEnrollment(null)
    setRecipientsError(null)
  }

  const runDryRun = async (enrollmentId: string) => {
    if (!selectedCustomerId?.startsWith('cust_')) return
    setDryRunLoading(true)
    setDryRunError(null)
    try {
      const { data, error } = await api.post<{ enrollmentId: string; plannedAt: string; items: unknown[] }>(
        `/api/enrollments/${enrollmentId}/dry-run`,
        {},
        { headers: { 'X-Customer-Id': selectedCustomerId } }
      )
      if (error) {
        setDryRunError(error)
        setDryRunData(null)
        return
      }
      setDryRunData(data ?? null)
    } finally {
      setDryRunLoading(false)
    }
  }

  const openDryRunModal = (enrollmentId: string) => {
    setDryRunEnrollmentId(enrollmentId)
    setDryRunData(null)
    setDryRunError(null)
    onDryRunOpen()
    runDryRun(enrollmentId)
  }

  const closeDryRunModal = () => {
    onDryRunClose()
    setDryRunEnrollmentId(null)
    setDryRunData(null)
    setDryRunError(null)
  }

  const loadAudit = async (enrollmentId: string) => {
    if (!selectedCustomerId?.startsWith('cust_')) return
    setAuditLoading(true)
    setAuditError(null)
    try {
      const { data, error } = await api.get<{ enrollmentId: string; entries: Array<{ id: string; eventType: string; timestamp: string; customerId: string; payload: Record<string, unknown> }> }>(
        `/api/enrollments/${enrollmentId}/audit`,
        { headers: { 'X-Customer-Id': selectedCustomerId } }
      )
      if (error) {
        setAuditError(error)
        setAuditData(null)
        return
      }
      setAuditData(data ?? null)
    } finally {
      setAuditLoading(false)
    }
  }

  const openAuditModal = (enrollmentId: string) => {
    setAuditEnrollmentId(enrollmentId)
    setAuditData(null)
    setAuditError(null)
    onAuditOpen()
    loadAudit(enrollmentId)
  }

  const closeAuditModal = () => {
    onAuditClose()
    setAuditEnrollmentId(null)
    setAuditData(null)
    setAuditError(null)
  }

  const loadQueue = async (enrollmentId: string) => {
    if (!selectedCustomerId?.startsWith('cust_')) return
    setQueueLoading(true)
    setQueueError(null)
    try {
      const res = await api.get<unknown>(
        `/api/enrollments/${enrollmentId}/queue`,
        { headers: { 'X-Customer-Id': selectedCustomerId } }
      )
      if (res.error) {
        setQueueError(typeof res.error === 'string' ? res.error : 'Request failed')
        setQueueData(null)
        return
      }
      const raw = res.data
      const items = Array.isArray(raw) ? raw : []
      const countsByStatus: Record<string, number> = {}
      for (const it of items as Array<{ status?: string }>) {
        const s = it.status ?? 'unknown'
        countsByStatus[s] = (countsByStatus[s] ?? 0) + 1
      }
      setQueueData({ enrollmentId, items, countsByStatus })
    } catch (err) {
      const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Network or parse error'
      setQueueError(msg)
      setQueueData(null)
    } finally {
      setQueueLoading(false)
    }
  }

  const refreshQueue = async (enrollmentId: string) => {
    if (!selectedCustomerId?.startsWith('cust_')) return
    setQueueRefreshing(true)
    setQueueError(null)
    try {
      const res = await api.post<unknown>(
        `/api/enrollments/${enrollmentId}/queue/refresh`,
        {},
        { headers: { 'X-Customer-Id': selectedCustomerId } }
      )
      if (res.error) {
        setQueueError(typeof res.error === 'string' ? res.error : 'Refresh failed')
        return
      }
      await loadQueue(enrollmentId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Network or parse error'
      setQueueError(msg)
    } finally {
      setQueueRefreshing(false)
    }
  }

  const applyQueueOperatorAction = async (
    itemId: string,
    payload: { status?: 'QUEUED' | 'SKIPPED'; sendAt?: string | null; skipReason?: string; operatorNote?: string },
    successTitle: string
  ) => {
    if (!selectedCustomerId?.startsWith('cust_') || !queueEnrollmentId) return
    setQueueOperatorActionId(itemId)
    try {
      const res = await api.patch(`/api/send-queue/items/${itemId}`, payload, { headers: { 'X-Customer-Id': selectedCustomerId } })
      if (res.error) {
        toast({ title: 'Queue action failed', description: `${res.errorDetails?.status ?? ''} ${res.error}`.trim(), status: 'error' })
        return
      }
      toast({ title: successTitle, status: 'success', duration: 2000 })
      await loadQueue(queueEnrollmentId)
    } finally {
      setQueueOperatorActionId(null)
    }
  }

  const handleTickDryRun = async () => {
    if (!selectedCustomerId?.startsWith('cust_') || !adminSecret) return
    setQueueTickLoading(true)
    setOperatorActionStatus('Running dry-run tick...')
    setQueueError(null)
    try {
      const res = await api.post<{ data?: { requeued?: number; locked?: number; scanned?: number; errors?: number } }>(
        '/api/send-queue/tick',
        { customerId: selectedCustomerId, limit: 25, dryRun: true },
        { headers: { 'X-Customer-Id': selectedCustomerId, 'x-admin-secret': adminSecret } }
      )
      if (res.error) {
        toast({ title: 'Tick failed', description: res.error, status: 'error' })
        return
      }
      const d = res.data?.data
      toast({
        title: 'Tick (dry-run) done',
        description: d ? `scanned=${d.scanned ?? 0} locked=${d.locked ?? 0} requeued=${d.requeued ?? 0} errors=${d.errors ?? 0}` : undefined,
        status: 'success',
        duration: 4000,
      })
      await refreshControlLoopTruth()
      setOperatorActionStatus('Dry-run tick complete. Console refreshed from backend truth.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Network error'
      toast({ title: 'Tick failed', description: msg, status: 'error' })
      setOperatorActionStatus(`Dry-run tick failed: ${msg}`)
    } finally {
      setQueueTickLoading(false)
    }
  }

  const handleRunDryRunWorker = async () => {
    if (!selectedCustomerId?.startsWith('cust_') || !adminSecret) return
    setDryRunWorkerLoading(true)
    setOperatorActionStatus('Running dry-run worker...')
    try {
      const res = await api.post<{ success?: boolean; data?: { processedCount?: number; auditsCreated?: number } }>(
        '/api/send-worker/dry-run',
        {},
        { headers: { 'X-Customer-Id': selectedCustomerId, 'x-admin-secret': adminSecret } }
      )
      if (res.error) {
        toast({ title: 'Dry-run worker failed', description: res.error, status: 'error' })
        return
      }
      const d = res.data?.data
      toast({
        title: 'Dry-run worker done',
        description: d ? `processed=${d.processedCount ?? 0} audits=${d.auditsCreated ?? 0}` : undefined,
        status: 'success',
        duration: 4000,
      })
      await refreshControlLoopTruth()
      setOperatorActionStatus('Dry-run worker complete. Console refreshed from backend truth.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Network error'
      toast({ title: 'Dry-run worker failed', description: msg, status: 'error' })
      setOperatorActionStatus(`Dry-run worker failed: ${msg}`)
    } finally {
      setDryRunWorkerLoading(false)
    }
  }

  const handleRunLiveCanaryTick = async () => {
    if (!selectedCustomerId?.startsWith('cust_') || !adminSecret) return
    setLiveCanaryTickLoading(true)
    setOperatorActionStatus('Running live canary tick...')
    try {
      const cap = operatorConsoleData?.status.liveSendCap ?? 1
      const res = await api.post<{ success?: boolean; data?: { processed?: number; sent?: number; failed?: number; skipped?: number; reasons?: Record<string, number> } }>(
        '/api/send-worker/live-tick',
        { limit: Math.min(5, Math.max(1, cap)) },
        { headers: { 'X-Customer-Id': selectedCustomerId, 'x-admin-secret': adminSecret } }
      )
      if (res.error) {
        const msg = `${res.errorDetails?.status ?? ''} ${res.error}`.trim()
        toast({ title: 'Live canary tick failed', description: msg, status: 'error' })
        setOperatorActionStatus(`Live canary tick failed: ${msg}`)
        return
      }
      const d = res.data?.data
      toast({
        title: 'Live canary tick done',
        description: d ? `processed=${d.processed ?? 0} sent=${d.sent ?? 0} failed=${d.failed ?? 0} skipped=${d.skipped ?? 0}` : undefined,
        status: 'success',
        duration: 4500,
      })
      await refreshControlLoopTruth()
      setOperatorActionStatus('Live canary tick complete. Console refreshed from backend truth.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Network error'
      toast({ title: 'Live canary tick failed', description: msg, status: 'error' })
      setOperatorActionStatus(`Live canary tick failed: ${msg}`)
    } finally {
      setLiveCanaryTickLoading(false)
    }
  }

  const openQueueModal = (enrollmentId: string) => {
    setQueueEnrollmentId(enrollmentId)
    setQueueData(null)
    setQueueError(null)
    onQueueOpen()
    loadQueue(enrollmentId)
  }

  const closeQueueModal = () => {
    onQueueClose()
    setQueueEnrollmentId(null)
    setQueueData(null)
    setQueueError(null)
    setQueueDrawerDetail(null)
    setQueueDrawerDetailError(null)
    setQueueDrawerDetailLoading(false)
    setDryRunWorkerLoading(false)
    setQueueTickLoading(false)
  }

  const handleEnqueue = async (enrollmentId: string) => {
    if (!selectedCustomerId?.startsWith('cust_') || !editingSequence?.id) return
    setQueueActionId(enrollmentId)
    try {
      const { data, error } = await api.post<{
        enrollmentId?: string
        totalRecipients?: number
        enqueuedCount?: number
        alreadyQueuedCount?: number
      }>(`/api/enrollments/${enrollmentId}/queue`, {}, { headers: { 'X-Customer-Id': selectedCustomerId } })
      if (error) {
        toast({ title: 'Enqueue failed', description: error, status: 'error' })
        return
      }
      const enqueued = data?.enqueuedCount ?? 0
      const skipped = data?.alreadyQueuedCount ?? 0
      if (skipped > 0) {
        toast({ title: 'Queued', description: `${enqueued} new, ${skipped} already in queue`, status: 'success' })
      } else {
        toast({ title: 'Queued', description: enqueued > 0 ? `${enqueued} item(s) queued` : 'Queued', status: 'success' })
      }
      await loadEnrollmentsForSequence(editingSequence.id)
      openQueueModal(enrollmentId)
    } finally {
      setQueueActionId(null)
    }
  }

  const handleCopyAllRecipients = async () => {
    if (!selectedEnrollment?.recipients?.length) return
    const emails = selectedEnrollment.recipients.map((r) => r.email).filter(Boolean).join('\n')
    try {
      await navigator.clipboard.writeText(emails)
      toast({ title: 'Copied', description: `${selectedEnrollment.recipients.length} email(s) copied to clipboard`, status: 'success' })
    } catch {
      toast({ title: 'Copy failed', status: 'error' })
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

  const toCampaignTemplateSteps = (steps: SequenceStep[]) => {
    return [...steps]
      .sort((a, b) => a.stepOrder - b.stepOrder)
      .map((step) => ({
        stepNumber: step.stepOrder,
        subjectTemplate: step.subjectTemplate,
        bodyTemplateHtml: step.bodyTemplateHtml,
        bodyTemplateText: step.bodyTemplateText || undefined,
        delayDaysMin: step.stepOrder === 1 ? 0 : Math.max(0, step.delayDaysFromPrevious),
        delayDaysMax: step.stepOrder === 1 ? 0 : Math.max(0, step.delayDaysFromPrevious),
      }))
  }

  const campaignStartDefaults = {
    sendWindowHoursStart: 8,
    sendWindowHoursEnd: 18,
    randomizeWithinHours: 4,
    followUpDelayDaysMin: 1,
    followUpDelayDaysMax: 3,
  }

  const ensureCampaignReadyToStart = async (campaignId: string, sequence: SequenceCampaign, headers: Record<string, string>) => {
    const res = await api.patch(`/api/campaigns/${campaignId}`, {
      name: sequence.name.trim(),
      description: sequence.description?.trim() || undefined,
      listId: sequence.listId || undefined,
      senderIdentityId: sequence.senderIdentityId || undefined,
      sequenceId: sequence.sequenceId || undefined,
      ...campaignStartDefaults,
    }, { headers })
    if (res.error) {
      throw new Error(res.error)
    }
  }

  const syncCampaignTemplatesFromSequence = async (campaignId: string, sequenceId: string, headers: Record<string, string>) => {
    const verifyRes = await api.get<SequenceDetail>(`/api/sequences/${sequenceId}`, { headers })
    if (verifyRes.error || !verifyRes.data || !Array.isArray(verifyRes.data.steps) || verifyRes.data.steps.length === 0) {
      throw new Error('Sequence has no steps. Save draft again.')
    }
    const sequenceSteps: SequenceStep[] = verifyRes.data.steps.map((step) => ({
      stepOrder: step.stepOrder,
      delayDaysFromPrevious: step.delayDaysFromPrevious || 0,
      subjectTemplate: step.subjectTemplate || '',
      bodyTemplateHtml: step.bodyTemplateHtml || '',
      bodyTemplateText: step.bodyTemplateText || '',
    }))
    const invalidStep = sequenceSteps.find((step) => !step.subjectTemplate.trim() || !step.bodyTemplateHtml.trim())
    if (invalidStep) {
      throw new Error(`Step ${invalidStep.stepOrder} is incomplete. Add subject and body before starting.`)
    }
    const templatesRes = await api.post(`/api/campaigns/${campaignId}/templates`, {
      steps: toCampaignTemplateSteps(sequenceSteps),
    }, { headers })
    if (templatesRes.error) {
      throw new Error(templatesRes.error)
    }
    return sequenceSteps
  }


  const handleSaveDraft = async () => {
    if (!editingSequence) return
    const validationErrors = getSequenceDraftValidationErrors(editingSequence)
    if (validationErrors.length > 0) {
      toast({
        title: 'Fix sequence validation errors',
        description: validationErrors[0],
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
    if (senderIdentities.length === 0) return 'No senders available.'
    if (!sequence.senderIdentityId) return 'Select a sender.'
    if (!sequence.sequenceId) return 'Save draft first to generate sequence.'
    if (!sequence.campaignId) return 'Save draft first to create campaign.'
    if (snapshotsError || templatesError || sendersError) return 'Fix the data loading errors first.'
    return null
  }

  const getSequenceDraftValidationErrors = (sequence: SequenceCampaign): string[] => {
    const errors: string[] = []
    if (!sequence.name.trim()) errors.push('Sequence name is required.')
    if (!sequence.senderIdentityId) errors.push('Sender identity is required.')
    if (!Array.isArray(sequence.steps) || sequence.steps.length === 0) errors.push('At least one step is required.')
    for (const step of sequence.steps ?? []) {
      if (!step.templateId) errors.push(`Step ${step.stepOrder}: template is required.`)
      if (!step.subjectTemplate.trim() || !step.bodyTemplateHtml.trim()) {
        errors.push(`Step ${step.stepOrder}: subject and body are required.`)
      }
      const delay = Number(step.delayDaysFromPrevious)
      if (!Number.isFinite(delay) || delay < 0 || delay > MAX_STEP_DELAY_DAYS) {
        errors.push(`Step ${step.stepOrder}: delay must be between 0 and ${MAX_STEP_DELAY_DAYS} days.`)
      }
    }
    return Array.from(new Set(errors))
  }

  const sequenceDraftValidationErrors = editingSequence ? getSequenceDraftValidationErrors(editingSequence) : []
  const canSaveDraft = !!editingSequence && sequenceDraftValidationErrors.length === 0

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
    if (!sender || !sequence.sequenceId || !selectedCustomerId?.startsWith('cust_')) {
      toast({
        title: 'Cannot start sequence',
        description: 'Steps or sender selection is invalid.',
        status: 'error',
        duration: 4000,
      })
      return
    }

    const headers = { 'X-Customer-Id': selectedCustomerId }
    const detailRes = await api.get<SequenceDetail>(`/api/sequences/${sequence.sequenceId}`, { headers })
    if (detailRes.error || !detailRes.data || !Array.isArray(detailRes.data.steps) || detailRes.data.steps.length === 0) {
      toast({
        title: 'Cannot start sequence',
        description: 'Sequence has no steps. Save draft and add at least one step.',
        status: 'error',
        duration: 5000,
      })
      return
    }
    const hydratedSteps: SequenceStep[] = detailRes.data.steps.map((step) => ({
      stepOrder: step.stepOrder,
      delayDaysFromPrevious: step.delayDaysFromPrevious || 0,
      subjectTemplate: step.subjectTemplate || '',
      bodyTemplateHtml: step.bodyTemplateHtml || '',
      bodyTemplateText: step.bodyTemplateText || '',
    }))
    const startCampaign: SequenceCampaign = { ...sequence, steps: hydratedSteps }
    setStartPreviewCampaign(startCampaign)
    setStartPreview({
      snapshot: undefined,
      sender,
      loading: true,
      error: null,
    })
    onStartOpen()

    const listRes = await api.get<{ name?: string; contacts: Array<{ id: string; email: string | null }> }>(`/api/lists/${sequence.listId}`, sequence.listId ? { headers } : undefined)
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

      await ensureCampaignReadyToStart(campaignId, sequence, startHeaders)
      await syncCampaignTemplatesFromSequence(campaignId, sequenceId, startHeaders)

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

      <Card mb={6}>
        <CardBody>
          <Heading
            id="sending-console-panel"
            data-testid="sending-console-panel"
            size="sm"
            mb={3}
            cursor="pointer"
            onClick={isOperatorConsolePanelOpen ? onOperatorConsolePanelClose : onOperatorConsolePanelOpen}
          >
            Sending Console {isOperatorConsolePanelOpen ? '▼' : '▶'}
          </Heading>
          <Collapse in={isOperatorConsolePanelOpen}>
            <VStack align="stretch" spacing={4}>
              <Flex gap={3} flexWrap="wrap" align="center">
                <Button
                  size="sm"
                  leftIcon={<RepeatIcon />}
                  id="sending-console-refresh-btn"
                  data-testid="sending-console-refresh-btn"
                  onClick={() => refreshControlLoopTruth()}
                  isLoading={operatorConsoleLoading}
                  isDisabled={!selectedCustomerId?.startsWith('cust_')}
                >
                  Refresh
                </Button>
                <FormControl width="150px">
                  <FormLabel fontSize="xs" mb={0}>Window (hours)</FormLabel>
                  <Select
                    size="sm"
                    value={operatorConsoleSinceHours}
                    onChange={(e) => setOperatorConsoleSinceHours(Number(e.target.value) || 24)}
                  >
                    <option value={6}>6</option>
                    <option value={24}>24</option>
                    <option value={72}>72</option>
                    <option value={168}>168</option>
                  </Select>
                </FormControl>
                <Text fontSize="xs" color="gray.500">
                  Shared-state console. Actions always refresh from backend truth.
                </Text>
                <Text id="sending-console-last-updated" data-testid="sending-console-last-updated" fontSize="xs" color="gray.500">
                  Last updated: {operatorConsoleLastUpdatedAt ? new Date(operatorConsoleLastUpdatedAt).toLocaleString() : '—'}
                </Text>
              </Flex>

              {operatorConsoleError && (
                <Alert status="error" size="sm">
                  <AlertIcon />
                  <AlertDescription>{operatorConsoleError}</AlertDescription>
                </Alert>
              )}

              {!operatorConsoleLoading && !operatorConsoleError && !operatorConsoleData && (
                <Text fontSize="sm" color="gray.500">No console data yet. Refresh to load queue health.</Text>
              )}

              {operatorConsoleData && (
                <>
                  <Card>
                    <CardBody>
                      <VStack align="stretch" spacing={3}>
                        <Flex gap={3} flexWrap="wrap" align="center">
                          <FormControl maxW="340px">
                            <FormLabel fontSize="xs" mb={1}>Admin secret (local)</FormLabel>
                            <Input
                              type="password"
                              size="sm"
                              placeholder="Required for dry-run/live tick actions"
                              value={adminSecret}
                              onChange={(e) => {
                                const v = e.target.value
                                setAdminSecret(v)
                                try { sessionStorage.setItem('odcrm_admin_secret', v) } catch { /* ignore */ }
                              }}
                            />
                          </FormControl>
                          <Button
                            id="sending-console-run-dry-run-btn"
                            data-testid="sending-console-run-dry-run-btn"
                            size="sm"
                            colorScheme="teal"
                            onClick={handleRunDryRunWorker}
                            isLoading={dryRunWorkerLoading}
                            isDisabled={Boolean(dryRunActionDisabledReason)}
                          >
                            Run Dry-Run Tick
                          </Button>
                          <Button
                            id="sending-console-run-live-canary-btn"
                            data-testid="sending-console-run-live-canary-btn"
                            size="sm"
                            colorScheme="purple"
                            onClick={handleRunLiveCanaryTick}
                            isLoading={liveCanaryTickLoading}
                            isDisabled={Boolean(liveCanaryActionDisabledReason)}
                          >
                            Run Live Canary Tick
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            leftIcon={<ViewIcon />}
                            onClick={() => onAuditPanelOpen()}
                            isDisabled={!selectedCustomerId?.startsWith('cust_')}
                          >
                            Open Audits
                          </Button>
                        </Flex>
                        <VStack align="stretch" spacing={1}>
                          {dryRunActionDisabledReason && (
                            <Text id="sending-console-dryrun-disabled-reason" data-testid="sending-console-dryrun-disabled-reason" fontSize="xs" color="gray.600">
                              Dry-run action unavailable: {dryRunActionDisabledReason}
                            </Text>
                          )}
                          {liveCanaryActionDisabledReason && (
                            <Text id="sending-console-live-disabled-reason" data-testid="sending-console-live-disabled-reason" fontSize="xs" color="orange.600">
                              Live canary action unavailable: {liveCanaryActionDisabledReason}
                            </Text>
                          )}
                          {Array.isArray(operatorConsoleData.status.liveGateReasons) && operatorConsoleData.status.liveGateReasons.length > 0 && (
                            <Text fontSize="xs" color="gray.500">
                              Current gate blockers: {operatorConsoleData.status.liveGateReasons.join(' | ')}
                            </Text>
                          )}
                          <Text id="sending-console-action-status" data-testid="sending-console-action-status" fontSize="xs" color="blue.600">
                            {operatorActionStatus || 'Idle. Use actions, then refresh/inspect samples to verify shared state.'}
                          </Text>
                        </VStack>
                      </VStack>
                    </CardBody>
                  </Card>

                  <SimpleGrid columns={{ base: 2, md: 3, lg: 6 }} spacing={3}>
                    <Card><CardBody py={3}><Stat><StatLabel>Mode</StatLabel><StatNumber fontSize="md">{operatorConsoleData.status.scheduledEngineMode}</StatNumber></Stat></CardBody></Card>
                    <Card><CardBody py={3}><Stat><StatLabel>Scheduled</StatLabel><StatNumber fontSize="md">{operatorConsoleData.status.scheduledEnabled ? 'On' : 'Off'}</StatNumber></Stat></CardBody></Card>
                    <Card><CardBody py={3}><Stat><StatLabel>Live Allowed</StatLabel><StatNumber fontSize="md">{operatorConsoleData.status.scheduledLiveAllowed ? 'Yes' : 'No'}</StatNumber></Stat></CardBody></Card>
                    <Card><CardBody py={3}><Stat><StatLabel>Cron</StatLabel><StatNumber fontSize="sm">{operatorConsoleData.status.cron}</StatNumber></Stat></CardBody></Card>
                    <Card><CardBody py={3}><Stat><StatLabel>Canary</StatLabel><StatNumber fontSize="md">{operatorConsoleData.status.canaryCustomerIdPresent ? 'Set' : 'Missing'}</StatNumber></Stat></CardBody></Card>
                    <Card><CardBody py={3}><Stat><StatLabel>Live Cap</StatLabel><StatNumber fontSize="md">{operatorConsoleData.status.liveSendCap}</StatNumber></Stat></CardBody></Card>
                  </SimpleGrid>
                  <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
                    <Card><CardBody py={3}><Stat><StatLabel>Due now</StatLabel><StatNumber>{operatorConsoleData.status.dueNowCount ?? 0}</StatNumber></Stat></CardBody></Card>
                    <Card><CardBody py={3}><Stat><StatLabel>Active identities</StatLabel><StatNumber>{operatorConsoleData.status.activeIdentityCount ?? 0}</StatNumber></Stat></CardBody></Card>
                    <Card><CardBody py={3}><Stat><StatLabel>Manual live tick</StatLabel><StatNumber fontSize="sm">{operatorConsoleData.status.manualLiveTickAllowed ? 'Allowed' : 'Blocked'}</StatNumber></Stat></CardBody></Card>
                    <Card><CardBody py={3}><Stat><StatLabel>Manual reason</StatLabel><StatNumber fontSize="xs">{operatorConsoleData.status.manualLiveTickReason ?? '—'}</StatNumber></Stat></CardBody></Card>
                  </SimpleGrid>

                  <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
                    <Card><CardBody py={3}><Stat><StatLabel>Total queued</StatLabel><StatNumber>{operatorConsoleData.queue.totalQueued}</StatNumber></Stat></CardBody></Card>
                    <Card><CardBody py={3}><Stat><StatLabel>Ready now</StatLabel><StatNumber>{operatorConsoleData.queue.readyNow}</StatNumber></Stat></CardBody></Card>
                    <Card><CardBody py={3}><Stat><StatLabel>Scheduled later</StatLabel><StatNumber>{operatorConsoleData.queue.scheduledLater}</StatNumber></Stat></CardBody></Card>
                    <Card><CardBody py={3}><Stat><StatLabel>Blocked</StatLabel><StatNumber>{operatorConsoleData.queue.blocked}</StatNumber></Stat></CardBody></Card>
                    <Card><CardBody py={3}><Stat><StatLabel>Suppressed</StatLabel><StatNumber>{operatorConsoleData.queue.suppressed}</StatNumber></Stat></CardBody></Card>
                    <Card><CardBody py={3}><Stat><StatLabel>Reply stopped</StatLabel><StatNumber>{operatorConsoleData.queue.replyStopped}</StatNumber></Stat></CardBody></Card>
                    <Card><CardBody py={3}><Stat><StatLabel>Failed recent</StatLabel><StatNumber>{operatorConsoleData.queue.failedRecently}</StatNumber></Stat></CardBody></Card>
                    <Card><CardBody py={3}><Stat><StatLabel>Sent recent</StatLabel><StatNumber>{operatorConsoleData.queue.sentRecently}</StatNumber></Stat></CardBody></Card>
                  </SimpleGrid>

                  <Card>
                    <CardBody>
                      <Text fontSize="sm" fontWeight="semibold" mb={2}>
                        Recent outcomes ({operatorConsoleData.recent.windowHours}h)
                      </Text>
                      <SimpleGrid columns={{ base: 2, md: 3 }} spacing={2}>
                        {Object.entries(operatorConsoleData.recent.counts).map(([k, v]) => (
                          <HStack key={k} justify="space-between" borderWidth="1px" borderRadius="md" px={2} py={1}>
                            <Text fontSize="xs" color="gray.600">{k}</Text>
                            <Badge>{v}</Badge>
                          </HStack>
                        ))}
                      </SimpleGrid>
                    </CardBody>
                  </Card>

                  <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={3}>
                    {([
                      ['readyNow', 'Ready now'],
                      ['failedRecently', 'Failed recently'],
                      ['blocked', 'Blocked'],
                    ] as Array<[keyof OperatorConsoleData['samples'], string]>).map(([key, label]) => {
                      const rows = operatorConsoleData.samples[key] ?? []
                      return (
                        <Card key={key}>
                          <CardBody>
                            <Text fontSize="sm" fontWeight="semibold" mb={2}>{label} ({rows.length})</Text>
                            <Box overflowX="auto">
                              <Table size="sm">
                                <Thead>
                                  <Tr>
                                    <Th>Recipient</Th>
                                    <Th>Status</Th>
                                    <Th>Scheduled</Th>
                                    <Th>Actions</Th>
                                  </Tr>
                                </Thead>
                                <Tbody>
                                  {rows.length === 0 ? (
                                    <Tr>
                                      <Td colSpan={4} color="gray.500">No rows.</Td>
                                    </Tr>
                                  ) : rows.map((row) => (
                                    <Tr key={row.queueItemId}>
                                      <Td fontSize="xs">{maskEmail(row.recipientEmail)}</Td>
                                      <Td><Badge size="sm" variant="outline">{row.status}</Badge></Td>
                                      <Td fontSize="xs">{row.scheduledFor ? new Date(row.scheduledFor).toLocaleString() : '—'}</Td>
                                      <Td>
                                        <HStack spacing={1}>
                                          <Button
                                            size="xs"
                                            variant="ghost"
                                            isDisabled={!row.enrollmentId}
                                            onClick={() => openQueueModal(row.enrollmentId)}
                                          >
                                            Queue
                                          </Button>
                                          <Button
                                            size="xs"
                                            variant="ghost"
                                            onClick={() => openAuditPanelForQueueItem(row.queueItemId)}
                                          >
                                            Audit
                                          </Button>
                                        </HStack>
                                      </Td>
                                    </Tr>
                                  ))}
                                </Tbody>
                              </Table>
                            </Box>
                          </CardBody>
                        </Card>
                      )
                    })}
                  </SimpleGrid>
                </>
              )}
            </VStack>
          </Collapse>
        </CardBody>
      </Card>

      <Card mb={6}>
        <CardBody>
          <Heading size="sm" mb={3} cursor="pointer" onClick={isQueuePreviewPanelOpen ? onQueuePreviewPanelClose : onQueuePreviewPanelOpen}>
            Send Queue Preview (Dry Run) {isQueuePreviewPanelOpen ? '▼' : '▶'}
          </Heading>
          <Collapse in={isQueuePreviewPanelOpen}>
            <Box>
          <Flex gap={3} mb={3} flexWrap="wrap" align="center">
            <Button size="sm" onClick={loadSendQueuePreview} isLoading={queuePreviewLoading} isDisabled={!selectedCustomerId}>
              Refresh
            </Button>
            <Button size="sm" variant="outline" onClick={handleCopyPreviewCurl} isDisabled={!selectedCustomerId?.startsWith('cust_')}>
              Copy curl
            </Button>
            <HStack spacing={2}>
              <FormControl width="80px">
                <FormLabel fontSize="xs" mb={0}>Limit</FormLabel>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={queuePreviewLimit}
                  onChange={(e) => setQueuePreviewLimit(Number(e.target.value) || 20)}
                  size="sm"
                />
              </FormControl>
              <FormControl width="200px">
                <FormLabel fontSize="xs" mb={0}>Enrollment ID</FormLabel>
                <Input
                  placeholder="optional"
                  value={queuePreviewEnrollmentId}
                  onChange={(e) => setQueuePreviewEnrollmentId(e.target.value)}
                  size="sm"
                />
              </FormControl>
            </HStack>
          </Flex>
          <Text fontSize="xs" color="gray.500" mb={2}>Details are available in the Send Queue drawer (View queue).</Text>
          {queuePreviewLastEndpoint && (
            <Text fontSize="xs" color="gray.500" mb={1}>Endpoint: {queuePreviewLastEndpoint}</Text>
          )}
          {selectedCustomerId?.startsWith('cust_') && (
            <Text fontSize="xs" color="gray.500" mb={2}>Tenant: {selectedCustomerId}</Text>
          )}
          {queuePreviewError && (
            <Alert status="error" size="sm" mb={3}>
              <AlertIcon />
              <AlertDescription>{queuePreviewError}</AlertDescription>
            </Alert>
          )}
          {queuePreviewSummary && (
            <Box mb={3}>
              <Text fontSize="sm" color="gray.600">Returned: {queuePreviewSummary.totalReturned}</Text>
              <Text fontSize="sm" color="gray.600">
                SEND: {queuePreviewSummary.countsByAction?.SEND ?? 0} · WAIT: {queuePreviewSummary.countsByAction?.WAIT ?? 0} · SKIP: {queuePreviewSummary.countsByAction?.SKIP ?? 0}
              </Text>
              {queuePreviewSummary.countsByReason && Object.keys(queuePreviewSummary.countsByReason).length > 0 && (
                <Text fontSize="xs" color="gray.500" mt={1}>
                  {Object.entries(queuePreviewSummary.countsByReason)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .slice(0, 3)
                    .map(([reason, count]) => `${reason} (${count})`)
                    .join(', ')}
                </Text>
              )}
            </Box>
          )}
          {queuePreviewData && queuePreviewData.length === 0 && !queuePreviewError && (
            <>
              {queuePreviewSummary ? (
                <Text fontSize="sm" color="gray.600">
                  No queue items returned. (Returned: {queuePreviewSummary.totalReturned}; SEND: {queuePreviewSummary.countsByAction?.SEND ?? 0} WAIT: {queuePreviewSummary.countsByAction?.WAIT ?? 0} SKIP: {queuePreviewSummary.countsByAction?.SKIP ?? 0})
                  {queuePreviewSummary.countsByReason && Object.keys(queuePreviewSummary.countsByReason).length > 0
                    ? ' — ' + Object.entries(queuePreviewSummary.countsByReason).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 3).map(([r, c]) => r + ' (' + c + ')').join(', ')
                    : ''}
                </Text>
              ) : (
                <Text fontSize="sm" color="gray.600">No queue items found.</Text>
              )}
            </>
          )}
          {queuePreviewData && queuePreviewData.length > 0 && (
            <Box overflowX="auto">
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>scheduledFor</Th>
                    <Th>recipient</Th>
                    <Th>status</Th>
                    <Th>action</Th>
                    <Th>reasons</Th>
                    <Th w="100px"></Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {queuePreviewData.map((row) => (
                    <Tr key={row.id}>
                      <Td>{row.scheduledFor ?? '—'}</Td>
                      <Td>{maskEmail(row.recipientEmail ?? '')}</Td>
                      <Td>{row.status}</Td>
                      <Td><Badge size="sm">{row.action}</Badge></Td>
                      <Td>
                        {row.reasons?.length ? row.reasons.join(', ') : '—'}
                        {row.reasonDetails?.length ? (
                          <Text fontSize="xs" color="gray.500" mt={1} noOfLines={2}>
                            {row.reasonDetails.map((d) => (d.length > 120 ? d.slice(0, 120) + '…' : d)).join(' · ')}
                          </Text>
                        ) : null}
                      </Td>
                      <Td>
                        <Button size="xs" variant="ghost" onClick={() => openQueueDrill(row.enrollmentId)} isDisabled={!row.enrollmentId}>
                          View queue
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          )}
            </Box>
          </Collapse>

          <Modal isOpen={queueDrillOpen} onClose={() => { setQueueDrillOpen(false); setRenderLoading(false); setRenderError(null); setRenderData(null); setRenderViewMode('code'); setQueueItemDetail(null); setDetailLoading(false); setDetailError(null) }} size="xl">
            <ModalOverlay />
            <ModalContent>
              <ModalHeader>Enrollment Queue</ModalHeader>
              <ModalCloseButton />
              <Text fontSize="sm" color="gray.600" px={6} pb={2}>Enrollment ID: {queueDrillEnrollmentId || '—'}</Text>
              <Box px={6} pb={2}>
                <FormControl>
                  <FormLabel fontSize="sm">Admin secret (local)</FormLabel>
                  <Input
                    type="password"
                    size="sm"
                    placeholder="Enter to enable Retry/Skip"
                    value={adminSecret}
                    onChange={(e) => {
                      const v = e.target.value
                      setAdminSecret(v)
                      try { sessionStorage.setItem('odcrm_admin_secret', v) } catch { /* ignore */ }
                    }}
                  />
                  {!adminSecret && (
                    <FormHelperText fontSize="xs">Enter admin secret to enable actions.</FormHelperText>
                  )}
                </FormControl>
              </Box>
              <ModalBody>
                {queueDrillLoading && (
                  <Flex justify="center" py={6}><Spinner size="lg" /></Flex>
                )}
                {!queueDrillLoading && queueDrillError && (
                  <Alert status="error">
                    <AlertIcon />
                    <AlertDescription>{queueDrillError}</AlertDescription>
                  </Alert>
                )}
                {!queueDrillLoading && !queueDrillError && queueDrillData != null && (
                  <>
                    {Array.isArray(queueDrillData) ? (
                      <Box mb={4}>
                        <Table size="sm" variant="simple">
                          <Thead>
                            <Tr>
                              <Th>stepIndex</Th>
                              <Th>status</Th>
                              <Th>scheduledFor</Th>
                              <Th>recipientEmail</Th>
                              <Th w="120px">actions</Th>
                            </Tr>
                          </Thead>
                          <Tbody>
                            {(queueDrillData as Array<{ id?: string; enrollmentId?: string; stepIndex?: number; status?: string; scheduledFor?: string; recipientEmail?: string; sentAt?: string | null }>).map((item, idx) => {
                              const isSent = item.status === 'SENT' || !!(item.sentAt != null && String(item.sentAt).trim())
                              const actionsDisabled = !selectedCustomerId?.startsWith('cust_') || !adminSecret || isSent
                              return (
                              <Tr key={item.id ?? `row-${idx}`}>
                                <Td>{typeof item.stepIndex === 'number' ? item.stepIndex : '—'}</Td>
                                <Td>{item.status ?? '—'}</Td>
                                <Td>{item.scheduledFor ?? '—'}</Td>
                                <Td fontSize="xs">{item.recipientEmail ?? '—'}</Td>
                                <Td>
                                  <HStack spacing={1} wrap="wrap">
                                    <Button
                                      size="xs"
                                      variant="ghost"
                                      isDisabled={!selectedCustomerId?.startsWith('cust_') || !item.id || detailLoading}
                                      onClick={async () => {
                                        if (!selectedCustomerId?.startsWith('cust_') || !item.id) return
                                        setDetailLoading(true)
                                        setDetailError(null)
                                        setQueueItemDetail(null)
                                        const res = await api.get<{ id: string; status: string; scheduledFor: string | null; sentAt: string | null; attemptCount: number; lastError: string | null }>(`/api/send-queue/items/${item.id}`, { headers: { 'X-Customer-Id': selectedCustomerId } })
                                        setDetailLoading(false)
                                        if (res.error) {
                                          setDetailError(res.error + (res.errorDetails?.status ? ` (${res.errorDetails.status})` : ''))
                                          return
                                        }
                                        if (res.data) setQueueItemDetail(res.data)
                                      }}
                                    >
                                      Details
                                    </Button>
                                    <Button
                                      size="xs"
                                      leftIcon={<EmailIcon />}
                                      onClick={async () => {
                                        if (!selectedCustomerId?.startsWith('cust_') || !item.id) return
                                        setRenderLoading(true)
                                        setRenderError(null)
                                        setRenderData(null)
                                        const res = await api.get<{ queueItemId: string; enrollmentId: string; stepIndex: number; recipientEmail: string; subject: string; bodyHtml: string }>(
                                          `/api/send-queue/items/${item.id}/render`,
                                          { headers: { 'X-Customer-Id': selectedCustomerId } }
                                        )
                                        setRenderLoading(false)
                                        if (res.error) {
                                          setRenderError(res.error + (res.errorDetails?.details ? ` — ${String(res.errorDetails.details).slice(0, 200)}` : ''))
                                          return
                                        }
                                        setRenderData(res.data ? { ...res.data, enrollmentId: res.data.enrollmentId } : null)
                                      }}
                                      isDisabled={renderLoading || !item.id}
                                    >
                                      Preview email
                                    </Button>
                                    <Button
                                      size="xs"
                                      variant="outline"
                                      isDisabled={actionsDisabled || !item.id}
                                      onClick={async () => {
                                        if (!selectedCustomerId?.startsWith('cust_') || !adminSecret || !item.id) return
                                        const res = await api.post<{ ok?: boolean; item?: unknown }>(
                                          `/api/send-queue/items/${item.id}/retry`,
                                          {},
                                          { headers: { 'X-Customer-Id': selectedCustomerId, 'x-admin-secret': adminSecret } }
                                        )
                                        if (res.error) {
                                          toast({ title: 'Retry failed', description: `${res.errorDetails?.status ?? ''} ${res.error ?? ''}`.trim(), status: 'error' })
                                          return
                                        }
                                        toast({ title: 'Queued for retry', status: 'success', duration: 2000 })
                                        if (queueDrillEnrollmentId) loadEnrollmentQueue(queueDrillEnrollmentId)
                                      }}
                                    >
                                      Retry
                                    </Button>
                                    <Button
                                      size="xs"
                                      variant="outline"
                                      isDisabled={actionsDisabled || !item.id}
                                      onClick={async () => {
                                        if (!selectedCustomerId?.startsWith('cust_') || !adminSecret || !item.id) return
                                        const reason = (typeof window !== 'undefined' && window.prompt?.('Skip reason (optional):'))?.trim().slice(0, 200) || 'manual_skip'
                                        const res = await api.post<{ ok?: boolean; item?: unknown }>(
                                          `/api/send-queue/items/${item.id}/skip`,
                                          { reason },
                                          { headers: { 'X-Customer-Id': selectedCustomerId, 'x-admin-secret': adminSecret } }
                                        )
                                        if (res.error) {
                                          toast({ title: 'Skip failed', description: `${res.errorDetails?.status ?? ''} ${res.error ?? ''}`.trim(), status: 'error' })
                                          return
                                        }
                                        toast({ title: 'Item skipped', status: 'success', duration: 2000 })
                                        if (queueDrillEnrollmentId) loadEnrollmentQueue(queueDrillEnrollmentId)
                                      }}
                                    >
                                      Skip
                                    </Button>
                                  </HStack>
                                </Td>
                              </Tr>
                            )})}
                          </Tbody>
                        </Table>
                        {detailLoading && <Flex justify="center" py={2}><Spinner size="sm" /></Flex>}
                        {!detailLoading && detailError && (
                          <Alert status="error" size="sm" mt={2}>
                            <AlertIcon />
                            <AlertDescription>{detailError}</AlertDescription>
                          </Alert>
                        )}
                        {!detailLoading && !detailError && queueItemDetail && (
                          <Box mt={3} p={3} bg="gray.50" borderRadius="md" borderWidth="1px" fontSize="sm">
                            <Text fontWeight="semibold" mb={2}>Item detail</Text>
                            <VStack align="stretch" spacing={1} alignItems="flex-start">
                              <HStack spacing={3}><Text color="gray.600">Status</Text><Text>{queueItemDetail.status ?? '—'}</Text></HStack>
                              <HStack spacing={3}><Text color="gray.600">scheduledFor</Text><Text>{queueItemDetail.scheduledFor ?? '—'}</Text></HStack>
                              <HStack spacing={3}><Text color="gray.600">sentAt</Text><Text>{queueItemDetail.sentAt ?? '—'}</Text></HStack>
                              <HStack spacing={3}><Text color="gray.600">attemptCount</Text><Text>{queueItemDetail.attemptCount ?? 0}</Text></HStack>
                              <Box w="100%">
                                <Text color="gray.600" mb={1}>lastError</Text>
                                <Code as="pre" whiteSpace="pre-wrap" fontSize="xs" display="block" p={2} bg="white" borderRadius="md">
                                  {queueItemDetail.lastError?.trim() || '(none)'}
                                </Code>
                              </Box>
                            </VStack>
                          </Box>
                        )}
                        {selectedCustomerId?.startsWith('cust_') && (
                          <HStack spacing={2} flexWrap="wrap">
                            <Button size="xs" variant="ghost" leftIcon={<CopyIcon />} onClick={() => {
                              const base = (import.meta.env.VITE_API_URL?.toString().replace(/\/$/, '') || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').trim()
                              const itemId = renderData?.queueItemId ?? ''
                              const url = itemId ? `${base}/api/send-queue/items/${itemId}/render` : `${base}/api/send-queue/items/<itemId>/render`
                              const curl = `curl -s -H "X-Customer-Id: ${selectedCustomerId}" "${url}"`
                              if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                                navigator.clipboard.writeText(curl).then(
                                  () => toast({ title: 'Copied render curl', status: 'success', duration: 2000 }),
                                  () => toast({ title: 'Could not copy', description: curl.slice(0, 200), status: 'warning', duration: 5000 })
                                )
                              } else {
                                toast({ title: 'Could not copy', description: curl.slice(0, 200), status: 'warning', duration: 5000 })
                              }
                            }}>
                              Copy render curl
                            </Button>
                            {renderData && (
                              <>
                                <Button size="xs" variant={renderViewMode === 'rendered' ? 'solid' : 'outline'} onClick={() => setRenderViewMode('rendered')}>
                                  View rendered
                                </Button>
                                <Button size="xs" variant={renderViewMode === 'code' ? 'solid' : 'outline'} onClick={() => setRenderViewMode('code')}>
                                  View code
                                </Button>
                              </>
                            )}
                          </HStack>
                        )}
                      </Box>
                    ) : (
                      <Box overflow="auto" maxH="40vh" bg="gray.50" p={3} borderRadius="md">
                        <Code as="pre" whiteSpace="pre-wrap" fontSize="xs" display="block">
                          {JSON.stringify(queueDrillData, null, 2)}
                        </Code>
                      </Box>
                    )}
                    {/* render preview section */}
                    {renderLoading && <Flex justify="center" py={4}><Spinner size="md" /></Flex>}
                    {!renderLoading && renderError && (
                      <Alert status="error" mt={2}>
                        <AlertIcon />
                        <AlertDescription>{renderError}</AlertDescription>
                      </Alert>
                    )}
                    {!renderLoading && !renderError && renderData && (
                      <Box mt={4} p={3} bg="gray.50" borderRadius="md" borderWidth="1px">
                        <Text fontWeight="semibold" mb={2}>Subject</Text>
                        <Code as="pre" whiteSpace="pre-wrap" fontSize="sm" display="block" mb={3}>{renderData.subject || '(empty)'}</Code>
                        <Text fontWeight="semibold" mb={2}>Body (HTML)</Text>
                        {renderViewMode === 'rendered' ? (
                          <Box overflow="auto" maxH="400px" borderWidth="1px" borderRadius="md" bg="white">
                            <iframe
                              title="Rendered email preview"
                              sandbox=""
                              srcDoc={renderData.bodyHtml || ''}
                              style={{ width: '100%', minHeight: '360px', border: 'none', display: 'block' }}
                            />
                          </Box>
                        ) : (
                          <Code as="pre" whiteSpace="pre-wrap" fontSize="xs" display="block" overflow="auto" maxH="300px">{renderData.bodyHtml || '(empty)'}</Code>
                        )}
                      </Box>
                    )}
                  </>
                )}
              </ModalBody>
            </ModalContent>
          </Modal>
        </CardBody>
      </Card>

      <Card mb={6}>
        <CardBody>
          <Heading size="sm" mb={3} cursor="pointer" onClick={isAuditPanelOpen ? onAuditPanelClose : onAuditPanelOpen}>
            Dry-run Audit {isAuditPanelOpen ? '▼' : '▶'}
          </Heading>
          <Collapse in={isAuditPanelOpen}>
            <Box>
              {selectedCustomerId?.startsWith('cust_') && (
                <>
                  <Flex gap={3} mb={3} flexWrap="wrap" align="center">
                    <Input
                      placeholder="queueItemId (optional)"
                      size="sm"
                      maxW="220px"
                      value={auditQueueItemIdFilter}
                      onChange={(e) => setAuditQueueItemIdFilter(e.target.value)}
                    />
                    <Select
                      size="sm"
                      maxW="180px"
                      value={auditDecisionFilter}
                      onChange={(e) => setAuditDecisionFilter(e.target.value)}
                    >
                      <option value="all">all</option>
                      <option value="WOULD_SEND">WOULD_SEND</option>
                      <option value="SKIP_SUPPRESSED">SKIP_SUPPRESSED</option>
                      <option value="SKIP_INVALID">SKIP_INVALID</option>
                      <option value="SKIP_NO_IDENTITY">SKIP_NO_IDENTITY</option>
                    </Select>
                    <Button size="sm" onClick={() => { loadAudits(); loadAuditSummary() }} isLoading={auditViewerLoading} isDisabled={!selectedCustomerId}>
                      Refresh
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleExportAuditCsv} isDisabled={!selectedCustomerId?.startsWith('cust_')}>
                      Export CSV
                    </Button>
                  </Flex>
                  {auditSummary != null && (
                    <Flex gap={2} mb={3} flexWrap="wrap" align="center">
                      <Badge size="sm" colorScheme="gray">Total: {auditSummary.total}</Badge>
                      {Object.keys(auditSummary.byDecision).sort().map((k) => (
                        <Badge key={k} size="sm" variant="outline">{k}: {auditSummary.byDecision[k] ?? 0}</Badge>
                      ))}
                    </Flex>
                  )}
                  {auditViewerError && (
                    <Alert status="error" size="sm" mb={3}>
                      <AlertIcon />
                      <AlertDescription>{auditViewerError}</AlertDescription>
                    </Alert>
                  )}
                  <Box overflowX="auto">
                    <Table size="sm">
                      <Thead>
                        <Tr>
                          <Th>decidedAt</Th>
                          <Th>decision</Th>
                          <Th>reason</Th>
                          <Th>queueItemId</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {auditItems.length === 0 && !auditViewerLoading && (
                          <Tr>
                            <Td colSpan={4} color="gray.500">No audit rows. Run dry-run worker to generate.</Td>
                          </Tr>
                        )}
                        {auditItems.map((row) => (
                          <Tr key={row.id}>
                            <Td fontSize="xs" whiteSpace="nowrap">{row.decidedAt ? new Date(row.decidedAt).toLocaleString() : '—'}</Td>
                            <Td><Badge size="sm">{row.decision}</Badge></Td>
                            <Td maxW="200px" isTruncated title={row.reason ?? undefined}>{row.reason ? (row.reason.length > 60 ? row.reason.slice(0, 60) + '…' : row.reason) : '—'}</Td>
                            <Td>
                              <HStack spacing={1}>
                                <Code fontSize="xs">{row.queueItemId}</Code>
                                <Tooltip label="Copy queueItemId">
                                  <IconButton
                                    aria-label="Copy"
                                    size="xs"
                                    variant="ghost"
                                    icon={<CopyIcon />}
                                    onClick={async () => {
                                      try {
                                        await navigator.clipboard.writeText(row.queueItemId)
                                        toast({ title: 'Copied', status: 'success', duration: 2000 })
                                      } catch { toast({ title: 'Copy failed', status: 'error' }) }
                                    }}
                                  />
                                </Tooltip>
                              </HStack>
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </Box>
                  {auditNextCursor && (
                    <Button size="sm" variant="outline" mt={2} onClick={loadAuditsMore}>
                      Load more
                    </Button>
                  )}
                </>
              )}
              {!selectedCustomerId?.startsWith('cust_') && (
                <Text fontSize="sm" color="gray.500">Select a client to view dry-run audit.</Text>
              )}
            </Box>
          </Collapse>
        </CardBody>
      </Card>

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
                          placeholder={templatesLoading ? 'Loading…' : 'Choose step template'}
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
                  {sequenceDraftValidationErrors.length > 0 && (
                    <Alert status="error" mb={4} borderRadius="md">
                      <AlertIcon />
                      <Box>
                        <AlertTitle fontSize="sm">Validation required before save</AlertTitle>
                        <AlertDescription fontSize="xs">
                          {sequenceDraftValidationErrors[0]}
                        </AlertDescription>
                      </Box>
                    </Alert>
                  )}

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
                      {materializedBatchKey && (
                        <FormHelperText>
                          Preview recipients: {leadBatches.find((b) => b.batchKey === materializedBatchKey)?.count ?? 0}. Enrolling this sequence will generate queue items for these recipients.
                        </FormHelperText>
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
                  <Alert status="info" size="sm" mb={4} borderRadius="md">
                    <AlertIcon />
                    <Box>
                      <AlertTitle fontSize="sm">How this works</AlertTitle>
                      <AlertDescription fontSize="xs">
                        1. Pick a Leads Snapshot in Configuration · 2. Create an Enrollment (a batch run of this sequence) · 3. Use &quot;Preview email&quot; and &quot;Details&quot; in the queue to review what would send
                      </AlertDescription>
                    </Box>
                  </Alert>
                  <Flex justify="space-between" align="center" mb={4}>
                    <Heading size="sm">Enrollments</Heading>
                    <Button size="sm" leftIcon={<AddIcon />} onClick={onCreateEnrollmentOpen}>
                      Create enrollment
                    </Button>
                  </Flex>
                  {lastCreatedEnrollment?.id && (
                    <Alert status="success" mb={4} borderRadius="md">
                      <AlertIcon />
                      <Box flex="1">
                        <AlertTitle fontSize="sm">Enrollment created</AlertTitle>
                        <AlertDescription fontSize="xs">
                          {lastCreatedEnrollment.recipientCount != null ? `${lastCreatedEnrollment.recipientCount} recipients. ` : ''}Open queue items to verify generated sends.
                        </AlertDescription>
                      </Box>
                      <Button size="xs" variant="outline" ml={3} onClick={() => openQueueModal(lastCreatedEnrollment.id)}>
                        View Queue Items
                      </Button>
                    </Alert>
                  )}
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
                                <HStack gap={2} wrap="wrap">
                                  <Button
                                    size="xs"
                                    variant="ghost"
                                    leftIcon={<ViewIcon />}
                                    onClick={() => openRecipientsModal(e.id)}
                                  >
                                    View recipients
                                  </Button>
                                  <Button
                                    size="xs"
                                    variant="ghost"
                                    leftIcon={<RepeatIcon />}
                                    onClick={() => openDryRunModal(e.id)}
                                  >
                                    Dry run
                                  </Button>
                                  <Button
                                    size="xs"
                                    variant="ghost"
                                    leftIcon={<InfoIcon />}
                                    onClick={() => openAuditModal(e.id)}
                                  >
                                    Audit
                                  </Button>
                                  <Button
                                    size="xs"
                                    variant="ghost"
                                    leftIcon={<TimeIcon />}
                                    onClick={() => handleEnqueue(e.id)}
                                    isLoading={queueActionId === e.id}
                                  >
                                    Queue
                                  </Button>
                                  <Button
                                    size="xs"
                                    variant="ghost"
                                    leftIcon={<ViewIcon />}
                                    onClick={() => openQueueModal(e.id)}
                                  >
                                    View queue
                                  </Button>
                                  <Button
                                    size="xs"
                                    variant="outline"
                                    colorScheme="yellow"
                                    isDisabled={!selectedCustomerId?.startsWith('cust_') || (e.status !== 'DRAFT' && e.status !== 'ACTIVE')}
                                    isLoading={enrollmentActionId === e.id}
                                    onClick={() => handleEnrollmentPause(e.id)}
                                  >
                                    Pause
                                  </Button>
                                  <Button
                                    size="xs"
                                    variant="outline"
                                    colorScheme="green"
                                    isDisabled={!selectedCustomerId?.startsWith('cust_') || e.status !== 'PAUSED'}
                                    isLoading={enrollmentActionId === e.id}
                                    onClick={() => handleEnrollmentResume(e.id)}
                                  >
                                    Resume
                                  </Button>
                                  <Button
                                    size="xs"
                                    variant="outline"
                                    colorScheme="red"
                                    isDisabled={!selectedCustomerId?.startsWith('cust_') || (e.status !== 'ACTIVE' && e.status !== 'PAUSED')}
                                    isLoading={enrollmentActionId === e.id}
                                    onClick={() => handleEnrollmentCancel(e.id)}
                                  >
                                    Cancel
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
            <Button variant="outline" onClick={handleSaveDraft} isDisabled={!canSaveDraft}>
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
            <Alert status="info" mb={4} borderRadius="md">
              <AlertIcon />
              <Box>
                <AlertTitle fontSize="sm">Enrollment flow</AlertTitle>
                <AlertDescription fontSize="xs">
                  Step 1: choose source. Step 2: preview recipients. Step 3: create enrollment. Step 4: open queue items.
                </AlertDescription>
              </Box>
            </Alert>
            <FormControl mb={4}>
              <FormLabel>Enrollment name (optional)</FormLabel>
              <Input
                value={createEnrollmentName}
                onChange={(e) => setCreateEnrollmentName(e.target.value)}
                placeholder="e.g. Q1 batch"
              />
            </FormControl>
            <FormControl mb={4} isRequired>
              <FormLabel>Recipients source</FormLabel>
              <RadioGroup
                value={createEnrollmentRecipientSource}
                onChange={(val: 'snapshot' | 'manual') => setCreateEnrollmentRecipientSource(val)}
              >
                <VStack align="stretch" spacing={2}>
                  <Radio value="snapshot">Use Leads Snapshot (recommended)</Radio>
                  <Radio value="manual">Paste emails manually (advanced)</Radio>
                </VStack>
              </RadioGroup>
            </FormControl>
            {createEnrollmentRecipientSource === 'snapshot' ? (
              <Box mb={4}>
                <Alert status="info" borderRadius="md">
                  <AlertIcon />
                  <Box>
                    <AlertTitle fontSize="sm">From Leads Snapshot</AlertTitle>
                    <AlertDescription fontSize="xs">
                      Recipients will be pulled from the selected Leads Snapshot for this sequence.
                    </AlertDescription>
                  </Box>
                </Alert>
                {!editingSequence?.listId && (
                  <Alert status="error" mt={2} borderRadius="md">
                    <AlertIcon />
                    <AlertDescription fontSize="sm">
                      No Leads Snapshot selected for this sequence. Select one in Configuration first, or switch to manual paste.
                    </AlertDescription>
                  </Alert>
                )}
                <FormHelperText mt={2}>
                  Recipient preview: {leadBatches.find((b) => b.batchKey === materializedBatchKey)?.count ?? 0} recipients from the selected snapshot.
                </FormHelperText>
              </Box>
            ) : (
              <FormControl mb={4} isRequired>
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
                <FormHelperText mt={1}>
                  Recipient preview: {parseRecipientEmails(createEnrollmentRecipients).length} valid recipients.
                </FormHelperText>
              </FormControl>
            )}
            <Flex justify="flex-end" gap={2} mt={4}>
              <Button variant="ghost" onClick={onCreateEnrollmentClose} isDisabled={createEnrollmentSubmitting}>
                Cancel
              </Button>
              <Button
                colorScheme="blue"
                onClick={handleCreateEnrollment}
                isLoading={createEnrollmentSubmitting}
                isDisabled={
                  createEnrollmentRecipientSource === 'snapshot'
                    ? !editingSequence?.listId || !selectedCustomerId?.startsWith('cust_')
                    : parseRecipientEmails(createEnrollmentRecipients).length === 0
                }
              >
                Create
              </Button>
            </Flex>
          </ModalBody>
        </ModalContent>
      </Modal>

      <Modal isOpen={isRecipientsModalOpen} onClose={closeRecipientsModal} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Enrollment recipients</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {recipientsLoading ? (
              <Text color="gray.500">Loading…</Text>
            ) : recipientsError ? (
              <Alert status="error">
                <AlertIcon />
                <AlertDescription>{recipientsError}</AlertDescription>
              </Alert>
            ) : selectedEnrollment ? (
              <VStack align="stretch" spacing={4}>
                <Flex align="center" gap={2}>
                  <Text fontWeight="medium">{selectedEnrollment.name || selectedEnrollment.id}</Text>
                  <Badge colorScheme={selectedEnrollment.status === 'ACTIVE' ? 'green' : selectedEnrollment.status === 'PAUSED' ? 'yellow' : 'gray'} size="sm">
                    {selectedEnrollment.status}
                  </Badge>
                </Flex>
                {!selectedEnrollment.recipients?.length ? (
                  <Text color="gray.500" fontSize="sm">No recipients found.</Text>
                ) : (
                  <>
                    <Box overflowY="auto" maxH="300px">
                      <Table size="sm">
                        <Thead>
                          <Tr>
                            <Th>Email</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {selectedEnrollment.recipients.map((r, i) => (
                            <Tr key={r.email ?? i}>
                              <Td fontSize="sm">{r.email || '—'}</Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    </Box>
                    <Button size="sm" leftIcon={<EmailIcon />} onClick={handleCopyAllRecipients}>
                      Copy all
                    </Button>
                  </>
                )}
              </VStack>
            ) : null}
          </ModalBody>
        </ModalContent>
      </Modal>

      <Modal isOpen={isDryRunOpen} onClose={closeDryRunModal} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Dry-run plan</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {dryRunLoading ? (
              <Text color="gray.500">Loading dry-run…</Text>
            ) : dryRunError ? (
              <Alert status="error">
                <AlertIcon />
                <AlertDescription>{dryRunError}</AlertDescription>
              </Alert>
            ) : dryRunData ? (
              <VStack align="stretch" spacing={4}>
                <Flex gap={4} flexWrap="wrap">
                  <Stat size="sm">
                    <StatLabel>Would send</StatLabel>
                    <StatNumber>{dryRunData.items.filter((i) => i.status === 'WouldSend').length}</StatNumber>
                  </Stat>
                  <Stat size="sm">
                    <StatLabel>Skipped</StatLabel>
                    <StatNumber>{dryRunData.items.filter((i) => i.status === 'Skipped').length}</StatNumber>
                  </Stat>
                  <Stat size="sm">
                    <StatLabel>Planned at</StatLabel>
                    <StatHelpText>{new Date(dryRunData.plannedAt).toLocaleString()}</StatHelpText>
                  </Stat>
                </Flex>
                <Box overflowX="auto" maxH="300px">
                  <Table size="sm">
                    <Thead>
                      <Tr>
                        <Th>Email</Th>
                        <Th>Action</Th>
                        <Th>Reason</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {dryRunData.items.map((item) => (
                        <Tr key={item.recipientId}>
                          <Td fontSize="sm">{item.email}</Td>
                          <Td>
                            <Badge colorScheme={item.status === 'WouldSend' ? 'green' : 'yellow'} size="sm">
                              {item.status}
                            </Badge>
                          </Td>
                          <Td fontSize="sm">{item.reason ?? item.suppressionResult ?? '—'}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>
                <Button
                  size="sm"
                  leftIcon={<RepeatIcon />}
                  onClick={() => dryRunEnrollmentId && runDryRun(dryRunEnrollmentId)}
                  isLoading={dryRunLoading}
                >
                  Refresh
                </Button>
              </VStack>
            ) : null}
          </ModalBody>
        </ModalContent>
      </Modal>

      <Modal isOpen={isAuditOpen} onClose={closeAuditModal} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Enrollment audit</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {auditLoading ? (
              <Text color="gray.500">Loading audit…</Text>
            ) : auditError ? (
              <Alert status="error">
                <AlertIcon />
                <AlertDescription>{auditError}</AlertDescription>
              </Alert>
            ) : auditData ? (
              <VStack align="stretch" spacing={4}>
                <Box overflowX="auto" maxH="400px">
                  <Table size="sm">
                    <Thead>
                      <Tr>
                        <Th>Time</Th>
                        <Th>Event</Th>
                        <Th>Details</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {auditData.entries.map((entry) => (
                        <Tr key={entry.id}>
                          <Td fontSize="xs" whiteSpace="nowrap">
                            {new Date(entry.timestamp).toLocaleString()}
                          </Td>
                          <Td>
                            <Badge size="sm" variant="outline">
                              {entry.eventType}
                            </Badge>
                          </Td>
                          <Td fontSize="xs">
                            {Object.keys(entry.payload).length > 0
                              ? JSON.stringify(entry.payload)
                              : '—'}
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>
                <Button
                  size="sm"
                  leftIcon={<RepeatIcon />}
                  onClick={() => auditEnrollmentId && loadAudit(auditEnrollmentId)}
                  isLoading={auditLoading}
                >
                  Refresh
                </Button>
              </VStack>
            ) : null}
          </ModalBody>
        </ModalContent>
      </Modal>

      <Drawer isOpen={isQueueOpen} onClose={closeQueueModal} size="lg" placement="right">
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader>
            <VStack align="stretch" spacing={3}>
              <Text>Send Queue</Text>
              <Flex align="center" gap={2}>
                <Text fontSize="sm" color="gray.600" fontFamily="mono">
                  {queueEnrollmentId ?? '—'}
                </Text>
                {queueEnrollmentId && selectedCustomerId && (
                  <Tooltip label="Copy enrollment ID">
                    <IconButton
                      aria-label="Copy enrollment ID"
                      size="xs"
                      variant="ghost"
                      icon={<CopyIcon />}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(queueEnrollmentId)
                          toast({ title: 'Copied enrollment ID', status: 'success', duration: 2000 })
                        } catch {
                          toast({ title: 'Copy failed', status: 'error' })
                        }
                      }}
                    />
                  </Tooltip>
                )}
              </Flex>
              <FormControl>
                <FormLabel fontSize="sm">Admin secret (local)</FormLabel>
                <Input
                  type="password"
                  size="sm"
                  placeholder="Enter to enable Tick and Run dry-run worker"
                  value={adminSecret}
                  onChange={(e) => {
                    const v = e.target.value
                    setAdminSecret(v)
                    try { sessionStorage.setItem('odcrm_admin_secret', v) } catch { /* ignore */ }
                  }}
                />
                {!adminSecret && (
                  <FormHelperText fontSize="xs">Admin secret required for Tick and Run dry-run worker.</FormHelperText>
                )}
              </FormControl>
            </VStack>
          </DrawerHeader>
          <DrawerBody pb={6}>
            {queueLoading ? (
              <Text color="gray.500">Loading queue…</Text>
            ) : queueError ? (
              <Alert status="error">
                <AlertIcon />
                <AlertDescription>{queueError}</AlertDescription>
              </Alert>
            ) : queueData ? (
              <VStack align="stretch" spacing={4}>
                <Flex gap={2} flexWrap="wrap" align="center">
                  <Button
                    size="sm"
                    leftIcon={<RepeatIcon />}
                    onClick={() => queueEnrollmentId && refreshQueue(queueEnrollmentId)}
                    isLoading={queueRefreshing}
                  >
                    Refresh queue
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={<ViewIcon />}
                    onClick={() => queueEnrollmentId && loadQueue(queueEnrollmentId)}
                    isLoading={queueLoading}
                  >
                    Reload
                  </Button>
                  {isAgencyUI() && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        colorScheme="purple"
                        leftIcon={<TimeIcon />}
                        onClick={handleTickDryRun}
                        isLoading={queueTickLoading}
                        isDisabled={!adminSecret || !selectedCustomerId?.startsWith('cust_')}
                      >
                        Tick (dry-run)
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        colorScheme="teal"
                        onClick={handleRunDryRunWorker}
                        isLoading={dryRunWorkerLoading}
                        isDisabled={!adminSecret || !selectedCustomerId?.startsWith('cust_')}
                      >
                        Run dry-run worker
                      </Button>
                      {!adminSecret && (
                        <Text fontSize="xs" color="gray.500">Admin secret required.</Text>
                      )}
                    </>
                  )}
                </Flex>
                {(() => {
                  const items = Array.isArray(queueData.items) ? queueData.items : []
                  const countsByStatus = queueData.countsByStatus ?? {}
                  const statusOrder = ['QUEUED', 'LOCKED', 'SENT', 'FAILED', 'SKIPPED']
                  return (
                    <>
                      <Flex gap={2} flexWrap="wrap" align="center">
                        {statusOrder.filter((s) => (countsByStatus[s] ?? 0) > 0).map((status) => (
                          <Badge key={status} colorScheme={status === 'SENT' ? 'green' : status === 'FAILED' ? 'red' : 'gray'} size="sm" px={2} py={1}>
                            {status}: {countsByStatus[status] ?? 0}
                          </Badge>
                        ))}
                        {Object.keys(countsByStatus).length === 0 && items.length === 0 && (
                          <Text fontSize="sm" color="gray.500">Queue empty: awaiting generation / schedule.</Text>
                        )}
                      </Flex>
                      <Box overflowX="auto" maxH="280px">
                        <Table size="sm">
                          <Thead>
                            <Tr>
                              <Th>Scheduled</Th>
                              <Th>Status</Th>
                              <Th>Step</Th>
                              <Th>Recipient</Th>
                              <Th>SentAt</Th>
                              <Th>Error</Th>
                              <Th w="80px">Details</Th>
                              <Th w="230px">Operator Actions</Th>
                            </Tr>
                          </Thead>
                          <Tbody>
                            {items.length === 0 ? (
                              <Tr>
                                <Td colSpan={8} color="gray.500">No items yet. Queue empty: awaiting generation / schedule.</Td>
                              </Tr>
                            ) : (
                              items.map((it: { id?: string; scheduledFor?: string | null; status?: string; stepIndex?: number; recipientEmail?: string; sentAt?: string | null; lastError?: string | null }, i: number) => (
                                <Tr key={it.id ?? i}>
                                  <Td fontSize="xs" whiteSpace="nowrap">
                                    {it.scheduledFor ? new Date(it.scheduledFor).toLocaleString() : '—'}
                                  </Td>
                                  <Td>
                                    <Badge size="sm" variant="outline">{it.status ?? '—'}</Badge>
                                  </Td>
                                  <Td>{typeof it.stepIndex === 'number' ? it.stepIndex : '—'}</Td>
                                  <Td fontSize="sm">{it.recipientEmail ?? '—'}</Td>
                                  <Td fontSize="xs" whiteSpace="nowrap">
                                    {it.sentAt ? new Date(it.sentAt).toLocaleString() : '—'}
                                  </Td>
                                  <Td fontSize="xs" maxW="140px" isTruncated title={it.lastError ?? undefined}>
                                    {it.lastError ?? '—'}
                                  </Td>
                                  <Td>
                                    <Button
                                      size="xs"
                                      variant="ghost"
                                      isDisabled={!selectedCustomerId?.startsWith('cust_') || !it.id || queueDrawerDetailLoading}
                                      onClick={async () => {
                                        if (!selectedCustomerId?.startsWith('cust_') || !it.id) return
                                        setQueueDrawerDetailLoading(true)
                                        setQueueDrawerDetailError(null)
                                        setQueueDrawerDetail(null)
                                        const res = await api.get<{ id: string; status: string; scheduledFor: string | null; sentAt: string | null; attemptCount: number; lastError: string | null }>(`/api/send-queue/items/${it.id}`, { headers: { 'X-Customer-Id': selectedCustomerId } })
                                        setQueueDrawerDetailLoading(false)
                                        if (res.error) {
                                          if (res.errorDetails?.status === 404) {
                                            toast({ title: 'Queue item not found', status: 'warning' })
                                            return
                                          }
                                          setQueueDrawerDetailError(res.error + (res.errorDetails?.status ? ` (${res.errorDetails.status})` : ''))
                                          return
                                        }
                                        if (res.data) setQueueDrawerDetail(res.data)
                                      }}
                                    >
                                      Details
                                    </Button>
                                  </Td>
                                  <Td>
                                    <HStack spacing={1}>
                                      <Button
                                        size="xs"
                                        variant="outline"
                                        colorScheme="green"
                                        isDisabled={!it.id || it.status === 'SENT' || queueOperatorActionId === it.id}
                                        isLoading={queueOperatorActionId === it.id}
                                        onClick={() => {
                                          if (!it.id) return
                                          void applyQueueOperatorAction(it.id, { status: 'QUEUED', operatorNote: 'approved_by_operator' }, 'Queue item approved')
                                        }}
                                      >
                                        Approve
                                      </Button>
                                      <Button
                                        size="xs"
                                        variant="outline"
                                        colorScheme="red"
                                        isDisabled={!it.id || it.status === 'SENT' || queueOperatorActionId === it.id}
                                        isLoading={queueOperatorActionId === it.id}
                                        onClick={() => {
                                          if (!it.id) return
                                          const reason = (typeof window !== 'undefined' && window.prompt?.('Skip reason (optional):'))?.trim().slice(0, 200) || 'manual_skip'
                                          void applyQueueOperatorAction(it.id, { status: 'SKIPPED', skipReason: reason }, 'Queue item skipped')
                                        }}
                                      >
                                        Skip
                                      </Button>
                                      <Button
                                        size="xs"
                                        variant="ghost"
                                        isDisabled={!it.id || it.status === 'SENT' || queueOperatorActionId === it.id}
                                        isLoading={queueOperatorActionId === it.id}
                                        onClick={() => {
                                          if (!it.id) return
                                          const sendAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
                                          void applyQueueOperatorAction(it.id, { status: 'QUEUED', sendAt, operatorNote: 'rescheduled_by_operator' }, 'Queue send time updated')
                                        }}
                                      >
                                        Send +15m
                                      </Button>
                                    </HStack>
                                  </Td>
                                </Tr>
                              ))
                            )}
                          </Tbody>
                        </Table>
                      </Box>
                      {queueDrawerDetailLoading && (
                        <Text fontSize="sm" color="gray.500">Loading detail…</Text>
                      )}
                      {queueDrawerDetailError && (
                        <Alert status="error" size="sm">
                          <AlertIcon />
                          <AlertDescription>{queueDrawerDetailError}</AlertDescription>
                        </Alert>
                      )}
                      {queueDrawerDetail && !queueDrawerDetailLoading && (
                        <Box borderWidth="1px" borderRadius="md" p={3} bg="gray.50" _dark={{ bg: 'gray.800' }}>
                          <Text fontSize="sm" fontWeight="semibold" mb={2}>Queue item detail</Text>
                          <VStack align="stretch" spacing={1} fontSize="sm">
                            <Flex justify="space-between"><Text color="gray.600">status</Text><Text fontFamily="mono">{queueDrawerDetail.status}</Text></Flex>
                            <Flex justify="space-between"><Text color="gray.600">scheduledFor</Text><Text fontFamily="mono">{queueDrawerDetail.scheduledFor ?? '—'}</Text></Flex>
                            <Flex justify="space-between"><Text color="gray.600">sentAt</Text><Text fontFamily="mono">{queueDrawerDetail.sentAt ?? '—'}</Text></Flex>
                            <Flex justify="space-between"><Text color="gray.600">attemptCount</Text><Text fontFamily="mono">{queueDrawerDetail.attemptCount ?? '—'}</Text></Flex>
                            <Flex justify="space-between"><Text color="gray.600">lastError</Text><Text fontFamily="mono" fontSize="xs" isTruncated maxW="200px" title={queueDrawerDetail.lastError ?? undefined}>{queueDrawerDetail.lastError ?? '—'}</Text></Flex>
                          </VStack>
                          <Button size="xs" mt={2} variant="ghost" onClick={() => { setQueueDrawerDetail(null); setQueueDrawerDetailError(null) }}>Close</Button>
                        </Box>
                      )}
                      {queueEnrollmentId && selectedCustomerId && (
                        <Box>
                          <Text fontSize="xs" fontWeight="semibold" mb={2}>Copyable curl</Text>
                          <Code display="block" whiteSpace="pre" fontSize="xs" p={2} borderRadius="md" overflowX="auto">
                            {`curl -s -H "X-Customer-Id: ${selectedCustomerId}" \\
  "${import.meta.env.VITE_API_URL?.toString().replace(/\/$/, '') || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net'}/api/enrollments/${queueEnrollmentId}/queue"`}
                          </Code>
                          <Button
                            size="xs"
                            leftIcon={<CopyIcon />}
                            variant="ghost"
                            mt={1}
                            onClick={async () => {
                              const curl = `curl -s -H "X-Customer-Id: ${selectedCustomerId}" "${import.meta.env.VITE_API_URL?.toString().replace(/\/$/, '') || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net'}/api/enrollments/${queueEnrollmentId}/queue"`
                              try {
                                await navigator.clipboard.writeText(curl)
                                toast({ title: 'Copied GET curl', status: 'success', duration: 2000 })
                              } catch {
                                toast({ title: 'Copy failed', status: 'error' })
                              }
                            }}
                          >
                            Copy GET curl
                          </Button>
                          <Code display="block" whiteSpace="pre" fontSize="xs" p={2} borderRadius="md" overflowX="auto" mt={2}>
                            {`curl -s -X POST -H "X-Customer-Id: ${selectedCustomerId}" -H "Content-Type: application/json" \\
  "${import.meta.env.VITE_API_URL?.toString().replace(/\/$/, '') || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net'}/api/enrollments/${queueEnrollmentId}/queue/refresh"`}
                          </Code>
                          <Button
                            size="xs"
                            leftIcon={<CopyIcon />}
                            variant="ghost"
                            mt={1}
                            onClick={async () => {
                              const base = import.meta.env.VITE_API_URL?.toString().replace(/\/$/, '') || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net'
                              const curl = `curl -s -X POST -H "X-Customer-Id: ${selectedCustomerId}" -H "Content-Type: application/json" "${base}/api/enrollments/${queueEnrollmentId}/queue/refresh"`
                              try {
                                await navigator.clipboard.writeText(curl)
                                toast({ title: 'Copied POST refresh curl', status: 'success', duration: 2000 })
                              } catch {
                                toast({ title: 'Copy failed', status: 'error' })
                              }
                            }}
                          >
                            Copy POST refresh curl
                          </Button>
                        </Box>
                      )}
                    </>
                  )
                })()}
              </VStack>
            ) : null}
          </DrawerBody>
        </DrawerContent>
      </Drawer>

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
