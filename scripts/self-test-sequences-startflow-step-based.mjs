#!/usr/bin/env node
/**
 * Static regression: Sequences start flow must be step-based (not legacy top-level templateId gating).
 * Asserts:
 *  - SequencesTab does NOT require a top-level templateId to start
 *  - Start flow references step-based templates sync (/api/campaigns/:id/templates) before /start
 * No network. Exit 0 = PASS, 1 = FAIL.
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const file = join(root, 'src', 'tabs', 'marketing', 'components', 'SequencesTab.tsx')
const content = readFileSync(file, 'utf8')

function fail(msg) {
  console.error(`self-test-sequences-startflow-step-based: FAIL — ${msg}`)
  process.exit(1)
}

// 1) Guard against legacy gating: “templateId” must not be used as a start requirement.
// We allow the identifier to exist elsewhere (types/legacy), but we FAIL if we see a start validation error message
// or explicit required check that blocks start when templateId missing.
const legacyBlockPatterns = [
  /templateId.*required/i,
  /missing.*templateId/i,
  /select.*template/i,            // legacy UI copy often showed this
  /cannot start.*template/i,
]
if (legacyBlockPatterns.some((re) => re.test(content))) {
  fail('found legacy templateId gating/copy that suggests start requires a top-level templateId')
}

// 2) Must sync templates before start: require presence of templates endpoint and start endpoint usage.
const hasTemplatesSync = /\/api\/campaigns\/\$\{.*\}\/templates/.test(content) || /campaigns\/.*\/templates/.test(content)
const hasStartCall = /\/api\/campaigns\/\$\{.*\}\/start/.test(content) || /campaigns\/.*\/start/.test(content)
if (!hasTemplatesSync) fail('expected templates sync call (/api/campaigns/:id/templates) in start flow')
if (!hasStartCall) fail('expected start call (/api/campaigns/:id/start) in start flow')

// 3) Must reference steps/step-based templates in some way (broad check).
const hasStepsConcept = /steps?/i.test(content)
if (!hasStepsConcept) fail('expected step-based concept (steps) to appear in SequencesTab.tsx')

console.log('self-test-sequences-startflow-step-based: PASS')
process.exit(0)
