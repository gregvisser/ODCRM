#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-schedules-tab-runtime: FAIL - ${message}`)
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

const schedulesPayload = await getJson('/api/schedules')
if (!Array.isArray(schedulesPayload)) fail('/api/schedules payload should be an array')

const emailsPayload = await getJson('/api/schedules/emails')
if (!Array.isArray(emailsPayload)) fail('/api/schedules/emails payload should be an array')

if (schedulesPayload[0]) {
  const row = schedulesPayload[0]
  for (const key of ['id', 'name', 'status']) {
    if (typeof row?.[key] !== 'string') fail(`/api/schedules row missing string ${key}`)
  }
}

const repoRoot = process.cwd()
const tabPath = join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'SchedulesTab.tsx')
const homePath = join(repoRoot, 'src', 'tabs', 'marketing', 'MarketingHomePage.tsx')
const tabSource = readFileSync(tabPath, 'utf8')
const homeSource = readFileSync(homePath, 'utf8')

const markers = [
  'schedules-tab-panel',
  'schedules-tab-loading',
  'schedules-tab-refresh-btn',
  'schedules-tab-stats',
  'schedules-tab-last-updated',
  'schedules-tab-empty-state',
  'schedules-tab-list',
  'schedules-tab-upcoming-table',
  '/api/schedules',
  '/api/schedules/emails',
]
for (const marker of markers) {
  if (!tabSource.includes(marker)) fail(`SchedulesTab missing marker: ${marker}`)
}

if (!homeSource.includes('Schedules')) fail('MarketingHomePage missing Schedules nav entry')
if (!homeSource.includes('SchedulesTab')) fail('MarketingHomePage missing SchedulesTab wiring')

console.log(`PASS schedules endpoint reachable count=${schedulesPayload.length}`)
console.log(`PASS scheduled-emails endpoint reachable count=${emailsPayload.length}`)
console.log('PASS schedules tab markers present')
console.log('self-test-schedules-tab-runtime: PASS')
