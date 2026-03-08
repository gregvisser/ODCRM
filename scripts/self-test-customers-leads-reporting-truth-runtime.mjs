#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-customers-leads-reporting-truth-runtime: FAIL - ${message}`)
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

await getJson('/api/customers')
const leadsRes = await getJson('/api/live/leads?customerId=' + encodeURIComponent(CUSTOMER_ID), [200, 400, 502])
if (leadsRes.status === 200 && !leadsRes.body?.sourceOfTruth) {
  fail('/api/live/leads 200 response missing sourceOfTruth')
}
if (leadsRes.status === 502) {
  if (!leadsRes.body?.hint) fail('/api/live/leads 502 response missing actionable hint')
  if (!leadsRes.body?.sourceOfTruth) fail('/api/live/leads 502 response missing sourceOfTruth')
}
if (leadsRes.status === 400 && !leadsRes.body?.error) {
  fail('/api/live/leads 400 response missing error')
}

await getJson('/api/reports/outreach?customerId=' + encodeURIComponent(CUSTOMER_ID) + '&sinceDays=30')

const repoRoot = process.cwd()
const customersHome = readFileSync(join(repoRoot, 'src', 'tabs', 'customers', 'CustomersHomePage.tsx'), 'utf8')
const leadsReportingTab = readFileSync(join(repoRoot, 'src', 'components', 'LeadsReportingTab.tsx'), 'utf8')
const leadsTab = readFileSync(join(repoRoot, 'src', 'components', 'LeadsTab.tsx'), 'utf8')

if (!customersHome.includes('customers-transitional-leads-note')) fail('CustomersHomePage missing transitional lead-truth guidance marker')
if (!customersHome.includes('customers-post-fix-handoff')) fail('CustomersHomePage missing post-fix handoff marker')
if (!leadsReportingTab.includes('Source of truth:')) fail('LeadsReportingTab missing source-of-truth guidance copy')
if (!leadsTab.includes('Source of truth:')) fail('LeadsTab missing source-of-truth guidance copy')
if (!leadsReportingTab.includes('leads-reporting-stale-sheet-warning')) fail('LeadsReportingTab missing deterministic stale warning marker')
if (!leadsTab.includes('leads-tab-stale-sheet-warning')) fail('LeadsTab missing deterministic stale warning marker')

console.log('PASS customers leads/reporting surfaces expose source-of-truth guidance')
console.log('PASS leads/reporting APIs provide actionable failure details when sheet-backed fetch fails')
console.log('PASS transitional guidance and marketing handoff markers remain intact in Customers')
console.log('self-test-customers-leads-reporting-truth-runtime: PASS')
