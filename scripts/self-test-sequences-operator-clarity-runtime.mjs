#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-sequences-operator-clarity-runtime: FAIL - ${message}`)
  process.exit(1)
}

if (!CUSTOMER_ID) fail('CUSTOMER_ID env var is required')

async function getJsonAllow404(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: 'application/json', 'X-Customer-Id': CUSTOMER_ID },
  })
  const text = await response.text()
  if (response.status === 404) return { status: 404, body: text }
  if (!response.ok) fail(`GET ${path} returned ${response.status}: ${text.slice(0, 300)}`)
  try {
    return { status: response.status, body: text ? JSON.parse(text) : null }
  } catch {
    fail(`GET ${path} returned non-JSON`)
  }
}

const sequenceRes = await getJsonAllow404('/api/sequences')
if (sequenceRes.status === 404) fail('/api/sequences returned 404')

const repoRoot = process.cwd()
const sequencesPath = join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'SequencesTab.tsx')
const source = readFileSync(sequencesPath, 'utf8')

const uiMarkers = [
  'sequences-tab-core-workflow',
  'Daily workflow',
  'sending-console-panel',
  'sequences-tab-advanced-review',
  'sequences-tab-toggle-diagnostics',
  'sequence-preflight-panel',
  'launch-preview-panel',
  'run-history-panel',
  'preview-vs-outcome-panel',
  'exception-center-panel',
  'queue-workbench-panel',
  'sequences-tab-cross-nav',
]

for (const marker of uiMarkers) {
  if (!source.includes(marker)) fail(`Missing Sequences clarity marker: ${marker}`)
}

console.log('PASS sequences endpoint reachable')
console.log('PASS clarity markers present for core workflow and advanced diagnostics separation')
console.log('PASS advanced diagnostic panels remain reachable in source wiring')
console.log('self-test-sequences-operator-clarity-runtime: PASS')
