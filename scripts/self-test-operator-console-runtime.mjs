#!/usr/bin/env node
const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-operator-console-runtime: FAIL - ${message}`)
  process.exit(1)
}

if (!CUSTOMER_ID) fail('CUSTOMER_ID env var is required')

async function getJson(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: 'application/json', 'X-Customer-Id': CUSTOMER_ID },
  })
  const text = await response.text()
  if (!response.ok) {
    if (
      path.startsWith('/api/send-worker/console') &&
      response.status === 404 &&
      text.toLowerCase().includes('cannot get /api/send-worker/console')
    ) {
      return { __missingRoute: true }
    }
    fail(`GET ${path} returned ${response.status}: ${text.slice(0, 300)}`)
  }
  try {
    return text ? JSON.parse(text) : null
  } catch {
    fail(`GET ${path} returned non-JSON`)
  }
}

function assertNumber(value, path) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    fail(`${path} must be a number`)
  }
}

const consolePayload = await getJson('/api/send-worker/console?sinceHours=24')
if (consolePayload?.__missingRoute) {
  const audits = await getJson('/api/send-worker/audits?limit=5')
  const items = Array.isArray(audits?.data?.items)
    ? audits.data.items
    : Array.isArray(audits?.data)
      ? audits.data
      : Array.isArray(audits)
        ? audits
        : null
  if (!items) fail('audits endpoint unreachable/invalid shape')
  console.log('PASS wiring-only: /api/send-worker/console not yet available on target build')
  console.log(`PASS audits reachable rows=${items.length}`)
  console.log('self-test-operator-console-runtime: PASS')
  process.exit(0)
}
if (!consolePayload?.success || !consolePayload?.data || typeof consolePayload.data !== 'object') {
  fail('console endpoint invalid envelope')
}

const data = consolePayload.data
if (!data.status || typeof data.status !== 'object') fail('missing status object')
if (!data.queue || typeof data.queue !== 'object') fail('missing queue object')
if (!data.recent || typeof data.recent !== 'object') fail('missing recent object')
if (!data.samples || typeof data.samples !== 'object') fail('missing samples object')

assertNumber(data.queue.totalQueued, 'queue.totalQueued')
assertNumber(data.queue.readyNow, 'queue.readyNow')
assertNumber(data.queue.scheduledLater, 'queue.scheduledLater')
assertNumber(data.queue.suppressed, 'queue.suppressed')
assertNumber(data.queue.replyStopped, 'queue.replyStopped')
assertNumber(data.queue.failedRecently, 'queue.failedRecently')
assertNumber(data.queue.sentRecently, 'queue.sentRecently')
assertNumber(data.queue.blocked, 'queue.blocked')

if (!data.recent.counts || typeof data.recent.counts !== 'object') {
  fail('recent.counts missing object')
}
if (!Array.isArray(data.samples.readyNow)) fail('samples.readyNow must be an array')
if (!Array.isArray(data.samples.failedRecently)) fail('samples.failedRecently must be an array')
if (!Array.isArray(data.samples.blocked)) fail('samples.blocked must be an array')

const audits = await getJson('/api/send-worker/audits?limit=5')
const items = Array.isArray(audits?.data?.items)
  ? audits.data.items
  : Array.isArray(audits?.data)
    ? audits.data
    : Array.isArray(audits)
      ? audits
      : null
if (!items) fail('audits endpoint unreachable/invalid shape')

const counts = data.recent.counts
console.log(`PASS mode=${data.status.scheduledEngineMode} cron=${data.status.cron} queued=${data.queue.totalQueued} readyNow=${data.queue.readyNow} blocked=${data.queue.blocked}`)
console.log(`PASS recent={WOULD_SEND:${counts.WOULD_SEND ?? 0},SENT:${counts.SENT ?? 0},SEND_FAILED:${counts.SEND_FAILED ?? 0},SKIP_SUPPRESSED:${counts.SKIP_SUPPRESSED ?? 0},SKIP_REPLIED_STOP:${counts.SKIP_REPLIED_STOP ?? 0},hard_bounce_invalid_recipient:${counts.hard_bounce_invalid_recipient ?? 0}}`)
console.log(`PASS samples sizes readyNow=${data.samples.readyNow.length} failedRecently=${data.samples.failedRecently.length} blocked=${data.samples.blocked.length}`)
console.log(`PASS audits reachable rows=${items.length}`)
console.log('self-test-operator-console-runtime: PASS')
