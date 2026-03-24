#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function fail(message) {
  console.error(`self-test-onboarding-client-switch-runtime: FAIL - ${message}`)
  process.exit(1)
}

const repoRoot = process.cwd()
const onboardingHome = readFileSync(join(repoRoot, 'src', 'tabs', 'onboarding', 'OnboardingHomePage.tsx'), 'utf8')
const onboardingTab = readFileSync(join(repoRoot, 'src', 'tabs', 'onboarding', 'CustomerOnboardingTab.tsx'), 'utf8')

if (!onboardingHome.includes('<CustomerOnboardingTab key={selectedCustomerId} customerId={selectedCustomerId} />')) {
  fail('OnboardingHomePage must remount CustomerOnboardingTab by selectedCustomerId key')
}

const requiredTabMarkers = [
  'activeCustomerIdRef',
  'fetchRequestSeqRef',
  'hydratedCustomerIdRef',
  'if (requestSeq !== fetchRequestSeqRef.current) return',
  'if (activeCustomerIdRef.current !== requestedCustomerId) return',
  'if (activeCustomerIdRef.current !== saveCustomerId)',
  'setAccountDetails(EMPTY_ACCOUNT_DETAILS)',
  'setClientProfile(EMPTY_PROFILE)',
]

for (const marker of requiredTabMarkers) {
  if (!onboardingTab.includes(marker)) {
    fail(`CustomerOnboardingTab missing client-switch guard marker: ${marker}`)
  }
}

console.log('PASS onboarding remount key and stale-async guards are present')
console.log('PASS customer-switch state reset markers are present')
console.log('self-test-onboarding-client-switch-runtime: PASS')
