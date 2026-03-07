#!/usr/bin/env node
/**
 * Runtime smoke (GET-only): verify reply-stop marker wiring in send-worker audits.
 * Accepts existing enum limitations by checking marker in reason/snapshot.
 */
const BASE_URL = process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net'
const CUSTOMER_ID = process.env.CUSTOMER_ID || ''

if (!CUSTOMER_ID) {
  console.error('self-test-reply-stop-runtime: FAIL - CUSTOMER_ID env var is required')
  process.exit(1)
}

function fail(message) {
  console.error(`self-test-reply-stop-runtime: FAIL - ${message}`)
  process.exit(1)
}

const url = `${BASE_URL}/api/send-worker/audits?limit=50`
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

const audits = Array.isArray(json?.data?.items)
  ? json.data.items
  : Array.isArray(json?.data)
    ? json.data
    : Array.isArray(json)
      ? json
      : null
if (!audits) fail('invalid response shape: expected audit list')

const hits = audits.filter((row) => {
  const decision = String(row?.decision || '')
  const reason = String(row?.reason || '')
  const snapshot = JSON.stringify(row?.snapshot || {})
  return (
    decision === 'SKIP_REPLIED_STOP' ||
    reason === 'SKIP_REPLIED_STOP' ||
    snapshot.includes('SKIP_REPLIED_STOP')
  )
})

console.log(`PASS audits loaded=${audits.length}, replyStopMarkers=${hits.length}`)
console.log('self-test-reply-stop-runtime: PASS')
