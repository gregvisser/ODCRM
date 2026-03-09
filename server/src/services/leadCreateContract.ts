import crypto from 'crypto'
import type { LeadStatus } from '@prisma/client'
import { extractCanonicalLeadRecord } from './leadCanonicalMapping.js'

export type CreateNormalizedLeadInput = {
  occurredAt?: string | null
  firstName?: string | null
  lastName?: string | null
  fullName?: string | null
  email?: string | null
  phone?: string | null
  company?: string | null
  jobTitle?: string | null
  location?: string | null
  source?: string | null
  owner?: string | null
  status?: LeadStatus | null
  notes?: string | null
}

function normalizeText(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = String(value).trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseDate(value: string | null | undefined): Date | null {
  const text = normalizeText(value)
  if (!text) return null
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function splitName(fullName: string | null): { firstName: string | null; lastName: string | null } {
  if (!fullName) return { firstName: null, lastName: null }
  const parts = fullName.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: null, lastName: null }
  if (parts.length === 1) return { firstName: parts[0], lastName: null }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  }
}

export function buildManualLeadCreatePayload(input: {
  customerId: string
  accountName: string
  sourceOfTruth: 'google_sheets' | 'db'
  values: CreateNormalizedLeadInput
  now?: Date
}) {
  const now = input.now ?? new Date()
  const raw = {
    Date: normalizeText(input.values.occurredAt) || '',
    Name: normalizeText(input.values.fullName) || '',
    'First Name': normalizeText(input.values.firstName) || '',
    'Last Name': normalizeText(input.values.lastName) || '',
    Email: normalizeText(input.values.email) || '',
    Phone: normalizeText(input.values.phone) || '',
    Company: normalizeText(input.values.company) || '',
    'Job Title': normalizeText(input.values.jobTitle) || '',
    Location: normalizeText(input.values.location) || '',
    Source: normalizeText(input.values.source) || '',
    Owner: normalizeText(input.values.owner) || '',
    Status: normalizeText(input.values.status || null) || '',
    Notes: normalizeText(input.values.notes) || '',
  }

  const canonical = extractCanonicalLeadRecord(raw)
  const fullName = normalizeText(input.values.fullName) || canonical.fullName
  const fallbackNames = splitName(fullName)
  const firstName = normalizeText(input.values.firstName) || canonical.firstName || fallbackNames.firstName
  const lastName = normalizeText(input.values.lastName) || canonical.lastName || fallbackNames.lastName

  const occurredAt = parseDate(input.values.occurredAt) || canonical.occurredAt
  const externalId = `odcrm_manual:${input.customerId}:${now.toISOString()}:${crypto.randomBytes(4).toString('hex')}`
  const outboundStatus = input.sourceOfTruth === 'google_sheets' ? 'pending_outbound' : 'synced'

  const normalizedData = {
    canonical: {
      occurredAt: occurredAt ? occurredAt.toISOString() : null,
      source: normalizeText(input.values.source) || canonical.source,
      owner: normalizeText(input.values.owner) || canonical.owner,
      fullName,
      firstName,
      lastName,
      email: normalizeText(input.values.email)?.toLowerCase() || canonical.email,
      phone: normalizeText(input.values.phone) || canonical.phone,
      company: normalizeText(input.values.company) || canonical.company,
      jobTitle: normalizeText(input.values.jobTitle) || canonical.jobTitle,
      location: normalizeText(input.values.location) || canonical.location,
      status: normalizeText(input.values.status || null) || canonical.status || 'new',
      notes: normalizeText(input.values.notes) || canonical.notes,
    },
    sync: {
      sourceType: 'odcrm_manual',
      inboundAt: now.toISOString(),
      outboundAt: null,
      status: outboundStatus,
    },
  }

  return {
    externalId,
    occurredAt,
    source: normalizeText(input.values.source) || canonical.source,
    owner: normalizeText(input.values.owner) || canonical.owner,
    firstName,
    lastName,
    fullName,
    email: normalizeText(input.values.email)?.toLowerCase() || canonical.email,
    phone: normalizeText(input.values.phone) || canonical.phone,
    company: normalizeText(input.values.company) || canonical.company,
    jobTitle: normalizeText(input.values.jobTitle) || canonical.jobTitle,
    location: normalizeText(input.values.location) || canonical.location,
    notes: normalizeText(input.values.notes) || canonical.notes,
    leadStatus: (normalizeText(input.values.status || null) || canonical.status || 'new') as LeadStatus,
    syncStatus: outboundStatus,
    lastInboundSyncAt: now,
    lastOutboundSyncAt: null as Date | null,
    syncError: null as string | null,
    externalSourceType: 'odcrm_manual',
    normalizedData,
    rawData: raw,
  }
}
