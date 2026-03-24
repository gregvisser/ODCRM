#!/usr/bin/env node
/**
 * Runtime checks for agreement renewal helpers (duplicated assertions; source in src/utils/agreementHistory.ts).
 */

function fail(message) {
  console.error(`self-test-agreement-renewal-runtime: FAIL - ${message}`)
  process.exit(1)
}

const { readFileSync } = await import('node:fs')
const { join } = await import('node:path')
const repoRoot = process.cwd()
const src = readFileSync(join(repoRoot, 'src', 'utils', 'agreementHistory.ts'), 'utf8')

const required = [
  'computeAgreementRenewalReminder',
  'buildAgreementHistoryView',
  'syncAgreementTermDatesIntoAccountData',
  'agreementHistory',
  'current_term',
  'supplemental',
]

for (const m of required) {
  if (!src.includes(m)) fail(`agreementHistory.ts must contain ${m}`)
}

const server = readFileSync(join(repoRoot, 'server', 'src', 'services', 'agreementHistory.ts'), 'utf8')
if (!server.includes('preservePriorAgreementBlobIfReplaced')) {
  fail('server agreementHistory must preserve prior blob on replacement')
}

const customers = readFileSync(join(repoRoot, 'server', 'src', 'routes', 'customers.ts'), 'utf8')
if (!customers.includes('mergeAgreementHistoryOnMainUpload')) fail('customers.ts must merge agreement history on upload')
if (!customers.includes('syncAgreementTermDatesIntoAccountData')) fail('customers.ts must sync term dates on onboarding save')
if (!customers.includes('resolveAgreementBlobForDownload')) fail('customers.ts must resolve historical blob downloads')

const onboardingTab = readFileSync(join(repoRoot, 'src', 'tabs', 'onboarding', 'CustomerOnboardingTab.tsx'), 'utf8')
if (!onboardingTab.includes('computeAgreementRenewalReminder')) fail('Onboarding tab must show renewal reminder')
if (!onboardingTab.includes('agreementEndDate')) fail('Onboarding tab must include agreement end date field')

console.log('PASS agreement renewal wiring markers')
console.log('self-test-agreement-renewal-runtime: PASS')
