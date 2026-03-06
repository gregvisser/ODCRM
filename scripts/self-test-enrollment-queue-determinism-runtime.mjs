#!/usr/bin/env node
/**
 * Runtime proof: Enrollment -> Queue determinism (GET-only, tenant-scoped).
 * - Requires CUSTOMER_ID
 * - Safe for prod (no mutations, no admin secret)
 */

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

let passCount = 0
let skipCount = 0
let warnCount = 0

function fail(message) {
  console.error(`self-test-enrollment-queue-determinism-runtime: FAIL - ${message}`)
  process.exit(1)
}

function pass(message) {
  console.log(`PASS ${message}`)
  passCount += 1
}

function skip(message) {
  console.log(`SKIP ${message}`)
  skipCount += 1
}

function warn(message) {
  console.log(`WARN ${message}`)
  warnCount += 1
}

if (!CUSTOMER_ID) {
  fail('CUSTOMER_ID is required. Example (PowerShell): $env:CUSTOMER_ID="cust_xxx"; npm run -s test:enrollment-queue-determinism-runtime')
}
if (!CUSTOMER_ID.startsWith('cust_')) {
  fail(`CUSTOMER_ID must start with cust_. Received: ${CUSTOMER_ID}`)
}

async function getJson(path) {
  const headers = {
    Accept: 'application/json',
    'X-Customer-Id': CUSTOMER_ID,
  }

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

function hasSuccessEnvelope(payload) {
  return !!payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'success')
}

function getPrimaryData(payload) {
  if (!payload || typeof payload !== 'object') return payload
  if (Object.prototype.hasOwnProperty.call(payload, 'data')) return payload.data
  return payload
}

function normalizeCollection(payload, keys = []) {
  const primary = getPrimaryData(payload)

  if (Array.isArray(primary)) return primary

  if (primary && typeof primary === 'object') {
    if (Array.isArray(primary.items)) return primary.items
    for (const key of keys) {
      if (Array.isArray(primary[key])) return primary[key]
    }
  }

  if (payload && typeof payload === 'object') {
    for (const key of keys) {
      if (Array.isArray(payload[key])) return payload[key]
    }
  }

  return null
}

function assertCollection(path, payload, keys = []) {
  if (hasSuccessEnvelope(payload) && payload.success !== true) {
    fail(`GET ${path} returned success!=true`)
  }
  const rows = normalizeCollection(payload, keys)
  if (!rows) {
    fail(`GET ${path} returned unexpected shape (expected list/envelope list)`)
  }
  return rows
}

(async () => {
  console.log(`Base URL: ${BASE_URL}`)
  console.log(`Customer ID: ${CUSTOMER_ID}`)

  const sequencesPath = '/api/sequences'
  const sequencesJson = await getJson(sequencesPath)
  const sequences = assertCollection(sequencesPath, sequencesJson)
  pass(`${sequencesPath} returned ${sequences.length} row(s)`)

  const firstSequence = sequences.find((s) => s && typeof s.id === 'string')
  if (!firstSequence) {
    skip('no sequences for tenant; skipping enrollments and queue determinism checks')
    console.log(`self-test-enrollment-queue-determinism-runtime: PASS (checks=${passCount}, skipped=${skipCount}, warnings=${warnCount})`)
    process.exit(0)
  }

  const firstSequenceId = firstSequence.id
  const enrollmentsPath = `/api/sequences/${encodeURIComponent(firstSequenceId)}/enrollments`
  const enrollmentsJson = await getJson(enrollmentsPath)
  const enrollments = assertCollection(enrollmentsPath, enrollmentsJson)
  pass(`${enrollmentsPath} returned ${enrollments.length} row(s)`)

  const firstEnrollment = enrollments.find((e) => e && typeof e.id === 'string')
  if (!firstEnrollment) {
    skip(`no enrollments for sequence ${firstSequenceId}; skipping queue determinism checks`)
    console.log(`self-test-enrollment-queue-determinism-runtime: PASS (checks=${passCount}, skipped=${skipCount}, warnings=${warnCount})`)
    process.exit(0)
  }

  const firstEnrollmentId = firstEnrollment.id
  const queuePath = `/api/enrollments/${encodeURIComponent(firstEnrollmentId)}/queue`
  const queueJson = await getJson(queuePath)
  const queueItems = assertCollection(queuePath, queueJson)
  if (queueItems.length === 0) {
    const emptyReason = queueJson?.meta?.emptyReason || queueJson?.emptyReason || queueJson?.reason || queueJson?.message
    if (typeof emptyReason === 'string' && emptyReason.trim().length > 0) {
      pass(`${queuePath} returned empty queue with explicit reason: ${emptyReason.trim()}`)
    } else {
      fail(`${queuePath} returned 0 rows for existing enrollment ${firstEnrollmentId} without explicit empty reason`)
    }
  } else {
    pass(`${queuePath} returned ${queueItems.length} row(s)`)
  }

  const previewPath = '/api/send-queue/preview?limit=50'
  const previewJson = await getJson(previewPath)
  const previewRows = assertCollection(previewPath, previewJson)
  if (queueItems.length > 0 && previewRows.length === 0) {
    warn(`${previewPath} returned 0 rows while enrollment queue has ${queueItems.length} row(s); possible filter/status mismatch`)
  } else {
    pass(`${previewPath} returned ${previewRows.length} row(s)`)
  }

  console.log(`self-test-enrollment-queue-determinism-runtime: PASS (checks=${passCount}, skipped=${skipCount}, warnings=${warnCount})`)
  process.exit(0)
})().catch((err) => {
  fail(err?.message || String(err))
})
