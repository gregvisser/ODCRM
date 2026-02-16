export type EnrichmentStatus = 'idle' | 'running' | 'done' | 'failed'

export type DraftAccreditation = {
  name: string
  confidence: 'claimed'
  verified: false
  evidenceUrls: string[]
}

export type EnrichmentDraft = {
  website?: string
  registeredName?: string
  companyNumber?: string
  registeredAddress?: string
  headquarters?: string
  clientHistory?: string
  sicCodes?: string[]
  sector?: string
  foundingYear?: string
  socialPresence?: Record<string, string>
  whatTheyDo?: string
  companyProfile?: string
  accreditations?: DraftAccreditation[]
}

export type EnrichmentSourcesData = {
  website?: {
    fetchedUrls: string[]
  }
  companiesHouse?: Record<string, unknown> | null
  bing?: {
    queries: string[]
    discoveredUrls: string[]
    keptSameDomainUrls: string[]
  } | null
  wikidata?: Record<string, unknown> | null
}

export type StoredEnrichment = {
  status: EnrichmentStatus
  fetchedAt: string | null
  fetchedByUserEmail: string | null
  input: { website?: string; domain?: string }
  sourcesData?: EnrichmentSourcesData
  draft?: EnrichmentDraft
  error?: string | null
  elapsedMs?: number
}

// -----------------------------------------------------------------------------
// Production-ready FREE enrichment (multi-source) unified types
// -----------------------------------------------------------------------------

export type NormalizedSocialLinks = {
  twitter?: string
  linkedin?: string
  facebook?: string
  instagram?: string
  youtube?: string
  other?: string[]
}

export type NormalizedCompanyData = {
  companyName?: string
  webAddress?: string
  sector?: string
  headOfficeAddress?: string
  whatTheyDo?: string
  companyProfile?: string
  clientHistory?: string
  accreditation?: string
  socialLinks?: NormalizedSocialLinks
}

export type SourceResult = {
  provider: 'companies_house' | 'website' | 'wikidata'
  ok: boolean
  confidence: number
  evidence: string[]
  data: Partial<NormalizedCompanyData>
  error?: string
}

