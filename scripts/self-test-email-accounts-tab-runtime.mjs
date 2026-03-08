#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-email-accounts-tab-runtime: FAIL - ${message}`)
  process.exit(1)
}

if (!CUSTOMER_ID) fail('CUSTOMER_ID env var is required')

async function getJsonAllow404(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: 'application/json', 'X-Customer-Id': CUSTOMER_ID },
  })
  const text = await response.text()
  if (response.status === 404) return { status: 404, body: text }
  if (!response.ok) fail(`GET ${path} returned ${response.status}: ${text.slice(0, 300)}`)
  try {
    return { status: response.status, body: text ? JSON.parse(text) : null }
  } catch {
    fail(`GET ${path} returned non-JSON`)
  }
}

const identitiesRes = await getJsonAllow404(`/api/outlook/identities?customerId=${encodeURIComponent(CUSTOMER_ID)}`)
if (identitiesRes.status === 404) fail('/api/outlook/identities returned 404')
const identityRows = Array.isArray(identitiesRes.body) ? identitiesRes.body : identitiesRes.body?.data
if (!Array.isArray(identityRows)) fail('/api/outlook/identities payload should be array or { data: [] }')

const capacityRes = await getJsonAllow404('/api/send-worker/identity-capacity?sinceHours=72')
if (capacityRes.status === 404) fail('/api/send-worker/identity-capacity returned 404')
if (!capacityRes.body?.success || !capacityRes.body?.data?.summary) fail('identity-capacity payload missing summary')

const repoRoot = process.cwd()
const tabPath = join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'EmailAccountsTab.tsx')
const homePath = join(repoRoot, 'src', 'tabs', 'marketing', 'MarketingHomePage.tsx')
const tabSource = readFileSync(tabPath, 'utf8')
const homeSource = readFileSync(homePath, 'utf8')

const markers = [
  'email-accounts-tab-panel',
  'email-accounts-tab-refresh-btn',
  'email-accounts-tab-connect-outlook-btn',
  'email-accounts-identity-capacity-panel',
  'email-accounts-identity-summary',
  'email-accounts-identity-guardrails',
  'email-accounts-identity-rows',
  'email-accounts-identity-state',
  'email-accounts-last-updated',
  '/api/send-worker/identity-capacity',
]
for (const marker of markers) {
  if (!tabSource.includes(marker)) fail(`EmailAccountsTab missing marker: ${marker}`)
}

if (!homeSource.includes('Email Accounts')) fail('MarketingHomePage missing Email Accounts nav entry')
if (!homeSource.includes('EmailAccountsTab')) fail('MarketingHomePage missing EmailAccountsTab wiring')

console.log(`PASS email identities reachable count=${identityRows.length}`)
console.log(`PASS identity capacity reachable usable=${capacityRes.body.data.summary.usable ?? 0} risky=${capacityRes.body.data.summary.risky ?? 0}`)
console.log('PASS email accounts tab markers present')
console.log('self-test-email-accounts-tab-runtime: PASS')
