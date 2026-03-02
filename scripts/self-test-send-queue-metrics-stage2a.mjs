#!/usr/bin/env node
/**
 * Self-test: Stage 2A — Send Queue metrics endpoint (admin-only).
 * Requires: ODCRM_TEST_ADMIN_SECRET, ODCRM_TEST_CUSTOMER_ID.
 * Optional: ODCRM_API_BASE_URL (default prod).
 * Calls GET /api/_build and GET /api/send-queue/metrics?customerId=... with X-Admin-Secret; exits 0 on success.
 */
const BASE_URL = (process.env.ODCRM_API_BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const TEST_ADMIN_SECRET = process.env.ODCRM_TEST_ADMIN_SECRET?.trim()
const TEST_CUSTOMER_ID = process.env.ODCRM_TEST_CUSTOMER_ID?.trim()

function fail(msg) {
  console.error('self-test-send-queue-metrics-stage2a: FAIL')
  console.error('  ', msg)
  process.exit(1)
}

if (!TEST_ADMIN_SECRET) {
  fail('ODCRM_TEST_ADMIN_SECRET is required')
}
if (!TEST_CUSTOMER_ID) {
  fail('ODCRM_TEST_CUSTOMER_ID is required')
}

async function fetchJsonOrText(url, opts = {}) {
  const method = opts.method || 'GET'
  try {
    const res = await fetch(url, opts)
    const text = await res.text()
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }
    return { status: res.status, data, text }
  } catch (err) {
    console.error(`  ${method} ${url} -> fetch threw: ${err.message || String(err)}`)
    fail(`Request failed: ${err.message || String(err)}`)
  }
}

async function main() {
  const buildRes = await fetchJsonOrText(`${BASE_URL}/api/_build`)
  if (buildRes.status !== 200) {
    console.error('  GET /api/_build status:', buildRes.status)
    fail(`GET /api/_build expected 200, got ${buildRes.status}`)
  }
  console.log('  GET /api/_build: 200')

  const metricsUrl = `${BASE_URL}/api/send-queue/metrics?customerId=${encodeURIComponent(TEST_CUSTOMER_ID)}`
  const metricsRes = await fetchJsonOrText(metricsUrl, {
    method: 'GET',
    headers: { 'X-Admin-Secret': TEST_ADMIN_SECRET },
  })
  if (metricsRes.status !== 200) {
    console.error('  GET /api/send-queue/metrics status:', metricsRes.status, metricsRes.data ?? metricsRes.text)
    fail(`GET /api/send-queue/metrics expected 200, got ${metricsRes.status}`)
  }

  const d = metricsRes.data?.data ?? metricsRes.data
  if (d && d.customerId === TEST_CUSTOMER_ID) {
    console.log('  GET /api/send-queue/metrics: 200')
    console.log('  customerId:', d.customerId, '| countsByStatus:', JSON.stringify(d.countsByStatus ?? {}), '| dueNow:', d.dueNow ?? 0)
  } else {
    fail('Metrics response missing data.customerId or unexpected shape')
  }

  console.log('self-test-send-queue-metrics-stage2a: PASS')
  process.exit(0)
}

main().catch((err) => {
  console.error('self-test-send-queue-metrics-stage2a: FAIL')
  console.error(err)
  process.exit(1)
})
