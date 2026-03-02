#!/usr/bin/env node
/**
 * Stage 2B/2C: Ops script — pull /api/send-queue/metrics for multiple customers and print a report.
 * Admin-only. Do NOT use admin secret in browser/frontend.
 * Uses https.request (not fetch) for clean exit on Windows/Node 24.
 *
 * Env:
 *   ODCRM_METRICS_API_BASE (default: prod API URL)
 *   ODCRM_ADMIN_SECRET (required)
 *   ODCRM_CUSTOMER_IDS (comma-separated) OR ODCRM_CUSTOMER_IDS_FILE (path to file: newline/comma/whitespace, # comments)
 *   ODCRM_OUTPUT (optional: "json" | "pretty", default "pretty")
 *   ODCRM_OUTPUT_FILE (optional: write JSON to this path when set; stdout gets summary or pretty table)
 *   ODCRM_SORT (optional: dueNow | queued | failed | stuckLocked | lastSentAt)
 *   ODCRM_FAIL_ON (optional: comma-separated rules; token "failed" => failed>0, or "queued>=10", "dueNow>5" — exit 2 if any rule triggers). Stage 2E.
 */
import https from 'node:https'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/** Allowed metric names (lowercase) -> totals key */
const METRIC_TO_TOTALS = {
  failed: 'FAILED',
  stucklocked: 'stuckLocked',
  duenow: 'dueNow',
  queued: 'QUEUED',
  sent: 'SENT',
  locked: 'LOCKED',
  skipped: 'SKIPPED',
}

/**
 * Parse ODCRM_FAIL_ON string into rules. Token only => >0; else metric op value.
 * @param {string} raw
 * @returns {{ metric: string, op: string, value: number }[]}
 */
export function parseFailOnRules(raw) {
  if (!raw || !raw.trim()) return []
  const rules = []
  const tokens = raw.split(',').map((s) => s.trim()).filter(Boolean)
  for (const token of tokens) {
    const m = token.match(/^([a-zA-Z]+)(>=|<=|=|>|<)(\d+)$/)
    if (m) {
      const metric = m[1].toLowerCase()
      if (METRIC_TO_TOTALS[metric] !== undefined) {
        rules.push({ metric, op: m[2], value: parseInt(m[3], 10) })
      }
    } else if (/^[a-zA-Z]+$/.test(token)) {
      const metric = token.toLowerCase()
      if (METRIC_TO_TOTALS[metric] !== undefined) {
        rules.push({ metric, op: '>', value: 0 })
      }
    }
  }
  return rules
}

/**
 * Evaluate rules against totals; return list of triggered rule descriptions.
 * @param {{ QUEUED?: number, LOCKED?: number, SENT?: number, FAILED?: number, SKIPPED?: number, dueNow?: number, stuckLocked?: number }} totals
 * @param {{ metric: string, op: string, value: number }[]} rules
 * @returns {string[]}
 */
export function evaluateFailOn(totals, rules) {
  const triggers = []
  for (const rule of rules) {
    const key = METRIC_TO_TOTALS[rule.metric]
    const actual = totals[key] ?? 0
    let hit = false
    switch (rule.op) {
      case '>': hit = actual > rule.value; break
      case '>=': hit = actual >= rule.value; break
      case '<': hit = actual < rule.value; break
      case '<=': hit = actual <= rule.value; break
      case '=': hit = actual === rule.value; break
      default: break
    }
    if (hit) triggers.push(`${rule.metric}${rule.op}${rule.value}`)
  }
  return triggers
}

const BASE = (process.env.ODCRM_METRICS_API_BASE || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const SECRET = process.env.ODCRM_ADMIN_SECRET?.trim()
const CUSTOMER_IDS_FILE = process.env.ODCRM_CUSTOMER_IDS_FILE?.trim()
const CUSTOMER_IDS_RAW = process.env.ODCRM_CUSTOMER_IDS?.trim()
const OUTPUT = (process.env.ODCRM_OUTPUT || 'pretty').toLowerCase()
const OUTPUT_FILE = process.env.ODCRM_OUTPUT_FILE?.trim()
const SORT = process.env.ODCRM_SORT?.trim().toLowerCase()
const FAIL_ON_RAW = process.env.ODCRM_FAIL_ON?.trim()
const REQUEST_TIMEOUT_MS = 20000

function fail(msg, code = 1) {
  console.error('send-queue-metrics-report: FAIL')
  console.error('  ', msg)
  process.exit(code)
}

function loadCustomerIds() {
  if (CUSTOMER_IDS_FILE) {
    try {
      const content = fs.readFileSync(CUSTOMER_IDS_FILE, 'utf8')
      const ids = []
      const lines = content.split(/\r?\n/)
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const parts = trimmed.split(/[\s,]+/)
        for (const p of parts) {
          const id = p.trim()
          if (id) ids.push(id)
        }
      }
      return ids
    } catch (err) {
      fail(`ODCRM_CUSTOMER_IDS_FILE read failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  if (!CUSTOMER_IDS_RAW) fail('ODCRM_CUSTOMER_IDS or ODCRM_CUSTOMER_IDS_FILE is required')
  return CUSTOMER_IDS_RAW.split(',').map((id) => id.trim()).filter(Boolean)
}

/**
 * GET url with headers; returns { status, text }. Uses https.request for clean Windows exit.
 */
function getJson(url, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const opts = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: 'GET',
      headers: headers || {},
    }
    const req = https.request(opts, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })
    req.end()
  })
}

async function fetchMetrics(customerId) {
  const url = `${BASE}/api/send-queue/metrics?customerId=${encodeURIComponent(customerId)}`
  const headers = { 'X-Admin-Secret': SECRET }
  let status
  let text
  try {
    const result = await getJson(url, headers)
    status = result.status
    text = result.text
  } catch (err) {
    console.error('  request error:', err instanceof Error ? err.message : String(err))
    fail(`GET metrics for customerId=${customerId} failed`)
  }
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    // leave data null
  }
  if (status !== 200) {
    const excerpt = (text || '').slice(0, 300)
    console.error(`  status=${status} body=${excerpt}`)
    fail(`GET metrics for customerId=${customerId} returned ${status}`)
  }
  const payload = data?.data ?? data
  if (!payload || payload.customerId !== customerId) {
    fail(`Unexpected response shape for customerId=${customerId}`)
  }
  return payload
}

function sortResults(results, sortKey) {
  if (!sortKey) return
  const key = sortKey.toLowerCase()
  const cmp = (a, b) => {
    let va, vb
    if (key === 'duenow') {
      va = a.dueNow ?? 0
      vb = b.dueNow ?? 0
      return vb - va
    }
    if (key === 'queued') {
      va = (a.countsByStatus && a.countsByStatus.QUEUED) || 0
      vb = (b.countsByStatus && b.countsByStatus.QUEUED) || 0
      return vb - va
    }
    if (key === 'failed') {
      va = (a.countsByStatus && a.countsByStatus.FAILED) || 0
      vb = (b.countsByStatus && b.countsByStatus.FAILED) || 0
      return vb - va
    }
    if (key === 'stucklocked') {
      va = a.stuckLocked ?? 0
      vb = b.stuckLocked ?? 0
      return vb - va
    }
    if (key === 'lastsentat') {
      va = a.lastSentAt ? new Date(a.lastSentAt).getTime() : 0
      vb = b.lastSentAt ? new Date(b.lastSentAt).getTime() : 0
      return va - vb
    }
    return 0
  }
  results.sort(cmp)
}

function checkFailOn(totals) {
  const rules = parseFailOnRules(FAIL_ON_RAW)
  if (rules.length === 0) return
  const triggers = evaluateFailOn(totals, rules)
  if (triggers.length > 0) {
    console.error('send-queue-metrics-report: FAIL_ON triggered:', triggers.join(', '))
    process.exit(2)
  }
}

async function main() {
  const customerIds = loadCustomerIds()
  if (customerIds.length === 0) fail('At least one customer id is required')
  if (!SECRET) fail('ODCRM_ADMIN_SECRET is required')

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

  if (SORT) sortResults(results, SORT)

  checkFailOn(totals)

  const payload = { items: results, totals }

  if (OUTPUT_FILE) {
    const outPath = path.resolve(OUTPUT_FILE)
    fs.writeFileSync(outPath, JSON.stringify(payload), 'utf8')
  }

  if (OUTPUT === 'json') {
    if (!OUTPUT_FILE) console.log(JSON.stringify(payload))
    else console.log(`Wrote JSON to ${OUTPUT_FILE} | items=${results.length} totals.QUEUED=${totals.QUEUED} dueNow=${totals.dueNow} stuckLocked=${totals.stuckLocked}`)
    process.exit(0)
    return
  }

  // pretty: table to stdout
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
  if (OUTPUT_FILE) console.log(`Wrote JSON to ${OUTPUT_FILE}`)
  process.exit(0)
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url
if (isMain) {
  main().catch((err) => {
    console.error('send-queue-metrics-report: FAIL')
    console.error(err)
    process.exit(1)
  })
}
