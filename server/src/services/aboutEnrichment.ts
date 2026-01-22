// About Section Enrichment Service
// Uses self-hosted LLM to enrich company About data from website scraping

import type { PrismaClient } from '@prisma/client'

export type EnrichmentResult = {
  whatTheyDo: string
  accreditations: string
  keyLeaders: string
  companyProfile: string
  recentNews: string
  companySize: string
  headquarters: string
  foundingYear: string
  socialPresence: Array<{ label: string; url: string }>
}

const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 10000) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'ODCRM Company Enrichment',
        ...(options.headers || {}),
      },
    })
    return response
  } finally {
    clearTimeout(timeout)
  }
}

const extractMeta = (html: string, key: string) => {
  const regex = new RegExp(`<meta[^>]+(?:name|property)=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i')
  const match = html.match(regex)
  return match?.[1]?.trim() || ''
}

const extractJsonLd = (html: string) => {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  const blocks = scripts.map((m) => m[1]).filter(Boolean)
  const parsed: any[] = []
  for (const block of blocks) {
    try {
      const data = JSON.parse(block)
      if (Array.isArray(data)) parsed.push(...data)
      else parsed.push(data)
    } catch {
      // ignore invalid JSON-LD
    }
  }
  return parsed
}

const pickOrganization = (items: any[]) => {
  const flat = items.flatMap((item) => (item?.['@graph'] ? item['@graph'] : item))
  return flat.find((item) => {
    const type = item?.['@type']
    return type === 'Organization' || type === 'Corporation' || type === 'LocalBusiness'
  })
}

const extractAccreditations = (html: string) => {
  const matches = [...html.matchAll(/\bISO\s?\d{3,5}\b/gi)].map((m) => m[0].toUpperCase())
  return Array.from(new Set(matches))
}

const SOCIAL_DOMAINS = [
  { label: 'LinkedIn', match: /linkedin\.com/i },
  { label: 'Facebook', match: /facebook\.com/i },
  { label: 'X', match: /twitter\.com|x\.com/i },
  { label: 'Instagram', match: /instagram\.com/i },
  { label: 'YouTube', match: /youtube\.com|youtu\.be/i },
  { label: 'TikTok', match: /tiktok\.com/i },
]

const absoluteUrl = (base: string, link: string) => {
  try {
    return new URL(link, base).toString()
  } catch {
    return null
  }
}

const validateUrl = async (url: string) => {
  try {
    const res = await fetchWithTimeout(url, { method: 'HEAD' }, 6000)
    if (res.ok) return true
  } catch {
    // ignore
  }
  return false
}

const normalizeDomain = (value: string) => {
  if (!value) return ''
  try {
    const withScheme = value.startsWith('http') ? value : `https://${value}`
    const host = new URL(withScheme).hostname
    return host.replace(/^www\./, '').toLowerCase()
  } catch {
    return value.replace(/^https?:\/\//, '').replace(/^www\./, '').toLowerCase()
  }
}

const fetchOpenCorporates = async (name?: string) => {
  if (!name) return null
  const url = `https://api.opencorporates.com/v0.4/companies/search?q=${encodeURIComponent(name)}`
  const response = await fetchWithTimeout(url, { method: 'GET' }, 12000)
  if (!response.ok) return null
  const json = (await response.json()) as {
    results?: {
      companies?: Array<{ company?: Record<string, unknown> }>
    }
  }
  const first = json?.results?.companies?.[0]?.company
  if (!first) return null
  return {
    name: first.name as string,
    jurisdiction: first.jurisdiction_code as string,
    companyNumber: first.company_number as string,
    incorporationDate: first.incorporation_date as string,
    registeredAddress: first.registered_address_in_full as string,
  }
}

const formatKeyLeaders = (org: any) => {
  const founders = Array.isArray(org?.founder) ? org.founder : org?.founder ? [org.founder] : []
  const leaders = founders
    .map((f: any) => f?.name || f)
    .filter(Boolean)
  return leaders.join(', ')
}

const buildCompanyProfile = (companySize: string, headquarters: string, foundingYear: string) => {
  const parts: string[] = []
  if (headquarters) parts.push(`Headquarters: ${headquarters}`)
  if (foundingYear) parts.push(`Founded: ${foundingYear}`)
  if (companySize) parts.push(`Company size: ${companySize}`)
  return parts.length ? `${parts.join('. ')}.` : ''
}

/**
 * Calls self-hosted LLM endpoint to enrich company data
 */
async function callSelfHostedLLM(
  companyName: string,
  website: string,
  scrapedData: {
    description: string
    html: string
    jsonLd: any[]
  },
  publicData?: {
    incorporationDate?: string
    registeredAddress?: string
  }
): Promise<EnrichmentResult | null> {
  const llmEndpoint = process.env.SELF_HOSTED_LLM_ENDPOINT
  if (!llmEndpoint) {
    console.warn('SELF_HOSTED_LLM_ENDPOINT not configured, using fallback scraping only')
    return null
  }

  try {
    // Extract key information from HTML for context
    const org = pickOrganization(scrapedData.jsonLd) || {}
    const contextText = `
Company Name: ${companyName}
Website: ${website}
Description: ${scrapedData.description}
Founded: ${org.foundingDate || 'Unknown'}
Headquarters: ${org.address ? JSON.stringify(org.address) : 'Unknown'}
Employees: ${org.numberOfEmployees || 'Unknown'}
OpenCorporates incorporation date: ${publicData?.incorporationDate || 'Unknown'}
OpenCorporates registered address: ${publicData?.registeredAddress || 'Unknown'}
`.trim()

    // Prepare prompt for LLM
    const prompt = `Extract and structure the following company information from the provided context. Return a JSON object with these exact fields:
{
  "whatTheyDo": "A concise description of what the company does (2-3 sentences)",
  "accreditations": "Comma-separated list of certifications, accreditations, or standards (e.g., ISO 9001, ISO 14001)",
  "keyLeaders": "Comma-separated list of founders or key leaders if known",
  "companyProfile": "Single sentence combining size, headquarters, and founding year",
  "recentNews": "1-2 short bullet-like sentences about recent news or initiatives",
  "companySize": "Company size in format like '50-200 employees' or '1,000+ employees'",
  "headquarters": "City, Country format (e.g., 'London, United Kingdom')",
  "foundingYear": "Year founded (4 digits, e.g., '2004')"
}

Context:
${contextText}

Return only valid JSON, no additional text.`

    const response = await fetchWithTimeout(
      llmEndpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          max_tokens: 500,
          temperature: 0.3,
        }),
      },
      30000
    )

    if (!response.ok) {
      console.error(`LLM endpoint returned ${response.status}`)
      return null
    }

    const data = (await response.json()) as Record<string, unknown>
    // Handle different LLM response formats
    const text = (data.text as string) || (data.response as string) || (data.content as string) || JSON.stringify(data)
    let parsed: any
    try {
      // Try to extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
      } else {
        parsed = JSON.parse(text)
      }
    } catch {
      console.error('Failed to parse LLM response as JSON')
      return null
    }

    // Extract social media links from HTML
    const linkMatches = [...scrapedData.html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1])
    const socialCandidates = linkMatches.map((href) => absoluteUrl(website, href)).filter(Boolean) as string[]
    const socialMediaRaw = SOCIAL_DOMAINS.map((provider) => {
      const match = socialCandidates.find((url) => provider.match.test(url))
      return match ? { label: provider.label, url: match } : null
    }).filter(Boolean) as Array<{ label: string; url: string }>

    const socialPresence: Array<{ label: string; url: string }> = []
    for (const profile of socialMediaRaw) {
      if (await validateUrl(profile.url)) {
        socialPresence.push(profile)
      }
    }

    return {
      whatTheyDo: parsed.whatTheyDo || scrapedData.description || '',
      accreditations: parsed.accreditations || '',
      keyLeaders: parsed.keyLeaders || formatKeyLeaders(org) || '',
      companyProfile: parsed.companyProfile || '',
      recentNews: parsed.recentNews || '',
      companySize: parsed.companySize || '',
      headquarters: parsed.headquarters || '',
      foundingYear: parsed.foundingYear || '',
      socialPresence,
    }
  } catch (error) {
    console.error('Error calling self-hosted LLM:', error)
    return null
  }
}

/**
 * Fallback enrichment using website scraping only (when LLM is not available)
 */
function fallbackEnrichment(
  companyName: string,
  website: string,
  html: string,
  jsonLd: any[],
  publicData?: {
    incorporationDate?: string
    registeredAddress?: string
  }
): EnrichmentResult {
  const org = pickOrganization(jsonLd) || {}
  const description = extractMeta(html, 'description') || extractMeta(html, 'og:description') || ''
  const accreditations = extractAccreditations(html).join(', ')

  const foundingYear = org.foundingDate
    ? String(org.foundingDate).slice(0, 4)
    : publicData?.incorporationDate
      ? String(publicData.incorporationDate).slice(0, 4)
      : ''
  const address = org.address || {}
  const headquartersParts = [address.addressLocality, address.addressRegion, address.addressCountry]
    .filter(Boolean)
    .map((part: string) => part.trim())
  const headquarters = headquartersParts.join(', ') || publicData?.registeredAddress || ''

  const companySize = (() => {
    if (org.numberOfEmployees) {
      if (typeof org.numberOfEmployees === 'string') return org.numberOfEmployees
      if (org.numberOfEmployees.value) return String(org.numberOfEmployees.value)
    }
    return ''
  })()

  // Extract social media (basic extraction, validation happens in caller)
  const linkMatches = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1])
  const socialCandidates = linkMatches.map((href) => absoluteUrl(website, href)).filter(Boolean) as string[]
  const socialPresenceRaw = SOCIAL_DOMAINS.map((provider) => {
    const match = socialCandidates.find((url) => provider.match.test(url))
    return match ? { label: provider.label, url: match } : null
  }).filter(Boolean) as Array<{ label: string; url: string }>

  return {
    whatTheyDo: description || '',
    accreditations,
    keyLeaders: formatKeyLeaders(org),
    companyProfile: buildCompanyProfile(companySize, headquarters, foundingYear),
    recentNews: '',
    companySize,
    headquarters,
    foundingYear,
    socialPresence: socialPresenceRaw,
  }
}

/**
 * Enriches company About data from website
 */
export async function enrichCompanyAbout(
  prisma: PrismaClient,
  customerId: string,
  companyName: string,
  website: string
): Promise<EnrichmentResult | null> {
  if (!website) {
    console.warn(`No website provided for customer ${customerId}`)
    return null
  }

  try {
    // Normalize website URL
    const normalizedWebsite = website.startsWith('http') ? website : `https://${website}`
    
    // Fetch website HTML
    const response = await fetchWithTimeout(normalizedWebsite, { method: 'GET' }, 12000)
    if (!response.ok) {
      console.warn(`Failed to fetch website ${normalizedWebsite}: ${response.status}`)
      return null
    }

    const html = await response.text()
    const description = extractMeta(html, 'description') || extractMeta(html, 'og:description') || ''
    const jsonLd = extractJsonLd(html)
    const openCorporates = await fetchOpenCorporates(companyName)
    const publicData = {
      incorporationDate: openCorporates?.incorporationDate,
      registeredAddress: openCorporates?.registeredAddress,
    }

    // Try LLM enrichment first
    let result = await callSelfHostedLLM(companyName, normalizedWebsite, { description, html, jsonLd }, publicData)

    // Fallback to scraping-only if LLM fails
    if (!result) {
      result = fallbackEnrichment(companyName, normalizedWebsite, html, jsonLd, publicData)
    }

    // Validate social media URLs
    const validatedSocial: Array<{ label: string; url: string }> = []
    for (const profile of result.socialPresence) {
      if (await validateUrl(profile.url)) {
        validatedSocial.push(profile)
      }
    }
    result.socialPresence = validatedSocial

    // Save to database
    // Note: website field may not exist in schema yet, use domain as fallback
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        website: normalizedWebsite,
        whatTheyDo: result.whatTheyDo,
        accreditations: result.accreditations,
        keyLeaders: result.keyLeaders,
        companyProfile: result.companyProfile,
        recentNews: result.recentNews,
        companySize: result.companySize,
        headquarters: result.headquarters,
        foundingYear: result.foundingYear,
        socialPresence: result.socialPresence.length > 0 ? result.socialPresence : null,
        lastEnrichedAt: new Date(),
        domain: normalizeDomain(normalizedWebsite),
      } as any, // Type assertion needed until Prisma client is regenerated
    })

    return result
  } catch (error) {
    console.error(`Error enriching company About for ${customerId}:`, error)
    return null
  }
}
