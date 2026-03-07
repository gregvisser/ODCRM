#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-marketing-data-health-runtime: FAIL - ${message}`)
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
  if (!response.ok) {
    fail(`GET ${path} returned ${response.status}: ${text.slice(0, 300)}`)
  }
  try {
    return text ? JSON.parse(text) : null
  } catch {
    fail(`GET ${path} returned non-JSON`)
  }
}

async function getJsonAllow404(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Accept: 'application/json',
      'X-Customer-Id': CUSTOMER_ID,
    },
  })
  const text = await response.text()
  if (response.status === 404) {
    return { status: 404, body: text }
  }
  if (!response.ok) {
    fail(`GET ${path} returned ${response.status}: ${text.slice(0, 300)}`)
  }
  try {
    return { status: response.status, body: text ? JSON.parse(text) : null }
  } catch {
    fail(`GET ${path} returned non-JSON`)
  }
}

const leadSourcesPayload = await getJson(`/api/lead-sources?customerId=${encodeURIComponent(CUSTOMER_ID)}`)
if (!Array.isArray(leadSourcesPayload?.sources)) {
  fail('/api/lead-sources payload missing sources[]')
}

const repoRoot = process.cwd()
const compliancePath = join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'ComplianceTab.tsx')
const marketingHomePath = join(repoRoot, 'src', 'tabs', 'marketing', 'MarketingHomePage.tsx')
const suppressionRoutePath = join(repoRoot, 'server', 'src', 'routes', 'suppression.ts')
const complianceSource = readFileSync(compliancePath, 'utf8')
const marketingHomeSource = readFileSync(marketingHomePath, 'utf8')
const suppressionRouteSource = readFileSync(suppressionRoutePath, 'utf8')

const markers = [
  'marketing-data-health-panel',
  'Marketing Data Health',
  '/api/lead-sources',
  '/api/suppression/health',
  'Suppression Sheets',
  'Lead Sources',
]

for (const marker of markers) {
  if (!complianceSource.includes(marker)) {
    fail(`ComplianceTab missing marker: ${marker}`)
  }
}

const suppressionHealthRes = await getJsonAllow404(`/api/suppression/health?customerId=${encodeURIComponent(CUSTOMER_ID)}`)
if (suppressionHealthRes.status === 404) {
  if (!suppressionRouteSource.includes("router.get('/health'")) {
    fail('/api/suppression/health returned 404 and route marker not found in source')
  }
  console.log('PASS suppression health route wiring present in source (prod not yet updated, endpoint returned 404)')
} else {
  const suppressionHealthPayload = suppressionHealthRes.body
  if (!suppressionHealthPayload?.success || !suppressionHealthPayload?.data?.suppressionSheets) {
    fail('/api/suppression/health payload missing suppressionSheets')
  }
  console.log(`PASS suppression health endpoint reachable emailEntries=${suppressionHealthPayload.data.suppressionSheets.email?.totalEntries ?? 0}`)
}

if (!marketingHomeSource.includes('ComplianceTab')) {
  fail('MarketingHomePage is not wiring ComplianceTab')
}
if (!marketingHomeSource.includes('Suppression List')) {
  fail('MarketingHomePage missing Suppression List nav entry')
}

console.log(`PASS lead source health endpoint reachable sources=${leadSourcesPayload.sources.length}`)
console.log('PASS marketing data health UI markers present (panel + endpoint wiring)')
console.log('self-test-marketing-data-health-runtime: PASS')
