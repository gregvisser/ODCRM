import * as cheerio from 'cheerio'
import { dedupeStrings, sanitizeText } from './utils.js'
import type { DraftAccreditation } from './types.js'

const CERT_DEFS: Array<{ name: string; patterns: RegExp[] }> = [
  { name: 'ISO 9001', patterns: [/\bISO\s*9001\b/i] },
  { name: 'ISO 14001', patterns: [/\bISO\s*14001\b/i] },
  { name: 'ISO 27001', patterns: [/\bISO\s*27001\b/i] },
  { name: 'ISO 45001', patterns: [/\bISO\s*45001\b/i] },
  { name: 'ISO 22301', patterns: [/\bISO\s*22301\b/i] },
  { name: 'Cyber Essentials', patterns: [/\bCyber\s*Essentials\b/i] },
  { name: 'Cyber Essentials Plus', patterns: [/\bCyber\s*Essentials\s*Plus\b/i] },
  { name: 'SOC 2', patterns: [/\bSOC\s*2\b/i] },
  { name: 'PCI DSS', patterns: [/\bPCI\s*DSS\b/i] },
  { name: 'CHAS', patterns: [/\bCHAS\b/i] },
  { name: 'Constructionline', patterns: [/\bConstructionline\b/i] },
  { name: 'SafeContractor', patterns: [/\bSafe\s*Contractor\b/i, /\bSafeContractor\b/i] },
  { name: 'NICEIC', patterns: [/\bNICEIC\b/i] },
  { name: 'Gas Safe', patterns: [/\bGas\s*Safe\b/i] },
  { name: 'FCA regulated', patterns: [/\bFCA\s*regulated\b/i, /\bFinancial\s+Conduct\s+Authority\b/i] },
  { name: 'Investors in People', patterns: [/\bInvestors\s+in\s+People\b/i] },
  { name: 'B Corp', patterns: [/\bB\s*Corp\b/i, /\bB\s*Corporation\b/i] },
]

function matchCertNames(text: string): string[] {
  const hits: string[] = []
  for (const def of CERT_DEFS) {
    if (def.patterns.some((p) => p.test(text))) hits.push(def.name)
  }
  return hits
}

export function extractCertificationsFromHtml(html: string, pageUrl: string): DraftAccreditation[] {
  try {
    const $ = cheerio.load(html)

    // Pull from visible-ish content + link text + image alt badge text.
    const pieces: string[] = []
    pieces.push($('title').first().text() || '')
    pieces.push($('h1').first().text() || '')
    pieces.push($('h2').first().text() || '')
    pieces.push($('h3').first().text() || '')
    $('a').each((_, el) => {
      pieces.push($(el).text() || '')
    })
    $('img[alt]').each((_, el) => {
      pieces.push(String($(el).attr('alt') || ''))
    })
    pieces.push($('body').text() || '')

    const haystack = sanitizeText(pieces.join(' '), 20_000)
    const names = dedupeStrings(matchCertNames(haystack))
    return names.map((name) => ({
      name,
      confidence: 'claimed',
      verified: false,
      evidenceUrls: [pageUrl],
    }))
  } catch {
    return []
  }
}

export function mergeAccreditations(
  current: DraftAccreditation[] | undefined,
  additions: DraftAccreditation[],
): DraftAccreditation[] {
  const out: DraftAccreditation[] = Array.isArray(current) ? [...current] : []
  const index = new Map<string, DraftAccreditation>()
  for (const a of out) {
    if (a?.name) index.set(a.name.toLowerCase(), a)
  }

  for (const add of additions) {
    const key = String(add?.name || '').toLowerCase()
    if (!key) continue
    const existing = index.get(key)
    if (!existing) {
      const normalized: DraftAccreditation = {
        name: String(add.name),
        confidence: 'claimed',
        verified: false,
        evidenceUrls: dedupeStrings(Array.isArray(add.evidenceUrls) ? add.evidenceUrls : []),
      }
      out.push(normalized)
      index.set(key, normalized)
    } else {
      existing.evidenceUrls = dedupeStrings([...(existing.evidenceUrls || []), ...(add.evidenceUrls || [])])
    }
  }

  return out
}

