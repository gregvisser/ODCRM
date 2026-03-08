#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-onboarding-activation-tightening-runtime: FAIL - ${message}`)
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
await getJson('/api/customers')
await getJson('/api/send-worker/console?windowHours=24')

const repoRoot = process.cwd()
const files = {
  onboardingHome: readFileSync(join(repoRoot, 'src', 'tabs', 'onboarding', 'OnboardingHomePage.tsx'), 'utf8'),
  readinessHelper: readFileSync(join(repoRoot, 'src', 'utils', 'clientReadinessState.ts'), 'utf8'),
  requireActiveClient: readFileSync(join(repoRoot, 'src', 'components', 'RequireActiveClient.tsx'), 'utf8'),
}

const markers = [
  'onboarding-role-framing',
  'onboarding-activation-framing',
  'onboarding-client-readiness-state',
  'onboarding-readiness-guidance',
  'onboarding-checkpoint-guidance',
  'onboarding-blocker-vs-proceed',
  'onboarding-activation-state',
  'onboarding-clients-vs-onboarding-guidance',
  'onboarding-transitional-leads-note',
  'onboarding-operations-handoff',
  'onboarding-readiness-next-step',
  'onboarding-go-marketing-readiness',
  'useClientReadinessState',
]

for (const marker of markers) {
  if (!files.onboardingHome.includes(marker)) fail(`OnboardingHomePage missing marker: ${marker}`)
}

for (const label of ['Setup needed', 'Data incomplete', 'Ready for outreach', 'Outreach active', 'Needs attention']) {
  if (!files.readinessHelper.includes(label)) fail(`shared readiness helper missing label: ${label}`)
}

if (!files.requireActiveClient.includes('NoActiveClientEmptyState')) {
  fail('active-client guard marker regressed')
}

console.log('PASS onboarding activation/setup framing markers exist')
console.log('PASS blocker vs proceed, clients-vs-onboarding, and operations handoff markers exist')
console.log('PASS shared readiness labels and active-client guard markers remain present')
console.log('self-test-onboarding-activation-tightening-runtime: PASS')
