#!/usr/bin/env node
/**
 * Static regression: Send Queue Preview panel must show helper text for Details location.
 * Asserts "Details are available in the Send Queue drawer (View queue)." exists in UI source.
 * No network. Exit 0 = PASS, 1 = FAIL.
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const file = join(root, 'src/tabs/marketing/components/SequencesTab.tsx')
const content = readFileSync(file, 'utf8')

const required = 'Details are available in the Send Queue drawer (View queue).'
if (!content.includes(required)) {
  console.error('self-test-send-queue-details-helper: FAIL — helper string not found in SequencesTab.tsx')
  process.exit(1)
}
console.log('self-test-send-queue-details-helper: PASS')
process.exit(0)
