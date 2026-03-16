#!/usr/bin/env node
/**
 * Smoke test for /api/reporting/* dashboard endpoints.
 * Run: CUSTOMER_ID=cust_xxx node scripts/self-test-reporting-dashboard-runtime.mjs
 * Or: BASE_URL=http://localhost:3001 CUSTOMER_ID=cust_xxx CHECK_ALL_CLIENTS=1 node scripts/self-test-reporting-dashboard-runtime.mjs
 */
const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()
const CHECK_ALL_CLIENTS = process.env.CHECK_ALL_CLIENTS === '1'

function fail(message) {
  console.error(`self-test-reporting-dashboard-runtime: FAIL - ${message}`)
  process.exit(1)
}

async function getJson(path, customerId = CUSTOMER_ID) {
  const url = `${BASE_URL}${path}`
  const response = await fetch(url, {
    headers: customerId ? { Accept: 'application/json', 'X-Customer-Id': customerId } : { Accept: 'application/json' },
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
  if (!CUSTOMER_ID) fail('CUSTOMER_ID env var is required')
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

  const complianceRes = await getJson(`/api/reporting/compliance?sinceDays=30&customerId=${encodeURIComponent(CUSTOMER_ID)}`)
  if (complianceRes.status === 404) fail('/api/reporting/compliance returned 404')
  const compliance = complianceRes.body?.data ?? complianceRes.body
  if (!compliance || typeof compliance.unsubscribesInPeriod !== 'number') fail('compliance.unsubscribesInPeriod must be number')

  const outreachRes = await getJson(`/api/reporting/outreach-performance?sinceDays=30&customerId=${encodeURIComponent(CUSTOMER_ID)}`)
  if (outreachRes.status === 404) fail('/api/reporting/outreach-performance returned 404')
  const outreach = outreachRes.body?.data ?? outreachRes.body
  if (!outreach || !Array.isArray(outreach.bySequence)) fail('outreach-performance.bySequence must be array')

  const mailboxRes = await getJson(`/api/reporting/mailboxes?sinceDays=30&customerId=${encodeURIComponent(CUSTOMER_ID)}`)
  if (mailboxRes.status === 404) fail('/api/reporting/mailboxes returned 404')
  const mailboxPayload = mailboxRes.body?.data ?? mailboxRes.body
  if (!mailboxPayload || !Array.isArray(mailboxPayload.mailboxes)) fail('mailboxes.mailboxes must be array')

  if (CHECK_ALL_CLIENTS) {
    const aggregateSummaryRes = await getJson('/api/reporting/summary?sinceDays=30&scope=all', '')
    const aggregateSummary = aggregateSummaryRes.body?.data ?? aggregateSummaryRes.body
    if (!aggregateSummary || aggregateSummary.customerId !== 'all') fail('aggregate summary must return customerId=all')
    if (typeof aggregateSummary.customerCount !== 'number') fail('aggregate summary must return customerCount')
    if (typeof aggregateSummary.leadsCreated !== 'number') fail('aggregate summary.leadsCreated must be number')

    const aggregateTrendRes = await getJson('/api/reporting/trends?sinceDays=30&scope=all', '')
    const aggregateTrend = aggregateTrendRes.body?.data ?? aggregateTrendRes.body
    if (!aggregateTrend || !Array.isArray(aggregateTrend.trend)) fail('aggregate trends.trend must be array')
  }

  console.log('PASS /api/reporting/summary returns data shape')
  console.log('PASS /api/reporting/leads-vs-target returns data shape')
  console.log('PASS /api/reporting/compliance returns opt-out-safe data shape')
  console.log('PASS /api/reporting/outreach-performance returns sequence data shape')
  console.log('PASS /api/reporting/mailboxes returns mailbox data shape')
  if (CHECK_ALL_CLIENTS) {
    console.log('PASS /api/reporting/summary supports scope=all')
    console.log('PASS /api/reporting/trends supports scope=all')
  }
  console.log('self-test-reporting-dashboard-runtime: PASS')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
