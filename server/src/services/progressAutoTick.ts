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
 *    { [group]: { [itemKey]: { completedAt, completionSource, completedByUserId, value?, acknowledgements? } } }
 */

export type ProgressGroup = 'sales' | 'ops' | 'am'

export type ProgressItemMeta = {
  completedAt?: string
  completionSource?: 'AUTO' | 'MANUAL'
  completedByUserId?: string | null
  /** Optional structured payload (dates, notes) for manual items */
  value?: Record<string, unknown>
  /** Multi-acknowledgement entries (e.g. campaigns launched) */
  acknowledgements?: Array<{ completedAt: string; completedByUserId: string | null }>
}

export type ProgressTrackerState = Record<string, any> & {
  sales?: Record<string, boolean>
  ops?: Record<string, boolean>
  am?: Record<string, boolean>
}

export type ProgressTrackerMetaState = Record<string, any> & {
  sales?: Record<string, ProgressItemMeta>
  ops?: Record<string, ProgressItemMeta>
  am?: Record<string, ProgressItemMeta>
}

export const AUTO_TICK_ITEMS: ReadonlyArray<{ group: ProgressGroup; itemKey: string }> = [
  { group: 'sales', itemKey: 'sales_start_date' },
  { group: 'sales', itemKey: 'sales_assign_am' },
  { group: 'sales', itemKey: 'sales_client_agreement' },
  { group: 'sales', itemKey: 'sales_contract_signed' },
  { group: 'sales', itemKey: 'sales_first_payment' },
  { group: 'ops', itemKey: 'ops_added_crm' },
  { group: 'ops', itemKey: 'ops_lead_tracker' },
  { group: 'ops', itemKey: 'ops_emails_linked' },
  { group: 'ops', itemKey: 'ops_prepare_pack' },
  { group: 'ops', itemKey: 'ops_populate_ppt' },
  { group: 'ops', itemKey: 'ops_receive_file' },
  { group: 'ops', itemKey: 'ops_brief_campaigns' },
  { group: 'am', itemKey: 'am_send_dnc' },
  { group: 'am', itemKey: 'am_target_list' },
  { group: 'am', itemKey: 'am_qualifying_questions' },
  { group: 'am', itemKey: 'am_weekly_target' },
  { group: 'am', itemKey: 'am_campaign_template' },
  { group: 'am', itemKey: 'am_templates_reviewed' },
  { group: 'am', itemKey: 'am_populate_icp' },
  { group: 'am', itemKey: 'am_client_live' },
]

export const AUTO_TICK_KEY_SET = new Set(AUTO_TICK_ITEMS.map((i) => `${i.group}.${i.itemKey}`))

type ApplyAutoTickParams = {
  /** Existing accountData JSON (will not be mutated) */
  accountData: Record<string, any>
  /** Agreement upload present for this customer (Customer row or legacy) */
  hasAgreement: boolean
  /** Lead Google sheet URL present for this customer */
  hasLeadGoogleSheet: boolean
  /** Best-effort actor identity for meta (email/userId string) */
  actorUserId?: string | null
  /** Timestamp used for completedAt when transitioning false->true */
  nowIso?: string
  /** Active linked email identities (outlook/smtp). >=1 satisfies "Emails linked" onboarding rule. */
  linkedEmailCount?: number | null
  /** Customer.weeklyLeadTarget — numeric target captured */
  weeklyLeadTarget?: number | null
  /** EmailTemplate rows for this customer */
  templateCount?: number | null
  /** Earliest EmailEvent type=sent occurredAt (ISO) for this customer */
  firstOutreachSentAtIso?: string | null
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

function attachmentsList(accountData: Record<string, any>): any[] {
  const ad = getObject(accountData)
  const raw = (ad as any).attachments
  return Array.isArray(raw) ? raw : []
}

function hasAttachmentType(accountData: Record<string, any>, predicate: (t: string) => boolean): boolean {
  return attachmentsList(accountData).some((a) => a && typeof a === 'object' && predicate(String((a as any).type || '')))
}

function hasPaymentConfirmationAttachment(accountData: Record<string, any>): boolean {
  return hasAttachmentType(
    accountData,
    (t) => t === 'sales_first_payment' || t === 'payment_confirmation' || t === 'first_payment',
  )
}

function hasOnboardingPackAttachment(accountData: Record<string, any>): boolean {
  return hasAttachmentType(accountData, (t) => t === 'onboarding_pack' || t.startsWith('onboarding_pack:'))
}

function hasOnboardingPptAttachment(accountData: Record<string, any>): boolean {
  return hasAttachmentType(accountData, (t) => t === 'onboarding_meeting_ppt' || t === 'onboarding_meeting_pptx')
}

function hasOnboardingClientInfoAttachment(accountData: Record<string, any>): boolean {
  return hasAttachmentType(accountData, (t) => t === 'onboarding_client_info' || t.startsWith('onboarding_client_info:'))
}

function hasBriefCampaignsAttachment(accountData: Record<string, any>): boolean {
  return hasAttachmentType(accountData, (t) => t === 'brief_campaigns_creator' || t === 'ops_brief_campaigns')
}

function icpPopulatedFromProfile(profile: Record<string, any>): boolean {
  const areas = Array.isArray((profile as any).targetGeographicalAreas) ? (profile as any).targetGeographicalAreas : []
  const sectors = Array.isArray((profile as any).targetJobSectorIds) ? (profile as any).targetJobSectorIds : []
  const roles = Array.isArray((profile as any).targetJobRoleIds) ? (profile as any).targetJobRoleIds : []
  const legacyArea = (profile as any).targetGeographicalArea
  const hasGeo =
    areas.length > 0 ||
    Boolean(legacyArea && typeof legacyArea === 'object' && coerceTruthyString((legacyArea as any).label))
  const hasTargeting = sectors.length > 0 || roles.length > 0
  const objectives = coerceTruthyString((profile as any).keyBusinessObjectives)
  const qualifying = coerceTruthyString((profile as any).qualifyingQuestions)
  const usps = coerceTruthyString((profile as any).clientUSPs)
  return hasGeo && hasTargeting && Boolean(objectives || qualifying || usps)
}

function targetProspectSignal(profile: Record<string, any>): boolean {
  const areas = Array.isArray((profile as any).targetGeographicalAreas) ? (profile as any).targetGeographicalAreas : []
  const sectors = Array.isArray((profile as any).targetJobSectorIds) ? (profile as any).targetJobSectorIds : []
  const roles = Array.isArray((profile as any).targetJobRoleIds) ? (profile as any).targetJobRoleIds : []
  const legacyArea = (profile as any).targetGeographicalArea
  const hasGeo =
    areas.length > 0 ||
    Boolean(legacyArea && typeof legacyArea === 'object' && coerceTruthyString((legacyArea as any).label))
  return hasGeo || sectors.length > 0 || roles.length > 0
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
    linkedEmailCount = null,
    weeklyLeadTarget = null,
    templateCount = null,
    firstOutreachSentAtIso = null,
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
    const prevMeta = getObject(metaGroup[itemKey]) as ProgressItemMeta

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

  const details = getObject((base as any).accountDetails)
  const profile = getObject((base as any).clientProfile)

  const startDate =
    coerceTruthyString((details as any).startDateAgreed) ||
    coerceTruthyString((details as any).startDate) ||
    coerceTruthyString((details as any).startDateAgreedAt)

  const assignedManagerId =
    coerceTruthyString((details as any).assignedAccountManagerId) || coerceTruthyString((base as any).assignedAccountManagerId)

  const clientCreatedOnCrm =
    (details as any).clientCreatedOnCrm === true || !!coerceTruthyString((details as any).clientCreatedOnCrmAt)

  const hasDnc =
    !!coerceTruthyString(getObject((base as any).dncSuppression).attachmentId) ||
    !!coerceTruthyString(getObject((base as any).dncSuppression).fileName)

  if (startDate) markComplete('sales', 'sales_start_date')
  if (assignedManagerId) markComplete('sales', 'sales_assign_am')
  if (hasAgreement) {
    markComplete('sales', 'sales_client_agreement')
    markComplete('sales', 'sales_contract_signed')
  }
  if (hasPaymentConfirmationAttachment(base)) markComplete('sales', 'sales_first_payment')

  if (clientCreatedOnCrm) markComplete('ops', 'ops_added_crm')
  if (hasLeadGoogleSheet) markComplete('ops', 'ops_lead_tracker')

  if (typeof linkedEmailCount === 'number' && linkedEmailCount >= 1) {
    markComplete('ops', 'ops_emails_linked')
  }

  if (hasOnboardingPackAttachment(base)) markComplete('ops', 'ops_prepare_pack')
  if (hasOnboardingPptAttachment(base)) markComplete('ops', 'ops_populate_ppt')
  if (hasOnboardingClientInfoAttachment(base)) markComplete('ops', 'ops_receive_file')
  if (hasBriefCampaignsAttachment(base)) markComplete('ops', 'ops_brief_campaigns')

  if (hasDnc) markComplete('am', 'am_send_dnc')

  if (targetProspectSignal(profile)) markComplete('am', 'am_target_list')

  if (coerceTruthyString((profile as any).qualifyingQuestions)) markComplete('am', 'am_qualifying_questions')

  if (typeof weeklyLeadTarget === 'number' && weeklyLeadTarget > 0) markComplete('am', 'am_weekly_target')

  if (typeof templateCount === 'number' && templateCount >= 1) {
    markComplete('am', 'am_campaign_template')
    markComplete('am', 'am_templates_reviewed')
  }

  if (icpPopulatedFromProfile(profile)) markComplete('am', 'am_populate_icp')

  if (coerceTruthyString(firstOutreachSentAtIso)) {
    markComplete('am', 'am_client_live')
    // Merge outreach timestamp into existing item meta in-place (do not replace the whole `am` map).
    const amRoot = getObject((nextMeta as any).am) as Record<string, any>
    const curLive = getObject(amRoot.am_client_live) as ProgressItemMeta
    amRoot.am_client_live = {
      ...curLive,
      value: {
        ...(typeof curLive.value === 'object' && curLive.value ? curLive.value : {}),
        firstOutreachSentAt: firstOutreachSentAtIso,
      },
    }
  }

  if (applied.length === 0) {
    return { accountData: base, changed: false, applied }
  }

  const nextAccountData: Record<string, any> = {
    ...base,
    progressTracker: {
      ...nextProgress,
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
  valuePayload?: Record<string, unknown> | null
}): { accountData: Record<string, any> } {
  const {
    accountData,
    group,
    itemKey,
    checked,
    actorUserId = null,
    nowIso = new Date().toISOString(),
    valuePayload = null,
  } = params
  const base = getObject(accountData)
  const nextProgress = getProgressTracker(base)
  const nextMeta = getProgressTrackerMeta(base)

  const currentGroup = getObject((nextProgress as any)[group]) as Record<string, boolean>

  // Campaign launches: append acknowledgement entries; keep checkbox true if any ack exists
  if (group === 'am' && itemKey === 'am_campaigns_launched' && checked === true) {
    ;(nextProgress as any)[group] = { ...currentGroup, [itemKey]: true }
    const metaGroup = getObject((nextMeta as any)[group]) as Record<string, any>
    const prevMeta = getObject(metaGroup[itemKey]) as ProgressItemMeta
    const acks = Array.isArray(prevMeta.acknowledgements) ? [...prevMeta.acknowledgements] : []
    acks.push({ completedAt: nowIso, completedByUserId: actorUserId })
    const completedAt = prevMeta.completedAt || nowIso
    ;(nextMeta as any)[group] = {
      ...metaGroup,
      [itemKey]: {
        ...prevMeta,
        completedAt,
        completionSource: 'MANUAL',
        completedByUserId: actorUserId,
        acknowledgements: acks,
        ...(valuePayload && Object.keys(valuePayload).length > 0 ? { value: { ...(prevMeta.value || {}), ...valuePayload } } : {}),
      },
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

  ;(nextProgress as any)[group] = { ...currentGroup, [itemKey]: checked }

  if (checked === true) {
    const metaGroup = getObject((nextMeta as any)[group]) as Record<string, any>
    const prevMeta = getObject(metaGroup[itemKey]) as ProgressItemMeta
    const completedAt = prevMeta.completedAt || nowIso
    ;(nextMeta as any)[group] = {
      ...metaGroup,
      [itemKey]: {
        ...prevMeta,
        completedAt,
        completionSource: 'MANUAL',
        completedByUserId: actorUserId,
        ...(valuePayload && Object.keys(valuePayload).length > 0
          ? { value: { ...(typeof prevMeta.value === 'object' ? prevMeta.value : {}), ...valuePayload } }
          : {}),
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
