/**
 * Progress Tracker auto-tick service (DB truth: Customer.accountData.progressTracker)
 *
 * NON-NEGOTIABLES:
 * - Idempotent: only ever sets items to true; never auto-unchecks.
 * - Non-destructive: preserves all existing accountData keys.
 * - Multi-tenant safety: caller must scope by customerId (this service is pure, no auth).
 *
 * Storage:
 * - `accountData.progressTracker` holds the boolean checklist state (existing contract).
 * - `accountData.progressTrackerMeta` is additive metadata for audit/debug:
 *    { [group]: { [itemKey]: { completedAt, completionSource, completedByUserId } } }
 */

export type ProgressGroup = 'sales' | 'ops' | 'am'

export type ProgressTrackerState = Record<string, any> & {
  sales?: Record<string, boolean>
  ops?: Record<string, boolean>
  am?: Record<string, boolean>
}

export type ProgressTrackerMetaState = Record<string, any> & {
  sales?: Record<string, { completedAt?: string; completionSource?: 'AUTO' | 'MANUAL'; completedByUserId?: string | null }>
  ops?: Record<string, { completedAt?: string; completionSource?: 'AUTO' | 'MANUAL'; completedByUserId?: string | null }>
  am?: Record<string, { completedAt?: string; completionSource?: 'AUTO' | 'MANUAL'; completedByUserId?: string | null }>
}

export const AUTO_TICK_ITEMS: ReadonlyArray<{ group: ProgressGroup; itemKey: string }> = [
  // Sales Team
  { group: 'sales', itemKey: 'sales_client_agreement' },
  { group: 'sales', itemKey: 'sales_start_date' },
  { group: 'sales', itemKey: 'sales_assign_am' },
  // Operations Team
  { group: 'ops', itemKey: 'ops_added_crm' },
  { group: 'ops', itemKey: 'ops_lead_tracker' },
  // Account Manager
  { group: 'am', itemKey: 'am_send_dnc' },
]

export const AUTO_TICK_KEY_SET = new Set(AUTO_TICK_ITEMS.map((i) => `${i.group}.${i.itemKey}`))

type ApplyAutoTickParams = {
  /** Existing accountData JSON (will not be mutated) */
  accountData: Record<string, any>
  /** Agreement upload present for this customer */
  hasAgreement: boolean
  /** Lead Google sheet present for this customer */
  hasLeadGoogleSheet: boolean
  /** Best-effort actor identity for meta (email/userId string) */
  actorUserId?: string | null
  /** Timestamp used for completedAt when transitioning false->true */
  nowIso?: string
}

function getObject(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as any
}

function getProgressTracker(accountData: Record<string, any>): ProgressTrackerState {
  const cur = getObject((accountData as any).progressTracker)
  return {
    ...cur,
    sales: getObject(cur.sales) as any,
    ops: getObject(cur.ops) as any,
    am: getObject(cur.am) as any,
  }
}

function getProgressTrackerMeta(accountData: Record<string, any>): ProgressTrackerMetaState {
  const cur = getObject((accountData as any).progressTrackerMeta)
  return {
    ...cur,
    sales: getObject(cur.sales) as any,
    ops: getObject(cur.ops) as any,
    am: getObject(cur.am) as any,
  }
}

function coerceTruthyString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  return v ? v : null
}

/**
 * Apply auto-tick rules to accountData and return updated copy if changes needed.
 */
export function applyAutoTicksToAccountData(params: ApplyAutoTickParams): {
  accountData: Record<string, any>
  changed: boolean
  applied: Array<{ group: ProgressGroup; itemKey: string }>
} {
  const {
    accountData,
    hasAgreement,
    hasLeadGoogleSheet,
    actorUserId = null,
    nowIso = new Date().toISOString(),
  } = params

  const base = getObject(accountData)
  const nextProgress = getProgressTracker(base)
  const nextMeta = getProgressTrackerMeta(base)
  const applied: Array<{ group: ProgressGroup; itemKey: string }> = []

  const markComplete = (group: ProgressGroup, itemKey: string) => {
    const currentGroup = getObject((nextProgress as any)[group]) as Record<string, boolean>
    const already = currentGroup[itemKey] === true
    if (already) return

    ;(nextProgress as any)[group] = { ...currentGroup, [itemKey]: true }
    const metaGroup = getObject((nextMeta as any)[group]) as Record<string, any>
    const prevMeta = getObject(metaGroup[itemKey])

    // Only stamp completedAt the first time this transitions to true
    const completedAt = prevMeta.completedAt || nowIso
    ;(nextMeta as any)[group] = {
      ...metaGroup,
      [itemKey]: {
        ...prevMeta,
        completedAt,
        completionSource: 'AUTO',
        completedByUserId: actorUserId,
      },
    }
    applied.push({ group, itemKey })
  }

  // Derive onboarding/customer signals from accountData
  const details = getObject((base as any).accountDetails)
  const startDate =
    coerceTruthyString((details as any).startDateAgreed) ||
    coerceTruthyString((details as any).startDate) ||
    coerceTruthyString((details as any).startDateAgreedAt)
  const assignedManagerId =
    coerceTruthyString((details as any).assignedAccountManagerId) ||
    coerceTruthyString((base as any).assignedAccountManagerId)
  const clientCreatedOnCrm =
    (details as any).clientCreatedOnCrm === true ||
    !!coerceTruthyString((details as any).clientCreatedOnCrmAt)
  const hasDnc =
    !!coerceTruthyString(getObject((base as any).dncSuppression).attachmentId) ||
    !!coerceTruthyString(getObject((base as any).dncSuppression).fileName)

  // Apply rules (idempotent: mark only, never unmark)
  if (hasAgreement) markComplete('sales', 'sales_client_agreement')
  if (startDate) markComplete('sales', 'sales_start_date')
  if (assignedManagerId) markComplete('sales', 'sales_assign_am')
  if (clientCreatedOnCrm) markComplete('ops', 'ops_added_crm')
  if (hasLeadGoogleSheet) markComplete('ops', 'ops_lead_tracker')
  if (hasDnc) markComplete('am', 'am_send_dnc')

  if (applied.length === 0) {
    return { accountData: base, changed: false, applied }
  }

  const nextAccountData: Record<string, any> = {
    ...base,
    progressTracker: {
      ...nextProgress,
      // keep existing debug metadata style, but do not rely on it as source of truth
      updatedAt: nowIso,
    },
    progressTrackerMeta: nextMeta,
  }

  return { accountData: nextAccountData, changed: true, applied }
}

/**
 * Apply a manual tick update (used by PUT /progress-tracker).
 * Keeps meta additive and does NOT clear completedAt on uncheck.
 */
export function applyManualTickToAccountData(params: {
  accountData: Record<string, any>
  group: ProgressGroup
  itemKey: string
  checked: boolean
  actorUserId?: string | null
  nowIso?: string
}): { accountData: Record<string, any> } {
  const { accountData, group, itemKey, checked, actorUserId = null, nowIso = new Date().toISOString() } = params
  const base = getObject(accountData)
  const nextProgress = getProgressTracker(base)
  const nextMeta = getProgressTrackerMeta(base)

  const currentGroup = getObject((nextProgress as any)[group]) as Record<string, boolean>
  ;(nextProgress as any)[group] = { ...currentGroup, [itemKey]: checked }

  if (checked === true) {
    const metaGroup = getObject((nextMeta as any)[group]) as Record<string, any>
    const prevMeta = getObject(metaGroup[itemKey])
    const completedAt = prevMeta.completedAt || nowIso
    ;(nextMeta as any)[group] = {
      ...metaGroup,
      [itemKey]: {
        ...prevMeta,
        completedAt,
        completionSource: 'MANUAL',
        completedByUserId: actorUserId,
      },
    }
  }

  return {
    accountData: {
      ...base,
      progressTracker: {
        ...nextProgress,
        updatedAt: nowIso,
      },
      progressTrackerMeta: nextMeta,
    },
  }
}

