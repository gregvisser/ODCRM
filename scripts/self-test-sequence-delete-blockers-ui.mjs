#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const file = join(process.cwd(), 'src', 'tabs', 'marketing', 'components', 'SequencesTab.tsx')
const source = readFileSync(file, 'utf8')

const requiredMarkers = [
  'Sequence deletion blocked',
  'Linked campaigns still depend on this sequence',
  'Completed or paused campaigns keep this sequence attached for historical reporting, so deletion stays blocked.',
  'Open linked sequence',
  'sequenceDeleteBlockers',
  'isDeleteBlockedOpen',
  'getSequenceDeleteReasonText',
]

const missing = requiredMarkers.filter((marker) => !source.includes(marker))

if (missing.length > 0) {
  console.error(`self-test-sequence-delete-blockers-ui: FAIL - missing markers: ${missing.join(', ')}`)
  process.exit(1)
}

console.log('self-test-sequence-delete-blockers-ui: PASS')
