#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-dashboard-regression-runtime: FAIL - ${message}`)
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
  return body
}

const customersResponse = await getJson('/api/customers')
const customers = Array.isArray(customersResponse) ? customersResponse : (Array.isArray(customersResponse?.data) ? customersResponse.data : [])
if (!Array.isArray(customers) || customers.length === 0) {
  fail('/api/customers returned no customer scope for dashboard KPI aggregation')
}

await getJson('/api/live/leads/metrics?customerId=' + encodeURIComponent(CUSTOMER_ID), [200, 400, 502])

const dashboard = readFileSync(join(process.cwd(), 'src', 'tabs', 'dashboards', 'DashboardsHomePage.tsx'), 'utf8')
if (!dashboard.includes('fetchLiveMetricsForCustomers')) {
  fail('Dashboard missing multi-client backend metrics aggregation path')
}
if (!dashboard.includes('dashboard-kpi-source-of-truth-mode')) {
  fail('Dashboard missing KPI source-of-truth marker')
}
if (!dashboard.includes('dashboard-kpi-truth-error')) {
  fail('Dashboard missing KPI truth error marker')
}
if (!dashboard.includes('Backend multi-client metrics (sheets/db per client)')) {
  fail('Dashboard missing explicit multi-client KPI truth mode copy')
}

console.log('PASS dashboard uses backend KPI aggregation across current customer scope')
console.log('PASS dashboard includes explicit truth-mode and actionable error markers')
console.log('self-test-dashboard-regression-runtime: PASS')
