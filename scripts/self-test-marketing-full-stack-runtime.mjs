#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-marketing-full-stack-runtime: FAIL - ${message}`)
  process.exit(1)
}

if (!CUSTOMER_ID) fail('CUSTOMER_ID env var is required')

async function getJsonAllow404(path) {
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

const endpointChecks = [
  '/api/send-worker/console?windowHours=24',
  '/api/reports/outreach?customerId=' + encodeURIComponent(CUSTOMER_ID) + '&sinceDays=30',
  '/api/lead-sources',
  '/api/suppression?customerId=' + encodeURIComponent(CUSTOMER_ID),
  '/api/outlook/identities?customerId=' + encodeURIComponent(CUSTOMER_ID),
  '/api/templates',
  '/api/sequences',
  '/api/schedules',
  '/api/inbox/threads?limit=5&offset=0&unreadOnly=false',
]

for (const path of endpointChecks) {
  const res = await getJsonAllow404(path)
  if (res.status === 404) fail(`${path} returned 404`)
}

const repoRoot = process.cwd()
const homePath = join(repoRoot, 'src', 'tabs', 'marketing', 'MarketingHomePage.tsx')
const readinessPath = join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'ReadinessTab.tsx')
const reportsPath = join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'ReportsTab.tsx')
const leadSourcesPath = join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'LeadSourcesTabNew.tsx')
const suppressionPath = join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'ComplianceTab.tsx')
const emailAccountsPath = join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'EmailAccountsTab.tsx')
const templatesPath = join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'TemplatesTab.tsx')
const sequencesPath = join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'SequencesTab.tsx')
const schedulesPath = join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'SchedulesTab.tsx')
const inboxPath = join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'InboxTab.tsx')

const sources = {
  home: readFileSync(homePath, 'utf8'),
  readiness: readFileSync(readinessPath, 'utf8'),
  reports: readFileSync(reportsPath, 'utf8'),
  leadSources: readFileSync(leadSourcesPath, 'utf8'),
  suppression: readFileSync(suppressionPath, 'utf8'),
  emailAccounts: readFileSync(emailAccountsPath, 'utf8'),
  templates: readFileSync(templatesPath, 'utf8'),
  sequences: readFileSync(sequencesPath, 'utf8'),
  schedules: readFileSync(schedulesPath, 'utf8'),
  inbox: readFileSync(inboxPath, 'utf8'),
}

const homeMarkers = [
  'marketing-home-panel',
  "label: 'Readiness'",
  "label: 'Reports'",
  "label: 'Lead Sources'",
  "label: 'Suppression List'",
  "label: 'Email Accounts'",
  "label: 'Templates'",
  "label: 'Sequences'",
  "label: 'Schedules'",
  "label: 'Inbox'",
  'ReadinessTab',
  'ReportsTab',
  'LeadSourcesTabNew',
  'ComplianceTab',
  'EmailAccountsTab',
  'TemplatesTab',
  'SequencesTab',
  'SchedulesTab',
  'InboxTab',
]
for (const marker of homeMarkers) {
  if (!sources.home.includes(marker)) fail(`MarketingHomePage missing marker: ${marker}`)
}

const tabMarkers = [
  ['ReadinessTab', sources.readiness, 'readiness-tab-panel'],
  ['ReportsTab', sources.reports, 'reports-tab-panel'],
  ['LeadSourcesTabNew', sources.leadSources, 'lead-sources-tab-panel'],
  ['ComplianceTab', sources.suppression, 'suppression-tab-panel'],
  ['EmailAccountsTab', sources.emailAccounts, 'email-accounts-tab-panel'],
  ['TemplatesTab', sources.templates, 'templates-tab-panel'],
  ['SequencesTab', sources.sequences, 'sequences-tab-panel'],
  ['SchedulesTab', sources.schedules, 'schedules-tab-panel'],
  ['InboxTab', sources.inbox, 'inbox-tab-panel'],
]
for (const [name, source, marker] of tabMarkers) {
  if (!source.includes(marker)) fail(`${name} missing marker: ${marker}`)
}

const integratedWorkflowMarkers = [
  ['ReadinessTab', sources.readiness, 'readiness-tab-next-actions'],
  ['ReportsTab', sources.reports, 'reports-tab-recent-attempts'],
  ['SequencesTab', sources.sequences, 'exception-center-panel'],
  ['SequencesTab', sources.sequences, 'preview-vs-outcome-panel'],
  ['SequencesTab', sources.sequences, 'queue-workbench-panel'],
  ['InboxTab', sources.inbox, 'inbox-tab-reply-composer'],
]
for (const [name, source, marker] of integratedWorkflowMarkers) {
  if (!source.includes(marker)) fail(`${name} missing integrated workflow marker: ${marker}`)
}

console.log(`PASS marketing backend surfaces reachable count=${endpointChecks.length}`)
console.log('PASS marketing nav includes all 9 tabs and wiring')
console.log('PASS tab panel markers present across all marketing tabs')
console.log('PASS integrated operator workflow markers present')
console.log('self-test-marketing-full-stack-runtime: PASS')
