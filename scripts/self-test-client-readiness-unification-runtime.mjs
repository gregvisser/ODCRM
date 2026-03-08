#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-client-readiness-unification-runtime: FAIL - ${message}`)
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

await getJson('/api/onboarding/readiness')
await getJson('/api/send-worker/console?windowHours=24')
await getJson('/api/send-worker/exception-center?sinceHours=24')

const repoRoot = process.cwd()
const files = {
  helper: readFileSync(join(repoRoot, 'src', 'utils', 'clientReadinessState.ts'), 'utf8'),
  hook: readFileSync(join(repoRoot, 'src', 'hooks', 'useClientReadinessState.ts'), 'utf8'),
  dashboard: readFileSync(join(repoRoot, 'src', 'tabs', 'dashboards', 'DashboardsHomePage.tsx'), 'utf8'),
  onboarding: readFileSync(join(repoRoot, 'src', 'tabs', 'onboarding', 'OnboardingHomePage.tsx'), 'utf8'),
  customers: readFileSync(join(repoRoot, 'src', 'tabs', 'customers', 'CustomersHomePage.tsx'), 'utf8'),
  marketingHome: readFileSync(join(repoRoot, 'src', 'tabs', 'marketing', 'MarketingHomePage.tsx'), 'utf8'),
  requireActiveClient: readFileSync(join(repoRoot, 'src', 'components', 'RequireActiveClient.tsx'), 'utf8'),
}

const expectedLabels = [
  'Setup needed',
  'Data incomplete',
  'Ready for outreach',
  'Outreach active',
  'Needs attention',
]
for (const label of expectedLabels) {
  if (!files.helper.includes(label)) fail(`shared readiness helper missing label: ${label}`)
}

const surfaceMarkers = [
  ['Dashboard', files.dashboard, 'dashboard-client-readiness-state'],
  ['Dashboard', files.dashboard, 'dashboard-readiness-next-step'],
  ['Onboarding', files.onboarding, 'onboarding-client-readiness-state'],
  ['Onboarding', files.onboarding, 'onboarding-readiness-next-step'],
  ['Customers', files.customers, 'customers-client-readiness-state'],
  ['Customers', files.customers, 'customers-readiness-next-step'],
  ['MarketingHome', files.marketingHome, 'marketing-client-readiness-state'],
  ['MarketingHome', files.marketingHome, 'marketing-readiness-next-step'],
]
for (const [scope, source, marker] of surfaceMarkers) {
  if (!source.includes(marker)) fail(`${scope} missing marker: ${marker}`)
}

const sharedHookMarkers = [
  ['Dashboard', files.dashboard, 'useClientReadinessState'],
  ['Onboarding', files.onboarding, 'useClientReadinessState'],
  ['Customers', files.customers, 'useClientReadinessState'],
  ['MarketingHome', files.marketingHome, 'useClientReadinessState'],
]
for (const [scope, source, marker] of sharedHookMarkers) {
  if (!source.includes(marker)) fail(`${scope} missing shared readiness hook usage: ${marker}`)
}

if (!files.hook.includes('/api/onboarding/readiness')) fail('shared readiness hook missing onboarding readiness route reference')
if (!files.hook.includes('/api/send-worker/console')) fail('shared readiness hook missing send-worker console route reference')

if (!files.requireActiveClient.includes('NoActiveClientEmptyState')) {
  fail('active-client guard wrapper regressed')
}

console.log('PASS shared readiness labels defined with employee-readable vocabulary')
console.log('PASS readiness state markers + next-step guidance exist across Dashboard/Onboarding/Clients/Marketing')
console.log('PASS shared readiness hook composes existing onboarding + marketing console truth surfaces')
console.log('PASS active-client guard remains in place')
console.log('self-test-client-readiness-unification-runtime: PASS')
