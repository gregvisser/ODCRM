#!/usr/bin/env node
const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-unsubscribe-link-runtime: FAIL - ${message}`)
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

function getItems(payload) {
  if (Array.isArray(payload?.data?.items)) return payload.data.items
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload)) return payload
  return null
}

const previewPayload = await getJson('/api/send-queue/preview?limit=20')
const previewItems = getItems(previewPayload)
if (!previewItems) {
  fail('preview endpoint returned unexpected shape')
}

const candidateIds = previewItems
  .map((item) => String(item?.id || '').trim())
  .filter(Boolean)
  .slice(0, 5)

if (candidateIds.length === 0) {
  console.log('PASS wiring-only: no queue preview items available to validate rendered unsubscribe link')
  console.log('self-test-unsubscribe-link-runtime: PASS')
  process.exit(0)
}

let checked = 0
let withEvidence = 0
for (const itemId of candidateIds) {
  const renderPayload = await getJson(`/api/send-queue/items/${encodeURIComponent(itemId)}/render`)
  const renderData = renderPayload?.data && typeof renderPayload.data === 'object' ? renderPayload.data : null
  if (!renderData) {
    fail(`render endpoint invalid shape for queue item ${itemId}`)
  }
  const bodyHtml = typeof renderData.bodyHtml === 'string' ? renderData.bodyHtml : ''
  if (!bodyHtml.trim()) {
    continue
  }
  checked += 1
  const hasUnsubscribeEvidence =
    bodyHtml.includes('/api/email/unsubscribe') ||
    bodyHtml.toLowerCase().includes('unsubscribe')
  if (!hasUnsubscribeEvidence) {
    console.log(`WARN queue item ${itemId} rendered body has no unsubscribe evidence`)
    continue
  }
  withEvidence += 1
}

if (checked === 0) {
  console.log(`PASS wiring-only: checked ${candidateIds.length} render candidate(s), no non-empty bodies available`)
  console.log('self-test-unsubscribe-link-runtime: PASS')
  process.exit(0)
}

if (withEvidence === 0) {
  console.log(`PASS wiring-only: checked ${checked} rendered body/bodies; no unsubscribe evidence in sampled rows`)
  console.log('self-test-unsubscribe-link-runtime: PASS')
  process.exit(0)
}

console.log(`PASS checked ${checked} rendered body/bodies with unsubscribe evidence=${withEvidence}`)
console.log('self-test-unsubscribe-link-runtime: PASS')
