import { Router } from 'express'
import { z } from 'zod'

const router = Router()

const lookupSchema = z.object({
  name: z.string().min(1).optional(),
  website: z.string().min(1).optional(),
})

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

const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 10000) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'ODCRM Company Lookup',
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

const extractLinkRel = (html: string, rel: string) => {
  const regex = new RegExp(`<link[^>]+rel=["']${rel}["'][^>]+href=["']([^"']+)["'][^>]*>`, 'i')
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

const sanitizeText = (value: string) => value.replace(/\s+/g, ' ').trim()

const validateUrl = async (url: string) => {
  try {
    const res = await fetchWithTimeout(url, { method: 'HEAD' }, 6000)
    if (res.ok) return true
  } catch {
    // ignore
  }
  return false
}

const fetchOpenCorporates = async (name?: string) => {
  if (!name) return null
  const url = `https://api.opencorporates.com/v0.4/companies/search?q=${encodeURIComponent(name)}`
  const response = await fetchWithTimeout(url, { method: 'GET' }, 12000)
  if (!response.ok) return null
  const json = await response.json()
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

router.post('/lookup', async (req, res) => {
  try {
    const { name, website } = lookupSchema.parse(req.body)
    const oc = await fetchOpenCorporates(name)

    let normalizedWebsite = ''
    let html = ''
    if (website) {
      normalizedWebsite = website.startsWith('http') ? website : `https://${website}`
      const response = await fetchWithTimeout(normalizedWebsite, { method: 'GET' }, 12000)
      if (response.ok) {
        html = await response.text()
      }
    }

    const description = html ? (extractMeta(html, 'description') || extractMeta(html, 'og:description') || '') : ''
    const ogImage = html ? (extractMeta(html, 'og:image') || extractMeta(html, 'twitter:image')) : ''
    const icon = html ? (extractLinkRel(html, 'icon') || extractLinkRel(html, 'shortcut icon') || extractLinkRel(html, 'apple-touch-icon')) : ''
    const logoCandidate = ogImage || icon
    const logoUrl = logoCandidate && normalizedWebsite ? absoluteUrl(normalizedWebsite, logoCandidate) : null

    const jsonLd = html ? extractJsonLd(html) : []
    const org = pickOrganization(jsonLd) || {}

    const foundingDate = oc?.incorporationDate ? String(oc.incorporationDate).slice(0, 4) : (org.foundingDate ? String(org.foundingDate).slice(0, 4) : '')
    const founders = Array.isArray(org.founder) ? org.founder : org.founder ? [org.founder] : []
    const keyLeaders = founders
      .map((f: any) => f?.name || f)
      .filter(Boolean)
      .join(', ')

    const headquarters = oc?.registeredAddress
      ? sanitizeText(oc.registeredAddress)
      : (() => {
        const address = org.address || {}
        const headquartersParts = [address.addressLocality, address.addressRegion, address.addressCountry]
          .filter(Boolean)
          .map((part: string) => sanitizeText(part))
        return headquartersParts.join(', ')
      })()

    const companySize = (() => {
      if (org.numberOfEmployees) {
        if (typeof org.numberOfEmployees === 'string') return org.numberOfEmployees
        if (org.numberOfEmployees.value) return String(org.numberOfEmployees.value)
      }
      return ''
    })()

    const accreditations = html ? extractAccreditations(html) : []

    const linkMatches = html ? [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]) : []
    const socialCandidates = normalizedWebsite
      ? linkMatches.map((href) => absoluteUrl(normalizedWebsite, href)).filter(Boolean) as string[]
      : []

    const socialMediaRaw = SOCIAL_DOMAINS.map((provider) => {
      const match = socialCandidates.find((url) => provider.match.test(url))
      return match ? { label: provider.label, url: match } : null
    }).filter(Boolean) as Array<{ label: string; url: string }>

    const socialMedia: Array<{ label: string; url: string }> = []
    for (const profile of socialMediaRaw) {
      if (await validateUrl(profile.url)) socialMedia.push(profile)
    }

    const newsCandidates = socialCandidates.filter((url) => /\/(news|blog|press|insights)\b/i.test(url))
    const newsItems: Array<{ date: string; headline: string; url: string }> = []
    for (const url of newsCandidates.slice(0, 8)) {
      if (!(await validateUrl(url))) continue
      const headline = sanitizeText(url.split('/').filter(Boolean).slice(-1)[0] || 'News')
      newsItems.push({ date: '', headline, url })
      if (newsItems.length >= 5) break
    }

    return res.json({
      sector: '',
      whatTheyDo: description ? sanitizeText(description) : '',
      accreditations: accreditations.join(', '),
      keyLeaders,
      companySize,
      headquarters: headquarters || '',
      foundingYear: foundingDate || '',
      recentNews: newsItems.length ? JSON.stringify(newsItems) : '',
      socialMedia,
      logoUrl,
      source: oc ? 'opencorporates' : 'web',
      verified: true,
    })
  } catch (error) {
    console.error('Company lookup failed:', error)
    return res.status(500).json({ error: 'Company lookup failed' })
  }
})

export default router
