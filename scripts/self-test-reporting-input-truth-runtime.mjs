#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-reporting-input-truth-runtime: FAIL - ${message}`)
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
  if (!response.ok) fail(`GET ${path} returned ${response.status}: ${text.slice(0, 300)}`)
  try {
    return text ? JSON.parse(text) : null
  } catch {
    fail(`GET ${path} returned non-JSON`)
  }
}

await getJson('/api/customers')
await getJson('/api/reports/outreach?customerId=' + encodeURIComponent(CUSTOMER_ID) + '&sinceDays=7')

const repoRoot = process.cwd()
const perfHook = readFileSync(join(repoRoot, 'src', 'tabs', 'customers', 'useCustomerPerformanceData.ts'), 'utf8')
const reportingTab = readFileSync(join(repoRoot, 'src', 'tabs', 'customers', 'CustomersReportingTab.tsx'), 'utf8')
const overviewTab = readFileSync(join(repoRoot, 'src', 'tabs', 'customers', 'CustomersOverviewTab.tsx'), 'utf8')

if (!perfHook.includes('useCustomersFromDatabase')) fail('useCustomerPerformanceData missing useCustomersFromDatabase')
if (perfHook.includes('loadLeadsFromStorage')) fail('useCustomerPerformanceData still depends on localStorage leads')
if (perfHook.includes('calculateActualsFromLeads')) fail('useCustomerPerformanceData still uses legacy local lead calculations')
if (!perfHook.includes('weeklyLeadActual')) fail('useCustomerPerformanceData missing backend weeklyLeadActual usage')
if (!perfHook.includes('monthlyLeadActual')) fail('useCustomerPerformanceData missing backend monthlyLeadActual usage')

if (!reportingTab.includes('customers-reporting-truth-note')) fail('CustomersReportingTab missing reporting truth guidance marker')
if (!reportingTab.includes('backend customer lead metrics')) fail('CustomersReportingTab missing backend truth source wording')
if (!overviewTab.includes('Pulling current account and lead metrics from backend customer truth')) {
  fail('CustomersOverviewTab missing backend-truth loading guidance')
}

console.log('PASS customers reporting hook uses backend customer truth inputs')
console.log('PASS legacy local-storage lead reporting dependency removed from customer reporting hook')
console.log('PASS reporting surfaces include operator guidance for reporting input truth path')
console.log('self-test-reporting-input-truth-runtime: PASS')
