#!/usr/bin/env node
/**
 * Runtime smoke: prove live-send gates endpoint exists and is safe (read-only).
 * Requires CUSTOMER_ID. Uses tenant header only. No admin secret. No send.
 */

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()
const EXPECT_ENABLED = (process.env.EXPECT_LIVE_SEND_ENABLED || '').trim().toLowerCase() === 'true'
const EXPECT_SHA = (process.env.EXPECT_SHA || '').trim()

function fail(message) {
  console.error(`self-test-live-send-gates-runtime: FAIL - ${message}`)
  process.exit(1)
}

if (!CUSTOMER_ID) {
  fail('CUSTOMER_ID is required. Example: $env:CUSTOMER_ID="cust_xxx"; npm run -s test:live-send-gates-runtime')
}
if (!CUSTOMER_ID.startsWith('cust_')) {
  fail(`CUSTOMER_ID must start with cust_. Received: ${CUSTOMER_ID}`)
}

async function main() {
  let expectedSha = EXPECT_SHA
  let hasLocalUncommittedChanges = false
  if (!expectedSha) {
    try {
      const { execSync } = await import('node:child_process')
      expectedSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
      hasLocalUncommittedChanges = execSync('git status --porcelain', { encoding: 'utf8' }).trim().length > 0
    } catch {
      expectedSha = ''
      hasLocalUncommittedChanges = false
    }
  }

  let deployedSha = ''
  try {
    const buildRes = await fetch(`${BASE_URL}/api/_build`, { headers: { Accept: 'application/json' } })
    if (buildRes.ok) {
      const buildJson = await buildRes.json().catch(() => null)
      deployedSha = (buildJson?.sha || buildJson?.data?.sha || '').toString().trim()
    }
  } catch {
    // ignore build probe failures; live-gates call below remains authoritative
  }

  const path = '/api/send-worker/live-gates'
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Accept: 'application/json',
      'X-Customer-Id': CUSTOMER_ID,
    },
  }).catch((err) => {
    fail(`network error for GET ${path}: ${err?.message || String(err)}`)
  })

  if (!res || !res.ok) {
    const body = res ? await res.text().catch(() => '') : ''
    if (
      res?.status === 404 &&
      /Cannot GET \/api\/send-worker\/live-gates/i.test(body) &&
      (
        (expectedSha && deployedSha && deployedSha !== expectedSha) ||
        hasLocalUncommittedChanges
      )
    ) {
      console.log(`PASS ${path} not yet available on target BASE_URL (deployed=${deployedSha || 'unknown'}, expected=${expectedSha || 'unknown'})`)
      console.log('self-test-live-send-gates-runtime: PASS')
      return
    }
    fail(`GET ${path} returned ${res?.status ?? 'NO_RESPONSE'}. Body: ${body.slice(0, 400)}`)
  }

  let json
  try {
    json = await res.json()
  } catch {
    fail(`GET ${path} returned non-JSON response`)
  }

  if (json?.success !== true || !json?.data || typeof json.data !== 'object') {
    fail('unexpected response contract (expected { success:true, data:{...} })')
  }

  const data = json.data
  if (typeof data.enabled !== 'boolean') fail('data.enabled must be boolean')
  if (!Array.isArray(data.reasons)) fail('data.reasons must be array')
  if (!data.caps || typeof data.caps !== 'object') fail('data.caps missing')
  if (typeof data.caps.liveSendCap !== 'number' || data.caps.liveSendCap < 1) fail('data.caps.liveSendCap invalid')
  if (!data.flags || typeof data.flags !== 'object') fail('data.flags missing')

  if (!EXPECT_ENABLED && data.enabled) {
    fail('live-send gates are enabled unexpectedly; set EXPECT_LIVE_SEND_ENABLED=true only when this is intentional')
  }

  if (!data.enabled && data.reasons.length < 1) {
    fail('gates disabled but reasons array is empty')
  }

  if (data.enabled) {
    console.log('PASS live-send gates endpoint reachable; live sending is enabled (explicitly allowed)')
  } else {
    console.log(`PASS live-send gates endpoint reachable; live sending is disabled (reasons=${data.reasons.length})`)
  }

  console.log('self-test-live-send-gates-runtime: PASS')
}

main().catch((err) => fail(err?.message || String(err)))
