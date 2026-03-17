import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  Checkbox,
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
import { useMsal } from '@azure/msal-react'
import { RiSparkling2Line } from 'react-icons/ri'
import { api } from '../../../utils/api'
import { normalizeCustomersListResponse } from '../../../utils/normalizeApiResponse'
import { useScopedCustomerSelection } from '../../../hooks/useCustomerScope'
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

type AITone = 'professional' | 'friendly' | 'casual'
type StepContentSnapshot = {
  subject: string
  content: string
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
  stepCount?: number
  steps?: SequenceStep[]
  isArchived?: boolean
  archivedAt?: string | null
}

type SequenceDeleteErrorDetails = {
  code?: string
  totalCampaigns?: number
  summary?: {
    runningCampaigns?: number
    historicalCampaigns?: number
    linkedDraftCampaigns?: number
  }
  campaigns?: Array<{
    id: string
    name: string
    status?: string | null
    blockerReason?: 'running_campaign' | 'historical_campaign' | 'linked_campaign' | 'disposable_campaign_cleanup_possible'
  }>
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
  recipientSource?: 'manual' | 'snapshot' | null
  sourceListId?: string | null
  sourceListName?: string | null
}

type LinkedListSummary = {
  id: string
  name: string
  contactCount: number
}

type SequenceOperatorStateSummary = {
  label: 'Ready' | 'Running' | 'Paused' | 'Blocked' | 'Completed' | 'Archived'
  colorScheme: 'green' | 'blue' | 'orange' | 'red' | 'purple'
  icon: typeof CheckCircleIcon
  reasonLabel: string
  detail: string
  attentionLabel?: 'Fix now' | 'Waiting'
  attentionColorScheme?: 'red' | 'orange'
  nextActionLabel: 'Start' | 'Resume' | 'Open' | 'Fix blocker'
  nextActionColorScheme: 'green' | 'blue' | 'orange' | 'gray'
  nextActionVariant: 'solid' | 'outline'
}

type SequenceOperatorQuickFilter = 'all' | 'ready' | 'needs_attention' | 'running' | 'archived'
type SequenceEditorFocusTarget = 'details' | 'audience' | 'sender' | 'steps' | 'launch'
type SequenceSendConfidenceSignal = {
  label: 'Mailbox' | 'Audience' | 'Content' | 'Window'
  value: 'Ready' | 'Missing' | 'Blocked' | 'Waiting' | 'Unknown' | 'Empty' | 'Not chosen' | 'Incomplete'
  colorScheme: 'green' | 'red' | 'orange' | 'gray'
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

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const toHtmlBody = (text: string) => {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return '<p></p>'

  return normalized
    .split(/\n\s*\n/)
    .map((paragraph) => `<p>${escapeHtml(paragraph.trim()).replace(/\n/g, '<br/>')}</p>`)
    .join('')
}

const htmlToPlainText = (html: string) => {
  if (!html) return ''

  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const toStepContentSnapshot = (step: SequenceStep): StepContentSnapshot => ({
  subject: step.subjectTemplate || '',
  content: step.bodyTemplateText || htmlToPlainText(step.bodyTemplateHtml || ''),
})

const buildStepSnapshotMap = (steps?: SequenceStep[]) =>
  Object.fromEntries((steps || []).map((step) => [step.stepOrder, toStepContentSnapshot(step)])) as Record<number, StepContentSnapshot>

const LEAD_SOURCES: SnapshotOption['source'][] = ['cognism', 'apollo', 'blackbook']
const MAX_STEP_DELAY_DAYS = 365
const SEQUENCE_DESTRUCTIVE_AUTHORITY_EMAILS = ['greg@opensdoor.co.uk', 'greg@bidlow.co.uk'] as const
const SEQUENCE_DESTRUCTIVE_AUTHORITY_MESSAGE =
  'Delete, archive, and unarchive are restricted to greg@opensdoor.co.uk and greg@bidlow.co.uk.'

function extractSignedInEmail(account: {
  username?: string
  idTokenClaims?: Record<string, unknown>
} | null | undefined): string {
  const claims = (account?.idTokenClaims || {}) as Record<string, unknown>
  const raw =
    claims.preferred_username ||
    claims.email ||
    claims.upn ||
    account?.username ||
    ''
  return String(raw || '').trim().toLowerCase()
}

function hasSequenceDestructiveAuthority(email: string | null | undefined): boolean {
  if (!email) return false
  return SEQUENCE_DESTRUCTIVE_AUTHORITY_EMAILS.includes(email.trim().toLowerCase() as (typeof SEQUENCE_DESTRUCTIVE_AUTHORITY_EMAILS)[number])
}

type Customer = {
  id: string
  name: string
}

const SequencesTab: React.FC = () => {
  const { accounts } = useMsal()
  const [sequences, setSequences] = useState<SequenceCampaign[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const {
    canSelectCustomer,
    customerHeaders,
    customerId: selectedCustomerId,
    setCustomerId: setSelectedCustomerId,
  } = useScopedCustomerSelection()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [snapshots, setSnapshots] = useState<SnapshotOption[]>([])
  const [leadBatches, setLeadBatches] = useState<LeadSourceBatchOption[]>([])
  const [leadBatchesLoading, setLeadBatchesLoading] = useState(false)
  const [materializedBatchKey, setMaterializedBatchKey] = useState<string | null>(null)
  const [senderIdentities, setSenderIdentities] = useState<EmailIdentity[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [operatorQuickFilter, setOperatorQuickFilter] = useState<SequenceOperatorQuickFilter>('all')
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
  const {
    isOpen: isDeleteBlockedOpen,
    onOpen: onDeleteBlockedOpen,
    onClose: onDeleteBlockedClose,
  } = useDisclosure()
  const cancelStartRef = useRef<HTMLButtonElement | null>(null)
  const toast = useToast()
  const signedInUserEmail = useMemo(() => extractSignedInEmail(accounts[0]), [accounts])
  const canManageSequenceDestructiveActions = useMemo(
    () => hasSequenceDestructiveAuthority(signedInUserEmail),
    [signedInUserEmail]
  )
  const includeArchivedInList = operatorQuickFilter === 'archived'
  const [leadSourceSelection, setLeadSourceSelection] = useState(leadSourceSelectionStore.getLeadSourceBatchSelection())
  const { isOpen: isPreviewOpen, onOpen: onPreviewOpen, onClose: onPreviewClose } = useDisclosure()
  const [previewContacts, setPreviewContacts] = useState<Record<string, string>[]>([])
  const [previewColumns, setPreviewColumns] = useState<string[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [enrollments, setEnrollments] = useState<EnrollmentListItem[]>([])
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false)
  const [enrollmentsError, setEnrollmentsError] = useState<string | null>(null)
  const [enrollmentActionId, setEnrollmentActionId] = useState<string | null>(null)
  const [linkedListSummary, setLinkedListSummary] = useState<LinkedListSummary | null>(null)
  const [linkedListSummaryLoading, setLinkedListSummaryLoading] = useState(false)
  const [isSequenceLaunchAdvancedOpen, setIsSequenceLaunchAdvancedOpen] = useState(false)
  const [isSequenceSetupOpen, setIsSequenceSetupOpen] = useState(false)
  const [sequenceEditorFocusTarget, setSequenceEditorFocusTarget] = useState<SequenceEditorFocusTarget | null>(null)
  const [sequenceValidationVisible, setSequenceValidationVisible] = useState(false)
  const [sequenceStepAiLoading, setSequenceStepAiLoading] = useState<Record<number, boolean>>({})
  const [sequenceStepAiError, setSequenceStepAiError] = useState<Record<number, string | null>>({})
  const [sequenceStepAiSuggestion, setSequenceStepAiSuggestion] = useState<Record<number, StepContentSnapshot | null>>({})
  const [sequenceStepOriginals, setSequenceStepOriginals] = useState<Record<number, StepContentSnapshot>>({})
  const sequenceStepsSectionRef = useRef<HTMLDivElement | null>(null)
  const sequenceDetailsSectionRef = useRef<HTMLDivElement | null>(null)
  const sequenceAudienceSectionRef = useRef<HTMLDivElement | null>(null)
  const sequenceSenderSectionRef = useRef<HTMLDivElement | null>(null)
  const sequenceLaunchSectionRef = useRef<HTMLDivElement | null>(null)
  const sequenceNameInputRef = useRef<HTMLInputElement | null>(null)
  const sequenceAudienceSelectRef = useRef<HTMLSelectElement | null>(null)
  const sequenceSenderSelectRef = useRef<HTMLSelectElement | null>(null)
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
  } = useDisclosure({ defaultIsOpen: false })
  const { isOpen: isDiagnosticsOpen, onOpen: onDiagnosticsOpen, onClose: onDiagnosticsClose } = useDisclosure({ defaultIsOpen: false })
  const [deletingSequenceId, setDeletingSequenceId] = useState<string | null>(null)
  const [archiveActionSequenceId, setArchiveActionSequenceId] = useState<string | null>(null)
  const [sequenceDeleteBlockers, setSequenceDeleteBlockers] = useState<{
    sequence: SequenceCampaign
    details: SequenceDeleteErrorDetails
  } | null>(null)
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

  const resetSequenceStepAiState = useCallback(() => {
    setSequenceStepAiLoading({})
    setSequenceStepAiError({})
    setSequenceStepAiSuggestion({})
    setSequenceStepOriginals({})
  }, [])

  const handleCloseSequenceEditor = useCallback(() => {
    resetSequenceStepAiState()
    setSequenceValidationVisible(false)
    setSequenceEditorFocusTarget(null)
    onClose()
  }, [onClose, resetSequenceStepAiState])

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
      manualWindowBypassAllowed?: boolean
      activeIdentityCount?: number
      dueNowCount?: number
      cron: string
      canaryCustomerIdPresent: boolean
      liveSendCap: number
      dryRunTickRoute?: string
      dryRunTickRequiresAdminSecret?: boolean
      liveCanaryTickRoute?: string
      liveCanaryTickRequiresAdminSecret?: boolean
      liveCanaryTickAllowed?: boolean
      liveCanaryTickReason?: string | null
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
  type SequenceReadinessSampleRow = {
    queueItemId: string
    enrollmentId: string
    recipientEmail: string
    status: string
    scheduledFor: string | null
    lastError: string | null
    reason: string
  }
  type SequenceReadinessData = {
    sequenceId: string
    sequenceName?: string | null
    summary: {
      enrollmentCount: number
      totalRecipients: number
      queueItemsTotal: number
      eligibleCount: number
      excludedCount: number
      blockedCount: number
      failedRecently?: number
      sentRecently?: number
    }
    breakdown: Record<string, number>
    samples: {
      eligible: SequenceReadinessSampleRow[]
      excluded: SequenceReadinessSampleRow[]
      blocked: SequenceReadinessSampleRow[]
    }
    windowHours?: number
    lastUpdatedAt?: string
  }
  type SequencePreflightData = {
    sequenceId: string
    sequenceName?: string | null
    overallStatus: 'GO' | 'WARNING' | 'NO_GO'
    blockers: string[]
    warnings: string[]
    checks: Record<string, boolean>
    counts: Record<string, number>
    actions: {
      canDryRun: boolean
      dryRunRoute: string
      dryRunRequiresAdminSecret: boolean
      canLiveCanary: boolean
      liveCanaryRoute: string
      liveCanaryRequiresAdminSecret: boolean
      liveCanaryReason: string | null
      nextSafeAction: string
    }
    dependencies?: {
      leadSources?: { configuredCount?: number; total?: number; erroredCount?: number }
      suppression?: { configuredCount?: number; erroredCount?: number; emailEntries?: number; domainEntries?: number }
      identityCapacity?: {
        summary?: {
          total?: number
          usable?: number
          unavailable?: number
          risky?: number
          preferredIdentityId?: string | null
          preferredIdentityState?: string | null
          recommendedIdentityId?: string | null
        }
      }
      liveGates?: { scheduledEngineMode?: string; manualLiveTickAllowed?: boolean; manualLiveTickReason?: string | null; activeIdentityCount?: number; dueNowCount?: number; cron?: string }
      recent?: { windowHours?: number; counts?: Record<string, number> }
    }
    lastUpdatedAt?: string
  }
  type IdentityCapacityRow = {
    identityId: string
    email: string
    label?: string | null
    provider: string
    isActive: boolean
    state: 'usable' | 'unavailable' | 'risky'
    reasons: string[]
    recent: {
      windowHours: number
      sent: number
      sendFailed: number
      wouldSend: number
      skipped: number
    }
    queuePressure?: {
      queuedNow?: number
    }
    guardrails?: {
      dailySendLimit?: number | null
      sendWindowTimeZone?: string | null
      sendWindowHoursStart?: number | null
      sendWindowHoursEnd?: number | null
    }
  }
  type IdentityCapacityData = {
    sinceHours: number
    summary: {
      total: number
      usable: number
      unavailable: number
      risky: number
      preferredIdentityId?: string | null
      preferredIdentityState?: string | null
      recommendedIdentityId?: string | null
    }
    rows: IdentityCapacityRow[]
    guardrails?: {
      warnings?: string[]
      liveGateReasons?: string[]
    }
    lastUpdatedAt?: string
  }
  type LaunchPreviewRow = {
    queueItemId: string
    enrollmentId: string
    enrollmentName?: string | null
    sequenceId: string
    sequenceName?: string | null
    recipientEmail: string
    identityEmail?: string | null
    status: string
    reason: string
    scheduledFor: string | null
    sentAt?: string | null
    stepIndex: number
    attemptCount: number
    lastError: string | null
    subjectPreview?: string | null
    renderAvailable?: boolean
    renderRoute?: string
    detailRoute?: string
    queueRoute?: string
    auditRoute?: string
  }
  type LaunchPreviewData = {
    sequenceId: string
    sequenceName?: string | null
    batchLimit: number
    summary: {
      eligibleCandidatesTotal: number
      firstBatchCount: number
      excludedCount: number
      blockedCount: number
      notInBatchCount: number
      totalRecipients: number
    }
    firstBatch: LaunchPreviewRow[]
    excluded: LaunchPreviewRow[]
    blocked: LaunchPreviewRow[]
    notInBatch: LaunchPreviewRow[]
    context?: {
      preflightStatus?: string | null
      liveCanaryAllowed?: boolean
      liveCanaryReason?: string | null
      scheduledEngineMode?: string
      dueNowCount?: number
      activeIdentityCount?: number
    }
    lastUpdatedAt?: string
  }
  type RunHistoryRow = {
    auditId: string
    queueItemId: string
    recipientEmail: string | null
    decision: string
    outcome: string
    reason: string | null
    occurredAt: string
    sequenceId: string | null
    sequenceName: string | null
    enrollmentId: string | null
    enrollmentName: string | null
    identityEmail: string | null
    status: string | null
    scheduledFor: string | null
    sentAt: string | null
    stepIndex: number | null
    attemptCount: number | null
    lastError: string | null
    renderAvailable: boolean
    renderRoute: string | null
    detailRoute: string | null
    queueRoute: string | null
    auditRoute: string | null
  }
  type RunHistoryData = {
    sequenceId: string | null
    sequenceName?: string | null
    sinceHours: number
    limit: number
    totalReturned: number
    summary: {
      byDecision: Record<string, number>
      byOutcome: Record<string, number>
    }
    recentRuns: Array<{
      runKey: string
      startedAt: string
      endedAt: string
      modeGuess: 'DRY_RUN' | 'LIVE_CANARY' | 'MIXED'
      total: number
      counts: Record<string, number>
    }>
    rows: RunHistoryRow[]
    lastUpdatedAt?: string
  }
  type PreviewVsOutcomeMatchRow = {
    matchKind: 'queue_item_id' | 'recipient_enrollment'
    preview: LaunchPreviewRow
    outcome: RunHistoryRow
    differs: {
      outcome: boolean
      reason: boolean
      identity: boolean
    }
  }
  type PreviewVsOutcomeData = {
    sequenceId: string
    sequenceName?: string | null
    sinceHours: number
    batchLimit: number
    outcomeLimit: number
    summary: {
      previewCandidates: number
      outcomeRows: number
      matchedRows: number
      previewOnlyRows: number
      outcomeOnlyRows: number
      matchByQueueItemId: number
      matchByRecipientEnrollment: number
    }
    previewRows: LaunchPreviewRow[]
    outcomeRows: RunHistoryRow[]
    matchedRows: PreviewVsOutcomeMatchRow[]
    previewOnlyRows: LaunchPreviewRow[]
    outcomeOnlyRows: RunHistoryRow[]
    lastUpdatedAt?: string
  }
  type ExceptionCenterSampleRow = {
    queueItemId: string | null
    enrollmentId: string | null
    sequenceId: string | null
    recipientEmail: string | null
    status: string | null
    reason: string | null
    occurredAt: string | null
    detailRoute: string | null
    queueRoute: string | null
    auditRoute: string | null
  }
  type ExceptionCenterGroup = {
    key: string
    title: string
    severity: 'HIGH' | 'MEDIUM' | 'LOW'
    priority: number
    count: number
    status: 'open' | 'clear'
    summary: string
    nextStep: { label: string; target: string }
    samples: ExceptionCenterSampleRow[]
  }
  type ExceptionCenterData = {
    sequenceId: string | null
    sinceHours: number
    statusSummary: {
      totalGroups: number
      openGroups: number
      high: number
      medium: number
      low: number
    }
    groups: ExceptionCenterGroup[]
    routes?: Record<string, string>
    lastUpdatedAt?: string
  }
  type OutreachReportRow = {
    sequenceId?: string
    sequenceName?: string
    identityId?: string
    email?: string | null
    name?: string | null
    sent: number
    sendFailed: number
    suppressed: number
    skipped: number
    replies: number
    optOuts: number
  }
  type MarketingOpsReportingData = {
    customerId: string
    sinceDays: number
    bySequence: OutreachReportRow[]
    byIdentity: OutreachReportRow[]
    generatedAt?: string
    recentReasons?: Record<string, number>
  }
  type QueueWorkbenchState = 'ready' | 'blocked' | 'failed' | 'scheduled' | 'sent'
  type QueueWorkbenchRow = {
    queueItemId: string
    enrollmentId: string
    enrollmentName?: string | null
    sequenceId?: string | null
    sequenceName?: string | null
    recipientEmail: string
    identityEmail?: string | null
    status: string
    triageState: QueueWorkbenchState
    reason: string
    scheduledFor: string | null
    sentAt?: string | null
    updatedAt: string
    stepIndex: number
    attemptCount: number
    lastError: string | null
  }
  type QueueWorkbenchData = {
    state: QueueWorkbenchState
    sinceHours: number
    totalReturned: number
    lastUpdatedAt: string
    rows: QueueWorkbenchRow[]
  }
  type QueueWorkbenchBulkResult = {
    action: 'QUEUED' | 'SKIPPED'
    requestedCount: number
    succeededCount: number
    skippedCount: number
    reasonCounts: Record<string, number>
    finishedAt: string
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
  const [operatorTestSendLoading, setOperatorTestSendLoading] = useState(false)
  const [operatorLastActionResult, setOperatorLastActionResult] = useState<{
    action: 'DRY_RUN' | 'LIVE_CANARY' | 'TEST_SEND'
    success: boolean
    startedAt: string
    finishedAt: string
    summary: string
    refreshedAt?: string | null
  } | null>(null)
  const [liveCanaryTickLoading, setLiveCanaryTickLoading] = useState(false)
  const [sequenceReadinessSequenceId, setSequenceReadinessSequenceId] = useState<string>('')
  const [sequenceReadinessData, setSequenceReadinessData] = useState<SequenceReadinessData | null>(null)
  const [sequenceReadinessLoading, setSequenceReadinessLoading] = useState(false)
  const [sequenceReadinessError, setSequenceReadinessError] = useState<string | null>(null)
  const [sequencePreflightData, setSequencePreflightData] = useState<SequencePreflightData | null>(null)
  const [sequencePreflightLoading, setSequencePreflightLoading] = useState(false)
  const [sequencePreflightError, setSequencePreflightError] = useState<string | null>(null)
  const [launchPreviewData, setLaunchPreviewData] = useState<LaunchPreviewData | null>(null)
  const [launchPreviewLoading, setLaunchPreviewLoading] = useState(false)
  const [launchPreviewError, setLaunchPreviewError] = useState<string | null>(null)
  const [runHistoryData, setRunHistoryData] = useState<RunHistoryData | null>(null)
  const [runHistoryLoading, setRunHistoryLoading] = useState(false)
  const [runHistoryError, setRunHistoryError] = useState<string | null>(null)
  const [runHistoryOutcomeFilter, setRunHistoryOutcomeFilter] = useState<string>('all')
  const [previewVsOutcomeData, setPreviewVsOutcomeData] = useState<PreviewVsOutcomeData | null>(null)
  const [previewVsOutcomeLoading, setPreviewVsOutcomeLoading] = useState(false)
  const [previewVsOutcomeError, setPreviewVsOutcomeError] = useState<string | null>(null)
  const [exceptionCenterData, setExceptionCenterData] = useState<ExceptionCenterData | null>(null)
  const [exceptionCenterLoading, setExceptionCenterLoading] = useState(false)
  const [exceptionCenterError, setExceptionCenterError] = useState<string | null>(null)
  const [identityCapacityData, setIdentityCapacityData] = useState<IdentityCapacityData | null>(null)
  const [identityCapacityLoading, setIdentityCapacityLoading] = useState(false)
  const [identityCapacityError, setIdentityCapacityError] = useState<string | null>(null)
  const [opsReportingData, setOpsReportingData] = useState<MarketingOpsReportingData | null>(null)
  const [opsReportingLoading, setOpsReportingLoading] = useState(false)
  const [opsReportingError, setOpsReportingError] = useState<string | null>(null)
  const [opsReportingSinceDays, setOpsReportingSinceDays] = useState<number>(30)
  const [queueWorkbenchState, setQueueWorkbenchState] = useState<QueueWorkbenchState>('ready')
  const [queueWorkbenchSearch, setQueueWorkbenchSearch] = useState('')
  const [queueWorkbenchData, setQueueWorkbenchData] = useState<QueueWorkbenchData | null>(null)
  const [queueWorkbenchLoading, setQueueWorkbenchLoading] = useState(false)
  const [queueWorkbenchError, setQueueWorkbenchError] = useState<string | null>(null)
  const [queueWorkbenchActionId, setQueueWorkbenchActionId] = useState<string | null>(null)
  const [queueWorkbenchSelectedIds, setQueueWorkbenchSelectedIds] = useState<string[]>([])
  const [queueWorkbenchBulkAction, setQueueWorkbenchBulkAction] = useState<'QUEUED' | 'SKIPPED' | null>(null)
  const [queueWorkbenchBulkResult, setQueueWorkbenchBulkResult] = useState<QueueWorkbenchBulkResult | null>(null)
  const [requestedSequenceId, setRequestedSequenceId] = useState<string | null>(null)
  const [requestedFocusPanel, setRequestedFocusPanel] = useState<string | null>(null)
  const [activeFocusPanel, setActiveFocusPanel] = useState<string | null>(null)

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

  const loadSequenceReadiness = async (sequenceId?: string, opts?: { silent?: boolean }) => {
    const chosenSequenceId = (sequenceId ?? sequenceReadinessSequenceId).trim()
    if (!selectedCustomerId?.startsWith('cust_') || !chosenSequenceId) {
      if (!chosenSequenceId) {
        setSequenceReadinessData(null)
        setSequenceReadinessError(null)
      }
      return
    }
    if (!opts?.silent) setSequenceReadinessLoading(true)
    setSequenceReadinessError(null)
    const hours = Math.min(168, Math.max(1, operatorConsoleSinceHours || 24))
    const endpoint = `/api/send-worker/sequence-readiness?sequenceId=${encodeURIComponent(chosenSequenceId)}&sinceHours=${hours}`
    const res = await api.get<SequenceReadinessData>(endpoint, {
      headers: { 'X-Customer-Id': selectedCustomerId },
    })
    if (!opts?.silent) setSequenceReadinessLoading(false)
    if (res.error) {
      const status = res.errorDetails?.status
      if (status === 400) setSequenceReadinessError('Choose a sequence first.')
      else if (status === 401 || status === 403) setSequenceReadinessError(`Not authorized (${status}).`)
      else if (status === 404) setSequenceReadinessError('Sequence not found for this client.')
      else setSequenceReadinessError(`${res.error}${res.errorDetails?.details ? ` — ${String(res.errorDetails.details).slice(0, 200)}` : ''}`)
      setSequenceReadinessData(null)
      return
    }
    setSequenceReadinessData(res.data ?? null)
    setSequenceReadinessError(null)
  }

  const loadSequencePreflight = async (sequenceId?: string, opts?: { silent?: boolean }) => {
    const chosenSequenceId = (sequenceId ?? sequenceReadinessSequenceId).trim()
    if (!selectedCustomerId?.startsWith('cust_') || !chosenSequenceId) {
      if (!chosenSequenceId) {
        setSequencePreflightData(null)
        setSequencePreflightError(null)
      }
      return
    }
    if (!opts?.silent) setSequencePreflightLoading(true)
    setSequencePreflightError(null)
    const hours = Math.min(168, Math.max(1, operatorConsoleSinceHours || 24))
    const endpoint = `/api/send-worker/sequence-preflight?sequenceId=${encodeURIComponent(chosenSequenceId)}&sinceHours=${hours}`
    const res = await api.get<SequencePreflightData>(endpoint, {
      headers: { 'X-Customer-Id': selectedCustomerId },
    })
    if (!opts?.silent) setSequencePreflightLoading(false)
    if (res.error) {
      const status = res.errorDetails?.status
      if (status === 400) setSequencePreflightError('Choose a sequence first.')
      else if (status === 401 || status === 403) setSequencePreflightError(`Not authorized (${status}).`)
      else if (status === 404) setSequencePreflightError('Sequence not found for this client.')
      else setSequencePreflightError(`${res.error}${res.errorDetails?.details ? ` — ${String(res.errorDetails.details).slice(0, 200)}` : ''}`)
      setSequencePreflightData(null)
      return
    }
    setSequencePreflightData(res.data ?? null)
    setSequencePreflightError(null)
  }

  const loadLaunchPreview = async (sequenceId?: string, opts?: { silent?: boolean }) => {
    const chosenSequenceId = (sequenceId ?? sequenceReadinessSequenceId).trim()
    if (!selectedCustomerId?.startsWith('cust_') || !chosenSequenceId) {
      if (!chosenSequenceId) {
        setLaunchPreviewData(null)
        setLaunchPreviewError(null)
      }
      return
    }
    if (!opts?.silent) setLaunchPreviewLoading(true)
    setLaunchPreviewError(null)
    const hours = Math.min(168, Math.max(1, operatorConsoleSinceHours || 24))
    const endpoint = `/api/send-worker/launch-preview?sequenceId=${encodeURIComponent(chosenSequenceId)}&sinceHours=${hours}&batchLimit=15`
    const res = await api.get<LaunchPreviewData>(endpoint, {
      headers: { 'X-Customer-Id': selectedCustomerId },
    })
    if (!opts?.silent) setLaunchPreviewLoading(false)
    if (res.error) {
      const status = res.errorDetails?.status
      if (status === 400) setLaunchPreviewError('Choose a sequence first.')
      else if (status === 401 || status === 403) setLaunchPreviewError(`Not authorized (${status}).`)
      else if (status === 404) setLaunchPreviewError('Sequence not found for this client.')
      else setLaunchPreviewError(`${res.error}${res.errorDetails?.details ? ` — ${String(res.errorDetails.details).slice(0, 200)}` : ''}`)
      setLaunchPreviewData(null)
      return
    }
    setLaunchPreviewData(res.data ?? null)
    setLaunchPreviewError(null)
  }

  const loadRunHistory = async (sequenceId?: string, opts?: { silent?: boolean }) => {
    const chosenSequenceId = (sequenceId ?? sequenceReadinessSequenceId).trim()
    if (!selectedCustomerId?.startsWith('cust_')) return
    if (!opts?.silent) setRunHistoryLoading(true)
    setRunHistoryError(null)
    const hours = Math.min(168, Math.max(1, operatorConsoleSinceHours || 24))
    const params = new URLSearchParams()
    params.set('sinceHours', String(hours))
    params.set('limit', '60')
    if (chosenSequenceId) params.set('sequenceId', chosenSequenceId)
    const endpoint = `/api/send-worker/run-history?${params.toString()}`
    const res = await api.get<RunHistoryData>(endpoint, {
      headers: { 'X-Customer-Id': selectedCustomerId },
    })
    if (!opts?.silent) setRunHistoryLoading(false)
    if (res.error) {
      const status = res.errorDetails?.status
      if (status === 400) setRunHistoryError('Select a client.')
      else if (status === 401 || status === 403) setRunHistoryError(`Not authorized (${status}).`)
      else if (status === 404) setRunHistoryError('Sequence not found for this client.')
      else setRunHistoryError(`${res.error}${res.errorDetails?.details ? ` — ${String(res.errorDetails.details).slice(0, 200)}` : ''}`)
      setRunHistoryData(null)
      return
    }
    setRunHistoryData(res.data ?? null)
    setRunHistoryError(null)
  }

  const loadPreviewVsOutcome = async (sequenceId?: string, opts?: { silent?: boolean }) => {
    const chosenSequenceId = (sequenceId ?? sequenceReadinessSequenceId).trim()
    if (!selectedCustomerId?.startsWith('cust_') || !chosenSequenceId) {
      if (!chosenSequenceId) {
        setPreviewVsOutcomeData(null)
        setPreviewVsOutcomeError(null)
      }
      return
    }
    if (!opts?.silent) setPreviewVsOutcomeLoading(true)
    setPreviewVsOutcomeError(null)
    const hours = Math.min(168, Math.max(1, operatorConsoleSinceHours || 24))
    const endpoint = `/api/send-worker/preview-vs-outcome?sequenceId=${encodeURIComponent(chosenSequenceId)}&sinceHours=${hours}&batchLimit=15&outcomeLimit=80`
    const res = await api.get<PreviewVsOutcomeData>(endpoint, {
      headers: { 'X-Customer-Id': selectedCustomerId },
    })
    if (!opts?.silent) setPreviewVsOutcomeLoading(false)
    if (res.error) {
      const status = res.errorDetails?.status
      if (status === 400) setPreviewVsOutcomeError('Choose a sequence first.')
      else if (status === 401 || status === 403) setPreviewVsOutcomeError(`Not authorized (${status}).`)
      else if (status === 404) setPreviewVsOutcomeError('Sequence not found for this client.')
      else setPreviewVsOutcomeError(`${res.error}${res.errorDetails?.details ? ` — ${String(res.errorDetails.details).slice(0, 200)}` : ''}`)
      setPreviewVsOutcomeData(null)
      return
    }
    setPreviewVsOutcomeData(res.data ?? null)
    setPreviewVsOutcomeError(null)
  }

  const loadExceptionCenter = async (sequenceId?: string, opts?: { silent?: boolean }) => {
    if (!selectedCustomerId?.startsWith('cust_')) return
    if (!opts?.silent) setExceptionCenterLoading(true)
    setExceptionCenterError(null)
    const chosenSequenceId = (sequenceId ?? sequenceReadinessSequenceId).trim()
    const hours = Math.min(168, Math.max(1, operatorConsoleSinceHours || 24))
    const params = new URLSearchParams()
    params.set('sinceHours', String(hours))
    if (chosenSequenceId) params.set('sequenceId', chosenSequenceId)
    const endpoint = `/api/send-worker/exception-center?${params.toString()}`
    const res = await api.get<ExceptionCenterData>(endpoint, {
      headers: { 'X-Customer-Id': selectedCustomerId },
    })
    if (!opts?.silent) setExceptionCenterLoading(false)
    if (res.error) {
      const status = res.errorDetails?.status
      if (status === 400) setExceptionCenterError('Select a client.')
      else if (status === 401 || status === 403) setExceptionCenterError(`Not authorized (${status}).`)
      else if (status === 404) setExceptionCenterError('Sequence not found for this client.')
      else setExceptionCenterError(`${res.error}${res.errorDetails?.details ? ` — ${String(res.errorDetails.details).slice(0, 200)}` : ''}`)
      setExceptionCenterData(null)
      return
    }
    setExceptionCenterData(res.data ?? null)
    setExceptionCenterError(null)
  }

  const loadIdentityCapacity = async (opts?: { silent?: boolean }) => {
    if (!selectedCustomerId?.startsWith('cust_')) return
    if (!opts?.silent) setIdentityCapacityLoading(true)
    setIdentityCapacityError(null)
    const hours = Math.min(168, Math.max(1, operatorConsoleSinceHours || 24))
    const endpoint = `/api/send-worker/identity-capacity?sinceHours=${hours}`
    const res = await api.get<IdentityCapacityData>(endpoint, {
      headers: { 'X-Customer-Id': selectedCustomerId },
    })
    if (!opts?.silent) setIdentityCapacityLoading(false)
    if (res.error) {
      const status = res.errorDetails?.status
      if (status === 400) setIdentityCapacityError('Select a client.')
      else if (status === 401 || status === 403) setIdentityCapacityError(`Not authorized (${status}).`)
      else setIdentityCapacityError(`${res.error}${res.errorDetails?.details ? ` — ${String(res.errorDetails.details).slice(0, 200)}` : ''}`)
      setIdentityCapacityData(null)
      return
    }
    setIdentityCapacityData(res.data ?? null)
    setIdentityCapacityError(null)
  }

  const loadOpsReporting = async (opts?: { silent?: boolean }) => {
    if (!selectedCustomerId?.startsWith('cust_')) return
    if (!opts?.silent) setOpsReportingLoading(true)
    setOpsReportingError(null)
    const sinceDays = Math.min(90, Math.max(1, opsReportingSinceDays || 30))
    const endpoint = `/api/reports/outreach?customerId=${encodeURIComponent(selectedCustomerId)}&sinceDays=${sinceDays}`
    const res = await api.get<MarketingOpsReportingData>(endpoint, {
      headers: { 'X-Customer-Id': selectedCustomerId },
    })
    if (!opts?.silent) setOpsReportingLoading(false)
    if (res.error) {
      const status = res.errorDetails?.status
      if (status === 400) setOpsReportingError('Select a client.')
      else if (status === 401 || status === 403) setOpsReportingError(`Not authorized (${status}).`)
      else setOpsReportingError(`${res.error}${res.errorDetails?.details ? ` — ${String(res.errorDetails.details).slice(0, 200)}` : ''}`)
      setOpsReportingData(null)
      return
    }
    setOpsReportingData(res.data ?? null)
    setOpsReportingError(null)
  }

  const loadQueueWorkbench = async (opts?: { silent?: boolean }) => {
    if (!selectedCustomerId?.startsWith('cust_')) return
    if (!opts?.silent) setQueueWorkbenchLoading(true)
    setQueueWorkbenchError(null)
    const params = new URLSearchParams()
    params.set('state', queueWorkbenchState)
    params.set('limit', '50')
    params.set('sinceHours', String(Math.min(168, Math.max(1, operatorConsoleSinceHours || 24))))
    if (queueWorkbenchSearch.trim()) params.set('search', queueWorkbenchSearch.trim())
    const endpoint = `/api/send-worker/queue-workbench?${params.toString()}`
    const res = await api.get<QueueWorkbenchData>(endpoint, {
      headers: { 'X-Customer-Id': selectedCustomerId },
    })
    if (!opts?.silent) setQueueWorkbenchLoading(false)
    if (res.error) {
      const status = res.errorDetails?.status
      if (status === 400) setQueueWorkbenchError('Select a client.')
      else if (status === 401 || status === 403) setQueueWorkbenchError(`Not authorized (${status}).`)
      else setQueueWorkbenchError(`${res.error}${res.errorDetails?.details ? ` — ${String(res.errorDetails.details).slice(0, 200)}` : ''}`)
      setQueueWorkbenchData(null)
      return
    }
    setQueueWorkbenchData(res.data ?? null)
    setQueueWorkbenchError(null)
  }

  const applyQueueWorkbenchAction = async (itemId: string, payload: { status: 'QUEUED' | 'SKIPPED'; skipReason?: string }) => {
    if (!selectedCustomerId?.startsWith('cust_')) return
    setQueueWorkbenchActionId(itemId)
    try {
      const res = await api.patch(`/api/send-queue/items/${itemId}`, payload, {
        headers: { 'X-Customer-Id': selectedCustomerId },
      })
      if (res.error) {
        toast({ title: 'Queue action failed', description: `${res.errorDetails?.status ?? ''} ${res.error}`.trim(), status: 'error' })
        return
      }
      toast({ title: payload.status === 'QUEUED' ? 'Item re-queued' : 'Item skipped', status: 'success', duration: 2000 })
      await refreshControlLoopTruth()
    } finally {
      setQueueWorkbenchActionId(null)
    }
  }

  const queueActionAllowed = (row: QueueWorkbenchRow, action: 'QUEUED' | 'SKIPPED') => {
    const status = String(row.status || '').toUpperCase()
    if (status === 'SENT') return false
    if (action === 'QUEUED') {
      return status === 'FAILED' || status === 'SKIPPED' || status === 'LOCKED'
    }
    return status === 'QUEUED' || status === 'FAILED' || status === 'LOCKED'
  }

  const queueWorkbenchRows = useMemo(() => queueWorkbenchData?.rows ?? [], [queueWorkbenchData])
  const runHistoryRows = useMemo(() => {
    const rows = runHistoryData?.rows ?? []
    if (runHistoryOutcomeFilter === 'all') return rows
    return rows.filter((row) => row.outcome === runHistoryOutcomeFilter || row.decision === runHistoryOutcomeFilter)
  }, [runHistoryData, runHistoryOutcomeFilter])
  const operatorOutcomeRows = useMemo(() => (runHistoryData?.rows ?? []).slice(0, 8), [runHistoryData])
  const launchPreviewFirstBatchIds = useMemo(() => {
    return new Set((launchPreviewData?.firstBatch ?? []).map((row) => row.queueItemId))
  }, [launchPreviewData])
  const queueWorkbenchVisibleIds = queueWorkbenchRows.map((row) => row.queueItemId)
  const queueWorkbenchSelectedRows = queueWorkbenchRows.filter((row) => queueWorkbenchSelectedIds.includes(row.queueItemId))
  const queueWorkbenchRequeueEligibleCount = queueWorkbenchSelectedRows.filter((row) => queueActionAllowed(row, 'QUEUED')).length
  const queueWorkbenchSkipEligibleCount = queueWorkbenchSelectedRows.filter((row) => queueActionAllowed(row, 'SKIPPED')).length
  const queueWorkbenchAllVisibleSelected = queueWorkbenchVisibleIds.length > 0 && queueWorkbenchVisibleIds.every((id) => queueWorkbenchSelectedIds.includes(id))

  const toggleQueueWorkbenchSelection = (itemId: string, checked: boolean) => {
    setQueueWorkbenchSelectedIds((prev) => {
      if (checked) return prev.includes(itemId) ? prev : [...prev, itemId]
      return prev.filter((id) => id !== itemId)
    })
  }

  const toggleQueueWorkbenchSelectAllVisible = (checked: boolean) => {
    setQueueWorkbenchSelectedIds((prev) => {
      if (!checked) return prev.filter((id) => !queueWorkbenchVisibleIds.includes(id))
      const merged = new Set([...prev, ...queueWorkbenchVisibleIds])
      return Array.from(merged)
    })
  }

  const clearQueueWorkbenchSelection = () => setQueueWorkbenchSelectedIds([])

  const applyQueueWorkbenchBulkAction = async (action: 'QUEUED' | 'SKIPPED') => {
    if (!selectedCustomerId?.startsWith('cust_')) return
    const eligibleIds = queueWorkbenchSelectedRows
      .filter((row) => queueActionAllowed(row, action))
      .map((row) => row.queueItemId)
    if (eligibleIds.length === 0) {
      toast({
        title: 'No valid rows selected',
        description: action === 'QUEUED' ? 'Select failed, skipped, or locked rows to requeue.' : 'Select queued, failed, or locked rows to skip.',
        status: 'warning',
      })
      return
    }
    setQueueWorkbenchBulkAction(action)
    setQueueWorkbenchBulkResult(null)
    const payload: { itemIds: string[]; status: 'QUEUED' | 'SKIPPED'; skipReason?: string } = {
      itemIds: eligibleIds,
      status: action,
    }
    if (action === 'SKIPPED') {
      const reason = (typeof window !== 'undefined' && window.prompt?.('Bulk skip reason (optional):'))?.trim().slice(0, 200)
      if (reason) payload.skipReason = reason
    }
    try {
      const res = await api.patch('/api/send-queue/items/bulk', payload, {
        headers: { 'X-Customer-Id': selectedCustomerId },
      })
      if (res.error) {
        toast({ title: 'Bulk action failed', description: `${res.errorDetails?.status ?? ''} ${res.error}`.trim(), status: 'error' })
        return
      }
      const data = (res.data as {
        success?: boolean
        data?: { requestedCount?: number; succeededCount?: number; skippedCount?: number; reasonCounts?: Record<string, number>; action?: 'QUEUED' | 'SKIPPED' }
      })?.data
      setQueueWorkbenchBulkResult({
        action,
        requestedCount: Number(data?.requestedCount ?? eligibleIds.length),
        succeededCount: Number(data?.succeededCount ?? 0),
        skippedCount: Number(data?.skippedCount ?? 0),
        reasonCounts: data?.reasonCounts ?? {},
        finishedAt: new Date().toISOString(),
      })
      toast({
        title: action === 'QUEUED' ? 'Bulk requeue complete' : 'Bulk skip complete',
        description: `updated=${Number(data?.succeededCount ?? 0)} skipped=${Number(data?.skippedCount ?? 0)}`,
        status: 'success',
      })
      clearQueueWorkbenchSelection()
      await refreshControlLoopTruth()
    } finally {
      setQueueWorkbenchBulkAction(null)
    }
  }

  const refreshControlLoopTruth = async (opts?: { silent?: boolean }) => {
    await loadOperatorConsole(opts)
    await loadIdentityCapacity({ silent: true })
    if (sequenceReadinessSequenceId.trim()) {
      await loadSequenceReadiness(sequenceReadinessSequenceId, { silent: true })
      await loadSequencePreflight(sequenceReadinessSequenceId, { silent: true })
      await loadLaunchPreview(sequenceReadinessSequenceId, { silent: true })
      await loadRunHistory(sequenceReadinessSequenceId, { silent: true })
      await loadPreviewVsOutcome(sequenceReadinessSequenceId, { silent: true })
      await loadExceptionCenter(sequenceReadinessSequenceId, { silent: true })
    }
    if (!sequenceReadinessSequenceId.trim()) {
      await loadRunHistory('', { silent: true })
      setPreviewVsOutcomeData(null)
      setPreviewVsOutcomeError(null)
      await loadExceptionCenter('', { silent: true })
    }
    await loadOpsReporting({ silent: true })
    await loadQueueWorkbench({ silent: true })
    loadAuditSummary()
    loadAudits()
    loadSendQueuePreview()
    if (queueEnrollmentId) {
      loadQueue(queueEnrollmentId)
    }
  }

  const handleExceptionNextStep = (target: string) => {
    if (target === 'queue-workbench-blocked') {
      setQueueWorkbenchState('blocked')
      void loadQueueWorkbench()
      return
    }
    if (target === 'queue-workbench-failed') {
      setQueueWorkbenchState('failed')
      void loadQueueWorkbench()
      return
    }
    if (target === 'sequence-preflight') {
      void loadSequencePreflight()
      return
    }
    if (target === 'identity-capacity') {
      void loadIdentityCapacity()
      return
    }
    if (target === 'preview-vs-outcome') {
      void loadPreviewVsOutcome()
      return
    }
    if (target === 'launch-preview') {
      void loadLaunchPreview()
      return
    }
    if (target === 'run-history') {
      void loadRunHistory()
      return
    }
    if (target === 'marketing-data-health') {
      toast({
        title: 'Open Data Health',
        description: 'Use Marketing > Compliance/Lead Sources panel to review Google Sheets health.',
        status: 'info',
      })
      return
    }
    void refreshControlLoopTruth({ silent: true })
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
          ? operatorConsoleData?.status.manualLiveTickReason || operatorConsoleData?.status.scheduledLiveReason || 'Live send is blocked by current gates.'
          : null

  const operatorTestSendDisabledReason =
    !selectedCustomerId?.startsWith('cust_')
      ? 'Select a client.'
      : !sequenceReadinessSequenceId.trim()
        ? 'Choose a sequence first.'
        : !operatorConsoleData?.status.manualLiveTickAllowed
          ? operatorConsoleData?.status.manualLiveTickReason || operatorConsoleData?.status.scheduledLiveReason || 'Immediate test send is blocked by current gates.'
          : null

  function humanizeGateReason(reason: string | null | undefined): string {
    switch ((reason || '').trim()) {
      case 'live_send_disabled_env':
        return 'Live sending is disabled in the current environment.'
      case 'customer_not_in_canary':
        return 'Live sending is not enabled for this client right now. You can still save this sequence, review the live recipients, and prepare test recipients.'
      case 'identity_not_in_canary':
        return 'The selected sending mailbox is not enabled for live sending.'
      case 'canary_customer_not_configured':
        return 'Live sending is not configured right now.'
      case 'canary_identity_required_but_missing':
        return 'No active sending mailbox is available for live sending.'
      case 'manual_live_tick_not_allowed':
        return 'Immediate live testing is blocked by current launch gates.'
      case 'ignore_window_not_enabled':
        return 'Immediate send override is not enabled in this environment.'
      default:
        return reason || 'This action is blocked by current launch gates.'
    }
  }

  function humanizeRunReason(reason: string | null | undefined): string {
    switch ((reason || '').trim()) {
      case 'daily_cap_reached':
        return 'Mailbox daily limit reached'
      case 'per_minute_cap_reached':
        return 'Mailbox send rate limit reached'
      case 'outside_window':
        return 'Queued for a later retry'
      case 'replied_stop':
      case 'SKIP_REPLIED_STOP':
        return 'Stopped because the contact replied'
      case 'suppressed':
      case 'unsubscribe':
        return 'Suppressed / opted out'
      case 'hard_bounce_invalid_recipient':
        return 'Invalid recipient or hard bounce'
      case 'missing_recipient_email':
        return 'Recipient email missing'
      default:
        return reason || '—'
    }
  }

  function humanizeOutcome(outcome: string): string {
    switch (outcome) {
      case 'SENT':
        return 'Sent'
      case 'SEND_FAILED':
        return 'Failed'
      case 'WOULD_SEND':
        return 'Dry-run only'
      case 'SKIP_SUPPRESSED':
        return 'Suppressed'
      case 'SKIP_REPLIED_STOP':
        return 'Reply stopped'
      case 'SKIP_INVALID':
        return 'Invalid recipient'
      default:
        return outcome.replace(/_/g, ' ').toLowerCase()
    }
  }

  function humanizeSequenceStatus(status: string | null | undefined): string {
    switch ((status || '').trim().toLowerCase()) {
      case 'draft':
        return 'Draft'
      case 'scheduled':
        return 'Scheduled'
      case 'sending':
      case 'running':
        return 'Sending'
      case 'paused':
        return 'Paused'
      case 'sent':
      case 'completed':
        return 'Completed'
      default:
        return status ? status.replace(/_/g, ' ') : 'Draft'
    }
  }

  function formatDateTimeLabel(value: string | null | undefined): string {
    if (!value) return '—'
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return '—'
    return parsed.toLocaleString()
  }

  function describeEnrollmentAudience(enrollment: EnrollmentListItem): string {
    if (enrollment.recipientSource === 'snapshot') {
      return enrollment.sourceListName
        ? `Lead batch: ${enrollment.sourceListName}`
        : 'Lead batch recipients'
    }
    if (enrollment.recipientSource === 'manual') {
      return 'Manual test recipients'
    }
    return 'Recipients source not recorded'
  }

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

  const previewQueueItemRender = async (itemId: string) => {
    if (!selectedCustomerId?.startsWith('cust_') || !itemId) return
    setRenderLoading(true)
    setRenderError(null)
    setRenderData(null)
    const res = await api.get<{ queueItemId: string; enrollmentId: string; stepIndex: number; recipientEmail: string; subject: string; bodyHtml: string }>(
      `/api/send-queue/items/${itemId}/render`,
      { headers: { 'X-Customer-Id': selectedCustomerId } }
    )
    setRenderLoading(false)
    if (res.error) {
      setRenderError(res.error + (res.errorDetails?.details ? ` — ${String(res.errorDetails.details).slice(0, 200)}` : ''))
      return
    }
    setRenderData(res.data ? { ...res.data, enrollmentId: res.data.enrollmentId } : null)
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

  const loadAuditSummary = useCallback(async () => {
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
  }, [selectedCustomerId, auditSummarySinceHours, auditQueueItemIdFilter, auditDecisionFilter])

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
      void loadAuditSummary()
    }
  }, [isAuditPanelOpen, selectedCustomerId, auditQueueItemIdFilter, auditDecisionFilter, loadAuditSummary])

  useEffect(() => {
    if (!selectedCustomerId?.startsWith('cust_')) {
      setOperatorConsoleData(null)
      return
    }
    void loadOperatorConsole({ silent: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load a lightweight operator summary when the client changes
  }, [selectedCustomerId, operatorConsoleSinceHours])

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
    loadOpsReporting()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ops reporting refreshes on panel + tenant + selected window
  }, [isOperatorConsolePanelOpen, selectedCustomerId, opsReportingSinceDays])

  useEffect(() => {
    if (!isOperatorConsolePanelOpen) return
    if (!selectedCustomerId?.startsWith('cust_')) return
    clearQueueWorkbenchSelection()
    setQueueWorkbenchBulkResult(null)
    loadQueueWorkbench()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- workbench refreshes on panel + tenant + chosen state
  }, [isOperatorConsolePanelOpen, selectedCustomerId, queueWorkbenchState])

  useEffect(() => {
    if (!isOperatorConsolePanelOpen) return
    if (!selectedCustomerId?.startsWith('cust_')) return
    clearQueueWorkbenchSelection()
    const timer = setTimeout(() => {
      loadQueueWorkbench({ silent: true })
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recipient search refreshes triage list with debounce
  }, [queueWorkbenchSearch])

  useEffect(() => {
    if (!queueWorkbenchRows.length) {
      if (queueWorkbenchSelectedIds.length > 0) clearQueueWorkbenchSelection()
      return
    }
    const validIds = new Set(queueWorkbenchRows.map((row) => row.queueItemId))
    if (queueWorkbenchSelectedIds.some((id) => !validIds.has(id))) {
      setQueueWorkbenchSelectedIds((prev) => prev.filter((id) => validIds.has(id)))
    }
  }, [queueWorkbenchRows, queueWorkbenchSelectedIds])

  useEffect(() => {
    if (!isOperatorConsolePanelOpen) return
    if (!selectedCustomerId?.startsWith('cust_')) return
    const timer = setInterval(() => {
      refreshControlLoopTruth({ silent: true })
    }, 30000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- polling should track panel + tenant only
  }, [isOperatorConsolePanelOpen, selectedCustomerId])

  useEffect(() => {
    if (!isDiagnosticsOpen) {
      setIsSequenceLaunchAdvancedOpen(false)
    }
  }, [isDiagnosticsOpen])

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
    if (!isDiagnosticsOpen) onDiagnosticsOpen()
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
      setSequenceReadinessSequenceId('')
      setSequenceReadinessData(null)
      setSequenceReadinessError(null)
      setSequencePreflightData(null)
      setSequencePreflightError(null)
      setLaunchPreviewData(null)
      setLaunchPreviewError(null)
      setRunHistoryData(null)
      setRunHistoryError(null)
      setPreviewVsOutcomeData(null)
      setPreviewVsOutcomeError(null)
      setExceptionCenterData(null)
      setExceptionCenterError(null)
      setIdentityCapacityData(null)
      setIdentityCapacityError(null)
      setOpsReportingData(null)
      setOpsReportingError(null)
      setQueueWorkbenchData(null)
      setQueueWorkbenchError(null)
      setQueueWorkbenchSelectedIds([])
      setQueueWorkbenchBulkResult(null)
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
        toast({ title: 'Test audience saved', description: count ? `${count} recipients from the linked lead batch.` : undefined, status: 'success' })
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
      toast({ title: 'Test audience saved', description: `${emails.length} manual test recipient${emails.length === 1 ? '' : 's'} queued.`, status: 'success' })
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
    if (!isOpen) {
      setIsSequenceLaunchAdvancedOpen(false)
      setLinkedListSummary(null)
      setLinkedListSummaryLoading(false)
      return
    }
    if (!editingSequence?.listId || !selectedCustomerId?.startsWith('cust_')) {
      setLinkedListSummary(null)
      setLinkedListSummaryLoading(false)
      return
    }
    let cancelled = false
    setLinkedListSummaryLoading(true)
    void api
      .get<{ id: string; name?: string; contacts?: Array<{ id: string }> }>(`/api/lists/${editingSequence.listId}`, {
        headers: { 'X-Customer-Id': selectedCustomerId },
      })
      .then((res) => {
        if (cancelled) return
        if (res.error || !res.data) {
          setLinkedListSummary(null)
          return
        }
        setLinkedListSummary({
          id: res.data.id,
          name: res.data.name || 'Linked lead batch',
          contactCount: Array.isArray(res.data.contacts) ? res.data.contacts.length : 0,
        })
      })
      .finally(() => {
        if (!cancelled) setLinkedListSummaryLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, editingSequence?.listId, selectedCustomerId])

  useEffect(() => {
    if (!isOpen || !editingSequence?.sequenceId || !selectedCustomerId?.startsWith('cust_')) return
    const sequenceId = editingSequence.sequenceId
    setSequenceReadinessSequenceId(sequenceId)
    void Promise.all([
      loadSequenceReadiness(sequenceId, { silent: true }),
      loadSequencePreflight(sequenceId, { silent: true }),
      loadLaunchPreview(sequenceId, { silent: true }),
      loadRunHistory(sequenceId, { silent: true }),
    ])
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh operator truth when a sequence is opened for editing
  }, [isOpen, editingSequence?.sequenceId, selectedCustomerId])

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
    const startedAt = new Date().toISOString()
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
        setOperatorLastActionResult({
          action: 'DRY_RUN',
          success: false,
          startedAt,
          finishedAt: new Date().toISOString(),
          summary: `Dry-run failed: ${res.error}`,
          refreshedAt: null,
        })
        return
      }
      const d = res.data?.data
      const summary = d ? `processed=${d.processedCount ?? 0} audits=${d.auditsCreated ?? 0}` : 'completed'
      toast({
        title: 'Dry-run worker done',
        description: summary,
        status: 'success',
        duration: 4000,
      })
      await refreshControlLoopTruth()
      setOperatorLastActionResult({
        action: 'DRY_RUN',
        success: true,
        startedAt,
        finishedAt: new Date().toISOString(),
        summary,
        refreshedAt: new Date().toISOString(),
      })
      setOperatorActionStatus('Dry-run worker complete. Console refreshed from backend truth.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Network error'
      toast({ title: 'Dry-run worker failed', description: msg, status: 'error' })
      setOperatorActionStatus(`Dry-run worker failed: ${msg}`)
      setOperatorLastActionResult({
        action: 'DRY_RUN',
        success: false,
        startedAt,
        finishedAt: new Date().toISOString(),
        summary: `Dry-run failed: ${msg}`,
        refreshedAt: null,
      })
    } finally {
      setDryRunWorkerLoading(false)
    }
  }

  const handleRunLiveCanaryTick = async () => {
    if (!selectedCustomerId?.startsWith('cust_') || !adminSecret) return
    const startedAt = new Date().toISOString()
    setLiveCanaryTickLoading(true)
    setOperatorActionStatus('Running live send now...')
    try {
      const cap = operatorConsoleData?.status.liveSendCap ?? 1
      const res = await api.post<{ success?: boolean; data?: { processed?: number; sent?: number; failed?: number; skipped?: number; reasons?: Record<string, number> } }>(
        '/api/send-worker/live-tick',
        { limit: Math.min(5, Math.max(1, cap)) },
        { headers: { 'X-Customer-Id': selectedCustomerId, 'x-admin-secret': adminSecret } }
      )
      if (res.error) {
        const msg = `${res.errorDetails?.status ?? ''} ${res.error}`.trim()
        toast({ title: 'Live send failed', description: msg, status: 'error' })
        setOperatorActionStatus(`Live send failed: ${msg}`)
        setOperatorLastActionResult({
          action: 'LIVE_CANARY',
          success: false,
          startedAt,
          finishedAt: new Date().toISOString(),
          summary: `Live send failed: ${msg}`,
          refreshedAt: null,
        })
        return
      }
      const d = res.data?.data
      const summary = d ? `processed=${d.processed ?? 0} sent=${d.sent ?? 0} failed=${d.failed ?? 0} skipped=${d.skipped ?? 0}` : 'completed'
      toast({
        title: 'Live send complete',
        description: summary,
        status: 'success',
        duration: 4500,
      })
      await refreshControlLoopTruth()
      setOperatorLastActionResult({
        action: 'LIVE_CANARY',
        success: true,
        startedAt,
        finishedAt: new Date().toISOString(),
        summary,
        refreshedAt: new Date().toISOString(),
      })
      setOperatorActionStatus('Live send complete. Console refreshed from backend truth.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Network error'
      toast({ title: 'Live send failed', description: msg, status: 'error' })
      setOperatorActionStatus(`Live send failed: ${msg}`)
      setOperatorLastActionResult({
        action: 'LIVE_CANARY',
        success: false,
        startedAt,
        finishedAt: new Date().toISOString(),
        summary: `Live send failed: ${msg}`,
        refreshedAt: null,
      })
    } finally {
      setLiveCanaryTickLoading(false)
    }
  }

  const handleOperatorTestSend = async (sequenceIdOverride?: string) => {
    const chosenSequenceId = (sequenceIdOverride ?? sequenceReadinessSequenceId).trim()
    if (!selectedCustomerId?.startsWith('cust_') || !chosenSequenceId) return
    const startedAt = new Date().toISOString()
    setOperatorTestSendLoading(true)
    setOperatorActionStatus('Sending a live test batch now...')
    try {
      const res = await api.post<{
        success?: boolean
        data?: {
          processed?: number
          sent?: number
          requeued?: number
          failed?: number
          message?: string
        }
      }>(
        '/api/send-worker/sequence-test-send',
        {
          sequenceId: chosenSequenceId,
          limit: 3,
        },
        { headers: { 'X-Customer-Id': selectedCustomerId } },
      )
      if (res.error) {
        const msg = humanizeGateReason(res.error)
        toast({ title: 'Immediate test send failed', description: msg, status: 'error', duration: 5000 })
        setOperatorActionStatus(`Immediate test send failed: ${msg}`)
        setOperatorLastActionResult({
          action: 'TEST_SEND',
          success: false,
          startedAt,
          finishedAt: new Date().toISOString(),
          summary: `Immediate test send failed: ${msg}`,
          refreshedAt: null,
        })
        return
      }
      const d = res.data?.data
      const summary = d?.message || `processed=${d?.processed ?? 0} sent=${d?.sent ?? 0} requeued=${d?.requeued ?? 0} failed=${d?.failed ?? 0}`
      toast({
        title: (d?.sent ?? 0) > 0 ? 'Live test batch sent' : 'Test batch checked',
        description: summary,
        status: (d?.sent ?? 0) > 0 ? 'success' : 'info',
        duration: 5000,
      })
      await refreshControlLoopTruth()
      setOperatorLastActionResult({
        action: 'TEST_SEND',
        success: (d?.sent ?? 0) > 0,
        startedAt,
        finishedAt: new Date().toISOString(),
        summary,
        refreshedAt: new Date().toISOString(),
      })
      setOperatorActionStatus(summary)
    } catch (err) {
      const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Network error'
      toast({ title: 'Immediate test send failed', description: msg, status: 'error', duration: 5000 })
      setOperatorActionStatus(`Immediate test send failed: ${msg}`)
      setOperatorLastActionResult({
        action: 'TEST_SEND',
        success: false,
        startedAt,
        finishedAt: new Date().toISOString(),
        summary: `Immediate test send failed: ${msg}`,
        refreshedAt: null,
      })
    } finally {
      setOperatorTestSendLoading(false)
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

  const loadCustomers = useCallback(async () => {
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
    } catch (err: any) {
      console.error('❌ Failed to normalize customers in SequencesTab:', err)
      setCustomers([])
    }
  }, [setSelectedCustomerId])

  const loadData = useCallback(async (): Promise<SequenceCampaign[] | null> => {
    if (!selectedCustomerId || !selectedCustomerId.startsWith('cust_')) {
      setSequences([])
      setError(null)
      return []
    }
    if (import.meta.env.DEV) {
      console.debug('[SequencesTab] loadData', { hasCustomerId: true })
    }
    setLoading(true)
    setError(null)
    const headers = customerHeaders!
    const sequencePath = includeArchivedInList ? '/api/sequences?includeArchived=true' : '/api/sequences'
    const [sequencesRes, campaignsRes] = await Promise.all([
      api.get<Array<{
        id: string
        name: string
        description?: string | null
        stepCount: number
        senderIdentityId?: string
        senderIdentity?: { id: string; emailAddress: string; displayName?: string } | null
        isArchived?: boolean
        archivedAt?: string | null
        createdAt: string
        updatedAt: string
      }>>(sequencePath, { headers }),
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
      return null
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
          stepCount: seq.stepCount,
          isArchived: seq.isArchived ?? false,
          archivedAt: seq.archivedAt ?? null,
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
        stepCount: seq.stepCount,
        isArchived: seq.isArchived ?? false,
        archivedAt: seq.archivedAt ?? null,
      }
    })
    setSequences(rows)
    setLoading(false)
    return rows
  }, [selectedCustomerId, customerHeaders, includeArchivedInList])

  const loadSnapshots = useCallback(async () => {
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
  }, [])

  const loadFormOptions = useCallback(async () => {
    setSnapshotsLoading(true)
    setLeadBatchesLoading(true)
    setTemplatesLoading(true)
    setSendersLoading(true)
    setSnapshotsError(null)
    setTemplatesError(null)
    setSendersError(null)

    const headers = selectedCustomerId?.startsWith('cust_') ? { 'X-Customer-Id': selectedCustomerId } : {}
    const [, batchesRes, templatesRes, sendersRes] = await Promise.all([
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
  }, [selectedCustomerId, loadSnapshots])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const requestedSeq = params.get('sequenceId')
    const requestedPanel = params.get('focusPanel')
    const snapshotId = params.get('snapshotId')
    const view = params.get('view')
    setRequestedSequenceId(requestedSeq && requestedSeq.trim().length > 0 ? requestedSeq.trim() : null)
    setRequestedFocusPanel(requestedPanel && requestedPanel.trim().length > 0 ? requestedPanel.trim() : null)
    if (view === 'sequences' && snapshotId) {
      setMaterializedBatchKey(null)
      setEditingSequence({
        id: '',
        name: '',
        description: '',
        status: 'draft',
        createdAt: new Date().toISOString(),
        listId: snapshotId,
        senderIdentityId: '',
        steps: [
          {
            stepOrder: 1,
            delayDaysFromPrevious: 0,
            subjectTemplate: '',
            bodyTemplateHtml: '',
            bodyTemplateText: '',
          },
        ],
      })
      onOpen()
    }
    void loadCustomers()
  }, [loadCustomers, onOpen])

  useEffect(() => {
    if (selectedCustomerId && selectedCustomerId.startsWith('cust_')) {
      void loadData()
    } else {
      setSequences([])
      setError(null)
    }
  }, [selectedCustomerId, loadData])

  useEffect(() => {
    if (selectedCustomerId && selectedCustomerId.startsWith('cust_')) {
      void loadFormOptions()
    }
  }, [selectedCustomerId, loadFormOptions])

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

  const handleOperatorQuickFilterChange = (nextFilter: SequenceOperatorQuickFilter) => {
    setOperatorQuickFilter(nextFilter)
    setStatusFilter('all')
  }

  const readinessSequenceOptions = useMemo(() => {
    return sequences
      .filter((sequence) => !!sequence.sequenceId)
      .map((sequence) => ({
        id: sequence.sequenceId as string,
        name: sequence.name,
      }))
  }, [sequences])

  useEffect(() => {
    if (!sequenceReadinessSequenceId) return
    const exists = readinessSequenceOptions.some((opt) => opt.id === sequenceReadinessSequenceId)
    if (!exists) {
      setSequenceReadinessSequenceId('')
      setSequenceReadinessData(null)
      setSequenceReadinessError(null)
      setSequencePreflightData(null)
      setSequencePreflightError(null)
      setLaunchPreviewData(null)
      setLaunchPreviewError(null)
      setRunHistoryData(null)
      setRunHistoryError(null)
      setPreviewVsOutcomeData(null)
      setPreviewVsOutcomeError(null)
      setExceptionCenterData(null)
      setExceptionCenterError(null)
    }
  }, [readinessSequenceOptions, sequenceReadinessSequenceId])

  useEffect(() => {
    if (!requestedSequenceId) return
    if (!readinessSequenceOptions.length) return
    const exists = readinessSequenceOptions.some((opt) => opt.id === requestedSequenceId)
    if (!exists) return
    setSequenceReadinessSequenceId(requestedSequenceId)
  }, [requestedSequenceId, readinessSequenceOptions])

  useEffect(() => {
    if (!requestedFocusPanel) return
    if (!isOperatorConsolePanelOpen) onOperatorConsolePanelOpen()
    const panelId = requestedFocusPanel
    const timer = window.setTimeout(() => {
      const panel = document.getElementById(panelId)
      if (!panel) return
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveFocusPanel(panelId)
    }, 75)
    return () => window.clearTimeout(timer)
  }, [requestedFocusPanel, sequenceReadinessSequenceId, loading, isOperatorConsolePanelOpen, onOperatorConsolePanelOpen])

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

  const selectedCustomerName = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId)?.name || 'No client selected',
    [customers, selectedCustomerId]
  )

  const totalOptOuts = useMemo(
    () => sequences.reduce((sum, sequence) => sum + Number(sequence.metrics?.unsubscribed || 0), 0),
    [sequences]
  )

  const activeMailboxCount = useMemo(
    () => senderIdentities.filter((sender) => sender.isActive !== false).length,
    [senderIdentities]
  )

  const sequenceRecentSentCount = operatorConsoleData?.queue.sentRecently ?? null

  const activeEnrollments = useMemo(
    () =>
      [...enrollments]
        .filter((enrollment) => enrollment.status === 'ACTIVE')
        .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()),
    [enrollments]
  )

  const currentTestRecipientsCount = useMemo(
    () => activeEnrollments.reduce((sum, enrollment) => sum + (enrollment.recipientCount || 0), 0),
    [activeEnrollments]
  )

  const liveAudienceSummary = useMemo(() => {
    if (!editingSequence?.listId) {
      return {
        label: 'No lead batch linked',
        detail: 'Start live sequence is blocked until a linked lead batch is selected.',
      }
    }
    if (linkedListSummaryLoading) {
      return {
        label: 'Loading linked lead batch…',
        detail: 'Fetching the current linked audience from backend truth.',
      }
    }
    if (linkedListSummary) {
      return {
        label: `Using lead batch: ${linkedListSummary.name}`,
        detail: `${linkedListSummary.contactCount} recipients are currently linked for Start live sequence.`,
      }
    }
    return {
      label: 'Using linked lead batch',
      detail: 'Start live sequence uses the linked live recipients.',
    }
  }, [editingSequence?.listId, linkedListSummary, linkedListSummaryLoading])

  const testAudienceSummary = useMemo(() => {
    if (activeEnrollments.length === 0) {
      return {
        label: 'No active test recipients',
        detail: 'Create an enrollment to test with a manual recipient or the linked lead batch.',
      }
    }
    if (activeEnrollments.length === 1) {
      const enrollment = activeEnrollments[0]
      return {
        label:
          enrollment.recipientSource === 'snapshot'
            ? `Current recipients: ${enrollment.recipientCount} from ${enrollment.sourceListName || 'the linked lead batch'}`
            : `Current recipients: ${enrollment.recipientCount} manual test recipient${enrollment.recipientCount === 1 ? '' : 's'}`,
        detail: `${describeEnrollmentAudience(enrollment)} · Active now`,
      }
    }
    return {
      label: `Current test recipients: ${currentTestRecipientsCount} across ${activeEnrollments.length} active enrollments`,
      detail: 'Test now only uses recipients from active enrollments.',
    }
  }, [activeEnrollments, currentTestRecipientsCount])

  const nextTestSendSummary = useMemo(() => {
    const firstBatchRow = launchPreviewData?.firstBatch?.[0]
    if (firstBatchRow) {
      return {
        label: firstBatchRow.scheduledFor ? formatDateTimeLabel(firstBatchRow.scheduledFor) : 'Ready to send now',
        detail: `${maskEmail(firstBatchRow.recipientEmail)} via ${firstBatchRow.identityEmail || 'assigned mailbox'}`,
      }
    }
    if ((launchPreviewData?.summary.eligibleCandidatesTotal ?? 0) > 0) {
      return {
        label: 'Queued after the first batch',
        detail: 'Eligible recipients exist, but none are in the first due test batch right now.',
      }
    }
    if ((sequenceReadinessData?.summary.blockedCount ?? 0) > 0) {
      return {
        label: 'Blocked right now',
        detail: 'Queued recipients exist, but current sending rules are blocking the next test send.',
      }
    }
    return {
      label: 'No queued test send ready yet',
      detail: 'Create or refresh an active enrollment, then refresh preview.',
    }
  }, [launchPreviewData, sequenceReadinessData])

  const lastSequenceOutcomeSummary = useMemo(() => {
    const lastRow = operatorOutcomeRows[0]
    if (!lastRow) {
      return {
        label: 'No recent activity',
        detail: 'Recent results will appear here after a test send or live send attempt.',
      }
    }
    return {
      label: `${humanizeOutcome(lastRow.outcome)}${lastRow.recipientEmail ? ` to ${maskEmail(lastRow.recipientEmail)}` : ''}`,
      detail: lastRow.identityEmail
        ? `${lastRow.identityEmail} · ${humanizeRunReason(lastRow.reason || lastRow.lastError)}`
        : humanizeRunReason(lastRow.reason || lastRow.lastError),
    }
  }, [operatorOutcomeRows])

  const sequenceStartBlockedReason = editingSequence ? validateStartRequirements(editingSequence) : 'Select a sequence.'
  const sequenceModalTestGateReason =
    sequencePreflightData && !sequencePreflightData.actions?.canLiveCanary
      ? sequencePreflightData.actions?.liveCanaryReason || 'Immediate test send is blocked by current launch gates.'
      : operatorConsoleData && !operatorConsoleData.status.manualLiveTickAllowed
        ? operatorConsoleData.status.manualLiveTickReason || operatorConsoleData.status.scheduledLiveReason || 'Immediate test send is blocked by current launch gates.'
        : null
  const sequenceModalTestDisabledReason =
    !selectedCustomerId?.startsWith('cust_')
      ? 'Select a client.'
      : !editingSequence?.sequenceId
        ? 'Save the sequence first.'
        : activeEnrollments.length < 1
          ? 'Create an active enrollment first.'
          : sequenceModalTestGateReason
            ? sequenceModalTestGateReason
            : null

  const launchStatusSummary = useMemo(() => {
    if (sequenceStartBlockedReason) {
      return {
        tone: 'error' as const,
        title: 'Blocked',
        detail: sequenceStartBlockedReason,
      }
    }
    if (editingSequence?.status === 'paused') {
      return {
        tone: 'warning' as const,
        title: 'Paused',
        detail: 'This sequence is paused. Resume it before expecting any live sending.',
      }
    }
    if (editingSequence?.status === 'sending' || editingSequence?.status === 'running') {
      return {
        tone: 'success' as const,
        title: 'Sending',
        detail: 'The live recipients are already active.',
      }
    }
    if (editingSequence?.status === 'scheduled') {
      return {
        tone: 'info' as const,
        title: 'Scheduled',
        detail: 'The live recipients are active and queued for sending.',
      }
    }
    if (editingSequence?.status === 'sent') {
      return {
        tone: 'success' as const,
        title: 'Completed',
        detail: 'This sequence has completed its live sends.',
      }
    }
    return {
      tone: 'info' as const,
      title: 'Ready to start',
      detail: 'Start live sequence uses the linked live recipients. Test audience is not used by this action.',
    }
  }, [editingSequence?.status, sequenceStartBlockedReason])

  const testLaunchSummary = useMemo(() => {
    if (sequenceModalTestDisabledReason) {
      return {
        tone: 'warning' as const,
        title: 'Test send unavailable',
        detail: humanizeGateReason(sequenceModalTestDisabledReason),
      }
    }
    if ((launchPreviewData?.summary.firstBatchCount ?? 0) > 0) {
      return {
        tone: 'success' as const,
        title: 'Test send available now',
        detail: 'Send test batch now uses up to 3 due recipients from active enrollments only.',
      }
    }
    return {
      tone: 'info' as const,
      title: 'Waiting for next queued test send',
      detail: nextTestSendSummary.detail,
    }
  }, [launchPreviewData?.summary.firstBatchCount, nextTestSendSummary.detail, sequenceModalTestDisabledReason])

  const nextActionSummary = useMemo(() => {
    if (sequenceModalTestDisabledReason && sequenceStartBlockedReason) {
      return {
        label: 'Needs setup first',
        detail: launchStatusSummary.detail,
      }
    }
    if (!sequenceModalTestDisabledReason && (launchPreviewData?.summary.firstBatchCount ?? 0) > 0) {
      return {
        label: 'Send test batch now',
        detail: 'This sends only to active test recipients, not the live recipients.',
      }
    }
    if (!sequenceStartBlockedReason) {
      if (editingSequence?.status === 'scheduled') {
        return {
          label: 'Queued for sending',
          detail: 'The live recipients are active and queued for sending.',
        }
      }
      if (editingSequence?.status === 'sending' || editingSequence?.status === 'running') {
        return {
          label: 'Sequence is sending',
          detail: 'The live recipients are already active.',
        }
      }
      if (editingSequence?.status === 'paused') {
        return {
          label: 'Resume when ready',
          detail: 'Resume the sequence before expecting more live sends.',
        }
      }
      return {
        label: 'Start sequence',
        detail: 'This uses the linked live recipients and starts the live sequence.',
      }
    }
    return {
      label: 'Review live recipients',
      detail: launchStatusSummary.detail,
    }
  }, [
    editingSequence?.status,
    launchPreviewData?.summary.firstBatchCount,
    launchStatusSummary.detail,
    sequenceModalTestDisabledReason,
    sequenceStartBlockedReason,
  ])

  const getSequenceLiveAudienceSummary = (sequence: SequenceCampaign) => {
    if (!sequence.listId) {
      return {
        label: 'No live recipients linked',
        detail: 'Start live sequence is blocked until live recipients are linked.',
      }
    }
    const snapshot = snapshots.find((row) => row.id === sequence.listId)
    const recipientCount = getRecipientCount(sequence)
    if (snapshot) {
      return {
        label: snapshot.name,
        detail: `${recipientCount.toLocaleString()} live recipient${recipientCount === 1 ? '' : 's'}.`,
      }
    }
    if (recipientCount > 0) {
      return {
        label: 'Linked live recipients',
        detail: `${recipientCount.toLocaleString()} recipient${recipientCount === 1 ? '' : 's'} linked for Start live sequence.`,
      }
    }
    return {
      label: 'Linked live recipients',
      detail: 'Open the sequence to review the current live recipients.',
    }
  }

  const getSequenceTestAudienceSummary = (sequence: SequenceCampaign) => {
    if (editingSequence?.id === sequence.id) {
      return testAudienceSummary
    }
    return {
      label: 'Review test recipients',
      detail: 'Open the sequence to see active test recipients.',
    }
  }

  const getSequenceBlockedReasonSummary = (
    sequence: SequenceCampaign,
    blockedReason: string
  ): Pick<SequenceOperatorStateSummary, 'reasonLabel' | 'detail' | 'nextActionLabel' | 'attentionLabel' | 'attentionColorScheme'> => {
    if (sequence.isArchived) {
      return {
        reasonLabel: 'Archived',
        detail: 'Restore it first if live outreach should use this sequence again.',
        nextActionLabel: 'Open',
        attentionLabel: 'Waiting',
        attentionColorScheme: 'orange',
      }
    }
    if (!sequence.name.trim()) {
      return {
        reasonLabel: 'Name missing',
        detail: 'Name the sequence before starting live outreach.',
        nextActionLabel: 'Fix blocker',
        attentionLabel: 'Fix now',
        attentionColorScheme: 'red',
      }
    }
    if (!sequence.listId) {
      return {
        reasonLabel: leadBatches.length === 0 ? 'No live recipients' : 'Live recipients not chosen',
        detail: leadBatches.length === 0
          ? 'Sync a live lead batch in Lead Sources before starting.'
          : 'Choose the live recipients for Start live sequence.',
        nextActionLabel: 'Fix blocker',
        attentionLabel: 'Fix now',
        attentionColorScheme: 'red',
      }
    }
    if (senderIdentities.length === 0) {
      return {
        reasonLabel: 'No active mailbox',
        detail: 'Connect a sending mailbox before this sequence can go live.',
        nextActionLabel: 'Fix blocker',
        attentionLabel: 'Fix now',
        attentionColorScheme: 'red',
      }
    }
    if (!sequence.senderIdentityId) {
      return {
        reasonLabel: 'Mailbox not selected',
        detail: 'Choose which mailbox should send this sequence.',
        nextActionLabel: 'Fix blocker',
        attentionLabel: 'Fix now',
        attentionColorScheme: 'red',
      }
    }
    if (templates.length === 0) {
      return {
        reasonLabel: 'No template ready',
        detail: 'Add at least one template before starting.',
        nextActionLabel: 'Fix blocker',
        attentionLabel: 'Fix now',
        attentionColorScheme: 'red',
      }
    }
    if (!sequence.sequenceId || !sequence.campaignId) {
      return {
        reasonLabel: 'Save changes first',
        detail: 'Save the latest sequence setup before starting.',
        nextActionLabel: 'Fix blocker',
        attentionLabel: 'Fix now',
        attentionColorScheme: 'red',
      }
    }
    if (snapshotsError || templatesError || sendersError) {
      return {
        reasonLabel: 'Loading error',
        detail: 'Refresh or fix the data loading errors before starting.',
        nextActionLabel: 'Open',
        attentionLabel: 'Fix now',
        attentionColorScheme: 'red',
      }
    }
    return {
      reasonLabel: 'Start requirements incomplete',
      detail: blockedReason,
      nextActionLabel: 'Fix blocker',
      attentionLabel: 'Fix now',
      attentionColorScheme: 'red',
    }
  }

  const getSequenceOperatorStateSummary = (sequence: SequenceCampaign): SequenceOperatorStateSummary => {
    if (sequence.isArchived) {
      return {
        label: 'Archived',
        colorScheme: 'purple',
        icon: ViewIcon,
        reasonLabel: 'Archived',
        detail: 'Hidden from the default list and preserved for reporting.',
        nextActionLabel: 'Open',
        nextActionColorScheme: 'gray',
        nextActionVariant: 'outline',
      }
    }

    const blockedReason = validateStartRequirements(sequence)
    if (blockedReason) {
      const blocker = getSequenceBlockedReasonSummary(sequence, blockedReason)
      return {
        label: 'Blocked',
        colorScheme: 'red',
        icon: InfoIcon,
        reasonLabel: blocker.reasonLabel,
        detail: blocker.detail,
        attentionLabel: blocker.attentionLabel,
        attentionColorScheme: blocker.attentionColorScheme,
        nextActionLabel: blocker.nextActionLabel,
        nextActionColorScheme: 'orange',
        nextActionVariant: 'outline',
      }
    }

    if (sequence.status === 'paused') {
      return {
        label: 'Paused',
        colorScheme: 'orange',
        icon: SettingsIcon,
        reasonLabel: 'Sequence paused',
        detail: 'Resume it before expecting more live sending.',
        attentionLabel: 'Waiting',
        attentionColorScheme: 'orange',
        nextActionLabel: 'Resume',
        nextActionColorScheme: 'blue',
        nextActionVariant: 'solid',
      }
    }

    if (sequence.status === 'sending' || sequence.status === 'running') {
      return {
        label: 'Running',
        colorScheme: 'blue',
        icon: EmailIcon,
        reasonLabel: 'Live send in progress',
        detail: 'The live recipients are already active.',
        nextActionLabel: 'Open',
        nextActionColorScheme: 'gray',
        nextActionVariant: 'outline',
      }
    }

    if (sequence.status === 'scheduled') {
      return {
        label: 'Blocked',
        colorScheme: 'orange',
        icon: CalendarIcon,
        reasonLabel: 'Waiting for send window',
        detail: 'Live recipients are queued and will send in the next allowed window.',
        attentionLabel: 'Waiting',
        attentionColorScheme: 'orange',
        nextActionLabel: 'Open',
        nextActionColorScheme: 'gray',
        nextActionVariant: 'outline',
      }
    }

    if (sequence.status === 'sent') {
      return {
        label: 'Completed',
        colorScheme: 'green',
        icon: CheckCircleIcon,
        reasonLabel: 'Completed',
        detail: 'This sequence has finished its live sends.',
        nextActionLabel: 'Open',
        nextActionColorScheme: 'gray',
        nextActionVariant: 'outline',
      }
    }

    return {
      label: 'Ready',
      colorScheme: 'green',
      icon: CheckCircleIcon,
      reasonLabel: 'Ready to send now',
      detail: 'Live recipients and mailbox are in place for starting.',
      nextActionLabel: 'Start',
      nextActionColorScheme: 'green',
      nextActionVariant: 'solid',
    }
  }

  const operatorVisibleSequences = (() => {
    const getSortPriority = (sequence: SequenceCampaign) => {
      const operatorState = getSequenceOperatorStateSummary(sequence).label
      switch (operatorState) {
        case 'Ready':
          return 0
        case 'Blocked':
        case 'Paused':
          return 1
        case 'Running':
          return 2
        case 'Completed':
          return 3
        case 'Archived':
          return 4
        default:
          return 5
      }
    }

    const matchesQuickFilter = (sequence: SequenceCampaign) => {
      if (!includeArchivedInList && sequence.isArchived) return false

      const operatorState = getSequenceOperatorStateSummary(sequence).label
      switch (operatorQuickFilter) {
        case 'ready':
          return operatorState === 'Ready'
        case 'needs_attention':
          return operatorState === 'Blocked' || operatorState === 'Paused'
        case 'running':
          return operatorState === 'Running'
        case 'archived':
          return operatorState === 'Archived'
        case 'all':
        default:
          return includeArchivedInList ? operatorState === 'Archived' : operatorState !== 'Archived'
      }
    }

    return [...filteredSequences]
      .filter((sequence) => matchesQuickFilter(sequence))
      .sort((left, right) => {
        const priorityDelta = getSortPriority(left) - getSortPriority(right)
        if (priorityDelta !== 0) return priorityDelta

        const leftTime = new Date(left.updatedAt || left.createdAt).getTime()
        const rightTime = new Date(right.updatedAt || right.createdAt).getTime()
        if (rightTime !== leftTime) return rightTime - leftTime

        return left.name.localeCompare(right.name)
      })
  })()

  const getSequenceLastResultSummary = (sequence: SequenceCampaign) => {
    if (editingSequence?.id === sequence.id) {
      return lastSequenceOutcomeSummary
    }
    if (sequence.status === 'paused') {
      return {
        label: 'Paused',
        detail: 'No live sending happens while paused.',
      }
    }
    if (sequence.status === 'scheduled') {
      return {
        label: 'Waiting',
        detail: 'No live send has happened in the current window yet.',
      }
    }
    if (sequence.status === 'sending' || sequence.status === 'running') {
      return {
        label: 'Sending',
        detail: 'Live send activity is in progress.',
      }
    }
    const sentCount = getSentCount(sequence)
    if (sentCount > 0) {
      return {
        label: 'Sent',
        detail: `${sentCount.toLocaleString()} email${sentCount === 1 ? '' : 's'} sent so far.`,
      }
    }
    return {
      label: 'No recent activity',
      detail: 'Open the sequence to review the latest send results.',
    }
  }

  const getSequenceNextAction = (sequence: SequenceCampaign) => {
    return getSequenceOperatorStateSummary(sequence).nextActionLabel
  }

  const getSequenceSendConfidenceSummary = (sequence: SequenceCampaign): SequenceSendConfidenceSignal[] => {
    const operatorState = getSequenceOperatorStateSummary(sequence)
    const hasActiveMailbox = sequence.senderIdentityId
      ? senderIdentities.some((sender) => sender.id === sequence.senderIdentityId)
      : false
    const mailboxSignal: SequenceSendConfidenceSignal = activeMailboxCount === 0
      ? { label: 'Mailbox', value: 'Missing', colorScheme: 'red' }
      : !sequence.senderIdentityId
        ? { label: 'Mailbox', value: 'Missing', colorScheme: 'red' }
        : !hasActiveMailbox
          ? { label: 'Mailbox', value: 'Blocked', colorScheme: 'orange' }
          : { label: 'Mailbox', value: 'Ready', colorScheme: 'green' }

    const audienceSignal: SequenceSendConfidenceSignal = !sequence.listId
      ? {
          label: 'Audience',
          value: leadBatches.length === 0 ? 'Empty' : 'Not chosen',
          colorScheme: 'red',
        }
      : editingSequence?.id === sequence.id && linkedListSummaryLoading
        ? { label: 'Audience', value: 'Unknown', colorScheme: 'gray' }
        : editingSequence?.id === sequence.id && linkedListSummary && linkedListSummary.contactCount === 0
          ? { label: 'Audience', value: 'Empty', colorScheme: 'red' }
          : { label: 'Audience', value: 'Ready', colorScheme: 'green' }

    const contentSignal: SequenceSendConfidenceSignal =
      sequence.stepCount === 0
        ? { label: 'Content', value: 'Missing', colorScheme: 'red' }
        : sequence.stepCount == null
          ? { label: 'Content', value: 'Unknown', colorScheme: 'gray' }
          : sequence.stepCount > 0
            ? { label: 'Content', value: 'Ready', colorScheme: 'green' }
            : { label: 'Content', value: 'Unknown', colorScheme: 'gray' }

    const windowSignal: SequenceSendConfidenceSignal =
      operatorState.reasonLabel === 'Waiting for send window' || sequence.status === 'scheduled'
        ? { label: 'Window', value: 'Waiting', colorScheme: 'orange' }
        : operatorState.label === 'Ready' || operatorState.label === 'Running'
          ? { label: 'Window', value: 'Ready', colorScheme: 'green' }
          : operatorState.label === 'Paused' || operatorState.label === 'Archived'
            ? { label: 'Window', value: 'Waiting', colorScheme: 'orange' }
            : { label: 'Window', value: 'Unknown', colorScheme: 'gray' }

    return [mailboxSignal, audienceSignal, contentSignal, windowSignal]
  }

  const getSequenceFixBlockerFocusTarget = (
    sequence: SequenceCampaign,
    reasonLabel: string
  ): SequenceEditorFocusTarget => {
    switch (reasonLabel) {
      case 'No live recipients':
      case 'Live recipients not chosen':
        return 'audience'
      case 'No active mailbox':
      case 'Mailbox not selected':
        return 'sender'
      case 'Name missing':
      case 'Save changes first':
        return 'details'
      case 'No template ready':
        return 'steps'
      case 'Start requirements incomplete':
        if (!sequence.name.trim() || !sequence.sequenceId || !sequence.campaignId) return 'details'
        if (!sequence.listId) return 'audience'
        if (senderIdentities.length === 0 || !sequence.senderIdentityId) return 'sender'
        if (templates.length === 0) return 'steps'
        return 'launch'
      case 'Loading error':
      case 'Archived':
      default:
        return 'launch'
    }
  }

  useEffect(() => {
    if (!isOpen || !editingSequence || !sequenceEditorFocusTarget) return

    const needsSetupOpen = sequenceEditorFocusTarget !== 'launch'
    if (editingSequence.id && needsSetupOpen && !isSequenceSetupOpen) return

    const focusTargetRef =
      sequenceEditorFocusTarget === 'details'
        ? sequenceNameInputRef.current
        : sequenceEditorFocusTarget === 'audience'
          ? sequenceAudienceSelectRef.current
          : sequenceEditorFocusTarget === 'sender'
            ? sequenceSenderSelectRef.current
            : null

    const scrollTarget =
      sequenceEditorFocusTarget === 'steps'
        ? sequenceStepsSectionRef.current
        : sequenceEditorFocusTarget === 'details'
          ? sequenceDetailsSectionRef.current
          : sequenceEditorFocusTarget === 'audience'
            ? sequenceAudienceSectionRef.current
            : sequenceEditorFocusTarget === 'sender'
              ? sequenceSenderSectionRef.current
              : sequenceLaunchSectionRef.current

    const frameId = window.requestAnimationFrame(() => {
      scrollTarget?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      focusTargetRef?.focus()
      setSequenceEditorFocusTarget(null)
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [editingSequence, isOpen, isSequenceSetupOpen, sequenceEditorFocusTarget])

  const handleSequencePrimaryAction = (sequence: SequenceCampaign) => {
    const operatorState = getSequenceOperatorStateSummary(sequence)
    const focusTarget =
      operatorState.nextActionLabel === 'Fix blocker'
        ? getSequenceFixBlockerFocusTarget(sequence, operatorState.reasonLabel)
        : operatorState.nextActionLabel === 'Open'
          ? 'launch'
          : null

    void handleEditSequence(sequence, focusTarget)
  }

  const handleCreateSequence = useCallback(() => {
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
    setIsSequenceSetupOpen(true)
    setSequenceValidationVisible(false)
    const nextSequence: SequenceCampaign = {
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
    }
    setEditingSequence(nextSequence)
    setSequenceStepOriginals(buildStepSnapshotMap(nextSequence.steps))
    setSequenceStepAiSuggestion({})
    setSequenceStepAiError({})
    setSequenceStepAiLoading({})
    onOpen()
  }, [templates.length, toast, onOpen])

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
    setSequenceStepOriginals((prev) => ({
      ...prev,
      [newStep.stepOrder]: toStepContentSnapshot(newStep),
    }))
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
    const remainingSteps = steps.filter((step) => step.stepOrder !== stepOrder)
    const updatedSteps = remainingSteps.map((step, index) => ({ ...step, stepOrder: index + 1 }))

    setEditingSequence({
      ...editingSequence,
      steps: updatedSteps,
    })
    setSequenceStepOriginals((prev) => {
      const next: Record<number, StepContentSnapshot> = {}
      remainingSteps.forEach((step, index) => {
        next[index + 1] = prev[step.stepOrder] || toStepContentSnapshot(step)
      })
      return next
    })
    setSequenceStepAiSuggestion((prev) => {
      const next: Record<number, StepContentSnapshot | null> = {}
      remainingSteps.forEach((step, index) => {
        if (prev[step.stepOrder]) next[index + 1] = prev[step.stepOrder]
      })
      return next
    })
    setSequenceStepAiError((prev) => {
      const next: Record<number, string | null> = {}
      remainingSteps.forEach((step, index) => {
        if (prev[step.stepOrder]) next[index + 1] = prev[step.stepOrder]
      })
      return next
    })
    setSequenceStepAiLoading((prev) => {
      const next: Record<number, boolean> = {}
      remainingSteps.forEach((step, index) => {
        if (prev[step.stepOrder]) next[index + 1] = prev[step.stepOrder]
      })
      return next
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
    const updatedStep = updatedSteps.find((step) => step.stepOrder === stepOrder)
    if (updatedStep) {
      setSequenceStepOriginals((prev) => ({
        ...prev,
        [stepOrder]: toStepContentSnapshot(updatedStep),
      }))
    }
    setSequenceStepAiSuggestion((prev) => {
      const next = { ...prev }
      delete next[stepOrder]
      return next
    })
    setSequenceStepAiError((prev) => {
      const next = { ...prev }
      delete next[stepOrder]
      return next
    })
    setSequenceStepAiLoading((prev) => {
      const next = { ...prev }
      delete next[stepOrder]
      return next
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

  const handleEditSequence = async (
    sequence: SequenceCampaign,
    focusTarget: SequenceEditorFocusTarget | null = null
  ) => {
    setMaterializedBatchKey(null)
    setIsSequenceSetupOpen(focusTarget !== null && focusTarget !== 'launch')
    setSequenceEditorFocusTarget(focusTarget)
    setSequenceValidationVisible(false)
    const nextSequence: SequenceCampaign = {
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
    }
    setEditingSequence(nextSequence)
    setSequenceStepOriginals(buildStepSnapshotMap(nextSequence.steps))
    setSequenceStepAiSuggestion({})
    setSequenceStepAiError({})
    setSequenceStepAiLoading({})
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
      setSequenceStepOriginals(buildStepSnapshotMap(loadedSteps))
      setSequenceStepAiSuggestion({})
      setSequenceStepAiError({})
      setSequenceStepAiLoading({})
    }
  }

  const handleSequenceStepRewriteWithAI = async (stepOrder: number, tone: AITone = 'professional') => {
    if (!editingSequence) return
    const step = editingSequence.steps?.find((item) => item.stepOrder === stepOrder)
    if (!step) return

    const baseContent = step.bodyTemplateText || htmlToPlainText(step.bodyTemplateHtml || '')
    if (!baseContent.trim()) {
      setSequenceStepAiError((prev) => ({
        ...prev,
        [stepOrder]: 'Add step content before using AI.',
      }))
      return
    }

    setSequenceStepOriginals((prev) => ({
      ...prev,
      [stepOrder]: prev[stepOrder] || toStepContentSnapshot(step),
    }))
    setSequenceStepAiLoading((prev) => ({ ...prev, [stepOrder]: true }))
    setSequenceStepAiError((prev) => ({ ...prev, [stepOrder]: null }))
    setSequenceStepAiSuggestion((prev) => ({ ...prev, [stepOrder]: null }))

    const headers = selectedCustomerId ? { 'X-Customer-Id': selectedCustomerId } : undefined
    const response = await api.post<{ tweakedBody?: string; tweakedSubject?: string }>(
      '/api/templates/ai/tweak',
      {
        templateBody: baseContent,
        templateSubject: step.subjectTemplate || undefined,
        contactCompany: selectedCustomerName !== 'No client selected' ? selectedCustomerName : undefined,
        tone,
        instruction: 'Improve the wording for this sequence step only. Keep placeholders and unsubscribe tokens exactly as written.',
        preservePlaceholders: true,
      },
      { headers },
    )

    setSequenceStepAiLoading((prev) => ({ ...prev, [stepOrder]: false }))

    if (response.error) {
      setSequenceStepAiError((prev) => ({
        ...prev,
        [stepOrder]: response.error,
      }))
      return
    }

    setSequenceStepAiSuggestion((prev) => ({
      ...prev,
      [stepOrder]: {
        subject: response.data?.tweakedSubject || step.subjectTemplate,
        content: response.data?.tweakedBody || baseContent,
      },
    }))
  }

  const applySequenceStepAiSuggestion = (stepOrder: number) => {
    const suggestion = sequenceStepAiSuggestion[stepOrder]
    if (!editingSequence || !suggestion) return

    const updatedSteps = (editingSequence.steps || []).map((step) =>
      step.stepOrder === stepOrder
        ? {
            ...step,
            subjectTemplate: suggestion.subject,
            bodyTemplateText: suggestion.content,
            bodyTemplateHtml: toHtmlBody(suggestion.content),
          }
        : step
    )

    setEditingSequence({
      ...editingSequence,
      steps: updatedSteps,
    })
    setSequenceStepAiSuggestion((prev) => ({ ...prev, [stepOrder]: null }))
    setSequenceStepAiError((prev) => ({ ...prev, [stepOrder]: null }))
  }

  const restoreSequenceStepOriginal = (stepOrder: number) => {
    const original = sequenceStepOriginals[stepOrder]
    if (!editingSequence || !original) return

    const updatedSteps = (editingSequence.steps || []).map((step) =>
      step.stepOrder === stepOrder
        ? {
            ...step,
            subjectTemplate: original.subject,
            bodyTemplateText: original.content,
            bodyTemplateHtml: toHtmlBody(original.content),
          }
        : step
    )

    setEditingSequence({
      ...editingSequence,
      steps: updatedSteps,
    })
    setSequenceStepAiSuggestion((prev) => ({ ...prev, [stepOrder]: null }))
    setSequenceStepAiError((prev) => ({ ...prev, [stepOrder]: null }))
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
    setSequenceValidationVisible(true)
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
      handleCloseSequenceEditor()
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

  function validateStartRequirements(sequence: SequenceCampaign) {
    if (!sequence.name.trim()) return 'Name this sequence before starting.'
    if (!sequence.listId) return leadBatches.length === 0 ? 'No live recipients are ready yet. Go to Lead Sources and sync a batch first.' : 'Choose the live recipients for Start live sequence.'
    if (templates.length === 0) return 'Add at least one template before starting.'
    if (senderIdentities.length === 0) return 'No sending mailbox is available yet.'
    if (!sequence.senderIdentityId) return 'Choose the mailbox that will send this sequence.'
    if (!sequence.sequenceId) return 'Save this sequence first.'
    if (!sequence.campaignId) return 'Save this sequence first.'
    if (snapshotsError || templatesError || sendersError) return 'Fix the loading errors before starting.'
    return null
  }

  const humanizeCampaignStatus = (status: string | null | undefined) => {
    switch ((status || '').trim().toLowerCase()) {
      case 'running':
        return 'sending'
      case 'paused':
        return 'paused'
      case 'completed':
        return 'completed'
      case 'draft':
        return 'draft'
      default:
        return status ? status.replace(/_/g, ' ') : 'saved'
    }
  }

  const buildSequenceDeleteMessage = (details: SequenceDeleteErrorDetails | undefined, fallback: string) => {
    if (details?.code !== 'sequence_linked_campaign') return fallback
    const linkedCampaign = details.campaigns?.[0]
    if (linkedCampaign) {
      const extraCount = Math.max((details.totalCampaigns || 0) - 1, 0)
      return `This sequence is still linked to the campaign "${linkedCampaign.name}" (${humanizeCampaignStatus(linkedCampaign.status)}). Delete or unlink that campaign first${extraCount > 0 ? `, plus ${extraCount} other linked campaign${extraCount === 1 ? '' : 's'}` : ''}.`
    }
    if ((details.totalCampaigns || 0) > 0) {
      return `This sequence is still linked to ${details.totalCampaigns} campaign${details.totalCampaigns === 1 ? '' : 's'}. Delete or unlink the linked campaign first.`
    }
    return fallback
  }

  const getSequenceDeleteReasonText = (
    campaign: NonNullable<SequenceDeleteErrorDetails['campaigns']>[number]
  ) => {
    switch (campaign.blockerReason) {
      case 'running_campaign':
        return 'This campaign is currently sending, so the sequence must stay attached.'
      case 'historical_campaign':
        return 'This campaign still preserves reporting/history through the sequence link.'
      case 'disposable_campaign_cleanup_possible':
        return 'This linked campaign has no meaningful send history and would be safe to clean up if no historical blockers remain.'
      default:
        return 'This campaign is still explicitly linked to the sequence.'
    }
  }

  const getSequenceDeleteStatusBadgeColor = (status: string | null | undefined) => {
    switch ((status || '').trim().toLowerCase()) {
      case 'running':
        return 'green'
      case 'paused':
        return 'orange'
      case 'completed':
        return 'blue'
      case 'draft':
        return 'gray'
      default:
        return 'purple'
    }
  }

  const getSequenceDeleteSummaryText = (details: SequenceDeleteErrorDetails | undefined) => {
    if (details?.code !== 'sequence_linked_campaign') {
      return 'This sequence is still linked to one or more campaigns.'
    }

    const summary = details.summary
    if ((summary?.runningCampaigns || 0) > 0) {
      return 'At least one linked campaign is still sending. Pause or finish the live campaign before deleting this sequence.'
    }
    if ((summary?.historicalCampaigns || 0) > 0) {
      if ((summary?.disposableCampaigns || 0) > 0) {
        return 'At least one linked campaign still preserves reporting/history. Disposable test wrappers can be cleaned up automatically, but deletion stays blocked while historical campaign history remains.'
      }
      return 'Completed or paused campaigns keep this sequence attached for historical reporting, so deletion stays blocked.'
    }
    return 'A draft campaign is still linked to this sequence. Remove that campaign link before deleting the sequence.'
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
  const canSaveDraft = !!editingSequence

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
      handleCloseSequenceEditor()
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

  const handleDeleteSequence = async (sequence: SequenceCampaign) => {
    if (!selectedCustomerId || !selectedCustomerId.startsWith('cust_')) return
    if (!canManageSequenceDestructiveActions) {
      toast({
        title: 'Delete restricted',
        description: SEQUENCE_DESTRUCTIVE_AUTHORITY_MESSAGE,
        status: 'info',
        duration: 5000,
      })
      return
    }
    const sequenceId = sequence.id
    if (deletingSequenceId) return
    setDeletingSequenceId(sequenceId)
    const deleteHeaders = { 'X-Customer-Id': selectedCustomerId }
    try {
      const deleteRes = await api.delete(`/api/sequences/${sequenceId}`, { headers: deleteHeaders })
      if (deleteRes.error) {
        const details = deleteRes.errorDetails?.details as SequenceDeleteErrorDetails | undefined
        if (details?.code === 'sequence_linked_campaign') {
          setSequenceDeleteBlockers({ sequence, details })
          onDeleteBlockedOpen()
          return
        }
        const forbiddenMessage = deleteRes.errorDetails?.status === 403
          ? deleteRes.error
          : buildSequenceDeleteMessage(details, deleteRes.error)
        toast({
          title: 'Failed to delete sequence',
          description: forbiddenMessage,
          status: 'error',
          duration: 7000,
        })
        return
      }
      const refreshedRows = await loadData()
      const stillVisible = Array.isArray(refreshedRows) && refreshedRows.some((row) => row.id === sequenceId)
      if (stillVisible) {
        toast({
          title: 'Delete not confirmed yet',
          description: 'The sequence is still in the list after refresh. Please retry in a few seconds.',
          status: 'warning',
          duration: 5000,
        })
        return
      }
      if (editingSequence?.id === sequenceId) {
        handleCloseSequenceEditor()
        setEditingSequence(null)
      }
      toast({
        title: 'Sequence deleted',
        description: 'Removed and confirmed from the latest list refresh.',
        status: 'success',
        duration: 3000,
      })
    } catch (deleteError: any) {
      toast({
        title: 'Failed to delete sequence',
        description: deleteError?.message || 'Unexpected error',
        status: 'error',
        duration: 5000,
      })
    } finally {
      setDeletingSequenceId((current) => (current === sequenceId ? null : current))
    }
  }

  const handleOpenDeleteBlockedSequence = async () => {
    if (!sequenceDeleteBlockers) return
    onDeleteBlockedClose()
    await handleEditSequence(sequenceDeleteBlockers.sequence)
  }

  const handleSetSequenceArchivedState = useCallback(async (
    sequence: SequenceCampaign,
    shouldArchive: boolean,
    options?: {
      closeDeleteBlockedModal?: boolean
      successTitle?: string
      successDescription?: string
    }
  ) => {
    if (!selectedCustomerId || !selectedCustomerId.startsWith('cust_')) return false
    if (!canManageSequenceDestructiveActions) {
      toast({
        title: `${shouldArchive ? 'Archive' : 'Unarchive'} restricted`,
        description: SEQUENCE_DESTRUCTIVE_AUTHORITY_MESSAGE,
        status: 'info',
        duration: 5000,
      })
      return false
    }
    if (archiveActionSequenceId) return false
    setArchiveActionSequenceId(sequence.id)
    try {
      const endpoint = shouldArchive ? 'archive' : 'unarchive'
      const actionLabel = shouldArchive ? 'archive' : 'unarchive'
      const response = await api.post(
        `/api/sequences/${sequence.id}/${endpoint}`,
        {},
        { headers: { 'X-Customer-Id': selectedCustomerId } }
      )
      if (response.error) {
        const description = response.errorDetails?.status === 403
          ? response.error
          : response.error
        toast({
          title: `Failed to ${actionLabel} sequence`,
          description,
          status: 'error',
          duration: 5000,
        })
        return false
      }

      await loadData()

      if (options?.closeDeleteBlockedModal) {
        setSequenceDeleteBlockers(null)
        onDeleteBlockedClose()
      }

      if (shouldArchive && editingSequence?.id === sequence.id && !includeArchivedInList) {
        handleCloseSequenceEditor()
        setEditingSequence(null)
      }

      toast({
        title: options?.successTitle ?? (shouldArchive ? 'Sequence archived' : 'Sequence unarchived'),
        description: options?.successDescription
          ?? (shouldArchive
            ? 'The sequence is preserved for historical reporting and hidden from the default list.'
            : 'The sequence is back in the active list.'),
        status: 'success',
        duration: 4000,
      })
      return true
    } catch (archiveError: any) {
      toast({
        title: `Failed to ${shouldArchive ? 'archive' : 'unarchive'} sequence`,
        description: archiveError?.message || 'Unexpected error',
        status: 'error',
        duration: 5000,
      })
      return false
    } finally {
      setArchiveActionSequenceId((current) => (current === sequence.id ? null : current))
    }
  }, [
    archiveActionSequenceId,
    canManageSequenceDestructiveActions,
    editingSequence?.id,
    handleCloseSequenceEditor,
    loadData,
    onDeleteBlockedClose,
    selectedCustomerId,
    includeArchivedInList,
    toast,
  ])

  const canArchiveBlockedSequence = Boolean(
    sequenceDeleteBlockers?.details.summary?.historicalCampaigns
    || sequenceDeleteBlockers?.details.campaigns?.some((campaign) => campaign.blockerReason === 'historical_campaign')
  )

  const handleArchiveBlockedSequence = async () => {
    if (!sequenceDeleteBlockers) return
    await handleSetSequenceArchivedState(sequenceDeleteBlockers.sequence, true, {
      closeDeleteBlockedModal: true,
      successTitle: 'Sequence archived instead',
      successDescription: 'The sequence was archived and preserved for historical campaign reporting.',
    })
  }

  if (!selectedCustomerId || !selectedCustomerId.startsWith('cust_')) {
    return (
      <RequireActiveClient>
        <Box id="sequences-tab-no-customer" data-testid="sequences-tab-no-customer" textAlign="center" py={10}>
          <Text>Please select a client to view sequences.</Text>
        </Box>
      </RequireActiveClient>
    )
  }

  if (loading && sequences.length === 0) {
    return (
      <RequireActiveClient>
        <Box id="sequences-tab-loading" data-testid="sequences-tab-loading" textAlign="center" py={10}>
          <Text>Loading sequences...</Text>
        </Box>
      </RequireActiveClient>
    )
  }

  return (
    <RequireActiveClient>
    <Box id="sequences-tab-panel" data-testid="sequences-tab-panel">
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
              const params = new URLSearchParams(window.location.search)
              params.set('view', 'templates')
              window.location.search = params.toString()
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
            Choose a sequence, confirm the live audience, then preview, start, or resume it.
          </Text>
          <Text fontSize="sm" color="gray.600" data-testid="sequences-tab-operator-cue">
            The main workflow keeps live audience, readiness, latest result, and the next operator action in focus.
          </Text>
          {!canManageSequenceDestructiveActions ? (
            <Text
              fontSize="xs"
              color="gray.500"
              data-testid="sequence-destructive-actions-restricted-note"
            >
              {SEQUENCE_DESTRUCTIVE_AUTHORITY_MESSAGE}
            </Text>
          ) : null}
          {activeFocusPanel && isDiagnosticsOpen ? (
            <Text id="sequences-tab-focus-panel" data-testid="sequences-tab-focus-panel" fontSize="xs" color="gray.500">
              Focused panel: {activeFocusPanel}
            </Text>
          ) : null}
          <HStack spacing={2} mt={1} data-testid="sequences-tab-view-toggle">
            <Badge colorScheme={isDiagnosticsOpen ? 'purple' : 'blue'}>
              {isDiagnosticsOpen ? 'Troubleshooting open' : 'Live outreach view'}
            </Badge>
            <Button
              id="sequences-tab-toggle-diagnostics"
              data-testid="sequences-tab-toggle-diagnostics"
              size="xs"
              variant={isDiagnosticsOpen ? 'outline' : 'ghost'}
              colorScheme={isDiagnosticsOpen ? 'purple' : 'gray'}
              onClick={isDiagnosticsOpen ? onDiagnosticsClose : onDiagnosticsOpen}
            >
              {isDiagnosticsOpen ? 'Hide troubleshooting tools' : 'Show troubleshooting tools'}
            </Button>
          </HStack>
          {isDiagnosticsOpen ? (
            <HStack spacing={2} mt={1} data-testid="sequences-tab-cross-nav">
              <Button
                size="xs"
                variant="outline"
                onClick={() => {
                  const params = new URLSearchParams(window.location.search)
                  params.set('view', 'readiness')
                  window.location.search = params.toString()
                }}
              >
                Open Readiness
              </Button>
              <Button
                size="xs"
                variant="outline"
                onClick={() => {
                  const params = new URLSearchParams(window.location.search)
                  params.set('view', 'reports')
                  window.location.search = params.toString()
                }}
              >
                Open Reports
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => {
                  const params = new URLSearchParams(window.location.search)
                  params.set('view', 'inbox')
                  window.location.search = params.toString()
                }}
              >
                Open Inbox
              </Button>
            </HStack>
          ) : null}
          <HStack spacing={4} mt={2}>
            <FormControl w="300px">
              <FormLabel fontSize="sm">Client</FormLabel>
              <Select
                value={selectedCustomerId}
                onChange={(e) => {
                  setSelectedCustomerId(e.target.value)
                }}
                placeholder="Select client"
                isDisabled={!canSelectCustomer}
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

      <SimpleGrid columns={{ base: 2, md: 3, xl: 6 }} spacing={4} mb={6}>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Client</StatLabel>
              <StatNumber fontSize="md">{selectedCustomerName}</StatNumber>
              <StatHelpText>{selectedCustomerId?.startsWith('cust_') ? 'Current outreach client' : 'Choose a client to continue'}</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Total sequences</StatLabel>
              <StatNumber>{stats.total}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Sent recently</StatLabel>
              <StatNumber>{sequenceRecentSentCount == null ? '—' : sequenceRecentSentCount.toLocaleString()}</StatNumber>
              <StatHelpText>{sequenceRecentSentCount == null ? 'Loads from recent send history' : 'Recent send attempts across this client'}</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Replies</StatLabel>
              <StatNumber>{stats.totalReplies.toLocaleString()}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Opt-outs</StatLabel>
              <StatNumber>{totalOptOuts.toLocaleString()}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Active mailboxes</StatLabel>
              <StatNumber>{activeMailboxCount.toLocaleString()}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>

      <Collapse in={isDiagnosticsOpen} animateOpacity>
      <Card mb={6}>
        <CardBody>
          <HStack mb={3} align="start" spacing={3} id="sequences-tab-core-workflow" data-testid="sequences-tab-core-workflow">
            <InfoIcon color="blue.500" mt={1} />
            <VStack align="start" spacing={0}>
              <Text fontSize="sm" fontWeight="semibold">Troubleshooting: backend launch state</Text>
              <Text fontSize="xs" color="gray.600">Refresh backend launch data, inspect queue health, and open deeper troubleshooting only when the main workflow needs explanation.</Text>
            </VStack>
          </HStack>
          <Heading
            id="sending-console-panel"
            data-testid="sending-console-panel"
            size="sm"
            mb={3}
            cursor="pointer"
            onClick={isOperatorConsolePanelOpen ? onOperatorConsolePanelClose : onOperatorConsolePanelOpen}
          >
            Backend launch diagnostics {isOperatorConsolePanelOpen ? '▼' : '▶'}
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
                  Troubleshooting data refreshes from backend truth.
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
                  <Collapse in={isDiagnosticsOpen} animateOpacity>
                    <VStack align="stretch" spacing={4} mb={4}>
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
                                Run Live Send Now
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
                                  Live send unavailable: {humanizeGateReason(liveCanaryActionDisabledReason)}
                                </Text>
                              )}
                              {Array.isArray(operatorConsoleData.status.liveGateReasons) && operatorConsoleData.status.liveGateReasons.length > 0 && (
                                <Text fontSize="xs" color="gray.500">
                                  Current gate blockers: {operatorConsoleData.status.liveGateReasons.map((reason) => humanizeGateReason(reason)).join(' | ')}
                                </Text>
                              )}
                              <Text id="sending-console-action-status" data-testid="sending-console-action-status" fontSize="xs" color="blue.600">
                                {operatorActionStatus || 'Idle. Use actions, then refresh/inspect samples to verify shared state.'}
                              </Text>
                            </VStack>
                            <Card id="sending-console-action-readiness" data-testid="sending-console-action-readiness" variant="outline">
                              <CardBody py={3}>
                                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={2}>
                                  <HStack justify="space-between" borderWidth="1px" borderRadius="md" px={2} py={1}>
                                    <Text fontSize="xs" color="gray.600">Dry-run tick</Text>
                                    <Badge colorScheme={dryRunActionDisabledReason ? 'orange' : 'green'}>
                                      {dryRunActionDisabledReason ? 'Blocked' : 'Ready'}
                                    </Badge>
                                  </HStack>
                                  <HStack justify="space-between" borderWidth="1px" borderRadius="md" px={2} py={1}>
                                    <Text fontSize="xs" color="gray.600">Live send now</Text>
                                    <Badge colorScheme={liveCanaryActionDisabledReason ? 'orange' : 'green'}>
                                      {liveCanaryActionDisabledReason ? 'Blocked' : 'Ready'}
                                    </Badge>
                                  </HStack>
                                </SimpleGrid>
                                <Text fontSize="xs" color="gray.500" mt={2}>
                                  Routes: {operatorConsoleData.status.dryRunTickRoute || '/api/send-worker/dry-run'} · {operatorConsoleData.status.liveCanaryTickRoute || '/api/send-worker/live-tick'}
                                </Text>
                              </CardBody>
                            </Card>
                            <Card id="sending-console-last-action-result" data-testid="sending-console-last-action-result" variant="outline">
                              <CardBody py={3}>
                                {!operatorLastActionResult ? (
                                  <Text fontSize="xs" color="gray.500">No action run yet in this session.</Text>
                                ) : (
                                  <VStack align="stretch" spacing={1}>
                                    <HStack justify="space-between">
                                      <Text fontSize="xs" color="gray.600">Last action</Text>
                                      <Badge colorScheme={operatorLastActionResult.success ? 'green' : 'red'}>
                                        {operatorLastActionResult.action === 'TEST_SEND'
                                          ? 'TEST SEND'
                                          : operatorLastActionResult.action.replace(/_/g, ' ')}
                                      </Badge>
                                    </HStack>
                                    <Text fontSize="xs">{operatorLastActionResult.summary}</Text>
                                    <Text fontSize="xs" color="gray.500">
                                      Started {new Date(operatorLastActionResult.startedAt).toLocaleString()} · Finished {new Date(operatorLastActionResult.finishedAt).toLocaleString()}
                                    </Text>
                                    <Text id="sending-console-backend-truth-refresh" data-testid="sending-console-backend-truth-refresh" fontSize="xs" color="gray.500">
                                      Backend truth refresh: {operatorLastActionResult.refreshedAt ? new Date(operatorLastActionResult.refreshedAt).toLocaleString() : 'not completed'}
                                    </Text>
                                  </VStack>
                                )}
                              </CardBody>
                            </Card>
                          </VStack>
                        </CardBody>
                      </Card>

                      <SimpleGrid columns={{ base: 2, md: 3, lg: 6 }} spacing={3}>
                        <Card><CardBody py={3}><Stat><StatLabel>Mode</StatLabel><StatNumber fontSize="md">{operatorConsoleData.status.scheduledEngineMode === 'LIVE_CANARY' ? 'LIVE' : operatorConsoleData.status.scheduledEngineMode}</StatNumber></Stat></CardBody></Card>
                        <Card><CardBody py={3}><Stat><StatLabel>Scheduled</StatLabel><StatNumber fontSize="md">{operatorConsoleData.status.scheduledEnabled ? 'On' : 'Off'}</StatNumber></Stat></CardBody></Card>
                        <Card><CardBody py={3}><Stat><StatLabel>Live Allowed</StatLabel><StatNumber fontSize="md">{operatorConsoleData.status.scheduledLiveAllowed ? 'Yes' : 'No'}</StatNumber></Stat></CardBody></Card>
                        <Card><CardBody py={3}><Stat><StatLabel>Cron</StatLabel><StatNumber fontSize="sm">{operatorConsoleData.status.cron}</StatNumber></Stat></CardBody></Card>
                        <Card><CardBody py={3}><Stat><StatLabel>Live approval</StatLabel><StatNumber fontSize="md">{operatorConsoleData.status.scheduledLiveAllowed ? 'Ready' : 'Blocked'}</StatNumber></Stat></CardBody></Card>
                        <Card><CardBody py={3}><Stat><StatLabel>Live Cap</StatLabel><StatNumber fontSize="md">{operatorConsoleData.status.liveSendCap}</StatNumber></Stat></CardBody></Card>
                      </SimpleGrid>
                      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
                        <Card><CardBody py={3}><Stat><StatLabel>Due now</StatLabel><StatNumber>{operatorConsoleData.status.dueNowCount ?? 0}</StatNumber></Stat></CardBody></Card>
                        <Card><CardBody py={3}><Stat><StatLabel>Active identities</StatLabel><StatNumber>{operatorConsoleData.status.activeIdentityCount ?? 0}</StatNumber></Stat></CardBody></Card>
                        <Card><CardBody py={3}><Stat><StatLabel>Manual live tick</StatLabel><StatNumber fontSize="sm">{operatorConsoleData.status.manualLiveTickAllowed ? 'Allowed' : 'Blocked'}</StatNumber></Stat></CardBody></Card>
                        <Card><CardBody py={3}><Stat><StatLabel>Manual reason</StatLabel><StatNumber fontSize="xs">{operatorConsoleData.status.manualLiveTickReason ?? '—'}</StatNumber></Stat></CardBody></Card>
                      </SimpleGrid>
                    </VStack>
                  </Collapse>

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

                  <Card id="operator-test-send-panel" data-testid="operator-test-send-panel">
                    <CardBody>
                      <VStack align="stretch" spacing={3}>
                        <Flex justify="space-between" align="center" flexWrap="wrap" gap={2}>
                          <Text fontSize="sm" fontWeight="semibold">Immediate test send</Text>
                          <Badge colorScheme={operatorTestSendDisabledReason ? 'orange' : 'green'}>
                            {operatorTestSendDisabledReason ? 'Blocked' : 'Ready'}
                          </Badge>
                        </Flex>
                        <Text fontSize="sm" color="gray.600">
                          Send up to 3 queued recipients from the selected sequence now so staff can verify real delivery and outcome visibility without waiting for the next cycle.
                        </Text>
                        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
                          <Card variant="outline"><CardBody py={3}><Stat><StatLabel>Selected sequence</StatLabel><StatNumber fontSize="sm">{sequencePreflightData?.sequenceName || sequences.find((row) => row.id === sequenceReadinessSequenceId)?.name || 'Choose a sequence'}</StatNumber></Stat></CardBody></Card>
                          <Card variant="outline"><CardBody py={3}><Stat><StatLabel>First batch ready</StatLabel><StatNumber>{launchPreviewData?.summary.firstBatchCount ?? 0}</StatNumber></Stat></CardBody></Card>
                          <Card variant="outline"><CardBody py={3}><Stat><StatLabel>Immediate send</StatLabel><StatNumber fontSize="sm">{operatorConsoleData.status.manualLiveTickAllowed ? 'Available' : 'Blocked'}</StatNumber></Stat></CardBody></Card>
                        </SimpleGrid>
                        {operatorTestSendDisabledReason ? (
                          <Alert status="warning" size="sm">
                            <AlertIcon />
                            <AlertDescription>{humanizeGateReason(operatorTestSendDisabledReason)}</AlertDescription>
                          </Alert>
                        ) : null}
                        <HStack spacing={2}>
                          <Button
                            colorScheme="blue"
                            onClick={handleOperatorTestSend}
                            isLoading={operatorTestSendLoading}
                            isDisabled={Boolean(operatorTestSendDisabledReason)}
                          >
                            Send test batch now
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => loadLaunchPreview()}
                            isLoading={launchPreviewLoading}
                            isDisabled={!sequenceReadinessSequenceId}
                          >
                            Refresh next send
                          </Button>
                        </HStack>
                      </VStack>
                    </CardBody>
                  </Card>

                  <Card id="sequence-preflight-panel" data-testid="sequence-preflight-panel">
                    <CardBody>
                      <VStack align="stretch" spacing={3}>
                        <Flex justify="space-between" align="center" flexWrap="wrap" gap={2}>
                          <HStack spacing={2}>
                            <Text fontSize="sm" fontWeight="semibold">Sequence Preflight</Text>
                            <Badge
                              id="sequence-preflight-overall-status"
                              data-testid="sequence-preflight-overall-status"
                              colorScheme={
                                sequencePreflightData?.overallStatus === 'GO'
                                  ? 'green'
                                  : sequencePreflightData?.overallStatus === 'WARNING'
                                    ? 'orange'
                                    : 'red'
                              }
                            >
                              {sequencePreflightData?.overallStatus ?? 'NO_GO'}
                            </Badge>
                          </HStack>
                          <Button
                            id="sequence-preflight-refresh-btn"
                            data-testid="sequence-preflight-refresh-btn"
                            size="sm"
                            variant="outline"
                            onClick={() => loadSequencePreflight()}
                            isLoading={sequencePreflightLoading}
                            isDisabled={!sequenceReadinessSequenceId}
                          >
                            Refresh Preflight
                          </Button>
                        </Flex>

                        {sequencePreflightError && (
                          <Alert status="error" size="sm">
                            <AlertIcon />
                            <AlertDescription>{sequencePreflightError}</AlertDescription>
                          </Alert>
                        )}

                        {!sequencePreflightError && sequencePreflightData && (
                          <>
                            <SimpleGrid id="sequence-preflight-checks" data-testid="sequence-preflight-checks" columns={{ base: 1, md: 2, lg: 3 }} spacing={2}>
                              {Object.entries(sequencePreflightData.checks || {}).map(([key, value]) => (
                                <HStack key={key} justify="space-between" borderWidth="1px" borderRadius="md" px={2} py={1}>
                                  <Text fontSize="xs" color="gray.600">{key}</Text>
                                  <Badge colorScheme={value ? 'green' : 'red'}>{value ? 'PASS' : 'FAIL'}</Badge>
                                </HStack>
                              ))}
                            </SimpleGrid>
                            <SimpleGrid id="sequence-preflight-counts" data-testid="sequence-preflight-counts" columns={{ base: 2, md: 5 }} spacing={2}>
                              {Object.entries(sequencePreflightData.counts || {}).map(([key, value]) => (
                                <HStack key={key} justify="space-between" borderWidth="1px" borderRadius="md" px={2} py={1}>
                                  <Text fontSize="xs" color="gray.600">{key}</Text>
                                  <Badge>{value}</Badge>
                                </HStack>
                              ))}
                            </SimpleGrid>
                            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                              <Box id="sequence-preflight-blockers" data-testid="sequence-preflight-blockers" borderWidth="1px" borderRadius="md" p={3}>
                                <Text fontSize="sm" fontWeight="semibold" mb={2}>Blockers</Text>
                                {(sequencePreflightData.blockers || []).length === 0 ? (
                                  <Text fontSize="xs" color="gray.500">No blockers.</Text>
                                ) : (
                                  <VStack align="stretch" spacing={1}>
                                    {(sequencePreflightData.blockers || []).map((msg, idx) => (
                                      <Text key={`${msg}-${idx}`} fontSize="xs" color="red.600">• {msg}</Text>
                                    ))}
                                  </VStack>
                                )}
                              </Box>
                              <Box id="sequence-preflight-warnings" data-testid="sequence-preflight-warnings" borderWidth="1px" borderRadius="md" p={3}>
                                <Text fontSize="sm" fontWeight="semibold" mb={2}>Warnings</Text>
                                {(sequencePreflightData.warnings || []).length === 0 ? (
                                  <Text fontSize="xs" color="gray.500">No warnings.</Text>
                                ) : (
                                  <VStack align="stretch" spacing={1}>
                                    {(sequencePreflightData.warnings || []).map((msg, idx) => (
                                      <Text key={`${msg}-${idx}`} fontSize="xs" color="orange.600">• {msg}</Text>
                                    ))}
                                  </VStack>
                                )}
                              </Box>
                            </SimpleGrid>
                            <Card id="sequence-preflight-next-action" data-testid="sequence-preflight-next-action" variant="outline">
                              <CardBody py={3}>
                                <VStack align="stretch" spacing={1}>
                                  <Text fontSize="xs" color="gray.600">Next safe action</Text>
                                  <Text fontSize="sm">{sequencePreflightData.actions?.nextSafeAction || 'Review blockers/warnings first.'}</Text>
                                  <Text fontSize="xs" color="gray.500">
                                    Dry-run: {sequencePreflightData.actions?.canDryRun ? 'ready' : 'blocked'} · Live send: {sequencePreflightData.actions?.canLiveCanary ? 'ready' : 'blocked'}
                                    {sequencePreflightData.actions?.liveCanaryReason ? ` (${sequencePreflightData.actions.liveCanaryReason})` : ''}
                                  </Text>
                                  {isDiagnosticsOpen ? (
                                    <Text
                                      id="sequence-preflight-identity-guardrail"
                                      data-testid="sequence-preflight-identity-guardrail"
                                      fontSize="xs"
                                      color="gray.500"
                                    >
                                      Identity guardrails: usable={sequencePreflightData.dependencies?.identityCapacity?.summary?.usable ?? 0}
                                      {' '}risky={sequencePreflightData.dependencies?.identityCapacity?.summary?.risky ?? 0}
                                      {' '}unavailable={sequencePreflightData.dependencies?.identityCapacity?.summary?.unavailable ?? 0}
                                      {' '}preferredState={sequencePreflightData.dependencies?.identityCapacity?.summary?.preferredIdentityState ?? 'n/a'}
                                    </Text>
                                  ) : null}
                                  <HStack spacing={2}>
                                    <Button
                                      size="xs"
                                      variant="ghost"
                                      id="sequence-preflight-drilldown-readiness"
                                      data-testid="sequence-preflight-drilldown-readiness"
                                      onClick={() => loadSequenceReadiness(sequenceReadinessSequenceId)}
                                      isDisabled={!sequenceReadinessSequenceId}
                                    >
                                      Open readiness
                                    </Button>
                                    <Button
                                      size="xs"
                                      variant="ghost"
                                      id="sequence-preflight-drilldown-workbench"
                                      data-testid="sequence-preflight-drilldown-workbench"
                                      onClick={() => {
                                        if (!isDiagnosticsOpen) onDiagnosticsOpen()
                                        setQueueWorkbenchState('blocked')
                                      }}
                                    >
                                      Open blocked queue
                                    </Button>
                                    <Button
                                      size="xs"
                                      variant="ghost"
                                      id="sequence-preflight-drilldown-reporting"
                                      data-testid="sequence-preflight-drilldown-reporting"
                                      onClick={() => {
                                        if (!isDiagnosticsOpen) onDiagnosticsOpen()
                                        loadOpsReporting()
                                      }}
                                    >
                                      Open reporting
                                    </Button>
                                  </HStack>
                                </VStack>
                              </CardBody>
                            </Card>
                            <Text id="sequence-preflight-last-updated" data-testid="sequence-preflight-last-updated" fontSize="xs" color="gray.500">
                              Last updated: {sequencePreflightData.lastUpdatedAt ? new Date(sequencePreflightData.lastUpdatedAt).toLocaleString() : '—'}
                            </Text>
                          </>
                        )}
                      </VStack>
                    </CardBody>
                  </Card>

                  <Collapse in={isDiagnosticsOpen} animateOpacity>
                    <Card id="identity-capacity-panel" data-testid="identity-capacity-panel" mb={4}>
                      <CardBody>
                        <VStack align="stretch" spacing={3}>
                          <Flex justify="space-between" align="center" flexWrap="wrap" gap={2}>
                            <Text fontSize="sm" fontWeight="semibold">Identity Capacity & Sending Guardrails</Text>
                            <Button
                              id="identity-capacity-refresh-btn"
                              data-testid="identity-capacity-refresh-btn"
                              size="sm"
                              variant="outline"
                              onClick={() => loadIdentityCapacity()}
                              isLoading={identityCapacityLoading}
                            >
                              Refresh Identity Capacity
                            </Button>
                          </Flex>

                          {identityCapacityError && (
                            <Alert status="error" size="sm">
                              <AlertIcon />
                              <AlertDescription>{identityCapacityError}</AlertDescription>
                            </Alert>
                          )}

                          {!identityCapacityError && identityCapacityData && (
                            <>
                              <SimpleGrid id="identity-capacity-summary" data-testid="identity-capacity-summary" columns={{ base: 2, md: 5 }} spacing={2}>
                                <Card><CardBody py={2}><Stat><StatLabel>Total identities</StatLabel><StatNumber>{identityCapacityData.summary.total ?? 0}</StatNumber></Stat></CardBody></Card>
                                <Card><CardBody py={2}><Stat><StatLabel>Usable</StatLabel><StatNumber color="green.600">{identityCapacityData.summary.usable ?? 0}</StatNumber></Stat></CardBody></Card>
                                <Card><CardBody py={2}><Stat><StatLabel>Unavailable</StatLabel><StatNumber color="gray.600">{identityCapacityData.summary.unavailable ?? 0}</StatNumber></Stat></CardBody></Card>
                                <Card><CardBody py={2}><Stat><StatLabel>Risky</StatLabel><StatNumber color="orange.600">{identityCapacityData.summary.risky ?? 0}</StatNumber></Stat></CardBody></Card>
                                <Card><CardBody py={2}><Stat><StatLabel>Recommended</StatLabel><StatNumber fontSize="sm">{identityCapacityData.summary.recommendedIdentityId ? '1' : '0'}</StatNumber><StatHelpText>{identityCapacityData.summary.recommendedIdentityId || 'none'}</StatHelpText></Stat></CardBody></Card>
                              </SimpleGrid>

                              {(identityCapacityData.guardrails?.warnings || []).length > 0 && (
                                <Alert id="identity-capacity-guardrails" data-testid="identity-capacity-guardrails" status="warning" size="sm">
                                  <AlertIcon />
                                  <AlertDescription>
                                    {(identityCapacityData.guardrails?.warnings || []).join(' | ')}
                                  </AlertDescription>
                                </Alert>
                              )}

                              <Box id="identity-capacity-rows" data-testid="identity-capacity-rows" overflowX="auto">
                                <Table size="sm">
                                  <Thead>
                                    <Tr>
                                      <Th>Identity</Th>
                                      <Th>Provider</Th>
                                      <Th>State</Th>
                                      <Th>Recent outcomes</Th>
                                      <Th>Queue pressure</Th>
                                      <Th>Guardrails</Th>
                                    </Tr>
                                  </Thead>
                                  <Tbody>
                                    {(identityCapacityData.rows || []).length === 0 ? (
                                      <Tr>
                                        <Td colSpan={6} color="gray.500">No identities found for this client.</Td>
                                      </Tr>
                                    ) : (identityCapacityData.rows || []).map((row) => (
                                      <Tr key={row.identityId}>
                                        <Td fontSize="xs">
                                          <Text>{row.label || row.email}</Text>
                                          <Text color="gray.500">{row.email}</Text>
                                          {row.identityId === identityCapacityData.summary.preferredIdentityId ? (
                                            <Badge size="sm" colorScheme="blue" mt={1}>Preferred for selected sequence</Badge>
                                          ) : null}
                                          {row.identityId === identityCapacityData.summary.recommendedIdentityId ? (
                                            <Badge size="sm" colorScheme="green" mt={1} ml={1}>Recommended now</Badge>
                                          ) : null}
                                        </Td>
                                        <Td fontSize="xs">{row.provider}</Td>
                                        <Td>
                                          <Badge
                                            id="identity-capacity-state-badge"
                                            data-testid="identity-capacity-state-badge"
                                            colorScheme={row.state === 'usable' ? 'green' : row.state === 'risky' ? 'orange' : 'gray'}
                                          >
                                            {row.state}
                                          </Badge>
                                          {!row.isActive ? <Text fontSize="xs" color="gray.500">inactive</Text> : null}
                                          {(row.reasons || []).length > 0 ? <Text fontSize="xs" color="gray.500">{row.reasons.join(', ')}</Text> : null}
                                        </Td>
                                        <Td fontSize="xs">
                                          sent={row.recent?.sent ?? 0} failed={row.recent?.sendFailed ?? 0} would_send={row.recent?.wouldSend ?? 0}
                                        </Td>
                                        <Td fontSize="xs">queuedNow={row.queuePressure?.queuedNow ?? 0}</Td>
                                        <Td fontSize="xs">
                                          {row.guardrails?.dailySendLimit ? `dailyCap=${row.guardrails.dailySendLimit}` : 'dailyCap=—'}
                                          <br />
                                          {row.guardrails?.sendWindowTimeZone ? `${row.guardrails.sendWindowTimeZone} ${row.guardrails.sendWindowHoursStart ?? '—'}-${row.guardrails.sendWindowHoursEnd ?? '—'}` : 'window=—'}
                                        </Td>
                                      </Tr>
                                    ))}
                                  </Tbody>
                                </Table>
                              </Box>

                              <Text id="identity-capacity-last-updated" data-testid="identity-capacity-last-updated" fontSize="xs" color="gray.500">
                                Last updated: {identityCapacityData.lastUpdatedAt ? new Date(identityCapacityData.lastUpdatedAt).toLocaleString() : '—'} | Route: /api/send-worker/identity-capacity
                              </Text>
                            </>
                          )}
                        </VStack>
                      </CardBody>
                    </Card>
                  </Collapse>

                  <Card id="sequence-readiness-panel" data-testid="sequence-readiness-panel">
                    <CardBody>
                      <VStack align="stretch" spacing={3}>
                        <Flex gap={3} align="end" flexWrap="wrap">
                          <FormControl maxW="360px">
                            <FormLabel fontSize="xs" mb={1}>Sequence Readiness</FormLabel>
                            <Select
                              id="sequence-readiness-select"
                              data-testid="sequence-readiness-select"
                              size="sm"
                              placeholder="Select sequence"
                              value={sequenceReadinessSequenceId}
                              onChange={(e) => {
                                const nextId = e.target.value
                                setSequenceReadinessSequenceId(nextId)
                                if (nextId) {
                                  loadSequenceReadiness(nextId)
                                  loadSequencePreflight(nextId)
                                  loadLaunchPreview(nextId)
                                  loadRunHistory(nextId)
                                  loadPreviewVsOutcome(nextId)
                                  loadExceptionCenter(nextId)
                                }
                                else {
                                  setSequenceReadinessData(null)
                                  setSequenceReadinessError(null)
                                  setSequencePreflightData(null)
                                  setSequencePreflightError(null)
                                  setLaunchPreviewData(null)
                                  setLaunchPreviewError(null)
                                  loadRunHistory('')
                                  setPreviewVsOutcomeData(null)
                                  setPreviewVsOutcomeError(null)
                                  loadExceptionCenter('')
                                }
                              }}
                            >
                              {readinessSequenceOptions.map((opt) => (
                                <option key={opt.id} value={opt.id}>{opt.name}</option>
                              ))}
                            </Select>
                          </FormControl>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              loadSequenceReadiness()
                              loadSequencePreflight()
                              loadLaunchPreview()
                              loadRunHistory()
                              loadPreviewVsOutcome()
                              loadExceptionCenter()
                            }}
                            isLoading={sequenceReadinessLoading || sequencePreflightLoading || launchPreviewLoading || runHistoryLoading || previewVsOutcomeLoading || exceptionCenterLoading}
                            isDisabled={!sequenceReadinessSequenceId}
                          >
                            Refresh readiness
                          </Button>
                          <Text fontSize="xs" color="gray.500">
                            Shows who is ready, blocked, or excluded right now.
                          </Text>
                        </Flex>

                        {sequenceReadinessError && (
                          <Alert status="error" size="sm">
                            <AlertIcon />
                            <AlertDescription>{sequenceReadinessError}</AlertDescription>
                          </Alert>
                        )}

                        {!sequenceReadinessError && sequenceReadinessData && (
                          <>
                            <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
                              <Card><CardBody py={3}><Stat><StatLabel>Recipients</StatLabel><StatNumber>{sequenceReadinessData.summary.totalRecipients ?? 0}</StatNumber></Stat></CardBody></Card>
                              <Card><CardBody py={3}><Stat><StatLabel>Eligible</StatLabel><StatNumber color="green.600">{sequenceReadinessData.summary.eligibleCount ?? 0}</StatNumber></Stat></CardBody></Card>
                              <Card><CardBody py={3}><Stat><StatLabel>Excluded</StatLabel><StatNumber color="orange.600">{sequenceReadinessData.summary.excludedCount ?? 0}</StatNumber></Stat></CardBody></Card>
                              <Card><CardBody py={3}><Stat><StatLabel>Blocked</StatLabel><StatNumber color="red.500">{sequenceReadinessData.summary.blockedCount ?? 0}</StatNumber></Stat></CardBody></Card>
                            </SimpleGrid>
                            <SimpleGrid id="sequence-readiness-breakdown" data-testid="sequence-readiness-breakdown" columns={{ base: 2, md: 4 }} spacing={2}>
                              {Object.entries(sequenceReadinessData.breakdown ?? {}).map(([k, v]) => (
                                <HStack key={k} justify="space-between" borderWidth="1px" borderRadius="md" px={2} py={1}>
                                  <Text fontSize="xs" color="gray.600">{k}</Text>
                                  <Badge>{v}</Badge>
                                </HStack>
                              ))}
                            </SimpleGrid>

                            <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={3}>
                              {([
                                ['eligible', 'Eligible samples'],
                                ['excluded', 'Excluded samples'],
                                ['blocked', 'Blocked samples'],
                              ] as Array<[keyof SequenceReadinessData['samples'], string]>).map(([key, label]) => {
                                const rows = sequenceReadinessData.samples?.[key] ?? []
                                return (
                                  <Card key={key}>
                                    <CardBody>
                                      <Text fontSize="sm" fontWeight="semibold" mb={2}>{label} ({rows.length})</Text>
                                      <Box overflowX="auto">
                                        <Table size="sm">
                                          <Thead>
                                            <Tr>
                                              <Th>Recipient</Th>
                                              <Th>Reason</Th>
                                              <Th>Status</Th>
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
                                                <Td fontSize="xs">{row.reason}</Td>
                                                <Td><Badge size="sm" variant="outline">{row.status}</Badge></Td>
                                                <Td>
                                                  <HStack spacing={1}>
                                                    <Button size="xs" variant="ghost" isDisabled={!row.enrollmentId} onClick={() => openQueueModal(row.enrollmentId)}>
                                                      Queue
                                                    </Button>
                                                    <Button size="xs" variant="ghost" onClick={() => openAuditPanelForQueueItem(row.queueItemId)}>
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
                    </CardBody>
                  </Card>

                  <Card id="launch-preview-panel" data-testid="launch-preview-panel">
                    <CardBody>
                      <VStack align="stretch" spacing={3}>
                        <Flex justify="space-between" align="center" flexWrap="wrap" gap={2}>
                          <Text fontSize="sm" fontWeight="semibold">Preview Next Send</Text>
                          <Button
                            id="launch-preview-refresh-btn"
                            data-testid="launch-preview-refresh-btn"
                            size="sm"
                            variant="outline"
                            onClick={() => loadLaunchPreview()}
                            isLoading={launchPreviewLoading}
                            isDisabled={!sequenceReadinessSequenceId}
                          >
                            Refresh Preview
                          </Button>
                        </Flex>
                        {launchPreviewError && (
                          <Alert status="error" size="sm">
                            <AlertIcon />
                            <AlertDescription>{launchPreviewError}</AlertDescription>
                          </Alert>
                        )}
                        {!launchPreviewError && launchPreviewData && (
                          <>
                            <SimpleGrid id="launch-preview-first-batch-summary" data-testid="launch-preview-first-batch-summary" columns={{ base: 2, md: 3, lg: 6 }} spacing={2}>
                              <Card><CardBody py={2}><Stat><StatLabel>Total recipients</StatLabel><StatNumber>{launchPreviewData.summary.totalRecipients ?? 0}</StatNumber></Stat></CardBody></Card>
                              <Card><CardBody py={2}><Stat><StatLabel>Eligible total</StatLabel><StatNumber>{launchPreviewData.summary.eligibleCandidatesTotal ?? 0}</StatNumber></Stat></CardBody></Card>
                              <Card><CardBody py={2}><Stat><StatLabel>First batch</StatLabel><StatNumber>{launchPreviewData.summary.firstBatchCount ?? 0}</StatNumber></Stat></CardBody></Card>
                              <Card><CardBody py={2}><Stat><StatLabel>Excluded</StatLabel><StatNumber>{launchPreviewData.summary.excludedCount ?? 0}</StatNumber></Stat></CardBody></Card>
                              <Card><CardBody py={2}><Stat><StatLabel>Blocked</StatLabel><StatNumber>{launchPreviewData.summary.blockedCount ?? 0}</StatNumber></Stat></CardBody></Card>
                              <Card><CardBody py={2}><Stat><StatLabel>Not in batch</StatLabel><StatNumber>{launchPreviewData.summary.notInBatchCount ?? 0}</StatNumber></Stat></CardBody></Card>
                            </SimpleGrid>

                            <Box id="launch-preview-candidate-table" data-testid="launch-preview-candidate-table" overflowX="auto">
                              <Text fontSize="sm" fontWeight="semibold" mb={2}>First-batch candidates ({launchPreviewData.firstBatch.length})</Text>
                              <Table size="sm">
                                <Thead>
                                  <Tr>
                                    <Th>Recipient</Th>
                                    <Th>Sequence / Enrollment</Th>
                                    <Th>Identity</Th>
                                    <Th>Step</Th>
                                    <Th>Scheduled</Th>
                                    <Th>Subject preview</Th>
                                    <Th>Actions</Th>
                                  </Tr>
                                </Thead>
                                <Tbody>
                                  {launchPreviewData.firstBatch.length === 0 ? (
                                    <Tr>
                                      <Td colSpan={7} color="gray.500">No first-batch candidates currently available.</Td>
                                    </Tr>
                                  ) : launchPreviewData.firstBatch.map((row) => (
                                    <Tr key={`batch-${row.queueItemId}`}>
                                      <Td fontSize="xs">{maskEmail(row.recipientEmail)}</Td>
                                      <Td fontSize="xs">
                                        <Text>{row.sequenceName || row.sequenceId}</Text>
                                        <Text color="gray.500">{row.enrollmentName || row.enrollmentId}</Text>
                                      </Td>
                                      <Td fontSize="xs">{row.identityEmail || '—'}</Td>
                                      <Td fontSize="xs">{row.stepIndex + 1}</Td>
                                      <Td fontSize="xs">{row.scheduledFor ? new Date(row.scheduledFor).toLocaleString() : 'now'}</Td>
                                      <Td fontSize="xs" maxW="240px">
                                        <Text noOfLines={2}>{row.subjectPreview || '—'}</Text>
                                      </Td>
                                      <Td>
                                        <HStack id="preview-vs-outcome-detail-wiring" data-testid="preview-vs-outcome-detail-wiring" spacing={1}>
                                          <Button size="xs" variant="ghost" onClick={() => openQueueModal(row.enrollmentId)}>Queue</Button>
                                          <Button size="xs" variant="ghost" onClick={() => openAuditPanelForQueueItem(row.queueItemId)}>Audit</Button>
                                          <Button size="xs" leftIcon={<EmailIcon />} isDisabled={!row.queueItemId} onClick={() => void previewQueueItemRender(row.queueItemId)}>Render</Button>
                                        </HStack>
                                      </Td>
                                    </Tr>
                                  ))}
                                </Tbody>
                              </Table>
                            </Box>

                            <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={3}>
                              <Box id="launch-preview-excluded-section" data-testid="launch-preview-excluded-section" overflowX="auto">
                                <Text fontSize="sm" fontWeight="semibold" mb={2}>Excluded / blocked for launch ({launchPreviewData.excluded.length + launchPreviewData.blocked.length})</Text>
                                <Table size="sm">
                                  <Thead>
                                    <Tr>
                                      <Th>Recipient</Th>
                                      <Th>Category</Th>
                                      <Th>Reason</Th>
                                      <Th>Actions</Th>
                                    </Tr>
                                  </Thead>
                                  <Tbody>
                                    {[...launchPreviewData.excluded, ...launchPreviewData.blocked].length === 0 ? (
                                      <Tr>
                                        <Td colSpan={4} color="gray.500">No excluded or blocked rows in this preview window.</Td>
                                      </Tr>
                                    ) : [...launchPreviewData.excluded, ...launchPreviewData.blocked].map((row) => (
                                      <Tr key={`excluded-${row.queueItemId}`}>
                                        <Td fontSize="xs">{maskEmail(row.recipientEmail)}</Td>
                                        <Td fontSize="xs">{launchPreviewData.excluded.some((r) => r.queueItemId === row.queueItemId) ? 'excluded' : 'blocked'}</Td>
                                        <Td fontSize="xs">{row.reason || row.lastError || '—'}</Td>
                                        <Td>
                                          <HStack spacing={1}>
                                            <Button size="xs" variant="ghost" onClick={() => openQueueModal(row.enrollmentId)}>Queue</Button>
                                            <Button size="xs" variant="ghost" onClick={() => openAuditPanelForQueueItem(row.queueItemId)}>Audit</Button>
                                          </HStack>
                                        </Td>
                                      </Tr>
                                    ))}
                                  </Tbody>
                                </Table>
                              </Box>

                              <Box id="launch-preview-not-in-batch-section" data-testid="launch-preview-not-in-batch-section" overflowX="auto">
                                <Text fontSize="sm" fontWeight="semibold" mb={2}>Eligible but not in current first batch ({launchPreviewData.notInBatch.length})</Text>
                                <Table size="sm">
                                  <Thead>
                                    <Tr>
                                      <Th>Recipient</Th>
                                      <Th>Scheduled</Th>
                                      <Th>Reason</Th>
                                      <Th>Actions</Th>
                                    </Tr>
                                  </Thead>
                                  <Tbody>
                                    {launchPreviewData.notInBatch.length === 0 ? (
                                      <Tr>
                                        <Td colSpan={4} color="gray.500">No extra eligible rows beyond first batch.</Td>
                                      </Tr>
                                    ) : launchPreviewData.notInBatch.map((row) => (
                                      <Tr key={`not-in-batch-${row.queueItemId}`}>
                                        <Td fontSize="xs">{maskEmail(row.recipientEmail)}</Td>
                                        <Td fontSize="xs">{row.scheduledFor ? new Date(row.scheduledFor).toLocaleString() : 'now'}</Td>
                                        <Td fontSize="xs">{row.reason || 'eligible_later_in_order'}</Td>
                                        <Td>
                                          <HStack spacing={1}>
                                            <Button size="xs" variant="ghost" onClick={() => openQueueModal(row.enrollmentId)}>Queue</Button>
                                            <Button size="xs" variant="ghost" onClick={() => openAuditPanelForQueueItem(row.queueItemId)}>Audit</Button>
                                          </HStack>
                                        </Td>
                                      </Tr>
                                    ))}
                                  </Tbody>
                                </Table>
                              </Box>
                            </SimpleGrid>

                            <Text id="launch-preview-last-updated" data-testid="launch-preview-last-updated" fontSize="xs" color="gray.500">
                              Last updated: {launchPreviewData.lastUpdatedAt ? new Date(launchPreviewData.lastUpdatedAt).toLocaleString() : '—'}
                            </Text>
                          </>
                        )}
                      </VStack>
                    </CardBody>
                  </Card>

                  <Card id="operator-outcomes-panel" data-testid="operator-outcomes-panel">
                    <CardBody>
                      <VStack align="stretch" spacing={3}>
                        <Flex justify="space-between" align="center" flexWrap="wrap" gap={2}>
                          <Text fontSize="sm" fontWeight="semibold">Recent send outcomes</Text>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => loadRunHistory()}
                            isLoading={runHistoryLoading}
                            isDisabled={!sequenceReadinessSequenceId}
                          >
                            Refresh outcomes
                          </Button>
                        </Flex>
                        <Text fontSize="sm" color="gray.600">
                          Shows what actually happened recently for this sequence, including mailbox, result, and the plain-language reason when something did not send.
                        </Text>
                        {runHistoryError ? (
                          <Alert status="error" size="sm">
                            <AlertIcon />
                            <AlertDescription>{runHistoryError}</AlertDescription>
                          </Alert>
                        ) : null}
                        {!runHistoryError && runHistoryData ? (
                          <>
                            <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
                              <Card variant="outline"><CardBody py={3}><Stat><StatLabel>Sent</StatLabel><StatNumber>{runHistoryData.summary?.byOutcome?.SENT ?? 0}</StatNumber></Stat></CardBody></Card>
                              <Card variant="outline"><CardBody py={3}><Stat><StatLabel>Failed</StatLabel><StatNumber>{runHistoryData.summary?.byOutcome?.SEND_FAILED ?? 0}</StatNumber></Stat></CardBody></Card>
                              <Card variant="outline"><CardBody py={3}><Stat><StatLabel>Suppressed</StatLabel><StatNumber>{runHistoryData.summary?.byOutcome?.SKIP_SUPPRESSED ?? 0}</StatNumber></Stat></CardBody></Card>
                              <Card variant="outline"><CardBody py={3}><Stat><StatLabel>Reply stopped</StatLabel><StatNumber>{runHistoryData.summary?.byOutcome?.SKIP_REPLIED_STOP ?? 0}</StatNumber></Stat></CardBody></Card>
                            </SimpleGrid>
                            <Box overflowX="auto">
                              <Table size="sm">
                                <Thead>
                                  <Tr>
                                    <Th>When</Th>
                                    <Th>Outcome</Th>
                                    <Th>Recipient</Th>
                                    <Th>Mailbox</Th>
                                    <Th>Reason</Th>
                                  </Tr>
                                </Thead>
                                <Tbody>
                                  {operatorOutcomeRows.length === 0 ? (
                                    <Tr>
                                      <Td colSpan={5} color="gray.500">No recent outcome rows for this sequence yet.</Td>
                                    </Tr>
                                  ) : operatorOutcomeRows.map((row) => (
                                    <Tr key={row.auditId}>
                                      <Td fontSize="xs">{row.occurredAt ? new Date(row.occurredAt).toLocaleString() : '—'}</Td>
                                      <Td>
                                        <Badge colorScheme={row.outcome === 'SENT' ? 'green' : row.outcome === 'SEND_FAILED' ? 'red' : 'orange'}>
                                          {humanizeOutcome(row.outcome)}
                                        </Badge>
                                      </Td>
                                      <Td fontSize="xs">{row.recipientEmail ? maskEmail(row.recipientEmail) : '—'}</Td>
                                      <Td fontSize="xs">{row.identityEmail || '—'}</Td>
                                      <Td fontSize="xs">{humanizeRunReason(row.reason || row.lastError)}</Td>
                                    </Tr>
                                  ))}
                                </Tbody>
                              </Table>
                            </Box>
                          </>
                        ) : null}
                      </VStack>
                    </CardBody>
                  </Card>

                  <Collapse in={isDiagnosticsOpen}>

                  <Card id="run-history-panel" data-testid="run-history-panel">
                    <CardBody>
                      <VStack align="stretch" spacing={3}>
                        <Flex justify="space-between" align="center" flexWrap="wrap" gap={2}>
                          <Text fontSize="sm" fontWeight="semibold">Run History (Batch Outcome Review)</Text>
                          <HStack spacing={2}>
                            <Select
                              size="sm"
                              maxW="240px"
                              value={runHistoryOutcomeFilter}
                              onChange={(e) => setRunHistoryOutcomeFilter(e.target.value)}
                            >
                              <option value="all">All outcomes</option>
                              <option value="WOULD_SEND">WOULD_SEND</option>
                              <option value="SENT">SENT</option>
                              <option value="SEND_FAILED">SEND_FAILED</option>
                              <option value="SKIP_SUPPRESSED">SKIP_SUPPRESSED</option>
                              <option value="SKIP_REPLIED_STOP">SKIP_REPLIED_STOP</option>
                              <option value="hard_bounce_invalid_recipient">hard_bounce_invalid_recipient</option>
                            </Select>
                            <Button
                              id="run-history-refresh-btn"
                              data-testid="run-history-refresh-btn"
                              size="sm"
                              variant="outline"
                              onClick={() => loadRunHistory()}
                              isLoading={runHistoryLoading}
                            >
                              Refresh Run History
                            </Button>
                          </HStack>
                        </Flex>

                        {runHistoryError && (
                          <Alert status="error" size="sm">
                            <AlertIcon />
                            <AlertDescription>{runHistoryError}</AlertDescription>
                          </Alert>
                        )}

                        {!runHistoryError && runHistoryData && (
                          <>
                            <SimpleGrid id="run-history-outcomes-summary" data-testid="run-history-outcomes-summary" columns={{ base: 2, md: 3, lg: 6 }} spacing={2}>
                              <Card><CardBody py={2}><Stat><StatLabel>Rows</StatLabel><StatNumber>{runHistoryData.totalReturned ?? 0}</StatNumber></Stat></CardBody></Card>
                              {Object.entries(runHistoryData.summary?.byOutcome ?? {}).slice(0, 5).map(([k, v]) => (
                                <Card key={k}><CardBody py={2}><Stat><StatLabel>{k}</StatLabel><StatNumber>{v}</StatNumber></Stat></CardBody></Card>
                              ))}
                            </SimpleGrid>

                            <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={3}>
                              <Card>
                                <CardBody>
                                  <Text fontSize="sm" fontWeight="semibold" mb={2}>Recent runs ({runHistoryData.recentRuns?.length ?? 0})</Text>
                                  <VStack align="stretch" spacing={2}>
                                    {(runHistoryData.recentRuns || []).length === 0 ? (
                                      <Text fontSize="sm" color="gray.500">No recent run groups found in this window.</Text>
                                    ) : (runHistoryData.recentRuns || []).map((run) => (
                                      <HStack key={run.runKey} justify="space-between" borderWidth="1px" borderRadius="md" px={2} py={1}>
                                        <Box>
                                          <Text fontSize="sm">{new Date(run.startedAt).toLocaleString()}</Text>
                                          <Text fontSize="xs" color="gray.500">
                                            mode={run.modeGuess} total={run.total}
                                          </Text>
                                        </Box>
                                        <HStack spacing={1} flexWrap="wrap" justify="flex-end">
                                          {Object.entries(run.counts || {}).map(([k, v]) => (
                                            <Badge key={`${run.runKey}-${k}`} variant="subtle">{k}:{v}</Badge>
                                          ))}
                                        </HStack>
                                      </HStack>
                                    ))}
                                  </VStack>
                                </CardBody>
                              </Card>

                              <Card>
                                <CardBody>
                                  <Text fontSize="sm" fontWeight="semibold" mb={2}>How to compare preview vs actual</Text>
                                  <Text fontSize="sm" color="gray.600">
                                    Rows marked as “in first batch preview” align queue item IDs with the current Launch Preview panel.
                                    Use Queue / Audit / Render actions on each row to inspect the backend-truth details.
                                  </Text>
                                </CardBody>
                              </Card>
                            </SimpleGrid>

                            <Box id="run-history-attempt-rows" data-testid="run-history-attempt-rows" overflowX="auto">
                              <Text fontSize="sm" fontWeight="semibold" mb={2}>Recent attempt rows ({runHistoryRows.length})</Text>
                              <Table size="sm">
                                <Thead>
                                  <Tr>
                                    <Th>Occurred</Th>
                                    <Th>Recipient</Th>
                                    <Th>Outcome</Th>
                                    <Th>Sequence / Enrollment</Th>
                                    <Th>Identity</Th>
                                    <Th>Reason</Th>
                                    <Th>Preview match</Th>
                                    <Th>Actions</Th>
                                  </Tr>
                                </Thead>
                                <Tbody>
                                  {runHistoryRows.length === 0 ? (
                                    <Tr>
                                      <Td colSpan={8} color="gray.500">No run-history rows in this filter/window.</Td>
                                    </Tr>
                                  ) : runHistoryRows.map((row) => (
                                    <Tr key={row.auditId}>
                                      <Td fontSize="xs">{row.occurredAt ? new Date(row.occurredAt).toLocaleString() : '—'}</Td>
                                      <Td fontSize="xs">{row.recipientEmail ? maskEmail(row.recipientEmail) : '—'}</Td>
                                      <Td>
                                        <VStack align="start" spacing={0}>
                                          <Badge size="sm" variant="outline">{row.outcome}</Badge>
                                          <Text fontSize="xs" color="gray.500">{row.decision}</Text>
                                        </VStack>
                                      </Td>
                                      <Td fontSize="xs">
                                        <Text>{row.sequenceName || row.sequenceId || 'Unknown sequence'}</Text>
                                        <Text color="gray.500">{row.enrollmentName || row.enrollmentId || '—'}</Text>
                                      </Td>
                                      <Td fontSize="xs">{row.identityEmail || '—'}</Td>
                                      <Td fontSize="xs" maxW="280px">
                                        <Text>{row.reason || row.lastError || '—'}</Text>
                                        {row.lastError && row.reason !== row.lastError ? <Text color="gray.500" noOfLines={2}>{row.lastError}</Text> : null}
                                      </Td>
                                      <Td fontSize="xs">
                                        {launchPreviewFirstBatchIds.has(row.queueItemId) ? (
                                          <Badge colorScheme="green">in first batch preview</Badge>
                                        ) : (
                                          <Text color="gray.500">—</Text>
                                        )}
                                      </Td>
                                      <Td>
                                        <HStack spacing={1}>
                                          <Button size="xs" variant="ghost" isDisabled={!row.enrollmentId} onClick={() => row.enrollmentId && openQueueModal(row.enrollmentId)}>
                                            Queue
                                          </Button>
                                          <Button size="xs" variant="ghost" isDisabled={!row.queueItemId} onClick={() => row.queueItemId && openAuditPanelForQueueItem(row.queueItemId)}>
                                            Audit
                                          </Button>
                                          <Button size="xs" leftIcon={<EmailIcon />} isDisabled={!row.queueItemId} onClick={() => row.queueItemId && void previewQueueItemRender(row.queueItemId)}>
                                            Render
                                          </Button>
                                        </HStack>
                                      </Td>
                                    </Tr>
                                  ))}
                                </Tbody>
                              </Table>
                            </Box>

                            <Text id="run-history-last-updated" data-testid="run-history-last-updated" fontSize="xs" color="gray.500">
                              Last updated: {runHistoryData.lastUpdatedAt ? new Date(runHistoryData.lastUpdatedAt).toLocaleString() : '—'} | Route: /api/send-worker/run-history
                            </Text>
                          </>
                        )}
                      </VStack>
                    </CardBody>
                  </Card>

                  <Card id="preview-vs-outcome-panel" data-testid="preview-vs-outcome-panel">
                    <CardBody>
                      <VStack align="stretch" spacing={3}>
                        <Flex justify="space-between" align="center" flexWrap="wrap" gap={2}>
                          <Text fontSize="sm" fontWeight="semibold">Preview vs Outcome Comparison</Text>
                          <Button
                            id="preview-vs-outcome-refresh-btn"
                            data-testid="preview-vs-outcome-refresh-btn"
                            size="sm"
                            variant="outline"
                            onClick={() => loadPreviewVsOutcome()}
                            isLoading={previewVsOutcomeLoading}
                            isDisabled={!sequenceReadinessSequenceId}
                          >
                            Refresh Comparison
                          </Button>
                        </Flex>

                        {previewVsOutcomeError && (
                          <Alert status="error" size="sm">
                            <AlertIcon />
                            <AlertDescription>{previewVsOutcomeError}</AlertDescription>
                          </Alert>
                        )}

                        {!previewVsOutcomeError && previewVsOutcomeData && (
                          <>
                            <SimpleGrid id="preview-vs-outcome-summary-cards" data-testid="preview-vs-outcome-summary-cards" columns={{ base: 2, md: 4, lg: 7 }} spacing={2}>
                              <Card><CardBody py={2}><Stat><StatLabel>Preview candidates</StatLabel><StatNumber>{previewVsOutcomeData.summary.previewCandidates ?? 0}</StatNumber></Stat></CardBody></Card>
                              <Card><CardBody py={2}><Stat><StatLabel>Outcome rows</StatLabel><StatNumber>{previewVsOutcomeData.summary.outcomeRows ?? 0}</StatNumber></Stat></CardBody></Card>
                              <Card><CardBody py={2}><Stat><StatLabel>Matched</StatLabel><StatNumber color="green.600">{previewVsOutcomeData.summary.matchedRows ?? 0}</StatNumber></Stat></CardBody></Card>
                              <Card><CardBody py={2}><Stat><StatLabel>Preview-only</StatLabel><StatNumber color="orange.600">{previewVsOutcomeData.summary.previewOnlyRows ?? 0}</StatNumber></Stat></CardBody></Card>
                              <Card><CardBody py={2}><Stat><StatLabel>Outcome-only</StatLabel><StatNumber color="purple.600">{previewVsOutcomeData.summary.outcomeOnlyRows ?? 0}</StatNumber></Stat></CardBody></Card>
                              <Card><CardBody py={2}><Stat><StatLabel>Match by itemId</StatLabel><StatNumber>{previewVsOutcomeData.summary.matchByQueueItemId ?? 0}</StatNumber></Stat></CardBody></Card>
                              <Card><CardBody py={2}><Stat><StatLabel>Match by recipient</StatLabel><StatNumber>{previewVsOutcomeData.summary.matchByRecipientEnrollment ?? 0}</StatNumber></Stat></CardBody></Card>
                            </SimpleGrid>

                            <Box id="preview-vs-outcome-matched-rows" data-testid="preview-vs-outcome-matched-rows" overflowX="auto">
                              <Text fontSize="sm" fontWeight="semibold" mb={2}>Matched rows ({previewVsOutcomeData.matchedRows.length})</Text>
                              <Table size="sm">
                                <Thead>
                                  <Tr>
                                    <Th>Recipient</Th>
                                    <Th>Preview reason</Th>
                                    <Th>Actual outcome</Th>
                                    <Th>Match type</Th>
                                    <Th>Diff flags</Th>
                                    <Th>Actions</Th>
                                  </Tr>
                                </Thead>
                                <Tbody>
                                  {previewVsOutcomeData.matchedRows.length === 0 ? (
                                    <Tr>
                                      <Td colSpan={6} color="gray.500">No matched rows in current window.</Td>
                                    </Tr>
                                  ) : previewVsOutcomeData.matchedRows.map((row) => (
                                    <Tr key={`pvo-match-${row.outcome.auditId}`}>
                                      <Td fontSize="xs">{maskEmail(row.preview.recipientEmail)}</Td>
                                      <Td fontSize="xs">{row.preview.reason || 'eligible_now'}</Td>
                                      <Td fontSize="xs">
                                        <VStack align="start" spacing={0}>
                                          <Badge size="sm" variant="outline">{row.outcome.outcome}</Badge>
                                          <Text color="gray.500">{row.outcome.reason || row.outcome.lastError || '—'}</Text>
                                        </VStack>
                                      </Td>
                                      <Td fontSize="xs">
                                        <Badge variant="subtle">{row.matchKind}</Badge>
                                      </Td>
                                      <Td fontSize="xs">
                                        <HStack spacing={1} flexWrap="wrap">
                                          {row.differs.outcome ? <Badge colorScheme="orange">outcome</Badge> : <Badge colorScheme="green">outcome ok</Badge>}
                                          {row.differs.reason ? <Badge colorScheme="orange">reason</Badge> : <Badge colorScheme="green">reason ok</Badge>}
                                          {row.differs.identity ? <Badge colorScheme="orange">identity</Badge> : <Badge colorScheme="green">identity ok</Badge>}
                                        </HStack>
                                      </Td>
                                      <Td>
                                        <HStack spacing={1}>
                                          <Button size="xs" variant="ghost" onClick={() => openQueueModal(row.preview.enrollmentId)}>Queue</Button>
                                          <Button size="xs" variant="ghost" onClick={() => openAuditPanelForQueueItem(row.preview.queueItemId)}>Audit</Button>
                                          <Button size="xs" leftIcon={<EmailIcon />} onClick={() => void previewQueueItemRender(row.preview.queueItemId)}>Render</Button>
                                        </HStack>
                                      </Td>
                                    </Tr>
                                  ))}
                                </Tbody>
                              </Table>
                            </Box>

                            <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={3}>
                              <Box id="preview-vs-outcome-preview-only" data-testid="preview-vs-outcome-preview-only" overflowX="auto">
                                <Text fontSize="sm" fontWeight="semibold" mb={2}>Preview-only rows ({previewVsOutcomeData.previewOnlyRows.length})</Text>
                                <Table size="sm">
                                  <Thead>
                                    <Tr>
                                      <Th>Recipient</Th>
                                      <Th>Reason</Th>
                                      <Th>Scheduled</Th>
                                      <Th>Actions</Th>
                                    </Tr>
                                  </Thead>
                                  <Tbody>
                                    {previewVsOutcomeData.previewOnlyRows.length === 0 ? (
                                      <Tr>
                                        <Td colSpan={4} color="gray.500">No preview-only rows.</Td>
                                      </Tr>
                                    ) : previewVsOutcomeData.previewOnlyRows.map((row) => (
                                      <Tr key={`pvo-preview-only-${row.queueItemId}`}>
                                        <Td fontSize="xs">{maskEmail(row.recipientEmail)}</Td>
                                        <Td fontSize="xs">{row.reason || 'eligible_now'}</Td>
                                        <Td fontSize="xs">{row.scheduledFor ? new Date(row.scheduledFor).toLocaleString() : 'now'}</Td>
                                        <Td>
                                          <HStack spacing={1}>
                                            <Button size="xs" variant="ghost" onClick={() => openQueueModal(row.enrollmentId)}>Queue</Button>
                                            <Button size="xs" variant="ghost" onClick={() => openAuditPanelForQueueItem(row.queueItemId)}>Audit</Button>
                                          </HStack>
                                        </Td>
                                      </Tr>
                                    ))}
                                  </Tbody>
                                </Table>
                              </Box>

                              <Box id="preview-vs-outcome-outcome-only" data-testid="preview-vs-outcome-outcome-only" overflowX="auto">
                                <Text fontSize="sm" fontWeight="semibold" mb={2}>Outcome-only rows ({previewVsOutcomeData.outcomeOnlyRows.length})</Text>
                                <Table size="sm">
                                  <Thead>
                                    <Tr>
                                      <Th>Occurred</Th>
                                      <Th>Recipient</Th>
                                      <Th>Outcome</Th>
                                      <Th>Reason</Th>
                                      <Th>Actions</Th>
                                    </Tr>
                                  </Thead>
                                  <Tbody>
                                    {previewVsOutcomeData.outcomeOnlyRows.length === 0 ? (
                                      <Tr>
                                        <Td colSpan={5} color="gray.500">No outcome-only rows.</Td>
                                      </Tr>
                                    ) : previewVsOutcomeData.outcomeOnlyRows.map((row) => (
                                      <Tr key={`pvo-outcome-only-${row.auditId}`}>
                                        <Td fontSize="xs">{row.occurredAt ? new Date(row.occurredAt).toLocaleString() : '—'}</Td>
                                        <Td fontSize="xs">{row.recipientEmail ? maskEmail(row.recipientEmail) : '—'}</Td>
                                        <Td fontSize="xs">
                                          <Badge size="sm" variant="outline">{row.outcome}</Badge>
                                        </Td>
                                        <Td fontSize="xs">{row.reason || row.lastError || '—'}</Td>
                                        <Td>
                                          <HStack spacing={1}>
                                            <Button size="xs" variant="ghost" isDisabled={!row.enrollmentId} onClick={() => row.enrollmentId && openQueueModal(row.enrollmentId)}>Queue</Button>
                                            <Button size="xs" variant="ghost" isDisabled={!row.queueItemId} onClick={() => row.queueItemId && openAuditPanelForQueueItem(row.queueItemId)}>Audit</Button>
                                            <Button size="xs" leftIcon={<EmailIcon />} isDisabled={!row.queueItemId} onClick={() => row.queueItemId && void previewQueueItemRender(row.queueItemId)}>Render</Button>
                                          </HStack>
                                        </Td>
                                      </Tr>
                                    ))}
                                  </Tbody>
                                </Table>
                              </Box>
                            </SimpleGrid>

                            <Text id="preview-vs-outcome-last-updated" data-testid="preview-vs-outcome-last-updated" fontSize="xs" color="gray.500">
                              Last updated: {previewVsOutcomeData.lastUpdatedAt ? new Date(previewVsOutcomeData.lastUpdatedAt).toLocaleString() : '—'} | Route: /api/send-worker/preview-vs-outcome
                            </Text>
                          </>
                        )}
                      </VStack>
                    </CardBody>
                  </Card>

                  <Card id="exception-center-panel" data-testid="exception-center-panel">
                    <CardBody>
                      <VStack align="stretch" spacing={3}>
                        <Flex justify="space-between" align="center" flexWrap="wrap" gap={2}>
                          <Text fontSize="sm" fontWeight="semibold">Exception Center (Prioritized Actions)</Text>
                          <Button
                            id="exception-center-refresh-btn"
                            data-testid="exception-center-refresh-btn"
                            size="sm"
                            variant="outline"
                            onClick={() => loadExceptionCenter()}
                            isLoading={exceptionCenterLoading}
                          >
                            Refresh Exceptions
                          </Button>
                        </Flex>

                        {exceptionCenterError && (
                          <Alert status="error" size="sm">
                            <AlertIcon />
                            <AlertDescription>{exceptionCenterError}</AlertDescription>
                          </Alert>
                        )}

                        {!exceptionCenterError && exceptionCenterData && (
                          <>
                            <SimpleGrid id="exception-center-summary-cards" data-testid="exception-center-summary-cards" columns={{ base: 2, md: 5 }} spacing={2}>
                              <Card><CardBody py={2}><Stat><StatLabel>Open groups</StatLabel><StatNumber>{exceptionCenterData.statusSummary.openGroups ?? 0}</StatNumber></Stat></CardBody></Card>
                              <Card><CardBody py={2}><Stat><StatLabel>High</StatLabel><StatNumber color="red.600">{exceptionCenterData.statusSummary.high ?? 0}</StatNumber></Stat></CardBody></Card>
                              <Card><CardBody py={2}><Stat><StatLabel>Medium</StatLabel><StatNumber color="orange.600">{exceptionCenterData.statusSummary.medium ?? 0}</StatNumber></Stat></CardBody></Card>
                              <Card><CardBody py={2}><Stat><StatLabel>Low</StatLabel><StatNumber color="blue.600">{exceptionCenterData.statusSummary.low ?? 0}</StatNumber></Stat></CardBody></Card>
                              <Card><CardBody py={2}><Stat><StatLabel>Total groups</StatLabel><StatNumber>{exceptionCenterData.statusSummary.totalGroups ?? 0}</StatNumber></Stat></CardBody></Card>
                            </SimpleGrid>

                            <VStack id="exception-center-groups" data-testid="exception-center-groups" align="stretch" spacing={3}>
                              {(exceptionCenterData.groups ?? []).length === 0 ? (
                                <Alert status="success" size="sm">
                                  <AlertIcon />
                                  <AlertDescription>No active exception groups in this window.</AlertDescription>
                                </Alert>
                              ) : (exceptionCenterData.groups ?? []).map((group) => (
                                <Card key={group.key} variant="outline">
                                  <CardBody>
                                    <VStack align="stretch" spacing={2}>
                                      <Flex justify="space-between" align="center" flexWrap="wrap" gap={2}>
                                        <VStack align="start" spacing={0}>
                                          <HStack>
                                            <Text fontSize="sm" fontWeight="semibold">{group.title}</Text>
                                            <Badge
                                              id="exception-center-severity-badge"
                                              data-testid="exception-center-severity-badge"
                                              colorScheme={group.severity === 'HIGH' ? 'red' : group.severity === 'MEDIUM' ? 'orange' : 'blue'}
                                            >
                                              {group.severity}
                                            </Badge>
                                          </HStack>
                                          <Text fontSize="xs" color="gray.600">{group.summary}</Text>
                                        </VStack>
                                        <HStack spacing={2}>
                                          <Badge variant="outline">count={group.count}</Badge>
                                          <Button
                                            id="exception-center-next-step-btn"
                                            data-testid="exception-center-next-step-btn"
                                            size="xs"
                                            variant="outline"
                                            onClick={() => handleExceptionNextStep(group.nextStep?.target || '')}
                                          >
                                            {group.nextStep?.label || 'Open Next Step'}
                                          </Button>
                                        </HStack>
                                      </Flex>

                                      <Box overflowX="auto">
                                        <Table size="sm">
                                          <Thead>
                                            <Tr>
                                              <Th>Recipient</Th>
                                              <Th>Status</Th>
                                              <Th>Reason</Th>
                                              <Th>Occurred</Th>
                                              <Th>Actions</Th>
                                            </Tr>
                                          </Thead>
                                          <Tbody>
                                            {(group.samples || []).length === 0 ? (
                                              <Tr>
                                                <Td colSpan={5} color="gray.500">No sample rows.</Td>
                                              </Tr>
                                            ) : (group.samples || []).map((sample, idx) => (
                                              <Tr key={`${group.key}-sample-${idx}`}>
                                                <Td fontSize="xs">{sample.recipientEmail ? maskEmail(sample.recipientEmail) : '—'}</Td>
                                                <Td fontSize="xs">
                                                  <Badge variant="subtle">{sample.status || '—'}</Badge>
                                                </Td>
                                                <Td fontSize="xs">{sample.reason || '—'}</Td>
                                                <Td fontSize="xs">{sample.occurredAt ? new Date(sample.occurredAt).toLocaleString() : '—'}</Td>
                                                <Td>
                                                  <HStack
                                                    id="exception-center-next-step-routing"
                                                    data-testid="exception-center-next-step-routing"
                                                    spacing={1}
                                                  >
                                                    <Button
                                                      size="xs"
                                                      variant="ghost"
                                                      isDisabled={!sample.enrollmentId}
                                                      onClick={() => sample.enrollmentId && openQueueModal(sample.enrollmentId)}
                                                    >
                                                      Queue
                                                    </Button>
                                                    <Button
                                                      size="xs"
                                                      variant="ghost"
                                                      isDisabled={!sample.queueItemId}
                                                      onClick={() => sample.queueItemId && openAuditPanelForQueueItem(sample.queueItemId)}
                                                    >
                                                      Audit
                                                    </Button>
                                                    <Button
                                                      size="xs"
                                                      leftIcon={<EmailIcon />}
                                                      isDisabled={!sample.queueItemId}
                                                      onClick={() => sample.queueItemId && void previewQueueItemRender(sample.queueItemId)}
                                                    >
                                                      Render
                                                    </Button>
                                                  </HStack>
                                                </Td>
                                              </Tr>
                                            ))}
                                          </Tbody>
                                        </Table>
                                      </Box>
                                    </VStack>
                                  </CardBody>
                                </Card>
                              ))}
                            </VStack>

                            <Text id="exception-center-last-updated" data-testid="exception-center-last-updated" fontSize="xs" color="gray.500">
                              Last updated: {exceptionCenterData.lastUpdatedAt ? new Date(exceptionCenterData.lastUpdatedAt).toLocaleString() : '—'} | Route: /api/send-worker/exception-center
                            </Text>
                          </>
                        )}
                      </VStack>
                    </CardBody>
                  </Card>

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

                  <Card id="marketing-ops-reporting-panel" data-testid="marketing-ops-reporting-panel">
                    <CardBody>
                      <VStack align="stretch" spacing={3}>
                        <Flex gap={3} flexWrap="wrap" align="center">
                          <Text fontSize="sm" fontWeight="semibold">Marketing Ops Reporting</Text>
                          <FormControl width="140px">
                            <FormLabel fontSize="xs" mb={0}>Since (days)</FormLabel>
                            <Select size="sm" value={opsReportingSinceDays} onChange={(e) => setOpsReportingSinceDays(Number(e.target.value) || 30)}>
                              <option value={7}>7</option>
                              <option value={30}>30</option>
                            </Select>
                          </FormControl>
                          <Button size="sm" variant="outline" onClick={() => loadOpsReporting()} isLoading={opsReportingLoading}>
                            Refresh Reporting
                          </Button>
                          <Text fontSize="xs" color="gray.500">
                            Uses /api/reports/outreach with tenant-scoped backend truth.
                          </Text>
                        </Flex>
                        {opsReportingError && (
                          <Alert status="error" size="sm">
                            <AlertIcon />
                            <AlertDescription>{opsReportingError}</AlertDescription>
                          </Alert>
                        )}
                        {!opsReportingError && opsReportingData && (
                          <>
                            <SimpleGrid id="marketing-ops-reporting-summary" data-testid="marketing-ops-reporting-summary" columns={{ base: 2, md: 4 }} spacing={3}>
                              <Card><CardBody py={3}><Stat><StatLabel>Sends</StatLabel><StatNumber>{(opsReportingData.bySequence || []).reduce((sum, row) => sum + (row.sent || 0), 0)}</StatNumber></Stat></CardBody></Card>
                              <Card><CardBody py={3}><Stat><StatLabel>Failures</StatLabel><StatNumber>{(opsReportingData.bySequence || []).reduce((sum, row) => sum + (row.sendFailed || 0), 0)}</StatNumber></Stat></CardBody></Card>
                              <Card><CardBody py={3}><Stat><StatLabel>Suppressions</StatLabel><StatNumber>{(opsReportingData.bySequence || []).reduce((sum, row) => sum + (row.suppressed || 0), 0)}</StatNumber></Stat></CardBody></Card>
                              <Card><CardBody py={3}><Stat><StatLabel>Reply-stops</StatLabel><StatNumber>{opsReportingData.recentReasons?.SKIP_REPLIED_STOP ?? 0}</StatNumber></Stat></CardBody></Card>
                              <Card><CardBody py={3}><Stat><StatLabel>Hard bounces</StatLabel><StatNumber>{opsReportingData.recentReasons?.hard_bounce_invalid_recipient ?? 0}</StatNumber></Stat></CardBody></Card>
                              <Card><CardBody py={3}><Stat><StatLabel>Skipped</StatLabel><StatNumber>{(opsReportingData.bySequence || []).reduce((sum, row) => sum + (row.skipped || 0), 0)}</StatNumber></Stat></CardBody></Card>
                              <Card><CardBody py={3}><Stat><StatLabel>Replies</StatLabel><StatNumber>{(opsReportingData.byIdentity || []).reduce((sum, row) => sum + (row.replies || 0), 0)}</StatNumber></Stat></CardBody></Card>
                              <Card><CardBody py={3}><Stat><StatLabel>Opt-outs</StatLabel><StatNumber>{(opsReportingData.byIdentity || []).reduce((sum, row) => sum + (row.optOuts || 0), 0)}</StatNumber></Stat></CardBody></Card>
                            </SimpleGrid>
                            <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={3}>
                              <Card>
                                <CardBody>
                                  <Text fontSize="sm" fontWeight="semibold" mb={2}>Top sequences</Text>
                                  <VStack align="stretch" spacing={2}>
                                    {(opsReportingData.bySequence || []).slice(0, 5).map((row, idx) => (
                                      <HStack key={`${row.sequenceId || row.sequenceName || 'seq'}-${idx}`} justify="space-between" borderWidth="1px" borderRadius="md" px={2} py={1}>
                                        <Box>
                                          <Text fontSize="sm">{row.sequenceName || row.sequenceId || 'Unknown sequence'}</Text>
                                          <Text fontSize="xs" color="gray.500">sent={row.sent} failed={row.sendFailed} suppressed={row.suppressed} skipped={row.skipped}</Text>
                                        </Box>
                                        <Badge>{row.sent}</Badge>
                                      </HStack>
                                    ))}
                                    {(opsReportingData.bySequence || []).length === 0 && (
                                      <Text fontSize="sm" color="gray.500">No sequence reporting rows yet.</Text>
                                    )}
                                  </VStack>
                                </CardBody>
                              </Card>
                              <Card>
                                <CardBody>
                                  <Text fontSize="sm" fontWeight="semibold" mb={2}>Top identities</Text>
                                  <VStack align="stretch" spacing={2}>
                                    {(opsReportingData.byIdentity || []).slice(0, 5).map((row, idx) => (
                                      <HStack key={`${row.identityId || row.email || 'id'}-${idx}`} justify="space-between" borderWidth="1px" borderRadius="md" px={2} py={1}>
                                        <Box>
                                          <Text fontSize="sm">{row.email || row.name || row.identityId || 'Unknown identity'}</Text>
                                          <Text fontSize="xs" color="gray.500">sent={row.sent} failed={row.sendFailed} replies={row.replies} optOuts={row.optOuts}</Text>
                                        </Box>
                                        <Badge>{row.sent}</Badge>
                                      </HStack>
                                    ))}
                                    {(opsReportingData.byIdentity || []).length === 0 && (
                                      <Text fontSize="sm" color="gray.500">No identity reporting rows yet.</Text>
                                    )}
                                  </VStack>
                                </CardBody>
                              </Card>
                            </SimpleGrid>
                            <Text fontSize="xs" color="gray.500">
                              Generated: {opsReportingData.generatedAt ? new Date(opsReportingData.generatedAt).toLocaleString() : '—'}
                            </Text>
                          </>
                        )}
                      </VStack>
                    </CardBody>
                  </Card>

                  <Card id="queue-workbench-panel" data-testid="queue-workbench-panel">
                    <CardBody>
                      <VStack align="stretch" spacing={3}>
                        <Flex gap={3} align="center" flexWrap="wrap">
                          <Text fontSize="sm" fontWeight="semibold">Queue Workbench</Text>
                          <FormControl width="180px">
                            <FormLabel fontSize="xs" mb={0}>View</FormLabel>
                            <Select
                              id="queue-workbench-view-select"
                              data-testid="queue-workbench-view-select"
                              size="sm"
                              value={queueWorkbenchState}
                              onChange={(e) => setQueueWorkbenchState(e.target.value as QueueWorkbenchState)}
                            >
                              <option value="ready">Ready now</option>
                              <option value="blocked">Blocked</option>
                              <option value="failed">Failed recently</option>
                              <option value="scheduled">Scheduled later</option>
                              <option value="sent">Recently sent</option>
                            </Select>
                          </FormControl>
                          <FormControl width="240px">
                            <FormLabel fontSize="xs" mb={0}>Recipient search</FormLabel>
                            <Input
                              id="queue-workbench-search"
                              data-testid="queue-workbench-search"
                              size="sm"
                              placeholder="name@domain.com"
                              value={queueWorkbenchSearch}
                              onChange={(e) => setQueueWorkbenchSearch(e.target.value)}
                            />
                          </FormControl>
                          <Button
                            id="queue-workbench-refresh-btn"
                            data-testid="queue-workbench-refresh-btn"
                            size="sm"
                            leftIcon={<RepeatIcon />}
                            onClick={() => loadQueueWorkbench()}
                            isLoading={queueWorkbenchLoading}
                            isDisabled={!selectedCustomerId?.startsWith('cust_')}
                          >
                            Refresh Workbench
                          </Button>
                          <Text id="queue-workbench-last-updated" data-testid="queue-workbench-last-updated" fontSize="xs" color="gray.500">
                            Last updated: {queueWorkbenchData?.lastUpdatedAt ? new Date(queueWorkbenchData.lastUpdatedAt).toLocaleString() : '—'}
                          </Text>
                        </Flex>

                        {queueWorkbenchError && (
                          <Alert status="error" size="sm">
                            <AlertIcon />
                            <AlertDescription>{queueWorkbenchError}</AlertDescription>
                          </Alert>
                        )}

                        {queueWorkbenchSelectedIds.length > 0 && (
                          <Card id="queue-workbench-bulk-action-bar" data-testid="queue-workbench-bulk-action-bar" variant="outline">
                            <CardBody py={3}>
                              <HStack spacing={2} flexWrap="wrap" id="queue-workbench-bulk-selection" data-testid="queue-workbench-bulk-selection">
                                <Badge id="queue-workbench-selected-count" data-testid="queue-workbench-selected-count" colorScheme="blue">
                                  Selected: {queueWorkbenchSelectedIds.length}
                                </Badge>
                                <Button
                                  id="queue-workbench-clear-selection"
                                  data-testid="queue-workbench-clear-selection"
                                  size="xs"
                                  variant="ghost"
                                  onClick={clearQueueWorkbenchSelection}
                                >
                                  Clear
                                </Button>
                                <Button
                                  id="queue-workbench-bulk-requeue-btn"
                                  data-testid="queue-workbench-bulk-requeue-btn"
                                  size="sm"
                                  variant="outline"
                                  isLoading={queueWorkbenchBulkAction === 'QUEUED'}
                                  isDisabled={queueWorkbenchRequeueEligibleCount === 0}
                                  onClick={() => applyQueueWorkbenchBulkAction('QUEUED')}
                                >
                                  Requeue ({queueWorkbenchRequeueEligibleCount}/{queueWorkbenchSelectedIds.length})
                                </Button>
                                <Button
                                  id="queue-workbench-bulk-skip-btn"
                                  data-testid="queue-workbench-bulk-skip-btn"
                                  size="sm"
                                  variant="outline"
                                  isLoading={queueWorkbenchBulkAction === 'SKIPPED'}
                                  isDisabled={queueWorkbenchSkipEligibleCount === 0}
                                  onClick={() => applyQueueWorkbenchBulkAction('SKIPPED')}
                                >
                                  Skip ({queueWorkbenchSkipEligibleCount}/{queueWorkbenchSelectedIds.length})
                                </Button>
                                {queueWorkbenchRequeueEligibleCount === 0 || queueWorkbenchSkipEligibleCount === 0 ? (
                                  <Text fontSize="xs" color="gray.500">
                                    Mixed selections are allowed; only rows eligible for each action will be updated.
                                  </Text>
                                ) : null}
                              </HStack>
                            </CardBody>
                          </Card>
                        )}

                        {queueWorkbenchBulkResult && (
                          <Alert
                            id="queue-workbench-bulk-result-summary"
                            data-testid="queue-workbench-bulk-result-summary"
                            status={queueWorkbenchBulkResult.skippedCount > 0 ? 'warning' : 'success'}
                            size="sm"
                          >
                            <AlertIcon />
                            <AlertDescription>
                              {queueWorkbenchBulkResult.action === 'QUEUED' ? 'Bulk requeue' : 'Bulk skip'} complete: requested=
                              {queueWorkbenchBulkResult.requestedCount} succeeded={queueWorkbenchBulkResult.succeededCount} skipped=
                              {queueWorkbenchBulkResult.skippedCount}
                              {Object.keys(queueWorkbenchBulkResult.reasonCounts || {}).length > 0
                                ? ` reasons=${JSON.stringify(queueWorkbenchBulkResult.reasonCounts)}`
                                : ''}
                            </AlertDescription>
                          </Alert>
                        )}

                        <Box overflowX="auto" id="queue-workbench-table" data-testid="queue-workbench-table">
                          <Table size="sm">
                            <Thead>
                              <Tr>
                                <Th width="36px">
                                  <Checkbox
                                    id="queue-workbench-select-all"
                                    data-testid="queue-workbench-select-all"
                                    isChecked={queueWorkbenchAllVisibleSelected}
                                    isDisabled={queueWorkbenchVisibleIds.length === 0}
                                    onChange={(e) => toggleQueueWorkbenchSelectAllVisible(e.target.checked)}
                                  />
                                </Th>
                                <Th>Recipient</Th>
                                <Th>Sequence / Enrollment</Th>
                                <Th>Status</Th>
                                <Th>Reason</Th>
                                <Th>Scheduled</Th>
                                <Th>Identity</Th>
                                <Th>Actions</Th>
                              </Tr>
                            </Thead>
                            <Tbody>
                              {(queueWorkbenchData?.rows || []).length === 0 ? (
                                <Tr>
                                  <Td colSpan={8} color="gray.500">
                                    No rows in this view. Use refresh or switch view.
                                  </Td>
                                </Tr>
                              ) : (queueWorkbenchData?.rows || []).map((row) => (
                                <Tr key={row.queueItemId}>
                                  <Td>
                                    <Checkbox
                                      isChecked={queueWorkbenchSelectedIds.includes(row.queueItemId)}
                                      onChange={(e) => toggleQueueWorkbenchSelection(row.queueItemId, e.target.checked)}
                                    />
                                  </Td>
                                  <Td fontSize="xs">{maskEmail(row.recipientEmail)}</Td>
                                  <Td fontSize="xs">
                                    <Text>{row.sequenceName || row.sequenceId || 'Unknown sequence'}</Text>
                                    <Text color="gray.500">{row.enrollmentName || row.enrollmentId}</Text>
                                  </Td>
                                  <Td>
                                    <Badge size="sm" variant="outline">{row.status}</Badge>
                                  </Td>
                                  <Td fontSize="xs">
                                    <Text>{row.reason || '—'}</Text>
                                    {row.lastError ? <Text color="gray.500" noOfLines={2}>{row.lastError}</Text> : null}
                                  </Td>
                                  <Td fontSize="xs">{row.scheduledFor ? new Date(row.scheduledFor).toLocaleString() : row.sentAt ? new Date(row.sentAt).toLocaleString() : '—'}</Td>
                                  <Td fontSize="xs">{row.identityEmail || '—'}</Td>
                                  <Td>
                                    <VStack align="start" spacing={1}>
                                      <HStack spacing={1}>
                                        <Button size="xs" variant="ghost" onClick={() => openQueueModal(row.enrollmentId)}>
                                          Queue
                                        </Button>
                                        <Button size="xs" variant="ghost" onClick={() => openAuditPanelForQueueItem(row.queueItemId)}>
                                          Audit
                                        </Button>
                                      </HStack>
                                      <HStack spacing={1}>
                                        <Button
                                          size="xs"
                                          variant="outline"
                                          isLoading={queueWorkbenchActionId === row.queueItemId}
                                          isDisabled={!queueActionAllowed(row, 'QUEUED')}
                                          onClick={() => applyQueueWorkbenchAction(row.queueItemId, { status: 'QUEUED' })}
                                        >
                                          Requeue
                                        </Button>
                                        <Button
                                          size="xs"
                                          variant="outline"
                                          isLoading={queueWorkbenchActionId === row.queueItemId}
                                          isDisabled={!queueActionAllowed(row, 'SKIPPED')}
                                          onClick={() => {
                                            const reason = (typeof window !== 'undefined' && window.prompt?.('Skip reason (optional):'))?.trim().slice(0, 200) || 'triage_skip'
                                            void applyQueueWorkbenchAction(row.queueItemId, { status: 'SKIPPED', skipReason: reason })
                                          }}
                                        >
                                          Skip
                                        </Button>
                                      </HStack>
                                    </VStack>
                                  </Td>
                                </Tr>
                              ))}
                            </Tbody>
                          </Table>
                        </Box>
                        <Text id="queue-workbench-backend-refresh" data-testid="queue-workbench-backend-refresh" fontSize="xs" color="gray.500">
                          Backend truth refresh marker: {queueWorkbenchData?.lastUpdatedAt ? new Date(queueWorkbenchData.lastUpdatedAt).toLocaleString() : 'pending'}
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                          Row-level safe actions use existing tenant-scoped queue endpoints. For deep inspection, use Queue and Audit drill-downs.
                        </Text>
                      </VStack>
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
                  </Collapse>
                </>
              )}
            </VStack>
          </Collapse>
        </CardBody>
      </Card>
      </Collapse>

      <Collapse in={isDiagnosticsOpen} animateOpacity>
        <Card mb={6}>
          <CardBody>
            <Heading size="sm" mb={3} cursor="pointer" onClick={isQueuePreviewPanelOpen ? onQueuePreviewPanelClose : onQueuePreviewPanelOpen}>
              Queue preview (troubleshooting) {isQueuePreviewPanelOpen ? '▼' : '▶'}
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
                                      onClick={() => {
                                        if (!item.id) return
                                        void previewQueueItemRender(item.id)
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
      </Collapse>

      <Collapse in={isDiagnosticsOpen} animateOpacity>
        <Card mb={6}>
          <CardBody>
            <Heading size="sm" mb={3} cursor="pointer" onClick={isAuditPanelOpen ? onAuditPanelClose : onAuditPanelOpen}>
              Audit log (troubleshooting) {isAuditPanelOpen ? '▼' : '▶'}
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
      </Collapse>

      <Flex gap={4} mb={6} align="center" flexWrap="wrap">
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

        <HStack
          spacing={2}
          flexWrap="wrap"
          data-testid="sequences-operator-quick-filters"
        >
          <Button
            size="sm"
            variant={operatorQuickFilter === 'all' ? 'solid' : 'outline'}
            colorScheme={operatorQuickFilter === 'all' ? 'gray' : 'gray'}
            onClick={() => handleOperatorQuickFilterChange('all')}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={operatorQuickFilter === 'ready' ? 'solid' : 'outline'}
            colorScheme="green"
            data-testid="sequences-filter-ready-now"
            onClick={() => handleOperatorQuickFilterChange('ready')}
          >
            Ready now
          </Button>
          <Button
            size="sm"
            variant={operatorQuickFilter === 'needs_attention' ? 'solid' : 'outline'}
            colorScheme="orange"
            data-testid="sequences-filter-needs-attention"
            onClick={() => handleOperatorQuickFilterChange('needs_attention')}
          >
            Needs attention
          </Button>
          <Button
            size="sm"
            variant={operatorQuickFilter === 'running' ? 'solid' : 'outline'}
            colorScheme="blue"
            data-testid="sequences-filter-running"
            onClick={() => handleOperatorQuickFilterChange('running')}
          >
            Running
          </Button>
          <Button
            size="sm"
            variant={operatorQuickFilter === 'archived' ? 'solid' : 'outline'}
            colorScheme="purple"
            data-testid="sequences-filter-archived"
            onClick={() => handleOperatorQuickFilterChange('archived')}
          >
            Archived
          </Button>
        </HStack>

        <Spacer />
      </Flex>

      <Card>
        <CardBody p={0}>
          <Box overflowX="auto">
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Sequence</Th>
                  <Th>Operator state</Th>
                  <Th>Live audience</Th>
                  <Th>Test audience</Th>
                  <Th>Latest result</Th>
                  <Th w="320px">Next operator action</Th>
                </Tr>
              </Thead>
              <Tbody>
                {operatorVisibleSequences.map((sequence) => {
                  const rowStateSummary = getSequenceOperatorStateSummary(sequence)
                  const rowSendConfidenceSummary = getSequenceSendConfidenceSummary(sequence)
                  const rowLiveAudienceSummary = getSequenceLiveAudienceSummary(sequence)
                  const rowTestAudienceSummary = getSequenceTestAudienceSummary(sequence)
                  const rowLastResultSummary = getSequenceLastResultSummary(sequence)
                  const nextActionLabel = getSequenceNextAction(sequence)
                  return (
                    <Tr key={sequence.id}>
                      <Td>
                        <VStack align="start" spacing={1}>
                          <HStack spacing={2}>
                            <Text fontWeight="semibold">{sequence.name}</Text>
                            {sequence.isArchived ? (
                              <Badge colorScheme="purple" variant="subtle">Archived</Badge>
                            ) : null}
                          </HStack>
                          <Text fontSize="sm" color="gray.600">
                            {sequence.description || 'No description'}
                          </Text>
                          {sequence.isArchived && sequence.archivedAt ? (
                            <Text fontSize="xs" color="gray.500">
                              Archived on {new Date(sequence.archivedAt).toLocaleDateString()}
                            </Text>
                          ) : null}
                        </VStack>
                      </Td>
                      <Td>
                        <VStack align="start" spacing={1}>
                          <HStack>
                            <Icon as={rowStateSummary.icon} color={`${rowStateSummary.colorScheme}.500`} boxSize={4} />
                            <Badge colorScheme={rowStateSummary.colorScheme} size="sm">
                              {rowStateSummary.label}
                            </Badge>
                            {rowStateSummary.attentionLabel ? (
                              <Badge variant="subtle" colorScheme={rowStateSummary.attentionColorScheme} size="sm">
                                {rowStateSummary.attentionLabel}
                              </Badge>
                            ) : null}
                          </HStack>
                          <Text fontSize="sm" fontWeight="medium">
                            {rowStateSummary.reasonLabel}
                          </Text>
                          <Text fontSize="xs" color="gray.600">
                            {rowStateSummary.detail}
                          </Text>
                          <HStack spacing={1} flexWrap="wrap" align="start" pt={1} data-testid="sequence-row-send-confidence">
                            {rowSendConfidenceSummary.map((signal) => (
                              <Badge key={`${sequence.id}-${signal.label}`} variant="subtle" colorScheme={signal.colorScheme} size="sm">
                                {signal.label}: {signal.value}
                              </Badge>
                            ))}
                          </HStack>
                        </VStack>
                      </Td>
                      <Td>
                        <VStack align="start" spacing={1}>
                          <Text fontSize="sm" fontWeight="medium">{rowLiveAudienceSummary.label}</Text>
                          <Text fontSize="xs" color="gray.600">{rowLiveAudienceSummary.detail}</Text>
                        </VStack>
                      </Td>
                      <Td>
                        <VStack align="start" spacing={1}>
                          <Text fontSize="sm" fontWeight="medium">{rowTestAudienceSummary.label}</Text>
                          <Text fontSize="xs" color="gray.600">{rowTestAudienceSummary.detail}</Text>
                        </VStack>
                      </Td>
                      <Td>
                        <VStack align="start" spacing={1}>
                          <Text fontSize="sm" fontWeight="medium">{rowLastResultSummary.label}</Text>
                          <Text fontSize="xs" color="gray.600">{rowLastResultSummary.detail}</Text>
                        </VStack>
                      </Td>
                      <Td>
                        <HStack justify="space-between" spacing={2}>
                          <Button
                            size="sm"
                            colorScheme={rowStateSummary.nextActionColorScheme}
                            variant={rowStateSummary.nextActionVariant}
                            title={nextActionLabel === 'Fix blocker' ? 'Open the section most likely to fix this blocker.' : undefined}
                            onClick={() => handleSequencePrimaryAction(sequence)}
                          >
                            {nextActionLabel}
                          </Button>
                          {canManageSequenceDestructiveActions ? (
                            <Button
                              size="sm"
                              variant={sequence.isArchived ? 'outline' : 'solid'}
                              colorScheme={sequence.isArchived ? 'purple' : 'gray'}
                              data-testid={sequence.isArchived ? 'sequence-row-unarchive-button' : 'sequence-row-archive-button'}
                              isLoading={archiveActionSequenceId === sequence.id}
                              loadingText={sequence.isArchived ? 'Unarchiving…' : 'Archiving…'}
                              onClick={() => {
                                void handleSetSequenceArchivedState(sequence, !sequence.isArchived)
                              }}
                            >
                              {sequence.isArchived ? 'Unarchive' : 'Archive'}
                            </Button>
                          ) : null}
                          <Menu>
                            <MenuButton
                              as={IconButton}
                              icon={<SettingsIcon />}
                              size="sm"
                              variant="ghost"
                              aria-label={`Sequence actions for ${sequence.name}`}
                            />
                            <MenuList>
                              <MenuItem icon={<EditIcon />} onClick={() => handleEditSequence(sequence)}>
                                Open sequence
                              </MenuItem>
                              {(sequence.status === 'draft' || sequence.status === 'paused') && sequence.campaignId && sequence.listId && (
                                <MenuItem icon={<EmailIcon />} onClick={() => handleEditSequence(sequence)}>
                                  Review before start
                                </MenuItem>
                              )}
                              {sequence.status === 'sending' && sequence.campaignId && (
                                <MenuItem icon={<TimeIcon />} onClick={() => handlePauseSequence(sequence.campaignId!)}>
                                  Pause sequence
                                </MenuItem>
                              )}
                              <MenuDivider />
                              {canManageSequenceDestructiveActions ? (
                                <MenuItem
                                  icon={<DeleteIcon />}
                                  color="red.500"
                                  isDisabled={Boolean(deletingSequenceId)}
                                  onClick={() => handleDeleteSequence(sequence)}
                                >
                                  {deletingSequenceId === sequence.id ? 'Deleting…' : 'Delete'}
                                </MenuItem>
                              ) : (
                                <MenuItem isDisabled color="gray.500">
                                  Delete restricted to Greg
                                </MenuItem>
                              )}
                            </MenuList>
                          </Menu>
                        </HStack>
                      </Td>
                    </Tr>
                  )
                })}
              </Tbody>
            </Table>
          </Box>
        </CardBody>
      </Card>

      <Modal isOpen={isOpen} onClose={handleCloseSequenceEditor} size="6xl" scrollBehavior="inside">
        <ModalOverlay />
          <ModalContent maxH="90vh">
            <ModalHeader borderBottom="1px solid" borderColor="gray.200" pb={4}>
            {editingSequence?.id ? 'Sequence details' : 'Create sequence'}
            </ModalHeader>
          <ModalCloseButton />
          <ModalBody p={0}>
            {editingSequence && (
              <>
              {editingSequence.id ? (
                <Flex justify="flex-end" px={6} pt={6}>
                  <Button
                    size="sm"
                    variant={isSequenceSetupOpen ? 'outline' : 'ghost'}
                    onClick={() => setIsSequenceSetupOpen((current) => !current)}
                  >
                    {isSequenceSetupOpen ? 'Hide sequence setup' : 'Edit sequence setup'}
                  </Button>
                </Flex>
              ) : null}
              <Collapse in={!editingSequence.id || isSequenceSetupOpen} animateOpacity>
              <SimpleGrid columns={{ base: 1, lg: 2 }} minH="0" h="full">
                {/* LEFT COLUMN — Sequence steps */}
                <Box
                  ref={sequenceStepsSectionRef}
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
                          {step.templateId && templates.find((template) => template.id === step.templateId)?.name ? (
                            <Text mt={1} color="gray.500">
                              Based on shared template: {templates.find((template) => template.id === step.templateId)?.name}
                            </Text>
                          ) : null}
                        </Box>
                      )}

                      <Flex mt={2} justify="space-between" align={{ base: 'stretch', md: 'center' }} gap={2} wrap="wrap">
                        <Box flex="1">
                          <Text fontSize="xs" color="gray.600">
                            This only changes this sequence step. It does not change the shared template.
                          </Text>
                          <HStack mt={2} spacing={2} flexWrap="wrap">
                            {sequenceStepAiSuggestion[step.stepOrder] ? (
                              <Badge colorScheme="blue" variant="subtle">
                                AI suggestion ready
                              </Badge>
                            ) : null}
                            {sequenceStepOriginals[step.stepOrder] &&
                            (
                              sequenceStepOriginals[step.stepOrder].subject !== step.subjectTemplate ||
                              sequenceStepOriginals[step.stepOrder].content !== (step.bodyTemplateText || htmlToPlainText(step.bodyTemplateHtml || ''))
                            ) ? (
                              <>
                                <Badge colorScheme="purple" variant="subtle">
                                  AI changes applied
                                </Badge>
                                <Badge colorScheme="orange" variant="subtle">
                                  Not saved yet
                                </Badge>
                              </>
                            ) : null}
                          </HStack>
                        </Box>
                        <HStack spacing={2}>
                          {sequenceStepOriginals[step.stepOrder] &&
                          (
                            sequenceStepOriginals[step.stepOrder].subject !== step.subjectTemplate ||
                            sequenceStepOriginals[step.stepOrder].content !== (step.bodyTemplateText || htmlToPlainText(step.bodyTemplateHtml || ''))
                          ) ? (
                            <Button size="xs" variant="ghost" onClick={() => restoreSequenceStepOriginal(step.stepOrder)}>
                              Restore original
                            </Button>
                          ) : null}
                          <Button
                            size="xs"
                            variant="outline"
                            leftIcon={<Icon as={RiSparkling2Line} />}
                            onClick={() => handleSequenceStepRewriteWithAI(step.stepOrder)}
                            isLoading={!!sequenceStepAiLoading[step.stepOrder]}
                            isDisabled={!step.subjectTemplate.trim() || !(step.bodyTemplateText || step.bodyTemplateHtml || '').trim()}
                          >
                            Enhance with AI
                          </Button>
                        </HStack>
                      </Flex>

                      {sequenceStepAiError[step.stepOrder] ? (
                        <Alert status="warning" mt={3} borderRadius="md">
                          <AlertIcon />
                          <AlertDescription fontSize="xs">{sequenceStepAiError[step.stepOrder]}</AlertDescription>
                        </Alert>
                      ) : null}

                      {sequenceStepAiSuggestion[step.stepOrder] ? (
                        <Box mt={3} borderWidth="1px" borderColor="blue.200" borderRadius="md" bg="blue.50" p={3}>
                          <HStack justify="space-between" align="start" mb={2}>
                            <VStack align="start" spacing={0}>
                              <HStack spacing={2}>
                                <Icon as={RiSparkling2Line} color="blue.500" />
                                <Text fontSize="sm" fontWeight="semibold">AI suggestion</Text>
                              </HStack>
                              <Text fontSize="xs" color="gray.600">
                                Apply this only if you want this sequence step to differ from the shared template.
                              </Text>
                            </VStack>
                            <HStack spacing={2}>
                              <Button size="xs" colorScheme="blue" onClick={() => applySequenceStepAiSuggestion(step.stepOrder)}>
                                Apply suggestion
                              </Button>
                              <Button size="xs" variant="ghost" onClick={() => restoreSequenceStepOriginal(step.stepOrder)}>
                                Restore original
                              </Button>
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() =>
                                  setSequenceStepAiSuggestion((prev) => ({ ...prev, [step.stepOrder]: null }))
                                }
                              >
                                Dismiss
                              </Button>
                            </HStack>
                          </HStack>
                          <VStack align="stretch" spacing={2}>
                            <Box>
                              <Text fontSize="xs" fontWeight="semibold">Suggested subject</Text>
                              <Text mt={1} fontSize="xs" whiteSpace="pre-wrap">
                                {sequenceStepAiSuggestion[step.stepOrder]?.subject}
                              </Text>
                            </Box>
                            <Box>
                              <Text fontSize="xs" fontWeight="semibold">Suggested content</Text>
                              <Text mt={1} fontSize="xs" whiteSpace="pre-wrap">
                                {sequenceStepAiSuggestion[step.stepOrder]?.content}
                              </Text>
                            </Box>
                          </VStack>
                        </Box>
                      ) : null}
                    </Box>
                  ))}
                </Box>

                {/* RIGHT COLUMN — Config (name, leads, sender) */}
                <Box p={6} overflowY="auto">
                  <Heading size="sm" mb={4}>
                    Configuration
                  </Heading>
                  {sequenceValidationVisible && sequenceDraftValidationErrors.length > 0 && (
                    <Alert status="error" mb={4} borderRadius="md">
                      <AlertIcon />
                      <Box>
                          <AlertTitle fontSize="sm">Complete the required fields to save</AlertTitle>
                        <AlertDescription fontSize="xs">
                          {sequenceDraftValidationErrors[0]}
                        </AlertDescription>
                      </Box>
                    </Alert>
                  )}

                  <VStack spacing={5} align="stretch">
                    <FormControl ref={sequenceDetailsSectionRef} isRequired>
                      <FormLabel>Sequence Name</FormLabel>
                      <Input
                        ref={sequenceNameInputRef}
                        value={editingSequence.name}
                        onChange={(e) =>
                          setEditingSequence({ ...editingSequence, name: e.target.value })
                        }
                        placeholder="e.g. Q1 Outreach — UK Property Managers"
                      />
                    </FormControl>

                    <FormControl ref={sequenceAudienceSectionRef} isRequired>
                      <FormLabel>Leads Snapshot</FormLabel>
                      <Select
                        ref={sequenceAudienceSelectRef}
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

                    <FormControl ref={sequenceSenderSectionRef} isRequired>
                      <FormLabel>Sender</FormLabel>
                      <Select
                        ref={sequenceSenderSelectRef}
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
                      <Text fontSize="sm" color="gray.600">
                        Save this sequence first, then use Start live sequence to launch the linked live recipients.
                      </Text>
                    )}
                  </VStack>
                </Box>
              </SimpleGrid>
              </Collapse>

              {editingSequence.id && (
                <Box borderTop="1px solid" borderColor="gray.200" p={6}>
                  <VStack align="stretch" spacing={4} mb={6}>
                    <Box ref={sequenceLaunchSectionRef}>
                      <Heading size="sm">Launch workflow</Heading>
                      <Text fontSize="sm" color="gray.600">
                        Review the sender mailbox, live audience, test audience, and readiness, then send a test batch or start the live sequence.
                      </Text>
                    </Box>
                    <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={3}>
                      <Card variant="outline">
                        <CardBody py={3}>
                          <Stat>
                            <StatLabel>Sender mailbox</StatLabel>
                            <StatNumber fontSize="sm">
                              {editingSequence.senderIdentityId
                                ? senderIdentities.find((sender) => sender.id === editingSequence.senderIdentityId)?.emailAddress || editingSequence.senderIdentity?.emailAddress || 'Selected mailbox'
                                : 'No mailbox selected'}
                            </StatNumber>
                            <StatHelpText>{editingSequence.senderIdentityId ? 'Used for the live sequence and test sends.' : 'Choose a mailbox before sending.'}</StatHelpText>
                          </Stat>
                        </CardBody>
                      </Card>
                      <Card variant="outline">
                        <CardBody py={3}>
                          <Stat>
                            <StatLabel>Live audience</StatLabel>
                            <StatNumber fontSize="sm">{liveAudienceSummary.label}</StatNumber>
                            <StatHelpText>{liveAudienceSummary.detail}</StatHelpText>
                          </Stat>
                        </CardBody>
                      </Card>
                      <Card variant="outline">
                        <CardBody py={3}>
                          <Stat>
                            <StatLabel>Test audience</StatLabel>
                            <StatNumber fontSize="sm">{testAudienceSummary.label}</StatNumber>
                            <StatHelpText>{testAudienceSummary.detail}</StatHelpText>
                          </Stat>
                        </CardBody>
                      </Card>
                      <Card variant="outline">
                        <CardBody py={3}>
                          <Stat>
                            <StatLabel>Live sequence state</StatLabel>
                            <StatNumber fontSize="sm">{humanizeSequenceStatus(editingSequence.status)}</StatNumber>
                            <StatHelpText>{launchStatusSummary.title}</StatHelpText>
                          </Stat>
                        </CardBody>
                      </Card>
                      <Card variant="outline">
                        <CardBody py={3}>
                          <Stat>
                            <StatLabel>Next operator action</StatLabel>
                            <StatNumber fontSize="sm">{nextActionSummary.label}</StatNumber>
                            <StatHelpText>{nextActionSummary.detail}</StatHelpText>
                          </Stat>
                        </CardBody>
                      </Card>
                      <Card variant="outline">
                        <CardBody py={3}>
                          <Stat>
                            <StatLabel>Latest send result</StatLabel>
                            <StatNumber fontSize="sm">{lastSequenceOutcomeSummary.label}</StatNumber>
                            <StatHelpText>{lastSequenceOutcomeSummary.detail}</StatHelpText>
                          </Stat>
                        </CardBody>
                      </Card>
                    </SimpleGrid>

                    <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={3}>
                      <Alert status={launchStatusSummary.tone} borderRadius="md" alignItems="flex-start">
                        <AlertIcon mt={1} />
                        <Box>
                          <AlertTitle fontSize="sm">Start live sequence</AlertTitle>
                          <AlertDescription fontSize="sm">{launchStatusSummary.detail}</AlertDescription>
                        </Box>
                      </Alert>
                      <Alert status={testLaunchSummary.tone} borderRadius="md" alignItems="flex-start">
                        <AlertIcon mt={1} />
                        <Box>
                          <AlertTitle fontSize="sm">Send test batch now</AlertTitle>
                          <AlertDescription fontSize="sm">{testLaunchSummary.detail}</AlertDescription>
                        </Box>
                      </Alert>
                    </SimpleGrid>

                    <Flex gap={3} flexWrap="wrap" align="center">
                      <Button
                        colorScheme="blue"
                        leftIcon={<EmailIcon />}
                        onClick={() => handleOperatorTestSend(editingSequence.sequenceId || undefined)}
                        isLoading={operatorTestSendLoading}
                        isDisabled={Boolean(sequenceModalTestDisabledReason)}
                      >
                        Send test batch now
                      </Button>
                      <Button
                        colorScheme="blue"
                        variant="outline"
                        onClick={() => editingSequence && handleRequestStart(editingSequence)}
                        isDisabled={!!sequenceStartBlockedReason}
                      >
                        Start live sequence
                      </Button>
                      <Text fontSize="xs" color="gray.600">
                        Send test batch now uses active test recipients only. Start live sequence uses the linked live recipients immediately after you start it.
                      </Text>
                    </Flex>
                  </VStack>
                    <Flex justify="space-between" align="center" mb={4} gap={3} flexWrap="wrap">
                      <Box>
                        <Heading size="sm">Test audience</Heading>
                        <Text fontSize="sm" color="gray.600">
                          Send test batch now uses test recipients only. It does not send to the live recipients used by Start live sequence.
                        </Text>
                      </Box>
                    <HStack spacing={2}>
                      <Button size="sm" leftIcon={<AddIcon />} onClick={onCreateEnrollmentOpen}>
                        Add test audience
                      </Button>
                    </HStack>
                  </Flex>
                  {isDiagnosticsOpen ? (
                    <Card variant="outline" borderColor="purple.200" bg="purple.50" mb={4}>
                      <CardBody py={4}>
                        <Flex justify="space-between" align={{ base: 'start', md: 'center' }} gap={3} flexWrap="wrap">
                          <Box maxW="3xl">
                            <Heading size="sm" mb={1}>Troubleshooting for test sends</Heading>
                            <Text fontSize="sm" color="gray.600">
                              Preview a test run, inspect queue and audit details, or rebuild a test queue only when the normal
                              test-send path needs investigation. These tools do not change live-send policy.
                            </Text>
                          </Box>
                          <Button size="sm" variant={isSequenceLaunchAdvancedOpen ? 'outline' : 'solid'} colorScheme="purple" onClick={() => setIsSequenceLaunchAdvancedOpen((current) => !current)}>
                            {isSequenceLaunchAdvancedOpen ? 'Hide troubleshooting' : 'Open troubleshooting'}
                          </Button>
                        </Flex>
                      </CardBody>
                    </Card>
                  ) : null}
                  {lastCreatedEnrollment?.id && (
                    <Alert status="success" mb={4} borderRadius="md">
                      <AlertIcon />
                      <Box flex="1">
                        <AlertTitle fontSize="sm">Test audience ready</AlertTitle>
                        <AlertDescription fontSize="xs">
                          {lastCreatedEnrollment.recipientCount != null ? `${lastCreatedEnrollment.recipientCount} test recipient${lastCreatedEnrollment.recipientCount === 1 ? '' : 's'} ready. ` : ''}Use View send results to confirm what sent, failed, or was blocked.
                        </AlertDescription>
                      </Box>
                      <Button size="xs" variant="outline" ml={3} onClick={() => openQueueModal(lastCreatedEnrollment.id)}>
                        View send results
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
                    <Text color="gray.500" fontSize="sm">No test recipients yet. Add a private test recipient before sending to the live audience.</Text>
                  ) : (
                    <Box overflowX="auto">
                      <Table size="sm">
                        <Thead>
                          <Tr>
                            <Th>Test group</Th>
                            <Th>Who will receive this</Th>
                            <Th>Status</Th>
                            <Th>Count</Th>
                            <Th>Created</Th>
                            <Th>Actions</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {enrollments.map((e) => (
                            <Tr key={e.id}>
                              <Td>
                                <Text fontSize="sm" fontWeight="medium">{e.name || e.id}</Text>
                                <Text fontSize="xs" color="gray.500">
                                  Updated {formatDateTimeLabel(e.updatedAt || e.createdAt)}
                                </Text>
                              </Td>
                              <Td>
                                <Text fontSize="sm">{describeEnrollmentAudience(e)}</Text>
                                <Text fontSize="xs" color="gray.500">
                                  {e.recipientSource === 'snapshot'
                                    ? 'Uses the linked live recipients for a test send only.'
                                    : e.recipientSource === 'manual'
                                      ? 'Uses manual private test recipients only.'
                                      : 'Recipient source is not recorded on older data.'}
                                </Text>
                              </Td>
                              <Td>
                                <Badge colorScheme={e.status === 'ACTIVE' ? 'green' : e.status === 'PAUSED' ? 'yellow' : 'gray'} size="sm">
                                  {humanizeSequenceStatus(e.status)}
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
                                    View test audience
                                  </Button>
                                  <Button
                                    size="xs"
                                    variant="ghost"
                                    leftIcon={<ViewIcon />}
                                    onClick={() => openQueueModal(e.id)}
                                  >
                                    View send results
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
                                  <Collapse in={isDiagnosticsOpen && isSequenceLaunchAdvancedOpen} animateOpacity>
                                    <VStack align="start" spacing={1}>
                                      <Text fontSize="xs" color="gray.500">Troubleshooting</Text>
                                      <HStack gap={2} wrap="wrap">
                                        <Button
                                          size="xs"
                                          variant="ghost"
                                          leftIcon={<RepeatIcon />}
                                          onClick={() => openDryRunModal(e.id)}
                                        >
                                          Preview test run
                                        </Button>
                                        <Button
                                          size="xs"
                                          variant="ghost"
                                          leftIcon={<InfoIcon />}
                                          onClick={() => openAuditModal(e.id)}
                                        >
                                          Open audit
                                        </Button>
                                        <Button
                                          size="xs"
                                          variant="ghost"
                                          leftIcon={<TimeIcon />}
                                          onClick={() => handleEnqueue(e.id)}
                                          isLoading={queueActionId === e.id}
                                        >
                                          Rebuild queue
                                        </Button>
                                      </HStack>
                                    </VStack>
                                  </Collapse>
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
            <Button variant="ghost" onClick={handleCloseSequenceEditor}>
              Close
            </Button>
            <Button variant="outline" onClick={handleSaveDraft} isDisabled={!canSaveDraft}>
              {editingSequence?.id ? 'Save changes' : 'Save draft'}
            </Button>
          </Flex>
        </ModalContent>
      </Modal>

      <Modal isOpen={isCreateEnrollmentOpen} onClose={onCreateEnrollmentClose} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add test audience</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Alert status="info" mb={4} borderRadius="md">
              <AlertIcon />
              <Box>
                <AlertTitle fontSize="sm">Choose test recipients</AlertTitle>
                <AlertDescription fontSize="xs">
                  Test recipients help you verify a send now without changing the live recipients used by Start live sequence.
                </AlertDescription>
              </Box>
            </Alert>
            <FormControl mb={4}>
              <FormLabel>Test group name (optional)</FormLabel>
              <Input
                value={createEnrollmentName}
                onChange={(e) => setCreateEnrollmentName(e.target.value)}
                placeholder="e.g. Internal test batch"
              />
            </FormControl>
            <FormControl mb={4} isRequired>
              <FormLabel>Test recipient source</FormLabel>
              <RadioGroup
                value={createEnrollmentRecipientSource}
                onChange={(val: 'snapshot' | 'manual') => setCreateEnrollmentRecipientSource(val)}
              >
                <VStack align="stretch" spacing={2}>
                  <Radio value="snapshot">Use linked lead batch recipients</Radio>
                  <Radio value="manual">Use manual test recipients</Radio>
                </VStack>
              </RadioGroup>
            </FormControl>
            {createEnrollmentRecipientSource === 'snapshot' ? (
              <Box mb={4}>
                <Alert status="info" borderRadius="md">
                  <AlertIcon />
                  <Box>
                    <AlertTitle fontSize="sm">From the linked lead batch</AlertTitle>
                    <AlertDescription fontSize="xs">
                      Creates a test group from the linked live recipients. Start live sequence still uses the live recipients directly.
                    </AlertDescription>
                  </Box>
                </Alert>
                {!editingSequence?.listId && (
                  <Alert status="error" mt={2} borderRadius="md">
                    <AlertIcon />
                    <AlertDescription fontSize="sm">
                      No linked lead batch is selected for this sequence. Select one in Configuration first, or switch to manual test recipients.
                    </AlertDescription>
                  </Alert>
                )}
                <Text fontSize="xs" color="gray.500" mt={2}>
                  Recipient preview: {linkedListSummary?.contactCount ?? leadBatches.find((b) => b.batchKey === materializedBatchKey)?.count ?? 0} recipients from the linked lead batch.
                </Text>
              </Box>
            ) : (
              <FormControl mb={4} isRequired>
                <FormLabel>Manual test recipients</FormLabel>
                <Textarea
                  value={createEnrollmentRecipients}
                  onChange={(e) => setCreateEnrollmentRecipients(e.target.value)}
                  placeholder="one@example.com&#10;two@example.com"
                  rows={6}
                />
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Paste one or more private test recipients, separated by new lines or commas.
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
                Save test recipients
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
              <Text>Results and queued recipients</Text>
              <Text fontSize="sm" color="gray.600">
                Use this view to confirm what sent, what failed, what is queued next, and why.
              </Text>
              <Collapse in={isDiagnosticsOpen} animateOpacity>
                <VStack align="stretch" spacing={3}>
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
              </Collapse>
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
                    Rebuild queue
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
                  {isAgencyUI() && isDiagnosticsOpen && (
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
                      {!adminSecret && <Text fontSize="xs" color="gray.500">Admin secret required.</Text>}
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
                              {isDiagnosticsOpen ? <Th w="80px">Details</Th> : null}
                              {isDiagnosticsOpen ? <Th w="230px">Operator Actions</Th> : null}
                            </Tr>
                          </Thead>
                          <Tbody>
                            {items.length === 0 ? (
                              <Tr>
                                <Td colSpan={isDiagnosticsOpen ? 8 : 6} color="gray.500">No items yet. Queue empty: awaiting generation / schedule.</Td>
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
                                  {isDiagnosticsOpen ? (
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
                                  ) : null}
                                  {isDiagnosticsOpen ? (
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
                                  ) : null}
                                </Tr>
                              ))
                            )}
                          </Tbody>
                        </Table>
                      </Box>
                      {isDiagnosticsOpen && queueDrawerDetailLoading && (
                        <Text fontSize="sm" color="gray.500">Loading detail…</Text>
                      )}
                      {isDiagnosticsOpen && queueDrawerDetailError && (
                        <Alert status="error" size="sm">
                          <AlertIcon />
                          <AlertDescription>{queueDrawerDetailError}</AlertDescription>
                        </Alert>
                      )}
                      {isDiagnosticsOpen && queueDrawerDetail && !queueDrawerDetailLoading && (
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
                      {isDiagnosticsOpen && queueEnrollmentId && selectedCustomerId && (
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
                  This starts the live sequence for the linked live recipients. Manual test enrollments are not used by this action.
                </Text>
                <Box>
                  <Text fontWeight="semibold">Sender</Text>
                  <Text fontSize="sm" color="gray.600">
                    {startPreview?.sender?.emailAddress || '—'}
                  </Text>
                </Box>
                <Box>
                  <Text fontWeight="semibold">Live audience</Text>
                  <Text fontSize="sm" color="gray.600">
                    {startPreview?.snapshot?.name || '—'}
                    {typeof startPreview?.snapshot?.memberCount === 'number'
                      ? ` (${startPreview.snapshot.memberCount} leads)`
                      : ''}
                  </Text>
                </Box>
                <Alert status="info" size="sm">
                  <AlertIcon />
                  <AlertDescription>
                    Start live sequence uses the linked live recipients. Use &quot;Send test batch now&quot; in the sequence view when you want to send only to active test recipients.
                  </AlertDescription>
                </Alert>
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
              Start live sequence
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Modal
        isOpen={isDeleteBlockedOpen}
        onClose={() => {
          setSequenceDeleteBlockers(null)
          onDeleteBlockedClose()
        }}
        size="lg"
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Sequence deletion blocked</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack align="stretch" spacing={4}>
              <Alert status="warning" variant="left-accent">
                <AlertIcon />
                <Box>
                  <AlertTitle>Linked campaigns still depend on this sequence</AlertTitle>
                  <AlertDescription>
                    {getSequenceDeleteSummaryText(sequenceDeleteBlockers?.details)}
                  </AlertDescription>
                </Box>
              </Alert>

              {canArchiveBlockedSequence && canManageSequenceDestructiveActions ? (
                <Alert status="info" variant="subtle">
                  <AlertIcon />
                  <Box>
                    <AlertTitle>Archive this sequence instead</AlertTitle>
                    <AlertDescription>
                      This sequence has historical campaign data and cannot be deleted. Archive it instead, then use
                      {' '}Show archived to view or restore it later.
                    </AlertDescription>
                  </Box>
                </Alert>
              ) : null}

              {(sequenceDeleteBlockers?.details.campaigns || []).map((campaign) => (
                <Box key={campaign.id} borderWidth="1px" borderRadius="md" px={4} py={3}>
                  <Flex justify="space-between" align="center" gap={3} mb={1}>
                    <Text fontWeight="semibold">{campaign.name}</Text>
                    <Badge colorScheme={getSequenceDeleteStatusBadgeColor(campaign.status)}>
                      {humanizeCampaignStatus(campaign.status)}
                    </Badge>
                  </Flex>
                  <Text fontSize="sm" color="gray.600">
                    {getSequenceDeleteReasonText(campaign)}
                  </Text>
                  <Text fontSize="xs" color="gray.500" mt={2}>
                    Campaign ID: {campaign.id}
                  </Text>
                </Box>
              ))}

              {sequenceDeleteBlockers?.details.totalCampaigns ? (
                <Text fontSize="sm" color="gray.600">
                  {sequenceDeleteBlockers.details.totalCampaigns} linked campaign
                  {sequenceDeleteBlockers.details.totalCampaigns === 1 ? '' : 's'} must be resolved before this
                  sequence can be deleted.
                </Text>
              ) : null}

              <Flex justify="flex-end" gap={3}>
                {canArchiveBlockedSequence && canManageSequenceDestructiveActions ? (
                  <Button
                    colorScheme="purple"
                    data-testid="sequence-delete-blocked-archive-button"
                    onClick={() => {
                      void handleArchiveBlockedSequence()
                    }}
                    isLoading={archiveActionSequenceId === sequenceDeleteBlockers?.sequence.id}
                    loadingText="Archiving…"
                  >
                    Archive sequence
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  onClick={handleOpenDeleteBlockedSequence}
                  isDisabled={!sequenceDeleteBlockers}
                >
                  Open linked sequence
                </Button>
                <Button
                  onClick={() => {
                    setSequenceDeleteBlockers(null)
                    onDeleteBlockedClose()
                  }}
                >
                  Close
                </Button>
              </Flex>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>

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
