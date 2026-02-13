import { fetchJsonWithTimeout, sanitizeText } from './utils.js'

const BASE_URL = 'https://api.company-information.service.gov.uk'

type CompaniesHouseSearchResponse = {
  items?: Array<{
    company_number?: string
    title?: string
    company_status?: string
    address?: Record<string, unknown>
    address_snippet?: string
    date_of_creation?: string
  }>
}

type CompaniesHouseCompanyProfile = {
  company_name?: string
  company_number?: string
  company_status?: string
  date_of_creation?: string
  registered_office_address?: {
    address_line_1?: string
    address_line_2?: string
    locality?: string
    postal_code?: string
    region?: string
    country?: string
  }
  sic_codes?: string[]
}

function buildAuthHeaders(apiKey: string): Record<string, string> {
  const token = Buffer.from(`${apiKey}:`).toString('base64')
  return { Authorization: `Basic ${token}` }
}

function formatRegisteredAddress(addr?: CompaniesHouseCompanyProfile['registered_office_address']): string {
  if (!addr) return ''
  const parts = [
    addr.address_line_1,
    addr.address_line_2,
    addr.locality,
    addr.region,
    addr.postal_code,
    addr.country,
  ]
    .map((p) => String(p || '').trim())
    .filter(Boolean)
  return parts.join(', ')
}

export async function companiesHouseLookup(options: {
  apiKey: string
  timeoutMs: number
  companyNumber?: string
  companyName?: string
}): Promise<{
  sourcesData: Record<string, unknown>
  draft: {
    registeredName?: string
    companyNumber?: string
    registeredAddress?: string
    sicCodes?: string[]
    foundingYear?: string
  }
} | null> {
  const { apiKey, timeoutMs } = options
  if (!apiKey) return null

  const started = Date.now()
  const remaining = () => Math.max(0, timeoutMs - (Date.now() - started))

  const headers = buildAuthHeaders(apiKey)

  let companyNumber = String(options.companyNumber || '').trim()
  const companyName = String(options.companyName || '').trim()

  // Search by name if we don't have company number
  if (!companyNumber && companyName) {
    const searchUrl = `${BASE_URL}/search/companies?q=${encodeURIComponent(companyName)}`
    const searchTimeout = Math.max(1500, Math.min(4500, remaining()))
    const search = await fetchJsonWithTimeout<CompaniesHouseSearchResponse>(searchUrl, searchTimeout, { headers })
    if (search.ok && search.json?.items?.length) {
      companyNumber = String(search.json.items[0]?.company_number || '').trim()
    }
  }

  if (!companyNumber) return null

  const profileUrl = `${BASE_URL}/company/${encodeURIComponent(companyNumber)}`
  const profileTimeout = Math.max(1500, Math.min(4500, remaining()))
  const profile = await fetchJsonWithTimeout<CompaniesHouseCompanyProfile>(profileUrl, profileTimeout, { headers })
  if (!profile.ok || !profile.json) return null

  const registeredName = sanitizeText(profile.json.company_name, 200)
  const registeredAddress = sanitizeText(formatRegisteredAddress(profile.json.registered_office_address), 500)
  const sicCodes = Array.isArray(profile.json.sic_codes)
    ? profile.json.sic_codes.map((s) => String(s).trim()).filter(Boolean)
    : []
  const foundingYear = profile.json.date_of_creation ? String(profile.json.date_of_creation).slice(0, 4) : ''

  return {
    sourcesData: {
      provider: 'companies_house',
      company_status: profile.json.company_status || null,
      company_number: profile.json.company_number || companyNumber,
      company_name: profile.json.company_name || null,
      date_of_creation: profile.json.date_of_creation || null,
      sic_codes: sicCodes,
      registered_office_address: profile.json.registered_office_address || null,
    },
    draft: {
      registeredName: registeredName || undefined,
      companyNumber: (profile.json.company_number || companyNumber) || undefined,
      registeredAddress: registeredAddress || undefined,
      sicCodes: sicCodes.length ? sicCodes : undefined,
      foundingYear: foundingYear || undefined,
    },
  }
}

