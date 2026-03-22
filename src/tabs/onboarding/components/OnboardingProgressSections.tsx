import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Badge,
  Box,
  Button,
  Checkbox,
  HStack,
  Input,
  Stack,
  Text,
  VStack,
  Wrap,
  WrapItem,
  useToast,
} from '@chakra-ui/react'
import { AttachmentIcon } from '@chakra-ui/icons'
import { api } from '../../../utils/api'
import { emit, on } from '../../../platform/events'
import type { DatabaseUser } from '../../../hooks/useUsersFromDatabase'
import {
  AM_AUTO_KEYS,
  AM_ITEMS,
  ATTACHMENT_TYPES,
  OPS_AUTO_KEYS,
  OPS_LEAD_HYBRID_KEY,
  OPS_TEAM_ITEMS,
  SALES_AUTO_KEYS,
  SALES_TEAM_ITEMS,
} from '../progressTrackerItems'

type ProgressMeta = {
  completedAt?: string
  completionSource?: string
  completedByUserId?: string | null
  value?: Record<string, unknown>
  acknowledgements?: Array<{ completedAt: string; completedByUserId: string | null }>
}

type Props = {
  customerId: string
  accountData: Record<string, unknown> | null | undefined
  linkedEmailCount: number | null
  leadsGoogleSheetUrl: string
  assignedClientDdiNumber: string
  /** For start-date attribution display */
  accountDetails: {
    startDateAgreed?: string
    startDateAgreedSetAt?: string
    startDateAgreedSetBy?: string | null
  }
  dbUsers: DatabaseUser[]
  onRefresh: () => void | Promise<void>
}

function resolveUserLabel(id: string | null | undefined, users: DatabaseUser[]): string {
  if (!id) return ''
  const u = users.find((x) => x.userId === id || x.email === id)
  if (!u) return id
  return `${u.firstName} ${u.lastName}`.trim() || u.email
}

function metaFor(group: 'sales' | 'ops' | 'am', key: string, accountData: Record<string, unknown> | null | undefined): ProgressMeta {
  const root = accountData && typeof accountData === 'object' ? (accountData as any).progressTrackerMeta : null
  const g = root && typeof root[group] === 'object' ? (root as any)[group] : null
  const m = g && g[key] && typeof g[key] === 'object' ? g[key] : {}
  return m as ProgressMeta
}

const DATE_PAYLOAD: Partial<Record<string, string>> = {
  am_communication: 'nextMeetingDate',
  am_face_to_face: 'nextF2fMeetingDate',
  am_confirm_start: 'confirmedTelesalesStartDate',
}

export default function OnboardingProgressSections({
  customerId,
  accountData,
  linkedEmailCount,
  leadsGoogleSheetUrl,
  assignedClientDdiNumber,
  accountDetails,
  dbUsers,
  onRefresh,
}: Props) {
  const toast = useToast()
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [dateExtra, setDateExtra] = useState<Record<string, string>>({})

  const sales = useMemo(
    () =>
      accountData && typeof accountData === 'object' && (accountData as any).progressTracker?.sales
        ? ((accountData as any).progressTracker.sales as Record<string, boolean>)
        : {},
    [accountData],
  )
  const ops = useMemo(
    () =>
      accountData && typeof accountData === 'object' && (accountData as any).progressTracker?.ops
        ? ((accountData as any).progressTracker.ops as Record<string, boolean>)
        : {},
    [accountData],
  )
  const am = useMemo(
    () =>
      accountData && typeof accountData === 'object' && (accountData as any).progressTracker?.am
        ? ((accountData as any).progressTracker.am as Record<string, boolean>)
        : {},
    [accountData],
  )

  const attachments = useMemo(() => {
    const raw = accountData && typeof accountData === 'object' ? (accountData as any).attachments : null
    return Array.isArray(raw) ? raw : []
  }, [accountData])

  const hasLeadSheet = Boolean(String(leadsGoogleSheetUrl || '').trim())

  const emailsLinkedDone = typeof linkedEmailCount === 'number' && linkedEmailCount >= 1
  const emailsHint =
    typeof linkedEmailCount === 'number'
      ? linkedEmailCount >= 1
        ? linkedEmailCount === 1
          ? 'Requirement met with 1 linked mailbox. Up to 4 more can be added.'
          : `${linkedEmailCount} linked mailboxes.`
        : 'Link at least one outreach mailbox to complete this step.'
      : 'Count unavailable.'

  const saveItem = useCallback(
    async (
      group: 'sales' | 'ops' | 'am',
      itemKey: string,
      checked: boolean,
      valuePayload?: Record<string, unknown>,
    ) => {
      setBusyKey(`${group}.${itemKey}`)
      const { data, error } = await api.put<{ success: boolean; progressTracker: unknown }>(
        `/api/customers/${customerId}/progress-tracker`,
        { group, itemKey, checked, valuePayload },
      )
      setBusyKey(null)
      if (error || !data?.success) {
        toast({ title: 'Save failed', description: error || 'Unable to save', status: 'error', duration: 5000 })
        return
      }
      await onRefresh()
      emit('customerUpdated', { id: customerId })
      toast({ title: 'Saved', status: 'success', duration: 2000 })
    },
    [customerId, onRefresh, toast],
  )

  useEffect(() => {
    return on<{ id?: string }>('customerUpdated', (d) => {
      if (d?.id === customerId) void onRefresh()
    })
  }, [customerId, onRefresh])

  const listAttachmentNames = (predicate: (t: string) => boolean) =>
    attachments.filter((a: any) => a && predicate(String(a.type || ''))).map((a: any) => a.fileName || a.id)

  const renderMetaLine = (group: 'sales' | 'ops' | 'am', itemKey: string) => {
    const m = metaFor(group, itemKey, accountData)
    const who = resolveUserLabel(m.completedByUserId, dbUsers)
    const when = m.completedAt ? new Date(m.completedAt).toLocaleString() : ''
    const parts: string[] = []
    if (m.completionSource === 'AUTO') parts.push('Auto')
    if (who) parts.push(`Completed by ${who}`)
    if (when) parts.push(when)
    if (m.value && typeof m.value === 'object') {
      const v = m.value as Record<string, unknown>
      if (typeof v.firstOutreachSentAt === 'string') parts.push(`First outreach: ${new Date(v.firstOutreachSentAt).toLocaleString()}`)
      if (typeof v.nextMeetingDate === 'string') parts.push(`Next meeting: ${v.nextMeetingDate}`)
      if (typeof v.nextF2fMeetingDate === 'string') parts.push(`Next F2F: ${v.nextF2fMeetingDate}`)
      if (typeof v.confirmedTelesalesStartDate === 'string') parts.push(`Telesales start: ${v.confirmedTelesalesStartDate}`)
    }
    if (parts.length === 0) return null
    return (
      <Text fontSize="xs" color="gray.600" mt={1}>
        {parts.join(' · ')}
      </Text>
    )
  }

  const renderSalesRow = (item: (typeof SALES_TEAM_ITEMS)[number]) => {
    const key = item.key
    const checked = sales[key] === true
    const isAuto = SALES_AUTO_KEYS.has(key)

    if (key === 'sales_start_date') {
      return (
        <Box key={key} py={2} borderBottom="1px solid" borderColor="gray.100">
          <HStack justify="space-between" align="start" flexWrap="wrap">
            <Box flex="1">
              <Text fontSize="sm" fontWeight="medium">
                {item.label}
              </Text>
              <Text fontSize="xs" color="gray.600">
                Saved date: {accountDetails.startDateAgreed ? String(accountDetails.startDateAgreed).slice(0, 10) : '—'}
              </Text>
              {accountDetails.startDateAgreedSetBy ? (
                <Text fontSize="xs" color="gray.500">
                  Recorded {accountDetails.startDateAgreedSetAt ? new Date(accountDetails.startDateAgreedSetAt).toLocaleString() : ''}{' '}
                  {resolveUserLabel(accountDetails.startDateAgreedSetBy, dbUsers) ? ` · ${resolveUserLabel(accountDetails.startDateAgreedSetBy, dbUsers)}` : ''}
                </Text>
              ) : null}
              {renderMetaLine('sales', key)}
            </Box>
            <Badge colorScheme={checked ? 'green' : 'gray'}>{checked ? 'Complete' : 'Pending'}</Badge>
          </HStack>
        </Box>
      )
    }

    if (isAuto) {
      return (
        <Box key={key} py={2} borderBottom="1px solid" borderColor="gray.100">
          <HStack justify="space-between">
            <Box>
              <Text fontSize="sm">{item.label}</Text>
              {key === 'sales_first_payment' ? (
                <Text fontSize="xs" color="gray.600">
                  Upload below when payment confirmation is available. Accepted via attachment type &quot;sales_first_payment&quot;.
                </Text>
              ) : null}
              {renderMetaLine('sales', key)}
            </Box>
            <Badge colorScheme={checked ? 'green' : 'gray'}>{checked ? 'Auto' : 'Pending'}</Badge>
          </HStack>
          {key === 'sales_first_payment' ? (
            <HStack mt={2} spacing={2} flexWrap="wrap">
              <Button
                as="label"
                size="xs"
                leftIcon={<AttachmentIcon />}
                variant="outline"
                cursor="pointer"
                isLoading={busyKey === 'upload-payment'}
              >
                Upload payment confirmation
                <Input
                  type="file"
                  display="none"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setBusyKey('upload-payment')
                    void (async () => {
                      try {
                        const fd = new FormData()
                        fd.append('file', file, file.name)
                        fd.append('attachmentType', ATTACHMENT_TYPES.firstPayment)
                        const r = await fetch(`/api/customers/${customerId}/attachments`, { method: 'POST', body: fd })
                        if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || r.statusText)
                        await onRefresh()
                        emit('customerUpdated', { id: customerId })
                        toast({ title: 'Uploaded', status: 'success', duration: 3000 })
                      } catch (err) {
                        toast({ title: 'Upload failed', description: err instanceof Error ? err.message : 'Error', status: 'error' })
                      } finally {
                        setBusyKey(null)
                        e.target.value = ''
                      }
                    })()
                  }}
                />
              </Button>
              {listAttachmentNames((t) => t === ATTACHMENT_TYPES.firstPayment || t === 'payment_confirmation').map((n) => (
                <Badge key={n} colorScheme="teal">
                  {n}
                </Badge>
              ))}
            </HStack>
          ) : null}
        </Box>
      )
    }

    const dateField = DATE_PAYLOAD[key as string]
    return (
      <Box key={key} py={2} borderBottom="1px solid" borderColor="gray.100">
        <Checkbox
          isChecked={checked}
          isDisabled={busyKey === `sales.${key}`}
          onChange={(e) => {
            const next = e.target.checked
            const vp =
              dateField && next
                ? { [dateField]: dateExtra[key] || undefined }
                : undefined
            void saveItem('sales', key, next, vp)
          }}
        >
          <Text fontSize="sm" as="span">
            {item.label}
          </Text>
        </Checkbox>
        {dateField ? (
          <Input
            type="date"
            size="sm"
            mt={1}
            maxW="220px"
            value={dateExtra[key] ?? ''}
            onChange={(e) => setDateExtra((p) => ({ ...p, [key]: e.target.value }))}
          />
        ) : null}
        {renderMetaLine('sales', key)}
      </Box>
    )
  }

  const renderOpsRow = (item: (typeof OPS_TEAM_ITEMS)[number]) => {
    const key = item.key
    if (key === 'ops_emails_linked') {
      const done = emailsLinkedDone
      return (
        <Box key={key} py={2} borderBottom="1px solid" borderColor="gray.100">
          <HStack justify="space-between" align="start">
            <Box flex="1">
              <Text fontSize="sm" fontWeight="medium">
                {item.label}
              </Text>
              <Text fontSize="xs" color="gray.600">
                {emailsHint}
              </Text>
            </Box>
            <Badge colorScheme={done ? 'green' : 'gray'}>{done ? 'Auto' : 'Pending'}</Badge>
          </HStack>
        </Box>
      )
    }

    if (key === OPS_LEAD_HYBRID_KEY) {
      const auto = hasLeadSheet
      const checked = ops[key] === true
      return (
        <Box key={key} py={2} borderBottom="1px solid" borderColor="gray.100">
          <HStack justify="space-between" align="start">
            <Box flex="1">
              <Text fontSize="sm">{item.label}</Text>
              <Text fontSize="xs" color="gray.600">
                {auto ? 'Lead sheet URL is set — this step is satisfied automatically.' : 'No sheet URL — confirm manually when the client is on the lead tracker.'}
              </Text>
              {renderMetaLine('ops', key)}
            </Box>
            {auto ? (
              <Badge colorScheme="green">Auto</Badge>
            ) : (
              <Checkbox
                isChecked={checked}
                onChange={(e) => void saveItem('ops', key, e.target.checked)}
                isDisabled={busyKey === `ops.${key}`}
              />
            )}
          </HStack>
        </Box>
      )
    }

    if (OPS_AUTO_KEYS.has(key)) {
      const checked = ops[key] === true
      return (
        <Box key={key} py={2} borderBottom="1px solid" borderColor="gray.100">
          <HStack justify="space-between">
            <Box flex="1">
              <Text fontSize="sm">{item.label}</Text>
              {renderMetaLine('ops', key)}
            </Box>
            <Badge colorScheme={checked ? 'green' : 'gray'}>{checked ? 'Auto' : 'Pending'}</Badge>
          </HStack>
          {key === 'ops_prepare_pack' ? (
            <AttachmentInline
              customerId={customerId}
              attachmentType={ATTACHMENT_TYPES.onboardingPack}
              busyKey={busyKey}
              setBusyKey={setBusyKey}
              onDone={() => void onRefresh()}
              files={listAttachmentNames((t) => t === ATTACHMENT_TYPES.onboardingPack || t.startsWith('onboarding_pack:'))}
            />
          ) : null}
          {key === 'ops_populate_ppt' ? (
            <AttachmentInline
              customerId={customerId}
              attachmentType={ATTACHMENT_TYPES.onboardingPpt}
              busyKey={busyKey}
              setBusyKey={setBusyKey}
              onDone={() => void onRefresh()}
              files={listAttachmentNames((t) => t === ATTACHMENT_TYPES.onboardingPpt)}
            />
          ) : null}
          {key === 'ops_receive_file' ? (
            <AttachmentInline
              customerId={customerId}
              attachmentType={ATTACHMENT_TYPES.clientInfo}
              busyKey={busyKey}
              setBusyKey={setBusyKey}
              onDone={() => void onRefresh()}
              files={listAttachmentNames((t) => t === ATTACHMENT_TYPES.clientInfo || t.startsWith('onboarding_client_info:'))}
            />
          ) : null}
          {key === 'ops_brief_campaigns' ? (
            <AttachmentInline
              customerId={customerId}
              attachmentType={ATTACHMENT_TYPES.briefCampaigns}
              busyKey={busyKey}
              setBusyKey={setBusyKey}
              onDone={() => void onRefresh()}
              files={listAttachmentNames((t) => t === ATTACHMENT_TYPES.briefCampaigns)}
            />
          ) : null}
        </Box>
      )
    }

    if (key === 'ops_create_ddi') {
      const checked = ops[key] === true
      return (
        <Box key={key} py={2} borderBottom="1px solid" borderColor="gray.100">
          <Text fontSize="sm" mb={1}>
            {item.label}
          </Text>
          <Text fontSize="xs" color="gray.600" mb={1}>
            DDI / number in onboarding form: {assignedClientDdiNumber?.trim() ? assignedClientDdiNumber : '—'}
          </Text>
          <Checkbox isChecked={checked} onChange={(e) => void saveItem('ops', key, e.target.checked)} isDisabled={busyKey === `ops.${key}`}>
            <Text fontSize="sm" as="span">
              Confirm DDI created &amp; tested
            </Text>
          </Checkbox>
          {renderMetaLine('ops', key)}
        </Box>
      )
    }

    const dateField = DATE_PAYLOAD[key as string]
    const checked = ops[key] === true
    return (
      <Box key={key} py={2} borderBottom="1px solid" borderColor="gray.100">
        <Checkbox isChecked={checked} onChange={(e) => void saveItem('ops', key, e.target.checked)} isDisabled={busyKey === `ops.${key}`}>
          <Text fontSize="sm" as="span">
            {item.label}
          </Text>
        </Checkbox>
        {dateField ? (
          <Input
            type="date"
            size="sm"
            mt={1}
            maxW="220px"
            value={dateExtra[key] ?? ''}
            onChange={(e) => setDateExtra((p) => ({ ...p, [key]: e.target.value }))}
          />
        ) : null}
        {renderMetaLine('ops', key)}
      </Box>
    )
  }

  const renderAmRow = (item: (typeof AM_ITEMS)[number]) => {
    const key = item.key
    if (key === 'am_campaigns_launched') {
      const m = metaFor('am', key, accountData)
      const acks = Array.isArray(m.acknowledgements) ? m.acknowledgements : []
      return (
        <Box key={key} py={2} borderBottom="1px solid" borderColor="gray.100">
          <Text fontSize="sm" fontWeight="medium" mb={1}>
            {item.label}
          </Text>
          <Text fontSize="xs" color="gray.600" mb={2}>
            Record one or more confirmations (e.g. different team members). Each click adds an acknowledgement.
          </Text>
          <Button
            size="sm"
            colorScheme="teal"
            variant="outline"
            isLoading={busyKey === 'am.am_campaigns_launched'}
            onClick={() => void saveItem('am', key, true)}
          >
            Record confirmation
          </Button>
          {acks.length > 0 ? (
            <VStack align="stretch" mt={2} spacing={1}>
              {acks.map((a, i) => (
                <Text key={i} fontSize="xs" color="gray.700">
                  {resolveUserLabel(a.completedByUserId, dbUsers)} · {new Date(a.completedAt).toLocaleString()}
                </Text>
              ))}
            </VStack>
          ) : null}
        </Box>
      )
    }

    if (AM_AUTO_KEYS.has(key)) {
      const checked = am[key] === true
      return (
        <Box key={key} py={2} borderBottom="1px solid" borderColor="gray.100">
          <HStack justify="space-between">
            <Box flex="1">
              <Text fontSize="sm">{item.label}</Text>
              {renderMetaLine('am', key)}
            </Box>
            <Badge colorScheme={checked ? 'green' : 'gray'}>{checked ? 'Auto' : 'Pending'}</Badge>
          </HStack>
        </Box>
      )
    }

    const dateField = DATE_PAYLOAD[key as string]
    const checked = am[key] === true
    return (
      <Box key={key} py={2} borderBottom="1px solid" borderColor="gray.100">
        <Checkbox
          isChecked={checked}
          onChange={(e) => {
            const next = e.target.checked
            const vp =
              dateField && next
                ? { [dateField]: dateExtra[key] || undefined }
                : undefined
            void saveItem('am', key, next, vp)
          }}
          isDisabled={busyKey === `am.${key}`}
        >
          <Text fontSize="sm" as="span">
            {item.label}
          </Text>
        </Checkbox>
        {dateField ? (
          <Input
            type="date"
            size="sm"
            mt={1}
            maxW="220px"
            value={dateExtra[key] ?? ''}
            onChange={(e) => setDateExtra((p) => ({ ...p, [key]: e.target.value }))}
          />
        ) : null}
        {renderMetaLine('am', key)}
      </Box>
    )
  }

  return (
    <Box border="1px solid" borderColor="blue.100" borderRadius="xl" p={4} bg="blue.50">
      <Text fontSize="md" fontWeight="semibold" color="blue.900" mb={3}>
        Onboarding checklist
      </Text>
      <Text fontSize="sm" color="blue.800" mb={4}>
        Progress is stored on the client record. Items marked Auto update from saved data, uploads, templates, mailboxes, and outreach activity.
      </Text>
      <Accordion allowMultiple defaultIndex={[0, 1, 2]}>
        <AccordionItem border="none">
          <AccordionButton bg="white" borderRadius="md" mb={2}>
            <Box flex="1" textAlign="left" fontWeight="semibold">
              Sales team
            </Box>
            <AccordionIcon />
          </AccordionButton>
          <AccordionPanel pb={4} px={0}>
            <Box bg="white" borderRadius="md" p={3}>
              {SALES_TEAM_ITEMS.map((it) => renderSalesRow(it))}
            </Box>
          </AccordionPanel>
        </AccordionItem>
        <AccordionItem border="none">
          <AccordionButton bg="white" borderRadius="md" mb={2}>
            <Box flex="1" textAlign="left" fontWeight="semibold">
              Operations team
            </Box>
            <AccordionIcon />
          </AccordionButton>
          <AccordionPanel pb={4} px={0}>
            <Box bg="white" borderRadius="md" p={3}>
              {OPS_TEAM_ITEMS.map((it) => renderOpsRow(it))}
            </Box>
          </AccordionPanel>
        </AccordionItem>
        <AccordionItem border="none">
          <AccordionButton bg="white" borderRadius="md" mb={2}>
            <Box flex="1" textAlign="left" fontWeight="semibold">
              Account manager
            </Box>
            <AccordionIcon />
          </AccordionButton>
          <AccordionPanel pb={4} px={0}>
            <Box bg="white" borderRadius="md" p={3}>
              {AM_ITEMS.map((it) => renderAmRow(it))}
            </Box>
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    </Box>
  )
}

function AttachmentInline({
  customerId,
  attachmentType,
  busyKey,
  setBusyKey,
  onDone,
  files,
}: {
  customerId: string
  attachmentType: string
  busyKey: string | null
  setBusyKey: (s: string | null) => void
  onDone: () => void
  files: string[]
}) {
  const toast = useToast()
  const upload = (file: File) => {
    const token = `upload-${attachmentType}`
    setBusyKey(token)
    void (async () => {
      try {
        const fd = new FormData()
        fd.append('file', file, file.name)
        fd.append('attachmentType', attachmentType)
        const r = await fetch(`/api/customers/${customerId}/attachments`, { method: 'POST', body: fd })
        if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || r.statusText)
        onDone()
        emit('customerUpdated', { id: customerId })
        toast({ title: 'Uploaded', status: 'success', duration: 2500 })
      } catch (e) {
        toast({ title: 'Upload failed', description: e instanceof Error ? e.message : 'Error', status: 'error' })
      } finally {
        setBusyKey(null)
      }
    })()
  }

  return (
    <Stack spacing={1} mt={2}>
      <Button as="label" size="xs" leftIcon={<AttachmentIcon />} variant="outline" isLoading={busyKey === `upload-${attachmentType}`} cursor="pointer">
        Add file
        <Input
          type="file"
          display="none"
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xlsx,.xls,.csv"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) upload(f)
            e.target.value = ''
          }}
        />
      </Button>
      {files.length > 0 ? (
        <Wrap>
          {files.map((f) => (
            <WrapItem key={f}>
              <Badge colorScheme="purple">{f}</Badge>
            </WrapItem>
          ))}
        </Wrap>
      ) : (
        <Text fontSize="xs" color="gray.500">
          No files yet
        </Text>
      )}
    </Stack>
  )
}
