#!/usr/bin/env node
/**
 * Static regression: mounted Sequences rows expose operator-readable state, blocker, and CTA markers.
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
  'Operator state',
  'Latest result',
  "label: 'Ready'",
  "label: 'Running'",
  "label: 'Paused'",
  "label: 'Blocked'",
  "label: 'Completed'",
  "label: 'Archived'",
  'Ready to send now',
  'No live recipients',
  'No active mailbox',
  'Waiting for send window',
  'Sequence paused',
  'Fix blocker',
  'Ready now',
  'Needs attention',
  'Running',
  'Archived',
]

const missing = required.filter((marker) => !content.includes(marker))

if (missing.length > 0) {
  console.error('self-test-sequences-row-readability-contract: FAIL — missing markers:', missing.join(', '))
  process.exit(1)
}

console.log('self-test-sequences-row-readability-contract: PASS')
