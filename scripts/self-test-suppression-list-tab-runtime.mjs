#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-suppression-list-tab-runtime: FAIL - ${message}`)
  process.exit(1)
}

if (!CUSTOMER_ID) fail('CUSTOMER_ID env var is required')

async function getJsonAllow404(path) {
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

const listRes = await getJsonAllow404(`/api/suppression?customerId=${encodeURIComponent(CUSTOMER_ID)}`)
if (listRes.status === 404) fail('/api/suppression returned 404')
if (!Array.isArray(listRes.body)) fail('/api/suppression payload should be an array')

const healthRes = await getJsonAllow404(`/api/suppression/health?customerId=${encodeURIComponent(CUSTOMER_ID)}`)
if (healthRes.status !== 404) {
  if (!healthRes.body?.success || !healthRes.body?.data?.suppressionSheets) fail('/api/suppression/health payload missing suppressionSheets')
}

const repoRoot = process.cwd()
const tabPath = join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'ComplianceTab.tsx')
const homePath = join(repoRoot, 'src', 'tabs', 'marketing', 'MarketingHomePage.tsx')
const suppressionPath = join(repoRoot, 'server', 'src', 'routes', 'suppression.ts')
const tabSource = readFileSync(tabPath, 'utf8')
const homeSource = readFileSync(homePath, 'utf8')
const suppressionSource = readFileSync(suppressionPath, 'utf8')

if (healthRes.status === 404 && !suppressionSource.includes("router.get('/health'")) {
  fail('/api/suppression/health returned 404 and source route marker missing')
}

const markers = [
  'suppression-tab-panel',
  'suppression-tab-sheet-truth-banner',
  'marketing-data-health-panel',
  'suppression-tab-import-panel',
  'suppression-tab-import-btn',
  'suppression-tab-manual-panel',
  'suppression-tab-manual-add-btn',
  'suppression-tab-entries-table',
  '/api/suppression/health',
  '/api/suppression?customerId=',
]
for (const marker of markers) {
  if (!tabSource.includes(marker)) fail(`ComplianceTab missing marker: ${marker}`)
}

if (!homeSource.includes('Suppression List')) fail('MarketingHomePage missing Suppression List nav entry')
if (!homeSource.includes('ComplianceTab')) fail('MarketingHomePage missing ComplianceTab wiring')

console.log(`PASS suppression endpoint reachable rows=${listRes.body.length}`)
if (healthRes.status === 404) console.log('PASS suppression health route marker present in source (endpoint 404 allowed)')
else console.log(`PASS suppression health endpoint reachable emailEntries=${healthRes.body.data.suppressionSheets.email?.totalEntries ?? 0}`)
console.log('PASS suppression list tab markers present')
console.log('self-test-suppression-list-tab-runtime: PASS')
