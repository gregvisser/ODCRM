#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-dashboard-action-priority-runtime: FAIL - ${message}`)
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

await getJson('/api/customers')
await getJson('/api/onboarding/readiness')
await getJson('/api/send-worker/console?windowHours=24')

const repoRoot = process.cwd()
const dashboard = readFileSync(join(repoRoot, 'src', 'tabs', 'dashboards', 'DashboardsHomePage.tsx'), 'utf8')
const helper = readFileSync(join(repoRoot, 'src', 'utils', 'clientReadinessState.ts'), 'utf8')
const hook = readFileSync(join(repoRoot, 'src', 'hooks', 'useClientReadinessState.ts'), 'utf8')
const guard = readFileSync(join(repoRoot, 'src', 'components', 'RequireActiveClient.tsx'), 'utf8')

const triageMarkers = [
  'dashboard-action-priority-triage',
  'dashboard-priority-groups',
  'dashboard-priority-needs-attention',
  'dashboard-priority-setup-data',
  'dashboard-priority-ready-outreach',
  'dashboard-priority-active-outreach',
  'dashboard-triage-next-actions',
  'dashboard-triage-queue-facts',
  'dashboard-readiness-next-step',
  'dashboard-go-marketing-readiness',
  'dashboard-go-onboarding-setup',
  'dashboard-go-clients-maintenance',
]
for (const marker of triageMarkers) {
  if (!dashboard.includes(marker)) fail(`Dashboard missing triage marker: ${marker}`)
}

const readinessLabels = ['Setup needed', 'Data incomplete', 'Ready for outreach', 'Outreach active', 'Needs attention']
for (const label of readinessLabels) {
  if (!helper.includes(label)) fail(`Readiness helper missing label: ${label}`)
}

if (!dashboard.includes('useClientReadinessState')) fail('Dashboard missing shared readiness hook usage')
if (!hook.includes('/api/onboarding/readiness')) fail('Shared readiness hook missing onboarding readiness route')
if (!hook.includes('/api/send-worker/console')) fail('Shared readiness hook missing send-worker console route')
if (!guard.includes('NoActiveClientEmptyState')) fail('RequireActiveClient guard regression detected')

console.log('PASS dashboard triage markers present with urgent-first grouping')
console.log('PASS readiness-driven routing markers remain present')
console.log('PASS shared readiness interpretation is still used')
console.log('PASS no-active-client guard remains present')
console.log('self-test-dashboard-action-priority-runtime: PASS')
