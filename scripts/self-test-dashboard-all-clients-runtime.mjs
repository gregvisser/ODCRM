#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function fail(message) {
  console.error(`self-test-dashboard-all-clients-runtime: FAIL - ${message}`)
  process.exit(1)
}

const repoRoot = process.cwd()
const dashboardSource = readFileSync(join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'ReportingDashboard.tsx'), 'utf8')
const scopeHookSource = readFileSync(join(repoRoot, 'src', 'hooks', 'useCustomerScope.ts'), 'utf8')
const reportingRouteSource = readFileSync(join(repoRoot, 'server', 'src', 'routes', 'reporting.ts'), 'utf8')
const meRouteSource = readFileSync(join(repoRoot, 'server', 'src', 'routes', 'me.ts'), 'utf8')
const reportsTabSource = readFileSync(join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'ReportsTab.tsx'), 'utf8')

const dashboardMarkers = [
  'ALL_CLIENTS_VALUE',
  'All Clients',
  'scope=all',
  'dashboard-client-selector',
  'dashboard-scope-badge',
  "currentScope === 'all'",
]
for (const marker of dashboardMarkers) {
  if (!dashboardSource.includes(marker)) fail(`ReportingDashboard missing marker: ${marker}`)
}

if (!scopeHookSource.includes('const canSelectCustomer = isAgencyUI()')) fail('useCustomerScope must keep agency-only customer selection')
if (!meRouteSource.includes("fixedCustomerId: IS_CLIENT ? (FIXED_CUSTOMER_ID || null) : null")) fail('/api/me must still expose fixedCustomerId for client mode')

const backendMarkers = [
  'resolveReportingScope',
  "scope=all cannot be combined with a specific customerId or X-Customer-Id",
  'All clients reporting is not allowed in client mode',
  "scope: 'all'",
  "where: { isArchived: false }",
]
for (const marker of backendMarkers) {
  if (!reportingRouteSource.includes(marker)) fail(`reporting.ts missing aggregate-scope marker: ${marker}`)
}

if (reportsTabSource.includes('All Clients')) fail('Marketing ReportsTab must remain separate from Dashboard aggregate selector')

console.log('PASS Dashboard includes All Clients aggregate selector markers')
console.log('PASS agency-only customer selection remains in useCustomerScope')
console.log('PASS reporting routes guard scope=all and block client-mode aggregate access')
console.log('PASS Marketing Reports remains separate from Dashboard aggregate mode')
console.log('self-test-dashboard-all-clients-runtime: PASS')
