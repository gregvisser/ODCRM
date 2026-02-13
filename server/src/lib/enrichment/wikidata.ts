import { fetchJsonWithTimeout, sanitizeText } from './utils.js'

type WikidataSearchResponse = {
  search?: Array<{
    id?: string
    label?: string
    description?: string
  }>
}

type WikidataEntityData = {
  entities?: Record<
    string,
    {
      id?: string
      labels?: Record<string, { value?: string }>
      descriptions?: Record<string, { value?: string }>
      claims?: Record<string, any>
    }
  >
}

function claimFirstString(entity: any, prop: string): string {
  try {
    const claim = entity?.claims?.[prop]
    const first = Array.isArray(claim) ? claim[0] : null
    const dv = first?.mainsnak?.datavalue
    const v = dv?.value
    if (typeof v === 'string') return v
    if (v && typeof v === 'object' && typeof v.text === 'string') return v.text
  } catch {
    // ignore
  }
  return ''
}

export async function wikidataLookup(options: {
  timeoutMs: number
  companyName?: string
}): Promise<{
  sourcesData: Record<string, unknown>
  draft: { whatTheyDo?: string }
} | null> {
  const { timeoutMs } = options
  const started = Date.now()
  const remaining = () => Math.max(0, timeoutMs - (Date.now() - started))
  const companyName = String(options.companyName || '').trim()
  if (!companyName) return null

  // Search
  const searchUrl =
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&limit=1&search=` +
    encodeURIComponent(companyName)
  const searchTimeout = Math.max(1500, Math.min(3500, remaining()))
  const search = await fetchJsonWithTimeout<WikidataSearchResponse>(searchUrl, searchTimeout)
  const first = search.json?.search?.[0]
  const id = String(first?.id || '').trim()
  if (!id) return null

  const entityUrl = `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(id)}.json`
  const entityTimeout = Math.max(1500, Math.min(3500, remaining()))
  const entityRes = await fetchJsonWithTimeout<WikidataEntityData>(entityUrl, entityTimeout)
  const entity = entityRes.json?.entities?.[id]
  if (!entity) return null

  const label = sanitizeText(entity.labels?.en?.value || first?.label || '', 200)
  const description = sanitizeText(entity.descriptions?.en?.value || first?.description || '', 500)

  // P856 = official website (string URL)
  const officialWebsite = sanitizeText(claimFirstString(entity, 'P856'), 300)

  return {
    sourcesData: {
      id,
      label: label || null,
      description: description || null,
      officialWebsite: officialWebsite || null,
      entityUrl,
    },
    draft: {
      whatTheyDo: description || undefined,
    },
  }
}

