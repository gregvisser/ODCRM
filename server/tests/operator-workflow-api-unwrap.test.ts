/**
 * Guardrail: Marketing operator surfaces must not double-unwrap api.get/api.post payloads.
 * api.ts unwrapResponsePayload lifts { data: T } so ApiResponse.data is T (not T.data).
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

function testReadinessTabSendWorkerUsesSingleUnwrap(): void {
  const src = read('src/tabs/marketing/components/ReadinessTab.tsx')
  assert.ok(!src.includes('results[0]?.data?.data'), 'Readiness must not use results[n].data.data')
  assert.match(src, /setExceptionCenterData\(results\[0\]\?\.data/)
}

function testSchedulesTabDetailUsesSingleUnwrap(): void {
  const src = read('src/tabs/marketing/components/SchedulesTab.tsx')
  assert.ok(!src.includes('preflightRes?.data?.data'))
  assert.ok(!src.includes('historyRes?.data?.data'))
  assert.match(src, /setPreflightData\(preflightRes\?\.data/)
}

function testSequencesTabAuditsAndOperatorActionsUseSingleUnwrap(): void {
  const src = read('src/tabs/marketing/components/SequencesTab.tsx')
  assert.ok(!src.includes('res.data?.data'), 'SequencesTab must not use res.data?.data after api unwrap')
  assert.match(src, /const items = res\.data\?\.items/)
}

const tests: Array<{ name: string; fn: () => void }> = [
  { name: 'ReadinessTab send-worker results use single unwrap', fn: testReadinessTabSendWorkerUsesSingleUnwrap },
  { name: 'SchedulesTab detail uses single unwrap', fn: testSchedulesTabDetailUsesSingleUnwrap },
  { name: 'SequencesTab audits and operator actions use single unwrap', fn: testSequencesTabAuditsAndOperatorActionsUseSingleUnwrap },
]

for (const test of tests) {
  test.fn()
  console.log(`PASS ${test.name}`)
}

console.log('operator-workflow-api-unwrap.test.ts: PASS')
