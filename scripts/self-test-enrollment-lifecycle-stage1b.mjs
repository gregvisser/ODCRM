#!/usr/bin/env node
/**
 * Guardrail for Stage 1B: enrollment lifecycle (pause/resume/cancel).
 * Test A: POST with no headers -> 400 or 401/403 (NOT 200/500). FAIL on 404 (route must exist on prod).
 * Test B: POST with X-Customer-Id: cust_fake -> 404 or 400 or 401/403 (NOT 200/500).
 * Repeated for /pause, /resume, /cancel.
 * Prod-by-default; no secrets. Uses exitSoon() to avoid Windows Node v24 UV_HANDLE_CLOSING crash.
 */
import { withTimeout, exitSoon, readBodyPreview } from './self-test-utils.mjs'

const PROD_API = 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net'
const BASE_URL = (process.env.ODCRM_API_BASE_URL || PROD_API).replace(/\/$/, '')
const FAKE_ID = 'fake'

function fail(msg, bodyPreview) {
  console.error('self-test-enrollment-lifecycle-stage1b: FAIL —', msg)
  if (bodyPreview != null) console.error('  Body:', bodyPreview)
  exitSoon(1)
}

function pass(msg) {
  console.log('  ', msg)
  console.log('self-test-enrollment-lifecycle-stage1b: PASS')
  exitSoon(0)
}

async function testEndpoint(action) {
  const path = `/api/enrollments/${FAKE_ID}/${action}`
  const url = `${BASE_URL}${path}`

  // Test A: no headers
  let res
  try {
    res = await withTimeout(15000, async ({ signal }) =>
      fetch(url, { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: '{}' })
    )
  } catch (err) {
    fail(`fetch POST ${path} (no headers) error: ${err?.message ?? err}`)
    return false
  }
  const bodyA = await readBodyPreview(res, 200)
  if (res.status === 200) {
    fail(`POST ${path} (no headers) must not return 200`, bodyA)
    return false
  }
  if (res.status === 500) {
    fail(`POST ${path} (no headers) must not return 500`, bodyA)
    return false
  }
  if (res.status === 404) {
    fail(`POST ${path} (no headers): 404 — route missing (must be deployed)`, bodyA)
    return false
  }
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    console.log(`  POST ${path} (no headers): ${res.status} — tenant required`)
  } else {
    fail(`POST ${path} (no headers): expect 400 or 401/403, got ${res.status}`, bodyA)
    return false
  }

  // Test B: fake tenant header
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
    fail(`fetch POST ${path} (fake tenant) error: ${err?.message ?? err}`)
    return false
  }
  const bodyB = await readBodyPreview(res, 200)
  if (res.status === 200) {
    fail(`POST ${path} (fake tenant) must not return 200`, bodyB)
    return false
  }
  if (res.status === 500) {
    fail(`POST ${path} (fake tenant) must not return 500`, bodyB)
    return false
  }
  if (res.status === 404 || res.status === 400 || res.status === 401 || res.status === 403) {
    console.log(`  POST ${path} (X-Customer-Id: cust_fake): ${res.status}`)
  } else {
    fail(`POST ${path} (fake tenant): expect 404 or 400 or 401/403, got ${res.status}`, bodyB)
    return false
  }

  return true
}

async function main() {
  for (const action of ['pause', 'resume', 'cancel']) {
    const ok = await testEndpoint(action)
    if (!ok) return
  }
  pass('pause, resume, cancel: no-headers and fake-tenant requests correctly rejected.')
}

main()
  .then(() => exitSoon(process.exitCode ?? 0))
  .catch((err) => {
    console.error('self-test-enrollment-lifecycle-stage1b: FAIL', err?.message ?? err)
    exitSoon(1)
  })
