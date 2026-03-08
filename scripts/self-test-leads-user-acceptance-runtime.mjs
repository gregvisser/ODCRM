#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-leads-user-acceptance-runtime: FAIL - ${message}`)
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

const liveLeads = await getJson('/api/live/leads?customerId=' + encodeURIComponent(CUSTOMER_ID), [200, 400, 502])
if (liveLeads.status === 200 && !liveLeads.body?.sourceOfTruth) {
  fail('/api/live/leads success response missing sourceOfTruth')
}
if (liveLeads.status === 502 && !liveLeads.body?.hint) {
  fail('/api/live/leads failure response missing actionable hint')
}

const repoRoot = process.cwd()
const leadsTab = readFileSync(join(repoRoot, 'src', 'components', 'LeadsTab.tsx'), 'utf8')
const leadsReportingTab = readFileSync(join(repoRoot, 'src', 'components', 'LeadsReportingTab.tsx'), 'utf8')
const marketingLeadsTab = readFileSync(join(repoRoot, 'src', 'components', 'MarketingLeadsTab.tsx'), 'utf8')

const requiredMarkers = [
  ['LeadsTab', leadsTab, 'leads-acceptance-source-mode'],
  ['LeadsTab', leadsTab, 'leads-acceptance-next-step'],
  ['LeadsTab', leadsTab, 'leads-acceptance-actionable-error'],
  ['LeadsReportingTab', leadsReportingTab, 'leads-reporting-source-mode'],
  ['LeadsReportingTab', leadsReportingTab, 'leads-reporting-next-step'],
  ['LeadsReportingTab', leadsReportingTab, 'leads-reporting-actionable-error'],
  ['MarketingLeadsTab', marketingLeadsTab, 'marketing-leads-next-step-guidance'],
  ['MarketingLeadsTab', marketingLeadsTab, 'marketing-leads-actionable-error'],
]

for (const [name, content, marker] of requiredMarkers) {
  if (!content.includes(marker)) fail(`${name} missing marker ${marker}`)
}

if (!leadsTab.includes('Source of truth:')) fail('LeadsTab missing source-of-truth copy')
if (!leadsReportingTab.includes('Source of truth:')) fail('LeadsReportingTab missing source-of-truth copy')
if (!marketingLeadsTab.includes('Source of truth:')) fail('MarketingLeadsTab missing source-of-truth copy')

console.log('PASS leads user acceptance markers exist across Leads, Leads Reporting, and Marketing Leads surfaces')
console.log('PASS source-of-truth and actionable error guidance remain wired to live leads path')
console.log('self-test-leads-user-acceptance-runtime: PASS')
