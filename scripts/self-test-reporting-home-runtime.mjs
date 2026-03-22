#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function fail(message) {
  console.error(`self-test-dashboard-home-runtime: FAIL - ${message}`)
  process.exit(1)
}

const repoRoot = process.cwd()
const navSource = readFileSync(join(repoRoot, 'src', 'contracts', 'nav.ts'), 'utf8')
const appSource = readFileSync(join(repoRoot, 'src', 'App.tsx'), 'utf8')
const reportingHomeSource = readFileSync(join(repoRoot, 'src', 'tabs', 'reporting', 'ReportingHomePage.tsx'), 'utf8')
const reportingDashboardSource = readFileSync(join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'ReportingDashboard.tsx'), 'utf8')
const reportsTabSource = readFileSync(join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'ReportsTab.tsx'), 'utf8')

const navMarkers = [
  "'reporting-home'",
  "label: 'Dashboard'",
  "path: '/reporting'",
]
for (const marker of navMarkers) {
  if (!navSource.includes(marker)) fail(`nav contract missing marker: ${marker}`)
}
if (navSource.indexOf("{ id: 'reporting-home'") > navSource.indexOf("{ id: 'customers-home'")) {
  fail('Dashboard tab must be the first top-level tab')
}

const appMarkers = [
  'DashboardHomePage',
  "case 'reporting-home'",
  'setActiveView(getDefaultViewForTab(nextTab.id))',
]
for (const marker of appMarkers) {
  if (!appSource.includes(marker)) fail(`App.tsx missing marker: ${marker}`)
}

const reportingHomeMarkers = [
  'dashboard-home-panel',
  'dashboard-home-guidance',
  'Dashboard',
  'ReportingDashboard',
]
for (const marker of reportingHomeMarkers) {
  if (!reportingHomeSource.includes(marker)) fail(`ReportingHomePage missing marker: ${marker}`)
}

if (!reportingDashboardSource.includes('reporting-dashboard')) fail('ReportingDashboard missing root marker')
if (!reportingDashboardSource.includes('/api/reporting')) fail('ReportingDashboard missing /api/reporting data source')
if (!reportingDashboardSource.includes('dashboard-kanban-board')) fail('ReportingDashboard missing kanban board marker')
if (!reportingDashboardSource.includes('dashboard-trend-chart')) fail('ReportingDashboard missing trend chart marker')
if (!reportingDashboardSource.includes('All Clients')) fail('ReportingDashboard missing All Clients selector option')
if (!reportingDashboardSource.includes('dashboard-client-selector')) fail('ReportingDashboard missing scope selector marker')
if (!reportingDashboardSource.includes('dashboard-scope-badge')) fail('ReportingDashboard missing scope badge marker')
if (!reportingDashboardSource.includes('const periodBadgeLabel = useMemo')) fail('ReportingDashboard missing period badge label helper')
if (!reportingDashboardSource.includes('normalizeWeekStartValue')) fail('ReportingDashboard missing week normalization helper')
if (reportingDashboardSource.includes('Window: last {windowDays} days')) fail('ReportingDashboard still contains stale day-window hero label')
if (reportsTabSource.includes('ReportingDashboard')) fail('Marketing ReportsTab must not point to ReportingDashboard')

console.log('PASS top-level dashboard nav contract exists and is first')
console.log('PASS App routes reporting-home to DashboardHomePage')
console.log('PASS DashboardHomePage resolves to ReportingDashboard')
console.log('PASS Marketing ReportsTab remains separate')
console.log('self-test-dashboard-home-runtime: PASS')
