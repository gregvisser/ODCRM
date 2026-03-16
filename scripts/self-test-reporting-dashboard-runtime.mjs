#!/usr/bin/env node
/**
 * Smoke test for /api/reporting/* dashboard endpoints.
 * Run: CUSTOMER_ID=cust_xxx node scripts/self-test-reporting-dashboard-runtime.mjs
 * Or: BASE_URL=http://localhost:3001 CUSTOMER_ID=cust_xxx node scripts/self-test-reporting-dashboard-runtime.mjs
 */
const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-reporting-dashboard-runtime: FAIL - ${message}`)
  process.exit(1)
}

if (!CUSTOMER_ID) fail('CUSTOMER_ID env var is required')

async function getJson(path) {
  const url = `${BASE_URL}${path}`
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'X-Customer-Id': CUSTOMER_ID },
  })
  const text = await response.text()
  if (response.status === 400 && (text.includes('Customer ID') || text.includes('customerId'))) {
    return { status: 400, body: { error: 'Customer ID required' } }
  }
  if (!response.ok) fail(`GET ${path} returned ${response.status}: ${text.slice(0, 300)}`)
  try {
    return { status: response.status, body: text ? JSON.parse(text) : null }
  } catch {
    fail(`GET ${path} returned non-JSON`)
  }
}

async function main() {
  const summaryRes = await getJson(`/api/reporting/summary?sinceDays=7&customerId=${encodeURIComponent(CUSTOMER_ID)}`)
  if (summaryRes.status === 404) fail('/api/reporting/summary returned 404')
  const data = summaryRes.body?.data ?? summaryRes.body
  if (!data || typeof data !== 'object') fail('/api/reporting/summary payload missing data object')
  if (typeof data.leadsCreated !== 'number') fail('summary.leadsCreated must be number')
  if (typeof data.emailsSent !== 'number') fail('summary.emailsSent must be number')

  const leadsVsTargetRes = await getJson(`/api/reporting/leads-vs-target?sinceDays=30&customerId=${encodeURIComponent(CUSTOMER_ID)}`)
  if (leadsVsTargetRes.status === 404) fail('/api/reporting/leads-vs-target returned 404')
  const lvt = leadsVsTargetRes.body?.data ?? leadsVsTargetRes.body
  if (!lvt || typeof lvt.leadsCreated !== 'number') fail('leads-vs-target.leadsCreated must be number')

  console.log('PASS /api/reporting/summary returns data shape')
  console.log('PASS /api/reporting/leads-vs-target returns data shape')
  console.log('self-test-reporting-dashboard-runtime: PASS')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
