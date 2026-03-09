import type { LeadRecord, PrismaClient } from '@prisma/client'
import { appendCanonicalLeadRow, type AppendSheetRowResult } from './googleSheetsService.js'

export type LeadSyncStatus = 'pending_outbound' | 'synced' | 'sync_error'

export type OutboundSyncResult = {
  status: LeadSyncStatus
  note: string
  error: string | null
  rowReference: string | null
  rowNumber: number | null
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

function buildRowReference(appendResult: AppendSheetRowResult): string {
  const row = appendResult.rowNumber != null ? String(appendResult.rowNumber) : 'unknown'
  const gid = appendResult.gid || 'unknown'
  return `gsheet:${appendResult.sheetId}:${gid}:${row}`
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
    return { ok: true, now, append, rowReference: buildRowReference(append) }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Outbound Google Sheets sync failed'
    return { ok: false, now, error: message }
  }
}

function mapLeadResponse(lead: Pick<LeadForSync, 'id' | 'customerId' | 'occurredAt' | 'source' | 'owner' | 'fullName' | 'email' | 'phone' | 'company' | 'jobTitle' | 'location' | 'status' | 'notes' | 'syncStatus' | 'createdAt'>) {
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

export async function syncManualLeadOutbound(params: {
  prisma: PrismaClient
  customerId: string
  leadId: string
  forceRetry?: boolean
  appendFn?: (input: { sheetUrl: string; canonicalRow: Record<string, unknown> }) => Promise<AppendSheetRowResult>
}): Promise<OutboundSyncResult> {
  const lead = await loadLeadForSync(params.prisma, params.customerId, params.leadId)
  if (!lead) throw new Error('Lead not found for customer')

  if (!params.forceRetry && lead.syncStatus === 'synced' && lead.lastOutboundSyncAt) {
    return {
      status: 'synced',
      note: 'Lead is already synced to Google Sheets.',
      error: null,
      rowReference: null,
      rowNumber: null,
      lead: mapLeadResponse(lead),
    }
  }
  if (params.forceRetry && lead.syncStatus === 'synced' && lead.lastOutboundSyncAt) {
    return {
      status: 'synced',
      note: 'Lead is already synced to Google Sheets.',
      error: null,
      rowReference: null,
      rowNumber: null,
      lead: mapLeadResponse(lead),
    }
  }

  const attempt = await runOutboundAppend({
    lead,
    appendFn: params.appendFn,
  })

  if (attempt.ok === false) {
    const attemptError = attempt.error
    const failed = await params.prisma.leadRecord.update({
      where: { id: lead.id },
      data: {
        syncStatus: 'sync_error',
        syncError: attemptError,
        normalizedData: {
          ...(typeof lead.normalizedData === 'object' && lead.normalizedData != null ? (lead.normalizedData as Record<string, unknown>) : {}),
          sync: {
            sourceType: 'odcrm_manual',
            outboundAt: null,
            status: 'sync_error',
            error: attemptError,
          },
        },
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
    await params.prisma.leadSyncState.upsert({
      where: { customerId: params.customerId },
        create: {
          customerId: params.customerId,
          lastSyncAt: attempt.now,
          lastError: attemptError,
          syncStatus: 'error',
        },
        update: {
          lastSyncAt: attempt.now,
          lastError: attemptError,
          syncStatus: 'error',
        },
      })
    return {
      status: 'sync_error',
      note: 'Lead saved in ODCRM, but outbound Google Sheets sync failed.',
      error: attemptError,
      rowReference: null,
      rowNumber: null,
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
      normalizedData: {
        ...(typeof lead.normalizedData === 'object' && lead.normalizedData != null ? (lead.normalizedData as Record<string, unknown>) : {}),
        sync: {
          sourceType: 'odcrm_manual',
          outboundAt: attempt.now.toISOString(),
          status: 'synced',
          error: null,
          sheetRowReference: attempt.rowReference,
        },
      },
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

  await params.prisma.leadSyncState.upsert({
    where: { customerId: params.customerId },
    create: {
      customerId: params.customerId,
      lastSyncAt: attempt.now,
      lastSuccessAt: attempt.now,
      lastOutboundSyncAt: attempt.now,
      lastError: null,
      syncStatus: 'success',
    },
    update: {
      lastSyncAt: attempt.now,
      lastSuccessAt: attempt.now,
      lastOutboundSyncAt: attempt.now,
      lastError: null,
      syncStatus: 'success',
    },
  })

  return {
    status: 'synced',
    note: 'Lead synced to Google Sheets.',
    error: null,
    rowReference: attempt.rowReference,
    rowNumber: attempt.append.rowNumber,
    lead: mapLeadResponse(success),
  }
}
