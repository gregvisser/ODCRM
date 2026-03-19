import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getMonthBoundaries,
  getPreviousReportingPeriod,
  getWeekBoundaries,
  resolveReportingPeriod,
} from '../src/utils/reportingPeriods.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..', '..')

const reportingRouteSource = readFileSync(path.join(repoRoot, 'server', 'src', 'routes', 'reporting.ts'), 'utf8')
const dashboardSource = readFileSync(path.join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'ReportingDashboard.tsx'), 'utf8')
const reportsTabSource = readFileSync(path.join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'ReportsTab.tsx'), 'utf8')
const marketingHomeSource = readFileSync(path.join(repoRoot, 'src', 'tabs', 'marketing', 'MarketingHomePage.tsx'), 'utf8')
const navSource = readFileSync(path.join(repoRoot, 'src', 'contracts', 'nav.ts'), 'utf8')

function testWeekModeResolvesMondaySunday(): void {
  const period = resolveReportingPeriod({
    periodType: 'week',
    weekStart: '2026-03-18',
  } as never)
  assert.equal(period.periodType, 'week')
  assert.equal(period.start.toISOString(), '2026-03-16T00:00:00.000Z')
  assert.equal(period.end.toISOString(), '2026-03-22T23:59:59.999Z')

  const direct = getWeekBoundaries('2026-03-18')
  assert.ok(direct)
  assert.equal(direct?.start.toISOString(), '2026-03-16T00:00:00.000Z')
  assert.equal(direct?.end.toISOString(), '2026-03-22T23:59:59.999Z')
}

function testMonthModeResolvesCalendarMonth(): void {
  const period = resolveReportingPeriod({
    periodType: 'month',
    month: '2026-02',
  } as never)
  assert.equal(period.periodType, 'month')
  assert.equal(period.start.toISOString(), '2026-02-01T00:00:00.000Z')
  assert.equal(period.end.toISOString(), '2026-02-28T23:59:59.999Z')

  const direct = getMonthBoundaries('2026-02')
  assert.ok(direct)
  assert.equal(direct?.start.toISOString(), '2026-02-01T00:00:00.000Z')
  assert.equal(direct?.end.toISOString(), '2026-02-28T23:59:59.999Z')
}

function testPreviousPeriodAlignment(): void {
  const week = resolveReportingPeriod({ periodType: 'week', weekStart: '2026-03-18' } as never)
  const previousWeek = getPreviousReportingPeriod(week)
  assert.equal(previousWeek.start.toISOString(), '2026-03-09T00:00:00.000Z')
  assert.equal(previousWeek.end.toISOString(), '2026-03-15T23:59:59.999Z')

  const month = resolveReportingPeriod({ periodType: 'month', month: '2026-03' } as never)
  const previousMonth = getPreviousReportingPeriod(month)
  assert.equal(previousMonth.start.toISOString(), '2026-02-01T00:00:00.000Z')
  assert.equal(previousMonth.end.toISOString(), '2026-02-28T23:59:59.999Z')
}

function testSummaryUsesBoundedRanges(): void {
  assert.match(reportingRouteSource, /const period = resolveReportingPeriod\(req\.query\)/)
  assert.match(reportingRouteSource, /const periodRange = getDateRangeFilter\(period\)/)
  assert.match(reportingRouteSource, /getLeadCreatedWithinPeriodWhere\(period\)/)
  assert.match(reportingRouteSource, /occurredAt: periodRange/)
  assert.match(reportingRouteSource, /createdAt: periodRange/)
}

function testLeadsVsTargetUsesSelectedPeriod(): void {
  assert.match(reportingRouteSource, /const currentPeriod = resolveReportingPeriod\(req\.query\)/)
  assert.match(reportingRouteSource, /const previousPeriod = getPreviousReportingPeriod\(currentPeriod\)/)
  assert.match(reportingRouteSource, /getLeadCreatedWithinPeriodWhere\(currentPeriod\)/)
  assert.match(reportingRouteSource, /getLeadCreatedWithinPeriodWhere\(previousPeriod\)/)
  assert.match(reportingRouteSource, /sumLeadTargets\(customers, currentPeriod\)/)
}

function testTrendsUsesBoundedRanges(): void {
  assert.match(reportingRouteSource, /getLeadCreatedWithinPeriodWhere\(period\)/)
  assert.match(reportingRouteSource, /occurredAt: getDateRangeFilter\(period\), type: \{ in: \['sent', 'replied'\] \}/)
}

function testAllClientsCalendarModesRemainSupported(): void {
  assert.match(dashboardSource, /params\.append\('periodType', 'week'\)/)
  assert.match(dashboardSource, /params\.append\('periodType', 'month'\)/)
  assert.match(dashboardSource, /params\.append\('scope', 'all'\)/)
  assert.match(reportingRouteSource, /scope=all cannot be combined with a specific customerId or X-Customer-Id/)
}

function testDashboardLabelsMatchSelectedPeriod(): void {
  assert.match(dashboardSource, /const periodBadgeLabel = useMemo/)
  assert.match(dashboardSource, /Week: \$\{formatPeriodRangeLabel/)
  assert.match(dashboardSource, /Month: \$\{formatMonthLabel/)
  assert.ok(!dashboardSource.includes('Window: last {windowDays} days'))
  assert.match(dashboardSource, /setWeekStart\(normalizeWeekStartValue\(e\.target\.value\)\)/)
}

function testMarketingReportsRemainsSeparate(): void {
  assert.ok(!reportsTabSource.includes('ReportingDashboard'))
  assert.match(marketingHomeSource, /id: 'reports'/)
  assert.match(marketingHomeSource, /content: <ReportsTab \/>/)
}

function testMarketingReportsDoesNotDoubleUnwrapApiPayload(): void {
  // api.get uses unwrapResponsePayload: server { success, data: T } becomes response.data === T
  assert.ok(!reportsTabSource.includes('outreachRes.data?.data'))
  assert.ok(!reportsTabSource.includes('runHistoryRes.data?.data'))
  assert.match(reportsTabSource, /setOutreachData\(outreachRes\.data/)
}

function testDashboardRemainsFirstTopLevelTab(): void {
  const reportingIndex = navSource.indexOf("{ id: 'reporting-home'")
  const customersIndex = navSource.indexOf("{ id: 'customers-home'")
  assert.ok(reportingIndex >= 0, 'Dashboard tab missing from nav contract')
  assert.ok(customersIndex >= 0, 'Customers tab missing from nav contract')
  assert.ok(reportingIndex < customersIndex, 'Dashboard tab must remain first in the top-level nav')
}

const tests: Array<{ name: string; fn: () => void }> = [
  { name: 'week mode resolves Monday-Sunday boundaries', fn: testWeekModeResolvesMondaySunday },
  { name: 'month mode resolves true month boundaries', fn: testMonthModeResolvesCalendarMonth },
  { name: 'previous period alignment stays correct', fn: testPreviousPeriodAlignment },
  { name: 'summary respects bounded week/month ranges', fn: testSummaryUsesBoundedRanges },
  { name: 'leads-vs-target respects selected calendar period', fn: testLeadsVsTargetUsesSelectedPeriod },
  { name: 'trends respects bounded week/month ranges', fn: testTrendsUsesBoundedRanges },
  { name: 'All Clients works with calendar period modes', fn: testAllClientsCalendarModesRemainSupported },
  { name: 'dashboard labels match selected period', fn: testDashboardLabelsMatchSelectedPeriod },
  { name: 'Marketing > Reports remains separate', fn: testMarketingReportsRemainsSeparate },
  { name: 'Marketing > Reports uses single api.get unwrap level', fn: testMarketingReportsDoesNotDoubleUnwrapApiPayload },
  { name: 'Dashboard remains first top-level tab', fn: testDashboardRemainsFirstTopLevelTab },
]

for (const test of tests) {
  test.fn()
  console.log(`PASS ${test.name}`)
}

console.log('dashboard-scope-and-period.test.ts: PASS')
