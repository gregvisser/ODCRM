#!/usr/bin/env node
/**
 * Guardrail for Stage 3E: enrollment queue endpoint requires tenant (no-headers => 400 or 401/403).
 * Prod-by-default; no secrets.
 * Uses exitSoon() to avoid Windows Node v24 UV_HANDLE_CLOSING crash.
 */
import { withTimeout, exitSoon } from './self-test-utils.mjs'

const PROD_API = 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net'
const BASE_URL = (process.env.ODCRM_API_BASE_URL || PROD_API).replace(/\/$/, '')

async function main() {
  const url = `${BASE_URL}/api/enrollments/enr_fake/queue`
  let res
  try {
    res = await withTimeout(15000, async ({ signal }) => fetch(url, { method: 'GET', signal }))
  } catch (err) {
    console.error('self-test-enrollment-queue-stage3e: FAIL', err)
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
    console.log('  GET /api/enrollments/:id/queue (no headers): 400 — tenant required')
    console.log('self-test-enrollment-queue-stage3e: PASS')
    exitSoon(0)
    return
  }
  if (res.status === 401 || res.status === 403) {
    console.log('  GET /api/enrollments/:id/queue (no headers):', res.status, '(auth required)')
    console.log('self-test-enrollment-queue-stage3e: PASS')
    exitSoon(0)
    return
  }
  console.error('self-test-enrollment-queue-stage3e: FAIL — expect 400 or 401/403, got:', res.status)
  console.error('  Body (first 200 chars):', preview)
  exitSoon(1)
}

main()
  .then(() => exitSoon(process.exitCode ?? 0))
  .catch((err) => {
    console.error('self-test-enrollment-queue-stage3e: FAIL', err?.message ?? err)
    exitSoon(1)
  })
