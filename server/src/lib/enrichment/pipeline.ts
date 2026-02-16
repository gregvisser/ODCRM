import type { EnrichmentDraft, EnrichmentSourcesData } from './types.js'
import { bingDiscoverUrls } from './bing.js'
import { companiesHouseLookup } from './companiesHouse.js'
import { companiesHouseProvider } from './providers/companiesHouse.js'
import { enrichFromWebsite } from './website.js'
import { normalizeDomain, sanitizeText } from './utils.js'
import { wikidataLookup } from './wikidata.js'
import { wikidataSparqlProvider } from './providers/wikidata.js'
import type { NormalizedCompanyData, SourceResult } from './types.js'

export async function runUkEnrichmentPipeline(options: {
  customer: { id: string; name: string; website?: string | null; domain?: string | null }
  input: { websiteUrl: string; domain: string }
  limits: {
    totalMs: number
    perFetchMs: number
    maxPages: number
    companiesHouseMs: number
    bingMs: number
    wikidataMs: number
  }
  flags: {
    enableCompaniesHouse: boolean
    companiesHouseApiKey: string
    enableBing: boolean
    bingKey: string
    bingEndpoint: string
    bingMarket: string
    bingCount: number
    enableWikidata: boolean
  }
}): Promise<{
  sourcesData: EnrichmentSourcesData
  draft: EnrichmentDraft
}> {
  const started = Date.now()
  const remaining = () => Math.max(0, options.limits.totalMs - (Date.now() - started))

  const sourcesData: EnrichmentSourcesData = {
    website: { fetchedUrls: [] },
    companiesHouse: null,
    bing: null,
    wikidata: null,
  }

  const draft: EnrichmentDraft = {
    website: options.input.websiteUrl,
  }

  const companyName = sanitizeText(options.customer.name, 200)
  const domain = normalizeDomain(options.input.domain || options.input.websiteUrl)

  // Companies House (flagged)
  if (options.flags.enableCompaniesHouse && options.flags.companiesHouseApiKey && remaining() > 1500) {
    try {
      const ch = await companiesHouseLookup({
        apiKey: options.flags.companiesHouseApiKey,
        timeoutMs: Math.min(options.limits.companiesHouseMs, remaining()),
        companyName,
      })
      if (ch) {
        sourcesData.companiesHouse = ch.sourcesData
        Object.assign(draft, ch.draft)
      }
    } catch (e) {
      sourcesData.companiesHouse = { error: e instanceof Error ? e.message : 'companies_house_failed' }
    }
  }

  // Bing discovery (flagged) — URL discovery only
  let discoveredUrls: string[] = []
  if (options.flags.enableBing && options.flags.bingKey && domain && remaining() > 1500) {
    try {
      const bing = await bingDiscoverUrls({
        key: options.flags.bingKey,
        endpoint: options.flags.bingEndpoint,
        market: options.flags.bingMarket,
        count: options.flags.bingCount,
        domain,
        timeoutMs: Math.min(options.limits.bingMs, remaining()),
      })
      if (bing) {
        sourcesData.bing = bing.sourcesData
        discoveredUrls = bing.keptUrls
      }
    } catch (e) {
      sourcesData.bing = { error: e instanceof Error ? e.message : 'bing_failed' } as any
    }
  }

  // Website fetching (always on) — strict limits
  if (remaining() > 1500) {
    const website = await enrichFromWebsite({
      websiteUrl: options.input.websiteUrl,
      discoveredUrls,
      maxPages: options.limits.maxPages,
      perFetchTimeoutMs: options.limits.perFetchMs,
      totalTimeoutMs: Math.min(options.limits.totalMs, remaining()),
    })
    if (website) {
      sourcesData.website = website.sourcesData
      Object.assign(draft, website.draft)
    }
  }

  // Wikidata (flagged)
  if (options.flags.enableWikidata && remaining() > 1500) {
    try {
      const wd = await wikidataLookup({
        timeoutMs: Math.min(options.limits.wikidataMs, remaining()),
        companyName,
      })
      if (wd) {
        sourcesData.wikidata = wd.sourcesData
        // Conservative merge: only fill empty whatTheyDo
        if (!draft.whatTheyDo && wd.draft.whatTheyDo) {
          draft.whatTheyDo = wd.draft.whatTheyDo
        }
      }
    } catch (e) {
      sourcesData.wikidata = { error: e instanceof Error ? e.message : 'wikidata_failed' }
    }
  }

  return { sourcesData, draft }
}

// -----------------------------------------------------------------------------
// FREE multi-source pipeline (production-ready)
// -----------------------------------------------------------------------------

function mergePriority<T>(...values: Array<T | undefined>): T | undefined {
  for (const v of values) {
    if (v === undefined) continue
    if (v === null as any) continue
    if (typeof v === 'string') {
      const s = String(v).trim()
      if (s) return v
      continue
    }
    if (typeof v === 'object') {
      // for objects (socialLinks), accept non-empty objects
      if (v && Object.keys(v as any).length) return v
    } else {
      return v
    }
  }
  return undefined
}

function mergeSourcesForNormalized(results: SourceResult[]): Partial<NormalizedCompanyData> {
  const website = results.find((r) => r.provider === 'website' && r.ok)?.data || {}
  const ch = results.find((r) => r.provider === 'companies_house' && r.ok)?.data || {}
  const wd = results.find((r) => r.provider === 'wikidata' && r.ok)?.data || {}

  // Per-field priority (as specified)
  return {
    companyName: mergePriority(ch.companyName, wd.companyName, website.companyName),
    headOfficeAddress: mergePriority(ch.headOfficeAddress, website.headOfficeAddress, wd.headOfficeAddress),
    sector: mergePriority(ch.sector, wd.sector, website.sector),
    webAddress: mergePriority(wd.webAddress, website.webAddress, ch.webAddress),
    socialLinks: mergePriority(website.socialLinks, wd.socialLinks),
    whatTheyDo: mergePriority(website.whatTheyDo, wd.whatTheyDo),
    companyProfile: mergePriority(website.companyProfile, wd.companyProfile),
    clientHistory: mergePriority(website.clientHistory),
    accreditation: mergePriority(website.accreditation),
  }
}

function confidenceForField(field: keyof NormalizedCompanyData, results: SourceResult[], chosenProvider: SourceResult['provider'] | null) {
  if (!chosenProvider) return 0
  const found = results.find((r) => r.provider === chosenProvider)
  const base = found?.confidence ?? 0
  // slight downgrade for longer text fields (more variable)
  if (field === 'companyProfile' || field === 'whatTheyDo' || field === 'clientHistory') return Math.max(0, Math.min(1, base - 0.05))
  return base
}

function providerChosenForField(field: keyof NormalizedCompanyData, merged: Partial<NormalizedCompanyData>, results: SourceResult[]) {
  const has = (v: any) => {
    if (v === undefined || v === null) return false
    if (typeof v === 'string') return Boolean(v.trim())
    if (typeof v === 'object') return Boolean(Object.keys(v).length)
    return true
  }
  const website = results.find((r) => r.provider === 'website' && r.ok)?.data || {}
  const ch = results.find((r) => r.provider === 'companies_house' && r.ok)?.data || {}
  const wd = results.find((r) => r.provider === 'wikidata' && r.ok)?.data || {}

  const value = (merged as any)[field]
  if (!has(value)) return null

  if (field === 'headOfficeAddress') return has(ch.headOfficeAddress) ? 'companies_house' : has(website.headOfficeAddress) ? 'website' : 'wikidata'
  if (field === 'sector') return has(ch.sector) ? 'companies_house' : has(wd.sector) ? 'wikidata' : 'website'
  if (field === 'webAddress') return has(wd.webAddress) ? 'wikidata' : has(website.webAddress) ? 'website' : 'companies_house'
  if (field === 'socialLinks') return has(website.socialLinks) ? 'website' : 'wikidata'
  if (field === 'whatTheyDo') return has(website.whatTheyDo) ? 'website' : 'wikidata'
  if (field === 'companyProfile') return has(website.companyProfile) ? 'website' : 'wikidata'
  if (field === 'clientHistory') return 'website'
  if (field === 'accreditation') return 'website'
  return has(ch.companyName) ? 'companies_house' : has(wd.companyName) ? 'wikidata' : 'website'
}

export async function runFreeEnrichmentPipeline(options: {
  companyName: string
  websiteUrl?: string
  domain?: string
  totalMs: number
  perFetchMs: number
  maxPages: number
  companiesHouseApiKey?: string
}): Promise<{
  results: SourceResult[]
  merged: Partial<NormalizedCompanyData>
  elapsedMs: number
  fieldConfidence: Partial<Record<keyof NormalizedCompanyData, number>>
}> {
  const started = Date.now()
  const remaining = () => Math.max(0, options.totalMs - (Date.now() - started))
  const companyName = sanitizeText(options.companyName, 200)

  const results: SourceResult[] = []

  // Provider 1: Companies House (fast structured data; only if key exists)
  if (remaining() > 1500) {
    const ch = await companiesHouseProvider({
      companyName,
      timeoutMs: Math.min(6000, remaining()),
      apiKey: options.companiesHouseApiKey,
    })
    results.push(ch)
  }

  // Provider 2: Wikidata SPARQL (fast public data)
  if (remaining() > 1500) {
    const wd = await wikidataSparqlProvider({
      companyName,
      timeoutMs: Math.min(6000, remaining()),
    })
    results.push(wd)
  }

  // Provider 3: Website (slowest / most variable; do it last with a capped budget)
  const websiteUrl = String(options.websiteUrl || '').trim()
  if (!websiteUrl) {
    results.push({ provider: 'website', ok: false, confidence: 0, evidence: [], data: {}, error: 'missing websiteUrl' })
  } else if (remaining() <= 1500) {
    results.push({ provider: 'website', ok: false, confidence: 0, evidence: [], data: {}, error: 'budget_exhausted' })
  } else {
    try {
      // Budgeting: never let website crawling consume the entire pipeline budget.
      const websiteTotalMs = Math.max(2000, Math.min(7000, remaining()))
      const perFetchTimeoutMs = Math.max(1200, Math.min(options.perFetchMs, 2500, websiteTotalMs))
      const website = await enrichFromWebsite({
        websiteUrl,
        discoveredUrls: [],
        maxPages: Math.max(1, options.maxPages),
        perFetchTimeoutMs,
        totalTimeoutMs: websiteTotalMs,
      })
      const accText = Array.isArray((website as any)?.draft?.accreditations)
        ? Array.from(
            new Set(
              (website as any).draft.accreditations.map((a: any) => String(a?.name || '').trim()).filter(Boolean),
            ),
          ).join(', ')
        : ''

      results.push({
        provider: 'website',
        ok: Boolean(website?.draft?.whatTheyDo || website?.draft?.companyProfile || website?.draft?.clientHistory || accText),
        confidence: 0.8,
        evidence: Array.isArray(website?.sourcesData?.fetchedUrls) ? website!.sourcesData!.fetchedUrls : [],
        data: {
          webAddress: (website as any)?.draft?.website,
          headOfficeAddress: (website as any)?.draft?.headquarters,
          whatTheyDo: (website as any)?.draft?.whatTheyDo,
          companyProfile: (website as any)?.draft?.companyProfile,
          clientHistory: (website as any)?.draft?.clientHistory,
          accreditation: accText || undefined,
          socialLinks: (website as any)?.draft?.socialPresence,
        },
      })
    } catch (e) {
      results.push({
        provider: 'website',
        ok: false,
        confidence: 0,
        evidence: [],
        data: {},
        error: e instanceof Error ? e.message : 'website_failed',
      })
    }
  }

  const merged = mergeSourcesForNormalized(results)
  const fieldConfidence: Partial<Record<keyof NormalizedCompanyData, number>> = {}
  ;(Object.keys(merged) as Array<keyof NormalizedCompanyData>).forEach((field) => {
    const provider = providerChosenForField(field, merged, results)
    fieldConfidence[field] = confidenceForField(field, results, provider)
  })

  return { results, merged, elapsedMs: Date.now() - started, fieldConfidence }
}

