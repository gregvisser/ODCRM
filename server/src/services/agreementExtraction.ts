import { z } from 'zod'

export type AgreementExtractionStatus = 'succeeded' | 'partial' | 'failed'
export type AgreementExtractionSource = 'gemini' | 'deterministic-fallback'

export type AgreementExtractionFields = {
  agreedMonthlyPrice: number | null
  pricingText: string | null
  startDateAgreed: string | null
  daysPerWeek: number | null
  contractSignedDate: string | null
  contractStartDate: string | null
  serviceStartDate: string | null
  billingStartDate: string | null
  contractEndDate: string | null
  renewalDate: string | null
  contractTermMonths: number | null
  agreementSummary: string | null
}

export type AgreementExtractionResult = {
  status: AgreementExtractionStatus
  extractionSource: AgreementExtractionSource
  extractedAt: string
  warnings: string[]
  fields: AgreementExtractionFields
  evidence: Partial<Record<keyof AgreementExtractionFields, string>>
}

const RESPONSE_SCHEMA = z.object({
  agreedMonthlyPrice: z.number().finite().nonnegative().nullable().optional(),
  pricingText: z.string().trim().max(500).nullable().optional(),
  startDateAgreed: z.string().trim().nullable().optional(),
  daysPerWeek: z.number().int().min(1).max(7).nullable().optional(),
  contractSignedDate: z.string().trim().nullable().optional(),
  contractStartDate: z.string().trim().nullable().optional(),
  serviceStartDate: z.string().trim().nullable().optional(),
  billingStartDate: z.string().trim().nullable().optional(),
  contractEndDate: z.string().trim().nullable().optional(),
  renewalDate: z.string().trim().nullable().optional(),
  contractTermMonths: z.number().int().positive().nullable().optional(),
  agreementSummary: z.string().trim().max(1500).nullable().optional(),
  evidence: z
    .object({
      agreedMonthlyPrice: z.string().trim().max(300).optional(),
      pricingText: z.string().trim().max(300).optional(),
      startDateAgreed: z.string().trim().max(300).optional(),
      daysPerWeek: z.string().trim().max(300).optional(),
      contractSignedDate: z.string().trim().max(300).optional(),
      contractStartDate: z.string().trim().max(300).optional(),
      serviceStartDate: z.string().trim().max(300).optional(),
      billingStartDate: z.string().trim().max(300).optional(),
      contractEndDate: z.string().trim().max(300).optional(),
      renewalDate: z.string().trim().max(300).optional(),
      contractTermMonths: z.string().trim().max(300).optional(),
      agreementSummary: z.string().trim().max(300).optional(),
    })
    .partial()
    .optional(),
  warnings: z.array(z.string().trim().max(300)).optional(),
})

const EMPTY_FIELDS: AgreementExtractionFields = {
  agreedMonthlyPrice: null,
  pricingText: null,
  startDateAgreed: null,
  daysPerWeek: null,
  contractSignedDate: null,
  contractStartDate: null,
  serviceStartDate: null,
  billingStartDate: null,
  contractEndDate: null,
  renewalDate: null,
  contractTermMonths: null,
  agreementSummary: null,
}

function getGeminiApiKey(): string | null {
  const raw =
    process.env.EMERGENT_LLM_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GEMINI_API_KEY ||
    ''
  const value = String(raw).trim()
  return value || null
}

function sanitizeIsoDate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const exact = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null
  if (exact) return exact

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  const year = parsed.getUTCFullYear()
  const month = `${parsed.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${parsed.getUTCDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function sanitizeFields(input: z.infer<typeof RESPONSE_SCHEMA>): AgreementExtractionFields {
  const monthly = typeof input.agreedMonthlyPrice === 'number' && Number.isFinite(input.agreedMonthlyPrice)
    ? Math.round(input.agreedMonthlyPrice * 100) / 100
    : null

  return {
    agreedMonthlyPrice: monthly,
    pricingText: input.pricingText?.trim() || null,
    startDateAgreed: sanitizeIsoDate(input.startDateAgreed),
    daysPerWeek:
      typeof input.daysPerWeek === 'number' && Number.isFinite(input.daysPerWeek) ? input.daysPerWeek : null,
    contractSignedDate: sanitizeIsoDate(input.contractSignedDate),
    contractStartDate: sanitizeIsoDate(input.contractStartDate),
    serviceStartDate: sanitizeIsoDate(input.serviceStartDate),
    billingStartDate: sanitizeIsoDate(input.billingStartDate),
    contractEndDate: sanitizeIsoDate(input.contractEndDate),
    renewalDate: sanitizeIsoDate(input.renewalDate),
    contractTermMonths:
      typeof input.contractTermMonths === 'number' && Number.isFinite(input.contractTermMonths)
        ? input.contractTermMonths
        : null,
    agreementSummary: input.agreementSummary?.trim() || null,
  }
}

function countExtractedFields(fields: AgreementExtractionFields): number {
  return Object.values(fields).filter((value) => {
    if (typeof value === 'number') return true
    if (typeof value === 'string') return value.trim().length > 0
    return value !== null && value !== undefined
  }).length
}

function buildPrompt(customerName: string, fileName: string): string {
  return [
    'You extract contract data for ODCRM onboarding.',
    'Rules:',
    '- Return JSON only.',
    '- Never guess. If a field is not explicit in the document, return null.',
    '- Only set agreedMonthlyPrice when the agreement clearly states a recurring monthly price/value.',
    '- Normalize all dates to YYYY-MM-DD.',
    '- startDateAgreed is the agreed go-live/start date for the service, including phrasing like w/c 6th January 2025.',
    '- daysPerWeek is the numeric working days per week agreed in the contract.',
    '- agreementSummary should be a short factual summary of the commercial agreement.',
    '- evidence values must be short verbatim snippets from the document showing why the field was extracted.',
    `Customer: ${customerName}`,
    `File name: ${fileName}`,
    'Required JSON shape:',
    JSON.stringify({
      agreedMonthlyPrice: null,
      pricingText: null,
      startDateAgreed: null,
      daysPerWeek: null,
      contractSignedDate: null,
      contractStartDate: null,
      serviceStartDate: null,
      billingStartDate: null,
      contractEndDate: null,
      renewalDate: null,
      contractTermMonths: null,
      agreementSummary: null,
      evidence: {
        agreedMonthlyPrice: '',
        pricingText: '',
        startDateAgreed: '',
        daysPerWeek: '',
        contractSignedDate: '',
        contractStartDate: '',
        serviceStartDate: '',
        billingStartDate: '',
        contractEndDate: '',
        renewalDate: '',
        contractTermMonths: '',
        agreementSummary: '',
      },
      warnings: [],
    }),
  ].join('\n')
}

async function tryGeminiExtraction(params: {
  buffer: Buffer
  mimeType: string
  customerName: string
  fileName: string
}): Promise<{ parsed: z.infer<typeof RESPONSE_SCHEMA>; warnings: string[] } | null> {
  const apiKey = getGeminiApiKey()
  if (!apiKey) return null

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: buildPrompt(params.customerName, params.fileName) },
              {
                inlineData: {
                  mimeType: params.mimeType,
                  data: params.buffer.toString('base64'),
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
        },
      }),
    },
  )

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`gemini_http_${response.status}: ${message.slice(0, 500)}`)
  }

  const payload = (await response.json()) as any
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('gemini_empty_response')
  }

  const parsedJson = JSON.parse(text)
  const parsed = RESPONSE_SCHEMA.parse(parsedJson)
  return {
    parsed,
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.filter(Boolean) : [],
  }
}

function extractLooseText(buffer: Buffer): string {
  const utf8 = buffer.toString('utf8')
  const latin1 = buffer.toString('latin1')
  const combined = `${utf8}\n${latin1}`
  return combined
    .replace(/[^ -~£€]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isReadableExtractedDocumentText(text: string): { ok: boolean; reason?: string } {
  const trimmed = String(text || '').replace(/\s+/g, ' ').trim()
  if (!trimmed || trimmed.length < 80) {
    return {
      ok: false,
      reason: 'Document text could not be extracted in readable form.',
    }
  }

  const lower = trimmed.toLowerCase()
  const pdfStructuralMarkers = [
    '%pdf-',
    ' obj ',
    ' stream ',
    ' endobj ',
    ' xref ',
    ' trailer ',
    ' startxref ',
    '/type',
    '/catalog',
    '/pages',
    '/page',
    '/filter',
    '/length',
  ]
  const structuralHits = pdfStructuralMarkers.reduce((count, marker) => count + (lower.includes(marker) ? 1 : 0), 0)
  if (lower.includes('%pdf-') || structuralHits >= 4) {
    return {
      ok: false,
      reason: 'Agreement appears image-based or unreadable; no defensible fields were extracted.',
    }
  }

  const tokens = trimmed.split(/\s+/).filter(Boolean)
  const readableWords = trimmed.match(/\b[a-zA-Z][a-zA-Z'’-]{1,}\b/g) || []
  const commonLanguageSignals =
    trimmed.match(/\b(the|and|agreement|service|services|client|customer|date|price|monthly|billing|start|term|signed)\b/gi) || []
  const symbolRuns = trimmed.match(/[<>{}[\]\\/_=|]{2,}/g) || []
  const readableRatio = readableWords.length / Math.max(tokens.length, 1)

  if (
    tokens.length < 20 ||
    readableWords.length < 16 ||
    readableRatio < 0.4 ||
    commonLanguageSignals.length < 2 ||
    symbolRuns.length >= 6
  ) {
    return {
      ok: false,
      reason: 'Agreement appears image-based or unreadable; no defensible fields were extracted.',
    }
  }

  return { ok: true }
}

function captureSnippet(text: string, start: number, end: number): string | null {
  if (start < 0 || end < 0) return null
  const from = Math.max(0, start - 40)
  const to = Math.min(text.length, end + 80)
  const snippet = text.slice(from, to).trim()
  return snippet || null
}

function parseLooseDate(raw: string): string | null {
  const trimmed = raw
    .trim()
    .replace(/^[Ww]\s*\/?\s*[Cc]\s*/i, '')
    .replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, '$1')
    .replace(/,/g, '')
  if (!trimmed) return null

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return trimmed

  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (slash) {
    const day = slash[1].padStart(2, '0')
    const month = slash[2].padStart(2, '0')
    const year = slash[3].length === 2 ? `20${slash[3]}` : slash[3]
    return `${year}-${month}-${day}`
  }

  const monthName = trimmed.match(
    /^(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})$/i,
  )
  if (monthName) {
    const monthIndex = [
      'january',
      'february',
      'march',
      'april',
      'may',
      'june',
      'july',
      'august',
      'september',
      'october',
      'november',
      'december',
    ].indexOf(monthName[2].toLowerCase())
    if (monthIndex >= 0) {
      return `${monthName[3]}-${`${monthIndex + 1}`.padStart(2, '0')}-${monthName[1].padStart(2, '0')}`
    }
  }

  return null
}

function tryDeterministicExtraction(buffer: Buffer): AgreementExtractionResult {
  const extractedAt = new Date().toISOString()
  const text = extractLooseText(buffer)
  const warnings: string[] = ['Gemini extraction unavailable; used deterministic fallback.']
  const evidence: Partial<Record<keyof AgreementExtractionFields, string>> = {}
  const fields: AgreementExtractionFields = { ...EMPTY_FIELDS }
  const readability = isReadableExtractedDocumentText(text)

  if (!readability.ok) {
    warnings.push(readability.reason || 'Document text could not be extracted in readable form.')
    return {
      status: 'failed',
      extractionSource: 'deterministic-fallback',
      extractedAt,
      warnings,
      fields,
      evidence,
    }
  }

  const monthlyPriceMatch = text.match(
    /(?:£|GBP\s?)(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:per month|monthly|pcm)/i,
  )
  if (monthlyPriceMatch) {
    const numeric = Number(monthlyPriceMatch[1].replace(/,/g, ''))
    if (Number.isFinite(numeric)) {
      fields.agreedMonthlyPrice = Math.round(numeric * 100) / 100
      fields.pricingText = monthlyPriceMatch[0]
      const idx = monthlyPriceMatch.index ?? -1
      const snippet = captureSnippet(text, idx, idx + monthlyPriceMatch[0].length)
      if (snippet) {
        evidence.agreedMonthlyPrice = snippet
        evidence.pricingText = snippet
      }
    }
  }

  const startDateAgreedMatch = text.match(
    /(?:start date agreed|has been agreed from|agreed from|agreed start date|starting from|commencing from|commence from|w\/c)\D{0,20}(w\/c\s*)?(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})/i,
  )
  if (startDateAgreedMatch) {
    const parsed = parseLooseDate(startDateAgreedMatch[2] || '')
    if (parsed) {
      fields.startDateAgreed = parsed
      const idx = startDateAgreedMatch.index ?? -1
      const snippet = captureSnippet(text, idx, idx + startDateAgreedMatch[0].length)
      if (snippet) evidence.startDateAgreed = snippet
    }
  }

  const daysPerWeekMatch = text.match(
    /(?:a\s+total\s+of\s+)?([1-7])\s*(?:day|day's|days|days')\s*(?:a|per)?\s*week/i,
  )
  if (daysPerWeekMatch) {
    const parsedDays = Number(daysPerWeekMatch[1])
    if (Number.isInteger(parsedDays) && parsedDays >= 1 && parsedDays <= 7) {
      fields.daysPerWeek = parsedDays
      const idx = daysPerWeekMatch.index ?? -1
      const snippet = captureSnippet(text, idx, idx + daysPerWeekMatch[0].length)
      if (snippet) evidence.daysPerWeek = snippet
    }
  }

  const datePatterns: Array<{
    key:
      | 'startDateAgreed'
      | 'contractSignedDate'
      | 'contractStartDate'
      | 'serviceStartDate'
      | 'billingStartDate'
      | 'contractEndDate'
      | 'renewalDate'
    regex: RegExp
  }> = [
    {
      key: 'startDateAgreed',
      regex:
        /(start date agreed|has been agreed from|agreed from|agreed start date|w\/c)\D{0,20}(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4})/i,
    },
    {
      key: 'contractStartDate',
      regex: /(contract start date|start date)\D{0,25}(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
    },
    {
      key: 'serviceStartDate',
      regex: /(service start date|services commence|services commencing)\D{0,25}(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
    },
    {
      key: 'billingStartDate',
      regex: /(billing start date|billing commences|billing starts)\D{0,25}(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
    },
    {
      key: 'contractEndDate',
      regex: /(contract end date|end date|expiry date|expires on)\D{0,25}(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
    },
    {
      key: 'renewalDate',
      regex: /(renewal date|renews on|auto[- ]renew(?:s|al)?)\D{0,25}(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
    },
    {
      key: 'contractSignedDate',
      regex: /(signed on|date signed|signature date|signed date)\D{0,25}(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
    },
  ]

  for (const pattern of datePatterns) {
    const match = text.match(pattern.regex)
    if (!match) continue
    const parsed = parseLooseDate(match[2] || '')
    if (!parsed) continue
    fields[pattern.key] = parsed
    const idx = match.index ?? -1
    const snippet = captureSnippet(text, idx, idx + match[0].length)
    if (snippet) evidence[pattern.key] = snippet
  }

  const termMatch = text.match(/(term|duration)\D{0,25}(\d{1,2})\s*(month|months|year|years)/i)
  if (termMatch) {
    const rawNumber = Number(termMatch[2])
    if (Number.isFinite(rawNumber) && rawNumber > 0) {
      fields.contractTermMonths = /year/i.test(termMatch[3]) ? rawNumber * 12 : rawNumber
      const idx = termMatch.index ?? -1
      const snippet = captureSnippet(text, idx, idx + termMatch[0].length)
      if (snippet) evidence.contractTermMonths = snippet
    }
  }

  if (text) {
    fields.agreementSummary = text.slice(0, 600) || null
    evidence.agreementSummary = text.slice(0, 200) || undefined
  }

  const extractedCount = countExtractedFields(fields)
  if (extractedCount === 0) {
    warnings.push('No defensible fields could be extracted from the uploaded document.')
  }

  return {
    status: extractedCount > 0 ? 'partial' : 'failed',
    extractionSource: 'deterministic-fallback',
    extractedAt,
    warnings,
    fields,
    evidence,
  }
}

export async function extractAgreementFields(params: {
  buffer: Buffer
  mimeType: string
  customerName: string
  fileName: string
}): Promise<AgreementExtractionResult> {
  const extractedAt = new Date().toISOString()

  try {
    const gemini = await tryGeminiExtraction(params)
    if (gemini) {
      const fields = sanitizeFields(gemini.parsed)
      const warnings = [...gemini.warnings]
      const extractedCount = countExtractedFields(fields)
      if (extractedCount === 0) {
        warnings.push('No defensible fields could be extracted from the uploaded document.')
      }
      return {
        status: extractedCount > 0 ? (warnings.length > 0 ? 'partial' : 'succeeded') : 'failed',
        extractionSource: 'gemini',
        extractedAt,
        warnings,
        fields,
        evidence: gemini.parsed.evidence || {},
      }
    }
  } catch (error) {
    console.error('[agreement-extraction] Gemini extraction failed:', error)
  }

  return tryDeterministicExtraction(params.buffer)
}

type AgreementAutomationInput = {
  accountData: Record<string, any>
  extraction: AgreementExtractionResult
  actorUserId?: string | null
  nowIso?: string
}

function getObject(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, any>
}

function buildOnboardingProgressFromSteps(steps: Record<string, any>, nowIso: string, updatedByUserId: string | null) {
  const totalSteps = ['company', 'ownership', 'leadSource', 'documents', 'contacts', 'notes'] as const
  const completedCount = totalSteps.filter((key) => steps[key]?.complete === true).length
  return {
    version: 1,
    updatedAt: nowIso,
    updatedByUserId: updatedByUserId || 'system',
    steps: {
      company: { complete: Boolean(steps.company?.complete), updatedAt: steps.company?.updatedAt || null },
      ownership: { complete: Boolean(steps.ownership?.complete), updatedAt: steps.ownership?.updatedAt || null },
      leadSource: { complete: Boolean(steps.leadSource?.complete), updatedAt: steps.leadSource?.updatedAt || null },
      documents: { complete: Boolean(steps.documents?.complete), updatedAt: steps.documents?.updatedAt || null },
      contacts: { complete: Boolean(steps.contacts?.complete), updatedAt: steps.contacts?.updatedAt || null },
      notes: { complete: Boolean(steps.notes?.complete), updatedAt: steps.notes?.updatedAt || null },
    },
    percentComplete: Math.round((completedCount / totalSteps.length) * 100),
    isComplete: completedCount === totalSteps.length,
  }
}

export function applyAgreementAutomation(params: AgreementAutomationInput): {
  accountData: Record<string, any>
  topLevelUpdates: {
    monthlyRevenueFromCustomer?: number
    monthlyIntakeGBP?: number
  }
  autoCompletedSteps: string[]
} {
  const { accountData, extraction, actorUserId = null, nowIso = new Date().toISOString() } = params
  const base = getObject(accountData)
  const accountDetails = getObject(base.accountDetails)
  const fields = extraction.fields
  const nextAccountDetails = { ...accountDetails }
  const topLevelUpdates: { monthlyRevenueFromCustomer?: number; monthlyIntakeGBP?: number } = {}
  const autoCompletedSteps: string[] = []

  const canonicalStartDate =
    fields.startDateAgreed ||
    fields.contractStartDate ||
    fields.serviceStartDate ||
    fields.billingStartDate ||
    null

  if (canonicalStartDate) {
    nextAccountDetails.startDateAgreed = canonicalStartDate
  }

  if (typeof fields.daysPerWeek === 'number' && Number.isFinite(fields.daysPerWeek)) {
    nextAccountDetails.daysPerWeek = fields.daysPerWeek
  }

  if (typeof fields.agreedMonthlyPrice === 'number' && Number.isFinite(fields.agreedMonthlyPrice)) {
    topLevelUpdates.monthlyRevenueFromCustomer = fields.agreedMonthlyPrice
    topLevelUpdates.monthlyIntakeGBP = fields.agreedMonthlyPrice
  }

  const nextAccountData: Record<string, any> = {
    ...base,
    accountDetails: nextAccountDetails,
    agreementExtraction: {
      status: extraction.status,
      extractionSource: extraction.extractionSource,
      extractedAt: extraction.extractedAt,
      warnings: extraction.warnings,
      fields: extraction.fields,
      evidence: extraction.evidence,
    },
  }

  const currentOnboardingProgress = getObject(base.onboardingProgress)
  const currentSteps = getObject(currentOnboardingProgress.steps)
  const shouldCompleteDocuments =
    extraction.status !== 'failed' &&
    (
      typeof fields.agreedMonthlyPrice === 'number' ||
      typeof fields.daysPerWeek === 'number' ||
      Boolean(
        fields.startDateAgreed ||
          fields.contractSignedDate ||
          fields.contractStartDate ||
          fields.serviceStartDate ||
          fields.billingStartDate ||
          fields.contractEndDate ||
          fields.renewalDate ||
          fields.contractTermMonths,
      )
    )

  if (shouldCompleteDocuments && currentSteps.documents?.complete !== true) {
    autoCompletedSteps.push('documents')
  }

  const nextSteps = {
    ...currentSteps,
    documents: shouldCompleteDocuments
      ? {
          ...(getObject(currentSteps.documents)),
          complete: true,
          updatedAt: nowIso,
        }
      : getObject(currentSteps.documents),
  }

  nextAccountData.onboardingProgress = buildOnboardingProgressFromSteps(nextSteps, nowIso, actorUserId)

  return {
    accountData: nextAccountData,
    topLevelUpdates,
    autoCompletedSteps,
  }
}
