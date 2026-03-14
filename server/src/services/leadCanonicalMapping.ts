import crypto from 'crypto'

export const LEAD_CANONICAL_REQUIRED_FIELDS = ['occurredAt', 'source', 'owner'] as const

export const LEAD_CANONICAL_OPTIONAL_FIELDS = [
  'externalId',
  'firstName',
  'lastName',
  'fullName',
  'email',
  'phone',
  'company',
  'jobTitle',
  'location',
  'status',
  'notes',
] as const

type CanonicalLeadField = (typeof LEAD_CANONICAL_REQUIRED_FIELDS)[number] | (typeof LEAD_CANONICAL_OPTIONAL_FIELDS)[number]

export type CanonicalLeadRecord = {
  occurredAt: Date | null
  source: string | null
  owner: string | null
  externalId: string | null
  firstName: string | null
  lastName: string | null
  fullName: string | null
  email: string | null
  phone: string | null
  company: string | null
  jobTitle: string | null
  location: string | null
  status: string | null
  notes: string | null
}

export type StoredLeadTruthRow = {
  data?: unknown
  externalSourceType?: string | null
  occurredAt?: Date | null
  createdAt?: Date | null
  source?: string | null
  owner?: string | null
  company?: string | null
  fullName?: string | null
  email?: string | null
  phone?: string | null
  jobTitle?: string | null
  location?: string | null
  status?: string | null
  notes?: string | null
}

const REAL_LEAD_IDENTITY_ALIASES = [
  'fullname',
  'name',
  'contactname',
  'contact',
  'firstname',
  'first',
  'lastname',
  'last',
  'email',
  'emailaddress',
  'workemail',
  'phone',
  'phonenumber',
  'mobile',
  'telephone',
  'contactinfo',
]

const REAL_LEAD_COMPANY_ALIASES = ['company', 'account', 'business', 'organization', 'organisation']

const REAL_LEAD_CONTEXT_ALIASES = [
  'source',
  'channel',
  'leadchannel',
  'channeloflead',
  'leadsource',
  'campaign',
  'utmsource',
  'marketingchannel',
  'platform',
  'type',
  'owner',
  'odteammember',
  'odteam',
  'teammember',
  'assignedto',
  'salesperson',
  'rep',
  'agent',
  'jobtitle',
  'title',
  'role',
  'position',
  'location',
  'city',
  'region',
  'country',
  'status',
  'leadstatus',
  'pipeline',
  'notes',
  'note',
  'comments',
  'comment',
  'outcome',
]

const REAL_LEAD_CHANNEL_ALIASES = ['source', 'channel', 'leadchannel', 'channeloflead', 'leadsource', 'campaign', 'utmsource', 'marketingchannel', 'platform', 'type']

const LEAD_FIELD_ALIASES: Record<CanonicalLeadField, string[]> = {
  occurredAt: ['occurredat', 'date', 'created', 'createdat', 'timestamp', 'leaddate', 'firstmeetingdate'],
  source: ['source', 'channel', 'leadchannel', 'channeloflead', 'leadsource', 'campaign', 'utmsource', 'marketingchannel', 'platform', 'type'],
  owner: ['owner', 'odteammember', 'odteam', 'teammember', 'assignedto', 'salesperson', 'rep', 'agent'],
  externalId: ['externalid', 'leadid', 'id', 'rowid', 'sheetrowid'],
  firstName: ['firstname', 'first'],
  lastName: ['lastname', 'last'],
  fullName: ['fullname', 'name', 'contactname', 'contact'],
  email: ['email', 'emailaddress', 'workemail'],
  phone: ['phone', 'phonenumber', 'mobile', 'telephone'],
  company: ['company', 'account', 'business', 'organization', 'organisation'],
  jobTitle: ['jobtitle', 'title', 'role', 'position'],
  location: ['location', 'city', 'region', 'country'],
  status: ['status', 'leadstatus', 'pipeline'],
  notes: ['notes', 'note', 'comments', 'comment'],
}

export function normalizeLeadHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^\w]/g, '')
}

function asTrimmed(value: unknown): string | null {
  if (value == null) return null
  const text = String(value).trim()
  return text === '' ? null : text
}

export function asLeadRawData(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {}
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, raw]) => {
    acc[key] = String(raw ?? '')
    return acc
  }, {})
}

function isWeekMarkerValue(value: string | null): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized.startsWith('w/c') || normalized.startsWith('w/v') || normalized.startsWith('week commencing')
}

function parseDate(value: string | null): Date | null {
  if (!value) return null
  const ddmmyy = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/)
  if (ddmmyy) {
    const y = Number(ddmmyy[3])
    const year = y < 100 ? 2000 + y : y
    const parsed = new Date(year, Number(ddmmyy[2]) - 1, Number(ddmmyy[1]))
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  const ddmmyyyy = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (ddmmyyyy) {
    const parsed = new Date(Number(ddmmyyyy[3]), Number(ddmmyyyy[2]) - 1, Number(ddmmyyyy[1]))
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function findField(raw: Record<string, string>, field: CanonicalLeadField): string | null {
  const aliases = LEAD_FIELD_ALIASES[field]
  for (const [key, value] of Object.entries(raw)) {
    const normalized = normalizeLeadHeader(key)
    if (aliases.includes(normalized)) {
      const cleaned = asTrimmed(value)
      if (cleaned) return cleaned
    }
  }
  return null
}

export function buildStoredLeadTruthInput(row: StoredLeadTruthRow): Record<string, string> {
  return {
    ...asLeadRawData(row.data),
    ...(row.fullName ? { Name: row.fullName } : {}),
    ...(row.email ? { Email: row.email } : {}),
    ...(row.phone ? { Phone: row.phone } : {}),
    ...(row.company ? { Company: row.company } : {}),
    ...(row.jobTitle ? { 'Job Title': row.jobTitle } : {}),
    ...(row.location ? { Location: row.location } : {}),
    ...(row.status ? { 'Lead Status': row.status } : {}),
    ...(row.notes ? { Notes: row.notes } : {}),
    ...(row.source ? { 'Channel of Lead': row.source } : {}),
    ...(row.owner ? { 'OD Team Member': row.owner } : {}),
  }
}

export function extractCanonicalLeadRecord(raw: Record<string, string>): CanonicalLeadRecord {
  const fullName = findField(raw, 'fullName')
  const firstName = findField(raw, 'firstName')
  const lastName = findField(raw, 'lastName')
  const parsedFirst = firstName ?? (fullName ? fullName.split(/\s+/)[0] || null : null)
  const parsedLast = lastName ?? (fullName ? fullName.split(/\s+/).slice(1).join(' ').trim() || null : null)

  const email = findField(raw, 'email')
  const phone = findField(raw, 'phone')
  const status = findField(raw, 'status')

  return {
    occurredAt: parseDate(findField(raw, 'occurredAt')),
    source: findField(raw, 'source'),
    owner: findField(raw, 'owner'),
    externalId: findField(raw, 'externalId'),
    firstName: parsedFirst,
    lastName: parsedLast,
    fullName,
    email: email ? email.toLowerCase() : null,
    phone,
    company: findField(raw, 'company'),
    jobTitle: findField(raw, 'jobTitle'),
    location: findField(raw, 'location'),
    status: status ? status.toLowerCase() : null,
    notes: findField(raw, 'notes'),
  }
}

function hasMeaningfulAliasValue(raw: Record<string, string>, aliases: string[]): boolean {
  for (const [key, value] of Object.entries(raw)) {
    const normalizedKey = normalizeLeadHeader(key)
    if (!aliases.includes(normalizedKey)) continue

    const cleanedValue = asTrimmed(value)
    if (!cleanedValue) continue
    if (isWeekMarkerValue(cleanedValue) || parseDate(cleanedValue)) continue
    return true
  }
  return false
}

export function isRealLeadRow(raw: Record<string, string>, options?: { sourceType?: string | null }): boolean {
  const canonical = extractCanonicalLeadRecord(raw)
  const sourceType = options?.sourceType ?? null
  const hasCompany = Boolean(canonical.company) || hasMeaningfulAliasValue(raw, REAL_LEAD_COMPANY_ALIASES)
  const hasChannel = Boolean(canonical.source) || hasMeaningfulAliasValue(raw, REAL_LEAD_CHANNEL_ALIASES)

  if (sourceType === 'google_sheets') {
    return hasCompany && hasChannel
  }

  const hasIdentity =
    Boolean(canonical.fullName) ||
    Boolean(canonical.firstName) ||
    Boolean(canonical.lastName) ||
    Boolean(canonical.email) ||
    Boolean(canonical.phone)

  let hasSupplementalDetail = false

  for (const [key, value] of Object.entries(raw)) {
    const normalizedKey = normalizeLeadHeader(key)
    const cleanedValue = asTrimmed(value)
    if (!cleanedValue) continue

    if (normalizedKey === 'week' && isWeekMarkerValue(cleanedValue)) {
      continue
    }

    if (REAL_LEAD_IDENTITY_ALIASES.includes(normalizedKey)) {
      if (isWeekMarkerValue(cleanedValue) || parseDate(cleanedValue)) {
        continue
      }
      return true
    }

    if (REAL_LEAD_COMPANY_ALIASES.includes(normalizedKey)) {
      if (isWeekMarkerValue(cleanedValue) || parseDate(cleanedValue)) {
        continue
      }
      continue
    }

    if (REAL_LEAD_CONTEXT_ALIASES.includes(normalizedKey)) {
      hasSupplementalDetail = true
    }
  }

  return hasIdentity || (hasCompany && hasSupplementalDetail)
}

export function isRealStoredLeadRow(row: StoredLeadTruthRow): boolean {
  return isRealLeadRow(buildStoredLeadTruthInput(row), { sourceType: row.externalSourceType ?? null })
}

export function extractStoredLeadCanonicalRecord(row: StoredLeadTruthRow): CanonicalLeadRecord {
  return extractCanonicalLeadRecord(buildStoredLeadTruthInput(row))
}

export function buildExternalRowFingerprint(input: {
  customerId: string
  sourceType: string
  sheetGid?: string | null
  rowIndex?: number | null
  raw: Record<string, string>
  externalId?: string | null
}): string {
  const orderedRaw = Object.entries(input.raw)
    .map(([k, v]) => [normalizeLeadHeader(k), String(v).trim()] as const)
    .filter(([k]) => k !== '')
    .sort((a, b) => a[0].localeCompare(b[0]))

  const payload = JSON.stringify({
    customerId: input.customerId,
    sourceType: input.sourceType,
    sheetGid: input.sheetGid || null,
    rowIndex: input.rowIndex ?? null,
    externalId: input.externalId || null,
    raw: orderedRaw,
  })
  return crypto.createHash('sha256').update(payload).digest('hex')
}
