import type { EnrichmentDraft, EnrichmentSourcesData } from './types.js'
import { bingDiscoverUrls } from './bing.js'
import { companiesHouseLookup } from './companiesHouse.js'
import { enrichFromWebsite } from './website.js'
import { normalizeDomain, sanitizeText } from './utils.js'
import { wikidataLookup } from './wikidata.js'

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

