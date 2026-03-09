import type { LeadRecord, PrismaClient } from '@prisma/client'
import {
  appendCanonicalLeadRow,
  updateCanonicalLeadRow,
  type AppendSheetRowResult,
  type UpdateSheetRowResult,
} from './googleSheetsService.js'

export type LeadSyncStatus = 'pending_outbound' | 'synced' | 'sync_error'
type PendingOperation = 'create' | 'update' | null

export type OutboundSyncResult = {
  status: LeadSyncStatus
  note: string
  error: string | null
  rowReference: string | null
  rowNumber: number | null
  operation: 'create' | 'update'
  lead: {
    id: string
    customerId: string
    occurredAt: string | null
    source: string | null
    owner: string | null
    fullName: string | null
    email: string | null
    phone: string | null
    company: string | null
    jobTitle: string | null
    location: string | null
    status: string | null
    notes: string | null
    syncStatus: string | null
    createdAt: string
  }
}

const leadSelect = {
  id: true,
  customerId: true,
  sourceUrl: true,
  sheetGid: true,
  externalId: true,
  externalRowFingerprint: true,
  occurredAt: true,
  source: true,
  owner: true,
  firstName: true,
  lastName: true,
  fullName: true,
  email: true,
  phone: true,
  company: true,
  jobTitle: true,
  location: true,
  status: true,
  notes: true,
  syncStatus: true,
  syncError: true,
  lastOutboundSyncAt: true,
  normalizedData: true,
  createdAt: true,
} as const

type LeadForSync = Pick<
  LeadRecord,
  | 'id'
  | 'customerId'
  | 'sourceUrl'
  | 'sheetGid'
  | 'externalId'
  | 'externalRowFingerprint'
  | 'occurredAt'
  | 'source'
  | 'owner'
  | 'firstName'
  | 'lastName'
  | 'fullName'
  | 'email'
  | 'phone'
  | 'company'
  | 'jobTitle'
  | 'location'
  | 'status'
  | 'notes'
  | 'syncStatus'
  | 'syncError'
  | 'lastOutboundSyncAt'
  | 'normalizedData'
  | 'createdAt'
>

function clean(value: unknown): string {
  if (value == null) return ''
  return String(value).trim()
}

function toDateCell(value: Date | null): string {
  if (!value) return ''
  const year = value.getUTCFullYear()
  const month = String(value.getUTCMonth() + 1).padStart(2, '0')
  const day = String(value.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function buildOutboundCanonicalRow(lead: LeadForSync): Record<string, string> {
  return {
    occurredAt: toDateCell(lead.occurredAt),
    fullName: clean(lead.fullName || [lead.firstName, lead.lastName].filter(Boolean).join(' ') || ''),
    firstName: clean(lead.firstName),
    lastName: clean(lead.lastName),
    email: clean(lead.email),
    phone: clean(lead.phone),
    company: clean(lead.company),
    jobTitle: clean(lead.jobTitle),
    location: clean(lead.location),
    source: clean(lead.source),
    owner: clean(lead.owner),
    status: clean(lead.status),
    notes: clean(lead.notes),
    externalId: clean(lead.externalId),
  }
}

function buildRowReference(input: { sheetId: string; gid: string | null; rowNumber: number | null }): string {
  const row = input.rowNumber != null ? String(input.rowNumber) : 'unknown'
  const gid = input.gid || 'unknown'
  return `gsheet:${input.sheetId}:${gid}:${row}`
}

export function parseRowReference(rowReference: string | null | undefined): { sheetId: string; gid: string; rowNumber: number } | null {
  const text = clean(rowReference)
  if (!text) return null
  const m = text.match(/^gsheet:([^:]+):([^:]+):(\d+)$/)
  if (!m) return null
  const rowNumber = Number.parseInt(m[3], 10)
  if (!Number.isFinite(rowNumber) || rowNumber < 2) return null
  return { sheetId: m[1], gid: m[2], rowNumber }
}

function getSyncStateObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {}
  const base = value as Record<string, unknown>
  const sync = base.sync
  if (!sync || typeof sync !== 'object') return {}
  return sync as Record<string, unknown>
}

function getPendingOperationFromLead(lead: LeadForSync): PendingOperation {
  const sync = getSyncStateObject(lead.normalizedData)
  const pendingOperation = clean(sync.pendingOperation)
  if (pendingOperation === 'update') return 'update'
  if (pendingOperation === 'create') return 'create'
  return null
}

function buildNormalizedDataWithSync(lead: LeadForSync, syncPatch: Record<string, unknown>): Record<string, unknown> {
  const normalized =
    typeof lead.normalizedData === 'object' && lead.normalizedData != null
      ? (lead.normalizedData as Record<string, unknown>)
      : {}
  const currentSync = getSyncStateObject(normalized)
  return {
    ...normalized,
    sync: {
      ...currentSync,
      ...syncPatch,
    },
  }
}

function mapLeadResponse(
  lead: Pick<
    LeadForSync,
    | 'id'
    | 'customerId'
    | 'occurredAt'
    | 'source'
    | 'owner'
    | 'fullName'
    | 'email'
    | 'phone'
    | 'company'
    | 'jobTitle'
    | 'location'
    | 'status'
    | 'notes'
    | 'syncStatus'
    | 'createdAt'
  >
) {
  return {
    id: lead.id,
    customerId: lead.customerId,
    occurredAt: lead.occurredAt ? lead.occurredAt.toISOString() : null,
    source: lead.source,
    owner: lead.owner,
    fullName: lead.fullName,
    email: lead.email,
    phone: lead.phone,
    company: lead.company,
    jobTitle: lead.jobTitle,
    location: lead.location,
    status: lead.status,
    notes: lead.notes,
    syncStatus: lead.syncStatus,
    createdAt: lead.createdAt.toISOString(),
  }
}

async function loadLeadForSync(prisma: PrismaClient, customerId: string, leadId: string): Promise<LeadForSync | null> {
  return prisma.leadRecord.findFirst({
    where: { id: leadId, customerId },
    select: leadSelect,
  }) as Promise<LeadForSync | null>
}

async function updateLeadSyncState(params: {
  prisma: PrismaClient
  customerId: string
  now: Date
  success: boolean
  error?: string | null
}) {
  if (params.success) {
    await params.prisma.leadSyncState.upsert({
      where: { customerId: params.customerId },
      create: {
        customerId: params.customerId,
        lastSyncAt: params.now,
        lastSuccessAt: params.now,
        lastOutboundSyncAt: params.now,
        lastError: null,
        syncStatus: 'success',
      },
      update: {
        lastSyncAt: params.now,
        lastSuccessAt: params.now,
        lastOutboundSyncAt: params.now,
        lastError: null,
        syncStatus: 'success',
      },
    })
    return
  }

  await params.prisma.leadSyncState.upsert({
    where: { customerId: params.customerId },
    create: {
      customerId: params.customerId,
      lastSyncAt: params.now,
      lastError: params.error || 'Outbound lead sync failed',
      syncStatus: 'error',
    },
    update: {
      lastSyncAt: params.now,
      lastError: params.error || 'Outbound lead sync failed',
      syncStatus: 'error',
    },
  })
}

export async function runOutboundAppend(params: {
  lead: LeadForSync
  appendFn?: (input: { sheetUrl: string; canonicalRow: Record<string, unknown> }) => Promise<AppendSheetRowResult>
  now?: Date
}): Promise<
  | { ok: true; now: Date; append: AppendSheetRowResult; rowReference: string }
  | { ok: false; now: Date; error: string }
> {
  const now = params.now ?? new Date()
  const sheetUrl = clean(params.lead.sourceUrl)
  if (!sheetUrl) {
    return { ok: false, now, error: 'Sheet-backed customer has no leadsReportingUrl configured' }
  }

  try {
    const append = await (params.appendFn ?? appendCanonicalLeadRow)({
      sheetUrl,
      canonicalRow: buildOutboundCanonicalRow(params.lead),
    })
    return {
      ok: true,
      now,
      append,
      rowReference: buildRowReference({ sheetId: append.sheetId, gid: append.gid, rowNumber: append.rowNumber }),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Outbound Google Sheets sync failed'
    return { ok: false, now, error: message }
  }
}

export async function runOutboundUpdate(params: {
  lead: LeadForSync
  rowReference?: string | null
  updateFn?: (input: {
    sheetUrl: string
    rowNumber: number
    gid?: string | null
    canonicalRow: Record<string, unknown>
  }) => Promise<UpdateSheetRowResult>
  now?: Date
}): Promise<
  | { ok: true; now: Date; update: UpdateSheetRowResult; rowReference: string }
  | { ok: false; now: Date; error: string }
> {
  const now = params.now ?? new Date()
  const sheetUrl = clean(params.lead.sourceUrl)
  if (!sheetUrl) {
    return { ok: false, now, error: 'Sheet-backed customer has no leadsReportingUrl configured' }
  }

  const parsedRowRef = parseRowReference(params.rowReference ?? params.lead.externalRowFingerprint)
  if (!parsedRowRef) {
    return {
      ok: false,
      now,
      error: 'Outbound edit sync requires row linkage. Re-import leads or resync create before editing.',
    }
  }

  try {
    const update = await (params.updateFn ?? updateCanonicalLeadRow)({
      sheetUrl,
      gid: parsedRowRef.gid,
      rowNumber: parsedRowRef.rowNumber,
      canonicalRow: buildOutboundCanonicalRow(params.lead),
    })
    return {
      ok: true,
      now,
      update,
      rowReference: buildRowReference({ sheetId: update.sheetId, gid: update.gid, rowNumber: update.rowNumber }),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Outbound Google Sheets row update failed'
    return { ok: false, now, error: message }
  }
}

export async function syncManualLeadOutbound(params: {
  prisma: PrismaClient
  customerId: string
  leadId: string
  forceRetry?: boolean
  appendFn?: (input: { sheetUrl: string; canonicalRow: Record<string, unknown> }) => Promise<AppendSheetRowResult>
}): Promise<OutboundSyncResult> {
  const lead = await loadLeadForSync(params.prisma, params.customerId, params.leadId)
  if (!lead) throw new Error('Lead not found for customer')

  if (lead.syncStatus === 'synced' && lead.lastOutboundSyncAt) {
    return {
      status: 'synced',
      note: 'Lead is already synced to Google Sheets.',
      error: null,
      rowReference: lead.externalRowFingerprint || null,
      rowNumber: parseRowReference(lead.externalRowFingerprint)?.rowNumber || null,
      operation: 'create',
      lead: mapLeadResponse(lead),
    }
  }

  const attempt = await runOutboundAppend({
    lead,
    appendFn: params.appendFn,
  })

  if (attempt.ok === false) {
    const failed = await params.prisma.leadRecord.update({
      where: { id: lead.id },
      data: {
        syncStatus: 'sync_error',
        syncError: attempt.error,
        normalizedData: buildNormalizedDataWithSync(lead, {
          sourceType: 'odcrm_manual',
          pendingOperation: 'create',
          lastOperation: 'create',
          outboundAt: null,
          status: 'sync_error',
          error: attempt.error,
        }) as any,
      },
      select: {
        id: true,
        customerId: true,
        occurredAt: true,
        source: true,
        owner: true,
        fullName: true,
        email: true,
        phone: true,
        company: true,
        jobTitle: true,
        location: true,
        status: true,
        notes: true,
        syncStatus: true,
        createdAt: true,
      },
    })
    await updateLeadSyncState({
      prisma: params.prisma,
      customerId: params.customerId,
      now: attempt.now,
      success: false,
      error: attempt.error,
    })
    return {
      status: 'sync_error',
      note: 'Lead saved in ODCRM, but outbound Google Sheets sync failed.',
      error: attempt.error,
      rowReference: null,
      rowNumber: null,
      operation: 'create',
      lead: mapLeadResponse(failed),
    }
  }

  const success = await params.prisma.leadRecord.update({
    where: { id: lead.id },
    data: {
      syncStatus: 'synced',
      syncError: null,
      lastOutboundSyncAt: attempt.now,
      externalRowFingerprint: attempt.rowReference,
      sheetGid: attempt.append.gid || lead.sheetGid,
      normalizedData: buildNormalizedDataWithSync(lead, {
        sourceType: 'odcrm_manual',
        pendingOperation: null,
        lastOperation: 'create',
        outboundAt: attempt.now.toISOString(),
        status: 'synced',
        error: null,
        sheetRowReference: attempt.rowReference,
      }) as any,
    },
    select: {
      id: true,
      customerId: true,
      occurredAt: true,
      source: true,
      owner: true,
      fullName: true,
      email: true,
      phone: true,
      company: true,
      jobTitle: true,
      location: true,
      status: true,
      notes: true,
      syncStatus: true,
      createdAt: true,
    },
  })

  await updateLeadSyncState({
    prisma: params.prisma,
    customerId: params.customerId,
    now: attempt.now,
    success: true,
  })

  return {
    status: 'synced',
    note: 'Lead synced to Google Sheets.',
    error: null,
    rowReference: attempt.rowReference,
    rowNumber: attempt.append.rowNumber,
    operation: 'create',
    lead: mapLeadResponse(success),
  }
}

export async function syncManualLeadEditOutbound(params: {
  prisma: PrismaClient
  customerId: string
  leadId: string
  updateFn?: (input: {
    sheetUrl: string
    rowNumber: number
    gid?: string | null
    canonicalRow: Record<string, unknown>
  }) => Promise<UpdateSheetRowResult>
}): Promise<OutboundSyncResult> {
  const lead = await loadLeadForSync(params.prisma, params.customerId, params.leadId)
  if (!lead) throw new Error('Lead not found for customer')

  const attempt = await runOutboundUpdate({
    lead,
    updateFn: params.updateFn,
  })

  if (attempt.ok === false) {
    const failed = await params.prisma.leadRecord.update({
      where: { id: lead.id },
      data: {
        syncStatus: 'sync_error',
        syncError: attempt.error,
        normalizedData: buildNormalizedDataWithSync(lead, {
          sourceType: 'odcrm_manual',
          pendingOperation: 'update',
          lastOperation: 'update',
          outboundAt: null,
          status: 'sync_error',
          error: attempt.error,
        }) as any,
      },
      select: {
        id: true,
        customerId: true,
        occurredAt: true,
        source: true,
        owner: true,
        fullName: true,
        email: true,
        phone: true,
        company: true,
        jobTitle: true,
        location: true,
        status: true,
        notes: true,
        syncStatus: true,
        createdAt: true,
      },
    })
    await updateLeadSyncState({
      prisma: params.prisma,
      customerId: params.customerId,
      now: attempt.now,
      success: false,
      error: attempt.error,
    })
    return {
      status: 'sync_error',
      note: 'Lead updated in ODCRM, but outbound Google Sheets row update failed.',
      error: attempt.error,
      rowReference: lead.externalRowFingerprint || null,
      rowNumber: parseRowReference(lead.externalRowFingerprint)?.rowNumber || null,
      operation: 'update',
      lead: mapLeadResponse(failed),
    }
  }

  const success = await params.prisma.leadRecord.update({
    where: { id: lead.id },
    data: {
      syncStatus: 'synced',
      syncError: null,
      lastOutboundSyncAt: attempt.now,
      externalRowFingerprint: attempt.rowReference,
      sheetGid: attempt.update.gid || lead.sheetGid,
      normalizedData: buildNormalizedDataWithSync(lead, {
        sourceType: 'odcrm_manual',
        pendingOperation: null,
        lastOperation: 'update',
        outboundAt: attempt.now.toISOString(),
        status: 'synced',
        error: null,
        sheetRowReference: attempt.rowReference,
      }) as any,
    },
    select: {
      id: true,
      customerId: true,
      occurredAt: true,
      source: true,
      owner: true,
      fullName: true,
      email: true,
      phone: true,
      company: true,
      jobTitle: true,
      location: true,
      status: true,
      notes: true,
      syncStatus: true,
      createdAt: true,
    },
  })

  await updateLeadSyncState({
    prisma: params.prisma,
    customerId: params.customerId,
    now: attempt.now,
    success: true,
  })

  return {
    status: 'synced',
    note: 'Lead update synced to Google Sheets.',
    error: null,
    rowReference: attempt.rowReference,
    rowNumber: attempt.update.rowNumber,
    operation: 'update',
    lead: mapLeadResponse(success),
  }
}

export async function retryLeadOutboundSync(params: {
  prisma: PrismaClient
  customerId: string
  leadId: string
  appendFn?: (input: { sheetUrl: string; canonicalRow: Record<string, unknown> }) => Promise<AppendSheetRowResult>
  updateFn?: (input: {
    sheetUrl: string
    rowNumber: number
    gid?: string | null
    canonicalRow: Record<string, unknown>
  }) => Promise<UpdateSheetRowResult>
}): Promise<OutboundSyncResult> {
  const lead = await loadLeadForSync(params.prisma, params.customerId, params.leadId)
  if (!lead) throw new Error('Lead not found for customer')

  const hasRowLinkage = parseRowReference(lead.externalRowFingerprint) != null
  const pendingOperation = getPendingOperationFromLead(lead)
  const operation: 'create' | 'update' = pendingOperation === 'update' || hasRowLinkage ? 'update' : 'create'

  if (operation === 'update') {
    return syncManualLeadEditOutbound({
      prisma: params.prisma,
      customerId: params.customerId,
      leadId: params.leadId,
      updateFn: params.updateFn,
    })
  }

  return syncManualLeadOutbound({
    prisma: params.prisma,
    customerId: params.customerId,
    leadId: params.leadId,
    forceRetry: true,
    appendFn: params.appendFn,
  })
}
