#!/usr/bin/env node
/**
 * Regression check: Create Enrollment modal contains recipient source labels.
 * Static file check only; no network. Exit 0 = PASS, 1 = FAIL.
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const file = join(root, 'src/tabs/marketing/components/SequencesTab.tsx')
const required = [
  'Recipients source',
  'Use Leads Snapshot (recommended)',
  'Paste emails manually (advanced)',
]

const content = readFileSync(file, 'utf8')
const missing = required.filter((label) => !content.includes(label))
if (missing.length > 0) {
  console.error('self-test-enrollment-recipient-source-ui: FAIL — missing labels:', missing.join(', '))
  process.exit(1)
}
console.log('self-test-enrollment-recipient-source-ui: PASS')
process.exit(0)
