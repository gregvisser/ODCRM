import * as cheerio from 'cheerio'
import { extractCertificationsFromHtml, mergeAccreditations } from './certifications.js'
import type { EnrichmentDraft, EnrichmentSourcesData } from './types.js'
import { dedupeStrings, fetchTextWithTimeout, keepSameDomainUrls, normalizeDomain, normalizeWebsiteUrl, sanitizeText } from './utils.js'

type Page = { url: string; html: string }

function pickAboutUrl(baseUrl: string, html: string): string | null {
  try {
    const $ = cheerio.load(html)
    const candidates: string[] = []
    $('a[href]').each((_, el) => {
      const href = String($(el).attr('href') || '').trim()
      if (!href) return
      const lower = href.toLowerCase()
      if (lower.includes('about') || lower.includes('who-we-are') || lower.includes('our-story') || lower.includes('company')) {
        candidates.push(href)
      }
    })
    const first = candidates[0]
    if (!first) return null
    const absolute = new URL(first, baseUrl).toString()
    if (new URL(absolute).host !== new URL(baseUrl).host) return null
    return absolute
  } catch {
    return null
  }
}

function pickClientHistoryUrl(baseUrl: string, html: string): string | null {
  try {
    const $ = cheerio.load(html)
    const candidates: string[] = []
    $('a[href]').each((_, el) => {
      const href = String($(el).attr('href') || '').trim()
      if (!href) return
      const lowerHref = href.toLowerCase()
      const text = String($(el).text() || '').trim().toLowerCase()
      const looksRelevant =
        lowerHref.includes('case-stud') ||
        lowerHref.includes('case_stud') ||
        lowerHref.includes('portfolio') ||
        lowerHref.includes('our-work') ||
        lowerHref.includes('our_work') ||
        lowerHref.includes('projects') ||
        lowerHref.includes('clients') ||
        lowerHref.includes('testimonials') ||
        text.includes('case stud') ||
        text.includes('portfolio') ||
        text.includes('our work') ||
        text.includes('projects') ||
        text.includes('clients') ||
        text.includes('testimonials')
      if (!looksRelevant) return
      candidates.push(href)
    })
    const first = candidates[0]
    if (!first) return null
    const absolute = new URL(first, baseUrl).toString()
    if (new URL(absolute).host !== new URL(baseUrl).host) return null
    return absolute
  } catch {
    return null
  }
}

function extractSocialLinks(baseUrl: string, html: string): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    const $ = cheerio.load(html)
    const links = new Set<string>()
    $('a[href]').each((_, el) => {
      const href = String($(el).attr('href') || '').trim()
      if (!href) return
      try {
        links.add(new URL(href, baseUrl).toString())
      } catch {
        // ignore
      }
    })
    const pick = (key: string, match: RegExp) => {
      const found = Array.from(links).find((u) => match.test(u))
      if (found) out[key] = found
    }
    pick('linkedin', /linkedin\.com/i)
    pick('twitter', /twitter\.com|x\.com/i)
    pick('facebook', /facebook\.com/i)
    pick('instagram', /instagram\.com/i)
    return out
  } catch {
    return out
  }
}

function extractJsonLdObjects(html: string): any[] {
  try {
    const $ = cheerio.load(html)
    const blocks: any[] = []
    $('script[type="application/ld+json"]').each((_, el) => {
      const raw = String($(el).text() || '').trim()
      if (!raw) return
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) blocks.push(...parsed)
        else blocks.push(parsed)
      } catch {
        // ignore invalid JSON-LD
      }
    })
    return blocks
  } catch {
    return []
  }
}

function pickOrganization(jsonLd: any[]): any | null {
  const items = Array.isArray(jsonLd) ? jsonLd : []
  const flat = items.flatMap((item: any) => (item?.['@graph'] ? item['@graph'] : item))
  const org = flat.find((item: any) => {
    const type = item?.['@type']
    return type === 'Organization' || type === 'Corporation' || type === 'LocalBusiness'
  })
  return org || null
}

function extractSameAsSocial(org: any): Record<string, string> {
  const out: Record<string, string> = {}
  const sameAs = org?.sameAs
  const urls = Array.isArray(sameAs) ? sameAs : typeof sameAs === 'string' ? [sameAs] : []
  for (const raw of urls) {
    const u = String(raw || '').trim()
    if (!u) continue
    const lower = u.toLowerCase()
    if (lower.includes('linkedin.com') && !out.linkedin) out.linkedin = u
    else if ((lower.includes('twitter.com') || lower.includes('x.com')) && !out.twitter) out.twitter = u
    else if (lower.includes('facebook.com') && !out.facebook) out.facebook = u
    else if (lower.includes('instagram.com') && !out.instagram) out.instagram = u
    else if (lower.includes('youtube.com') && !out.youtube) out.youtube = u
  }
  return out
}

function extractOrgAddress(org: any): string | undefined {
  const addr = org?.address
  if (!addr || typeof addr !== 'object') return undefined
  const parts = [
    addr.streetAddress,
    addr.addressLocality,
    addr.addressRegion,
    addr.postalCode,
    addr.addressCountry,
  ]
    .map((p: any) => String(p || '').trim())
    .filter(Boolean)
  const text = parts.join(', ')
  return text ? sanitizeText(text, 500) : undefined
}

function extractWhatTheyDoAndProfile(html: string): { whatTheyDo?: string; companyProfile?: string } {
  const $ = cheerio.load(html)
  const metaDescription = sanitizeText($('meta[name="description"]').attr('content') || '', 400)
  const ogDescription = sanitizeText($('meta[property="og:description"]').attr('content') || '', 450)
  const firstP = sanitizeText($('p').first().text() || '', 1200)
  const h1 = sanitizeText($('h1').first().text() || '', 160)
  const bodyText = sanitizeText($('body').text() || '', 1600)
  const whatTheyDo = sanitizeText(metaDescription || ogDescription || h1 || firstP || bodyText, 900)
  const companyProfile = sanitizeText(firstP || bodyText, 2000)
  return {
    whatTheyDo: whatTheyDo || undefined,
    companyProfile: companyProfile || undefined,
  }
}

function extractClientHistory(html: string): string | undefined {
  try {
    const $ = cheerio.load(html)

    // Prefer structured items first (often client logos/names are in list items).
    const liItems = $('li')
      .toArray()
      .map((el) => sanitizeText($(el).text() || '', 120))
      .map((s) => s.replace(/^[•\-\u2022]\s*/g, '').trim())
      .filter((s) => s && s.length >= 2 && s.length <= 120)

    const deduped = dedupeStrings(liItems)
    const top = deduped.slice(0, 12)
    if (top.length >= 4) {
      return top.join('\n')
    }

    // Fallback: concise paragraph summary.
    const pText = sanitizeText($('p').text() || '', 1200)
    return pText ? pText : undefined
  } catch {
    return undefined
  }
}

async function fetchSitemapUrls(baseUrl: string, timeoutMs: number): Promise<string[]> {
  try {
    const sitemapUrl = new URL('/sitemap.xml', baseUrl).toString()
    const res = await fetchTextWithTimeout(sitemapUrl, timeoutMs, { headers: { Accept: 'application/xml,text/xml,*/*' } })
    if (!res.ok || !res.text) return []
    const locs = [...res.text.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((m) => String(m[1] || '').trim())
    return dedupeStrings(locs).slice(0, 25)
  } catch {
    return []
  }
}

export async function enrichFromWebsite(options: {
  websiteUrl: string
  discoveredUrls: string[]
  maxPages: number
  perFetchTimeoutMs: number
  totalTimeoutMs: number
}): Promise<{ sourcesData: EnrichmentSourcesData['website']; draft: Partial<EnrichmentDraft> } | null> {
  const started = Date.now()
  const remaining = () => Math.max(0, options.totalTimeoutMs - (Date.now() - started))
  const websiteUrl = normalizeWebsiteUrl(options.websiteUrl)
  const domain = normalizeDomain(websiteUrl)
  if (!websiteUrl || !domain) return null

  const fetchedUrls: string[] = []
  const pages: Page[] = []

  const fetchOne = async (url: string) => {
    const rem = remaining()
    if (rem <= 0) return
    const timeout = Math.max(1500, Math.min(options.perFetchTimeoutMs, rem))
    const res = await fetchTextWithTimeout(url, timeout)
    if (!res.ok) return
    fetchedUrls.push(url)
    pages.push({ url, html: res.text })
  }

  // Always fetch homepage first
  await fetchOne(websiteUrl)
  if (!pages.length) return null

  const homepageHtml = pages[0].html
  const homepageJsonLd = extractJsonLdObjects(homepageHtml)
  const homepageOrg = pickOrganization(homepageJsonLd)
  const aboutUrl = pickAboutUrl(websiteUrl, homepageHtml)
  const clientHistoryUrl = pickClientHistoryUrl(websiteUrl, homepageHtml)

  // Fixed path crawl (robust, limited; never assumes sitemap exists).
  const fixedPaths = [
    '/about',
    '/contact',
    '/services',
    '/case-studies',
    '/casestudies',
    '/clients',
    '/testimonials',
    '/portfolio',
  ]
  const fixedUrls = fixedPaths
    .map((p) => {
      try {
        return new URL(p, websiteUrl).toString()
      } catch {
        return null
      }
    })
    .filter(Boolean) as string[]

  // Optional sitemap discovery
  let sitemapUrls: string[] = []
  if (remaining() > 2500) {
    sitemapUrls = await fetchSitemapUrls(websiteUrl, Math.min(4000, remaining()))
  }

  const discoveredSameDomain = keepSameDomainUrls(domain, options.discoveredUrls || [])
  const sitemapSameDomain = keepSameDomainUrls(domain, sitemapUrls)

  const candidates = dedupeStrings([
    ...(clientHistoryUrl ? [clientHistoryUrl] : []),
    ...(aboutUrl ? [aboutUrl] : []),
    ...fixedUrls,
    ...discoveredSameDomain,
    ...sitemapSameDomain,
  ]).filter((u) => u !== websiteUrl)

  for (const u of candidates) {
    if (pages.length >= options.maxPages) break
    if (remaining() <= 0) break
    await fetchOne(u)
  }

  // Extract draft fields from homepage primarily; use additional pages for cert signals.
  const primary = extractWhatTheyDoAndProfile(homepageHtml)
  const social = {
    ...extractSocialLinks(websiteUrl, homepageHtml),
    ...(homepageOrg ? extractSameAsSocial(homepageOrg) : {}),
  }
  const headquarters = homepageOrg ? extractOrgAddress(homepageOrg) : undefined

  let accreditations = mergeAccreditations(undefined, extractCertificationsFromHtml(homepageHtml, websiteUrl))
  for (const p of pages.slice(1)) {
    accreditations = mergeAccreditations(accreditations, extractCertificationsFromHtml(p.html, p.url))
  }

  const clientHistoryPage =
    clientHistoryUrl ? pages.find((p) => p.url === clientHistoryUrl) : null
  const clientHistory = clientHistoryPage ? extractClientHistory(clientHistoryPage.html) : undefined

  return {
    sourcesData: { fetchedUrls },
    draft: {
      website: websiteUrl,
      socialPresence: Object.keys(social).length ? social : undefined,
      whatTheyDo: primary.whatTheyDo,
      companyProfile: primary.companyProfile,
      clientHistory,
      headquarters,
      accreditations: accreditations.length ? accreditations : undefined,
    },
  }
}

