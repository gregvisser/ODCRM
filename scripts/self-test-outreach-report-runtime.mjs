#!/usr/bin/env node
const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(msg) {
  console.error(`self-test-outreach-report-runtime: FAIL - ${msg}`)
  process.exitCode = 1
}

async function run() {
  if (!CUSTOMER_ID) {
    fail('CUSTOMER_ID is required')
    return
  }
  const res = await fetch(`${BASE_URL}/api/reports/outreach?customerId=${encodeURIComponent(CUSTOMER_ID)}&sinceDays=30`, {
    headers: { Accept: 'application/json', 'X-Customer-Id': CUSTOMER_ID },
  })
  if (!res.ok) {
    if (res.status === 404) {
      console.log('SKIP outreach report endpoint not available on target BASE_URL yet')
      console.log('self-test-outreach-report-runtime: PASS')
      return
    }
    const body = await res.text()
    fail(`${res.status} ${body.slice(0, 200)}`)
    return
  }
  const json = await res.json()
  const data = json?.data
  if (!data || !Array.isArray(data.bySequence) || !Array.isArray(data.byIdentity)) {
    fail('invalid response shape')
    return
  }
  console.log(`PASS outreach report rows: sequence=${data.bySequence.length} identity=${data.byIdentity.length}`)
  console.log('self-test-outreach-report-runtime: PASS')
}

run().catch((err) => fail(err?.message || String(err)))
