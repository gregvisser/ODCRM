/**
 * Runtime check: server dist normalizeTaxonomyLabel matches expected dedupe semantics.
 * Run after `cd server && npm run build` (imports compiled util).
 */
import assert from 'node:assert'
import { normalizeTaxonomyLabel } from '../server/dist/utils/taxonomyLabel.js'

const spaced = normalizeTaxonomyLabel('  Business   Development  ')
const lower = normalizeTaxonomyLabel('business development')
assert.strictEqual(spaced.toLowerCase(), lower.toLowerCase())
assert.strictEqual(spaced, 'Business Development')
assert.strictEqual(lower, 'business development')
console.log('SELF_TEST_OK taxonomy label')
