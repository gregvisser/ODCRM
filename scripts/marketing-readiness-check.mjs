#!/usr/bin/env node
/**
 * Marketing live outreach readiness check.
 * Read-only safety contract checks; does NOT perform live sends.
 */

const BASE_URL = (process.env.MARKETING_BASE_URL || process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.READINESS_CUSTOMER_ID || 'cust_fake').trim()

const result = {
  pass: 0,
  fail: 0,
}

function ok(name, details = '') {
  result.pass += 1
  console.log(`PASS ${name}${details ? ` - ${details}` : ''}`)
}

function fail(name, details = '') {
  result.fail += 1
  console.error(`FAIL ${name}${details ? ` - ${details}` : ''}`)
}

function expect(condition, name, details = '') {
  if (condition) ok(name, details)
  else fail(name, details)
}

async function request(path, init = {}) {
  const res = await fetch(`${BASE_URL}${path}`, init)
  let json = null
  try {
    json = await res.json()
  } catch {
    // ignore non-json responses
  }
  return { status: res.status, json }
}

async function run() {
  console.log(`Base URL: ${BASE_URL}`)
  console.log(`Customer ID probe: ${CUSTOMER_ID}`)

  // 1) Core health endpoints
  {
    const r = await request('/api/health')
    expect(r.status === 200, 'api health', `status=${r.status}`)
  }

  {
    const r = await request('/api/__build')
    expect(r.status === 200, 'build probe', `status=${r.status}`)
  }

  // 2) Queue preview tenant safety contract
  {
    const r = await request('/api/send-queue/preview?limit=1')
    expect(r.status === 400, 'send-queue preview requires tenant', `status=${r.status}`)
  }

  {
    const r = await request('/api/send-queue/preview?limit=1', {
      headers: { 'X-Customer-Id': CUSTOMER_ID },
    })
    expect(r.status === 200, 'send-queue preview tenant-scoped', `status=${r.status}`)
  }

  // 3) Live tick admin safety contract
  {
    const r = await request('/api/send-worker/live-tick', { method: 'POST' })
    expect(r.status === 401 || r.status === 403 || r.status === 400, 'live-tick rejects unauthenticated', `status=${r.status}`)
  }

  {
    const r = await request('/api/send-worker/live-tick', {
      method: 'POST',
      headers: { 'X-Customer-Id': CUSTOMER_ID, 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 1 }),
    })
    expect(r.status === 401 || r.status === 403, 'live-tick rejects missing admin secret', `status=${r.status}`)
  }

  // 4) Send queue item action contract
  {
    const r = await request('/api/send-queue/items/fake/retry', { method: 'POST' })
    expect(r.status === 401 || r.status === 403 || r.status === 400, 'retry action rejects unauthenticated', `status=${r.status}`)
  }

  // 5) Environment gate sanity checks (only strict when live is enabled)
  const liveEnabled = process.env.ENABLE_LIVE_SENDING === 'true'
  const queueSendingEnabled = process.env.ENABLE_SEND_QUEUE_SENDING === 'true'
  const canaryCustomer = (process.env.SEND_CANARY_CUSTOMER_ID || '').trim()

  if (!liveEnabled) {
    ok('env gate sanity', 'ENABLE_LIVE_SENDING is not true (safe default)')
  } else {
    expect(queueSendingEnabled, 'env gate sanity', 'ENABLE_SEND_QUEUE_SENDING must be true when live enabled')
    expect(canaryCustomer.length > 0, 'env gate sanity', 'SEND_CANARY_CUSTOMER_ID must be set when live enabled')
  }

  console.log(`\nSummary: ${result.pass} passed, ${result.fail} failed`)
  if (result.fail > 0) process.exit(1)
}

run().catch((err) => {
  console.error('FAIL readiness runtime error', err?.message || String(err))
  process.exit(1)
})

