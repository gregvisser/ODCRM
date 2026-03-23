/**
 * Guardrail: batch list API and UI reflect truthful batch-key dimensions (no misleading Client column).
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

function testBatchRouteExposesDateBucketAndNormalizedJob(): void {
  const src = read('server/src/routes/leadSources.ts')
  assert.match(src, /dateBucket:/, 'batches payload must include dateBucket')
  assert.match(src, /normalizeBatchKeySegmentForResponse/, 'job segment must use same normalization as client')
  assert.match(src, /batchKeySegmentForLabel/, 'fallback labels must omit (none) segments')
}

function testLeadSourcesTabBatchTableHasDateNotClientColumn(): void {
  const src = read('src/tabs/marketing/components/LeadSourcesTabNew.tsx')
  const idx = src.indexOf('lead-sources-batches-table')
  assert.ok(idx >= 0, 'batches table must exist')
  const slice = src.slice(idx, idx + 4500)
  assert.match(slice, />\s*Date\s*</, 'batches table must include Date column header')
  assert.ok(!slice.includes('>Client</Th>'), 'batches table must not use a Client column header')
}

function testApiTypeAllowsJobTitleNull(): void {
  const src = read('src/utils/leadSourcesApi.ts')
  assert.match(src, /jobTitle\?: string \| null/, 'LeadSourceBatch.jobTitle should be nullable')
}

const tests: Array<{ name: string; fn: () => void }> = [
  { name: 'Batch route exposes dateBucket and normalized segments', fn: testBatchRouteExposesDateBucketAndNormalizedJob },
  { name: 'LeadSourcesTabNew batches table has Date not Client', fn: testLeadSourcesTabBatchTableHasDateNotClientColumn },
  { name: 'leadSourcesApi LeadSourceBatch allows null jobTitle', fn: testApiTypeAllowsJobTitleNull },
]

for (const test of tests) {
  test.fn()
  console.log(`PASS ${test.name}`)
}

console.log('lead-sources-batch-table.test.ts: PASS')
