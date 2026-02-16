import { fetchJsonWithTimeout, sanitizeText } from '../utils.js'
import type { NormalizedCompanyData, SourceResult } from '../types.js'

const BASE_URL = 'https://api.company-information.service.gov.uk'

type CompaniesHouseSearchResponse = {
  items?: Array<{
    company_number?: string
    title?: string
    company_status?: string
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
  // Companies House uses Basic Auth with the API key as the username and blank password.
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

// Lightweight 2-digit SIC grouping labels for readability (keeps diffs small).
// This is used to render e.g. "SIC 68100 - Real estate activities".
const SIC_2DIGIT_LABEL: Record<string, string> = {
  '01': 'Crop and animal production, hunting and related service activities',
  '02': 'Forestry and logging',
  '03': 'Fishing and aquaculture',
  '05': 'Mining of coal and lignite',
  '06': 'Extraction of crude petroleum and natural gas',
  '07': 'Mining of metal ores',
  '08': 'Other mining and quarrying',
  '09': 'Mining support service activities',
  '10': 'Manufacture of food products',
  '11': 'Manufacture of beverages',
  '12': 'Manufacture of tobacco products',
  '13': 'Manufacture of textiles',
  '14': 'Manufacture of wearing apparel',
  '15': 'Manufacture of leather and related products',
  '16': 'Manufacture of wood and of products of wood and cork',
  '17': 'Manufacture of paper and paper products',
  '18': 'Printing and reproduction of recorded media',
  '19': 'Manufacture of coke and refined petroleum products',
  '20': 'Manufacture of chemicals and chemical products',
  '21': 'Manufacture of basic pharmaceutical products and pharmaceutical preparations',
  '22': 'Manufacture of rubber and plastic products',
  '23': 'Manufacture of other non-metallic mineral products',
  '24': 'Manufacture of basic metals',
  '25': 'Manufacture of fabricated metal products',
  '26': 'Manufacture of computer, electronic and optical products',
  '27': 'Manufacture of electrical equipment',
  '28': 'Manufacture of machinery and equipment n.e.c.',
  '29': 'Manufacture of motor vehicles, trailers and semi-trailers',
  '30': 'Manufacture of other transport equipment',
  '31': 'Manufacture of furniture',
  '32': 'Other manufacturing',
  '33': 'Repair and installation of machinery and equipment',
  '35': 'Electricity, gas, steam and air conditioning supply',
  '36': 'Water collection, treatment and supply',
  '37': 'Sewerage',
  '38': 'Waste collection, treatment and disposal activities',
  '39': 'Remediation activities and other waste management services',
  '41': 'Construction of buildings',
  '42': 'Civil engineering',
  '43': 'Specialised construction activities',
  '45': 'Wholesale and retail trade and repair of motor vehicles and motorcycles',
  '46': 'Wholesale trade, except of motor vehicles and motorcycles',
  '47': 'Retail trade, except of motor vehicles and motorcycles',
  '49': 'Land transport and transport via pipelines',
  '50': 'Water transport',
  '51': 'Air transport',
  '52': 'Warehousing and support activities for transportation',
  '53': 'Postal and courier activities',
  '55': 'Accommodation',
  '56': 'Food and beverage service activities',
  '58': 'Publishing activities',
  '59': 'Motion picture, video and television programme production',
  '60': 'Programming and broadcasting activities',
  '61': 'Telecommunications',
  '62': 'Computer programming, consultancy and related activities',
  '63': 'Information service activities',
  '64': 'Financial service activities, except insurance and pension funding',
  '65': 'Insurance, reinsurance and pension funding',
  '66': 'Activities auxiliary to financial services and insurance activities',
  '68': 'Real estate activities',
  '69': 'Legal and accounting activities',
  '70': 'Activities of head offices; management consultancy activities',
  '71': 'Architectural and engineering activities; technical testing and analysis',
  '72': 'Scientific research and development',
  '73': 'Advertising and market research',
  '74': 'Other professional, scientific and technical activities',
  '75': 'Veterinary activities',
  '77': 'Rental and leasing activities',
  '78': 'Employment activities',
  '79': 'Travel agency, tour operator and other reservation service and related activities',
  '80': 'Security and investigation activities',
  '81': 'Services to buildings and landscape activities',
  '82': 'Office administrative, office support and other business support activities',
  '84': 'Public administration and defence; compulsory social security',
  '85': 'Education',
  '86': 'Human health activities',
  '87': 'Residential care activities',
  '88': 'Social work activities without accommodation',
  '90': 'Creative, arts and entertainment activities',
  '91': 'Libraries, archives, museums and other cultural activities',
  '92': 'Gambling and betting activities',
  '93': 'Sports activities and amusement and recreation activities',
  '94': 'Activities of membership organisations',
  '95': 'Repair of computers and personal and household goods',
  '96': 'Other personal service activities',
}

function formatSicReadable(code: string): string {
  const raw = String(code || '').trim()
  if (!raw) return ''
  const two = raw.slice(0, 2)
  const label = SIC_2DIGIT_LABEL[two]
  return label ? `SIC ${raw} - ${label}` : `SIC ${raw}`
}

function chooseBestCompany(items: CompaniesHouseSearchResponse['items'], queryName: string) {
  const q = String(queryName || '').trim().toLowerCase()
  const candidates = Array.isArray(items) ? items : []
  if (!candidates.length) return null

  const score = (it: any) => {
    const status = String(it?.company_status || '').toLowerCase()
    const title = String(it?.title || '').trim()
    const titleKey = title.toLowerCase()
    let s = 0
    if (status === 'active') s += 10
    if (q && titleKey === q) s += 8
    if (q && titleKey.includes(q)) s += 3
    if (title.length > 3) s += 1
    return s
  }

  const sorted = [...candidates].sort((a, b) => score(b) - score(a))
  return sorted[0] || null
}

export async function companiesHouseProvider(options: {
  companyName: string
  timeoutMs: number
  apiKey?: string
}): Promise<SourceResult> {
  const apiKey = String(options.apiKey || '').trim()
  const companyName = String(options.companyName || '').trim()
  const started = Date.now()
  const remaining = () => Math.max(0, options.timeoutMs - (Date.now() - started))

  if (!apiKey) {
    return {
      provider: 'companies_house',
      ok: false,
      confidence: 0,
      evidence: [],
      data: {},
      error: 'missing key',
    }
  }
  if (!companyName) {
    return {
      provider: 'companies_house',
      ok: false,
      confidence: 0,
      evidence: [],
      data: {},
      error: 'missing company name',
    }
  }

  try {
    const headers = buildAuthHeaders(apiKey)
    const searchUrl = `${BASE_URL}/search/companies?q=${encodeURIComponent(companyName)}`
    const searchTimeout = Math.max(1500, Math.min(4500, remaining()))
    const search = await fetchJsonWithTimeout<CompaniesHouseSearchResponse>(searchUrl, searchTimeout, { headers })
    const best = chooseBestCompany(search.json?.items, companyName)
    const companyNumber = String(best?.company_number || '').trim()
    if (!companyNumber) {
      return {
        provider: 'companies_house',
        ok: false,
        confidence: 0,
        evidence: [searchUrl],
        data: {},
        error: 'no company match',
      }
    }

    const profileUrl = `${BASE_URL}/company/${encodeURIComponent(companyNumber)}`
    const profileTimeout = Math.max(1500, Math.min(4500, remaining()))
    const profile = await fetchJsonWithTimeout<CompaniesHouseCompanyProfile>(profileUrl, profileTimeout, { headers })
    if (!profile.ok || !profile.json) {
      return {
        provider: 'companies_house',
        ok: false,
        confidence: 0,
        evidence: [searchUrl, profileUrl],
        data: {},
        error: `profile_fetch_failed_${profile.status}`,
      }
    }

    const registeredAddress = sanitizeText(formatRegisteredAddress(profile.json.registered_office_address), 500)
    const sicCodes = Array.isArray(profile.json.sic_codes)
      ? profile.json.sic_codes.map((s) => String(s).trim()).filter(Boolean)
      : []
    const sector = sicCodes.map(formatSicReadable).filter(Boolean).join(', ')
    const created = String(profile.json.date_of_creation || '').trim()

    const publicProfileUrl = `https://find-and-update.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}`

    const data: Partial<NormalizedCompanyData> = {
      companyName: sanitizeText(profile.json.company_name || best?.title || '', 200) || undefined,
      headOfficeAddress: registeredAddress || undefined,
      sector: sector || undefined,
      companyProfile:
        companyNumber || created
          ? sanitizeText(
              `Companies House: ${companyNumber}${created ? ` (incorporated ${created})` : ''}.`,
              400,
            )
          : undefined,
    }

    return {
      provider: 'companies_house',
      ok: Boolean(data.headOfficeAddress || data.sector || data.companyProfile || data.companyName),
      confidence: data.headOfficeAddress || data.sector ? 0.9 : 0.6,
      evidence: [publicProfileUrl, profileUrl],
      data,
    }
  } catch (e) {
    return {
      provider: 'companies_house',
      ok: false,
      confidence: 0,
      evidence: [],
      data: {},
      error: e instanceof Error ? e.message : 'companies_house_failed',
    }
  }
}

