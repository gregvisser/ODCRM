/**
 * Operator-flow hardening checks for Cognism lead sources.
 * Static assertions keep this guardrail lightweight and fast.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..', '..')

function read(rel: string): string {
  return readFileSync(path.join(repoRoot, rel), 'utf8')
}

function testConnectionTruthfulnessAndTokenHint(): void {
  const src = read('src/tabs/marketing/components/LeadSourcesTabNew.tsx')
  assert.match(
    src,
    /src\.sourceType === 'COGNISM' && src\.providerMode !== 'COGNISM_API'/,
    'Cognism should not show ready state when providerMode is not COGNISM_API'
  )
  assert.match(src, /label: 'Error'/, 'Connection status should expose explicit error state label')
  assert.match(src, /cognismTokenLast4/, 'UI should keep masked token hint support')
}

function testEmptyImportHandling(): void {
  const src = read('src/tabs/marketing/components/LeadSourcesTabNew.tsx')
  assert.match(src, /Import returned no contacts/, 'Import flow should show clear empty-result state')
  assert.match(src, /Cognism returned zero contacts/, 'Empty import message should be operator-friendly')
}

function testContactsReviewAndMaterializeGuardrails(): void {
  const src = read('src/tabs/marketing/components/LeadSourcesTabNew.tsx')
  assert.match(
    src,
    /No imported contacts are available for this batch yet\. Run Import from Cognism and try again\./,
    'Contacts review should have explicit empty state from persisted-import perspective'
  )
  assert.match(
    src,
    /No contacts to materialize/,
    'Use-in-sequence path should guard when a batch has no rows'
  )
}

const tests: Array<{ name: string; fn: () => void }> = [
  { name: 'Connection status is truthful and token hint remains masked', fn: testConnectionTruthfulnessAndTokenHint },
  { name: 'Import flow handles empty Cognism results clearly', fn: testEmptyImportHandling },
  { name: 'Contacts review and materialize guardrails are explicit', fn: testContactsReviewAndMaterializeGuardrails },
]

for (const test of tests) {
  test.fn()
  console.log(`PASS ${test.name}`)
}

console.log('lead-sources-cognism-operator-hardening.test.ts: PASS')
