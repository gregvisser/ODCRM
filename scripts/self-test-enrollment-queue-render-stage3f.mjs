#!/usr/bin/env node
/**
 * Guardrail for Stage 3F: render endpoint requires tenant (no-headers => 400 or 401/403).
 * Prod-by-default; no secrets. Never treat 500 as pass.
 * Uses exitSoon() to avoid Windows Node v24 UV_HANDLE_CLOSING crash.
 */
import { withTimeout, exitSoon, readBodyPreview } from './self-test-utils.mjs'

const PROD_API = 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net'
const BASE_URL = (process.env.ODCRM_API_BASE_URL || PROD_API).replace(/\/$/, '')

async function main() {
  const url = `${BASE_URL}/api/enrollments/enr_fake/steps/0/render`
  let res
  try {
    res = await withTimeout(15000, async ({ signal }) => fetch(url, { method: 'GET', signal }))
  } catch (err) {
    console.error('self-test-enrollment-queue-render-stage3f: FAIL — fetch error:', err?.message ?? err)
    exitSoon(1)
    return
  }

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
    if (!String(msg).toLowerCase().includes('customer') && !String(msg).toLowerCase().includes('x-customer-id') && !String(msg).toLowerCase().includes('cust_')) {
      console.error('self-test-enrollment-queue-render-stage3f: FAIL — 400 body should mention X-Customer-Id or tenant')
      console.error('  Body:', preview)
      exitSoon(1)
      return
    }
    console.log('  GET /api/enrollments/:id/steps/:stepIndex/render (no headers): 400 — tenant required')
    console.log('self-test-enrollment-queue-render-stage3f: PASS')
    exitSoon(0)
    return
  }
  if (res.status === 401 || res.status === 403) {
    console.log('  GET /api/enrollments/:id/steps/:stepIndex/render (no headers):', res.status, '(auth required)')
    console.log('self-test-enrollment-queue-render-stage3f: PASS')
    exitSoon(0)
    return
  }
  console.error('self-test-enrollment-queue-render-stage3f: FAIL — expect 400 or 401/403, got:', res.status)
  console.error('  Body (first 200 chars):', preview)
  exitSoon(1)
}

main()
  .then(() => exitSoon(process.exitCode ?? 0))
  .catch((err) => {
    console.error('self-test-enrollment-queue-render-stage3f: FAIL', err?.message ?? err)
    exitSoon(1)
  })
