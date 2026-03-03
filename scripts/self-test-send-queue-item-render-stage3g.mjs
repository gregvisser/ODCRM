#!/usr/bin/env node
/**
 * Guardrail for Stage 3G: send-queue item render endpoint requires tenant (no-headers => 400 or 401/403).
 * Prod-by-default; no secrets. Never treat 500 or 200 as pass when no tenant.
 * Deterministic shutdown: defer exit (setTimeout 100ms) to avoid Node/UV flake on Windows.
 */
const PROD_API = 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net'
const BASE_URL = (process.env.ODCRM_API_BASE_URL || PROD_API).replace(/\/$/, '')
const TIMEOUT_MS = 15000

function exitPass() {
  console.log('self-test-send-queue-item-render-stage3g: PASS')
  setTimeout(() => process.exit(0), 100)
}

function exitFail(status, preview) {
  console.error('self-test-send-queue-item-render-stage3g: FAIL — expect 400 or 401/403, got:', status)
  console.error('  Body (first 200 chars):', preview)
  setTimeout(() => process.exit(1), 100)
}

async function main() {
  const url = `${BASE_URL}/api/send-queue/items/sq_fake/render`
  const ac = new AbortController()
  const timeoutId = setTimeout(() => ac.abort(), TIMEOUT_MS)
  let res
  try {
    res = await fetch(url, { method: 'GET', signal: ac.signal })
  } catch (err) {
    clearTimeout(timeoutId)
    console.error('self-test-send-queue-item-render-stage3g: FAIL — fetch error:', err?.message ?? err)
    setTimeout(() => process.exit(1), 100)
    return
  }
  clearTimeout(timeoutId)

  const text = await res.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  const msg = typeof body === 'object' ? body?.error || JSON.stringify(body) : body
  const preview = String(msg).length <= 200 ? String(msg) : String(msg).slice(0, 200) + '...'

  if (res.status === 200) {
    console.error('self-test-send-queue-item-render-stage3g: FAIL — must not succeed without tenant (got 200)')
    console.error('  Body (first 200 chars):', preview)
    setTimeout(() => process.exit(1), 100)
    return
  }
  if (res.status === 400) {
    console.log('  GET /api/send-queue/items/:itemId/render (no headers): 400 — tenant required')
    exitPass()
    return
  }
  if (res.status === 401 || res.status === 403) {
    console.log('  GET /api/send-queue/items/:itemId/render (no headers):', res.status, '(auth required)')
    exitPass()
    return
  }
  exitFail(res.status, preview)
}

main()
  .then(() => { setTimeout(() => process.exit(0), 100) })
  .catch((err) => {
    console.error('self-test-send-queue-item-render-stage3g: FAIL', err?.message ?? err)
    setTimeout(() => process.exit(1), 100)
  })
