#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-templates-tab-runtime: FAIL - ${message}`)
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

async function postJson(path, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Customer-Id': CUSTOMER_ID,
    },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  if (!response.ok) fail(`POST ${path} returned ${response.status}: ${text.slice(0, 300)}`)
  try {
    return text ? JSON.parse(text) : null
  } catch {
    fail(`POST ${path} returned non-JSON`)
  }
}

const templatesPayload = await getJson('/api/templates')
const templates = Array.isArray(templatesPayload) ? templatesPayload : templatesPayload?.data
if (!Array.isArray(templates)) fail('/api/templates payload should be array or { data: [] }')

const previewPayload = await postJson('/api/templates/preview', {
  subject: 'Hi {{firstName}}',
  body: 'Hello {{firstName}}, unsubscribe: {{unsubscribeLink}}',
  variables: {
    firstName: 'Alex',
    unsubscribeLink: 'https://example.com/unsubscribe',
  },
})
const preview = previewPayload?.data ?? previewPayload
if (!preview || typeof preview.subject !== 'string' || typeof preview.body !== 'string') {
  fail('/api/templates/preview payload missing subject/body')
}

const repoRoot = process.cwd()
const tabPath = join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'TemplatesTab.tsx')
const homePath = join(repoRoot, 'src', 'tabs', 'marketing', 'MarketingHomePage.tsx')
const tabSource = readFileSync(tabPath, 'utf8')
const homeSource = readFileSync(homePath, 'utf8')

const markers = [
  'templates-tab-panel',
  'templates-tab-refresh-btn',
  'templates-tab-create-btn',
  'templates-tab-compliance-banner',
  'templates-tab-grid',
  'templates-tab-preview-modal',
  '/api/templates/preview',
]
for (const marker of markers) {
  if (!tabSource.includes(marker)) fail(`TemplatesTab missing marker: ${marker}`)
}

if (!homeSource.includes('Templates')) fail('MarketingHomePage missing Templates nav entry')
if (!homeSource.includes('TemplatesTab')) fail('MarketingHomePage missing TemplatesTab wiring')

console.log(`PASS templates endpoint reachable count=${templates.length}`)
console.log(`PASS templates preview reachable subjectLen=${preview.subject.length} bodyLen=${preview.body.length}`)
console.log('PASS templates tab markers present')
console.log('self-test-templates-tab-runtime: PASS')
