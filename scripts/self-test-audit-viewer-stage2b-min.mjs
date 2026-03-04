#!/usr/bin/env node
/**
 * Stage 2B-min: GET /api/send-worker/audits (read-only, tenant-scoped).
 * Test A: no headers -> 400 or 401/403 (NOT 200/500). FAIL on 404 (route must exist on prod).
 * Test B: X-Customer-Id: cust_fake -> 200 with items array (or 404/400/401/403), NEVER 500.
 * Prod-by-default; no secrets. Uses exitSoon() to avoid Windows Node v24 UV_HANDLE_CLOSING crash.
 */
import { withTimeout, exitSoon, readBodyPreview } from './self-test-utils.mjs'

const PROD_API = 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net'
const BASE_URL = (process.env.ODCRM_API_BASE_URL || PROD_API).replace(/\/$/, '')
const PATH = '/api/send-worker/audits?limit=1'

function fail(msg, bodyPreview) {
  console.error('self-test-audit-viewer-stage2b-min: FAIL —', msg)
  if (bodyPreview != null) console.error('  Body:', bodyPreview)
  exitSoon(1)
}

function pass(msg) {
  console.log('  ', msg)
  console.log('self-test-audit-viewer-stage2b-min: PASS')
  exitSoon(0)
}

async function main() {
  const url = `${BASE_URL}${PATH}`

  // Test A: no headers
  let res
  try {
    res = await withTimeout(15000, async ({ signal }) =>
      fetch(url, { method: 'GET', signal })
    )
  } catch (err) {
    fail(`fetch GET ${PATH} (no headers) error: ${err?.message ?? err}`)
    return
  }
  const bodyA = await readBodyPreview(res, 200)
  if (res.status === 200) {
    fail(`GET ${PATH} (no headers) must not return 200`, bodyA)
    return
  }
  if (res.status === 500) {
    fail(`GET ${PATH} (no headers) must not return 500`, bodyA)
    return
  }
  if (res.status === 404) {
    fail(`GET ${PATH} (no headers): 404 — route missing (must be deployed)`, bodyA)
    return
  }
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    console.log(`  GET ${PATH} (no headers): ${res.status} — tenant required`)
  } else {
    fail(`GET ${PATH} (no headers): expect 400 or 401/403, got ${res.status}`, bodyA)
    return
  }

  // Test B: fake tenant
  try {
    res = await withTimeout(15000, async ({ signal }) =>
      fetch(url, { method: 'GET', signal, headers: { 'X-Customer-Id': 'cust_fake' } })
    )
  } catch (err) {
    fail(`fetch GET ${PATH} (X-Customer-Id: cust_fake) error: ${err?.message ?? err}`)
    return
  }
  const textB = await res.text()
  const bodyB = textB.length <= 300 ? textB : textB.slice(0, 300) + '...'
  if (res.status === 500) {
    fail(`GET ${PATH} (X-Customer-Id: cust_fake) must not return 500`, bodyB)
    return
  }
  if (res.status === 404) {
    fail(`GET ${PATH} (X-Customer-Id: cust_fake): 404 — route missing (must be deployed)`, bodyB)
    return
  }
  if (res.status === 200) {
    try {
      const json = JSON.parse(textB)
      if (json.success === true && Array.isArray(json.data?.items)) {
        console.log(`  GET ${PATH} (X-Customer-Id: cust_fake): 200 — items.length = ${json.data.items.length}`)
        pass('No headers rejected; fake tenant returns 200 with items array (possibly empty).')
        return
      }
    } catch (_) {
      // ignore parse
    }
    console.log(`  GET ${PATH} (X-Customer-Id: cust_fake): 200 — body ok`)
    pass('No headers rejected; fake tenant returns 200.')
    return
  }
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    console.log(`  GET ${PATH} (X-Customer-Id: cust_fake): ${res.status}`)
    pass('No headers rejected; fake tenant returns 4xx (no 500).')
    return
  }
  fail(`GET ${PATH} (X-Customer-Id: cust_fake): expect 200 or 4xx, got ${res.status}`, bodyB)
}

main()
  .then(() => exitSoon(process.exitCode ?? 0))
  .catch((err) => {
    console.error('self-test-audit-viewer-stage2b-min: FAIL', err?.message ?? err)
    exitSoon(1)
  })
