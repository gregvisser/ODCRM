#!/usr/bin/env node
/**
 * Runtime operator smoke for Marketing tab (safe, no admin, no send).
 * Requires CUSTOMER_ID (cust_...) and uses tenant header for tenant-scoped routes.
 */

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()
const ADMIN_SECRET = (process.env.ADMIN_SECRET || '').trim()
let passCount = 0
let skipCount = 0

function fail(message) {
  console.error(`self-test-marketing-runtime-smoke: FAIL - ${message}`)
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

async function postJson(path, { tenant = false, admin = false, body = {} } = {}) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  if (tenant) headers['X-Customer-Id'] = CUSTOMER_ID
  if (admin) headers['X-Admin-Secret'] = ADMIN_SECRET

  const maxAttempts = 3
  let res = null
  let lastError = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      res = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers, body: JSON.stringify(body) })
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
    fail(`network error for POST ${path}: ${lastError?.message || String(lastError)}`)
  }

  if (!res.ok) {
    let bodyText = ''
    try { bodyText = await res.text() } catch { bodyText = '' }
    fail(`POST ${path} returned ${res.status}. Body: ${bodyText.slice(0, 400)}`)
  }

  let json
  try {
    json = await res.json()
  } catch {
    fail(`POST ${path} returned non-JSON response`)
  }

  return json
}

function pickSha(buildPayload) {
  if (!buildPayload || typeof buildPayload !== 'object') return null
  if (typeof buildPayload.sha === 'string' && buildPayload.sha) return buildPayload.sha
  if (buildPayload.data && typeof buildPayload.data.sha === 'string' && buildPayload.data.sha) return buildPayload.data.sha
  return null
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

function normalizeObject(payload) {
  const primary = getPrimaryData(payload)
  if (primary && typeof primary === 'object' && !Array.isArray(primary)) return primary
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

function assertObject(path, payload) {
  if (hasSuccessEnvelope(payload) && payload.success !== true) {
    fail(`GET ${path} returned success!=true`)
  }
  const obj = normalizeObject(payload)
  if (!obj) {
    fail(`GET ${path} returned unexpected shape (expected object/envelope object)`)
  }
  return obj
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

  const customerByIdPath = `/api/customers/${encodeURIComponent(CUSTOMER_ID)}`
  const customerJson = await getJson(customerByIdPath, { tenant: true })
  const customer = normalizeObject(customerJson)
  if (!customer || customer.id !== CUSTOMER_ID) {
    fail(`GET ${customerByIdPath} unexpected shape or id mismatch`)
  }
  pass(`${customerByIdPath} returned tenant customer`)

  const sequencesPath = '/api/sequences'
  const sequencesJson = await getJson(sequencesPath, { tenant: true })
  const sequences = assertCollection(sequencesPath, sequencesJson)
  pass(`${sequencesPath} returned ${sequences.length} row(s)`)

  const previewPath = '/api/send-queue/preview?limit=20'
  const previewJson = await getJson(previewPath, { tenant: true })
  const previewRows = assertCollection(previewPath, previewJson)
  pass(`${previewPath} returned ${previewRows.length} row(s)`)

  const firstSequenceId = sequences.find((s) => s && typeof s.id === 'string')?.id
  if (!firstSequenceId) {
    skip('no sequences for tenant; skipping enrollments/queue checks')
  } else {
    const enrollmentsPath = `/api/sequences/${encodeURIComponent(firstSequenceId)}/enrollments`
    const enrollmentsJson = await getJson(enrollmentsPath, { tenant: true })
    const enrollments = assertCollection(enrollmentsPath, enrollmentsJson)
    pass(`${enrollmentsPath} returned ${enrollments.length} row(s)`)

    const firstEnrollmentId = enrollments.find((e) => e && typeof e.id === 'string')?.id
    if (!firstEnrollmentId) {
      skip(`no enrollments for sequence ${firstSequenceId}; skipping enrollment queue check`)
    } else {
      const queuePath = `/api/enrollments/${encodeURIComponent(firstEnrollmentId)}/queue`
      const queueJson = await getJson(queuePath, { tenant: true })
      const queueItems = assertCollection(queuePath, queueJson)
      pass(`${queuePath} returned ${queueItems.length} row(s)`)
    }
  }

  const auditsPath = '/api/send-worker/audits?limit=5'
  const auditsJson = await getJson(auditsPath, { tenant: true })
  const auditItems = assertCollection(auditsPath, auditsJson)
  pass(`${auditsPath} returned ${auditItems.length} row(s)`)

  const summaryPath = '/api/send-worker/audits/summary?sinceHours=24'
  const summaryJson = await getJson(summaryPath, { tenant: true })
  const summary = assertObject(summaryPath, summaryJson)
  if (typeof summary.total !== 'number' || typeof summary.byDecision !== 'object' || !summary.byDecision) {
    fail(`GET ${summaryPath} returned unexpected summary shape (missing total/byDecision)`)
  }
  pass(`${summaryPath} returned total=${summary.total}`)

  // Marketing tabs GET-only runtime checks (derived from tab components)
  const templatesPath = '/api/templates'
  const templatesJson = await getJson(templatesPath, { tenant: true })
  const templates = assertCollection(templatesPath, templatesJson)
  pass(`${templatesPath} returned ${templates.length} row(s)`)

  const identitiesPath = `/api/outlook/identities?customerId=${encodeURIComponent(CUSTOMER_ID)}`
  const identitiesJson = await getJson(identitiesPath, { tenant: true })
  const identities = assertCollection(identitiesPath, identitiesJson)
  pass(`${identitiesPath} returned ${identities.length} row(s)`)

  const suppressionPath = `/api/suppression?customerId=${encodeURIComponent(CUSTOMER_ID)}`
  const suppressionJson = await getJson(suppressionPath, { tenant: true })
  const suppression = assertCollection(suppressionPath, suppressionJson)
  pass(`${suppressionPath} returned ${suppression.length} row(s)`)

  const inboxThreadsPath = '/api/inbox/threads?limit=50&offset=0&unreadOnly=false'
  const inboxThreadsJson = await getJson(inboxThreadsPath, { tenant: true })
  const inboxThreads = assertCollection(inboxThreadsPath, inboxThreadsJson, ['threads'])
  pass(`${inboxThreadsPath} returned ${inboxThreads.length} row(s)`)

  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - 30)
  const inboxRepliesPath = `/api/inbox/replies?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`
  const inboxRepliesJson = await getJson(inboxRepliesPath, { tenant: true })
  const inboxReplies = assertCollection(inboxRepliesPath, inboxRepliesJson, ['items'])
  pass(`/api/inbox/replies returned ${inboxReplies.length} row(s)`)

  const reportsCustomersPath = '/api/reports/customers'
  const reportsCustomersJson = await getJson(reportsCustomersPath, { tenant: true })
  const reportsCustomers = assertCollection(reportsCustomersPath, reportsCustomersJson, ['customers'])
  pass(`${reportsCustomersPath} returned ${reportsCustomers.length} row(s)`)

  const reportPath = `/api/reports/customer?customerId=${encodeURIComponent(CUSTOMER_ID)}&dateRange=today`
  const reportJson = await getJson(reportPath, { tenant: true })
  const report = assertObject(reportPath, reportJson)
  if (report.customerId && report.customerId !== CUSTOMER_ID) {
    fail(`GET ${reportPath} customerId mismatch`)
  }
  pass(`/api/reports/customer returned object`)

  const leadSourcesPath = '/api/lead-sources'
  const leadSourcesJson = await getJson(leadSourcesPath, { tenant: true })
  const leadSources = assertCollection(leadSourcesPath, leadSourcesJson, ['sources'])
  pass(`${leadSourcesPath} returned ${leadSources.length} row(s)`)

  const schedulesPath = '/api/schedules'
  const schedulesJson = await getJson(schedulesPath, { tenant: true })
  const schedules = assertCollection(schedulesPath, schedulesJson)
  pass(`${schedulesPath} returned ${schedules.length} row(s)`)

  const scheduledEmailsPath = '/api/schedules/emails'
  const scheduledEmailsJson = await getJson(scheduledEmailsPath, { tenant: true })
  const scheduledEmails = assertCollection(scheduledEmailsPath, scheduledEmailsJson)
  pass(`${scheduledEmailsPath} returned ${scheduledEmails.length} row(s)`)

  if (!ADMIN_SECRET) {
    skip('dry-run: ADMIN_SECRET not set')
  } else {
    const dryRunJson = await postJson('/api/send-worker/dry-run', { admin: true, body: {} })
    const dryRunSuccess = dryRunJson?.success === true
    if (!dryRunSuccess) {
      fail('POST /api/send-worker/dry-run returned unexpected contract (expected success=true)')
    }
    pass('POST /api/send-worker/dry-run succeeded')
  }

  console.log(`self-test-marketing-runtime-smoke: PASS (checks=${passCount}, skipped=${skipCount})`)
  process.exit(0)
})().catch((err) => {
  fail(err?.message || String(err))
})
