#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-customers-leads-view-runtime: FAIL - ${message}`)
  process.exit(1)
}

if (!CUSTOMER_ID) fail('CUSTOMER_ID env var is required')

async function getJson(path, allowed = [200]) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Accept: 'application/json',
      'X-Customer-Id': CUSTOMER_ID,
    },
  })
  const text = await response.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    fail(`GET ${path} returned non-JSON`)
  }
  if (!allowed.includes(response.status)) {
    fail(`GET ${path} returned ${response.status}: ${text.slice(0, 300)}`)
  }
  return { status: response.status, body }
}

const leadsRes = await getJson('/api/live/leads?customerId=' + encodeURIComponent(CUSTOMER_ID), [200, 400, 502])
if (leadsRes.status === 200) {
  if (typeof leadsRes.body?.rowCount !== 'number') fail('/api/live/leads missing rowCount')
  if (leadsRes.body?.sourceOfTruth && !['google_sheets', 'db'].includes(String(leadsRes.body.sourceOfTruth))) {
    fail('/api/live/leads contains invalid sourceOfTruth value')
  }
}
if (leadsRes.status === 502 && !leadsRes.body?.hint) {
  fail('/api/live/leads 502 response missing actionable hint')
}
if (leadsRes.status === 400 && !leadsRes.body?.error) {
  fail('/api/live/leads 400 response missing error')
}

const repoRoot = process.cwd()
const leadsTab = readFileSync(join(repoRoot, 'src', 'components', 'LeadsTab.tsx'), 'utf8')
const leadsReportingTab = readFileSync(join(repoRoot, 'src', 'components', 'LeadsReportingTab.tsx'), 'utf8')
const marketingLeadsTab = readFileSync(join(repoRoot, 'src', 'components', 'MarketingLeadsTab.tsx'), 'utf8')

if (!leadsTab.includes('Source of truth:')) fail('LeadsTab missing source-of-truth marker')
if (!leadsReportingTab.includes('Source of truth:')) fail('LeadsReportingTab missing source-of-truth marker')
if (!marketingLeadsTab.includes('Source of truth:')) fail('MarketingLeadsTab missing source-of-truth marker')
if (!leadsTab.includes('leads-tab-stale-sheet-warning')) fail('LeadsTab missing stale diagnostic warning marker')
if (!leadsReportingTab.includes('leads-reporting-stale-sheet-warning')) fail('LeadsReportingTab missing stale diagnostic warning marker')
if (!marketingLeadsTab.includes('marketing-leads-stale-sheet-warning')) fail('MarketingLeadsTab missing stale diagnostic warning marker')

console.log('PASS customers leads views expose source-of-truth framing and diagnostic-warning markers')
console.log('PASS customers leads API path returns either truth payload or actionable error guidance')
console.log('self-test-customers-leads-view-runtime: PASS')
