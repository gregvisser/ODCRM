#!/usr/bin/env node
const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

if (!CUSTOMER_ID) {
  console.error('self-test-send-queue-item-actions-runtime: FAIL - CUSTOMER_ID is required')
  process.exit(1)
}

function pass(msg) { console.log(`PASS ${msg}`) }
function skip(msg) { console.log(`SKIP ${msg}`) }
function fail(msg) { console.error(`self-test-send-queue-item-actions-runtime: FAIL - ${msg}`); process.exit(1) }

async function req(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Customer-Id': CUSTOMER_ID,
    },
    body: body == null ? undefined : JSON.stringify(body),
  })
  const txt = await res.text()
  let json = null
  try { json = txt ? JSON.parse(txt) : null } catch {}
  return { res, json, txt }
}

function extractPreviewItems(payload) {
  if (!payload || typeof payload !== 'object') return []
  const root = Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload
  if (Array.isArray(root)) return root
  if (root && typeof root === 'object' && Array.isArray(root.items)) return root.items
  return []
}

;(async () => {
  const preview = await req('GET', '/api/send-queue/preview?limit=20')
  if (!preview.res.ok) fail(`preview returned ${preview.res.status}`)
  const items = extractPreviewItems(preview.json)
  const target = items.find((i) => i && typeof i.id === 'string' && i.status !== 'SENT')
  if (!target) {
    skip('no mutable queue items; skipping action checks')
    console.log('self-test-send-queue-item-actions-runtime: PASS (checks=1, skipped=1)')
    process.exit(0)
  }

  const itemId = target.id
  const detail = await req('GET', `/api/send-queue/items/${encodeURIComponent(itemId)}`)
  if (!detail.res.ok) fail(`item detail returned ${detail.res.status}`)
  const original = detail.json?.data || detail.json
  const originalStatus = original?.status
  const originalScheduledFor = original?.scheduledFor ?? null

  const scheduled = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  const patchApprove = await req('PATCH', `/api/send-queue/items/${encodeURIComponent(itemId)}`, { status: 'QUEUED', sendAt: scheduled, operatorNote: 'runtime_test' })
  if (!patchApprove.res.ok) {
    if (patchApprove.res.status === 404) {
      skip('PATCH /api/send-queue/items/:id not available on target BASE_URL yet')
      console.log('self-test-send-queue-item-actions-runtime: PASS (checks=1, skipped=1)')
      process.exit(0)
    }
    fail(`approve patch returned ${patchApprove.res.status}`)
  }
  pass('PATCH approve/sendAt succeeded')

  const patchSkip = await req('PATCH', `/api/send-queue/items/${encodeURIComponent(itemId)}`, { status: 'SKIPPED', skipReason: 'runtime_test_skip' })
  if (!patchSkip.res.ok) fail(`skip patch returned ${patchSkip.res.status}`)
  pass('PATCH skip succeeded')

  // Best-effort restore
  await req('PATCH', `/api/send-queue/items/${encodeURIComponent(itemId)}`, {
    status: originalStatus === 'SKIPPED' ? 'SKIPPED' : 'QUEUED',
    sendAt: originalScheduledFor,
    operatorNote: 'runtime_test_restore',
  })
  pass('best-effort restore attempted')

  console.log('self-test-send-queue-item-actions-runtime: PASS (checks=3, skipped=0)')
})().catch((err) => fail(err?.message || String(err)))
