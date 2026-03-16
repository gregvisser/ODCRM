#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function fail(message) {
  console.error(`self-test-reporting-home-runtime: FAIL - ${message}`)
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
  "path: '/reporting'",
]
for (const marker of navMarkers) {
  if (!navSource.includes(marker)) fail(`nav contract missing marker: ${marker}`)
}

const appMarkers = [
  'ReportingHomePage',
  "case 'reporting-home'",
  'setActiveView(getDefaultViewForTab(nextTab.id))',
]
for (const marker of appMarkers) {
  if (!appSource.includes(marker)) fail(`App.tsx missing marker: ${marker}`)
}

const reportingHomeMarkers = [
  'reporting-home-panel',
  'reporting-home-guidance',
  'ReportingDashboard',
]
for (const marker of reportingHomeMarkers) {
  if (!reportingHomeSource.includes(marker)) fail(`ReportingHomePage missing marker: ${marker}`)
}

if (!reportingDashboardSource.includes('reporting-dashboard')) fail('ReportingDashboard missing root marker')
if (!reportingDashboardSource.includes('/api/reporting')) fail('ReportingDashboard missing /api/reporting data source')
if (reportsTabSource.includes('ReportingDashboard')) fail('Marketing ReportsTab must not point to ReportingDashboard')

console.log('PASS top-level reporting nav contract exists')
console.log('PASS App routes reporting-home to ReportingHomePage')
console.log('PASS ReportingHomePage resolves to ReportingDashboard')
console.log('PASS Marketing ReportsTab remains separate')
console.log('self-test-reporting-home-runtime: PASS')
