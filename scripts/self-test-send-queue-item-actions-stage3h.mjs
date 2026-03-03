#!/usr/bin/env node
/**
 * Guardrail for Stage 3H: send-queue item retry/skip require tenant + admin.
 * Test A: No headers -> 400 or 401/403 (not 200/500). FAIL on 404 (route must exist on prod).
 * Test B: X-Customer-Id only, no admin -> 401/403 or 400 (not 200). FAIL on 404.
 * Opt-in: ALLOW_ROUTE_404_OK=1 treats 404 as pass with a warning (local/pre-deploy only).
 * Prod-by-default; no secrets. Uses exitSoon() to avoid Windows Node v24 UV_HANDLE_CLOSING crash.
 */
import { withTimeout, exitSoon, readBodyPreview } from './self-test-utils.mjs'

const PROD_API = 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net'
const BASE_URL = (process.env.ODCRM_API_BASE_URL || PROD_API).replace(/\/$/, '')
const FAKE_ITEM = 'fake_item'
const ALLOW_404 = process.env.ALLOW_ROUTE_404_OK === '1'

function fail(msg, bodyPreview) {
  console.error('self-test-send-queue-item-actions-stage3h: FAIL —', msg)
  if (bodyPreview != null) console.error('  Body:', bodyPreview)
  exitSoon(1)
}

function pass(msg) {
  console.log('  ', msg)
  console.log('self-test-send-queue-item-actions-stage3h: PASS')
  exitSoon(0)
}

async function testNoHeaders() {
  for (const action of ['retry', 'skip']) {
    const url = `${BASE_URL}/api/send-queue/items/${FAKE_ITEM}/${action}`
    let res
    try {
      res = await withTimeout(15000, async ({ signal }) =>
        fetch(url, { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: '{}' })
      )
    } catch (err) {
      fail(`fetch POST /${action} error: ${err?.message ?? err}`)
      return
    }
    const bodyPreview = await readBodyPreview(res, 200)
    if (res.status === 200) {
      fail(`POST /api/send-queue/items/:id/${action} with no headers must not return 200`, bodyPreview)
      return
    }
    if (res.status === 500) {
      fail(`POST /api/send-queue/items/:id/${action} with no headers must not return 500 (guardrail)`, bodyPreview)
      return
    }
    if (res.status === 404) {
      if (ALLOW_404) {
        console.warn(`  [ALLOW_ROUTE_404_OK=1] POST /api/send-queue/items/:id/${action} (no headers): 404 — treating as pass (escape hatch)`)
        continue
      }
      fail(`POST /api/send-queue/items/:id/${action} (no headers): 404 — route missing (must be deployed)`, bodyPreview)
      return
    }
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      console.log(`  POST /api/send-queue/items/:id/${action} (no headers): ${res.status} — tenant/admin required`)
      continue
    }
    fail(`POST /api/send-queue/items/:id/${action} (no headers): expect 400 or 401/403, got ${res.status}`, bodyPreview)
    return
  }
}

async function testTenantOnlyNoAdmin() {
  for (const action of ['retry', 'skip']) {
    const url = `${BASE_URL}/api/send-queue/items/${FAKE_ITEM}/${action}`
    let res
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
      fail(`fetch POST /${action} (tenant only) error: ${err?.message ?? err}`)
      return
    }
    const bodyPreview = await readBodyPreview(res, 200)
    if (res.status === 200) {
      fail(`POST /api/send-queue/items/:id/${action} with tenant only must not return 200 (admin required)`, bodyPreview)
      return
    }
    if (res.status === 404) {
      if (ALLOW_404) {
        console.warn(`  [ALLOW_ROUTE_404_OK=1] POST /api/send-queue/items/:id/${action} (X-Customer-Id only): 404 — treating as pass (escape hatch)`)
        continue
      }
      fail(`POST /api/send-queue/items/:id/${action} (tenant only): 404 — route missing (must be deployed)`, bodyPreview)
      return
    }
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      console.log(`  POST /api/send-queue/items/:id/${action} (X-Customer-Id only): ${res.status} — admin required`)
      continue
    }
    fail(`POST /api/send-queue/items/:id/${action} (tenant only): expect 400 or 401/403, got ${res.status}`, bodyPreview)
    return
  }
}

async function main() {
  await testNoHeaders()
  await testTenantOnlyNoAdmin()
  pass('No headers and tenant-only requests correctly rejected.')
}

main()
  .then(() => exitSoon(process.exitCode ?? 0))
  .catch((err) => {
    console.error('self-test-send-queue-item-actions-stage3h: FAIL', err?.message ?? err)
    exitSoon(1)
  })
