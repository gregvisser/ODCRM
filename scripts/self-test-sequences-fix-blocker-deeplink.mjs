#!/usr/bin/env node
/**
 * Static regression: Fix blocker action deep-links to targeted sequence editor sections.
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
  'type SequenceEditorFocusTarget = \'details\' | \'audience\' | \'sender\' | \'steps\' | \'launch\'',
  'const getSequenceFixBlockerFocusTarget = (',
  "case 'No live recipients'",
  "case 'Live recipients not chosen'",
  "case 'No active mailbox'",
  "case 'Mailbox not selected'",
  "case 'Name missing'",
  "case 'Save changes first'",
  "case 'Start requirements incomplete'",
  'sequenceAudienceSelectRef',
  'sequenceSenderSelectRef',
  'sequenceNameInputRef',
  'sequenceLaunchSectionRef',
  'Open the section most likely to fix this blocker.',
  'handleSequencePrimaryAction',
]

const missing = required.filter((marker) => !content.includes(marker))

if (missing.length > 0) {
  console.error('self-test-sequences-fix-blocker-deeplink: FAIL — missing markers:', missing.join(', '))
  process.exit(1)
}

console.log('self-test-sequences-fix-blocker-deeplink: PASS')
