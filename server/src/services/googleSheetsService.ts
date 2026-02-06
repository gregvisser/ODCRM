/**
 * Google Sheets Service
 * 
 * Uses a service account to read data from Google Sheets.
 * Requires GOOGLE_SERVICE_ACCOUNT_JSON or (GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY) env vars.
 */

import { google, sheets_v4 } from 'googleapis'

// Parsed service account credentials
interface ServiceAccountCredentials {
  client_email: string
  private_key: string
}

export type GoogleAuthMethod = 'json' | 'split' | 'none'

export interface GoogleCredentialsDiagnostics {
  credentialsConfigured: boolean
  authMethodUsed: GoogleAuthMethod
  serviceAccountEmail: string | null
  lastAuthError: string | null
}

/**
 * Get service account credentials from environment variables
 */
function getCredentials(): ServiceAccountCredentials {
  // Option 1: Full JSON in GOOGLE_SERVICE_ACCOUNT_JSON
  const jsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr)
      return {
        client_email: parsed.client_email,
        private_key: parsed.private_key,
      }
    } catch {
      throw new Error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON')
    }
  }

  // Option 2: Separate fields
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL
  const privateKey = process.env.GOOGLE_PRIVATE_KEY

  if (!clientEmail || !privateKey) {
    throw new Error(
      'Missing Google credentials. Set GOOGLE_SERVICE_ACCOUNT_JSON or (GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY)'
    )
  }

  return {
    client_email: clientEmail,
    // Private key may have escaped newlines
    private_key: privateKey.replace(/\\n/g, '\n'),
  }
}

/**
 * Create authenticated Google Sheets client
 */
function getSheetsClient(): sheets_v4.Sheets {
  const credentials = getCredentials()

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })

  return google.sheets({ version: 'v4', auth })
}

/**
 * Parse a Google Sheets URL to extract spreadsheet ID and optional gid
 * 
 * Examples:
 * - https://docs.google.com/spreadsheets/d/1dh8aMhjLCuXSvrcUQhi6lPxlacmdHVVMoLDfEHMUeSU/edit?gid=0#gid=0
 * - https://docs.google.com/spreadsheets/d/1dh8aMhjLCuXSvrcUQhi6lPxlacmdHVVMoLDfEHMUeSU/edit
 */
export function parseSheetUrl(url: string): { sheetId: string; gid: string | null } {
  // Match spreadsheet ID from URL
  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!idMatch) {
    throw new Error('Invalid Google Sheets URL - could not find spreadsheet ID')
  }

  const sheetId = idMatch[1]

  // Try to extract gid from URL
  const gidMatch = url.match(/[?&#]gid=(\d+)/)
  const gid = gidMatch ? gidMatch[1] : null

  return { sheetId, gid }
}

/**
 * Result of reading a sheet
 */
export interface SheetData {
  headers: string[]
  rows: Record<string, string>[]
  rawRows: string[][]
  sheetTitle: string
}

/**
 * Read data from a Google Sheet
 */
export async function readSheet(
  sheetId: string,
  gid?: string | null
): Promise<SheetData> {
  const sheets = getSheetsClient()

  // First, get spreadsheet info to find sheet name from gid
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: sheetId,
    includeGridData: false,
  })

  const sheetsList = spreadsheet.data.sheets || []
  
  // Find the target sheet
  let targetSheet = sheetsList[0] // Default to first sheet
  if (gid) {
    const gidNum = parseInt(gid, 10)
    const found = sheetsList.find(s => s.properties?.sheetId === gidNum)
    if (found) {
      targetSheet = found
    }
  }

  const sheetTitle = targetSheet?.properties?.title || 'Sheet1'

  // Read all values from the sheet
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${sheetTitle}'`,
  })

  const rawRows = (response.data.values || []) as string[][]
  
  if (rawRows.length === 0) {
    return {
      headers: [],
      rows: [],
      rawRows: [],
      sheetTitle,
    }
  }

  // First row is headers
  const headers = rawRows[0].map(h => normalizeHeader(h))
  
  // Convert remaining rows to objects
  const rows = rawRows.slice(1).map(row => {
    const obj: Record<string, string> = {}
    headers.forEach((header, idx) => {
      obj[header] = row[idx] || ''
    })
    return obj
  })

  return {
    headers,
    rows,
    rawRows,
    sheetTitle,
  }
}

/**
 * Normalize header names for consistent field matching
 */
function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

/**
 * Common field mappings - maps normalized header names to our contact fields
 */
const FIELD_MAPPINGS: Record<string, string[]> = {
  email: ['email', 'email_address', 'work_email', 'contact_email', 'e_mail'],
  firstName: ['first_name', 'firstname', 'given_name', 'first'],
  lastName: ['last_name', 'lastname', 'surname', 'family_name', 'last'],
  companyName: ['company', 'company_name', 'organization', 'org', 'employer', 'account_name'],
  jobTitle: ['job_title', 'title', 'position', 'role', 'jobtitle'],
  phone: ['phone', 'phone_number', 'mobile', 'cell', 'telephone', 'work_phone', 'direct_phone'],
  linkedinUrl: ['linkedin', 'linkedin_url', 'linkedin_profile', 'person_linkedin_url'],
  website: ['website', 'url', 'company_website', 'domain'],
  location: ['location', 'city', 'state', 'country', 'address', 'person_city'],
}

/**
 * Find the best field mapping for a set of headers
 */
export function findFieldMappings(headers: string[]): Record<string, string | null> {
  const mappings: Record<string, string | null> = {}

  for (const [field, aliases] of Object.entries(FIELD_MAPPINGS)) {
    const found = headers.find(h => aliases.includes(h))
    mappings[field] = found || null
  }

  return mappings
}

/**
 * Extracted contact data - all fields are nullable.
 * Defaults (e.g., "Unknown") should NOT be applied here.
 * Apply defaults only at CREATE time in the route handler.
 */
export interface ExtractedContact {
  email: string | null
  firstName: string | null
  lastName: string | null
  companyName: string | null
  jobTitle: string | null
  phone: string | null
  linkedinUrl: string | null
  website: string | null
  location: string | null
}

/**
 * Extract contact data from a row using field mappings.
 * Returns null for any field that is not mapped or has an empty/blank value.
 * NO DEFAULTS are applied here - this prevents overwriting existing data during updates.
 */
export function extractContactFromRow(
  row: Record<string, string>,
  mappings: Record<string, string | null>
): ExtractedContact {
  const getValue = (field: string): string | null => {
    const header = mappings[field]
    if (!header) return null
    const value = row[header]?.trim()
    // Return null for empty/blank values - do NOT use defaults
    return value && value.length > 0 ? value : null
  }

  return {
    email: getValue('email'),
    firstName: getValue('firstName'),
    lastName: getValue('lastName'),
    companyName: getValue('companyName'),
    jobTitle: getValue('jobTitle'),
    phone: getValue('phone'),
    linkedinUrl: getValue('linkedinUrl'),
    website: getValue('website'),
    location: getValue('location'),
  }
}

/**
 * Helper: Check if a value is a non-empty string after trimming
 */
export function hasValue(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

/**
 * Validate that required Google Sheets credentials are configured
 */
export function validateCredentials(): { valid: boolean; error?: string } {
  try {
    getCredentials()
    return { valid: true }
  } catch (err: any) {
    return { valid: false, error: err.message }
  }
}

/**
 * Diagnostics for credential setup (safe to expose).
 * Does NOT return or log secrets.
 */
export function getCredentialDiagnostics(): GoogleCredentialsDiagnostics {
  const jsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL
  const privateKey = process.env.GOOGLE_PRIVATE_KEY

  let authMethodUsed: GoogleAuthMethod = 'none'
  let serviceAccountEmail: string | null = null
  let lastAuthError: string | null = null

  try {
    if (jsonStr) {
      authMethodUsed = 'json'
      const parsed = JSON.parse(jsonStr)
      serviceAccountEmail = typeof parsed.client_email === 'string' ? parsed.client_email : null
      if (!parsed.client_email || !parsed.private_key) {
        throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is missing client_email or private_key')
      }
    } else if (clientEmail || privateKey) {
      authMethodUsed = 'split'
      if (!clientEmail || !privateKey) {
        throw new Error('Missing GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY')
      }
      serviceAccountEmail = clientEmail
    } else {
      authMethodUsed = 'none'
      lastAuthError =
        'Missing Google credentials. Set GOOGLE_SERVICE_ACCOUNT_JSON or (GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY)'
    }
  } catch (err: any) {
    lastAuthError = err.message
  }

  return {
    credentialsConfigured: !lastAuthError,
    authMethodUsed,
    serviceAccountEmail,
    lastAuthError,
  }
}
