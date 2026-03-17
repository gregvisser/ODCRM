#!/usr/bin/env node
/**
 * Static regression: Sequences operator UI strings (labels, explainer, no Stage refs).
 * No network. Exit 0 = PASS, 1 = FAIL.
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const file = join(root, 'src/tabs/marketing/components/SequencesTab.tsx')
const content = readFileSync(file, 'utf8')

const required = [
  'Preview email',
  'Next operator action',
  'Live audience',
  'Test audience',
  'Latest send result',
  'Live outreach view',
  'Show troubleshooting tools',
]
const forbidden = ['Stage 2A', 'Stage 3', '(Stage']

const missing = required.filter((s) => !content.includes(s))
const foundForbidden = forbidden.filter((s) => content.includes(s))

if (missing.length > 0) {
  console.error('self-test-sequences-operator-ui: FAIL — missing required strings:', missing.join(', '))
  process.exit(1)
}
if (foundForbidden.length > 0) {
  console.error('self-test-sequences-operator-ui: FAIL — forbidden strings still present:', foundForbidden.join(', '))
  process.exit(1)
}
console.log('self-test-sequences-operator-ui: PASS')
process.exit(0)
