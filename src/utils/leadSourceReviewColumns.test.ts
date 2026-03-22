/**
 * Run: npx --yes tsx src/utils/leadSourceReviewColumns.test.ts
 */
import assert from 'node:assert/strict'
import {
  buildReviewColumnDefs,
  contactNumberCell,
  getRecommendedContactNormKeys,
  humanizeLeadSourceNormHeader,
  REVIEW_COLUMN_BATCH,
  REVIEW_COLUMN_CONTACT_NUMBER,
} from './leadSourceReviewColumns'

const defs = buildReviewColumnDefs(
  new Set(['companyname', 'email', 'firstname', 'lastname', 'jobtitle', 'mobile']),
)
assert.equal(defs[0].normKey, REVIEW_COLUMN_BATCH)
assert.equal(defs[0].header, 'Batch name')
assert.equal(defs[1].normKey, 'firstname')
assert.equal(defs[2].normKey, 'lastname')
assert.ok(defs.some((d) => d.normKey === 'companyname' && d.header === 'Company'))
assert.ok(defs.some((d) => d.normKey === 'email'))
assert.ok(defs.some((d) => d.normKey === REVIEW_COLUMN_CONTACT_NUMBER))
assert.ok(defs.some((d) => d.normKey === 'jobtitle'))

assert.equal(contactNumberCell({ mobile: '123', directphone: '456' }), '123')
assert.equal(contactNumberCell({ directphone: '456' }), '456')
assert.equal(contactNumberCell({}), '')

const rec = getRecommendedContactNormKeys(['email', 'jobtitle', 'noise'])
assert.deepEqual(rec, ['jobtitle', 'email'])

const recWithMeta = getRecommendedContactNormKeys(['odcrmfirstseenat', 'email', 'firstname'])
assert.deepEqual(recWithMeta, ['odcrmfirstseenat', 'firstname', 'email'])

assert.equal(humanizeLeadSourceNormHeader('email', 'Email'), 'Email')
assert.equal(humanizeLeadSourceNormHeader('unknown', 'Raw header'), 'Raw header')

console.log('✅ leadSourceReviewColumns tests passed')
