/**
 * Settings → Troubleshooting & Feedback
 * Submit and view bug reports, suggestions, and ease-of-use feedback.
 * Admin (greg@bidlow.co.uk) can manage all reports; others see only their own.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Text,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  FormControl,
  FormLabel,
  FormHelperText,
  Input,
  Select,
  Textarea,
  useToast,
  Spinner,
  VStack,
  HStack,
  Divider,
  useDisclosure,
  Alert,
  AlertIcon,
  Switch,
} from '@chakra-ui/react'
import { api } from '../../utils/api'
import { getCurrentCustomerId } from '../../platform/stores/settings'

const REPORT_TYPES = ['Bug', 'Issue', 'Suggestion', 'Ease of Use', 'Feature Request', 'Other'] as const
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const
const STATUSES = ['Open', 'In Review', 'Planned', 'Resolved', 'Closed'] as const

const ADMIN_EMAIL = 'greg@bidlow.co.uk'

type ReportType = (typeof REPORT_TYPES)[number]
type Priority = (typeof PRIORITIES)[number]
type Status = (typeof STATUSES)[number]

export interface TroubleshootingReportDto {
  id: string
  customerId: string | null
  createdByUserId: string | null
  createdByEmail: string
  createdByName: string | null
  type: string
  title: string
  description: string
  priority: string
  appArea: string | null
  pagePath: string | null
  userAgent: string | null
  proofUrl: string | null
  proofFileName: string | null
  proofMimeType: string | null
  proofUploadedAt: string | null
  hasProof: boolean
  status: string
  internalNotes: string | null
  resolutionNotes: string | null
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
}

interface MeUser {
  id: string
  userId: string
  email: string
  role?: string
  department?: string
  accountStatus?: string
}

const ALLOWED_PROOF_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_PROOF_SIZE_MB = 5

export default function TroubleshootingTab() {
  const toast = useToast()
  const { isOpen: isDetailOpen, onOpen: onDetailOpen, onClose: onDetailClose } = useDisclosure()

  const [me, setMe] = useState<{ user: MeUser; email: string } | null>(null)
  const [meLoading, setMeLoading] = useState(true)
  const [reports, setReports] = useState<TroubleshootingReportDto[]>([])
  const [reportsLoading, setReportsLoading] = useState(true)
  const [selectedReport, setSelectedReport] = useState<TroubleshootingReportDto | null>(null)
  const [adminDetailStatus, setAdminDetailStatus] = useState<Status | null>(null)
  const [adminDetailInternalNotes, setAdminDetailInternalNotes] = useState('')
  const [adminDetailResolutionNotes, setAdminDetailResolutionNotes] = useState('')
  const [savingAdmin, setSavingAdmin] = useState(false)

  const [formType, setFormType] = useState<ReportType>('Bug')
  const [formPriority, setFormPriority] = useState<Priority>('Medium')
  const [formAppArea, setFormAppArea] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofUploadMeta, setProofUploadMeta] = useState<{
    proofUrl: string
    proofFileName: string
    proofMimeType: string
    proofBlobName: string
    proofContainerName: string
  } | null>(null)
  const [uploadingProof, setUploadingProof] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  /** Admin-only: when false, list only own reports (?mine=1) so personal history is not buried under other users' newer items. */
  const [showAllUsersReports, setShowAllUsersReports] = useState(false)

  const isAdmin = me?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()

  const loadMe = useCallback(async () => {
    setMeLoading(true)
    const { data, error } = await api.get<{ authorized: boolean; email?: string; user?: MeUser }>('/api/users/me')
    setMeLoading(false)
    if (error || !data?.authorized || !data?.user) {
      setMe(null)
      return
    }
    setMe({ user: data.user, email: data.email || data.user.email })
  }, [])

  const loadReports = useCallback(async () => {
    setReportsLoading(true)
    const qs = isAdmin && !showAllUsersReports ? '?mine=1' : ''
    const { data, error } = await api.get<TroubleshootingReportDto[]>(
      `/api/settings/troubleshooting${qs}`
    )
    setReportsLoading(false)
    if (error) {
      toast({ title: 'Error', description: error, status: 'error' })
      setReports([])
      return
    }
    setReports(Array.isArray(data) ? data : [])
  }, [toast, isAdmin, showAllUsersReports])

  useEffect(() => {
    loadMe()
  }, [loadMe])

  useEffect(() => {
    if (me) loadReports()
  }, [me, loadReports])

  const handleProofSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      setProofFile(null)
      setProofUploadMeta(null)
      return
    }
    if (!ALLOWED_PROOF_TYPES.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Use PNG, JPEG, or WebP only.',
        status: 'warning',
      })
      setProofFile(null)
      setProofUploadMeta(null)
      return
    }
    if (file.size > MAX_PROOF_SIZE_MB * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: `Max ${MAX_PROOF_SIZE_MB}MB.`,
        status: 'warning',
      })
      setProofFile(null)
      setProofUploadMeta(null)
      return
    }
    setProofFile(file)
    setProofUploadMeta(null)
  }

  const uploadProof = useCallback(async (): Promise<typeof proofUploadMeta> => {
    if (!proofFile) return null
    setUploadingProof(true)
    try {
      const reader = new FileReader()
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(proofFile)
      })
      const { data, error } = await api.post<{
        proofUrl: string
        proofFileName: string
        proofMimeType: string
        proofBlobName: string
        proofContainerName: string
      }>('/api/settings/troubleshooting/upload', { fileName: proofFile.name, dataUrl })
      if (error || !data) {
        toast({
          title: 'Upload failed',
          description: error || 'Could not upload proof',
          status: 'error',
        })
        return null
      }
      setProofUploadMeta(data)
      return data
    } finally {
      setUploadingProof(false)
    }
  }, [proofFile, toast])

  const handleSubmit = async () => {
    if (!formTitle.trim()) {
      toast({ title: 'Required', description: 'Please enter a title.', status: 'warning' })
      return
    }
    if (!formDescription.trim()) {
      toast({
        title: 'Required',
        description: 'Please enter a description.',
        status: 'warning',
      })
      return
    }
    setSubmitting(true)
    try {
      let proof = proofUploadMeta
      if (proofFile && !proof) proof = await uploadProof()

      const payload: Record<string, unknown> = {
        type: formType,
        title: formTitle.trim(),
        description: formDescription.trim(),
        priority: formPriority,
        appArea: formAppArea.trim() || null,
        pagePath: typeof window !== 'undefined' ? window.location.pathname || null : null,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent?.slice(0, 500) || null : null,
      }
      if (proof) {
        payload.proofUrl = proof.proofUrl
        payload.proofFileName = proof.proofFileName
        payload.proofMimeType = proof.proofMimeType
        payload.proofBlobName = proof.proofBlobName
        payload.proofContainerName = proof.proofContainerName
      }

      const { data, error } = await api.post<{ data: TroubleshootingReportDto }>(
        '/api/settings/troubleshooting',
        payload
      )
      if (error) {
        toast({ title: 'Error', description: error, status: 'error' })
        return
      }
      toast({
        title: 'Submitted',
        description: 'Your report has been submitted.',
        status: 'success',
      })
      setFormTitle('')
      setFormDescription('')
      setFormAppArea('')
      setProofFile(null)
      setProofUploadMeta(null)
      loadReports()
    } finally {
      setSubmitting(false)
    }
  }

  const openDetail = (report: TroubleshootingReportDto) => {
    setSelectedReport(report)
    setAdminDetailStatus(report.status as Status)
    setAdminDetailInternalNotes(report.internalNotes ?? '')
    setAdminDetailResolutionNotes(report.resolutionNotes ?? '')
    onDetailOpen()
  }

  const saveAdminDetail = async () => {
    if (!selectedReport || !isAdmin) return
    setSavingAdmin(true)
    try {
      const { error } = await api.patch<{ data: TroubleshootingReportDto }>(
        `/api/settings/troubleshooting/${selectedReport.id}`,
        {
          status: adminDetailStatus,
          internalNotes: adminDetailInternalNotes || null,
          resolutionNotes: adminDetailResolutionNotes || null,
        }
      )
      if (error) {
        toast({ title: 'Error', description: error, status: 'error' })
        return
      }
      toast({ title: 'Save', status: 'success' })
      onDetailClose()
      loadReports()
    } finally {
      setSavingAdmin(false)
    }
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'Open':
        return 'blue'
      case 'In Review':
        return 'yellow'
      case 'Planned':
        return 'purple'
      case 'Resolved':
      case 'Closed':
        return 'green'
      default:
        return 'gray'
    }
  }

  const priorityColor = (p: string) => {
    switch (p) {
      case 'Critical':
        return 'red'
      case 'High':
        return 'orange'
      case 'Medium':
        return 'yellow'
      default:
        return 'gray'
    }
  }

  if (meLoading || !me) {
    return (
      <Box p={4}>
        <Spinner size="sm" mr={2} />
        <Text as="span">{'Loading...'}</Text>
      </Box>
    )
  }

  return (
    <Box p={4}>
      <Text fontSize="sm" color="gray.700" mb={4}>
        {'Report bugs, ease-of-use problems, or suggest improvements. Your identity is recorded from your sign-in.'}
      </Text>

      {/* Identity strip */}
      <Box mb={4} p={3} bg="gray.50" borderRadius="md" borderWidth="1px" borderColor="gray.200">
        <Text fontSize="xs" color="gray.500" mb={1}>
          {'Submitting as'}
        </Text>
        <HStack spacing={4} flexWrap="wrap">
          <Text fontSize="sm" fontWeight="medium">
            {'User ID'}: {me.user.userId ?? me.user.id}
          </Text>
          <Text fontSize="sm">{'Email'}: {me.user.email}</Text>
        </HStack>
      </Box>

      {/* Form */}
      <VStack align="stretch" spacing={4} mb={6}>
        <FormControl>
          <FormLabel>Type</FormLabel>
          <Select
            value={formType}
            onChange={(e) => setFormType(e.target.value as ReportType)}
            size="sm"
            maxW="280px"
          >
            {REPORT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </FormControl>
        <FormControl>
          <FormLabel>Priority</FormLabel>
          <Select
            value={formPriority}
            onChange={(e) => setFormPriority(e.target.value as Priority)}
            size="sm"
            maxW="180px"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </FormControl>
        <FormControl>
          <FormLabel>{'App area / module'}</FormLabel>
          <Input
            value={formAppArea}
            onChange={(e) => setFormAppArea(e.target.value)}
            placeholder={'e.g. Marketing, Leads, Settings'}
            size="sm"
            maxW="320px"
          />
        </FormControl>
        <FormControl isRequired>
          <FormLabel>Title</FormLabel>
          <Input
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder={'Short summary'}
            size="sm"
            maxW="400px"
          />
        </FormControl>
        <FormControl isRequired>
          <FormLabel>{'Description'}</FormLabel>
          <Textarea
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder={'Describe the issue or suggestion in plain English.'}
            size="sm"
            rows={4}
            maxW="500px"
          />
        </FormControl>
        <FormControl>
          <FormLabel>{'Optional screenshot or image'}</FormLabel>
          <FormHelperText mb={2}>
            {`Optional: upload a screenshot or image to help explain the issue. PNG, JPEG, or WebP, max ${MAX_PROOF_SIZE_MB}MB.`}
          </FormHelperText>
          <HStack>
            <Input
              type="file"
              accept={ALLOWED_PROOF_TYPES.join(',')}
              onChange={handleProofSelect}
              size="sm"
              maxW="280px"
            />
            {proofFile && (
              <Text fontSize="sm" color="gray.600">
                {proofFile.name}
                {proofUploadMeta ? ' (ready)' : uploadingProof ? ' (uploading…)' : ''}
              </Text>
            )}
          </HStack>
        </FormControl>
        <Button
          colorScheme="blue"
          size="sm"
          onClick={handleSubmit}
          isLoading={submitting || (!!proofFile && uploadingProof)}
          isDisabled={!formTitle.trim() || !formDescription.trim()}
        >
          {'Submit report'}
        </Button>
      </VStack>

      <Divider my={4} />

      {/* Reports table */}
      <Text fontWeight="semibold" mb={1}>
        {isAdmin && showAllUsersReports ? "All users' reports" : 'Your reports'}
      </Text>
      {isAdmin && (
        <HStack spacing={3} mb={2} align="center">
          <Switch
            id="troubleshooting-show-all-users"
            isChecked={showAllUsersReports}
            onChange={(e) => setShowAllUsersReports(e.target.checked)}
            size="sm"
          />
          <FormLabel htmlFor="troubleshooting-show-all-users" mb={0} fontSize="sm" cursor="pointer">
            {'Show reports from all users'}
          </FormLabel>
        </HStack>
      )}
      {!reportsLoading && (
        <Text fontSize="xs" color="gray.600" mb={2}>
          {reports.length === 1 ? '1 report' : `${reports.length} reports`}
          {' · '}
          {'Newest first'}
        </Text>
      )}
      {reportsLoading ? (
        <HStack>
          <Spinner size="sm" />
          <Text fontSize="sm">{'Loading reports...'}</Text>
        </HStack>
      ) : reports.length === 0 ? (
        <Alert status="info" borderRadius="md">
          <AlertIcon />
          {'No reports yet. Submit one above.'}
        </Alert>
      ) : (
        <Box overflowX="auto" maxH="60vh" overflowY="auto">
          <Table size="sm" variant="simple">
            <Thead>
              <Tr>
                <Th>Created</Th>
                <Th>Type</Th>
                <Th>Priority</Th>
                <Th>Status</Th>
                <Th>Title</Th>
                <Th>App area</Th>
                <Th>Submitted by</Th>
                {isAdmin && <Th>Client</Th>}
                <Th>Updated</Th>
                <Th>Proof</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {reports.map((r) => (
                <Tr key={r.id}>
                  <Td fontSize="xs">{new Date(r.createdAt).toLocaleDateString()}</Td>
                  <Td>{r.type}</Td>
                  <Td>
                    <Badge size="sm" colorScheme={priorityColor(r.priority)}>
                      {r.priority}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge colorScheme={statusColor(r.status)}>{r.status}</Badge>
                  </Td>
                  <Td maxW="180px" isTruncated>
                    {r.title}
                  </Td>
                  <Td fontSize="xs">{r.appArea ?? '—'}</Td>
                  <Td fontSize="xs">{r.createdByEmail}</Td>
                  {isAdmin && <Td fontSize="xs">{r.customerId ?? '—'}</Td>}
                  <Td fontSize="xs">{new Date(r.updatedAt).toLocaleDateString()}</Td>
                  <Td>{r.hasProof ? 'Yes' : '—'}</Td>
                  <Td>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => openDetail(r)}
                    >
                      {isAdmin ? 'View / Edit' : 'View'}
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}

      {/* Admin detail modal */}
      <Modal isOpen={isDetailOpen} onClose={onDetailClose} size="lg" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{'Troubleshooting report'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedReport && (
              <VStack align="stretch" spacing={3}>
                <Text fontSize="sm" color="gray.600">
                  {selectedReport.title} · {selectedReport.type} · {selectedReport.priority}
                </Text>
                <Text fontSize="sm" whiteSpace="pre-wrap">
                  {selectedReport.description}
                </Text>
                <Text fontSize="xs" color="gray.500">
                  {`By ${selectedReport.createdByEmail} ${selectedReport.createdByName ? `(${selectedReport.createdByName})` : ''} · ${selectedReport.createdAt}`}
                </Text>
                {selectedReport.pagePath && (
                  <Text fontSize="xs">{'Page'}: {selectedReport.pagePath}</Text>
                )}
                {selectedReport.hasProof && (
                  <Box>
                    <Text fontSize="xs" fontWeight="medium" mb={1}>
                      Proof
                    </Text>
                    <Button
                      size="xs"
                      as="a"
                      href={`#proof-${selectedReport.id}`}
                      onClick={async (e) => {
                        e.preventDefault()
                        const { data } = await api.get<{ url: string }>(
                          `/api/settings/troubleshooting/${selectedReport.id}/proof-download`
                        )
                        if (data?.url) window.open(data.url, '_blank')
                      }}
                    >
                      {'Open proof (new tab)'}
                    </Button>
                  </Box>
                )}
                {selectedReport.resolutionNotes && (
                  <Box>
                    <Text fontSize="xs" fontWeight="medium" mb={1}>{'Resolution'}</Text>
                    <Text fontSize="sm" whiteSpace="pre-wrap">{selectedReport.resolutionNotes}</Text>
                  </Box>
                )}
                {isAdmin && (
                  <>
                    <Divider />
                    <FormControl>
                      <FormLabel>Status</FormLabel>
                      <Select
                        value={adminDetailStatus ?? selectedReport.status}
                        onChange={(e) => setAdminDetailStatus(e.target.value as Status)}
                        size="sm"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl>
                      <FormLabel>{'Internal notes (admin only)'}</FormLabel>
                      <Textarea
                        value={adminDetailInternalNotes}
                        onChange={(e) => setAdminDetailInternalNotes(e.target.value)}
                        size="sm"
                        rows={2}
                        placeholder={'Developer notes'}
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>{'Resolution notes'}</FormLabel>
                      <Textarea
                        value={adminDetailResolutionNotes}
                        onChange={(e) => setAdminDetailResolutionNotes(e.target.value)}
                        size="sm"
                        rows={2}
                        placeholder={'Summary of resolution'}
                      />
                    </FormControl>
                  </>
                )}
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={2} onClick={onDetailClose}>
              {'Close'}
            </Button>
            {isAdmin && (
              <Button colorScheme="blue" onClick={saveAdminDetail} isLoading={savingAdmin}>
                Save
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}
