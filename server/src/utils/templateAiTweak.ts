import { z } from 'zod'

/**
 * Tone / rewrite modes for POST /api/templates/ai/tweak (and :id variant).
 * Legacy values are classic "tone" labels; human_outreach / concise_outreach are rewrite-style modes.
 */
export const TEMPLATE_AI_TONES = [
  'professional',
  'friendly',
  'casual',
  'formal',
  'persuasive',
  'human_outreach',
  'concise_outreach',
] as const

export type TemplateAiTone = (typeof TEMPLATE_AI_TONES)[number]

const LEGACY_TONES: ReadonlySet<string> = new Set([
  'professional',
  'friendly',
  'casual',
  'formal',
  'persuasive',
])

export const aiTweakRequestSchema = z.object({
  templateBody: z.string().min(1, 'Template body is required'),
  templateSubject: z.string().optional(),
  contactName: z.string().optional(),
  contactCompany: z.string().optional(),
  contactTitle: z.string().optional(),
  contactIndustry: z.string().optional(),
  tone: z.enum(TEMPLATE_AI_TONES).default('professional'),
  instruction: z.string().optional(),
  preservePlaceholders: z.boolean().default(true),
})

/** Options for POST /api/templates/:id/ai/tweak — body fields optional; template text comes from DB. */
export const templateByIdAiTweakSchema = z.object({
  templateBody: z.string().optional(),
  templateSubject: z.string().optional(),
  contactName: z.string().optional(),
  contactCompany: z.string().optional(),
  contactTitle: z.string().optional(),
  contactIndustry: z.string().optional(),
  tone: z.enum(TEMPLATE_AI_TONES).optional(),
  instruction: z.string().optional(),
  preservePlaceholders: z.boolean().optional(),
  saveResult: z.boolean().optional(),
})

/**
 * Prompt suffix for tweakEmailWithAI (after recipient context). Centralizes mode-specific rules.
 */
export function buildTemplateAiTweakPromptSuffix(tone: TemplateAiTone): string {
  if (tone === 'human_outreach') {
    return `
Rewrite mode: Human / 1:1 Outreach

Rewrite this template so it reads like a direct email from a real account manager or operator — plain language, natural rhythm, and commercially honest. This is NOT for evading spam filters or hiding commercial intent.

You MUST:
- Preserve every placeholder token exactly (including [[ODCRM_TOKEN_n]] markers and any {{name}} forms after restoration). Do not invent new placeholders.
- Keep unsubscribe, signature, and compliance-related placeholders intact (e.g. tokens for unsubscribe links or signatures). Do not remove or rewrite those markers.
- Keep factual claims aligned with the source; do not invent relationships, referrals, research, or personalization that the text does not already support.
- Prefer shorter sentences, one clear ask / CTA, and one low-friction next step.
- Avoid newsletter tone, multiple CTAs, long dense paragraphs, and obvious marketing boilerplate.

Avoid phrases and patterns like (unless already in the source): "drive significant growth", "seamless extension of your team", "numerous sectors", heavy sales clichés, overexcited hype, fake familiarity, or claiming you researched the recipient unless the source already says that.

If a subject line is included, make it simpler and more human — not promotional or clickbait.`
  }

  if (tone === 'concise_outreach') {
    return `
Rewrite mode: Concise Outreach

Make this template shorter and more direct than a typical "professional" rewrite: low fluff, plain language, one CTA, easy to scan.

You MUST:
- Preserve every placeholder token exactly (including [[ODCRM_TOKEN_n]] markers). Do not invent new placeholders.
- Keep unsubscribe, signature, and compliance-related placeholders intact.
- Do not remove commercial honesty; do not imply deceptive or evasive intent.

If a subject line is included, keep it short and specific — not salesy.`
  }

  if (LEGACY_TONES.has(tone)) {
    return `\nDesired Tone: ${tone}`
  }

  return `\nDesired Tone: professional`
}
