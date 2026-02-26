#!/usr/bin/env node
/**
 * Self-test: engagement pipeline contract doc exists and contains required headings.
 * No runtime behavior changes; regression guard only.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const docPath = path.join(root, 'docs', 'product', 'ENGAGEMENT_PIPELINE_CONTRACT.md')

const REQUIRED_HEADINGS = [
  'Engagement Pipeline Contract',
  'Definitions',
  'Invariants',
  'State machine',
  'API surface',
  'Rollout plan',
]

function main() {
  if (!fs.existsSync(docPath)) {
    console.error('self-test-engagement-contract: FAIL — file not found:', docPath)
    process.exit(1)
  }

  const content = fs.readFileSync(docPath, 'utf8')
  const missing = REQUIRED_HEADINGS.filter((h) => !content.includes(h))
  if (missing.length) {
    console.error('self-test-engagement-contract: FAIL — doc missing required headings:', missing.join(', '))
    process.exit(1)
  }

  console.log('self-test-engagement-contract: OK')
  process.exit(0)
}

main()
