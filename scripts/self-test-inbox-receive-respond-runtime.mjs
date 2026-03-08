#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-inbox-receive-respond-runtime: FAIL - ${message}`)
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

const threadsPayload = await getJson('/api/inbox/threads?limit=10&offset=0&unreadOnly=false')
if (!Array.isArray(threadsPayload?.threads)) fail('/api/inbox/threads payload missing threads[]')

const now = new Date()
const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
const repliesPayload = await getJson(`/api/inbox/replies?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(now.toISOString())}`)
if (!Array.isArray(repliesPayload?.items)) fail('/api/inbox/replies payload missing items[]')

const identitiesPayload = await getJson(`/api/outlook/identities?customerId=${encodeURIComponent(CUSTOMER_ID)}`)
const identities = Array.isArray(identitiesPayload) ? identitiesPayload : identitiesPayload?.data
if (!Array.isArray(identities)) fail('/api/outlook/identities payload should be array or { data: [] }')

const repoRoot = process.cwd()
const inboxTabPath = join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'InboxTab.tsx')
const inboxRoutePath = join(repoRoot, 'server', 'src', 'routes', 'inbox.ts')
const homePath = join(repoRoot, 'src', 'tabs', 'marketing', 'MarketingHomePage.tsx')
const inboxSource = readFileSync(inboxTabPath, 'utf8')
const inboxRouteSource = readFileSync(inboxRoutePath, 'utf8')
const homeSource = readFileSync(homePath, 'utf8')

const markers = [
  'inbox-tab-panel',
  'inbox-tab-loading',
  'inbox-tab-customer-select',
  'inbox-tab-no-customer',
  'inbox-tab-refresh-btn',
  'inbox-tab-last-updated',
  'inbox-tab-threads-view',
  'inbox-tab-thread-list',
  'inbox-tab-thread-detail',
  'inbox-tab-reply-composer',
  'inbox-tab-send-reply-btn',
  'inbox-tab-replies-stats',
  'inbox-tab-search',
  'inbox-tab-replies-empty',
  'inbox-tab-replies-table',
]

for (const marker of markers) {
  if (!inboxSource.includes(marker)) fail(`InboxTab missing marker: ${marker}`)
}

const routeMarkers = [
  "router.get('/threads'",
  "router.get('/threads/:threadId/messages'",
  "router.post('/refresh'",
  "router.post('/threads/:threadId/reply'",
  'requireMarketingMutationAuth',
]
for (const marker of routeMarkers) {
  if (!inboxRouteSource.includes(marker)) fail(`inbox route missing marker: ${marker}`)
}

if (!homeSource.includes('Inbox')) fail('MarketingHomePage missing Inbox nav entry')
if (!homeSource.includes('InboxTab')) fail('MarketingHomePage missing InboxTab wiring')

console.log(`PASS inbox threads reachable count=${threadsPayload.threads.length}`)
console.log(`PASS inbox replies reachable count=${repliesPayload.items.length}`)
console.log(`PASS outlook identities reachable count=${identities.length}`)
console.log('PASS inbox receive/respond markers present')
console.log('self-test-inbox-receive-respond-runtime: PASS')
