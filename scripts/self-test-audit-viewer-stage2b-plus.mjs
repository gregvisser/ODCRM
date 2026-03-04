#!/usr/bin/env node
/**
 * Stage 2B+: GET /api/send-worker/audits/summary and GET /api/send-worker/audits.csv (read-only, tenant-scoped).
 * Test A (no headers): summary and csv -> expect 400/401/403, NOT 200/500, FAIL on 404.
 * Test B (cust_fake): summary -> 200 with json OR 4xx, never 500; csv -> 200 (even empty) OR 4xx, never 500.
 * Prod-by-default; no secrets. Uses exitSoon().
 */
import { withTimeout, exitSoon, readBodyPreview } from './self-test-utils.mjs'

const PROD_API = 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net'
const BASE_URL = (process.env.ODCRM_API_BASE_URL || PROD_API).replace(/\/$/, '')
const PATH_SUMMARY = '/api/send-worker/audits/summary'
const PATH_CSV = '/api/send-worker/audits.csv'

function fail(msg, bodyPreview) {
  console.error('self-test-audit-viewer-stage2b-plus: FAIL —', msg)
  if (bodyPreview != null) console.error('  Body:', bodyPreview)
  exitSoon(1)
}

function pass(msg) {
  console.log('  ', msg)
  console.log('self-test-audit-viewer-stage2b-plus: PASS')
  exitSoon(0)
}

async function testNoHeaders(path) {
  const url = `${BASE_URL}${path}`
  let res
  try {
    res = await withTimeout(15000, async ({ signal }) => fetch(url, { method: 'GET', signal }))
  } catch (err) {
    fail(`fetch GET ${path} (no headers) error: ${err?.message ?? err}`)
    return false
  }
  const body = await readBodyPreview(res, 200)
  if (res.status === 200) {
    fail(`GET ${path} (no headers) must not return 200`, body)
    return false
  }
  if (res.status === 500) {
    fail(`GET ${path} (no headers) must not return 500`, body)
    return false
  }
  if (res.status === 404) {
    fail(`GET ${path} (no headers): 404 — route missing (must be deployed)`, body)
    return false
  }
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    console.log(`  GET ${path} (no headers): ${res.status} — tenant required`)
    return true
  }
  fail(`GET ${path} (no headers): expect 400 or 401/403, got ${res.status}`, body)
  return false
}

async function main() {
  // Test A: no headers for summary
  if (!(await testNoHeaders(PATH_SUMMARY))) return
  // Test A: no headers for csv
  if (!(await testNoHeaders(PATH_CSV))) return

  // Test B: summary with cust_fake
  const urlSummary = `${BASE_URL}${PATH_SUMMARY}`
  let res
  try {
    res = await withTimeout(15000, async ({ signal }) =>
      fetch(urlSummary, { method: 'GET', signal, headers: { 'X-Customer-Id': 'cust_fake' } })
    )
  } catch (err) {
    fail(`fetch GET ${PATH_SUMMARY} (cust_fake) error: ${err?.message ?? err}`)
    return
  }
  const textSum = await res.text()
  const bodySum = textSum.length <= 300 ? textSum : textSum.slice(0, 300) + '...'
  if (res.status === 500) {
    fail(`GET ${PATH_SUMMARY} (cust_fake) must not return 500`, bodySum)
    return
  }
  if (res.status === 404) {
    fail(`GET ${PATH_SUMMARY} (cust_fake): 404 — route missing`, bodySum)
    return
  }
  if (res.status === 200) {
    try {
      const json = JSON.parse(textSum)
      if (json.success === true && json.data && typeof json.data.total === 'number') {
        console.log(`  GET ${PATH_SUMMARY} (cust_fake): 200 — total=${json.data.total}`)
      } else {
        console.log(`  GET ${PATH_SUMMARY} (cust_fake): 200`)
      }
    } catch (_) {
      console.log(`  GET ${PATH_SUMMARY} (cust_fake): 200`)
    }
  } else {
    console.log(`  GET ${PATH_SUMMARY} (cust_fake): ${res.status}`)
  }

  // Test B: csv with cust_fake
  const urlCsv = `${BASE_URL}${PATH_CSV}`
  try {
    res = await withTimeout(15000, async ({ signal }) =>
      fetch(urlCsv, { method: 'GET', signal, headers: { 'X-Customer-Id': 'cust_fake' } })
    )
  } catch (err) {
    fail(`fetch GET ${PATH_CSV} (cust_fake) error: ${err?.message ?? err}`)
    return
  }
  const bodyCsv = await readBodyPreview(res, 100)
  if (res.status === 500) {
    fail(`GET ${PATH_CSV} (cust_fake) must not return 500`, bodyCsv)
    return
  }
  if (res.status === 404) {
    fail(`GET ${PATH_CSV} (cust_fake): 404 — route missing`, bodyCsv)
    return
  }
  if (res.status === 200) {
    console.log(`  GET ${PATH_CSV} (cust_fake): 200`)
  } else {
    console.log(`  GET ${PATH_CSV} (cust_fake): ${res.status}`)
  }

  pass('No headers rejected for summary and csv; fake tenant returns 200 or 4xx (no 500).')
}

main()
  .then(() => exitSoon(process.exitCode ?? 0))
  .catch((err) => {
    console.error('self-test-audit-viewer-stage2b-plus: FAIL', err?.message ?? err)
    exitSoon(1)
  })
