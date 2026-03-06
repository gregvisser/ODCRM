#!/usr/bin/env node
/**
 * Static operator smoke for Marketing tab wiring (no network).
 * PASS = core Marketing views and Sequences start-flow wiring exist.
 */
import { existsSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function fail(msg) {
  console.error(`self-test-marketing-tab-operator-smoke: FAIL — ${msg}`)
  process.exit(1)
}

function ok(msg) {
  console.log(`self-test-marketing-tab-operator-smoke: ${msg}`)
}

const sequencesTabPath = join(root, 'src', 'tabs', 'marketing', 'components', 'SequencesTab.tsx')
if (!existsSync(sequencesTabPath)) {
  fail(`missing file: ${sequencesTabPath}`)
}
const sequencesTab = readFileSync(sequencesTabPath, 'utf8')

const sequenceRequired = [
  'View queue',
  'Details are available in the Send Queue drawer (View queue).',
]
for (const required of sequenceRequired) {
  if (!sequencesTab.includes(required)) {
    fail(`SequencesTab missing required string: ${required}`)
  }
}

const hasStartEndpoint = /\/api\/campaigns\/\$\{[^}]+\}\/start/.test(sequencesTab)
const hasTemplatesEndpoint = /\/api\/campaigns\/\$\{[^}]+\}\/templates/.test(sequencesTab)
if (!hasStartEndpoint) fail('SequencesTab missing campaign start endpoint wiring (/api/campaigns/${...}/start)')
if (!hasTemplatesEndpoint) fail('SequencesTab missing campaign templates sync wiring (/api/campaigns/${...}/templates)')

const marketingHomePath = join(root, 'src', 'tabs', 'marketing', 'MarketingHomePage.tsx')
if (!existsSync(marketingHomePath)) {
  fail(`missing file: ${marketingHomePath}`)
}
const marketingHome = readFileSync(marketingHomePath, 'utf8')

const requiredMarketingPanels = [
  'ReportsTab',
  'LeadSourcesTabNew',
  'ComplianceTab',
  'EmailAccountsTab',
  'TemplatesTab',
  'SequencesTab',
  'SchedulesTab',
  'InboxTab',
  "label: 'Reports'",
  "label: 'Lead Sources'",
  "label: 'Suppression List'",
  "label: 'Email Accounts'",
  "label: 'Templates'",
  "label: 'Sequences'",
  "label: 'Schedules'",
  "label: 'Inbox'",
]

for (const required of requiredMarketingPanels) {
  if (!marketingHome.includes(required)) {
    fail(`MarketingHomePage missing required marketing panel wiring: ${required}`)
  }
}

ok('PASS')
process.exit(0)
