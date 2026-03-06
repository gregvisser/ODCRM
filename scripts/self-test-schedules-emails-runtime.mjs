#!/usr/bin/env node
/**
 * Runtime smoke: tenant-scoped GET /api/schedules/emails should return 200 and list/envelope-list.
 */

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-schedules-emails-runtime: FAIL - ${message}`)
  process.exit(1)
}

if (!CUSTOMER_ID) {
  fail('CUSTOMER_ID is required. Example (PowerShell): $env:CUSTOMER_ID="cust_xxx"; npm run -s test:schedules-emails-runtime')
}
if (!CUSTOMER_ID.startsWith('cust_')) {
  fail(`CUSTOMER_ID must start with cust_. Received: ${CUSTOMER_ID}`)
}

function normalizeCollection(payload) {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === 'object') {
    if (payload.success === false) return null
    const data = Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload
    if (Array.isArray(data)) return data
    if (data && typeof data === 'object' && Array.isArray(data.items)) return data.items
    if (Array.isArray(payload.items)) return payload.items
  }
  return null
}

async function main() {
  const path = '/api/schedules/emails'
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-Customer-Id': CUSTOMER_ID,
    },
  }).catch((err) => {
    fail(`network error for GET ${path}: ${err?.message || String(err)}`)
  })

  if (!res || !res.ok) {
    const body = res ? await res.text().catch(() => '') : ''
    fail(`GET ${path} returned ${res?.status ?? 'NO_RESPONSE'}. Body: ${body.slice(0, 400)}`)
  }

  let json
  try {
    json = await res.json()
  } catch {
    fail(`GET ${path} returned non-JSON response`)
  }

  const rows = normalizeCollection(json)
  if (!rows) {
    fail(`GET ${path} returned unexpected shape (expected list or list envelope)`)
  }

  console.log(`PASS ${path} returned ${rows.length} row(s)`)
  console.log('self-test-schedules-emails-runtime: PASS')
}

main().catch((err) => fail(err?.message || String(err)))
