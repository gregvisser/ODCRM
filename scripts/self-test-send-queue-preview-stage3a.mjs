#!/usr/bin/env node
/**
 * Self-test: Stage 3A — send-queue preview endpoint (CI guardrail, prod-by-default).
 * Test A: No headers => accept ONLY 400 (body mentions X-Customer-Id) or 401/403. 404/500 => FAIL.
 * Test B: With X-Customer-Id => accept ONLY 200 (validate {data:{items:[]}}), 401/403, or 400 if tenant missing. 404/500 => FAIL.
 * Uses exitSoon() to avoid Windows Node v24 UV_HANDLE_CLOSING crash.
 */
import { withTimeout, exitSoon } from './self-test-utils.mjs'

const PROD_API = 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net'
const BASE_URL = (process.env.ODCRM_API_BASE_URL || PROD_API).replace(/\/$/, '')
const TEST_CUSTOMER_ID = process.env.ODCRM_TEST_CUSTOMER_ID?.trim() || 'cust_preview_test'

function bodyPreview(body, maxLen = 200) {
  if (body == null) return ''
  const s = typeof body === 'object' ? JSON.stringify(body) : String(body)
  return s.length <= maxLen ? s : s.slice(0, maxLen) + '...'
}

async function fetchJsonOrText(url, opts = {}) {
  try {
    const res = await fetch(url, opts)
    const text = await res.text()
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }
    return { status: res.status, data, text }
  } catch (err) {
    return { status: -1, data: null, text: err?.message || String(err) }
  }
}

async function main() {
  const previewUrl = `${BASE_URL}/api/send-queue/preview`
  console.log('  BASE_URL:', BASE_URL)

  // Test A: No headers — ONLY 400 (assert body) or 401/403
  const noHeaders = await withTimeout(15000, async ({ signal }) =>
    fetchJsonOrText(previewUrl, { method: 'GET', signal })
  )
  if (noHeaders.status === 400) {
    const body = noHeaders.data || noHeaders.text || ''
    const msg = typeof body === 'object' ? body?.error || JSON.stringify(body) : body
    if (!String(msg).toLowerCase().includes('customer') && !String(msg).toLowerCase().includes('x-customer-id')) {
      console.error('self-test-send-queue-preview-stage3a: FAIL')
      console.error('  Test A: Expected 400 body to mention X-Customer-Id, got:', bodyPreview(msg))
      exitSoon(1)
      return
    }
    console.log('  Test A (no headers):', noHeaders.status, '— body mentions X-Customer-Id')
  } else if (noHeaders.status === 401 || noHeaders.status === 403) {
    console.log('  Test A (no headers):', noHeaders.status, '(auth required)')
  } else {
    console.error('self-test-send-queue-preview-stage3a: FAIL')
    console.error('  Test A: Accept ONLY 400 or 401/403 without headers. Got:', noHeaders.status)
    console.error('  Body (first 200 chars):', bodyPreview(noHeaders.data ?? noHeaders.text))
    exitSoon(1)
    return
  }

  // Test B: With X-Customer-Id — ONLY 200 (validate shape), 401/403, or 400 if tenant missing
  const withTenant = await withTimeout(15000, async ({ signal }) =>
    fetchJsonOrText(previewUrl, { method: 'GET', headers: { 'X-Customer-Id': TEST_CUSTOMER_ID }, signal })
  )
  if (withTenant.status === 200) {
    const payload = withTenant.data?.data
    const items = payload?.items
    if (!Array.isArray(items)) {
      console.error('self-test-send-queue-preview-stage3a: FAIL')
      console.error('  Test B: Expected 200 to have data.items array, got:', bodyPreview(withTenant.data))
      exitSoon(1)
      return
    }
    const summary = payload?.summary
    if (summary != null) {
      if (typeof summary.totalReturned !== 'number') {
        console.error('self-test-send-queue-preview-stage3a: FAIL')
        console.error('  Test B: summary.totalReturned must be number, got:', typeof summary.totalReturned)
        exitSoon(1)
        return
      }
      const action = summary.countsByAction
      if (!action || typeof action.SEND !== 'number' || typeof action.WAIT !== 'number' || typeof action.SKIP !== 'number') {
        console.error('self-test-send-queue-preview-stage3a: FAIL')
        console.error('  Test B: summary.countsByAction must have SEND/WAIT/SKIP numbers, got:', bodyPreview(action))
        exitSoon(1)
        return
      }
      if (typeof summary.countsByReason !== 'object' || summary.countsByReason === null) {
        console.error('self-test-send-queue-preview-stage3a: FAIL')
        console.error('  Test B: summary.countsByReason must be object, got:', typeof summary.countsByReason)
        exitSoon(1)
        return
      }
      console.log('  Test B (X-Customer-Id):', withTenant.status, '— items.length =', items.length, ', summary present')
    } else {
      console.log('  Test B (X-Customer-Id):', withTenant.status, '— items.length =', items.length, '(no summary, backward compatible)')
    }
    const first = items[0]
    if (first?.reasonDetails != null) {
      if (!Array.isArray(first.reasonDetails) || first.reasonDetails.some((x) => typeof x !== 'string')) {
        console.error('self-test-send-queue-preview-stage3a: FAIL')
        console.error('  Test B: reasonDetails must be array of strings, got:', bodyPreview(first.reasonDetails))
        exitSoon(1)
        return
      }
    }
  } else if (withTenant.status === 401 || withTenant.status === 403) {
    console.log('  Test B (X-Customer-Id):', withTenant.status, '(auth required)')
  } else if (withTenant.status === 400) {
    const msg = typeof withTenant.data === 'object' ? withTenant.data?.error : withTenant.text
    if (!String(msg || '').toLowerCase().includes('customer') && !String(msg || '').toLowerCase().includes('tenant')) {
      console.error('self-test-send-queue-preview-stage3a: FAIL')
      console.error('  Test B: 400 with X-Customer-Id accepted only if body says tenant missing. Got:', bodyPreview(msg))
      exitSoon(1)
      return
    }
    console.log('  Test B (X-Customer-Id):', withTenant.status, '— tenant missing (unexpected with header set)')
  } else {
    console.error('self-test-send-queue-preview-stage3a: FAIL')
    console.error('  Test B: Accept ONLY 200, 401/403, or 400 (tenant missing). Got:', withTenant.status)
    console.error('  Body (first 200 chars):', bodyPreview(withTenant.data ?? withTenant.text))
    exitSoon(1)
    return
  }

  console.log('self-test-send-queue-preview-stage3a: PASS')
  exitSoon(0)
}

main()
  .then(() => exitSoon(process.exitCode ?? 0))
  .catch((err) => {
    console.error('self-test-send-queue-preview-stage3a: FAIL', err?.message ?? err)
    exitSoon(1)
  })
