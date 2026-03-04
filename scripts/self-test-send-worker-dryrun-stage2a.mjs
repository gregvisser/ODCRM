#!/usr/bin/env node
/**
 * Guardrail for Stage 2A: POST /api/send-worker/dry-run (admin-only).
 * Test A: POST with no headers -> 401/403 or 400 (NOT 200/500). FAIL on 404 (route must exist on prod).
 * Test B: POST with X-Customer-Id only (no admin secret) -> 401/403 or 400 (NOT 200/500).
 * Prod-by-default; no secrets. Uses exitSoon() to avoid Windows Node v24 UV_HANDLE_CLOSING crash.
 */
import { withTimeout, exitSoon, readBodyPreview } from './self-test-utils.mjs'

const PROD_API = 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net'
const BASE_URL = (process.env.ODCRM_API_BASE_URL || PROD_API).replace(/\/$/, '')
const PATH = '/api/send-worker/dry-run'

function fail(msg, bodyPreview) {
  console.error('self-test-send-worker-dryrun-stage2a: FAIL —', msg)
  if (bodyPreview != null) console.error('  Body:', bodyPreview)
  exitSoon(1)
}

function pass(msg) {
  console.log('  ', msg)
  console.log('self-test-send-worker-dryrun-stage2a: PASS')
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
    console.log(`  POST ${PATH} (no headers): ${res.status} — admin required`)
  } else {
    fail(`POST ${PATH} (no headers): expect 400 or 401/403, got ${res.status}`, bodyA)
    return
  }

  // Test B: X-Customer-Id only, no admin secret
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
    fail(`POST ${PATH} (X-Customer-Id only): 404 — route missing (must be deployed)`, bodyB)
    return
  }
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    console.log(`  POST ${PATH} (X-Customer-Id only): ${res.status} — admin required`)
  } else {
    fail(`POST ${PATH} (X-Customer-Id only): expect 400 or 401/403, got ${res.status}`, bodyB)
    return
  }

  pass('No headers and tenant-only requests correctly rejected (admin required).')
}

main()
  .then(() => exitSoon(process.exitCode ?? 0))
  .catch((err) => {
    console.error('self-test-send-worker-dryrun-stage2a: FAIL', err?.message ?? err)
    exitSoon(1)
  })
