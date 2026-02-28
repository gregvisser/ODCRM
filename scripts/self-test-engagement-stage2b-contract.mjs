#!/usr/bin/env node
/**
 * Self-test: Stage 2B live sending contract doc exists and contains required headings/phrases.
 * Regression guard only; no runtime behavior changes.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const docPath = path.join(root, 'docs', 'product', 'ENGAGEMENT_PIPELINE_STAGE2B_LIVE_SENDING.md')

const REQUIRED_PHRASES = [
  'Kill-switch',
  'Canary',
  'Rate limits',
  'Working hours',
  'Suppression',
  'Idempotency',
  'Definition of Done',
]

function main() {
  if (!fs.existsSync(docPath)) {
    console.error('self-test-engagement-stage2b-contract: FAIL — file not found:', docPath)
    process.exit(1)
  }

  const content = fs.readFileSync(docPath, 'utf8')
  const missing = REQUIRED_PHRASES.filter((p) => !content.includes(p))
  if (missing.length) {
    console.error('self-test-engagement-stage2b-contract: FAIL — doc missing required phrases/headings:', missing.join(', '))
    process.exit(1)
  }

  console.log('self-test-engagement-stage2b-contract: OK')
  process.exit(0)
}

main()
