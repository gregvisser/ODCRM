import { z } from 'zod'
import { deepMergePreserve } from '../lib/merge.js'

// -----------------------------------------------------------------------------
// Allowed fields (single source of truth for backend validation)
// -----------------------------------------------------------------------------

export const ACCOUNT_EDITABLE_SCALAR_FIELDS = [
  'name',
  'domain',
  'website',
  'sector',
  'clientStatus',
  'leadsReportingUrl',
  'leadsGoogleSheetLabel',
  'targetJobTitle',
  'prospectingLocation',
  'weeklyLeadTarget',
  'monthlyLeadTarget',
  'defcon',
  'monthlyIntakeGBP',
] as const

export type AccountEditableScalarField = (typeof ACCOUNT_EDITABLE_SCALAR_FIELDS)[number]

export const ACCOUNT_EDITABLE_ACCOUNTDATA_PATHS = [
  'accountDetails.assignedAccountManagerId',
  'accountDetails.assignedClientDdiNumber',
  'accountDetails.daysPerWeek',
  'accountDetails.emailAccounts',
  // Keep the AccountsTab snapshot in sync for a few fields the UI reads directly from accountData.
  'monthlySpendGBP',
  // Account Card drawer (Client Profile + targeting)
  'clientProfile.clientHistory',
  'clientProfile.keyBusinessObjectives',
  'clientProfile.clientUSPs',
  'clientProfile.qualifyingQuestions',
  'clientProfile.caseStudiesOrTestimonials',
  'clientProfile.caseStudiesFileName',
  'clientProfile.caseStudiesFileUrl',
  'clientProfile.socialMediaPresence.linkedinUrl',
  'clientProfile.socialMediaPresence.facebookUrl',
  'clientProfile.socialMediaPresence.xUrl',
  'clientProfile.socialMediaPresence.instagramUrl',
  'clientProfile.socialMediaPresence.tiktokUrl',
  'clientProfile.socialMediaPresence.youtubeUrl',
  'clientProfile.socialMediaPresence.websiteUrl',
  'clientProfile.targetJobSectorIds',
  'clientProfile.targetJobRoleIds',
  'targetGeographicalAreas',
] as const

export type AccountEditableAccountDataPath = (typeof ACCOUNT_EDITABLE_ACCOUNTDATA_PATHS)[number]

// -----------------------------------------------------------------------------
// Input validation
// -----------------------------------------------------------------------------

const accountDetailsPatchSchema = z
  .object({
    assignedAccountManagerId: z.string().min(1).optional().nullable(),
    assignedClientDdiNumber: z.string().min(1).optional().nullable(),
    daysPerWeek: z.number().int().min(0).max(7).optional().nullable(),
    emailAccounts: z.array(z.string()).optional().nullable(),
  })
  .partial()

const targetGeographicalAreaSchema = z
  .object({
    label: z.string().min(1),
    placeId: z.string().optional().nullable(),
  })
  .passthrough()

const socialMediaPresencePatchSchema = z
  .object({
    linkedinUrl: z.string().optional().nullable(),
    facebookUrl: z.string().optional().nullable(),
    xUrl: z.string().optional().nullable(),
    instagramUrl: z.string().optional().nullable(),
    tiktokUrl: z.string().optional().nullable(),
    youtubeUrl: z.string().optional().nullable(),
    websiteUrl: z.string().optional().nullable(),
  })
  .partial()

const clientProfilePatchSchema = z
  .object({
    clientHistory: z.string().optional().nullable(),
    keyBusinessObjectives: z.string().optional().nullable(),
    clientUSPs: z.string().optional().nullable(),
    qualifyingQuestions: z.string().optional().nullable(),
    caseStudiesOrTestimonials: z.string().optional().nullable(),
    caseStudiesFileName: z.string().optional().nullable(),
    caseStudiesFileUrl: z.string().optional().nullable(),
    socialMediaPresence: socialMediaPresencePatchSchema.optional(),
    targetJobSectorIds: z.array(z.string()).optional().nullable(),
    targetJobRoleIds: z.array(z.string()).optional().nullable(),
  })
  .partial()

export const patchCustomerAccountSchema = z
  .object({
    name: z.string().min(1).optional(),
    domain: z.string().optional().nullable(),
    website: z.string().optional().nullable(),
    sector: z.string().optional().nullable(),
    clientStatus: z.enum(['active', 'inactive', 'onboarding', 'win_back']).optional(),
    leadsReportingUrl: z.string().url().optional().nullable(),
    leadsGoogleSheetLabel: z.string().optional().nullable(),
    targetJobTitle: z.string().optional().nullable(),
    prospectingLocation: z.string().optional().nullable(),
    weeklyLeadTarget: z.number().int().min(0).optional().nullable(),
    monthlyLeadTarget: z.number().int().min(0).optional().nullable(),
    defcon: z.number().int().min(1).max(6).optional().nullable(),
    monthlyIntakeGBP: z.number().min(0).optional().nullable(),
    accountData: z
      .object({
        accountDetails: accountDetailsPatchSchema.optional(),
        monthlySpendGBP: z.number().min(0).optional().nullable(),
        clientProfile: clientProfilePatchSchema.optional(),
        targetGeographicalAreas: z.array(targetGeographicalAreaSchema).optional().nullable(),
      })
      .partial()
      .optional(),
  })
  .strict()

export type PatchCustomerAccountBody = z.infer<typeof patchCustomerAccountSchema>

export type CustomerAccountChange = {
  field: string
  oldValue: unknown
  newValue: unknown
}

function normalizeString(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s ? s : null
}

function normalizeStringKeepEmpty(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v)
}

function normalizeStringTrimKeepEmpty(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

function getAccountDataObject(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as any
}

function getDeep(obj: any, path: string): any {
  const parts = path.split('.')
  let cur = obj
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return undefined
    cur = cur[p]
  }
  return cur
}

function setDeep(base: any, path: string, value: any): any {
  const parts = path.split('.')
  const out = { ...(base && typeof base === 'object' ? base : {}) }
  let cur: any = out
  for (let i = 0; i < parts.length; i++) {
    const key = parts[i]
    if (i === parts.length - 1) {
      cur[key] = value
    } else {
      const next = cur[key]
      cur[key] = next && typeof next === 'object' && !Array.isArray(next) ? { ...next } : {}
      cur = cur[key]
    }
  }
  return out
}

export function computeCustomerAccountPatch(params: {
  existingCustomer: {
    id: string
    name: string
    domain: string | null
    website: string | null
    sector: string | null
    clientStatus: any
    leadsReportingUrl: string | null
    leadsGoogleSheetLabel: string | null
    targetJobTitle: string | null
    prospectingLocation: string | null
    weeklyLeadTarget: number | null
    monthlyLeadTarget: number | null
    defcon: number | null
    monthlyIntakeGBP: any
    accountData: any
  }
  patch: PatchCustomerAccountBody
}): {
  changes: CustomerAccountChange[]
  updateScalars: Record<string, any>
  nextAccountData: any
} {
  const { existingCustomer, patch } = params
  const changes: CustomerAccountChange[] = []
  const updateScalars: Record<string, any> = {}

  // Scalar updates (Customer columns)
  const scalarEntries: Array<[AccountEditableScalarField, any, any]> = [
    ['name', existingCustomer.name, patch.name],
    ['domain', existingCustomer.domain, patch.domain],
    ['website', existingCustomer.website, patch.website],
    ['sector', existingCustomer.sector, patch.sector],
    ['clientStatus', existingCustomer.clientStatus, patch.clientStatus],
    ['leadsReportingUrl', existingCustomer.leadsReportingUrl, patch.leadsReportingUrl],
    ['leadsGoogleSheetLabel', existingCustomer.leadsGoogleSheetLabel, patch.leadsGoogleSheetLabel],
    ['targetJobTitle', existingCustomer.targetJobTitle, patch.targetJobTitle],
    ['prospectingLocation', existingCustomer.prospectingLocation, patch.prospectingLocation],
    ['weeklyLeadTarget', existingCustomer.weeklyLeadTarget, patch.weeklyLeadTarget],
    ['monthlyLeadTarget', existingCustomer.monthlyLeadTarget, patch.monthlyLeadTarget],
    ['defcon', existingCustomer.defcon, patch.defcon],
    ['monthlyIntakeGBP', existingCustomer.monthlyIntakeGBP, patch.monthlyIntakeGBP],
  ]

  for (const [field, existing, incomingRaw] of scalarEntries) {
    if (incomingRaw === undefined) continue

    // Normalize string-ish scalars for stable diff + storage
    const incoming =
      field === 'name'
        ? String(incomingRaw).trim()
        : field === 'domain' || field === 'website' || field === 'sector' || field === 'leadsGoogleSheetLabel' || field === 'targetJobTitle' || field === 'prospectingLocation'
          ? normalizeString(incomingRaw)
          : incomingRaw

    const oldValue =
      field === 'domain' || field === 'website' || field === 'sector' || field === 'leadsGoogleSheetLabel' || field === 'targetJobTitle' || field === 'prospectingLocation'
        ? normalizeString(existing)
        : existing

    const changed =
      field === 'name'
        ? String(oldValue || '').trim() !== String(incoming || '').trim()
        : JSON.stringify(oldValue) !== JSON.stringify(incoming)

    if (!changed) continue

    updateScalars[field] = incoming
    changes.push({ field, oldValue, newValue: incoming })
  }

  // accountData patch (deep merge, non-destructive)
  const existingAccountData = getAccountDataObject(existingCustomer.accountData)
  let incomingAccountData: any = {}

  // accountDetails.* (whitelisted)
  const adPatch = patch.accountData?.accountDetails
  if (adPatch && typeof adPatch === 'object') {
    if (adPatch.assignedAccountManagerId !== undefined) {
      const old = getDeep(existingAccountData, 'accountDetails.assignedAccountManagerId')
      const next = normalizeString(adPatch.assignedAccountManagerId)
      if (normalizeString(old) !== next) {
        changes.push({
          field: 'accountData.accountDetails.assignedAccountManagerId',
          oldValue: normalizeString(old),
          newValue: next,
        })
      }
      incomingAccountData = setDeep(incomingAccountData, 'accountDetails.assignedAccountManagerId', next)
    }
    if (adPatch.assignedClientDdiNumber !== undefined) {
      const old = getDeep(existingAccountData, 'accountDetails.assignedClientDdiNumber')
      const next = normalizeString(adPatch.assignedClientDdiNumber)
      if (normalizeString(old) !== next) {
        changes.push({
          field: 'accountData.accountDetails.assignedClientDdiNumber',
          oldValue: normalizeString(old),
          newValue: next,
        })
      }
      incomingAccountData = setDeep(incomingAccountData, 'accountDetails.assignedClientDdiNumber', next)
    }
    if (adPatch.daysPerWeek !== undefined) {
      const old = getDeep(existingAccountData, 'accountDetails.daysPerWeek')
      const next = adPatch.daysPerWeek === null ? null : Number(adPatch.daysPerWeek)
      if (Number(old ?? NaN) !== Number(next ?? NaN)) {
        changes.push({
          field: 'accountData.accountDetails.daysPerWeek',
          oldValue: old ?? null,
          newValue: next,
        })
      }
      incomingAccountData = setDeep(incomingAccountData, 'accountDetails.daysPerWeek', next)
    }
    if (adPatch.emailAccounts !== undefined) {
      const old = getDeep(existingAccountData, 'accountDetails.emailAccounts')
      const next = Array.isArray(adPatch.emailAccounts)
        ? adPatch.emailAccounts.map((v) => String(v || '').trim()).filter(Boolean)
        : null
      if (JSON.stringify(old ?? null) !== JSON.stringify(next ?? null)) {
        changes.push({
          field: 'accountData.accountDetails.emailAccounts',
          oldValue: Array.isArray(old) ? old : null,
          newValue: next,
        })
      }
      incomingAccountData = setDeep(incomingAccountData, 'accountDetails.emailAccounts', next)
    }
  }

  // Keep an explicit monthlySpendGBP snapshot in accountData for AccountsTab rendering.
  // Prefer patch.accountData.monthlySpendGBP when provided; otherwise, if monthlyIntakeGBP scalar changed,
  // mirror it into accountData.monthlySpendGBP so UI stays coherent.
  const incomingMonthlySpend =
    patch.accountData?.monthlySpendGBP !== undefined ? patch.accountData.monthlySpendGBP : undefined
  const mirroredFromMonthlyIntake =
    patch.monthlyIntakeGBP !== undefined ? patch.monthlyIntakeGBP : undefined

  const nextMonthlySpend =
    incomingMonthlySpend !== undefined
      ? incomingMonthlySpend === null
        ? null
        : Number(incomingMonthlySpend)
      : mirroredFromMonthlyIntake !== undefined
        ? mirroredFromMonthlyIntake === null
          ? null
          : Number(mirroredFromMonthlyIntake)
        : undefined

  if (nextMonthlySpend !== undefined) {
    const old = getDeep(existingAccountData, 'monthlySpendGBP')
    if (Number(old ?? NaN) !== Number(nextMonthlySpend ?? NaN)) {
      changes.push({
        field: 'accountData.monthlySpendGBP',
        oldValue: old ?? null,
        newValue: nextMonthlySpend,
      })
    }
    incomingAccountData = setDeep(incomingAccountData, 'monthlySpendGBP', nextMonthlySpend)
  }

  // ---------------------------------------------------------------------------
  // Client Profile + targeting (accountData.clientProfile + accountData.targetGeographicalAreas)
  // ---------------------------------------------------------------------------
  const cpPatch = patch.accountData?.clientProfile
  if (cpPatch && typeof cpPatch === 'object') {
    const stringFields: Array<{ key: string; path: string }> = [
      { key: 'clientHistory', path: 'clientProfile.clientHistory' },
      { key: 'keyBusinessObjectives', path: 'clientProfile.keyBusinessObjectives' },
      { key: 'clientUSPs', path: 'clientProfile.clientUSPs' },
      { key: 'qualifyingQuestions', path: 'clientProfile.qualifyingQuestions' },
      { key: 'caseStudiesOrTestimonials', path: 'clientProfile.caseStudiesOrTestimonials' },
      { key: 'caseStudiesFileName', path: 'clientProfile.caseStudiesFileName' },
      { key: 'caseStudiesFileUrl', path: 'clientProfile.caseStudiesFileUrl' },
    ]

    for (const f of stringFields) {
      if ((cpPatch as any)[f.key] === undefined) continue
      const old = getDeep(existingAccountData, f.path)
      const next = normalizeStringKeepEmpty((cpPatch as any)[f.key])
      if (String(old ?? '') !== String(next ?? '')) {
        changes.push({
          field: `accountData.${f.path}`,
          oldValue: old ?? '',
          newValue: next,
        })
      }
      incomingAccountData = setDeep(incomingAccountData, f.path, next)
    }

    if ((cpPatch as any).targetJobSectorIds !== undefined) {
      const old = getDeep(existingAccountData, 'clientProfile.targetJobSectorIds')
      const next = Array.isArray((cpPatch as any).targetJobSectorIds)
        ? (cpPatch as any).targetJobSectorIds.map((v: any) => String(v || '').trim()).filter(Boolean)
        : []
      if (JSON.stringify(old ?? []) !== JSON.stringify(next)) {
        changes.push({
          field: 'accountData.clientProfile.targetJobSectorIds',
          oldValue: Array.isArray(old) ? old : [],
          newValue: next,
        })
      }
      incomingAccountData = setDeep(incomingAccountData, 'clientProfile.targetJobSectorIds', next)
    }

    if ((cpPatch as any).targetJobRoleIds !== undefined) {
      const old = getDeep(existingAccountData, 'clientProfile.targetJobRoleIds')
      const next = Array.isArray((cpPatch as any).targetJobRoleIds)
        ? (cpPatch as any).targetJobRoleIds.map((v: any) => String(v || '').trim()).filter(Boolean)
        : []
      if (JSON.stringify(old ?? []) !== JSON.stringify(next)) {
        changes.push({
          field: 'accountData.clientProfile.targetJobRoleIds',
          oldValue: Array.isArray(old) ? old : [],
          newValue: next,
        })
      }
      incomingAccountData = setDeep(incomingAccountData, 'clientProfile.targetJobRoleIds', next)
    }

    const smPatch = (cpPatch as any).socialMediaPresence
    if (smPatch && typeof smPatch === 'object') {
      const smKeys = ['linkedinUrl', 'facebookUrl', 'xUrl', 'instagramUrl', 'tiktokUrl', 'youtubeUrl', 'websiteUrl'] as const
      for (const k of smKeys) {
        if ((smPatch as any)[k] === undefined) continue
        const path = `clientProfile.socialMediaPresence.${k}`
        const old = getDeep(existingAccountData, path)
        const next = normalizeStringTrimKeepEmpty((smPatch as any)[k])
        if (String(old ?? '') !== String(next ?? '')) {
          changes.push({
            field: `accountData.${path}`,
            oldValue: old ?? '',
            newValue: next,
          })
        }
        incomingAccountData = setDeep(incomingAccountData, path, next)
      }
    }
  }

  if (patch.accountData?.targetGeographicalAreas !== undefined) {
    const old = getDeep(existingAccountData, 'targetGeographicalAreas')
    const nextRaw = patch.accountData?.targetGeographicalAreas
    const next = Array.isArray(nextRaw)
      ? nextRaw
          .map((a: any) => ({
            label: String(a?.label || '').trim(),
            ...(a?.placeId ? { placeId: String(a.placeId).trim() } : {}),
          }))
          .filter((a: any) => a.label)
      : []
    if (JSON.stringify(old ?? []) !== JSON.stringify(next)) {
      changes.push({
        field: 'accountData.targetGeographicalAreas',
        oldValue: Array.isArray(old) ? old : [],
        newValue: next,
      })
    }
    incomingAccountData = setDeep(incomingAccountData, 'targetGeographicalAreas', next)
  }

  // Allow explicit null overwrites only for these paths (clearing a value is intentional in UI).
  const allowNullOverwritePaths = new Set<string>([
    'accountDetails.assignedAccountManagerId',
    'accountDetails.assignedClientDdiNumber',
    'accountDetails.daysPerWeek',
    'accountDetails.emailAccounts',
    'monthlySpendGBP',
  ])
  const nextAccountData =
    Object.keys(incomingAccountData || {}).length > 0
      ? deepMergePreserve(existingAccountData, incomingAccountData, { allowNullOverwritePaths })
      : existingAccountData

  return { changes, updateScalars, nextAccountData }
}

export function formatCustomerAccountAuditNote(params: {
  customerId: string
  actorDisplay: string
  changes: CustomerAccountChange[]
}): string {
  const { customerId, actorDisplay, changes } = params
  const lines = changes.map((c) => {
    const oldS = c.oldValue === null || c.oldValue === undefined ? '∅' : JSON.stringify(c.oldValue)
    const newS = c.newValue === null || c.newValue === undefined ? '∅' : JSON.stringify(c.newValue)
    return `- ${c.field}: ${oldS} → ${newS}`
  })
  return [`[Audit] ${actorDisplay} updated customer ${customerId}:`, ...lines].join('\n')
}

