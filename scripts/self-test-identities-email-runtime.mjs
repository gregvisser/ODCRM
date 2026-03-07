#!/usr/bin/env node
/**
 * Runtime smoke: ensure identities endpoint returns usable email values.
 * Requires CUSTOMER_ID and uses tenant header.
 */
const BASE_URL = process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net'
const CUSTOMER_ID = process.env.CUSTOMER_ID || ''
const TARGETS = new Set(['canary@bidlow.co.uk', 'greg@bidlow.co.uk'])

if (!CUSTOMER_ID) {
  console.error('self-test-identities-email-runtime: FAIL - CUSTOMER_ID env var is required')
  process.exit(1)
}

function fail(message) {
  console.error(`self-test-identities-email-runtime: FAIL - ${message}`)
  process.exit(1)
}

function extractList(json) {
  if (Array.isArray(json)) return json
  if (json && Array.isArray(json.data)) return json.data
  fail('invalid response shape: expected array or {data:[...]}')
}

const path = `/api/outlook/identities?customerId=${encodeURIComponent(CUSTOMER_ID)}`
const url = `${BASE_URL}${path}`
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

const identities = extractList(json)
if (!identities.length) fail('no identities returned')

const withEmail = identities.filter((identity) => typeof identity?.email === 'string' && identity.email.trim().length > 0)
if (!withEmail.length) fail('no identity with non-empty email field')

console.log(`PASS identities returned=${identities.length}, withEmail=${withEmail.length}`)
for (const identity of withEmail) {
  const normalized = identity.email.trim().toLowerCase()
  if (TARGETS.has(normalized)) {
    console.log(`MATCH ${normalized} => ${identity.id}`)
  }
}
console.log('self-test-identities-email-runtime: PASS')
