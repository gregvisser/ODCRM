#!/usr/bin/env node
/**
 * Self-test: Stage 1D — dry-run is non-destructive (no FAILED + DRY_RUN).
 * API-level only: create enrollment, refresh queue, assert no item is FAILED with lastError containing "DRY_RUN".
 * Env: ODCRM_TEST_CUSTOMER_ID (required), ODCRM_TEST_SEQUENCE_ID (required),
 *      ODCRM_TEST_EMAIL (optional; default test+stage1d-<ts>@example.com),
 *      ODCRM_API_BASE_URL (optional).
 * Does NOT run the worker; verifies queue state after refresh is not poisoned.
 */
const BASE_URL = (process.env.ODCRM_API_BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const TEST_CUSTOMER_ID = process.env.ODCRM_TEST_CUSTOMER_ID?.trim()
const TEST_SEQUENCE_ID = process.env.ODCRM_TEST_SEQUENCE_ID?.trim()
const TEST_EMAIL = process.env.ODCRM_TEST_EMAIL?.trim() || `test+stage1d-${Date.now()}@example.com`
const BODY_TRUNCATE = 2000

function fail(msg) {
  console.error('self-test-send-queue-stage1d: FAIL')
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

function expect2xx(method, url, result, expectedDescription) {
  if (result.status >= 200 && result.status < 300) return
  console.error(`  ${method} ${url} -> ${result.status}`)
  const body = typeof result.text === 'string' ? result.text : JSON.stringify(result.data)
  const truncated = body.length > BODY_TRUNCATE ? body.slice(0, BODY_TRUNCATE) + '...' : body
  console.error('  body:', truncated)
  fail(expectedDescription || `Expected 2xx, got ${result.status}`)
}

async function request(method, path, body = null, headers = {}) {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`
  const opts = { method, headers: { 'Content-Type': 'application/json', ...headers } }
  if (body && (method === 'POST' || method === 'PUT')) opts.body = JSON.stringify(body)
  return fetchJsonOrText(url, opts)
}

async function main() {
  if (!TEST_CUSTOMER_ID) fail('ODCRM_TEST_CUSTOMER_ID is required')
  if (!TEST_SEQUENCE_ID) fail('ODCRM_TEST_SEQUENCE_ID is required')

  const headers = { 'X-Customer-Id': TEST_CUSTOMER_ID }

  const createRes = await request('POST', `/api/sequences/${TEST_SEQUENCE_ID}/enrollments`, {
    recipients: [{ email: TEST_EMAIL }],
  }, headers)
  expect2xx('POST', `/api/sequences/${TEST_SEQUENCE_ID}/enrollments`, createRes, 'Create enrollment 2xx')
  const enrollmentId = createRes.data?.data?.id ?? createRes.data?.id
  if (!enrollmentId) fail('Create enrollment did not return enrollment id')
  console.log('  Created enrollment:', enrollmentId)

  const refreshRes = await request('POST', `/api/enrollments/${enrollmentId}/queue/refresh`, null, headers)
  expect2xx('POST', `/api/enrollments/${enrollmentId}/queue/refresh`, refreshRes, 'Queue refresh 2xx')

  const queueRes = await request('GET', `/api/enrollments/${enrollmentId}/queue`, null, headers)
  expect2xx('GET', `/api/enrollments/${enrollmentId}/queue`, queueRes, 'GET queue 2xx')

  const raw = queueRes.data
  const items = raw?.data && Array.isArray(raw.data) ? raw.data : []
  const poisoned = items.filter(
    (it) => it.status === 'FAILED' && (it.lastError || '').includes('DRY_RUN')
  )
  if (poisoned.length > 0) {
    fail(`Found ${poisoned.length} item(s) with status=FAILED and lastError containing DRY_RUN (dry-run should be non-destructive)`)
  }
  console.log('  Queue items:', items.length, '; none FAILED+DRY_RUN')
  console.log('self-test-send-queue-stage1d: PASS')
  process.exit(0)
}

main().catch((err) => {
  console.error('self-test-send-queue-stage1d: FAIL')
  console.error(err)
  process.exit(1)
})
