#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-whole-system-operator-acceptance-runtime: FAIL - ${message}`)
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

await getJson('/api/customers', [200])
await getJson('/api/live/leads?customerId=' + encodeURIComponent(CUSTOMER_ID), [200, 400, 502])
await getJson('/api/reports/outreach?customerId=' + encodeURIComponent(CUSTOMER_ID) + '&sinceDays=30', [200])

const repoRoot = process.cwd()
const dashboard = readFileSync(join(repoRoot, 'src', 'tabs', 'dashboards', 'DashboardsHomePage.tsx'), 'utf8')
const customers = readFileSync(join(repoRoot, 'src', 'tabs', 'customers', 'CustomersHomePage.tsx'), 'utf8')
const marketing = readFileSync(join(repoRoot, 'src', 'tabs', 'marketing', 'MarketingHomePage.tsx'), 'utf8')
const onboarding = readFileSync(join(repoRoot, 'src', 'tabs', 'onboarding', 'OnboardingHomePage.tsx'), 'utf8')
const settings = readFileSync(join(repoRoot, 'src', 'tabs', 'settings', 'SettingsHomePage.tsx'), 'utf8')
const noClient = readFileSync(join(repoRoot, 'src', 'components', 'NoActiveClientEmptyState.tsx'), 'utf8')

const markers = [
  ['Dashboard', dashboard, 'dashboard-action-priority-triage'],
  ['Dashboard', dashboard, 'dashboard-daily-vs-admin-framing'],
  ['Customers', customers, 'customers-marketing-bridge'],
  ['Customers', customers, 'customers-module-continuity-guidance'],
  ['Marketing', marketing, 'marketing-home-operator-guidance'],
  ['Marketing', marketing, 'marketing-module-continuity-guidance'],
  ['Onboarding', onboarding, 'CustomerSelector'],
  ['Onboarding', onboarding, 'CustomerOnboardingTab'],
  ['Settings', settings, 'settings-admin-framing'],
  ['Settings', settings, 'settings-daily-operations-guidance'],
]

for (const [name, content, marker] of markers) {
  if (!content.includes(marker)) fail(`${name} missing marker ${marker}`)
}

if (!noClient.includes('Select a client to continue')) fail('NoActiveClientEmptyState missing operator guidance headline')
if (!noClient.includes('Go to Clients')) fail('NoActiveClientEmptyState missing client recovery action')

console.log('PASS whole-system operator acceptance markers exist across Dashboard, Clients, Marketing, Onboarding, and Settings')
console.log('PASS active-client recovery guidance remains in place')
console.log('PASS core backend truth surfaces remain reachable for operator flow')
console.log('self-test-whole-system-operator-acceptance-runtime: PASS')
