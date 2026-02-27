#!/usr/bin/env node
/**
 * Self-test: Stage 1B enrollments — pause, resume, list by customer.
 * Requires backend running and ODCRM_CUSTOMER_ID (optional: ODCRM_API_BASE_URL, ODCRM_SEQUENCE_ID).
 * - GET /api/_build (reachable)
 * - POST /api/sequences/:sequenceId/enrollments (create)
 * - POST /api/enrollments/:enrollmentId/pause
 * - POST /api/enrollments/:enrollmentId/resume
 * - GET /api/enrollments (list includes created enrollment)
 * Verifies 200/201/404 as appropriate; never 500.
 */
const BASE_URL = (process.env.ODCRM_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '')
const CUSTOMER_ID = process.env.ODCRM_CUSTOMER_ID?.trim()
const SEQUENCE_ID = process.env.ODCRM_SEQUENCE_ID?.trim()
const BODY_TRUNCATE = 2000

function fail(msg) {
  console.error('self-test-enrollments-stage1b: FAIL')
  console.error('  ', msg)
  process.exit(1)
}

/**
 * Performs fetch, captures status, reads text() safely, tries JSON.parse else returns raw text.
 * On fetch throw (e.g. connection reset), prints method + url + error and exits.
 */
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
    console.error(`  ${method} ${url} -> fetch threw`)
    console.error('  error:', err.message || String(err))
    fail(`Request failed: ${err.message || String(err)}`)
  }
}

/** On non-2xx, print method + url + status + body (truncated), then fail. */
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
  if (!CUSTOMER_ID) fail('ODCRM_CUSTOMER_ID is required (and optionally ODCRM_API_BASE_URL, ODCRM_SEQUENCE_ID)')

  const headers = { 'X-Customer-Id': CUSTOMER_ID }

  // 1. Backend reachable
  const build = await request('GET', '/api/_build')
  expect2xx('GET', `${BASE_URL}/api/_build`, build, `GET /api/_build returned ${build.status}, expected 200`)
  console.log('  GET /api/_build: 200')

  // 2. Resolve sequenceId if not provided
  let sequenceId = SEQUENCE_ID
  if (!sequenceId) {
    const seqRes = await request('GET', '/api/sequences', null, headers)
    expect2xx('GET', `${BASE_URL}/api/sequences`, seqRes, `GET /api/sequences returned ${seqRes.status}, expected 200`)
    const list = seqRes.data?.data
    if (!Array.isArray(list) || list.length === 0) fail('GET /api/sequences returned no sequences; set ODCRM_SEQUENCE_ID or create a sequence first')
    sequenceId = list[0].id
    console.log('  GET /api/sequences: 200, using first sequence:', sequenceId)
  }

  // 3. Create enrollment
  const createRes = await request('POST', `/api/sequences/${sequenceId}/enrollments`, {
    name: 'Stage 1B self-test',
    recipients: [{ email: `stage1b-${Date.now()}@example.com` }],
  }, headers)
  if (createRes.status >= 500) expect2xx('POST', `${BASE_URL}/api/sequences/${sequenceId}/enrollments`, createRes, `POST .../enrollments returned ${createRes.status} (must never 500)`)
  if (createRes.status !== 201) expect2xx('POST', `${BASE_URL}/api/sequences/${sequenceId}/enrollments`, createRes, `POST .../enrollments returned ${createRes.status}, expected 201`)
  const enrollmentId = createRes.data?.data?.id
  if (!enrollmentId) fail('Create response missing data.id')
  console.log('  POST .../enrollments: 201, enrollmentId:', enrollmentId)

  // 4. Pause
  const pauseRes = await request('POST', `/api/enrollments/${enrollmentId}/pause`, null, headers)
  if (pauseRes.status >= 500) expect2xx('POST', `${BASE_URL}/api/enrollments/${enrollmentId}/pause`, pauseRes, `POST .../pause returned ${pauseRes.status} (must never 500)`)
  if (pauseRes.status !== 200) expect2xx('POST', `${BASE_URL}/api/enrollments/${enrollmentId}/pause`, pauseRes, `POST .../pause returned ${pauseRes.status}, expected 200`)
  if (pauseRes.data?.data?.status !== 'PAUSED') fail(`After pause expected status PAUSED, got ${pauseRes.data?.data?.status}`)
  console.log('  POST .../pause: 200, status=PAUSED')

  // 5. Resume
  const resumeRes = await request('POST', `/api/enrollments/${enrollmentId}/resume`, null, headers)
  if (resumeRes.status >= 500) expect2xx('POST', `${BASE_URL}/api/enrollments/${enrollmentId}/resume`, resumeRes, `POST .../resume returned ${resumeRes.status} (must never 500)`)
  if (resumeRes.status !== 200) expect2xx('POST', `${BASE_URL}/api/enrollments/${enrollmentId}/resume`, resumeRes, `POST .../resume returned ${resumeRes.status}, expected 200`)
  if (resumeRes.data?.data?.status !== 'ACTIVE') fail(`After resume expected status ACTIVE, got ${resumeRes.data?.data?.status}`)
  console.log('  POST .../resume: 200, status=ACTIVE')

  // 6. List enrollments and verify our enrollment is included
  const listRes = await request('GET', '/api/enrollments', null, headers)
  if (listRes.status >= 500) expect2xx('GET', `${BASE_URL}/api/enrollments`, listRes, `GET /api/enrollments returned ${listRes.status} (must never 500)`)
  if (listRes.status !== 200) expect2xx('GET', `${BASE_URL}/api/enrollments`, listRes, `GET /api/enrollments returned ${listRes.status}, expected 200`)
  const enrollments = listRes.data?.data
  if (!Array.isArray(enrollments)) fail('GET /api/enrollments response missing data array')
  const found = enrollments.find((e) => e.id === enrollmentId)
  if (!found) fail(`GET /api/enrollments did not include created enrollment ${enrollmentId}`)
  console.log('  GET /api/enrollments: 200, created enrollment in list')

  // 7. Not-found returns 404 (wrong id, same tenant)
  const notFoundRes = await request('GET', '/api/enrollments/nonexistent-id-12345', null, headers)
  if (notFoundRes.status >= 500) expect2xx('GET', `${BASE_URL}/api/enrollments/nonexistent-id-12345`, notFoundRes, `GET .../nonexistent returned ${notFoundRes.status} (must never 500)`)
  if (notFoundRes.status !== 404) expect2xx('GET', `${BASE_URL}/api/enrollments/nonexistent-id-12345`, notFoundRes, `GET .../nonexistent expected 404, got ${notFoundRes.status}`)
  console.log('  GET .../nonexistent: 404')

  console.log('self-test-enrollments-stage1b: PASS')
  process.exit(0)
}

main().catch((err) => {
  console.error('self-test-enrollments-stage1b: FAIL')
  console.error('  ', err.message || err)
  process.exit(1)
})
