/**
 * Run: npx --yes tsx src/utils/leadSourceReviewColumns.test.ts
 */
import assert from 'node:assert/strict'
import {
  buildReviewColumnDefs,
  contactPersonCell,
  getRecommendedContactNormKeys,
  humanizeLeadSourceNormHeader,
  REVIEW_COLUMN_BATCH,
  REVIEW_COLUMN_PERSON,
} from './leadSourceReviewColumns'

const defs = buildReviewColumnDefs(
  new Set(['companyname', 'email', 'firstname', 'lastname', 'jobtitle']),
)
assert.equal(defs[0].normKey, REVIEW_COLUMN_BATCH)
assert.equal(defs[0].header, 'Batch name')
assert.ok(defs.some((d) => d.normKey === 'companyname' && d.header === 'Company'))
assert.ok(defs.some((d) => d.normKey === 'email'))
assert.ok(defs.some((d) => d.normKey === REVIEW_COLUMN_PERSON))
assert.ok(defs.some((d) => d.normKey === 'jobtitle'))

assert.equal(contactPersonCell({ firstname: 'Ada', lastname: 'Lovelace' }), 'Ada Lovelace')
assert.equal(contactPersonCell({ firstname: 'Madonna', lastname: '' }), 'Madonna')

const rec = getRecommendedContactNormKeys(['email', 'jobtitle', 'noise'])
assert.deepEqual(rec, ['email', 'jobtitle'])

assert.equal(humanizeLeadSourceNormHeader('email', 'Email'), 'Email address')
assert.equal(humanizeLeadSourceNormHeader('unknown', 'Raw header'), 'Raw header')

console.log('✅ leadSourceReviewColumns tests passed')
