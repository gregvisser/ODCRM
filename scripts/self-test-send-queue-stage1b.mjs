#!/usr/bin/env node
/**
 * Self-test: Stage 1B send queue — persist queue + refresh + list (tenant-safe).
 * Hits production or ODCRM_API_BASE_URL. No real emails sent.
 * Env: ODCRM_TEST_CUSTOMER_ID (required), ODCRM_TEST_SEQUENCE_ID (required),
 *      ODCRM_TEST_ENROLLMENT_ID (optional), ODCRM_API_BASE_URL (optional).
 * 1) GET /api/sequences/:sequenceId/enrollments, pick one enrollmentId (or use env).
 * 2) POST /api/enrollments/:enrollmentId/queue/refresh (minimal write).
 * 3) GET /api/enrollments/:enrollmentId/queue — assert 200, data array, every item customerId matches tenant.
 */
const BASE_URL = (process.env.ODCRM_API_BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const TEST_CUSTOMER_ID = process.env.ODCRM_TEST_CUSTOMER_ID?.trim()
const TEST_SEQUENCE_ID = process.env.ODCRM_TEST_SEQUENCE_ID?.trim()
const TEST_ENROLLMENT_ID = process.env.ODCRM_TEST_ENROLLMENT_ID?.trim()
const BODY_TRUNCATE = 2000

const EXPECTED_STATUSES = ['QUEUED', 'LOCKED', 'SENT', 'FAILED', 'SKIPPED']

function fail(msg) {
  console.error('self-test-send-queue-stage1b: FAIL')
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

  let enrollmentId = TEST_ENROLLMENT_ID
  if (!enrollmentId) {
    const listRes = await request('GET', `/api/sequences/${TEST_SEQUENCE_ID}/enrollments`, null, headers)
    expect2xx('GET', `/api/sequences/${TEST_SEQUENCE_ID}/enrollments`, listRes, 'List enrollments 2xx')
    const list = listRes.data?.data
    if (!Array.isArray(list) || list.length === 0) {
      fail('No enrollments for sequence; create one or set ODCRM_TEST_ENROLLMENT_ID')
    }
    enrollmentId = list[0].id
    console.log('  Using enrollmentId:', enrollmentId)
  }

  const refreshRes = await request('POST', `/api/enrollments/${enrollmentId}/queue/refresh`, null, headers)
  expect2xx('POST', `/api/enrollments/${enrollmentId}/queue/refresh`, refreshRes, 'Queue refresh 2xx')
  console.log('  POST /queue/refresh: 200,', refreshRes.data?.data ? JSON.stringify(refreshRes.data.data) : '')

  const queueRes = await request('GET', `/api/enrollments/${enrollmentId}/queue`, null, headers)
  expect2xx('GET', `/api/enrollments/${enrollmentId}/queue`, queueRes, 'GET queue 2xx')
  const data = queueRes.data?.data
  if (!Array.isArray(data)) {
    fail('GET /queue response.data must be an array')
  }
  for (const item of data) {
    if (item.customerId !== TEST_CUSTOMER_ID) {
      fail(`Queue item ${item.id} has customerId=${item.customerId}, expected ${TEST_CUSTOMER_ID}`)
    }
    if (!EXPECTED_STATUSES.includes(item.status)) {
      fail(`Queue item ${item.id} has status=${item.status}, expected one of ${EXPECTED_STATUSES.join(', ')}`)
    }
  }
  console.log('  GET /queue: 200, items=', data.length, ', meta=', queueRes.data?.meta ? JSON.stringify(queueRes.data.meta) : '{}')

  console.log('self-test-send-queue-stage1b: PASS')
  process.exit(0)
}

main().catch((err) => {
  console.error('self-test-send-queue-stage1b: FAIL')
  console.error(err)
  process.exit(1)
})
