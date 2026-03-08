#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-dashboard-reports-role-separation-runtime: FAIL - ${message}`)
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

await getJson('/api/reports/outreach?customerId=' + encodeURIComponent(CUSTOMER_ID) + '&sinceDays=30')

const repoRoot = process.cwd()
const dashboard = readFileSync(join(repoRoot, 'src', 'tabs', 'dashboards', 'DashboardsHomePage.tsx'), 'utf8')
const reports = readFileSync(join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'ReportsTab.tsx'), 'utf8')

const dashboardMarkers = [
  'dashboard-live-triage-role-separation',
  'dashboard-go-reports-retrospective',
  'dashboard-action-priority-triage',
]
for (const marker of dashboardMarkers) {
  if (!dashboard.includes(marker)) fail(`DashboardsHomePage missing marker: ${marker}`)
}

const reportsMarkers = [
  'reports-retrospective-role-separation',
  'reports-go-dashboard-triage',
  'reports-tab-operator-cue',
]
for (const marker of reportsMarkers) {
  if (!reports.includes(marker)) fail(`ReportsTab missing marker: ${marker}`)
}

console.log('PASS dashboard vs reports role separation markers present')
console.log('PASS cross-handoff cues exist between live triage and retrospective analysis')
console.log('self-test-dashboard-reports-role-separation-runtime: PASS')
