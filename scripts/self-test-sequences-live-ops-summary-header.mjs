#!/usr/bin/env node
/**
 * Static regression: mounted Sequences screen exposes a compact live-ops summary header.
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
  'const liveOpsSummary = (() => {',
  'sequences-live-ops-summary-header',
  'Live ops snapshot',
  'Current sequence fleet counts from the mounted row state. Click a summary to filter the table.',
  'sequences-summary-ready-now',
  'sequences-summary-needs-attention',
  'sequences-summary-running',
  'sequences-summary-archived',
  'Ready now',
  'Needs attention',
  'Running',
  'Archived',
  'Mailbox blocker:',
  'Audience blocker:',
  'Content blocker:',
  'Waiting for send window:',
]

const missing = required.filter((marker) => !content.includes(marker))

if (missing.length > 0) {
  console.error('self-test-sequences-live-ops-summary-header: FAIL — missing markers:', missing.join(', '))
  process.exit(1)
}

console.log('self-test-sequences-live-ops-summary-header: PASS')
