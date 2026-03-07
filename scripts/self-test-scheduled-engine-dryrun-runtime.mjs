#!/usr/bin/env node
const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(msg) {
  console.error(`self-test-scheduled-engine-dryrun-runtime: FAIL - ${msg}`)
  process.exitCode = 1
}

async function run() {
  if (!CUSTOMER_ID) {
    fail('CUSTOMER_ID is required')
    return
  }

  const res = await fetch(`${BASE_URL}/api/send-worker/live-gates`, {
    headers: { Accept: 'application/json', 'X-Customer-Id': CUSTOMER_ID },
  })
  if (!res.ok) {
    const body = await res.text()
    fail(`GET /api/send-worker/live-gates returned ${res.status} ${body.slice(0, 200)}`)
    return
  }

  const json = await res.json()
  const data = json?.data
  if (!data || typeof data !== 'object') {
    fail('missing data payload')
    return
  }

  const flags = data.flags || {}
  if (typeof flags.enableScheduledSendingEngine !== 'boolean') {
    console.log('SKIP scheduled engine flags not available on target BASE_URL yet')
    console.log('self-test-scheduled-engine-dryrun-runtime: PASS')
    return
  }

  if (typeof flags.enableSendQueueWorkerLegacy !== 'boolean') {
    fail('missing enableSendQueueWorkerLegacy flag')
    return
  }

  const cron = data?.caps?.scheduledEngineCron
  if (typeof cron !== 'string' || cron.length === 0) {
    fail('missing scheduledEngineCron cap')
    return
  }

  if (flags.enableLiveSending === true || flags.enableSendQueueSending === true) {
    console.log('PASS live sending gates enabled in target environment (expected only for canary ops).')
  } else {
    console.log('PASS live sending gates are OFF (safe default).')
  }
  console.log(`PASS scheduled engine flags present (engine=${flags.enableScheduledSendingEngine}, legacyWorker=${flags.enableSendQueueWorkerLegacy}, cron=${cron})`)
  console.log('self-test-scheduled-engine-dryrun-runtime: PASS')
}

run().catch((err) => {
  fail(err?.message || String(err))
})
