#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-onboarding-ui-flow-runtime: FAIL - ${message}`)
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

const repoRoot = process.cwd()
const onboardingHomeSource = readFileSync(join(repoRoot, 'src', 'tabs', 'onboarding', 'OnboardingHomePage.tsx'), 'utf8')

if (onboardingHomeSource.includes("id: 'overview'")) {
  fail('OnboardingHomePage still includes overview sub-tab in nav items')
}
if (onboardingHomeSource.includes('OnboardingOverview')) {
  fail('OnboardingHomePage still references OnboardingOverview in the live tab flow')
}
if (!onboardingHomeSource.includes("export type OnboardingViewId = 'customer-onboarding' | 'progress-tracker'")) {
  fail('OnboardingHomePage OnboardingViewId is not constrained to live sub-views')
}
if (!onboardingHomeSource.includes("return 'customer-onboarding'")) {
  fail('OnboardingHomePage legacy/default view coercion missing customer-onboarding fallback')
}
if (!onboardingHomeSource.includes('const effectiveActiveView: OnboardingViewId = selectedCustomerId ? activeView : \'progress-tracker\'')) {
  fail('OnboardingHomePage missing no-client fallback to progress-tracker active view')
}
if (!onboardingHomeSource.includes('Select a client (or create one from the dropdown) to begin onboarding.')) {
  fail('OnboardingHomePage missing no-client onboarding guidance')
}

console.log('PASS onboarding live UI flow excludes Overview sub-tab')
console.log('PASS onboarding defaults/legacy deep-links resolve to live views safely')
console.log('PASS onboarding no-client fallback state remains safe')
console.log('self-test-onboarding-ui-flow-runtime: PASS')
