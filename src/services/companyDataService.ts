// Company Data Service - Fetches verified company information from the web (no AI)
// Uses the backend lookup endpoint to avoid browser CORS issues.

export type CompanyData = {
  sector: string
  whatTheyDo: string
  accreditations: string
  keyLeaders: string
  companySize: string
  headquarters: string
  foundingYear: string
  recentNews: string
  socialMedia: Array<{ label: string; url: string }>
  logoUrl?: string | null
  source?: 'opencorporates' | 'web'
  verified?: boolean
}

export async function fetchCompanyData(companyName: string, website?: string): Promise<CompanyData | null> {
  if (!website) return null
  const { api } = await import('../utils/api')
  const response = await api.post<CompanyData>('/api/company-data/lookup', {
    name: companyName,
    website,
  })
  if (response.error) return null
  return response.data ?? null
}

/**
 * Refreshes company data by performing a new web search
 * This function would integrate with a web search API in production
 */
export async function refreshCompanyData(companyName: string, website?: string): Promise<CompanyData | null> {
  return fetchCompanyData(companyName, website)
}

/**
 * Gets all available company names in the database
 */
export function getAvailableCompanyNames(): string[] {
  return []
}

