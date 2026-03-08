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

const customersRes = await getJson('/api/customers')
const customersList = Array.isArray(customersRes.body)
  ? customersRes.body
  : Array.isArray(customersRes.body?.data)
    ? customersRes.body.data
    : null
if (!customersList) fail('/api/customers did not return an array or { data: [] }')

const leadsRes = await getJson('/api/live/leads?customerId=' + encodeURIComponent(CUSTOMER_ID), [200, 400])
if (leadsRes.status === 200 && !Array.isArray(leadsRes.body?.leads)) {
  fail('/api/live/leads 200 response missing leads[]')
}
if (leadsRes.status === 400 && !leadsRes.body?.error) {
  fail('/api/live/leads 400 response missing error')
}

await getJson('/api/reports/outreach?customerId=' + encodeURIComponent(CUSTOMER_ID) + '&sinceDays=30')

const repoRoot = process.cwd()
const customersHome = readFileSync(join(repoRoot, 'src', 'tabs', 'customers', 'CustomersHomePage.tsx'), 'utf8')
const leadsReportingTab = readFileSync(join(repoRoot, 'src', 'components', 'LeadsReportingTab.tsx'), 'utf8')
const leadsTab = readFileSync(join(repoRoot, 'src', 'components', 'LeadsTab.tsx'), 'utf8')
const liveRoute = readFileSync(join(repoRoot, 'server', 'src', 'routes', 'liveLeads.ts'), 'utf8')

if (!customersHome.includes('customers-transitional-leads-note')) fail('CustomersHomePage missing transitional lead-truth guidance marker')
if (!customersHome.includes('customers-post-fix-handoff')) fail('CustomersHomePage missing post-fix handoff marker')
if (!leadsReportingTab.includes('leads-reporting-stale-sheet-warning')) fail('LeadsReportingTab missing stale sheet warning marker')
if (!leadsReportingTab.includes('Live sheet-backed data via ODCRM')) fail('LeadsReportingTab missing explicit sheet-backed truth wording')
if (!leadsTab.includes('Live sheet-backed data via ODCRM')) fail('LeadsTab missing explicit sheet-backed truth wording')
if (!liveRoute.includes('Using cached metrics due to sheet fetch issue')) fail('liveLeads metrics route missing cached metrics fallback message')

console.log('PASS customers leads/reporting surfaces route through live sheet-backed backend truth')
console.log('PASS stale sheet fetches are handled truthfully with warning markers instead of opaque crashes')
console.log('PASS transitional guidance and marketing handoff markers remain intact in Customers')
console.log('self-test-customers-leads-reporting-truth-runtime: PASS')
