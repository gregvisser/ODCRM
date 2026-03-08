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

const leadsRes = await getJson('/api/live/leads?customerId=' + encodeURIComponent(CUSTOMER_ID), [200, 400])
if (leadsRes.status === 200) {
  if (!Array.isArray(leadsRes.body?.leads)) fail('/api/live/leads response missing leads[]')
  if (typeof leadsRes.body?.rowCount !== 'number') fail('/api/live/leads response missing rowCount')
  if (!('staleFallbackUsed' in (leadsRes.body || {}))) fail('/api/live/leads response missing staleFallbackUsed')
} else {
  if (!leadsRes.body?.error) fail('/api/live/leads 400 response missing error')
  if (String(leadsRes.body.error).includes('Failed to fetch or parse CSV')) {
    fail('/api/live/leads still returns opaque legacy CSV parse error text')
  }
}

const metricsRes = await getJson('/api/live/leads/metrics?customerId=' + encodeURIComponent(CUSTOMER_ID), [200, 400])
if (metricsRes.status === 200) {
  if (typeof metricsRes.body?.totalLeads !== 'number') fail('/api/live/leads/metrics missing totalLeads')
  if (typeof metricsRes.body?.rowCount !== 'number') fail('/api/live/leads/metrics missing rowCount')
  if (!('staleFallbackUsed' in (metricsRes.body || {}))) fail('/api/live/leads/metrics missing staleFallbackUsed')
} else {
  if (!metricsRes.body?.error) fail('/api/live/leads/metrics 400 response missing error')
  if (String(metricsRes.body.error).includes('Failed to fetch or parse CSV')) {
    fail('/api/live/leads/metrics still returns opaque legacy CSV parse error text')
  }
}

const repoRoot = process.cwd()
const liveRoute = readFileSync(join(repoRoot, 'server', 'src', 'routes', 'liveLeads.ts'), 'utf8')
const liveHook = readFileSync(join(repoRoot, 'src', 'hooks', 'useLiveLeadsPolling.ts'), 'utf8')
const liveApi = readFileSync(join(repoRoot, 'src', 'utils', 'liveLeadsApi.ts'), 'utf8')
const leadsTab = readFileSync(join(repoRoot, 'src', 'components', 'LeadsTab.tsx'), 'utf8')
const marketingLeadsTab = readFileSync(join(repoRoot, 'src', 'components', 'MarketingLeadsTab.tsx'), 'utf8')

if (!liveRoute.includes('staleFallbackUsed')) fail('liveLeads route missing stale fallback response wiring')
if (!liveRoute.includes('hint:')) fail('liveLeads route missing actionable failure hint')
if (liveHook.includes("view !== 'leads-reporting'")) fail('useLiveLeadsPolling still hard-blocked outside leads-reporting view')
if (!liveApi.includes('staleFallbackUsed?: boolean')) fail('liveLeadsApi types missing stale fallback field')
if (!leadsTab.includes('leads-tab-stale-sheet-warning')) fail('LeadsTab missing stale sheet warning marker')
if (!marketingLeadsTab.includes('marketing-leads-stale-sheet-warning')) fail('MarketingLeadsTab missing stale sheet warning marker')

console.log('PASS live leads endpoints expose stale fallback and actionable error hints')
console.log('PASS frontend live-leads polling is no longer hard-blocked to one view only')
console.log('PASS leads surfaces expose deterministic stale-sheet warning markers')
console.log('self-test-google-sheets-data-plane-runtime: PASS')
