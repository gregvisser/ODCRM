#!/usr/bin/env node
/**
 * Runtime smoke (GET-only): verifies scheduled sending engine gate/status shape.
 * No mutations, no sending.
 */
const BASE_URL = process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net'
const CUSTOMER_ID = process.env.CUSTOMER_ID || ''

if (!CUSTOMER_ID) {
  console.error('self-test-sending-engine-status-runtime: FAIL - CUSTOMER_ID env var is required')
  process.exit(1)
}

function fail(message) {
  console.error(`self-test-sending-engine-status-runtime: FAIL - ${message}`)
  process.exit(1)
}

const url = `${BASE_URL}/api/send-worker/live-gates`
const response = await fetch(url, {
  headers: {
    Accept: 'application/json',
    'X-Customer-Id': CUSTOMER_ID,
  },
})

if (!response.ok) {
  const body = await response.text()
  fail(`HTTP ${response.status} ${body.slice(0, 400)}`)
}

let json
try {
  json = await response.json()
} catch {
  fail('response is not valid JSON')
}

const data = json?.data
if (!json?.success || !data) fail('invalid live-gates envelope')

if (typeof data?.flags?.enableScheduledSendingEngine !== 'boolean') {
  fail('missing flags.enableScheduledSendingEngine boolean')
}
if (typeof data?.flags?.enableSendQueueSending !== 'boolean') {
  fail('missing flags.enableSendQueueSending boolean')
}
if (typeof data?.flags?.enableLiveSending !== 'boolean') {
  fail('missing flags.enableLiveSending boolean')
}
if (typeof data?.caps?.scheduledEngineCron !== 'string' || !data.caps.scheduledEngineCron.trim()) {
  fail('missing caps.scheduledEngineCron')
}

const queueLiveAndCanary =
  data.flags.enableSendQueueSending &&
  data.flags.enableLiveSending &&
  typeof data.canaryCustomerId === 'string' &&
  data.canaryCustomerId.trim().length > 0

if (!queueLiveAndCanary && data.enabled !== false) {
  fail('expected enabled=false while live/canary gates are incomplete')
}

console.log(
  `PASS live-gates scheduledFlag=${data.flags.enableScheduledSendingEngine} cron=${data.caps.scheduledEngineCron} enabled=${data.enabled}`
)
console.log('self-test-sending-engine-status-runtime: PASS')
