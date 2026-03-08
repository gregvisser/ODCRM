#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-dashboard-data-contract-runtime: FAIL - ${message}`)
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

const metrics = await getJson('/api/live/leads/metrics?customerId=' + encodeURIComponent(CUSTOMER_ID), [200, 400, 502])
if (metrics.status === 200) {
  if (metrics.body?.sourceOfTruth && !['google_sheets', 'db'].includes(String(metrics.body.sourceOfTruth))) {
    fail('/api/live/leads/metrics returned invalid sourceOfTruth value')
  }
  if (metrics.body?.staleFallbackUsed && metrics.body?.authoritative !== false) {
    fail('/api/live/leads/metrics stale fallback must not be authoritative')
  }
} else if (!metrics.body?.error) {
  fail('/api/live/leads/metrics failure response missing error payload')
}

const repoRoot = process.cwd()
const dashboard = readFileSync(join(repoRoot, 'src', 'tabs', 'dashboards', 'DashboardsHomePage.tsx'), 'utf8')

const requiredMarkers = [
  'dashboard-kpi-truth-contract',
  'dashboard-kpi-source-of-truth-mode',
  'dashboard-kpi-truth-error',
]
for (const marker of requiredMarkers) {
  if (!dashboard.includes(marker)) fail(`DashboardsHomePage missing marker: ${marker}`)
}

if (!dashboard.includes('useLiveLeadMetricsPolling')) fail('Dashboard is not wired to backend metrics polling')
if (dashboard.includes('useLiveLeadsPolling(')) fail('Dashboard still references legacy mixed live-leads KPI path')
if (dashboard.includes('parseLeadDateFlexible')) fail('Dashboard still contains device-local lead date parsing for KPI cards')

console.log('PASS dashboard KPI cards are wired to one backend metrics contract')
console.log('PASS source-of-truth mode and actionable KPI truth error markers are present')
console.log('PASS legacy device-local KPI parsing path is removed from dashboard')
console.log('self-test-dashboard-data-contract-runtime: PASS')
