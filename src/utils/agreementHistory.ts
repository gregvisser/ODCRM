/**
 * Agreement term history + renewal reminder (persisted in accountData.agreementHistory).
 * Pure helpers — safe for client and duplicated on the server for upload/onboarding merge.
 */

export type AgreementTermKind = 'current_term' | 'superseded_term' | 'supplemental'

export type AgreementHistoryEntry = {
  id: string
  blobName: string
  containerName: string
  fileName: string
  mimeType?: string | null
  uploadedAt: string
  uploadedByEmail?: string | null
  startDate?: string | null
  endDate?: string | null
  termKind: AgreementTermKind
}

const YMD = /^\d{4}-\d{2}-\d{2}$/

export function normalizeYmd(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const t = value.trim()
  if (!t) return null
  if (YMD.test(t)) return t
  if (t.includes('T')) return t.slice(0, 10)
  return null
}

function coerceTermKind(raw: unknown): AgreementTermKind {
  if (raw === 'current_term' || raw === 'superseded_term' || raw === 'supplemental') return raw
  return 'supplemental'
}

export function parseHistoryArray(raw: unknown): AgreementHistoryEntry[] {
  if (!Array.isArray(raw)) return []
  const out: AgreementHistoryEntry[] = []
  for (const e of raw) {
    if (!e || typeof e !== 'object') continue
    const o = e as Record<string, unknown>
    const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : ''
    const blobName = typeof o.blobName === 'string' ? o.blobName.trim() : ''
    const containerName = typeof o.containerName === 'string' ? o.containerName.trim() : ''
    const fileName = typeof o.fileName === 'string' ? o.fileName.trim() : ''
    if (!id || !blobName || !containerName || !fileName) continue
    out.push({
      id,
      blobName,
      containerName,
      fileName,
      mimeType: typeof o.mimeType === 'string' ? o.mimeType : null,
      uploadedAt: typeof o.uploadedAt === 'string' ? o.uploadedAt : new Date().toISOString(),
      uploadedByEmail: typeof o.uploadedByEmail === 'string' ? o.uploadedByEmail : null,
      startDate: normalizeYmd(o.startDate),
      endDate: normalizeYmd(o.endDate),
      termKind: coerceTermKind(o.termKind),
    })
  }
  return out
}

export type AgreementCustomerBlob = {
  agreementBlobName?: string | null
  agreementContainerName?: string | null
  agreementFileName?: string | null
  agreementFileMimeType?: string | null
  agreementUploadedAt?: string | null
  agreementUploadedByEmail?: string | null
}

/**
 * Full history for display: persisted rows + legacy synthetic row when DB has a blob but no history yet.
 */
export function buildAgreementHistoryView(
  accountData: Record<string, unknown> | null | undefined,
  customer: AgreementCustomerBlob,
): AgreementHistoryEntry[] {
  const persisted = parseHistoryArray(accountData && typeof accountData === 'object' ? (accountData as any).agreementHistory : null)
  const hasBlob = Boolean(customer.agreementBlobName && customer.agreementContainerName)
  if (persisted.length > 0 || !hasBlob) return persisted

  const blobName = String(customer.agreementBlobName)
  const containerName = String(customer.agreementContainerName)
  const details =
    accountData && typeof accountData === 'object' && (accountData as any).accountDetails
      ? ((accountData as any).accountDetails as Record<string, unknown>)
      : {}
  const start = normalizeYmd(details.startDateAgreed)
  const end = normalizeYmd((details as any).agreementEndDate)
  const hasTerm = Boolean(start && end)
  return [
    {
      id: `legacy_${blobName}`,
      blobName,
      containerName,
      fileName: String(customer.agreementFileName || 'agreement'),
      mimeType: customer.agreementFileMimeType || null,
      uploadedAt:
        typeof customer.agreementUploadedAt === 'string'
          ? customer.agreementUploadedAt
          : new Date().toISOString(),
      uploadedByEmail: customer.agreementUploadedByEmail || null,
      startDate: start,
      endDate: end,
      termKind: hasTerm ? 'current_term' : 'supplemental',
    },
  ]
}

export function getCurrentTermEntry(entries: AgreementHistoryEntry[]): AgreementHistoryEntry | null {
  const cur = entries.filter((e) => e.termKind === 'current_term')
  if (cur.length === 0) return null
  cur.sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)))
  return cur[0] ?? null
}

/** Calendar-day difference: endDate minus local today (date-only, no time-of-day). */
export function calendarDaysUntilEnd(endYmd: string, now = new Date()): number | null {
  if (!YMD.test(endYmd)) return null
  const [ey, em, ed] = endYmd.split('-').map((n) => Number(n))
  const [ty, tm, td] = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
  const endUtc = Date.UTC(ey, em - 1, ed)
  const todayUtc = Date.UTC(ty, tm - 1, td)
  return Math.round((endUtc - todayUtc) / 86400000)
}

export type AgreementRenewalReminder = {
  /** Days until end date (negative = overdue). */
  daysLeft: number
  endDate: string
  startDate: string | null
}

/**
 * Show renewal urgency when the current term has a valid end date and we are within 30 days before end,
 * or overdue, until a newer current_term supersedes (handled by entry list).
 */
export function computeAgreementRenewalReminder(
  accountData: Record<string, unknown> | null | undefined,
  customer: AgreementCustomerBlob,
  now = new Date(),
): AgreementRenewalReminder | null {
  const entries = buildAgreementHistoryView(accountData, customer)
  const term = getCurrentTermEntry(entries)
  if (!term) return null
  const end = normalizeYmd(term.endDate)
  if (!end) return null
  const daysLeft = calendarDaysUntilEnd(end, now)
  if (daysLeft === null) return null
  if (daysLeft > 30) return null
  return {
    daysLeft,
    endDate: end,
    startDate: normalizeYmd(term.startDate),
  }
}

/**
 * Patch agreementHistory[].current_term dates from accountDetails; or create a current_term row
 * from the latest Customer blob when both dates exist but no current_term row exists yet.
 * Idempotent across saves.
 */
export function syncAgreementTermDatesIntoAccountData(
  accountData: Record<string, any>,
  accountDetails: { startDateAgreed?: string; agreementEndDate?: string },
  customer: AgreementCustomerBlob,
): Record<string, any> {
  const ad = accountData && typeof accountData === 'object' ? { ...accountData } : {}
  const start = normalizeYmd(accountDetails.startDateAgreed)
  const end = normalizeYmd(accountDetails.agreementEndDate)
  const history = parseHistoryArray(ad.agreementHistory).map((h) => ({ ...h }))

  const idx = history.findIndex((h) => h.termKind === 'current_term')
  if (idx >= 0) {
    history[idx] = {
      ...history[idx],
      startDate: start,
      endDate: end,
    }
    ad.agreementHistory = history
    return ad
  }

  const hasBlob = Boolean(customer.agreementBlobName && customer.agreementContainerName)
  if (!(start && end && hasBlob)) {
    return ad
  }

  const blobName = String(customer.agreementBlobName)
  const containerName = String(customer.agreementContainerName)
  const matchIdx = history.findIndex((h) => h.blobName === blobName && h.containerName === containerName)

  if (matchIdx >= 0) {
    for (let j = 0; j < history.length; j++) {
      if (j !== matchIdx && history[j].termKind === 'current_term') {
        history[j] = { ...history[j], termKind: 'superseded_term' }
      }
    }
    history[matchIdx] = {
      ...history[matchIdx],
      startDate: start,
      endDate: end,
      termKind: 'current_term',
    }
  } else {
    history.push({
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `term_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      blobName,
      containerName,
      fileName: String(customer.agreementFileName || 'agreement'),
      mimeType: customer.agreementFileMimeType || null,
      uploadedAt:
        typeof customer.agreementUploadedAt === 'string'
          ? customer.agreementUploadedAt
          : new Date().toISOString(),
      uploadedByEmail: customer.agreementUploadedByEmail || null,
      startDate: start,
      endDate: end,
      termKind: 'current_term',
    })
  }

  ad.agreementHistory = history
  return ad
}

/**
 * Hydrate accountDetails agreement end date from persisted current term when the field is empty.
 */
export function mergeAccountDetailsFromCurrentTerm(
  details: { startDateAgreed?: string; agreementEndDate?: string },
  accountData: Record<string, unknown> | null | undefined,
  customer: AgreementCustomerBlob,
): { startDateAgreed?: string; agreementEndDate?: string } {
  const term = getCurrentTermEntry(buildAgreementHistoryView(accountData, customer))
  if (!term) return details
  const next = { ...details }
  if (!String(next.startDateAgreed || '').trim() && term.startDate) {
    next.startDateAgreed = term.startDate ?? ''
  }
  if (!String((next as any).agreementEndDate || '').trim() && term.endDate) {
    ;(next as any).agreementEndDate = term.endDate ?? ''
  }
  return next
}
