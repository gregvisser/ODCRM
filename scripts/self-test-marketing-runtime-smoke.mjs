#!/usr/bin/env node
/**
 * Runtime operator smoke for Marketing tab (safe, no admin, no send).
 * Requires CUSTOMER_ID (cust_...) and uses tenant header for tenant-scoped routes.
 */

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-marketing-runtime-smoke: FAIL - ${message}`)
  process.exit(1)
}

function pass(message) {
  console.log(`PASS ${message}`)
}

if (!CUSTOMER_ID) {
  fail('CUSTOMER_ID is required. Example (PowerShell): $env:CUSTOMER_ID="cust_xxx"; npm run -s test:marketing-runtime-smoke')
}
if (!CUSTOMER_ID.startsWith('cust_')) {
  fail(`CUSTOMER_ID must start with cust_. Received: ${CUSTOMER_ID}`)
}

async function getJson(path, { tenant = false } = {}) {
  const headers = { Accept: 'application/json' }
  if (tenant) headers['X-Customer-Id'] = CUSTOMER_ID

  const maxAttempts = 3
  let res = null
  let lastError = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      res = await fetch(`${BASE_URL}${path}`, { method: 'GET', headers })
      if (res.ok) break
      if (res.status >= 500 && attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 400 * attempt))
        continue
      }
      break
    } catch (err) {
      lastError = err
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 400 * attempt))
        continue
      }
    }
  }

  if (!res) {
    fail(`network error for GET ${path}: ${lastError?.message || String(lastError)}`)
  }

  if (!res.ok) {
    let body = ''
    try { body = await res.text() } catch { body = '' }
    fail(`GET ${path} returned ${res.status}. Body: ${body.slice(0, 400)}`)
  }

  let json
  try {
    json = await res.json()
  } catch {
    fail(`GET ${path} returned non-JSON response`)
  }

  return json
}

function pickSha(buildPayload) {
  if (!buildPayload || typeof buildPayload !== 'object') return null
  if (typeof buildPayload.sha === 'string' && buildPayload.sha) return buildPayload.sha
  if (buildPayload.data && typeof buildPayload.data.sha === 'string' && buildPayload.data.sha) return buildPayload.data.sha
  return null
}

(async () => {
  console.log(`Base URL: ${BASE_URL}`)
  console.log(`Customer ID: ${CUSTOMER_ID}`)

  const buildJson = await getJson('/api/_build')
  const buildSha = pickSha(buildJson)
  if (!buildSha) {
    fail('GET /api/_build missing sha field')
  }
  pass(`/api/_build reachable (sha=${buildSha})`)

  const customerJson = await getJson(`/api/customers/${encodeURIComponent(CUSTOMER_ID)}`, { tenant: true })
  const customer = customerJson?.data ?? customerJson
  if (!customer || typeof customer !== 'object' || customer.id !== CUSTOMER_ID) {
    fail(`GET /api/customers/${CUSTOMER_ID} unexpected shape or id mismatch`)
  }
  pass(`/api/customers/${CUSTOMER_ID} returned tenant customer`)

  const sequencesJson = await getJson('/api/sequences', { tenant: true })
  const sequences = Array.isArray(sequencesJson?.data) ? sequencesJson.data : null
  if (!sequences) {
    fail('GET /api/sequences returned unexpected shape (expected data array)')
  }
  pass(`/api/sequences returned ${sequences.length} row(s)`)

  const previewJson = await getJson('/api/send-queue/preview?limit=20', { tenant: true })
  const previewRows = Array.isArray(previewJson?.data)
    ? previewJson.data
    : Array.isArray(previewJson?.data?.items)
      ? previewJson.data.items
      : null
  if (!previewRows) {
    fail('GET /api/send-queue/preview?limit=20 returned unexpected shape (expected data[] or data.items[])')
  }
  pass(`/api/send-queue/preview?limit=20 returned ${previewRows.length} row(s)`)

  const firstSequenceId = sequences.find((s) => s && typeof s.id === 'string')?.id
  if (!firstSequenceId) {
    fail('No sequences available for tenant; cannot validate queue drawer endpoint /api/enrollments/:id/queue')
  }

  const enrollmentsJson = await getJson(`/api/sequences/${encodeURIComponent(firstSequenceId)}/enrollments`, { tenant: true })
  const enrollments = Array.isArray(enrollmentsJson?.data) ? enrollmentsJson.data : null
  if (!enrollments) {
    fail(`GET /api/sequences/${firstSequenceId}/enrollments returned unexpected shape (expected data array)`)
  }
  const firstEnrollmentId = enrollments.find((e) => e && typeof e.id === 'string')?.id
  if (!firstEnrollmentId) {
    fail(`No enrollments found for sequence ${firstSequenceId}; cannot validate drawer list endpoint /api/enrollments/:id/queue`)
  }
  pass(`/api/sequences/${firstSequenceId}/enrollments returned ${enrollments.length} row(s)`)

  const queueJson = await getJson(`/api/enrollments/${encodeURIComponent(firstEnrollmentId)}/queue`, { tenant: true })
  const queueItems = Array.isArray(queueJson?.data) ? queueJson.data : null
  if (!queueItems) {
    fail(`GET /api/enrollments/${firstEnrollmentId}/queue returned unexpected shape (expected data array)`)
  }
  pass(`/api/enrollments/${firstEnrollmentId}/queue returned ${queueItems.length} row(s)`)

  console.log('self-test-marketing-runtime-smoke: PASS')
  process.exit(0)
})().catch((err) => {
  fail(err?.message || String(err))
})
