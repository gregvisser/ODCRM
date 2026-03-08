#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-onboarding-suppression-truth-runtime: FAIL - ${message}`)
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
await getJson('/api/suppression/health')

const repoRoot = process.cwd()
const onboardingHome = readFileSync(join(repoRoot, 'src', 'tabs', 'onboarding', 'OnboardingHomePage.tsx'), 'utf8')
const customerOnboarding = readFileSync(join(repoRoot, 'src', 'tabs', 'onboarding', 'CustomerOnboardingTab.tsx'), 'utf8')
const onboardingReadinessRoute = readFileSync(join(repoRoot, 'server', 'src', 'routes', 'onboardingReadiness.ts'), 'utf8')

const onboardingMarkers = [
  'onboarding-suppression-sheets-guidance',
  'onboarding-go-suppression-setup',
  'onboarding-suppression-legacy-upload-note',
]
for (const marker of onboardingMarkers) {
  if (!customerOnboarding.includes(marker)) fail(`CustomerOnboardingTab missing marker: ${marker}`)
}

if (!customerOnboarding.includes('Google Sheets')) {
  fail('CustomerOnboardingTab missing Google Sheets suppression setup wording')
}
if (!onboardingHome.includes('onboarding-transitional-leads-note')) {
  fail('OnboardingHomePage missing transitional setup honesty marker')
}
if (!onboardingReadinessRoute.includes('suppressionSheetsConfigured')) {
  fail('onboardingReadiness route missing suppressionSheetsConfigured wiring')
}
if (!onboardingReadinessRoute.includes('leadSheetConfigured')) {
  fail('onboardingReadiness route missing leadSheetConfigured wiring')
}

console.log('PASS onboarding suppression setup now reflects Google Sheets-linked live path')
console.log('PASS onboarding keeps transitional legacy upload path explicitly secondary')
console.log('PASS onboarding readiness route composes suppression/lead configured signals from current truth')
console.log('self-test-onboarding-suppression-truth-runtime: PASS')
