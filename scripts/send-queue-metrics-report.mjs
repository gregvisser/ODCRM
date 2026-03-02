#!/usr/bin/env node
/**
 * Stage 2B: Ops script — pull /api/send-queue/metrics for multiple customers and print a report.
 * Admin-only. Do NOT use admin secret in browser/frontend.
 *
 * Env:
 *   ODCRM_METRICS_API_BASE (default: prod API URL)
 *   ODCRM_ADMIN_SECRET (required)
 *   ODCRM_CUSTOMER_IDS (required; comma-separated)
 *   ODCRM_OUTPUT (optional: "json" | "pretty", default "pretty")
 */
const BASE = (process.env.ODCRM_METRICS_API_BASE || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const SECRET = process.env.ODCRM_ADMIN_SECRET?.trim()
const CUSTOMER_IDS_RAW = process.env.ODCRM_CUSTOMER_IDS?.trim()
const OUTPUT = (process.env.ODCRM_OUTPUT || 'pretty').toLowerCase()

function fail(msg) {
  console.error('send-queue-metrics-report: FAIL')
  console.error('  ', msg)
  process.exit(1)
}

if (!SECRET) fail('ODCRM_ADMIN_SECRET is required')
if (!CUSTOMER_IDS_RAW) fail('ODCRM_CUSTOMER_IDS is required (comma-separated)')
const customerIds = CUSTOMER_IDS_RAW.split(',').map((id) => id.trim()).filter(Boolean)
if (customerIds.length === 0) fail('ODCRM_CUSTOMER_IDS must contain at least one customer id')

async function fetchMetrics(customerId) {
  const url = `${BASE}/api/send-queue/metrics?customerId=${encodeURIComponent(customerId)}`
  const res = await fetch(url, { headers: { 'X-Admin-Secret': SECRET } })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    // leave data null
  }
  if (res.status !== 200) {
    const excerpt = (text || res.statusText || '').slice(0, 300)
    console.error(`  status=${res.status} body=${excerpt}`)
    fail(`GET metrics for customerId=${customerId} returned ${res.status}`)
  }
  const payload = data?.data ?? data
  if (!payload || payload.customerId !== customerId) {
    fail(`Unexpected response shape for customerId=${customerId}`)
  }
  return payload
}

async function main() {
  const results = []
  for (const id of customerIds) {
    const data = await fetchMetrics(id)
    results.push(data)
  }

  const totals = {
    QUEUED: 0,
    LOCKED: 0,
    SENT: 0,
    FAILED: 0,
    SKIPPED: 0,
    dueNow: 0,
    stuckLocked: 0,
  }
  for (const d of results) {
    const c = d.countsByStatus || {}
    totals.QUEUED += c.QUEUED || 0
    totals.LOCKED += c.LOCKED || 0
    totals.SENT += c.SENT || 0
    totals.FAILED += c.FAILED || 0
    totals.SKIPPED += c.SKIPPED || 0
    totals.dueNow += d.dueNow ?? 0
    totals.stuckLocked += d.stuckLocked ?? 0
  }

  if (OUTPUT === 'json') {
    console.log(JSON.stringify({ items: results, totals }))
    process.exit(0)
    return
  }

  // pretty: table-like header
  const header = 'customerId | queued | locked | sent | failed | skipped | dueNow | stuckLocked | lastSentAt'
  console.log(header)
  for (const d of results) {
    const c = d.countsByStatus || {}
    const lastSentAt = d.lastSentAt ?? ''
    const row = [
      d.customerId,
      c.QUEUED ?? 0,
      c.LOCKED ?? 0,
      c.SENT ?? 0,
      c.FAILED ?? 0,
      c.SKIPPED ?? 0,
      d.dueNow ?? 0,
      d.stuckLocked ?? 0,
      lastSentAt,
    ].join(' | ')
    console.log(row)
  }
  const totalsLine = `TOTALS | ${totals.QUEUED} | ${totals.LOCKED} | ${totals.SENT} | ${totals.FAILED} | ${totals.SKIPPED} | ${totals.dueNow} | ${totals.stuckLocked} |`
  console.log(totalsLine)
  process.exit(0)
}

main().catch((err) => {
  console.error('send-queue-metrics-report: FAIL')
  console.error(err)
  process.exit(1)
})
