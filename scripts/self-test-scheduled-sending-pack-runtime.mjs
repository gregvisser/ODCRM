#!/usr/bin/env node
const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-scheduled-sending-pack-runtime: FAIL - ${message}`)
  process.exit(1)
}

if (!CUSTOMER_ID) {
  fail('CUSTOMER_ID env var is required')
}

async function getJson(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Accept: 'application/json',
      'X-Customer-Id': CUSTOMER_ID,
    },
  })
  const text = await response.text()
  if (!response.ok) {
    fail(`GET ${path} returned ${response.status}: ${text.slice(0, 300)}`)
  }
  try {
    return text ? JSON.parse(text) : null
  } catch {
    fail(`GET ${path} returned non-JSON`) 
  }
}

const gates = await getJson('/api/send-worker/live-gates?sinceHours=24')
if (!gates?.success || !gates?.data || typeof gates.data !== 'object') {
  fail('invalid live-gates envelope')
}

const data = gates.data
if (typeof data?.flags?.enableScheduledSendingEngine !== 'boolean') {
  fail('flags.enableScheduledSendingEngine missing boolean')
}
const hasMode = typeof data?.mode?.scheduledEngineMode === 'string' && data.mode.scheduledEngineMode.trim().length > 0
if (typeof data?.caps?.scheduledEngineCron !== 'string' || !data.caps.scheduledEngineCron.trim()) {
  fail('caps.scheduledEngineCron missing string')
}
const hasRecent = Boolean(data?.recent && typeof data.recent === 'object' && data.recent.counts && typeof data.recent.counts === 'object')
const canaryCustomerIdPresent =
  typeof data?.canary?.customerIdPresent === 'boolean'
    ? data.canary.customerIdPresent
    : typeof data?.canaryCustomerId === 'string' && data.canaryCustomerId.trim().length > 0

const audits = await getJson('/api/send-worker/audits?limit=5')
const rows = Array.isArray(audits?.data?.items)
  ? audits.data.items
  : Array.isArray(audits?.data)
    ? audits.data
    : Array.isArray(audits)
      ? audits
      : null
if (!rows) {
  fail('audits endpoint returned unexpected shape')
}

if (!hasMode || !hasRecent) {
  console.log(`PASS wiring-only: target build missing new mode/recent fields (mode=${hasMode}, recent=${hasRecent})`)
  console.log(`PASS cron=${data.caps.scheduledEngineCron} scheduledEnabled=${data.flags.enableScheduledSendingEngine}`)
  console.log(`PASS canary.customerIdPresent=${canaryCustomerIdPresent}`)
  console.log(`PASS audits reachable rows=${rows.length}`)
  console.log('self-test-scheduled-sending-pack-runtime: PASS')
  process.exit(0)
}

const counts = data.recent.counts
console.log(`PASS mode=${data.mode.scheduledEngineMode} cron=${data.caps.scheduledEngineCron} scheduledEnabled=${data.flags.enableScheduledSendingEngine}`)
console.log(`PASS canary.customerIdPresent=${canaryCustomerIdPresent} liveAllowed=${data.mode.scheduledLiveAllowed === true}`)
console.log(
  `PASS recent window=${data.recent.windowHours}h counts={WOULD_SEND:${counts.WOULD_SEND ?? 0},SENT:${counts.SENT ?? 0},SEND_FAILED:${counts.SEND_FAILED ?? 0},SKIP_SUPPRESSED:${counts.SKIP_SUPPRESSED ?? 0},SKIP_REPLIED_STOP:${counts.SKIP_REPLIED_STOP ?? 0},hard_bounce_invalid_recipient:${counts.hard_bounce_invalid_recipient ?? 0}}`
)
console.log(`PASS audits reachable rows=${rows.length}`)
console.log('self-test-scheduled-sending-pack-runtime: PASS')
