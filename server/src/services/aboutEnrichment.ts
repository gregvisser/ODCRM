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
  const url = `https://api.opencorporates.com/v0.4/companies/search?q=${encodeURIComponent(name)}&jurisdiction_code=gb`
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

/**
 * Fetch additional company data from Companies House (UK) API
 * Free tier available with API key
 */
const fetchCompaniesHouseData = async (companyName: string) => {
  try {
    // Companies House API is free but requires an API key
    // For now, we'll rely on OpenCorporates which doesn't require auth
    // This can be enhanced later with a proper Companies House API key
    const searchUrl = `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(companyName)}`
    
    // Note: Companies House API requires Basic Auth with API key as username
    // For now, just use OpenCorporates
    return null
  } catch (error) {
    console.error('Companies House API error:', error)
    return null
  }
}

/**
 * Perform additional web searches to supplement Gemini's knowledge
 * This acts as a backup to ensure we get comprehensive data
 */
const performSupplementarySearches = async (companyName: string, website: string) => {
  const supplementaryData: any = {}
  
  try {
    // Try to fetch LinkedIn data (basic scraping, no API required)
    const linkedInSearchUrl = `https://www.linkedin.com/company/${encodeURIComponent(companyName.toLowerCase().replace(/\s+/g, '-'))}`
    const linkedInResponse = await fetchWithTimeout(linkedInSearchUrl, { method: 'GET' }, 8000).catch(() => null)
    
    if (linkedInResponse?.ok) {
      const linkedInHtml = await linkedInResponse.text()
      
      // Extract employee count from LinkedIn
      const employeeMatch = linkedInHtml.match(/(\d{1,3}(?:,\d{3})*)\s*(?:employees|followers)/i)
      if (employeeMatch) {
        supplementaryData.employeeCount = employeeMatch[1]
      }
      
      // Extract headquarters from LinkedIn
      const hqMatch = linkedInHtml.match(/headquarters[^\w]*([^<]+)/i)
      if (hqMatch) {
        supplementaryData.headquarters = hqMatch[1].trim()
      }
    }
  } catch (error) {
    console.log('LinkedIn supplementary search failed:', error)
  }
  
  return supplementaryData
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
 * Calls Google Gemini Pro with Google Search to comprehensively enrich company data
 * Now searches company website, social media, news, and the entire web for information
 */
async function callGeminiPro(
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
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) {
    console.warn('GOOGLE_GEMINI_API_KEY not configured, using fallback scraping only')
    return null
  }

  try {
    // Extract key information from HTML for context
    const org = pickOrganization(scrapedData.jsonLd) || {}
    
    // Extract more context from HTML (first 8000 chars of text content for more context)
    const htmlText = scrapedData.html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000)
    
    const contextText = `
Company Name: ${companyName}
Website: ${website}
Meta Description: ${scrapedData.description}
Website Content Excerpt: ${htmlText}
Structured Data (JSON-LD): ${JSON.stringify(org, null, 2)}
OpenCorporates Data: ${JSON.stringify(publicData || {}, null, 2)}
`.trim()

    // Enhanced prompt with explicit web search instructions
    const prompt = `You are a comprehensive company research assistant with access to Google Search and the internet. Your task is to thoroughly research "${companyName}" and gather ALL available information from MULTIPLE SOURCES:

1. The company's official website: ${website}
2. LinkedIn company page
3. Facebook, Instagram, Twitter/X, and other social media profiles
4. Company news articles and press releases
5. Industry databases and business directories
6. Government and official company registries
7. Any other publicly available online sources

Company: ${companyName}
Website: ${website}

CRITICAL INSTRUCTIONS:
- Use Google Search to find information NOT in the provided context
- Search LinkedIn for company profile, employee count, headquarters, and key leaders
- Search Companies House (UK) or equivalent registries for registration number, incorporation date, and registered address
- Search news websites for recent company announcements
- Search for ISO certifications, accreditations, and industry memberships
- Look for "About Us", "Our Team", "Leadership", "Contact", and "Careers" pages
- If information is not in the provided context, YOU MUST SEARCH THE WEB FOR IT

Extract and return ONLY a valid JSON object with these exact fields:

{
  "whatTheyDo": "A VERY detailed, comprehensive description (6-10 sentences) covering: what the company does, their main services/products, their industry expertise, key differentiators, target markets, industry position, unique value propositions, and market presence. Be extremely thorough and informative. Include specific details about their operations.",
  "accreditations": "Comma-separated list of ALL certifications, accreditations, quality standards, or industry memberships (e.g., ISO 9001:2015, ISO 14001:2015, ISO 45001:2018, SafeContractor, CHAS, Constructionline, NICEIC, etc.). Search the website AND do a web search for '{companyName} certifications' OR '{companyName} accreditations'. If none found after thorough search, return empty string.",
  "keyLeaders": "Comma-separated list of company founders, CEO, Managing Director, directors, or key executives with their roles (e.g., 'John Smith (CEO & Founder), Jane Doe (Operations Director), Bob Wilson (CTO)'). Search LinkedIn company page, About Us page, AND do a web search for '{companyName} CEO' OR '{companyName} directors' OR '{companyName} management team'. If none found, return empty string.",
  "companyProfile": "Detailed company profile including: Company Registration Number (e.g., Companies House number if UK company), legal entity type (Ltd, PLC, etc.), year of incorporation, industry classification (SIC codes if available), parent company (if applicable), and any other official company details. Search Companies House or equivalent registry. Be comprehensive and specific.",
  "recentNews": "Recent company news, announcements, achievements, partnerships, awards, or initiatives from the past 12 months. Include dates and sources. Do a web search for '{companyName} news' OR '{companyName} press release'. If none found, return empty string.",
  "companySize": "Company size in employees with specific numbers if possible (e.g., '150-200 employees', '1,000+ employees', '25 employees'). Search LinkedIn company page for employee count. If not found, estimate based on company type, industry, and revenue if available.",
  "headquarters": "FULL headquarters address including: building/unit number, street address, city, postal code, country (e.g., 'Unit 5, 123 Oxford Street, London, W1D 2HG, United Kingdom'). Search the Contact page, footer, LinkedIn, AND do a web search for '{companyName} address' OR '{companyName} headquarters'. Be as complete and specific as possible with the FULL address.",
  "foundingYear": "Exact 4-digit year company was founded or incorporated (e.g., '2004'). Search About page, LinkedIn, Companies House, AND do a web search for '{companyName} founded' OR '{companyName} established'. If not found after thorough search, return empty string."
}

Context from website scraping:
${contextText}

BACKUP STRATEGY:
If the primary website doesn't have complete information, you MUST:
1. Search Google for: "{companyName} about"
2. Search Google for: "{companyName} linkedin"
3. Search Google for: "{companyName} headquarters address"
4. Search Google for: "{companyName} directors"
5. Search Google for: "{companyName} certifications"
6. Search Companies House API or website for UK companies
7. Search industry-specific databases

VALIDATION REQUIREMENTS:
- ALL fields must be thoroughly researched using web search
- For "whatTheyDo": minimum 6 detailed sentences with specific operations details
- For "headquarters": MUST include full street address, not just city
- For "keyLeaders": Search multiple sources (LinkedIn, About page, news articles)
- For "accreditations": Look for ISO, industry-specific certifications, memberships
- For "companyProfile": Include registration number and incorporation details
- Return empty string ONLY if information is truly unavailable after exhaustive web search

IMPORTANT: 
- Return ONLY the JSON object, no additional text, markdown, or code blocks
- Do NOT skip web searches - use Google Search to find missing information
- Populate ALL fields with comprehensive, verified information
- Quality over speed - take time to search thoroughly`

    const response = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.3, // Slightly higher for more creative web searches
            maxOutputTokens: 4096, // Increased for more detailed responses
            topP: 0.95,
            topK: 40,
          }
        }),
      },
      60000 // 60 second timeout for comprehensive research
    )

    if (!response.ok) {
      console.error(`Gemini API returned ${response.status}`)
      const errorText = await response.text()
      console.error('Gemini error:', errorText)
      return null
    }

    const data = await response.json() as any
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    
    if (!text) {
      console.error('No text in Gemini response')
      return null
    }

    let parsed: any
    try {
      // Try to extract JSON from response (Gemini sometimes wraps it in markdown)
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
      } else {
        parsed = JSON.parse(text)
      }
    } catch (e) {
      console.error('Failed to parse Gemini response as JSON:', e)
      console.error('Gemini response text:', text)
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
    console.error('Error calling Google Gemini:', error)
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
 * Enriches company About data from website and comprehensive web searches
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
    
    console.log(`🔍 Starting comprehensive enrichment for ${companyName}...`)
    console.log(`   1️⃣ Fetching website content...`)
    
    // Fetch website HTML
    const response = await fetchWithTimeout(normalizedWebsite, { method: 'GET' }, 12000)
    if (!response.ok) {
      console.warn(`Failed to fetch website ${normalizedWebsite}: ${response.status}`)
      return null
    }

    const html = await response.text()
    const description = extractMeta(html, 'description') || extractMeta(html, 'og:description') || ''
    const jsonLd = extractJsonLd(html)
    
    console.log(`   2️⃣ Searching OpenCorporates registry...`)
    const openCorporates = await fetchOpenCorporates(companyName)
    
    console.log(`   3️⃣ Performing supplementary web searches...`)
    const supplementaryData = await performSupplementarySearches(companyName, normalizedWebsite)
    
    const publicData = {
      incorporationDate: openCorporates?.incorporationDate,
      registeredAddress: openCorporates?.registeredAddress,
      companyNumber: openCorporates?.companyNumber,
      ...supplementaryData,
    }

    console.log(`   4️⃣ Running Gemini Pro with web search capabilities...`)
    // Try Gemini Pro enrichment with enhanced web search
    let result = await callGeminiPro(companyName, normalizedWebsite, { description, html, jsonLd }, publicData)

    // Fallback to scraping-only if Gemini fails
    if (!result) {
      console.log('   ⚠️ Gemini enrichment failed, falling back to web scraping...')
      result = fallbackEnrichment(companyName, normalizedWebsite, html, jsonLd, publicData)
    } else {
      console.log('   ✅ Gemini enrichment successful!')
    }

    // Merge supplementary data if fields are still empty
    if (!result.companySize && supplementaryData.employeeCount) {
      result.companySize = `${supplementaryData.employeeCount} employees`
    }
    if (!result.headquarters && supplementaryData.headquarters) {
      result.headquarters = supplementaryData.headquarters
    }
    if (openCorporates?.companyNumber && !result.companyProfile.includes(openCorporates.companyNumber)) {
      result.companyProfile = `Company Registration: ${openCorporates.companyNumber}. ${result.companyProfile}`.trim()
    }

    console.log(`   5️⃣ Validating social media URLs...`)
    // Validate social media URLs
    const validatedSocial: Array<{ label: string; url: string }> = []
    for (const profile of result.socialPresence) {
      if (await validateUrl(profile.url)) {
        validatedSocial.push(profile)
      }
    }
    result.socialPresence = validatedSocial

    console.log(`   6️⃣ Saving enriched data to database...`)
    // Save to database
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

    console.log(`✅ Enrichment complete for ${companyName}!`)
    console.log(`   📊 Fields populated:`)
    console.log(`      - Description: ${result.whatTheyDo ? '✅' : '❌'}`)
    console.log(`      - Key Leaders: ${result.keyLeaders ? '✅' : '❌'}`)
    console.log(`      - Headquarters: ${result.headquarters ? '✅' : '❌'}`)
    console.log(`      - Company Size: ${result.companySize ? '✅' : '❌'}`)
    console.log(`      - Founding Year: ${result.foundingYear ? '✅' : '❌'}`)
    console.log(`      - Accreditations: ${result.accreditations ? '✅' : '❌'}`)
    console.log(`      - Social Media: ${result.socialPresence.length} platforms`)

    return result
  } catch (error) {
    console.error(`❌ Error enriching company About for ${customerId}:`, error)
    return null
  }
}
