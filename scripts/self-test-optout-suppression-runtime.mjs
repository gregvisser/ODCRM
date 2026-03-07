#!/usr/bin/env node
const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

if (!CUSTOMER_ID) {
  console.error('self-test-optout-suppression-runtime: FAIL - CUSTOMER_ID is required')
  process.exit(1)
}

function listFrom(payload) {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.data)) return payload.data
    if (payload.data && typeof payload.data === 'object' && Array.isArray(payload.data.items)) return payload.data.items
  }
  return null
}

async function get(path) {
  const res = await fetch(`${BASE_URL}${path}`, { headers: { Accept: 'application/json', 'X-Customer-Id': CUSTOMER_ID } })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GET ${path} => ${res.status} ${body.slice(0, 200)}`)
  }
  return res.json()
}

;(async () => {
  const suppression = await get(`/api/suppression?customerId=${encodeURIComponent(CUSTOMER_ID)}`)
  const suppressionRows = listFrom(suppression)
  if (!suppressionRows) throw new Error('suppression response shape invalid')
  console.log(`PASS suppression list reachable rows=${suppressionRows.length}`)

  const audits = await get('/api/send-worker/audits?decision=SKIP_SUPPRESSED&limit=5')
  const auditRows = listFrom(audits)
  if (!auditRows) throw new Error('suppression audit response shape invalid')
  console.log(`PASS suppression audit view reachable rows=${auditRows.length}`)

  console.log('self-test-optout-suppression-runtime: PASS')
})().catch((err) => {
  console.error(`self-test-optout-suppression-runtime: FAIL - ${err?.message || String(err)}`)
  process.exit(1)
})
