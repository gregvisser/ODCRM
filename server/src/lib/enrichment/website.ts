import * as cheerio from 'cheerio'
import { extractCertificationsFromHtml, mergeAccreditations } from './certifications.js'
import type { EnrichmentDraft, EnrichmentSourcesData } from './types.js'
import { dedupeStrings, fetchTextWithTimeout, keepSameDomainUrls, normalizeDomain, sanitizeText } from './utils.js'

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

function extractWhatTheyDoAndProfile(html: string): { whatTheyDo?: string; companyProfile?: string } {
  const $ = cheerio.load(html)
  const metaDescription = sanitizeText($('meta[name="description"]').attr('content') || '', 400)
  const firstP = sanitizeText($('p').first().text() || '', 1200)
  const h1 = sanitizeText($('h1').first().text() || '', 160)
  const bodyText = sanitizeText($('body').text() || '', 1600)
  const whatTheyDo = sanitizeText(metaDescription || h1 || firstP || bodyText, 900)
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
  const websiteUrl = options.websiteUrl
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
  const aboutUrl = pickAboutUrl(websiteUrl, homepageHtml)
  const clientHistoryUrl = pickClientHistoryUrl(websiteUrl, homepageHtml)

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
  const social = extractSocialLinks(websiteUrl, homepageHtml)

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
      accreditations: accreditations.length ? accreditations : undefined,
    },
  }
}

