#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-lead-sheets-connection-contract-runtime: FAIL - ${message}`)
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
if (leadsRes.status === 502) {
  if (!leadsRes.body?.errorCode) fail('/api/live/leads 502 response missing errorCode classification')
  if (!leadsRes.body?.hint) fail('/api/live/leads 502 response missing actionable hint')
}
if (leadsRes.status === 400 && !leadsRes.body?.error) {
  fail('/api/live/leads 400 response missing error')
}

const diagnosticsRes = await getJson('/api/live/leads?customerId=' + encodeURIComponent(CUSTOMER_ID) + '&diagnosticFallback=1', [200, 400, 502])
if (diagnosticsRes.status === 200 && diagnosticsRes.body?.staleFallbackUsed) {
  if (diagnosticsRes.body?.authoritative !== false) {
    fail('diagnostic stale fallback must not be marked authoritative')
  }
  if (!String(diagnosticsRes.body?.warning || '').toLowerCase().includes('diagnostic fallback')) {
    fail('diagnostic fallback response missing explicit diagnostic warning copy')
  }
}

const repoRoot = process.cwd()
const liveRoute = readFileSync(join(repoRoot, 'server', 'src', 'routes', 'liveLeads.ts'), 'utf8')
const liveSheets = readFileSync(join(repoRoot, 'server', 'src', 'utils', 'liveSheets.ts'), 'utf8')

if (!liveSheets.includes('resolveCsvUrl')) fail('liveSheets utility missing URL normalization helper')
if (!liveRoute.includes('classifySheetError')) fail('liveLeads route missing connection error classification')
if (!liveRoute.includes('SHEET_NOT_FETCHABLE_AS_CSV')) fail('liveLeads route missing actionable sheet-format classification')
if (!liveRoute.includes('Use a normal Google Sheets URL')) fail('liveLeads route missing user guidance for standard sheet URLs')

console.log('PASS lead-sheet connection contract classifies URL/access failures with actionable guidance')
console.log('PASS diagnostic fallback is explicit and never treated as authoritative truth')
console.log('self-test-lead-sheets-connection-contract-runtime: PASS')
