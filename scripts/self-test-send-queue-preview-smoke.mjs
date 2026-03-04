#!/usr/bin/env node
/**
 * Runtime smoke self-test: Send Queue Preview API exists on prod and doesn't 500.
 * Prod-by-default. No secrets. Read-only.
 * Uses exitSoon() to avoid Windows Node v24 UV_HANDLE_CLOSING crash.
 */
import { withTimeout, exitSoon, readBodyPreview } from './self-test-utils.mjs'

const PROD_API = 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net'
const BASE_URL = (process.env.ODCRM_API_BASE_URL || PROD_API).replace(/\/$/, '')
const PREVIEW_PATH = '/api/send-queue/preview?limit=1'
const PREVIEW_URL = `${BASE_URL}${PREVIEW_PATH}`

function fail(msg, bodyPreview = '') {
  console.error('self-test-send-queue-preview-smoke: FAIL')
  console.error('  ', msg)
  if (bodyPreview) console.error('  Body:', bodyPreview)
  exitSoon(1)
}

async function main() {
  console.log('  BASE_URL:', BASE_URL)
  console.log('  PATH:', PREVIEW_PATH)

  // Test A: No headers — expect NOT 200; allow 400, 401, 403; FAIL on 404, 500
  const resA = await withTimeout(15000, async ({ signal }) =>
    fetch(PREVIEW_URL, { method: 'GET', signal })
  )
  const bodyA = await readBodyPreview(resA, 300)
  if (resA.status === 200) {
    fail('Test A (no headers): must not return 200', bodyA)
    return
  }
  if (resA.status === 404) {
    fail('Test A (no headers): 404 — route missing', bodyA)
    return
  }
  if (resA.status === 500) {
    fail('Test A (no headers): 500 — server error', bodyA)
    return
  }
  if (resA.status === 400 || resA.status === 401 || resA.status === 403) {
    console.log('  Test A (no headers):', resA.status, '— tenant/auth required')
  } else {
    fail(`Test A (no headers): expected 400/401/403, got ${resA.status}`, bodyA)
    return
  }

  // Test B: Fake tenant X-Customer-Id: cust_fake — allow 200 (validate shape), 400, 401, 403, 404; FAIL on 500
  const resB = await withTimeout(15000, async ({ signal }) =>
    fetch(PREVIEW_URL, { method: 'GET', headers: { 'X-Customer-Id': 'cust_fake' }, signal })
  )
  const textB = await resB.text()
  const bodyB = textB.length <= 300 ? textB : textB.slice(0, 300) + '...'
  if (resB.status === 500) {
    fail('Test B (X-Customer-Id: cust_fake): 500 — server error', bodyB)
    return
  }
  if (resB.status === 200) {
    let data
    try {
      data = textB ? JSON.parse(textB) : null
    } catch (e) {
      fail('Test B: 200 but response is not JSON', bodyB)
      return
    }
    const items = data?.data?.items ?? data?.items
    if (!Array.isArray(items)) {
      fail('Test B: 200 must have data.items or items array', bodyB)
      return
    }
    console.log('  Test B (X-Customer-Id: cust_fake):', resB.status, '— items.length =', items.length)
  } else if (resB.status === 400 || resB.status === 401 || resB.status === 403 || resB.status === 404) {
    console.log('  Test B (X-Customer-Id: cust_fake):', resB.status)
  } else {
    fail(`Test B: expected 200 or 400/401/403/404, got ${resB.status}`, bodyB)
    return
  }

  console.log('self-test-send-queue-preview-smoke: PASS')
  exitSoon(0)
}

main()
  .then(() => exitSoon(process.exitCode ?? 0))
  .catch((err) => {
    console.error('self-test-send-queue-preview-smoke: FAIL', err?.message ?? err)
    exitSoon(1)
  })
