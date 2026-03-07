#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-marketing-ops-reporting-runtime: FAIL - ${message}`)
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
  if (!response.ok) {
    fail(`GET ${path} returned ${response.status}: ${text.slice(0, 300)}`)
  }
  try {
    return text ? JSON.parse(text) : null
  } catch {
    fail(`GET ${path} returned non-JSON`)
  }
}

const outreachPayload = await getJson(`/api/reports/outreach?customerId=${encodeURIComponent(CUSTOMER_ID)}&sinceDays=30`)
const data = outreachPayload?.data || outreachPayload
if (!data || typeof data !== 'object') fail('/api/reports/outreach payload missing data')
if (!Array.isArray(data.bySequence)) fail('outreach.bySequence is not an array')
if (!Array.isArray(data.byIdentity)) fail('outreach.byIdentity is not an array')
if (data.recentReasons != null && typeof data.recentReasons !== 'object') fail('outreach.recentReasons should be an object when present')

const auditsPayload = await getJson('/api/send-worker/audits?limit=5')
if (!auditsPayload?.success || !Array.isArray(auditsPayload?.data?.items)) {
  fail('/api/send-worker/audits payload invalid')
}

const repoRoot = process.cwd()
const sequencesTabPath = join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'SequencesTab.tsx')
const source = readFileSync(sequencesTabPath, 'utf8')
const markers = [
  'marketing-ops-reporting-panel',
  'marketing-ops-reporting-summary',
  'Marketing Ops Reporting',
  '/api/reports/outreach',
]
for (const marker of markers) {
  if (!source.includes(marker)) {
    fail(`SequencesTab missing marker: ${marker}`)
  }
}

console.log(`PASS outreach endpoint reachable bySequence=${data.bySequence.length} byIdentity=${data.byIdentity.length}`)
console.log(`PASS audits endpoint reachable rows=${auditsPayload.data.items.length}`)
console.log('PASS marketing ops reporting UI markers present')
console.log('self-test-marketing-ops-reporting-runtime: PASS')
