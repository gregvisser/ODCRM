/**
 * Guardrail: Sequences "Preview recipients — Lead source batch" modal
 * must use stable review columns (not raw row values as headers).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..', '..')
const src = readFileSync(path.join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'SequencesTab.tsx'), 'utf8')

assert.ok(src.includes('ModalHeader>Preview recipients — Lead source batch</ModalHeader>'))
assert.ok(src.includes('buildReviewColumnDefs('), 'Preview modal should derive review headers from shared logic')
assert.ok(src.includes('REVIEW_COLUMN_BATCH'), 'Preview modal should include synthetic batch column')
assert.ok(src.includes('REVIEW_COLUMN_CONTACT_NUMBER'), 'Preview modal should include synthetic contact number column')
assert.ok(src.includes('Default preview columns: Batch name, First Name, Last Name, Company, Role, Email, Contact number.'))
assert.ok(!src.includes('const computed = previewContacts.length ? visibleColumns(previewColumns, previewContacts) : previewColumns'))

console.log('sequences-preview-recipients-contract.test.ts: PASS')
