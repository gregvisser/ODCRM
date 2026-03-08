#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-top-level-flow-spine-runtime: FAIL - ${message}`)
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
const files = {
  app: readFileSync(join(repoRoot, 'src', 'App.tsx'), 'utf8'),
  dashboard: readFileSync(join(repoRoot, 'src', 'tabs', 'dashboards', 'DashboardsHomePage.tsx'), 'utf8'),
  onboarding: readFileSync(join(repoRoot, 'src', 'tabs', 'onboarding', 'OnboardingHomePage.tsx'), 'utf8'),
  customers: readFileSync(join(repoRoot, 'src', 'tabs', 'customers', 'CustomersHomePage.tsx'), 'utf8'),
  requireActiveClient: readFileSync(join(repoRoot, 'src', 'components', 'RequireActiveClient.tsx'), 'utf8'),
  noActiveClient: readFileSync(join(repoRoot, 'src', 'components', 'NoActiveClientEmptyState.tsx'), 'utf8'),
}

const requiredMarkers = [
  ['App', files.app, 'navigateToMarketing'],
  ['Dashboard', files.dashboard, 'dashboard-next-step-routing'],
  ['Dashboard', files.dashboard, 'dashboard-go-marketing-readiness'],
  ['Dashboard', files.dashboard, 'dashboard-go-onboarding-setup'],
  ['Dashboard', files.dashboard, 'dashboard-go-clients-maintenance'],
  ['Dashboard', files.dashboard, 'dashboard-role-framing'],
  ['Onboarding', files.onboarding, 'onboarding-marketing-bridge'],
  ['Onboarding', files.onboarding, 'onboarding-go-marketing-readiness'],
  ['Onboarding', files.onboarding, 'onboarding-role-framing'],
  ['Customers', files.customers, 'customers-marketing-bridge'],
  ['Customers', files.customers, 'customers-go-marketing-readiness'],
  ['Customers', files.customers, 'customers-role-framing'],
]

for (const [scope, source, marker] of requiredMarkers) {
  if (!source.includes(marker)) fail(`${scope} missing marker: ${marker}`)
}

const guardMarkers = [
  ['Dashboard', files.dashboard, 'RequireActiveClient'],
  ['RequireActiveClient', files.requireActiveClient, 'NoActiveClientEmptyState'],
  ['NoActiveClientEmptyState', files.noActiveClient, 'Go to Clients'],
]

for (const [scope, source, marker] of guardMarkers) {
  if (!source.includes(marker)) fail(`${scope} missing tenant guard marker: ${marker}`)
}

console.log('PASS top-level backend truth surfaces reachable for dashboard/setup/marketing handoff flow')
console.log('PASS dashboard next-step routing markers present')
console.log('PASS onboarding and clients include explicit marketing readiness bridge markers')
console.log('PASS no active-client guard markers remain present')
console.log('self-test-top-level-flow-spine-runtime: PASS')
