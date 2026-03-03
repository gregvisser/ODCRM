#!/usr/bin/env node
/**
 * Guardrail for Stage 3I: GET /api/send-queue/items/:itemId (tenant-scoped, read-only).
 * Test A: No headers -> 400 or 401/403 (NOT 200/500).
 * Test B: X-Customer-Id: cust_fake -> 404 or 400 or 401/403 (NOT 200/500).
 * Prod-by-default; no secrets. Uses exitSoon() to avoid Windows Node v24 UV_HANDLE_CLOSING crash.
 */
import { withTimeout, exitSoon, readBodyPreview } from './self-test-utils.mjs'

const PROD_API = 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net'
const BASE_URL = (process.env.ODCRM_API_BASE_URL || PROD_API).replace(/\/$/, '')
const FAKE_ID = 'fake_id'

function fail(msg, bodyPreview) {
  console.error('self-test-send-queue-item-detail-stage3i: FAIL —', msg)
  if (bodyPreview != null) console.error('  Body:', bodyPreview)
  exitSoon(1)
}

function pass(msg) {
  console.log('  ', msg)
  console.log('self-test-send-queue-item-detail-stage3i: PASS')
  exitSoon(0)
}

async function main() {
  // Test A: no headers
  const urlA = `${BASE_URL}/api/send-queue/items/${FAKE_ID}`
  let res
  try {
    res = await withTimeout(15000, async ({ signal }) => fetch(urlA, { method: 'GET', signal }))
  } catch (err) {
    fail(`fetch GET (no headers) error: ${err?.message ?? err}`)
    return
  }
  const bodyA = await readBodyPreview(res, 200)
  if (res.status === 200) {
    fail(`GET /api/send-queue/items/:id (no headers) must not return 200`, bodyA)
    return
  }
  if (res.status === 500) {
    fail(`GET /api/send-queue/items/:id (no headers) must not return 500`, bodyA)
    return
  }
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    console.log(`  GET /api/send-queue/items/:id (no headers): ${res.status} — tenant required`)
  } else {
    fail(`GET /api/send-queue/items/:id (no headers): expect 400 or 401/403, got ${res.status}`, bodyA)
    return
  }

  // Test B: fake tenant header
  try {
    res = await withTimeout(15000, async ({ signal }) =>
      fetch(urlA, { method: 'GET', signal, headers: { 'X-Customer-Id': 'cust_fake' } })
    )
  } catch (err) {
    fail(`fetch GET (fake tenant) error: ${err?.message ?? err}`)
    return
  }
  const bodyB = await readBodyPreview(res, 200)
  if (res.status === 200) {
    fail(`GET /api/send-queue/items/:id (fake tenant) must not return 200`, bodyB)
    return
  }
  if (res.status === 500) {
    fail(`GET /api/send-queue/items/:id (fake tenant) must not return 500`, bodyB)
    return
  }
  if (res.status === 404 || res.status === 400 || res.status === 401 || res.status === 403) {
    console.log(`  GET /api/send-queue/items/:id (X-Customer-Id: cust_fake): ${res.status}`)
  } else {
    fail(`GET /api/send-queue/items/:id (fake tenant): expect 404 or 400 or 401/403, got ${res.status}`, bodyB)
    return
  }

  pass('No headers and fake-tenant requests correctly rejected.')
}

main()
  .then(() => exitSoon(process.exitCode ?? 0))
  .catch((err) => {
    console.error('self-test-send-queue-item-detail-stage3i: FAIL', err?.message ?? err)
    exitSoon(1)
  })
