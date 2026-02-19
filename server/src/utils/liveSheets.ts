/**
 * Live leads from Google Sheets (or published CSV). No DB writes.
 * Fetch CSV, parse, normalize headers, map to canonical fields, in-memory cache.
 */

const CACHE_TTL_SUCCESS_MS = 30 * 1000
const CACHE_TTL_FAILURE_MS = 10 * 1000
const FETCH_TIMEOUT_MS = 10 * 1000

export type LiveLeadRow = {
  occurredAt: string | null
  source: string | null
  owner: string | null
  company: string | null
  name: string | null
  raw: Record<string, string>
}

const OCCURRED_AT_ALIASES = ['date', 'created', 'created at', 'added', 'timestamp', 'lead date']
const SOURCE_ALIASES = ['source', 'channel', 'channel of lead', 'lead source', 'campaign', 'utm source', 'marketing channel', 'platform', 'type']
const OWNER_ALIASES = ['owner', 'od team member', 'od team', 'user', 'rep', 'agent', 'assigned to', 'salesperson']
const COMPANY_ALIASES = ['company', 'account', 'business', 'organisation', 'organization']
const NAME_ALIASES = ['name', 'contact', 'lead', 'full name', 'person']

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function matchCanonical(normalized: string, aliases: readonly string[]): boolean {
  return aliases.includes(normalized)
}

function canonicalKey(normalized: string): keyof Omit<LiveLeadRow, 'raw'> | null {
  if (matchCanonical(normalized, OCCURRED_AT_ALIASES)) return 'occurredAt'
  if (matchCanonical(normalized, SOURCE_ALIASES)) return 'source'
  if (matchCanonical(normalized, OWNER_ALIASES)) return 'owner'
  if (matchCanonical(normalized, COMPANY_ALIASES)) return 'company'
  if (matchCanonical(normalized, NAME_ALIASES)) return 'name'
  return null
}

/** If URL is a Google Sheet URL, return export CSV URL; else return as-is (published CSV). */
export function resolveCsvUrl(inputUrl: string): string {
  const u = (inputUrl || '').trim()
  const sheetIdMatch = u.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!sheetIdMatch) return u
  const sheetId = sheetIdMatch[1]
  const gidMatch = u.match(/gid=([0-9]+)/)
  const gid = gidMatch ? gidMatch[1] : '0'
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
}

/**
 * Fetch CSV from URL. 10s timeout. Throws if content-type is text/html or body contains "<html".
 */
export async function fetchCsv(url: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: { Accept: 'text/csv, text/plain, */*', 'User-Agent': 'ODCRM-LiveSheets/1.0' },
      signal: controller.signal,
    })
    clearTimeout(timeout)
    const contentType = (res.headers.get('content-type') || '').toLowerCase()
    if (contentType.includes('text/html')) {
      throw new Error('URL returned HTML instead of CSV')
    }
    const text = await res.text()
    if (text.trim().toLowerCase().includes('<html')) {
      throw new Error('URL returned HTML instead of CSV')
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    }
    return text
  } catch (e) {
    clearTimeout(timeout)
    if (e instanceof Error) throw e
    throw new Error(String(e))
  }
}

/**
 * Parse CSV: header row + data rows. Handles quoted values.
 */
export function parseCsv(text: string): string[][] {
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
    } else if (char === ',' && !inQuotes) {
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

/** Parse date string to ISO or null. Handles dd.mm.yy, dd/mm/yyyy, ISO. */
function parseOccurredAt(value: string | undefined): string | null {
  if (!value || !value.trim()) return null
  const t = value.trim()
  const ddmmyy = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/)
  if (ddmmyy) {
    const day = parseInt(ddmmyy[1], 10)
    const month = parseInt(ddmmyy[2], 10) - 1
    const y = parseInt(ddmmyy[3], 10)
    const year = y < 100 ? 2000 + y : y
    const d = new Date(year, month, day)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }
  const ddmmyyyy = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (ddmmyyyy) {
    const day = parseInt(ddmmyyyy[1], 10)
    const month = parseInt(ddmmyyyy[2], 10) - 1
    const year = parseInt(ddmmyyyy[3], 10)
    const d = new Date(year, month, day)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }
  const d = new Date(t)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

/**
 * Turn CSV rows into LiveLeadRow[]. Header row = first row; rest = data.
 * Canonical fields: occurredAt, source, owner, company, name; raw = all original keys.
 */
export function rowsToLiveLeads(rows: string[][]): LiveLeadRow[] {
  if (rows.length < 2) return []
  const headerRow = rows[0].map((h) => h.trim())
  const dataRows = rows.slice(1)
  const headersNormalized = headerRow.map(normalizeHeader)
  const result: LiveLeadRow[] = []

  for (const row of dataRows) {
    const raw: Record<string, string> = {}
    const canonical: Partial<LiveLeadRow> = {
      occurredAt: null,
      source: null,
      owner: null,
      company: null,
      name: null,
    }
    headerRow.forEach((h, i) => {
      const v = (row[i] ?? '').trim()
      if (h) raw[h] = v
      const norm = headersNormalized[i]
      if (!norm) return
      const key = canonicalKey(norm)
      if (key) {
        if (key === 'occurredAt') canonical.occurredAt = parseOccurredAt(v) || v || null
        else canonical[key] = v || null
      }
    })
    result.push({ ...canonical, raw } as LiveLeadRow)
  }
  return result
}

/** In-memory cache: key = customerId + '|' + url; value = { data, at, isFailure }. */
const cache = new Map<string, { data: LiveLeadRow[]; at: number; isFailure: boolean }>()

function cacheKey(customerId: string, url: string): string {
  return `${customerId}|${url}`
}

export function getCachedLeads(customerId: string, url: string): { data: LiveLeadRow[]; isFailure: boolean } | null {
  const key = cacheKey(customerId, url)
  const entry = cache.get(key)
  if (!entry) return null
  const ttl = entry.isFailure ? CACHE_TTL_FAILURE_MS : CACHE_TTL_SUCCESS_MS
  if (Date.now() - entry.at > ttl) {
    cache.delete(key)
    return null
  }
  return { data: entry.data, isFailure: entry.isFailure }
}

export function setCachedLeads(customerId: string, url: string, data: LiveLeadRow[], isFailure: boolean): void {
  cache.set(cacheKey(customerId, url), { data, at: Date.now(), isFailure })
}

/**
 * Fetch CSV from URL, parse, return live lead rows. Uses cache (30s success, 10s failure).
 */
export async function fetchAndParseLiveLeads(customerId: string, sheetUrl: string): Promise<LiveLeadRow[]> {
  const url = resolveCsvUrl(sheetUrl)
  const cached = getCachedLeads(customerId, url)
  if (cached !== null) {
    if (cached.isFailure) throw new Error('Failed to fetch or parse CSV')
    return cached.data
  }
  try {
    const text = await fetchCsv(url)
    const rows = parseCsv(text)
    const leads = rowsToLiveLeads(rows)
    setCachedLeads(customerId, url, leads, false)
    return leads
  } catch {
    setCachedLeads(customerId, url, [], true)
    throw new Error('Failed to fetch or parse CSV')
  }
}
