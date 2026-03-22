import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Text, useToast } from '@chakra-ui/react'
import { api } from '../../../utils/api'
import { emit, on } from '../../../platform/events'
import type { DatabaseUser } from '../../../hooks/useUsersFromDatabase'
export type ProgressMeta = {
  completedAt?: string
  completionSource?: string
  completedByUserId?: string | null
  value?: Record<string, unknown>
  acknowledgements?: Array<{ completedAt: string; completedByUserId: string | null }>
}

type Ctx = {
  customerId: string
  accountData: Record<string, unknown> | null | undefined
  linkedEmailCount: number | null
  leadsGoogleSheetUrl: string
  assignedClientDdiNumber: string
  accountDetails: {
    startDateAgreed?: string
    startDateAgreedSetAt?: string
    startDateAgreedSetBy?: string | null
  }
  dbUsers: DatabaseUser[]
  onRefresh: () => void | Promise<void>

  sales: Record<string, boolean>
  ops: Record<string, boolean>
  am: Record<string, boolean>
  attachments: any[]
  hasLeadSheet: boolean
  emailsLinkedDone: boolean
  emailsHint: string

  busyKey: string | null
  setBusyKey: (k: string | null) => void
  dateExtra: Record<string, string>
  setDateExtra: React.Dispatch<React.SetStateAction<Record<string, string>>>

  saveItem: (
    group: 'sales' | 'ops' | 'am',
    itemKey: string,
    checked: boolean,
    valuePayload?: Record<string, unknown>,
  ) => Promise<void>

  resolveUserLabel: (id: string | null | undefined) => string
  metaFor: (group: 'sales' | 'ops' | 'am', key: string) => ProgressMeta
  renderMetaLine: (group: 'sales' | 'ops' | 'am', itemKey: string) => JSX.Element | null
  listAttachmentNames: (predicate: (t: string) => boolean) => string[]
}

const OnboardingProgressContext = createContext<Ctx | null>(null)

export function useOnboardingProgress(): Ctx {
  const v = useContext(OnboardingProgressContext)
  if (!v) throw new Error('useOnboardingProgress must be used within OnboardingProgressProvider')
  return v
}

export function OnboardingProgressProvider({
  customerId,
  accountData,
  linkedEmailCount,
  leadsGoogleSheetUrl,
  assignedClientDdiNumber,
  accountDetails,
  dbUsers,
  onRefresh,
  children,
}: {
  customerId: string
  accountData: Record<string, unknown> | null | undefined
  linkedEmailCount: number | null
  leadsGoogleSheetUrl: string
  assignedClientDdiNumber: string
  accountDetails: Ctx['accountDetails']
  dbUsers: DatabaseUser[]
  onRefresh: () => void | Promise<void>
  children: ReactNode
}) {
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
      : 'Count unavailable — status pending until loaded.'

  const resolveUserLabel = useCallback(
    (id: string | null | undefined) => {
      if (!id) return ''
      const u = dbUsers.find((x) => x.userId === id || x.email === id)
      if (!u) return id
      return `${u.firstName} ${u.lastName}`.trim() || u.email
    },
    [dbUsers],
  )

  const metaFor = useCallback(
    (group: 'sales' | 'ops' | 'am', key: string): ProgressMeta => {
      const root = accountData && typeof accountData === 'object' ? (accountData as any).progressTrackerMeta : null
      const g = root && typeof root[group] === 'object' ? (root as any)[group] : null
      const m = g && g[key] && typeof g[key] === 'object' ? g[key] : {}
      return m as ProgressMeta
    },
    [accountData],
  )

  const buildMetaParts = useCallback(
    (group: 'sales' | 'ops' | 'am', itemKey: string): string[] => {
      const m = metaFor(group, itemKey)
      const who = resolveUserLabel(m.completedByUserId)
      const when = m.completedAt ? new Date(m.completedAt).toLocaleString() : ''
      const parts: string[] = []
      if (m.completionSource === 'AUTO') parts.push('Auto')
      if (who) parts.push(`By ${who}`)
      if (when) parts.push(when)
      if (m.value && typeof m.value === 'object') {
        const v = m.value as Record<string, unknown>
        if (typeof v.firstOutreachSentAt === 'string')
          parts.push(`First outreach: ${new Date(v.firstOutreachSentAt).toLocaleString()}`)
        if (typeof v.nextMeetingDate === 'string') parts.push(`Next meeting: ${v.nextMeetingDate}`)
        if (typeof v.nextF2fMeetingDate === 'string') parts.push(`Next F2F: ${v.nextF2fMeetingDate}`)
        if (typeof v.confirmedTelesalesStartDate === 'string') parts.push(`Telesales start: ${v.confirmedTelesalesStartDate}`)
      }
      return parts
    },
    [metaFor, resolveUserLabel],
  )

  const renderMetaLine = useCallback(
    (group: 'sales' | 'ops' | 'am', itemKey: string) => {
      const parts = buildMetaParts(group, itemKey)
      if (parts.length === 0) return null
      return (
        <Text fontSize="xs" color="gray.600" mt={1}>
          {parts.join(' · ')}
        </Text>
      )
    },
    [buildMetaParts],
  )

  const listAttachmentNames = useCallback(
    (predicate: (t: string) => boolean) =>
      attachments.filter((a: any) => a && predicate(String(a.type || ''))).map((a: any) => a.fileName || a.id),
    [attachments],
  )

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

  const value = useMemo<Ctx>(
    () => ({
      customerId,
      accountData,
      linkedEmailCount,
      leadsGoogleSheetUrl,
      assignedClientDdiNumber,
      accountDetails,
      dbUsers,
      onRefresh,
      sales,
      ops,
      am,
      attachments,
      hasLeadSheet,
      emailsLinkedDone,
      emailsHint,
      busyKey,
      setBusyKey,
      dateExtra,
      setDateExtra,
      saveItem,
      resolveUserLabel,
      metaFor,
      renderMetaLine,
      listAttachmentNames,
    }),
    [
      accountData,
      accountDetails,
      am,
      assignedClientDdiNumber,
      attachments,
      busyKey,
      customerId,
      dateExtra,
      dbUsers,
      emailsHint,
      emailsLinkedDone,
      hasLeadSheet,
      leadsGoogleSheetUrl,
      linkedEmailCount,
      listAttachmentNames,
      metaFor,
      onRefresh,
      ops,
      renderMetaLine,
      resolveUserLabel,
      sales,
      saveItem,
    ],
  )

  return <OnboardingProgressContext.Provider value={value}>{children}</OnboardingProgressContext.Provider>
}
