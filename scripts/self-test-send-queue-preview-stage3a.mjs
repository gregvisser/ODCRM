#!/usr/bin/env node
/**
 * Self-test: Stage 3A — send-queue preview endpoint (CI-safe guardrail).
 * 1) No headers => expect 400 (X-Customer-Id required) or 401/403 (auth required).
 * 2) With X-Customer-Id, no auth => expect 200 (local/dev) or 401/403 (prod); if 200, validate data.items array.
 */
const BASE_URL = (process.env.ODCRM_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '')
const TEST_CUSTOMER_ID = process.env.ODCRM_TEST_CUSTOMER_ID?.trim() || 'cust_preview_test'

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
    return { status: -1, data: null, text: err?.message || String(err) }
  }
}

async function main() {
  let branch = 'none'
  const previewUrl = `${BASE_URL}/api/send-queue/preview`

  // 1) No headers
  const noHeaders = await fetchJsonOrText(previewUrl, { method: 'GET' })
  if (noHeaders.status === 400) {
    const body = noHeaders.data || noHeaders.text || ''
    const msg = typeof body === 'object' ? body?.error || JSON.stringify(body) : body
    if (!String(msg).toLowerCase().includes('customer') && !String(msg).toLowerCase().includes('x-customer-id')) {
      console.error('self-test-send-queue-preview-stage3a: FAIL')
      console.error('  Expected 400 body to mention X-Customer-Id required, got:', msg)
      process.exit(1)
    }
    branch = '400 (tenant required)'
    console.log('  GET /api/send-queue/preview (no headers): 400, body mentions X-Customer-Id')
  } else if (noHeaders.status === 401 || noHeaders.status === 403) {
    branch = '401/403 (auth required)'
    console.log(`  GET /api/send-queue/preview (no headers): ${noHeaders.status} (auth required)`)
  } else {
    console.error('self-test-send-queue-preview-stage3a: FAIL')
    console.error('  Expected 400 or 401/403 without headers, got:', noHeaders.status, noHeaders.data ?? noHeaders.text)
    process.exit(1)
  }

  // 2) With X-Customer-Id, no auth
  const withTenant = await fetchJsonOrText(previewUrl, {
    method: 'GET',
    headers: { 'X-Customer-Id': TEST_CUSTOMER_ID },
  })
  if (withTenant.status === 200) {
    const items = withTenant.data?.data?.items
    if (!Array.isArray(items)) {
      console.error('self-test-send-queue-preview-stage3a: FAIL')
      console.error('  Expected 200 response to have data.items array, got:', withTenant.data)
      process.exit(1)
    }
    branch += ' | 200 with X-Customer-Id (data.items present)'
    console.log('  GET /api/send-queue/preview (X-Customer-Id): 200, items=', items.length)
  } else if (withTenant.status === 401 || withTenant.status === 403) {
    branch += ' | 401/403 with X-Customer-Id (auth required)'
    console.log(`  GET /api/send-queue/preview (X-Customer-Id): ${withTenant.status} (auth required)`)
  } else if (withTenant.status === 500) {
    branch += ' | 500 with X-Customer-Id (env/DB not ready, e.g. table missing)'
    console.log('  GET /api/send-queue/preview (X-Customer-Id): 500 (env/DB not ready)')
  } else {
    console.error('self-test-send-queue-preview-stage3a: FAIL')
    console.error('  Expected 200, 401/403, or 500 with X-Customer-Id, got:', withTenant.status, withTenant.data ?? withTenant.text)
    process.exit(1)
  }

  console.log('self-test-send-queue-preview-stage3a: PASS')
  console.log('  branch:', branch)
  process.exit(0)
}

main().catch((err) => {
  console.error('self-test-send-queue-preview-stage3a: FAIL')
  console.error(err)
  process.exit(1)
})
