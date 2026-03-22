import {
  Badge,
  Box,
  Button,
  Checkbox,
  HStack,
  Input,
  Text,
  VStack,
  useToast,
} from '@chakra-ui/react'
import { AttachmentIcon } from '@chakra-ui/icons'
import { emit } from '../../../platform/events'
import { ATTACHMENT_TYPES } from '../progressTrackerItems'
import { useOnboardingProgress } from './OnboardingProgressContext'
import { AttachmentInline } from './AttachmentInline'

/** Compact status chip for inline field rows */
export function StatusChip({
  done,
  label,
  auto,
}: {
  done: boolean
  label: string
  auto?: boolean
}) {
  return (
    <Badge colorScheme={done ? 'green' : 'gray'} fontSize="0.65rem" px={2} py={0.5} whiteSpace="nowrap">
      {done ? (auto ? `Auto · ${label}` : label) : `Pending · ${label}`}
    </Badge>
  )
}

export function InlineStartDateStatus() {
  const { sales, accountDetails, renderMetaLine, resolveUserLabel } = useOnboardingProgress()
  const checked = sales.sales_start_date === true
  return (
    <VStack align="stretch" spacing={0} minW={{ base: '100%', md: '200px' }}>
      <StatusChip done={checked} label="Start date" auto={!!accountDetails.startDateAgreed?.toString().trim()} />
      {accountDetails.startDateAgreedSetBy ? (
        <Text fontSize="xs" color="gray.500">
          Recorded{' '}
          {accountDetails.startDateAgreedSetAt ? new Date(accountDetails.startDateAgreedSetAt).toLocaleString() : ''}
          {resolveUserLabel(accountDetails.startDateAgreedSetBy) ? ` · ${resolveUserLabel(accountDetails.startDateAgreedSetBy)}` : ''}
        </Text>
      ) : null}
      {renderMetaLine('sales', 'sales_start_date')}
    </VStack>
  )
}

export function InlineAssignAmStatus() {
  const { sales, renderMetaLine } = useOnboardingProgress()
  const checked = sales.sales_assign_am === true
  return (
    <VStack align="stretch" spacing={0} minW={{ base: '100%', md: '180px' }}>
      <StatusChip done={checked} label="AM assigned" auto />
      {renderMetaLine('sales', 'sales_assign_am')}
    </VStack>
  )
}

export function InlineCrmAddedStatus() {
  const { ops, renderMetaLine } = useOnboardingProgress()
  const checked = ops.ops_added_crm === true
  return (
    <VStack align="stretch" spacing={0}>
      <StatusChip done={checked} label="On CRM" auto />
      {renderMetaLine('ops', 'ops_added_crm')}
    </VStack>
  )
}

export function InlineLeadTrackerStatus() {
  const { ops, hasLeadSheet, saveItem, busyKey, renderMetaLine } = useOnboardingProgress()
  const checked = ops.ops_lead_tracker === true
  return (
    <VStack align="stretch" spacing={1} minW={{ base: '100%', md: '220px' }}>
      {hasLeadSheet ? (
        <>
          <StatusChip done label="Lead tracker" auto />
          <Text fontSize="xs" color="gray.600">
            Sheet URL drives auto-complete.
          </Text>
        </>
      ) : (
        <HStack justify="space-between" align="flex-start" flexWrap="wrap">
          <VStack align="start" spacing={0}>
            <Text fontSize="xs" color="gray.600">
              No sheet URL — confirm manually when on tracker.
            </Text>
            {renderMetaLine('ops', 'ops_lead_tracker')}
          </VStack>
          <Checkbox
            isChecked={checked}
            onChange={(e) => void saveItem('ops', 'ops_lead_tracker', e.target.checked)}
            isDisabled={busyKey === 'ops.ops_lead_tracker'}
          />
        </HStack>
      )}
    </VStack>
  )
}

export function InlineEmailsLinkedStatus() {
  const { emailsLinkedDone, emailsHint } = useOnboardingProgress()
  return (
    <Box borderWidth="1px" borderRadius="md" borderColor="blue.100" bg="blue.50" px={3} py={2}>
      <HStack justify="space-between" align="start" flexWrap="wrap" spacing={2}>
        <Text fontSize="sm" fontWeight="medium" color="blue.900">
          Linked mailboxes
        </Text>
        <StatusChip done={emailsLinkedDone} label="Connected" auto={emailsLinkedDone} />
      </HStack>
      <Text fontSize="xs" color="blue.800" mt={1}>
        {emailsHint}
      </Text>
    </Box>
  )
}

export function InlineSuppressionDncStatus() {
  const { am, renderMetaLine } = useOnboardingProgress()
  const done = am.am_send_dnc === true
  return (
    <VStack align="stretch" spacing={0}>
      <HStack>
        <Text fontSize="sm" fontWeight="medium">
          DNC / suppression
        </Text>
        <StatusChip done={done} label="Listed" auto={done} />
      </HStack>
      {renderMetaLine('am', 'am_send_dnc')}
    </VStack>
  )
}

export function InlineDdiStatus() {
  const { ops, assignedClientDdiNumber, saveItem, busyKey, renderMetaLine } = useOnboardingProgress()
  const checked = ops.ops_create_ddi === true
  return (
    <VStack align="stretch" spacing={1} minW={{ base: '100%', md: '240px' }}>
      <Text fontSize="xs" color="gray.600">
        DDI in form: {assignedClientDdiNumber?.trim() || '—'}
      </Text>
      <Checkbox
        isChecked={checked}
        onChange={(e) => void saveItem('ops', 'ops_create_ddi', e.target.checked)}
        isDisabled={busyKey === 'ops.ops_create_ddi'}
      >
        <Text fontSize="sm">Confirm DDI created &amp; tested</Text>
      </Checkbox>
      {renderMetaLine('ops', 'ops_create_ddi')}
    </VStack>
  )
}

export function InlineAgreementContractStatus() {
  const { sales, renderMetaLine } = useOnboardingProgress()
  const agr = sales.sales_client_agreement === true
  const ctr = sales.sales_contract_signed === true
  return (
    <VStack align="stretch" spacing={1}>
      <HStack spacing={2} flexWrap="wrap">
        <Badge colorScheme={agr ? 'green' : 'gray'}>Agreement {agr ? 'on file' : 'pending'}</Badge>
        <Badge colorScheme={ctr ? 'green' : 'gray'}>Contract {ctr ? 'filed' : 'pending'}</Badge>
      </HStack>
      {renderMetaLine('sales', 'sales_client_agreement')}
    </VStack>
  )
}

export function InlineWeeklyTargetProgress() {
  const { am, renderMetaLine } = useOnboardingProgress()
  const done = am.am_weekly_target === true
  return (
    <VStack align="stretch" spacing={0} minW={{ base: '100%', md: '200px' }}>
      <StatusChip done={done} label="Weekly target captured" auto={done} />
      {renderMetaLine('am', 'am_weekly_target')}
    </VStack>
  )
}

export function InlineFirstPaymentRow() {
  const toast = useToast()
  const { customerId, sales, onRefresh, busyKey, setBusyKey, listAttachmentNames, renderMetaLine } =
    useOnboardingProgress()
  const checked = sales.sales_first_payment === true
  const names = listAttachmentNames((t) => t === ATTACHMENT_TYPES.firstPayment || t === 'payment_confirmation')
  return (
    <Box borderWidth="1px" borderRadius="md" p={3} borderColor="gray.200" bg="gray.50">
      <Text fontSize="sm" fontWeight="semibold" mb={2}>
        First payment confirmation
      </Text>
      <HStack justify="space-between" align="flex-start" flexWrap="wrap" spacing={3}>
        <VStack align="start" spacing={2}>
          <HStack spacing={2} flexWrap="wrap">
            <Button
              as="label"
              size="xs"
              leftIcon={<AttachmentIcon />}
              variant="outline"
              cursor="pointer"
              isLoading={busyKey === 'upload-payment'}
            >
              Upload confirmation
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
                      toast({
                        title: 'Upload failed',
                        description: err instanceof Error ? err.message : 'Error',
                        status: 'error',
                      })
                    } finally {
                      setBusyKey(null)
                      e.target.value = ''
                    }
                  })()
                }}
              />
            </Button>
            {names.map((n) => (
              <Badge key={n} colorScheme="teal">
                {n}
              </Badge>
            ))}
          </HStack>
          {renderMetaLine('sales', 'sales_first_payment')}
        </VStack>
        <StatusChip done={checked} label="Payment" auto={checked} />
      </HStack>
    </Box>
  )
}
