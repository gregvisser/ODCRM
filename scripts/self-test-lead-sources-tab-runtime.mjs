#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-lead-sources-tab-runtime: FAIL - ${message}`)
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

const listRes = await getJson('/api/lead-sources')
if (listRes.status === 404) fail('/api/lead-sources returned 404')
if (!Array.isArray(listRes.body?.sources)) fail('/api/lead-sources payload missing sources array')

const batchesRes = await getJson('/api/lead-sources/COGNISM/batches?date=2026-03-07')
if (batchesRes.status !== 404 && !Array.isArray(batchesRes.body?.batches)) {
  fail('/api/lead-sources/COGNISM/batches payload missing batches array')
}

const repoRoot = process.cwd()
const tabPath = join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'LeadSourcesTabNew.tsx')
const homePath = join(repoRoot, 'src', 'tabs', 'marketing', 'MarketingHomePage.tsx')
const tabSource = readFileSync(tabPath, 'utf8')
const homeSource = readFileSync(homePath, 'utf8')

const markers = [
  'lead-sources-tab-panel',
  'lead-sources-customer-select',
  'lead-sources-sheet-truth-banner',
  'lead-sources-overview-grid',
  'lead-sources-source-card',
  'lead-sources-view-batches-btn',
  'lead-sources-connect-btn',
  'lead-sources-open-sheet-link',
  'lead-sources-batches-panel',
  'lead-sources-batches-table',
  'lead-sources-batches-filter-input',
  'lead-sources-contacts-panel',
  'lead-sources-contacts-table',
  'lead-sources-contacts-search-input',
  'lead-sources-no-customer-state',
  'getLeadSources',
  'getLeadSourceBatches',
  'getLeadSourceContacts',
  'buildOpenSheetUrl',
]
for (const marker of markers) {
  if (!tabSource.includes(marker)) fail(`LeadSourcesTabNew missing marker: ${marker}`)
}

if (!homeSource.includes("id: 'lists'")) fail('MarketingHomePage missing Lead Sources nav id')
if (!homeSource.includes('LeadSourcesTabNew')) fail('MarketingHomePage missing LeadSourcesTabNew wiring')

console.log(`PASS lead-sources endpoint reachable sources=${listRes.body.sources.length}`)
console.log(`PASS lead-sources batches route checked status=${batchesRes.status}`)
console.log('PASS lead sources tab markers present')
console.log('self-test-lead-sources-tab-runtime: PASS')
