import { fetchJsonWithTimeout, keepSameDomainUrls } from './utils.js'

type BingWebSearchResponse = {
  webPages?: {
    value?: Array<{
      name?: string
      url?: string
      snippet?: string
    }>
  }
}

export async function bingDiscoverUrls(options: {
  key: string
  endpoint: string
  market: string
  count: number
  domain: string
  timeoutMs: number
}): Promise<{
  sourcesData: {
    queries: string[]
    discoveredUrls: string[]
    keptSameDomainUrls: string[]
  }
  keptUrls: string[]
} | null> {
  const { key, endpoint, market, count, domain, timeoutMs } = options
  if (!key || !domain) return null

  const started = Date.now()
  const remaining = () => Math.max(0, timeoutMs - (Date.now() - started))

  const base = endpoint.replace(/\/+$/, '')
  const url = `${base}/v7.0/search`

  const queries = [
    `site:${domain} (accreditation OR certification OR ISO OR \"Cyber Essentials\" OR CHAS OR Constructionline OR SafeContractor)`,
    `site:${domain} (about OR \"who we are\")`,
    `site:${domain} (\"case studies\" OR testimonials)`,
  ]

  const discovered: string[] = []

  for (const q of queries) {
    const rem = remaining()
    if (rem <= 0) break
    const perQueryTimeout = Math.max(1500, Math.min(4000, rem))
    const params = new URLSearchParams({
      q,
      mkt: market || 'en-GB',
      count: String(Math.max(1, Math.min(count || 5, 10))),
    })
    const res = await fetchJsonWithTimeout<BingWebSearchResponse>(`${url}?${params.toString()}`, perQueryTimeout, {
      headers: { 'Ocp-Apim-Subscription-Key': key },
    })
    const items = res.json?.webPages?.value || []
    for (const item of items) {
      if (item?.url) discovered.push(String(item.url))
    }
  }

  const kept = keepSameDomainUrls(domain, discovered)

  return {
    sourcesData: {
      queries,
      discoveredUrls: discovered,
      keptSameDomainUrls: kept,
    },
    keptUrls: kept,
  }
}

