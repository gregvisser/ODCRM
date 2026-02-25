import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Select,
  VStack,
  HStack,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Heading,
  Text,
  Divider,
  useToast,
  Alert,
  AlertIcon,
  AlertDescription
} from '@chakra-ui/react'
import { api } from '../utils/api'
import { getItem, setItem } from '../platform/storage'
import { getCognismProspects, type CognismProspect } from '../platform/stores/cognismProspects'
import { getAccounts } from '../platform/stores/accounts'
import { getCurrentCustomerId } from '../platform/stores/settings'
import NoActiveClientEmptyState from './NoActiveClientEmptyState'

/** Shape used for template picker; sourced from GET /api/templates (DB). */
interface WizardEmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  stepNumber: number
  account?: string
}

interface EmailIdentity {
  id: string
  emailAddress: string
  displayName?: string
}

type EmailSendSchedule = {
  id: string
  name: string
  timezone: string
  daysOfWeek: number[]
  startHour: number
  endHour: number
}

interface Contact {
  id: string
  firstName: string
  lastName: string
  companyName: string
  email: string
}

type SequenceEmailStepDraft = {
  stepNumber: number
  templateId?: string
  subject: string
  body: string
  // Delay AFTER previous email
  delayDaysMin: number
  delayDaysMax: number
}

interface WizardStepProps {
  step: number
  currentStep: number
  title: string
  children: React.ReactNode
}

function WizardStep({ step, currentStep, title, children }: WizardStepProps) {
  if (currentStep !== step) return null

  return (
    <Box>
      <Heading size="md" mb={4}>{title}</Heading>
      {children}
    </Box>
  )
}

export default function CampaignWizard({
  onSuccess,
  onCancel,
  campaignId
}: {
  onSuccess: () => void
  onCancel: () => void
  campaignId?: string
}) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [identities, setIdentities] = useState<EmailIdentity[]>([])
  const [schedules, setSchedules] = useState<EmailSendSchedule[]>([])
  const [, setContacts] = useState<Contact[]>([])
  const toast = useToast()
  const [prospectSearch, setProspectSearch] = useState('')

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    senderIdentityId: '',
    customerAccountName: '',
    sendScheduleId: '',
    sendWindowHoursStart: 9,
    sendWindowHoursEnd: 17,
    randomizeWithinHours: 24,
    followUpDelayDaysMin: 3,
    followUpDelayDaysMax: 5,
    sequenceSteps: [
      { stepNumber: 1, subject: '', body: '', delayDaysMin: 0, delayDaysMax: 0 } as SequenceEmailStepDraft,
      { stepNumber: 2, subject: '', body: '', delayDaysMin: 3, delayDaysMax: 5 } as SequenceEmailStepDraft,
    ],
    selectedProspectEmails: [] as string[]
  })

  const fetchIdentities = useCallback(async () => {
    const customerId = getCurrentCustomerId()
    if (!customerId) return
    const { data, error } = await api.get<EmailIdentity[]>(`/api/outlook/identities?customerId=${encodeURIComponent(customerId)}`)
    if (error) {
      console.error('Failed to fetch email identities:', error)
      toast({ title: 'Error', description: 'Failed to load email accounts', status: 'error' })
    } else if (data) {
      setIdentities(data)
    }
  }, [toast])

  const fetchSchedules = useCallback(async () => {
    const customerId = getCurrentCustomerId()
    if (!customerId) return
    const { data, error } = await api.get<EmailSendSchedule[]>(`/api/schedules?customerId=${encodeURIComponent(customerId)}`)
    if (error) {
      console.error('Failed to fetch schedules:', error)
      // Non-blocking
      setSchedules([])
    } else if (data) {
      setSchedules(data)
      if (data.length > 0) {
        setFormData((prev) => ({
          ...prev,
          sendScheduleId: prev.sendScheduleId || data[0].id,
        }))
      }
    }
  }, [])

  const fetchContacts = useCallback(async () => {
    // TODO: Fetch from contacts API when available
    // For now, using placeholder
    setContacts([])
  }, [])

  const fetchCampaign = useCallback(async (id: string) => {
    const { data } = await api.get<any>(`/api/campaigns/${id}`)
    if (data) {
      const rawTemplates = Array.isArray(data.templates) ? data.templates : []
      const sorted = rawTemplates.slice().sort((a: any, b: any) => (a.stepNumber || 0) - (b.stepNumber || 0))
      const mapped: SequenceEmailStepDraft[] = sorted
        .filter((t: any) => typeof t?.stepNumber === 'number')
        .map((t: any) => ({
          stepNumber: t.stepNumber,
          subject: t.subjectTemplate || '',
          body: t.bodyTemplateHtml || '',
          delayDaysMin: t.stepNumber === 1 ? 0 : (t.delayDaysMin ?? (data.followUpDelayDaysMin || 3)),
          delayDaysMax: t.stepNumber === 1 ? 0 : (t.delayDaysMax ?? (data.followUpDelayDaysMax || 5)),
        }))

      setFormData({
        name: data.name || '',
        description: data.description || '',
        senderIdentityId: data.senderIdentityId || '',
        customerAccountName: '',
        sendScheduleId: data.sendScheduleId || '',
        sendWindowHoursStart: data.sendWindowHoursStart || 9,
        sendWindowHoursEnd: data.sendWindowHoursEnd || 17,
        randomizeWithinHours: data.randomizeWithinHours || 24,
        followUpDelayDaysMin: data.followUpDelayDaysMin || 3,
        followUpDelayDaysMax: data.followUpDelayDaysMax || 5,
        sequenceSteps: mapped.length
          ? mapped.slice(0, 10)
          : [
              { stepNumber: 1, subject: '', body: '', delayDaysMin: 0, delayDaysMax: 0 },
              { stepNumber: 2, subject: '', body: '', delayDaysMin: data.followUpDelayDaysMin || 3, delayDaysMax: data.followUpDelayDaysMax || 5 },
            ],
        selectedProspectEmails: []
      })
    }
  }, [])

  useEffect(() => {
    fetchIdentities()
    fetchSchedules()
    fetchContacts()
    if (campaignId) {
      fetchCampaign(campaignId)
    } else {
      // Prefill last selections to speed up workflow for OpenDoors users.
      const lastIdentity = getItem('odcrm_last_sender_identity_id') || ''
      const lastAccount = getItem('odcrm_last_campaign_account') || ''
      setFormData((prev) => ({
        ...prev,
        senderIdentityId: prev.senderIdentityId || lastIdentity,
        customerAccountName: prev.customerAccountName || lastAccount,
      }))
    }
  }, [campaignId, fetchCampaign, fetchContacts, fetchIdentities, fetchSchedules])

  const availableAccounts = useMemo(() => {
    const accounts = getAccounts<{ name: string }>()
    const names = accounts.map((a) => a?.name).filter(Boolean)
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b))
  }, [])

  const [templatesFromApi, setTemplatesFromApi] = useState<WizardEmailTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true)
    const customerId = getCurrentCustomerId()
    if (!customerId) {
      setTemplatesFromApi([])
      setTemplatesLoading(false)
      return
    }
    const { data, error } = await api.get<Array<{ id: string; name: string; subjectTemplate: string; bodyTemplateHtml: string; bodyTemplateText?: string | null; stepNumber: number }>>('/api/templates')
    if (error) {
      toast({ title: 'Error', description: 'Failed to load templates', status: 'error' })
      setTemplatesFromApi([])
    } else if (data) {
      setTemplatesFromApi(
        data.map((t) => ({
          id: t.id,
          name: t.name || '',
          subject: t.subjectTemplate || '',
          body: t.bodyTemplateText || t.bodyTemplateHtml || '',
          stepNumber: t.stepNumber || 1,
        }))
      )
    }
    setTemplatesLoading(false)
  }, [toast])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const templatesForAccount = useMemo(() => {
    const acct = (formData.customerAccountName || '').trim()
    if (!acct) return templatesFromApi
    return templatesFromApi.filter((t) => !t.account || t.account.toLowerCase() === acct.toLowerCase())
  }, [templatesFromApi, formData.customerAccountName])

  const handleNext = () => {
    if (step === 1 && !formData.senderIdentityId) {
      toast({ title: 'Error', description: 'Please select your name/email first', status: 'error' })
      return
    }
    if (step === 2 && (!formData.customerAccountName || !formData.name)) {
      toast({ title: 'Error', description: 'Please select a customer and campaign name', status: 'error' })
      return
    }
    if (step === 3) {
      const steps = formData.sequenceSteps || []
      if (!Array.isArray(steps) || steps.length < 1) {
        toast({ title: 'Error', description: 'Please add at least one email step', status: 'error' })
      return
      }
      const missing = steps.find((s) => !s.subject?.trim() || !s.body?.trim())
      if (missing) {
        toast({ title: 'Error', description: `Please fill in subject and body for Step ${missing.stepNumber}`, status: 'error' })
        return
      }
      const badDelay = steps.find((s) => s.stepNumber > 1 && (s.delayDaysMin < 0 || s.delayDaysMax < 0 || s.delayDaysMax < s.delayDaysMin))
      if (badDelay) {
        toast({ title: 'Error', description: `Invalid delay range for Step ${badDelay.stepNumber}`, status: 'error' })
        return
      }
      if (steps.length > 10) {
        toast({ title: 'Error', description: 'Max 10 email steps per sequence', status: 'error' })
        return
      }
    }
    setStep(step + 1)
  }

  const handleSave = async (): Promise<string | undefined> => {
    setLoading(true)
    try {
      let id = campaignId

      if (!id) {
        // Create campaign
        const { data, error } = await api.post<{ id: string }>('/api/campaigns', {
          name: formData.name,
          description: formData.description,
          senderIdentityId: formData.senderIdentityId,
          sendScheduleId: formData.sendScheduleId || undefined,
          sendWindowHoursStart: formData.sendWindowHoursStart,
          sendWindowHoursEnd: formData.sendWindowHoursEnd,
          randomizeWithinHours: formData.randomizeWithinHours,
          followUpDelayDaysMin: formData.followUpDelayDaysMin,
          followUpDelayDaysMax: formData.followUpDelayDaysMax
        })

        if (error) throw new Error(error)
        if (!data) throw new Error('No data returned when creating campaign')
        // Prisma returns a full campaign object; it will include `id`.
        id = (data as any).id
      } else {
        // Update campaign
        await api.patch(`/api/campaigns/${id}`, {
          name: formData.name,
          description: formData.description,
          senderIdentityId: formData.senderIdentityId,
          sendScheduleId: formData.sendScheduleId || null,
          sendWindowHoursStart: formData.sendWindowHoursStart,
          sendWindowHoursEnd: formData.sendWindowHoursEnd,
          randomizeWithinHours: formData.randomizeWithinHours,
          followUpDelayDaysMin: formData.followUpDelayDaysMin,
          followUpDelayDaysMax: formData.followUpDelayDaysMax
        })
      }

      // Save templates
      await api.post(`/api/campaigns/${id}/templates`, {
        steps: (formData.sequenceSteps || [])
          .slice()
          .sort((a: SequenceEmailStepDraft, b: SequenceEmailStepDraft) => a.stepNumber - b.stepNumber)
          .map((s: SequenceEmailStepDraft) => ({
            stepNumber: s.stepNumber,
            subjectTemplate: s.subject,
            bodyTemplateHtml: s.body,
            bodyTemplateText: s.body.replace(/<[^>]*>/g, ''),
            delayDaysMin: s.stepNumber === 1 ? 0 : s.delayDaysMin,
            delayDaysMax: s.stepNumber === 1 ? 0 : s.delayDaysMax,
          }))
      })

      // Attach prospects (Cognism imports) if selected
      if (formData.selectedProspectEmails.length > 0) {
        const all = getCognismProspects()
        const selected = new Set(formData.selectedProspectEmails.map((e) => e.toLowerCase()))
        const scoped = all.filter((p) => {
          if (!selected.has(p.email.toLowerCase())) return false
          const acct = (formData.customerAccountName || '').trim().toLowerCase()
          return acct ? (p.accountName || '').toLowerCase() === acct : true
        })

        if (scoped.length > 0) {
          const upsert = await api.post<{ contacts: Array<{ id: string; email: string }> }>(`/api/contacts/bulk-upsert`, {
            contacts: scoped.map((p: CognismProspect) => ({
              firstName: p.firstName,
              lastName: p.lastName,
              jobTitle: p.jobTitle,
              companyName: p.companyName,
              email: p.email,
              phone: p.phone,
              source: 'cognism',
            })),
          })
          if (upsert.error) throw new Error(upsert.error)

          const ids = (upsert.data?.contacts || []).map((c) => c.id).filter(Boolean)
          if (ids.length > 0) {
            const attach = await api.post(`/api/campaigns/${id}/prospects`, { contactIds: ids })
            if (attach.error) throw new Error(attach.error)
          }
        }
      }

      toast({ title: 'Success', description: 'Campaign saved', status: 'success' })

      // Persist "last used" choices for speed.
      setItem('odcrm_last_sender_identity_id', formData.senderIdentityId)
      setItem('odcrm_last_campaign_account', formData.customerAccountName)

      onSuccess()
      return id
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save campaign', status: 'error' })
      return undefined
    } finally {
      setLoading(false)
    }
  }

  const applyTemplateToStep = (stepNumber: number, t: WizardEmailTemplate) => {
    setFormData((prev) => ({
      ...prev,
      sequenceSteps: (prev.sequenceSteps || []).map((s: SequenceEmailStepDraft) =>
        s.stepNumber === stepNumber ? { ...s, templateId: t.id, subject: t.subject, body: t.body } : s
      )
    }))
  }

  const updateSequenceStep = (stepNumber: number, patch: Partial<SequenceEmailStepDraft>) => {
    setFormData((prev) => ({
      ...prev,
      sequenceSteps: (prev.sequenceSteps || []).map((s: SequenceEmailStepDraft) =>
        s.stepNumber === stepNumber ? { ...s, ...patch } : s
      )
    }))
  }

  const addSequenceStep = () => {
    setFormData((prev) => {
      const existing = (prev.sequenceSteps || []).slice().sort((a: SequenceEmailStepDraft, b: SequenceEmailStepDraft) => a.stepNumber - b.stepNumber)
      if (existing.length >= 10) return prev
      const nextStepNumber = (existing[existing.length - 1]?.stepNumber || 0) + 1
      const min = prev.followUpDelayDaysMin || 3
      const max = prev.followUpDelayDaysMax || 5
      return {
        ...prev,
        sequenceSteps: [
          ...existing,
          { stepNumber: nextStepNumber, subject: '', body: '', delayDaysMin: min, delayDaysMax: max }
        ]
      }
    })
  }

  const removeSequenceStep = (stepNumber: number) => {
    if (stepNumber === 1) return
    setFormData((prev) => {
      const kept = (prev.sequenceSteps || []).filter((s: SequenceEmailStepDraft) => s.stepNumber !== stepNumber)
      // Re-number sequentially starting at 1 to keep backend happy.
      const renumbered = kept
        .slice()
        .sort((a: SequenceEmailStepDraft, b: SequenceEmailStepDraft) => a.stepNumber - b.stepNumber)
        .map((s: SequenceEmailStepDraft, idx: number) => ({
          ...s,
          stepNumber: idx + 1,
          // Step 1 is always "right away"
          delayDaysMin: idx === 0 ? 0 : (s.delayDaysMin ?? (prev.followUpDelayDaysMin || 3)),
          delayDaysMax: idx === 0 ? 0 : (s.delayDaysMax ?? (prev.followUpDelayDaysMax || 5)),
        }))
      return { ...prev, sequenceSteps: renumbered }
    })
  }

  const cognismProspectsForCustomer = useMemo(() => {
    const all = getCognismProspects()
    const acct = (formData.customerAccountName || '').trim().toLowerCase()
    if (!acct) return []
    return all
      .filter((p) => (p.accountName || '').toLowerCase() === acct)
      .sort((a, b) => a.companyName.localeCompare(b.companyName))
  }, [formData.customerAccountName])

  const filteredCognismProspects = useMemo(() => {
    const base = cognismProspectsForCustomer
    const q = prospectSearch.trim().toLowerCase()
    if (!q) return base
    return base.filter((p) =>
      [p.firstName, p.lastName, p.email, p.companyName, p.jobTitle, p.phone]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    )
  }, [cognismProspectsForCustomer, prospectSearch])

  const selectedProspectSet = useMemo(
    () => new Set(formData.selectedProspectEmails.map((e) => e.toLowerCase())),
    [formData.selectedProspectEmails]
  )

  const setSelectedProspects = (next: Set<string>) => {
    setFormData((prev) => ({ ...prev, selectedProspectEmails: Array.from(next) }))
  }

  if (!getCurrentCustomerId()) {
    return (
      <Box>
        <NoActiveClientEmptyState />
      </Box>
    )
  }

  return (
    <Box>
      <VStack spacing={4} align="stretch">
        <WizardStep step={1} currentStep={step} title="Select Your Name">
          <VStack spacing={4}>
            <FormControl isRequired>
              <FormLabel>Your name / email</FormLabel>
              <Select
                value={formData.senderIdentityId}
                onChange={(e) => {
                  const next = e.target.value
                  setFormData((prev) => ({ ...prev, senderIdentityId: next }))
                  // Requested UX: picking your name moves you forward.
                  if (next) setStep(2)
                }}
                placeholder="Select your name"
              >
                {identities.map((id) => (
                  <option key={id.id} value={id.id}>
                    {id.displayName ? `${id.displayName} — ` : ''}{id.emailAddress}
                  </option>
                ))}
              </Select>
              {identities.length === 0 && (
                <Alert status="warning" mt={2}>
                  <AlertIcon />
                  <AlertDescription>
                    No email accounts connected. Please connect an Outlook account first.
                  </AlertDescription>
                </Alert>
              )}
            </FormControl>
          </VStack>
        </WizardStep>

        <WizardStep step={2} currentStep={step} title="Select Client & Settings">
          <VStack spacing={4} align="stretch">
            <FormControl isRequired>
              <FormLabel>Client account</FormLabel>
              <Select
                value={formData.customerAccountName}
                onChange={(e) => {
                  const next = e.target.value
                  setFormData((prev) => ({
                    ...prev,
                    customerAccountName: next,
                    name: prev.name || (next ? `${next} Campaign` : ''),
                    selectedProspectEmails: [],
                  }))
                  setProspectSearch('')
                }}
                placeholder="Select client"
              >
                {availableAccounts.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Select>
              {availableAccounts.length === 0 && (
                <Alert status="warning" mt={2}>
                  <AlertIcon />
                  <AlertDescription>
                    No client accounts found. Add accounts in Clients → Accounts first.
                  </AlertDescription>
                </Alert>
              )}
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Campaign name</FormLabel>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Legionella Jan Outreach"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Description</FormLabel>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional notes"
                rows={3}
              />
            </FormControl>

            <Divider />

            <FormControl>
              <FormLabel>Workspace schedule</FormLabel>
              <Select
                value={formData.sendScheduleId}
                onChange={(e) => setFormData((prev) => ({ ...prev, sendScheduleId: e.target.value }))}
                placeholder={schedules.length ? 'Select schedule' : 'No schedules found'}
              >
                {schedules.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.timezone}) · {s.startHour}:00–{s.endHour}:00
                  </option>
                ))}
              </Select>
              <Text fontSize="xs" color="gray.600" mt={1}>
                Multiple schedules are supported per customer. This campaign will only send during the selected schedule.
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>Send Window (Hours)</FormLabel>
              <HStack>
                <NumberInput
                  value={formData.sendWindowHoursStart}
                  onChange={(_, val) => setFormData({ ...formData, sendWindowHoursStart: val || 9 })}
                  min={0}
                  max={23}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
                <Text>to</Text>
                <NumberInput
                  value={formData.sendWindowHoursEnd}
                  onChange={(_, val) => setFormData({ ...formData, sendWindowHoursEnd: val || 17 })}
                  min={0}
                  max={23}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
              </HStack>
              <Text fontSize="xs" color="gray.600" mt={1}>
                If a schedule is selected above, the scheduler will use that schedule. These hours are a fallback for older campaigns.
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>Follow-up Delay (Days)</FormLabel>
              <HStack>
                <NumberInput
                  value={formData.followUpDelayDaysMin}
                  onChange={(_, val) => setFormData({ ...formData, followUpDelayDaysMin: val || 3 })}
                  min={1}
                  max={30}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
                <Text>to</Text>
                <NumberInput
                  value={formData.followUpDelayDaysMax}
                  onChange={(_, val) => setFormData({ ...formData, followUpDelayDaysMax: val || 5 })}
                  min={1}
                  max={30}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
              </HStack>
            </FormControl>
          </VStack>
        </WizardStep>

        <WizardStep step={3} currentStep={step} title="Build Sequence (Email-only, up to 10 steps)">
          <VStack spacing={4} align="stretch">
            <Alert status="info">
              <AlertIcon />
              <AlertDescription fontSize="sm">
                Templates come from Marketing → Email Templates. Pick one per step, then edit subject/body if needed.
                <br />
                Deliverability rails: max <strong>160 emails / 24h per customer</strong> (hard cap) and max <strong>5</strong>{' '}
                Outlook senders per customer.
              </AlertDescription>
            </Alert>

            {(formData.sequenceSteps || [])
              .slice()
              .sort((a: SequenceEmailStepDraft, b: SequenceEmailStepDraft) => a.stepNumber - b.stepNumber)
              .map((s: SequenceEmailStepDraft) => (
                <Box key={s.stepNumber} borderWidth={1} borderRadius="md" p={4}>
                  <HStack justify="space-between" mb={3} flexWrap="wrap" gap={2}>
                    <Heading size="sm">Step {s.stepNumber}: Email</Heading>
                    <HStack>
                      {s.stepNumber > 1 && (
                        <Button size="xs" variant="outline" colorScheme="gray" onClick={() => removeSequenceStep(s.stepNumber)}>
                          Remove
                        </Button>
                      )}
                    </HStack>
                  </HStack>

                  {s.stepNumber > 1 && (
                    <FormControl mb={3}>
                      <FormLabel>Deliver after previous email (days)</FormLabel>
                      <HStack>
                        <NumberInput
                          value={s.delayDaysMin}
                          onChange={(_, val) => updateSequenceStep(s.stepNumber, { delayDaysMin: val || 0 })}
                          min={0}
                          max={365}
                        >
                          <NumberInputField />
                          <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                          </NumberInputStepper>
                        </NumberInput>
                        <Text>to</Text>
                        <NumberInput
                          value={s.delayDaysMax}
                          onChange={(_, val) => updateSequenceStep(s.stepNumber, { delayDaysMax: val || 0 })}
                          min={0}
                          max={365}
                        >
                          <NumberInputField />
                          <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                          </NumberInputStepper>
                        </NumberInput>
                      </HStack>
                      <Text fontSize="xs" color="gray.600" mt={1}>
                        This delay is randomized between min/max for natural sending patterns.
                      </Text>
                </FormControl>
                  )}

                  <FormControl mb={3}>
                    <FormLabel>Pick a saved template (optional)</FormLabel>
                  <Select
                      placeholder={templatesLoading ? 'Loading...' : templatesForAccount.length ? 'Select a template' : 'No templates found'}
                      value={s.templateId || ''}
                    onChange={(e) => {
                        const picked = templatesForAccount.find((t) => t.id === e.target.value)
                        if (picked) applyTemplateToStep(s.stepNumber, picked)
                        else updateSequenceStep(s.stepNumber, { templateId: undefined })
                    }}
                  >
                      {templatesForAccount
                        .slice()
                        .sort((a, b) => (a.stepNumber || 0) - (b.stepNumber || 0) || a.name.localeCompare(b.name))
                        .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.account ? `[${t.account}] ` : ''}{t.name}
                      </option>
                    ))}
                  </Select>
                </FormControl>

                  <FormControl isRequired mb={3}>
                  <FormLabel>Subject</FormLabel>
                  <Input
                      value={s.subject}
                      onChange={(e) => updateSequenceStep(s.stepNumber, { subject: e.target.value })}
                      placeholder="Quick question about {{accountName}}"
                  />
                </FormControl>

                <FormControl isRequired>
                    <FormLabel>Body (HTML or plain text)</FormLabel>
                  <Textarea
                      value={s.body}
                      onChange={(e) => updateSequenceStep(s.stepNumber, { body: e.target.value })}
                    rows={10}
                    fontFamily="mono"
                    fontSize="sm"
                  />
                    <Text fontSize="xs" color="gray.600" mt={2}>
                      Variables supported: {`{{senderName}}`}, {`{{senderEmail}}`}, {`{{firstName}}`}/{`{{FirstName}}`},
                      {`{{lastName}}`}/{`{{LastName}}`}, {`{{fullName}}`}, {`{{companyName}}`}, aliases {`{{contactName}}`}, {`{{accountName}}`}.
                      <br />
                      Every email automatically includes an unsubscribe link (required).
                    </Text>
                </FormControl>
            </Box>
              ))}

            <HStack justify="space-between">
              <Text fontSize="sm" color="gray.600">
                Steps: <strong>{(formData.sequenceSteps || []).length}</strong> / 10
              </Text>
              <Button size="sm" colorScheme="gray" onClick={addSequenceStep} isDisabled={(formData.sequenceSteps || []).length >= 10}>
                + Add email step
              </Button>
            </HStack>
          </VStack>
        </WizardStep>

        <WizardStep step={4} currentStep={step} title="Attach Prospects (Cognism Export)">
          <VStack spacing={4} align="stretch">
            <Alert status="info">
              <AlertIcon />
              <AlertDescription fontSize="sm">
                Import prospects first in Marketing → Cognism Prospects. Then select them here to attach to this campaign.
              </AlertDescription>
            </Alert>

            {formData.customerAccountName ? (
              cognismProspectsForCustomer.length === 0 ? (
                <Alert status="warning">
                  <AlertIcon />
                  <AlertDescription fontSize="sm">
                    No Cognism prospects found for <strong>{formData.customerAccountName}</strong> yet.
                  </AlertDescription>
                </Alert>
              ) : (
                <Box borderWidth={1} borderRadius="md" p={3}>
                  <HStack justify="space-between" align="flex-start" flexWrap="wrap" gap={3} mb={3}>
                    <Box>
                      <Text fontSize="sm" color="gray.700">
                        Total: <strong>{cognismProspectsForCustomer.length}</strong> · Filtered:{' '}
                        <strong>{filteredCognismProspects.length}</strong> · Selected:{' '}
                        <strong>{selectedProspectSet.size}</strong>
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        Client: <strong>{formData.customerAccountName}</strong>
                      </Text>
                    </Box>
                    <HStack>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const next = new Set(selectedProspectSet)
                          for (const p of filteredCognismProspects) next.add(p.email.toLowerCase())
                          setSelectedProspects(next)
                        }}
                      >
                        Select filtered
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedProspects(new Set())}
                      >
                        Clear
                      </Button>
                    </HStack>
                  </HStack>

                  <FormControl mb={3}>
                    <FormLabel fontSize="sm" mb={1}>Search</FormLabel>
                    <Input
                      size="sm"
                      value={prospectSearch}
                      onChange={(e) => setProspectSearch(e.target.value)}
                      placeholder="Search name, email, company, title..."
                    />
                  </FormControl>

                  <Box borderWidth={1} borderRadius="md" overflowX="auto">
                    <Table size="sm">
                      <Thead bg="gray.50">
                        <Tr>
                          <Th w="60px">Select</Th>
                          <Th>Name</Th>
                          <Th>Email</Th>
                          <Th>Company</Th>
                          <Th>Title</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {filteredCognismProspects.length === 0 ? (
                          <Tr>
                            <Td colSpan={5}>
                              <Text py={3} fontSize="sm" color="gray.500">
                                No prospects match this search.
                              </Text>
                            </Td>
                          </Tr>
                        ) : (
                          filteredCognismProspects.slice(0, 500).map((p) => {
                            const emailKey = p.email.toLowerCase()
                            const isChecked = selectedProspectSet.has(emailKey)
                            return (
                              <Tr key={p.id}>
                                <Td>
                                  <Checkbox
                                    isChecked={isChecked}
                                    onChange={(e) => {
                                      const next = new Set(selectedProspectSet)
                                      if (e.target.checked) next.add(emailKey)
                                      else next.delete(emailKey)
                                      setSelectedProspects(next)
                                    }}
                                  />
                                </Td>
                                <Td>
                                  <Text fontSize="sm" fontWeight="semibold">
                                    {`${p.firstName} ${p.lastName}`.trim() || '(No name)'}
                                  </Text>
                                </Td>
                                <Td><Text fontSize="sm">{p.email}</Text></Td>
                                <Td><Text fontSize="sm">{p.companyName}</Text></Td>
                                <Td><Text fontSize="sm" color="gray.700">{p.jobTitle || '-'}</Text></Td>
                              </Tr>
                            )
                          })
                        )}
                      </Tbody>
                    </Table>
                  </Box>
                  <Text fontSize="xs" color="gray.500" mt={2}>
                    Showing up to 500 rows for performance.
                  </Text>
                </Box>
              )
            ) : (
              <Alert status="warning">
                <AlertIcon />
                <AlertDescription fontSize="sm">Select a client in the previous step first.</AlertDescription>
              </Alert>
            )}
          </VStack>
        </WizardStep>

        <WizardStep step={5} currentStep={step} title="Review & Launch">
          <VStack spacing={4} align="stretch">
            <Box p={4} borderWidth={1} borderRadius="md">
              <Text><strong>Campaign Name:</strong> {formData.name}</Text>
              <Text><strong>Sender:</strong> {identities.find(i => i.id === formData.senderIdentityId)?.emailAddress}</Text>
              <Text><strong>Client:</strong> {formData.customerAccountName || '(not set)'}</Text>
              <Text><strong>Send Window:</strong> {formData.sendWindowHoursStart}:00 - {formData.sendWindowHoursEnd}:00</Text>
              <Text><strong>Follow-up Delay:</strong> {formData.followUpDelayDaysMin}-{formData.followUpDelayDaysMax} days</Text>
            </Box>
          </VStack>
        </WizardStep>

        <HStack justify="space-between" mt={6}>
          <Button onClick={onCancel} isDisabled={loading}>
            Cancel
          </Button>
          <HStack>
            {step > 1 && (
              <Button onClick={() => setStep(step - 1)} isDisabled={loading}>
                Previous
              </Button>
            )}
            {step < 5 ? (
              <Button onClick={handleNext} colorScheme="gray" isDisabled={loading}>
                Next
              </Button>
            ) : (
              <>
                <Button onClick={handleSave} colorScheme="gray" isLoading={loading}>
                  Save as Draft
                </Button>
                <Button
                  onClick={async () => {
                    const id = await handleSave()
                    if (!id) return
                    const { error } = await api.post(`/api/campaigns/${id}/start`, {})
                    if (error) {
                      toast({ title: 'Error', description: error, status: 'error' })
                      return
                    }
                    toast({ title: 'Campaign started', status: 'success', duration: 2000 })
                  }}
                  colorScheme="gray"
                  isLoading={loading}
                >
                  Start Campaign
                </Button>
              </>
            )}
          </HStack>
        </HStack>
      </VStack>
    </Box>
  )
}
