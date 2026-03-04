#!/usr/bin/env node
/**
 * Static regression: Send Queue side panel contains operator UI strings.
 * Asserts Run dry-run worker, Admin secret (local), and Details are present.
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
  'Run dry-run worker',
  'Admin secret (local)',
  'Details',
]

const missing = required.filter((s) => !content.includes(s))
if (missing.length > 0) {
  console.error('self-test-send-queue-operator-ui: FAIL — missing required strings:', missing.join(', '))
  process.exit(1)
}
console.log('self-test-send-queue-operator-ui: PASS')
process.exit(0)
