#!/usr/bin/env node
/**
 * Self-test: Stage 1E — POST /api/send-queue/tick (admin dry-run).
 * Requires: ODCRM_TEST_CUSTOMER_ID, ODCRM_TEST_ADMIN_SECRET (X-Admin-Secret).
 * Optional: ODCRM_API_BASE_URL.
 * Exits 0 if HTTP 200 and data.requeued >= 0.
 */
const BASE_URL = (process.env.ODCRM_API_BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const TEST_CUSTOMER_ID = process.env.ODCRM_TEST_CUSTOMER_ID?.trim()
const TEST_ADMIN_SECRET = process.env.ODCRM_TEST_ADMIN_SECRET?.trim()

function fail(msg) {
  console.error('self-test-send-queue-stage1e: FAIL')
  console.error('  ', msg)
  process.exit(1)
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
  if (!TEST_CUSTOMER_ID) fail('ODCRM_TEST_CUSTOMER_ID is required')
  if (!TEST_ADMIN_SECRET) fail('ODCRM_TEST_ADMIN_SECRET is required (X-Admin-Secret for tick)')

  const res = await fetchJsonOrText(`${BASE_URL}/api/send-queue/tick`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Secret': TEST_ADMIN_SECRET,
    },
    body: JSON.stringify({ customerId: TEST_CUSTOMER_ID, limit: 5 }),
  })

  if (res.status !== 200) {
    console.error('  status:', res.status)
    console.error('  body:', typeof res.data === 'object' ? JSON.stringify(res.data) : res.text)
    fail(`Expected HTTP 200, got ${res.status}`)
  }

  const data = res.data?.data ?? res.data
  if (!data || typeof data.requeued !== 'number') {
    fail('Response missing data.requeued')
  }
  console.log('  tick result:', JSON.stringify(data))
  console.log('self-test-send-queue-stage1e: PASS')
  process.exit(0)
}

main().catch((err) => {
  console.error('self-test-send-queue-stage1e: FAIL')
  console.error(err)
  process.exit(1)
})
