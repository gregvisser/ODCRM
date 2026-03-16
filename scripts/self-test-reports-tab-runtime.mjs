#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-reports-tab-runtime: FAIL - ${message}`)
  process.exit(1)
}

if (!CUSTOMER_ID) fail('CUSTOMER_ID env var is required')

async function getJson(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Accept: 'application/json',
      'X-Customer-Id': CUSTOMER_ID,
    },
  })
  const text = await response.text()
  if (response.status === 404) return { status: 404, body: text }
  if (!response.ok) fail(`GET ${path} returned ${response.status}: ${text.slice(0, 300)}`)
  try {
    return { status: response.status, body: text ? JSON.parse(text) : null }
  } catch {
    fail(`GET ${path} returned non-JSON`)
  }
}

const outreachRes = await getJson(`/api/reports/outreach?customerId=${encodeURIComponent(CUSTOMER_ID)}&sinceDays=30`)
if (outreachRes.status === 404) fail('/api/reports/outreach returned 404')
const outreach = outreachRes.body?.data || outreachRes.body
if (!outreach || typeof outreach !== 'object') fail('outreach payload missing object')
if (!Array.isArray(outreach.bySequence)) fail('outreach.bySequence must be array')
if (!Array.isArray(outreach.byIdentity)) fail('outreach.byIdentity must be array')

const runHistoryRes = await getJson('/api/send-worker/run-history?sinceHours=72&limit=20')
if (runHistoryRes.status === 404) fail('/api/send-worker/run-history returned 404')
if (!runHistoryRes.body?.success || !runHistoryRes.body?.data) fail('run-history payload missing success/data')

const identityRes = await getJson('/api/send-worker/identity-capacity?sinceHours=72')
if (identityRes.status === 404) fail('/api/send-worker/identity-capacity returned 404')
if (!identityRes.body?.success || !identityRes.body?.data) fail('identity-capacity payload missing success/data')

const repoRoot = process.cwd()
const reportsTabPath = join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'ReportsTab.tsx')
const marketingHomePath = join(repoRoot, 'src', 'tabs', 'marketing', 'MarketingHomePage.tsx')
const subNavigationPath = join(repoRoot, 'src', 'design-system', 'components', 'SubNavigation.tsx')
const reportsSource = readFileSync(reportsTabPath, 'utf8')
const marketingHomeSource = readFileSync(marketingHomePath, 'utf8')
const subNavigationSource = readFileSync(subNavigationPath, 'utf8')

// Reports tab now renders ReportingDashboard (operator-grade dashboard)
if (!reportsSource.includes('ReportingDashboard')) fail('ReportsTab must render ReportingDashboard')
const dashboardPath = join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'ReportingDashboard.tsx')
const dashboardSource = readFileSync(dashboardPath, 'utf8')
if (!dashboardSource.includes('reporting-dashboard')) fail('ReportingDashboard missing id reporting-dashboard')
if (!dashboardSource.includes('/api/reporting')) fail('ReportingDashboard must use /api/reporting endpoints')

if (!marketingHomeSource.includes("id: 'reports'")) fail('MarketingHomePage missing reports nav item')
if (!marketingHomeSource.includes('ReportsTab')) fail('MarketingHomePage missing ReportsTab wiring')
if (!marketingHomeSource.includes('orderedItems.push(...Array.from(itemsById.values()))')) fail('MarketingHomePage must append missing tabs after saved order')
if (!subNavigationSource.includes('{items.map((item) => (')) fail('SubNavigation must render full items array')
if (!subNavigationSource.includes('<TabPanels')) fail('SubNavigation missing tab panels renderer')
if (!subNavigationSource.includes('debugEnabled')) fail('SubNavigation missing runtime nav diagnostics gate')
if (!marketingHomeSource.includes('debugMarketingNav')) fail('MarketingHomePage missing runtime nav diagnostics gate')

console.log(`PASS outreach rows bySequence=${outreach.bySequence.length} byIdentity=${outreach.byIdentity.length}`)
console.log(`PASS run-history rows=${Array.isArray(runHistoryRes.body.data.rows) ? runHistoryRes.body.data.rows.length : 0}`)
console.log(`PASS identity summary usable=${identityRes.body.data?.summary?.usable ?? 0}`)
console.log('PASS reports tab markers present')
console.log('PASS marketing nav retains reports through ordering and renderer mapping')
console.log('self-test-reports-tab-runtime: PASS')
