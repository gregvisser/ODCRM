#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-operator-console-ui-runtime: FAIL - ${message}`)
  process.exit(1)
}

if (!CUSTOMER_ID) fail('CUSTOMER_ID env var is required')

async function getJson(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Accept: 'application/json',
      'X-Customer-Id': CUSTOMER_ID,
    },
  })
  const text = await response.text()
  if (!response.ok) fail(`GET ${path} returned ${response.status}: ${text.slice(0, 300)}`)
  try {
    return text ? JSON.parse(text) : null
  } catch {
    fail(`GET ${path} returned non-JSON`)
  }
}

const consolePayload = await getJson('/api/send-worker/console?sinceHours=24')
if (!consolePayload?.success || !consolePayload?.data || typeof consolePayload.data !== 'object') {
  fail('operator console backend envelope invalid')
}

const auditsPayload = await getJson('/api/send-worker/audits?limit=5')
const auditItems = Array.isArray(auditsPayload?.data?.items) ? auditsPayload.data.items : []

const repoRoot = process.cwd()
const sequencesPath = join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'SequencesTab.tsx')
const marketingHomePath = join(repoRoot, 'src', 'tabs', 'marketing', 'MarketingHomePage.tsx')
const sequencesSource = readFileSync(sequencesPath, 'utf8')
const marketingHomeSource = readFileSync(marketingHomePath, 'utf8')

if (!sequencesSource.includes('Sending Console')) {
  fail('SequencesTab does not include Sending Console UI marker')
}
if (!sequencesSource.includes('/api/send-worker/console')) {
  fail('SequencesTab is not wired to /api/send-worker/console')
}
if (!sequencesSource.includes('sending-console-panel')) {
  fail('SequencesTab missing deterministic sending console render marker')
}
if (!marketingHomeSource.includes('SequencesTab')) {
  fail('MarketingHomePage is not wiring SequencesTab')
}

console.log(`PASS backend console route reachable mode=${consolePayload.data?.status?.scheduledEngineMode ?? 'unknown'}`)
console.log(`PASS frontend console markers present in SequencesTab (sending-console-panel, /api/send-worker/console, Sending Console)`)
console.log(`PASS audits reachable rows=${auditItems.length}`)
console.log('self-test-operator-console-ui-runtime: PASS')
