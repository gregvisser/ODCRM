#!/usr/bin/env node
/**
 * Guardrail for Stage 3B UI: preview endpoint must be reachable (no-headers => 400 or 401/403).
 * Prod-by-default; no secrets. Does not validate UI.
 */
const PROD_API = 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net'
const BASE_URL = (process.env.ODCRM_API_BASE_URL || PROD_API).replace(/\/$/, '')

async function main() {
  const url = `${BASE_URL}/api/send-queue/preview`
  const res = await fetch(url, { method: 'GET' })
  const text = await res.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  const msg = typeof body === 'object' ? body?.error || JSON.stringify(body) : body
  const preview = String(msg).length <= 200 ? String(msg) : String(msg).slice(0, 200) + '...'

  if (res.status === 400) {
    if (!String(msg).toLowerCase().includes('customer') && !String(msg).toLowerCase().includes('x-customer-id')) {
      console.error('self-test-send-queue-preview-ui-stage3b: FAIL — 400 body should mention X-Customer-Id')
      console.error('  Body:', preview)
      process.exit(1)
    }
    console.log('  GET /api/send-queue/preview (no headers): 400 — tenant required')
  } else if (res.status === 401 || res.status === 403) {
    console.log('  GET /api/send-queue/preview (no headers):', res.status, '(auth required)')
  } else {
    console.error('self-test-send-queue-preview-ui-stage3b: FAIL — expect 400 or 401/403, got:', res.status)
    console.error('  Body:', preview)
    process.exit(1)
  }
  console.log('self-test-send-queue-preview-ui-stage3b: PASS')
}

main().catch((err) => {
  console.error('self-test-send-queue-preview-ui-stage3b: FAIL', err)
  process.exit(1)
})
