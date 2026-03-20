/**
 * SchedulesTab: tenant headers on schedule + send-worker calls; no double-unwrap on detail fetches.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..', '..')
const src = readFileSync(path.join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'SchedulesTab.tsx'), 'utf8')

assert.ok(src.includes('useScopedCustomerSelection'), 'SchedulesTab should use useScopedCustomerSelection')
assert.match(src, /api\.get<CampaignSchedule\[]>\('\/api\/schedules',\s*\{\s*headers:\s*customerHeaders\s*\}/)
assert.match(src, /\/api\/schedules\/emails\?limit=200',\s*\{\s*headers:\s*customerHeaders\s*\}/)
assert.match(src, /\/stats`,\s*\{\s*headers:\s*customerHeaders\s*\}/)

function chunkAfter(needle: string, len = 400): string {
  const i = src.indexOf(needle)
  assert.ok(i >= 0, `missing ${needle}`)
  return src.slice(i, i + len)
}

assert.ok(chunkAfter('/api/send-worker/sequence-preflight').includes('headers: customerHeaders'), 'preflight must pass customerHeaders')
assert.ok(chunkAfter('/api/send-worker/run-history').includes('headers: customerHeaders'), 'run-history must pass customerHeaders')
assert.ok(
  (src.match(/\{\s*headers:\s*customerHeaders\s*\}/g) || []).length >= 6,
  'SchedulesTab should pass customerHeaders on all tenant API calls (expect at least 6)',
)
assert.ok(chunkAfter('/api/send-worker/sequence-test-send').includes('headers: customerHeaders'), 'test-send must pass customerHeaders')

assert.ok(!src.includes('preflightRes?.data?.data'), 'Must not double-unwrap preflight response')
assert.ok(!src.includes('historyRes?.data?.data'), 'Must not double-unwrap run-history response')
assert.ok(src.includes('DETAIL_SINCE_HOURS'), 'Detail window constant should remain documented in source')

console.log('schedules-tab-contract.test.ts: PASS')
