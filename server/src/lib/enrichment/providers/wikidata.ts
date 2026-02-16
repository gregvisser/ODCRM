import { fetchJsonWithTimeout, sanitizeText } from '../utils.js'
import type { NormalizedCompanyData, SourceResult } from '../types.js'

type SparqlBindingValue = { type?: string; value?: string }
type SparqlResults = {
  head?: { vars?: string[] }
  results?: { bindings?: Array<Record<string, SparqlBindingValue>> }
}

function normKey(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s\.\,\-\(\)\[\]\{\}]/g, '')
    .trim()
}

function pickBestBinding(bindings: Array<Record<string, SparqlBindingValue>>, companyName: string) {
  const q = normKey(companyName)
  const scored = bindings.map((b) => {
    const label = String(b.itemLabel?.value || '').trim()
    const k = normKey(label)
    let s = 0
    if (k && q && k === q) s += 10
    if (k && q && k.includes(q)) s += 3
    if (label.length > 3) s += 1
    const hasWebsite = Boolean(String(b.officialWebsite?.value || '').trim())
    const hasDesc = Boolean(String(b.description?.value || '').trim())
    if (hasWebsite) s += 2
    if (hasDesc) s += 1
    return { b, s }
  })
  scored.sort((a, b) => b.s - a.s)
  return scored[0]?.b || null
}

export async function wikidataSparqlProvider(options: {
  companyName: string
  timeoutMs: number
}): Promise<SourceResult> {
  const companyName = String(options.companyName || '').trim()
  if (!companyName) {
    return {
      provider: 'wikidata',
      ok: false,
      confidence: 0,
      evidence: [],
      data: {},
      error: 'missing company name',
    }
  }

  const endpoint = 'https://query.wikidata.org/sparql'

  // Query by label (English). We keep this conservative: we do NOT attempt fuzzy entity resolution beyond label matching.
  // We pull official website (P856), industry (P452), HQ location (P159) and English description.
  const sparql = `
SELECT ?item ?itemLabel ?officialWebsite ?industryLabel ?hqLabel ?description WHERE {
  ?item rdfs:label ?itemLabel .
  FILTER(LANG(?itemLabel) = "en") .
  FILTER(CONTAINS(LCASE(STR(?itemLabel)), LCASE("${companyName.replace(/"/g, '\\"')}"))) .

  OPTIONAL { ?item wdt:P856 ?officialWebsite . }
  OPTIONAL {
    ?item wdt:P452 ?industry .
    ?industry rdfs:label ?industryLabel .
    FILTER(LANG(?industryLabel) = "en") .
  }
  OPTIONAL {
    ?item wdt:P159 ?hq .
    ?hq rdfs:label ?hqLabel .
    FILTER(LANG(?hqLabel) = "en") .
  }
  OPTIONAL {
    ?item schema:description ?description .
    FILTER(LANG(?description) = "en") .
  }
}
LIMIT 10
`.trim()

  const url = `${endpoint}?format=json&query=${encodeURIComponent(sparql)}`

  try {
    const res = await fetchJsonWithTimeout<SparqlResults>(url, Math.max(2500, options.timeoutMs), {
      headers: { Accept: 'application/sparql-results+json' },
    })

    const bindings = Array.isArray(res.json?.results?.bindings) ? res.json!.results!.bindings! : []
    if (!bindings.length) {
      return {
        provider: 'wikidata',
        ok: false,
        confidence: 0,
        evidence: [endpoint],
        data: {},
        error: 'no results',
      }
    }

    const best = pickBestBinding(bindings, companyName)
    if (!best) {
      return {
        provider: 'wikidata',
        ok: false,
        confidence: 0,
        evidence: [endpoint],
        data: {},
        error: 'no best match',
      }
    }

    const label = sanitizeText(best.itemLabel?.value || '', 200)
    const officialWebsite = sanitizeText(best.officialWebsite?.value || '', 300)
    const industry = sanitizeText(best.industryLabel?.value || '', 250)
    const hq = sanitizeText(best.hqLabel?.value || '', 250)
    const desc = sanitizeText(best.description?.value || '', 600)
    const itemUrl = String(best.item?.value || '').trim()

    const exact = normKey(label) === normKey(companyName)
    const confidence = exact ? 0.7 : 0.45

    const data: Partial<NormalizedCompanyData> = {
      companyName: label || undefined,
      webAddress: officialWebsite || undefined,
      sector: industry || undefined,
      headOfficeAddress: hq || undefined,
      companyProfile: desc || undefined,
      whatTheyDo: desc || undefined,
    }

    return {
      provider: 'wikidata',
      ok: Boolean(data.webAddress || data.sector || data.headOfficeAddress || data.companyProfile),
      confidence,
      evidence: [endpoint, itemUrl].filter(Boolean),
      data,
    }
  } catch (e) {
    return {
      provider: 'wikidata',
      ok: false,
      confidence: 0,
      evidence: [endpoint],
      data: {},
      error: e instanceof Error ? e.message : 'wikidata_failed',
    }
  }
}

