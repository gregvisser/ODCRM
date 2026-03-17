#!/usr/bin/env node
/**
 * Static regression: opened sequence detail exposes a compact launch readiness panel.
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
  'type SequenceLaunchReadinessSignal = {',
  'const sequenceLaunchReadinessPanel = editingSequence ? (() => {',
  'sequence-launch-readiness-panel',
  'Launch readiness',
  'Overall:',
  'Strongest next action',
  'Choose mailbox.',
  'Pick live audience.',
  'Add content.',
  'Wait for send window.',
  'Resume sequence.',
  'Ready to start.',
  "label: 'Overall'",
  "label: 'Mailbox'",
  "label: 'Audience'",
  "label: 'Content'",
  "label: 'Window'",
]

const missing = required.filter((marker) => !content.includes(marker))

if (missing.length > 0) {
  console.error('self-test-sequence-launch-readiness-panel: FAIL — missing markers:', missing.join(', '))
  process.exit(1)
}

console.log('self-test-sequence-launch-readiness-panel: PASS')
