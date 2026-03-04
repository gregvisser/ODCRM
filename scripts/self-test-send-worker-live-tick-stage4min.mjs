#!/usr/bin/env node
/**
 * Stage 4-min: POST /api/send-worker/live-tick guardrails (no real sending).
 * Test A: no headers -> expect 401/403 or 400 (NOT 200/500). FAIL on 404.
 * Test B: X-Customer-Id only -> expect 401/403 or 400 (NOT 200/500). FAIL on 404.
 * Test C: X-Customer-Id + no X-Admin-Secret -> expect 401/403.
 * Prod-by-default; no secrets. Uses exitSoon().
 */
import { withTimeout, exitSoon, readBodyPreview } from './self-test-utils.mjs'

const PROD_API = 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net'
const BASE_URL = (process.env.ODCRM_API_BASE_URL || PROD_API).replace(/\/$/, '')
const PATH = '/api/send-worker/live-tick'

function fail(msg, bodyPreview) {
  console.error('self-test-send-worker-live-tick-stage4min: FAIL —', msg)
  if (bodyPreview != null) console.error('  Body:', bodyPreview)
  exitSoon(1)
}

function pass(msg) {
  console.log('  ', msg)
  console.log('self-test-send-worker-live-tick-stage4min: PASS')
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
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    console.log(`  POST ${PATH} (no headers): ${res.status} — tenant/admin required`)
  } else {
    fail(`POST ${PATH} (no headers): expect 400 or 401/403, got ${res.status}`, bodyA)
    return
  }

  // Test B: X-Customer-Id only (no admin secret)
  try {
    res = await withTimeout(15000, async ({ signal }) =>
      fetch(url, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', 'X-Customer-Id': 'cust_fake' },
        body: '{}',
      })
    )
  } catch (err) {
    fail(`fetch POST ${PATH} (X-Customer-Id only) error: ${err?.message ?? err}`)
    return
  }
  const bodyB = await readBodyPreview(res, 200)
  if (res.status === 200) {
    fail(`POST ${PATH} (X-Customer-Id only) must not return 200`, bodyB)
    return
  }
  if (res.status === 500) {
    fail(`POST ${PATH} (X-Customer-Id only) must not return 500`, bodyB)
    return
  }
  if (res.status === 404) {
    fail(`POST ${PATH} (X-Customer-Id only): 404 — route missing`, bodyB)
    return
  }
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    console.log(`  POST ${PATH} (X-Customer-Id only): ${res.status} — admin required`)
  } else {
    fail(`POST ${PATH} (X-Customer-Id only): expect 400 or 401/403, got ${res.status}`, bodyB)
    return
  }

  // Test C: X-Customer-Id + cust_fake, no X-Admin-Secret (explicit no admin)
  try {
    res = await withTimeout(15000, async ({ signal }) =>
      fetch(url, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', 'X-Customer-Id': 'cust_fake' },
        body: JSON.stringify({ limit: 1 }),
      })
    )
  } catch (err) {
    fail(`fetch POST ${PATH} (cust_fake, no admin) error: ${err?.message ?? err}`)
    return
  }
  const bodyC = await readBodyPreview(res, 200)
  if (res.status === 200) {
    fail(`POST ${PATH} (cust_fake, no admin) must not return 200`, bodyC)
    return
  }
  if (res.status === 500) {
    fail(`POST ${PATH} (cust_fake, no admin) must not return 500`, bodyC)
    return
  }
  if (res.status === 404) {
    fail(`POST ${PATH} (cust_fake, no admin): 404 — route missing`, bodyC)
    return
  }
  if (res.status === 401 || res.status === 403) {
    console.log(`  POST ${PATH} (cust_fake, no X-Admin-Secret): ${res.status} — admin required`)
  } else {
    console.log(`  POST ${PATH} (cust_fake, no admin): ${res.status}`)
  }

  pass('No headers, tenant-only, and tenant-without-admin correctly rejected (401/403/400).')
}

main()
  .then(() => exitSoon(process.exitCode ?? 0))
  .catch((err) => {
    console.error('self-test-send-worker-live-tick-stage4min: FAIL', err?.message ?? err)
    exitSoon(1)
  })
