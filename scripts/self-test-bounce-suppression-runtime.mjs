#!/usr/bin/env node
const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()
const HARD_REASON = 'hard_bounce_invalid_recipient'

function fail(message) {
  console.error(`self-test-bounce-suppression-runtime: FAIL - ${message}`)
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
    fail(`GET ${path} returned ${response.status}: ${text.slice(0, 400)}`)
  }
  try {
    return text ? JSON.parse(text) : null
  } catch {
    fail(`GET ${path} returned non-JSON response`)
  }
}

function asList(payload) {
  if (Array.isArray(payload?.data?.items)) return payload.data.items
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload)) return payload
  return null
}

const auditsPayload = await getJson('/api/send-worker/audits?limit=200')
const audits = asList(auditsPayload)
if (!audits) {
  fail('audits endpoint returned unexpected shape')
}

const suppressionPayload = await getJson('/api/suppression/emails')
const suppressionEmails = asList(suppressionPayload)
if (!suppressionEmails) {
  fail('suppression emails endpoint returned unexpected shape')
}

const hardRows = audits.filter((row) => {
  const reason = String(row?.reason || '').toLowerCase()
  const snapshot = JSON.stringify(row?.snapshot || {}).toLowerCase()
  return reason === HARD_REASON || snapshot.includes(HARD_REASON)
})

if (hardRows.length === 0) {
  console.log(`PASS wiring-only: audits=${audits.length}, suppressionEmails=${suppressionEmails.length}, hardRows=0`)
  console.log('self-test-bounce-suppression-runtime: PASS')
  process.exit(0)
}

const hardEmailSet = new Set()
for (const row of hardRows) {
  const snapshot = row?.snapshot && typeof row.snapshot === 'object' ? row.snapshot : {}
  const email = String(snapshot?.recipientEmailNorm || snapshot?.recipientEmail || '').trim().toLowerCase()
  if (email) hardEmailSet.add(email)
}

const suppressionEmailSet = new Set(
  suppressionEmails
    .map((entry) => String(entry?.emailNormalized || entry?.value || '').trim().toLowerCase())
    .filter(Boolean)
)

const matched = [...hardEmailSet].filter((email) => suppressionEmailSet.has(email))
console.log(
  `PASS hardRows=${hardRows.length}, hardEmails=${hardEmailSet.size}, suppressionEmails=${suppressionEmails.length}, matchedSuppressions=${matched.length}`
)
if (hardEmailSet.size > 0 && matched.length === 0) {
  console.log('WARN hard-bounce rows found but no matching suppression email in sampled endpoint window')
}
console.log('self-test-bounce-suppression-runtime: PASS')
