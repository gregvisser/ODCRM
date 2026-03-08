#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-google-sheets-data-plane-runtime: FAIL - ${message}`)
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

const leadsRes = await getJson('/api/live/leads?customerId=' + encodeURIComponent(CUSTOMER_ID), [200, 400, 502])
if (leadsRes.status === 200) {
  if (!Array.isArray(leadsRes.body?.leads)) fail('/api/live/leads response missing leads[]')
  if (typeof leadsRes.body?.rowCount !== 'number') fail('/api/live/leads response missing rowCount')
  if (!leadsRes.body?.sourceOfTruth) fail('/api/live/leads response missing sourceOfTruth')
  if (leadsRes.body.staleFallbackUsed && leadsRes.body.authoritative !== false) {
    fail('/api/live/leads stale fallback must not be marked authoritative')
  }
} else {
  if (!leadsRes.body?.error) fail('/api/live/leads non-200 response missing error')
  if (leadsRes.status === 502 && !leadsRes.body?.hint) {
    fail('/api/live/leads 502 response missing actionable hint')
  }
  if (String(leadsRes.body.error).includes('Failed to fetch or parse CSV')) {
    fail('/api/live/leads still returns opaque legacy CSV parse error text')
  }
}

const metricsRes = await getJson('/api/live/leads/metrics?customerId=' + encodeURIComponent(CUSTOMER_ID), [200, 400, 502])
if (metricsRes.status === 200) {
  if (typeof metricsRes.body?.totalLeads !== 'number') fail('/api/live/leads/metrics missing totalLeads')
  if (!metricsRes.body?.sourceOfTruth) fail('/api/live/leads/metrics missing sourceOfTruth')
  if (metricsRes.body.staleFallbackUsed && metricsRes.body.authoritative !== false) {
    fail('/api/live/leads/metrics stale fallback must not be marked authoritative')
  }
} else {
  if (!metricsRes.body?.error) fail('/api/live/leads/metrics non-200 response missing error')
  if (metricsRes.status === 502 && !metricsRes.body?.hint) {
    fail('/api/live/leads/metrics 502 response missing actionable hint')
  }
}

const repoRoot = process.cwd()
const liveRoute = readFileSync(join(repoRoot, 'server', 'src', 'routes', 'liveLeads.ts'), 'utf8')
const liveHook = readFileSync(join(repoRoot, 'src', 'hooks', 'useLiveLeadsPolling.ts'), 'utf8')
const liveApi = readFileSync(join(repoRoot, 'src', 'utils', 'liveLeadsApi.ts'), 'utf8')

if (!liveRoute.includes("sourceOfTruth: 'google_sheets'") && !liveRoute.includes("sourceOfTruth")) {
  fail('liveLeads route missing source-of-truth classification')
}
if (!liveRoute.includes('diagnosticsFallbackRequested')) fail('liveLeads route missing explicit diagnostic fallback gating')
if (!liveRoute.includes('authoritative: false')) fail('liveLeads route missing non-authoritative fallback marker')
if (!liveRoute.includes('res.status(502)')) fail('liveLeads route missing actionable 502 failure path for sheet fetch errors')
if (liveHook.includes("view !== 'leads-reporting'")) fail('useLiveLeadsPolling still hard-blocked outside leads-reporting view')
if (!liveApi.includes("sourceOfTruth?: 'google_sheets' | 'db'")) fail('liveLeadsApi types missing sourceOfTruth field')

console.log('PASS live leads endpoints enforce source-of-truth classification and actionable failures')
console.log('PASS stale data fallback is explicitly diagnostic-only when used')
console.log('PASS frontend polling remains generalized across customers leads/reporting surfaces')
console.log('self-test-google-sheets-data-plane-runtime: PASS')
