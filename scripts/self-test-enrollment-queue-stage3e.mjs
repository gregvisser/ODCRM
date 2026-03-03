#!/usr/bin/env node
/**
 * Guardrail for Stage 3E: enrollment queue endpoint requires tenant (no-headers => 400 or 401/403).
 * Prod-by-default; no secrets.
 */
const PROD_API = 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net'
const BASE_URL = (process.env.ODCRM_API_BASE_URL || PROD_API).replace(/\/$/, '')

async function main() {
  const url = `${BASE_URL}/api/enrollments/enr_fake/queue`
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
    console.log('  GET /api/enrollments/:id/queue (no headers): 400 — tenant required')
  } else if (res.status === 401 || res.status === 403) {
    console.log('  GET /api/enrollments/:id/queue (no headers):', res.status, '(auth required)')
  } else {
    console.error('self-test-enrollment-queue-stage3e: FAIL — expect 400 or 401/403, got:', res.status)
    console.error('  Body (first 200 chars):', preview)
    process.exit(1)
  }
  console.log('self-test-enrollment-queue-stage3e: PASS')
}

main().catch((err) => {
  console.error('self-test-enrollment-queue-stage3e: FAIL', err)
  process.exit(1)
})
