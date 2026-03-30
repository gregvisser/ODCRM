/**
 * Deterministic checks for template AI tweak modes (no live Gemini calls).
 * Run: cd server && npx tsx tests/templates-ai-modes.test.ts
 */
import assert from 'node:assert/strict'
import { aiTweakRequestSchema, buildTemplateAiTweakPromptSuffix } from '../src/utils/templateAiTweak.js'
import {
  protectPlaceholders,
  restorePlaceholders,
  preservedPlaceholdersMatch,
} from '../src/services/aiEmailService.js'

// 1) human_outreach accepted by schema
{
  const parsed = aiTweakRequestSchema.parse({
    templateBody: 'Hi {{first_name}}',
    tone: 'human_outreach',
  })
  assert.equal(parsed.tone, 'human_outreach')
}

// 2) concise_outreach accepted
{
  const parsed = aiTweakRequestSchema.parse({
    templateBody: 'Test',
    tone: 'concise_outreach',
  })
  assert.equal(parsed.tone, 'concise_outreach')
}

// 3) Placeholders round-trip through mask/restore (same pipeline as tweakEmailWithAI)
{
  const sample = 'Hello {{first_name}}, at {{company_name}} use {{unsubscribe_link}}.'
  const prot = protectPlaceholders(sample)
  assert.ok(prot && prot.placeholders.length >= 3)
  const restored = restorePlaceholders(prot!.text, prot!.placeholders)
  assert.ok(preservedPlaceholdersMatch(restored, prot!.placeholders))
  assert.ok(restored.includes('{{first_name}}'))
  assert.ok(restored.includes('{{unsubscribe_link}}'))
}

// 4) Professional mode unchanged at prompt level (still "Desired Tone: professional")
{
  const s = buildTemplateAiTweakPromptSuffix('professional')
  assert.ok(s.includes('Desired Tone: professional'))
  assert.ok(!s.includes('Human / 1:1'))
}

// 5) human_outreach mode block present
{
  const s = buildTemplateAiTweakPromptSuffix('human_outreach')
  assert.ok(s.includes('Human / 1:1'))
  assert.ok(s.includes('unsubscribe'))
}

// 6) concise_outreach mode block present
{
  const s = buildTemplateAiTweakPromptSuffix('concise_outreach')
  assert.ok(s.includes('Concise Outreach'))
}

console.log('templates-ai-modes.test.ts: PASS')
