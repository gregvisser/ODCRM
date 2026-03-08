#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-customers-crm-data-health-runtime: FAIL - ${message}`)
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
  customersHome: readFileSync(join(repoRoot, 'src', 'tabs', 'customers', 'CustomersHomePage.tsx'), 'utf8'),
  readinessHelper: readFileSync(join(repoRoot, 'src', 'utils', 'clientReadinessState.ts'), 'utf8'),
  activeClientGuard: readFileSync(join(repoRoot, 'src', 'components', 'RequireActiveClient.tsx'), 'utf8'),
}

const requiredMarkers = [
  'customers-home-panel',
  'customers-role-framing',
  'customers-crm-data-health-framing',
  'customers-client-readiness-state',
  'customers-readiness-guidance',
  'customers-subarea-guidance-accounts',
  'customers-subarea-guidance-contacts',
  'customers-subarea-guidance-leads',
  'customers-transitional-leads-note',
  'customers-post-fix-handoff',
  'customers-readiness-next-step',
  'customers-go-marketing-readiness',
  'useClientReadinessState',
]

for (const marker of requiredMarkers) {
  if (!files.customersHome.includes(marker)) fail(`CustomersHomePage missing marker: ${marker}`)
}

const readinessLabels = [
  'Setup needed',
  'Data incomplete',
  'Ready for outreach',
  'Outreach active',
  'Needs attention',
]
for (const label of readinessLabels) {
  if (!files.readinessHelper.includes(label)) fail(`client readiness helper missing label: ${label}`)
}

if (!files.activeClientGuard.includes('NoActiveClientEmptyState')) {
  fail('active-client guard marker regressed')
}

console.log('PASS customers CRM/data-health framing markers exist')
console.log('PASS readiness-aware guidance + marketing handoff markers exist')
console.log('PASS transitional lead-model guidance marker exists')
console.log('PASS active-client guard marker remains present')
console.log('self-test-customers-crm-data-health-runtime: PASS')
