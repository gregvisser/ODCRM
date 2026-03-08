#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-post-marketing-hardening-runtime: FAIL - ${message}`)
  process.exit(1)
}

if (!CUSTOMER_ID) fail('CUSTOMER_ID env var is required')

async function getJson(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: 'application/json', 'X-Customer-Id': CUSTOMER_ID },
  })
  const text = await response.text()
  if (!response.ok) fail(`GET ${path} returned ${response.status}: ${text.slice(0, 300)}`)
  try {
    return text ? JSON.parse(text) : null
  } catch {
    fail(`GET ${path} returned non-JSON`)
  }
}

await getJson('/api/send-worker/console?windowHours=24')
await getJson('/api/send-worker/exception-center?sinceHours=24')
await getJson('/api/send-worker/identity-capacity?sinceHours=24')
await getJson('/api/inbox/threads?limit=5&offset=0&unreadOnly=false')
await getJson('/api/inbox/replies')

const repoRoot = process.cwd()
const marketingHomePath = join(repoRoot, 'src', 'tabs', 'marketing', 'MarketingHomePage.tsx')
const readinessPath = join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'ReadinessTab.tsx')
const sequencesPath = join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'SequencesTab.tsx')
const inboxPath = join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'InboxTab.tsx')
const inboxRoutePath = join(repoRoot, 'server', 'src', 'routes', 'inbox.ts')

const homeSource = readFileSync(marketingHomePath, 'utf8')
const readinessSource = readFileSync(readinessPath, 'utf8')
const sequencesSource = readFileSync(sequencesPath, 'utf8')
const inboxSource = readFileSync(inboxPath, 'utf8')
const inboxRouteSource = readFileSync(inboxRoutePath, 'utf8')

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
]
for (const marker of homeMarkers) {
  if (!homeSource.includes(marker)) fail(`Marketing home missing marker: ${marker}`)
}

const readinessMarkers = [
  'readiness-tab-panel',
  'readiness-tab-next-actions',
  'readiness-tab-open-preflight',
  'readiness-tab-open-launch-preview',
  'readiness-tab-open-comparison',
  'readiness-tab-open-run-history',
  'data-focus-target',
]
for (const marker of readinessMarkers) {
  if (!readinessSource.includes(marker)) fail(`ReadinessTab missing marker: ${marker}`)
}

const sequencesMarkers = [
  'sequences-tab-panel',
  'sequence-preflight-panel',
  'launch-preview-panel',
  'preview-vs-outcome-panel',
  'run-history-panel',
  'queue-workbench-panel',
  'exception-center-panel',
  'identity-capacity-panel',
  'sequences-tab-focus-panel',
  "params.get('focusPanel')",
  "params.get('sequenceId')",
  "params.set('view', 'templates')",
]
for (const marker of sequencesMarkers) {
  if (!sequencesSource.includes(marker)) fail(`SequencesTab missing marker: ${marker}`)
}

if (sequencesSource.includes("new CustomEvent('navigate-to-view'")) {
  fail('SequencesTab still contains dead navigate-to-view event path')
}

const inboxMarkers = [
  'inbox-tab-panel',
  'inbox-tab-customer-select',
  'inbox-tab-no-customer',
  'inbox-tab-no-customers',
  'inbox-tab-thread-list',
  'inbox-tab-thread-detail',
  'inbox-tab-reply-composer',
  'inbox-tab-send-reply-btn',
  "'X-Customer-Id': selectedCustomerId",
]
for (const marker of inboxMarkers) {
  if (!inboxSource.includes(marker)) fail(`InboxTab missing marker: ${marker}`)
}

const inboxRouteMarkers = [
  "router.get('/threads'",
  "router.get('/threads/:threadId/messages'",
  "router.post('/refresh'",
  "router.post('/threads/:threadId/reply'",
]
for (const marker of inboxRouteMarkers) {
  if (!inboxRouteSource.includes(marker)) fail(`Inbox route missing marker: ${marker}`)
}

console.log('PASS main operator flow markers present (Readiness -> Sequences panels)')
console.log('PASS inbox receive/respond markers and safe route wiring present')
console.log('PASS cross-tab home markers present')
console.log('self-test-post-marketing-hardening-runtime: PASS')
