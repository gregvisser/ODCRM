#!/usr/bin/env node
/**
 * Static regression: mounted Sequences rows expose compact send-confidence markers.
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
  'type SequenceSendConfidenceSignal = {',
  'const getSequenceSendConfidenceSummary = (sequence: SequenceCampaign): SequenceSendConfidenceSignal[] => {',
  "label: 'Mailbox'",
  "label: 'Audience'",
  "label: 'Content'",
  "label: 'Window'",
  'sequence-row-send-confidence',
  '{signal.label}: {signal.value}',
]

const missing = required.filter((marker) => !content.includes(marker))

if (missing.length > 0) {
  console.error('self-test-sequences-send-confidence-summary: FAIL — missing markers:', missing.join(', '))
  process.exit(1)
}

console.log('self-test-sequences-send-confidence-summary: PASS')
