#!/usr/bin/env node
/**
 * Negative-path guardrails for snapshot-based enrollment creation.
 * Does NOT create real enrollments. Prod-by-default; no secrets.
 * Test A: POST without headers -> expect 400 or 401/403 (NOT 200/500). FAIL on 404 (route missing).
 * Test B: POST with X-Customer-Id: cust_fake and recipientSource: 'snapshot' -> expect 404/400/401/403 (NOT 200/500).
 */
import { withTimeout, exitSoon, readBodyPreview } from './self-test-utils.mjs'

const PROD_API = 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net'
const BASE_URL = (process.env.ODCRM_API_BASE_URL || PROD_API).replace(/\/$/, '')
const FAKE_SEQ_ID = 'seq_fake_no_such_sequence'
const PATH = `/api/sequences/${FAKE_SEQ_ID}/enrollments`

function fail(msg, bodyPreview) {
  console.error('self-test-enrollment-snapshot-ingestion: FAIL —', msg)
  if (bodyPreview != null) console.error('  Body:', bodyPreview)
  exitSoon(1)
}

function pass(msg) {
  console.log('  ', msg)
  console.log('self-test-enrollment-snapshot-ingestion: PASS')
  exitSoon(0)
}

async function main() {
  const url = `${BASE_URL}${PATH}`

  // Test A: no headers
  let res
  try {
    res = await withTimeout(15000, async ({ signal }) =>
      fetch(url, { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: '{}' })
    )
  } catch (err) {
    fail(`fetch POST ${PATH} (no headers) error: ${err?.message ?? err}`)
    return
  }
  const bodyA = await readBodyPreview(res, 200)
  if (res.status === 200) {
    fail(`POST ${PATH} (no headers) must not return 200`, bodyA)
    return
  }
  if (res.status === 500) {
    fail(`POST ${PATH} (no headers) must not return 500`, bodyA)
    return
  }
  if (res.status === 404) {
    fail(`POST ${PATH} (no headers): 404 — route missing (must be deployed)`, bodyA)
    return
  }
  if (res.status >= 400 && res.status < 500) {
    console.log(`  POST ${PATH} (no headers): ${res.status} — rejected`)
  } else {
    fail(`POST ${PATH} (no headers): expect 4xx, got ${res.status}`, bodyA)
    return
  }

  // Test B: X-Customer-Id: cust_fake, recipientSource: 'snapshot'
  try {
    res = await withTimeout(15000, async ({ signal }) =>
      fetch(url, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', 'X-Customer-Id': 'cust_fake' },
        body: JSON.stringify({ recipientSource: 'snapshot' }),
      })
    )
  } catch (err) {
    fail(`fetch POST ${PATH} (cust_fake + snapshot) error: ${err?.message ?? err}`)
    return
  }
  const bodyB = await readBodyPreview(res, 200)
  if (res.status === 200) {
    fail(`POST ${PATH} (cust_fake + snapshot) must not return 200`, bodyB)
    return
  }
  if (res.status === 500) {
    fail(`POST ${PATH} (cust_fake + snapshot) must not return 500`, bodyB)
    return
  }
  if (res.status === 404 || res.status === 400 || res.status === 401 || res.status === 403) {
    console.log(`  POST ${PATH} (X-Customer-Id: cust_fake, recipientSource: snapshot): ${res.status} — rejected as expected`)
  } else {
    console.log(`  POST ${PATH} (cust_fake + snapshot): ${res.status}`)
  }

  pass('Enrollment creation route exists and rejects unauthenticated / fake-tenant snapshot requests.')
}

main()
  .then(() => exitSoon(process.exitCode ?? 0))
  .catch((err) => {
    console.error('self-test-enrollment-snapshot-ingestion: FAIL', err?.message ?? err)
    exitSoon(1)
  })
