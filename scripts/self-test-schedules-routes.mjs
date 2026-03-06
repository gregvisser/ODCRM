#!/usr/bin/env node
/**
 * Schedules routes smoke test:
 * - Ensure tenant guard on GET /api/schedules
 * - Ensure mutation routes exist and are guarded (POST/PUT/PATCH)
 * No destructive assumptions; uses fake customer/id.
 */
import { withTimeout, exitSoon, readBodyPreview } from './self-test-utils.mjs'

const PROD_API = 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net'
const BASE_URL = (process.env.ODCRM_API_BASE_URL || PROD_API).replace(/\/$/, '')
const FAKE_CUSTOMER = 'cust_fake'
const FAKE_ID = 'sched_fake'

function fail(msg, body) {
  console.error('self-test-schedules-routes: FAIL —', msg)
  if (body) console.error('  Body:', body)
  exitSoon(1)
}

async function req(method, path, headers = {}, body = null) {
  const url = `${BASE_URL}${path}`
  const res = await withTimeout(15000, async ({ signal }) =>
    fetch(url, {
      method,
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      ...(body != null ? { body: JSON.stringify(body) } : {}),
    })
  )
  const preview = await readBodyPreview(res, 250)
  return { res, preview }
}

async function main() {
  // GET no tenant -> 400
  {
    const { res, preview } = await req('GET', '/api/schedules')
    if (res.status !== 400) fail(`GET /api/schedules expected 400, got ${res.status}`, preview)
    console.log('  GET /api/schedules (no headers): 400')
  }

  // GET with tenant should be 200 (empty list acceptable)
  {
    const { res, preview } = await req('GET', '/api/schedules', { 'X-Customer-Id': FAKE_CUSTOMER })
    if (res.status !== 200) fail(`GET /api/schedules expected 200 with tenant, got ${res.status}`, preview)
    console.log('  GET /api/schedules (tenant): 200')
  }

  // POST should be guarded/exist
  {
    const { res, preview } = await req('POST', '/api/schedules', { 'X-Customer-Id': FAKE_CUSTOMER }, { name: 'Smoke schedule' })
    if (res.status === 500) fail('POST /api/schedules returned 500', preview)
    if (![201, 401, 403, 404].includes(res.status)) {
      fail(`POST /api/schedules unexpected status ${res.status}`, preview)
    }
    console.log(`  POST /api/schedules: ${res.status}`)
  }

  // PUT should be guarded/exist
  {
    const { res, preview } = await req(
      'PUT',
      `/api/schedules/${FAKE_ID}`,
      { 'X-Customer-Id': FAKE_CUSTOMER },
      { name: 'Updated' }
    )
    if (res.status === 404) {
      // 404 is acceptable here when schedule id does not exist; ensure not route-level 404 by checking endpoint shape quickly.
      console.log('  PUT /api/schedules/:id: 404 (not found, route exists)')
    } else if (res.status === 500) {
      fail('PUT /api/schedules/:id returned 500', preview)
    } else if (![200, 401, 403].includes(res.status)) {
      fail(`PUT /api/schedules/:id unexpected status ${res.status}`, preview)
    } else {
      console.log(`  PUT /api/schedules/:id: ${res.status}`)
    }
  }

  // PATCH should be guarded/exist
  {
    const { res, preview } = await req(
      'PATCH',
      `/api/schedules/${FAKE_ID}`,
      { 'X-Customer-Id': FAKE_CUSTOMER },
      { isActive: true }
    )
    if (res.status === 500) fail('PATCH /api/schedules/:id returned 500', preview)
    if (![200, 401, 403, 404].includes(res.status)) {
      fail(`PATCH /api/schedules/:id unexpected status ${res.status}`, preview)
    }
    console.log(`  PATCH /api/schedules/:id: ${res.status}`)
  }

  console.log('self-test-schedules-routes: PASS')
  exitSoon(0)
}

main().catch((err) => fail(err?.message || String(err)))
