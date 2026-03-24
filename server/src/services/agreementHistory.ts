/**
 * Agreement history merge (accountData JSON) — server-side companion to src/utils/agreementHistory.ts
 */

import { randomUUID } from 'node:crypto'

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

function normalizeYmd(value: unknown): string | null {
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

function parseHistoryArray(raw: unknown): AgreementHistoryEntry[] {
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

/**
 * When the primary Customer agreement blob is replaced, retain the prior blob as a supplemental
 * history row (if not already recorded).
 */
export function preservePriorAgreementBlobIfReplaced(
  accountData: Record<string, any>,
  existing: {
    agreementBlobName: string | null
    agreementContainerName: string | null
    agreementFileName: string | null
    agreementFileMimeType: string | null
    agreementUploadedAt: Date | string | null
    agreementUploadedByEmail: string | null
  },
  nextBlobName: string,
): Record<string, any> {
  if (!existing.agreementBlobName || !existing.agreementContainerName) return accountData
  if (existing.agreementBlobName === nextBlobName) return accountData

  const ad = accountData && typeof accountData === 'object' ? { ...accountData } : {}
  const history = parseHistoryArray(ad.agreementHistory)
  if (history.some((h) => h.blobName === existing.agreementBlobName)) {
    ad.agreementHistory = history
    return ad
  }

  const uploadedAt =
    existing.agreementUploadedAt instanceof Date
      ? existing.agreementUploadedAt.toISOString()
      : typeof existing.agreementUploadedAt === 'string'
        ? existing.agreementUploadedAt
        : new Date().toISOString()

  history.push({
    id: randomUUID(),
    blobName: existing.agreementBlobName,
    containerName: existing.agreementContainerName,
    fileName: String(existing.agreementFileName || 'agreement'),
    mimeType: existing.agreementFileMimeType,
    uploadedAt,
    uploadedByEmail: existing.agreementUploadedByEmail,
    startDate: null,
    endDate: null,
    termKind: 'supplemental',
  })
  ad.agreementHistory = history
  return ad
}

export function mergeAgreementHistoryOnMainUpload(params: {
  accountData: Record<string, any>
  newEntry: {
    blobName: string
    containerName: string
    fileName: string
    mimeType: string | null
    uploadedAt: Date
    uploadedByEmail: string | null
    startDate?: string | null
    endDate?: string | null
  }
}): Record<string, any> {
  const ad =
    params.accountData && typeof params.accountData === 'object' && !Array.isArray(params.accountData)
      ? { ...params.accountData }
      : {}

  const history = parseHistoryArray(ad.agreementHistory).map((h) => ({ ...h }))

  const startDate = normalizeYmd(params.newEntry.startDate)
  const endDate = normalizeYmd(params.newEntry.endDate)
  const hasFullTerm = Boolean(startDate && endDate)

  const entry: AgreementHistoryEntry = {
    id: randomUUID(),
    blobName: params.newEntry.blobName,
    containerName: params.newEntry.containerName,
    fileName: params.newEntry.fileName,
    mimeType: params.newEntry.mimeType,
    uploadedAt: params.newEntry.uploadedAt.toISOString(),
    uploadedByEmail: params.newEntry.uploadedByEmail,
    startDate,
    endDate,
    termKind: hasFullTerm ? 'current_term' : 'supplemental',
  }

  if (hasFullTerm) {
    for (const h of history) {
      if (h.termKind === 'current_term') {
        h.termKind = 'superseded_term'
      }
    }
  }

  history.push(entry)
  ad.agreementHistory = history
  return ad
}

type CustomerAgreementBlob = {
  agreementBlobName?: string | null
  agreementContainerName?: string | null
  agreementFileName?: string | null
  agreementFileMimeType?: string | null
  agreementUploadedAt?: string | null
  agreementUploadedByEmail?: string | null
}

/** Same semantics as client syncAgreementTermDatesIntoAccountData (onboarding save). */
export function syncAgreementTermDatesIntoAccountData(
  accountData: Record<string, any>,
  accountDetails: { startDateAgreed?: string; agreementEndDate?: string },
  customer: CustomerAgreementBlob,
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
      id: randomUUID(),
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

export function resolveAgreementBlobForDownload(params: {
  customer: CustomerAgreementBlob & { agreementFileUrl?: string | null }
  accountData: unknown
  requestedBlobName?: string | null
}): { containerName: string; blobName: string; fileName: string; mimeType: string } | null {
  const { customer, accountData, requestedBlobName } = params
  const want = typeof requestedBlobName === 'string' ? requestedBlobName.trim() : ''

  const primaryBlob = customer.agreementBlobName && customer.agreementContainerName
    ? {
        containerName: String(customer.agreementContainerName),
        blobName: String(customer.agreementBlobName),
        fileName: String(customer.agreementFileName || 'agreement'),
        mimeType: String(customer.agreementFileMimeType || 'application/pdf'),
      }
    : null

  if (!want) {
    return primaryBlob
  }

  if (primaryBlob && primaryBlob.blobName === want) {
    return primaryBlob
  }

  const ad = accountData && typeof accountData === 'object' ? (accountData as any) : {}
  const history = parseHistoryArray(ad.agreementHistory)
  const hit = history.find((h) => h.blobName === want)
  if (hit) {
    return {
      containerName: hit.containerName,
      blobName: hit.blobName,
      fileName: hit.fileName || 'agreement',
      mimeType: String(hit.mimeType || 'application/pdf'),
    }
  }

  return null
}
