/**
 * Canonical column mapping for Lead Sources (Google Sheets).
 * Sheets cannot be modified; we normalize headers and map to canonical fields.
 * Duplicate headers (e.g. Cognism: Client, Campaigns twice) → first occurrence canonical, rest as extraFields (client_2, campaigns_2, etc.).
 */

export const CANONICAL_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'linkedinUrl',
  'companyName',
  'jobTitle',
  'country',
  'city',
  'mobile',
  'directPhone',
  'officePhone',
  'hq',
  'website',
  'headcount',
  'industries',
  'client',
  'campaigns',
  'campaignNotes',
  'telesales',
  'teleNotes',
  'linkedinStatus',
  'linkedinNotes',
] as const

export type CanonicalFieldName = (typeof CANONICAL_FIELDS)[number]

/** Map normalized header string → canonical field (first match wins). */
const HEADER_TO_CANONICAL: Record<string, CanonicalFieldName> = {
  firstname: 'firstName',
  'first name': 'firstName',
  first_name: 'firstName',
  lastname: 'lastName',
  'last name': 'lastName',
  last_name: 'lastName',
  email: 'email',
  personal_linkedin_url: 'linkedinUrl',
  'personal linkedin url': 'linkedinUrl',
  linkedin: 'linkedinUrl',
  linkedin_url: 'linkedinUrl',
  companyname: 'companyName',
  'company name': 'companyName',
  company_name: 'companyName',
  company: 'companyName',
  jobtitle: 'jobTitle',
  'job title': 'jobTitle',
  job_title: 'jobTitle',
  title: 'jobTitle',
  country: 'country',
  city: 'city',
  mobile: 'mobile',
  direct: 'directPhone',
  direct_phone: 'directPhone',
  directphone: 'directPhone',
  office: 'officePhone',
  office_phone: 'officePhone',
  officephone: 'officePhone',
  hq: 'hq',
  headquarters: 'hq',
  website: 'website',
  headcount: 'headcount',
  industries: 'industries',
  client: 'client',
  campaigns: 'campaigns',
  campaign_notes: 'campaignNotes',
  'campaign notes': 'campaignNotes',
  campaignnotes: 'campaignNotes',
  telesales: 'telesales',
  tele_notes: 'teleNotes',
  'tele notes': 'teleNotes',
  telenotes: 'teleNotes',
  linkedinstatus: 'linkedinStatus',
  'linkedin status': 'linkedinStatus',
  linkedin_status: 'linkedinStatus',
  linkedinnotes: 'linkedinNotes',
  'linkedin notes': 'linkedinNotes',
  linkedin_notes: 'linkedinNotes',
}

/**
 * Normalize header for comparison:
 * trim, collapse internal whitespace, lowercase, remove trailing spaces, remove invisible chars, remove duplicate tab spacing.
 */
export function normalizeHeader(header: string): string {
  return header
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\t+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // strip zero-width/invisible
}

/**
 * Build ordered list of column names from raw header row.
 * Duplicate headers: first keeps original intent; subsequent get suffix _2, _3, ...
 * Returns { canonicalKeys: (canonical | extra key)[], extraKeys: string[] for duplicates as extraFields keys }.
 */
export function buildColumnMapping(rawHeaderRow: string[]): {
  orderedColumns: string[]
  headerToCanonicalOrExtra: Record<string, string>
  duplicateSuffixCount: Record<string, number>
} {
  const orderedColumns: string[] = []
  const headerToCanonicalOrExtra: Record<string, string> = {}
  const duplicateSuffixCount: Record<string, number> = {}
  const seenNormalized = new Map<string, number>()

  for (let i = 0; i < rawHeaderRow.length; i++) {
    const raw = rawHeaderRow[i]
    const normalized = normalizeHeader(raw || '')
    if (!normalized) {
      orderedColumns.push(`_col${i}`)
      headerToCanonicalOrExtra[raw || `_col${i}`] = `_col${i}`
      continue
    }

    const canonical = HEADER_TO_CANONICAL[normalized]
    const count = (seenNormalized.get(normalized) ?? 0) + 1
    seenNormalized.set(normalized, count)

    if (count === 1) {
      const key = canonical ?? normalized
      orderedColumns.push(key)
      headerToCanonicalOrExtra[raw] = key
      if (!canonical) duplicateSuffixCount[normalized] = 1
    } else {
      const suffix = count === 2 ? '_2' : `_${count}`
      const extraKey = (canonical ?? normalized) + suffix
      orderedColumns.push(extraKey)
      headerToCanonicalOrExtra[raw] = extraKey
      duplicateSuffixCount[normalized] = count
    }
  }

  return { orderedColumns, headerToCanonicalOrExtra, duplicateSuffixCount }
}

/** Canonical fields (only those present in sheet) */
type CanonicalContactRowMap = { [K in CanonicalFieldName]?: string }
export type CanonicalContactRow = CanonicalContactRowMap & {
  /** Any other columns (including duplicate renames like client_2) */
  extraFields?: Record<string, string>
}

export interface MappedRow {
  canonical: Partial<Record<CanonicalFieldName, string>>
  extraFields: Record<string, string>
  /** Ordered list of column names for UI (canonical + extra keys) */
  columnKeys: string[]
}

/**
 * Map one data row to canonical + extraFields using pre-built column mapping.
 */
export function mapRowToCanonical(
  rawRow: string[],
  rawHeaderRow: string[],
  columnMapping: { orderedColumns: string[]; headerToCanonicalOrExtra: Record<string, string> }
): MappedRow {
  const canonical: Partial<Record<CanonicalFieldName, string>> = {}
  const extraFields: Record<string, string> = {}
  const { orderedColumns, headerToCanonicalOrExtra } = columnMapping

  rawHeaderRow.forEach((h, i) => {
    const value = (rawRow[i] ?? '').trim()
    const key = headerToCanonicalOrExtra[h ?? ''] ?? `_col${i}`
    const outValue = value || ''
    if (CANONICAL_FIELDS.includes(key as CanonicalFieldName)) {
      (canonical as Record<string, string>)[key] = outValue
    } else {
      extraFields[key] = outValue
    }
  })

  return {
    canonical,
    extraFields,
    columnKeys: orderedColumns,
  }
}

export type CsvDelimiter = ',' | '\t' | ';'

/**
 * Auto-detect delimiter from first line of CSV.
 * If header contains tab → \t; else if contains ; and commas are low → ; else ,
 */
export function detectDelimiter(firstLine: string): CsvDelimiter {
  const hasTab = firstLine.includes('\t')
  if (hasTab) return '\t'
  const commaCount = (firstLine.match(/,/g) || []).length
  const semicolonCount = (firstLine.match(/;/g) || []).length
  if (semicolonCount > 0 && commaCount <= semicolonCount) return ';'
  return ','
}

/**
 * Parse CSV text into rows (array of string[]). Handles quoted values.
 * Uses given delimiter (default comma).
 */
export function parseCsvRows(text: string, delimiter: CsvDelimiter = ','): string[][] {
  const sep = delimiter
  const lines: string[][] = []
  let currentLine: string[] = []
  let currentField = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const nextChar = text[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === sep && !inQuotes) {
      currentLine.push(currentField.trim())
      currentField = ''
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++
      currentLine.push(currentField.trim())
      currentField = ''
      if (currentLine.length > 0) {
        lines.push(currentLine)
        currentLine = []
      }
    } else {
      currentField += char
    }
  }
  if (currentField || currentLine.length > 0) {
    currentLine.push(currentField.trim())
    lines.push(currentLine)
  }
  return lines
}

/**
 * Full pipeline: raw CSV text → header mapping + array of MappedRow.
 * First row = header; rest = data. Delimiter auto-detected from first line. Duplicate headers handled.
 */
export function csvToMappedRows(csvText: string): { columnKeys: string[]; rows: MappedRow[]; delimiter: CsvDelimiter } {
  const firstLine = csvText.split(/\r?\n/)[0] ?? ''
  const delimiter = detectDelimiter(firstLine)
  const allRows = parseCsvRows(csvText, delimiter)
  if (allRows.length < 2) {
    return { columnKeys: [], rows: [], delimiter }
  }
  const rawHeaderRow = allRows[0]
  const { orderedColumns, headerToCanonicalOrExtra } = buildColumnMapping(rawHeaderRow)
  const rows: MappedRow[] = []
  for (let r = 1; r < allRows.length; r++) {
    rows.push(mapRowToCanonical(allRows[r], rawHeaderRow, { orderedColumns, headerToCanonicalOrExtra }))
  }
  const columnKeys = [...new Set(rows.flatMap((row) => row.columnKeys))]
  if (columnKeys.length === 0 && orderedColumns.length > 0) columnKeys.push(...orderedColumns)
  return { columnKeys, rows, delimiter }
}
