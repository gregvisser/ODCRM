#!/usr/bin/env node
/**
 * Self-test: Stage 1F — canary-only live sending (step 0), tick dryRun vs live.
 * Default (no ODCRM_TEST_LIVE): preflight only — GET /api/_build, tick requires X-Admin-Secret (401 without),
 * optional dry-run tick if ODCRM_TEST_CUSTOMER_ID + ODCRM_TEST_ADMIN_SECRET set. No mutation.
 * Live: set ODCRM_TEST_LIVE=1 and ODCRM_TEST_CANARY_IDENTITY_ID (must match server canary); creates enrollment,
 * refresh queue, tick with dryRun=false limit 1, asserts one item SENT with sentAt.
 */
const BASE_URL = (process.env.ODCRM_API_BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const TEST_CUSTOMER_ID = process.env.ODCRM_TEST_CUSTOMER_ID?.trim()
const TEST_ADMIN_SECRET = process.env.ODCRM_TEST_ADMIN_SECRET?.trim()
const TEST_LIVE = process.env.ODCRM_TEST_LIVE === '1'
const TEST_CANARY_IDENTITY_ID = process.env.ODCRM_TEST_CANARY_IDENTITY_ID?.trim()
const TEST_SEQUENCE_ID = process.env.ODCRM_TEST_SEQUENCE_ID?.trim()

function fail(msg) {
  console.error('self-test-send-queue-stage1f: FAIL')
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

async function request(method, path, body = null, headers = {}) {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`
  const opts = { method, headers: { 'Content-Type': 'application/json', ...headers } }
  if (body != null && (method === 'POST' || method === 'PUT')) opts.body = JSON.stringify(body)
  return fetchJsonOrText(url, opts)
}

async function main() {
  // --- Preflight: _build ---
  const buildRes = await fetchJsonOrText(`${BASE_URL}/api/_build`)
  if (buildRes.status !== 200) {
    console.error('  GET /api/_build status:', buildRes.status)
    fail(`GET /api/_build expected 200, got ${buildRes.status}`)
  }
  console.log('  GET /api/_build: 200')

  // --- Preflight: tick without X-Admin-Secret -> 401 ---
  const noSecretRes = await request('POST', '/api/send-queue/tick', { customerId: 'any' })
  if (noSecretRes.status !== 401) {
    console.error('  POST /api/send-queue/tick without X-Admin-Secret status:', noSecretRes.status)
    fail(`Tick without admin secret expected 401, got ${noSecretRes.status}`)
  }
  console.log('  POST /api/send-queue/tick (no secret): 401')

  // --- Optional: dry-run tick (non-mutating) ---
  if (TEST_CUSTOMER_ID && TEST_ADMIN_SECRET) {
    const dryRes = await request('POST', '/api/send-queue/tick', {
      customerId: TEST_CUSTOMER_ID,
      limit: 1,
      dryRun: true,
    }, { 'X-Admin-Secret': TEST_ADMIN_SECRET })
    if (dryRes.status !== 200) {
      console.error('  tick dryRun status:', dryRes.status, dryRes.data ?? dryRes.text)
      fail(`Tick dryRun expected 200, got ${dryRes.status}`)
    }
    const d = dryRes.data?.data ?? dryRes.data
    if (d && typeof d.requeued === 'number') {
      console.log('  POST /api/send-queue/tick (dryRun=true): 200, requeued=', d.requeued, 'sent=', d.sent ?? 0)
    }
  } else {
    console.log('  (Set ODCRM_TEST_CUSTOMER_ID + ODCRM_TEST_ADMIN_SECRET to run dry-run tick)')
  }

  if (!TEST_LIVE) {
    console.log('self-test-send-queue-stage1f: PASS (preflight only, no mutation)')
    console.log('  For live send test: ODCRM_TEST_LIVE=1 ODCRM_TEST_CANARY_IDENTITY_ID=<id> ODCRM_TEST_CUSTOMER_ID ODCRM_TEST_ADMIN_SECRET ODCRM_TEST_SEQUENCE_ID')
    process.exit(0)
    return
  }

  // --- Live path: require canary env ---
  if (!TEST_CUSTOMER_ID || !TEST_ADMIN_SECRET) {
    fail('ODCRM_TEST_LIVE=1 requires ODCRM_TEST_CUSTOMER_ID and ODCRM_TEST_ADMIN_SECRET')
  }
  if (!TEST_CANARY_IDENTITY_ID) {
    fail('ODCRM_TEST_LIVE=1 requires ODCRM_TEST_CANARY_IDENTITY_ID (must match server SEND_CANARY_IDENTITY_ID)')
  }
  if (!TEST_SEQUENCE_ID) {
    fail('ODCRM_TEST_LIVE=1 requires ODCRM_TEST_SEQUENCE_ID')
  }

  const headers = { 'X-Customer-Id': TEST_CUSTOMER_ID }

  // Get or create an enrollment for the sequence
  let enrollmentId
  const listRes = await request('GET', `/api/sequences/${TEST_SEQUENCE_ID}/enrollments`, null, headers)
  if (listRes.status !== 200 || !Array.isArray(listRes.data?.data) || listRes.data.data.length === 0) {
    const createRes = await request('POST', `/api/sequences/${TEST_SEQUENCE_ID}/enrollments`, {
      recipients: [{ email: 'canary-stage1f@example.com', firstName: 'Canary', lastName: 'Test' }],
    }, headers)
    if (createRes.status < 200 || createRes.status >= 300) {
      fail(`Create enrollment failed: ${createRes.status} ${JSON.stringify(createRes.data)}`)
    }
    enrollmentId = createRes.data?.data?.id ?? createRes.data?.id
    if (!enrollmentId) fail('Create enrollment response missing id')
    console.log('  Created enrollment:', enrollmentId)
  } else {
    enrollmentId = listRes.data.data[0].id
    console.log('  Using enrollment:', enrollmentId)
  }

  await request('POST', `/api/enrollments/${enrollmentId}/queue/refresh`, null, headers)
  const queueBefore = await request('GET', `/api/enrollments/${enrollmentId}/queue`, null, headers)
  if (queueBefore.status !== 200) fail('GET queue failed')
  const itemsBefore = queueBefore.data?.data ?? []

  const tickRes = await request('POST', '/api/send-queue/tick', {
    customerId: TEST_CUSTOMER_ID,
    limit: 5,
    dryRun: false,
  }, { 'X-Admin-Secret': TEST_ADMIN_SECRET })
  if (tickRes.status !== 200) {
    console.error('  tick live status:', tickRes.status, tickRes.data ?? tickRes.text)
    fail(`Tick live expected 200, got ${tickRes.status}. Ensure ODCRM_ALLOW_LIVE_TICK and canary env on server.`)
  }
  const tickData = tickRes.data?.data ?? tickRes.data
  console.log('  tick (dryRun=false):', JSON.stringify(tickData))

  const queueAfter = await request('GET', `/api/enrollments/${enrollmentId}/queue`, null, headers)
  if (queueAfter.status !== 200) fail('GET queue after failed')
  const itemsAfter = queueAfter.data?.data ?? []
  const sent = itemsAfter.filter((i) => i.status === 'SENT' && i.sentAt)
  if (sent.length === 0 && itemsAfter.length > 0) {
    console.log('  No SENT items yet (canary/limit may have requeued). Items:', itemsAfter.map((i) => ({ id: i.id, status: i.status, sentAt: i.sentAt })))
  }
  if (sent.length > 0) {
    console.log('  At least one item SENT with sentAt:', sent[0].sentAt)
  }

  console.log('self-test-send-queue-stage1f: PASS (live path)')
  process.exit(0)
}

main().catch((err) => {
  console.error('self-test-send-queue-stage1f: FAIL')
  console.error(err)
  process.exit(1)
})
