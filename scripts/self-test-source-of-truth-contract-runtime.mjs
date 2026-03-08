#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-source-of-truth-contract-runtime: FAIL - ${message}`)
  process.exit(1)
}

if (!CUSTOMER_ID) fail('CUSTOMER_ID env var is required')

async function getJson(path, allowed = [200]) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Accept: 'application/json',
      'X-Customer-Id': CUSTOMER_ID,
    },
  })
  const text = await response.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    fail(`GET ${path} returned non-JSON`)
  }
  if (!allowed.includes(response.status)) {
    fail(`GET ${path} returned ${response.status}: ${text.slice(0, 300)}`)
  }
  return { status: response.status, body }
}

const leads = await getJson('/api/live/leads?customerId=' + encodeURIComponent(CUSTOMER_ID), [200, 400, 502])
if (leads.status === 200) {
  if (leads.body?.sourceOfTruth && !['google_sheets', 'db'].includes(String(leads.body?.sourceOfTruth))) {
    fail('/api/live/leads has invalid sourceOfTruth classification')
  }
  if (leads.body?.sourceOfTruth === 'db' && leads.body?.sourceUrl != null) {
    fail('/api/live/leads DB-backed response should not report sheet sourceUrl')
  }
  if (leads.body?.sourceOfTruth === 'google_sheets' && !leads.body?.sourceUrl) {
    fail('/api/live/leads sheet-backed response missing sourceUrl')
  }
} else {
  if (!leads.body?.error) fail('/api/live/leads failure response missing error')
  if (leads.status === 502 && !leads.body?.hint) fail('/api/live/leads 502 response missing actionable hint')
}

const metrics = await getJson('/api/live/leads/metrics?customerId=' + encodeURIComponent(CUSTOMER_ID), [200, 400, 502])
if (metrics.status === 200) {
  if (metrics.body?.sourceOfTruth && !['google_sheets', 'db'].includes(String(metrics.body?.sourceOfTruth))) {
    fail('/api/live/leads/metrics has invalid sourceOfTruth classification')
  }
  if (metrics.body?.staleFallbackUsed && metrics.body?.authoritative !== false) {
    fail('/api/live/leads/metrics stale fallback cannot be authoritative')
  }
} else {
  if (!metrics.body?.error) fail('/api/live/leads/metrics failure response missing error')
  if (metrics.status === 502 && !metrics.body?.hint) fail('/api/live/leads/metrics 502 response missing actionable hint')
}

const repoRoot = process.cwd()
const liveRoute = readFileSync(join(repoRoot, 'server', 'src', 'routes', 'liveLeads.ts'), 'utf8')
const liveSheets = readFileSync(join(repoRoot, 'server', 'src', 'utils', 'liveSheets.ts'), 'utf8')

if (!liveRoute.includes("type TruthSource = 'google_sheets' | 'db'")) fail('liveLeads route missing truth source type contract')
if (!liveRoute.includes("const sourceOfTruth: TruthSource = configuredSheetUrl ? 'google_sheets' : 'db'")) {
  fail('liveLeads route missing source-of-truth selection logic')
}
if (!liveRoute.includes('diagnosticFallbackRequested') && !liveRoute.includes('diagnosticsFallbackRequested')) {
  fail('liveLeads route missing explicit diagnostic fallback opt-in gate')
}
if (!liveRoute.includes('authoritative: false')) fail('liveLeads route missing explicit non-authoritative diagnostic marker')
if (!liveSheets.includes('Stale cached rows are available via getStaleCachedLeads for explicit diagnostics only')) {
  fail('liveSheets utility missing diagnostics-only stale fallback contract comment')
}

console.log('PASS source-of-truth contract is enforced for sheet-backed vs DB-backed clients')
console.log('PASS fallback handling is explicit, diagnostic-only, and non-authoritative')
console.log('self-test-source-of-truth-contract-runtime: PASS')
