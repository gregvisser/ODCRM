/* eslint-disable no-console */
/**
 * Lightweight regression test for onboarding non-destructive saves.
 *
 * Usage:
 * 1) Start backend locally:   cd server && npm run dev
 * 2) Run this script:        node scripts/test-onboarding-non-destructive-save.cjs
 *
 * This script:
 * - Creates a customer
 * - Saves onboarding with a rich nested accountData payload
 * - Saves onboarding again with a partial nested payload (simulates partial frontend payload)
 * - Verifies previously stored fields are preserved (deep-merge + strip-undefined)
 * - Verifies optimistic concurrency (If-Match-Updated-At)
 */

const assert = require('assert')

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001'

async function jsonFetch(path, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }

  return { ok: res.ok, status: res.status, data }
}

async function main() {
  console.log('🧪 Onboarding non-destructive save test')
  console.log('API:', API_BASE)

  const name = `ZZZ TEST onboarding merge ${new Date().toISOString()}`

  // Create customer
  const created = await jsonFetch('/api/customers', {
    method: 'POST',
    body: { name },
  })
  assert(created.ok, `Create customer failed: ${created.status} ${JSON.stringify(created.data)}`)
  const id = created.data?.customer?.id || created.data?.id
  assert(id, 'Expected created customer id')
  console.log('✅ Created customer:', id)

  // Fetch updatedAt
  const firstGet = await jsonFetch(`/api/customers/${id}`)
  assert(firstGet.ok, `GET customer failed: ${firstGet.status} ${JSON.stringify(firstGet.data)}`)
  assert(firstGet.data.updatedAt, 'Expected updatedAt on GET')

  const onboarding1 = {
    customer: {
      name,
      accountData: {
        accountDetails: {
          primaryContact: { id: 'contact_test_1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' },
          daysPerWeek: 3,
        },
        clientProfile: {
          clientHistory: 'Initial history',
          targetJobRoleIds: ['role_a', 'role_b'],
        },
        progressTracker: {
          steps: { company: { complete: true }, contacts: { complete: false } },
        },
        notes: [{ id: 'note1', content: 'Keep me' }],
      },
    },
    contacts: [],
  }

  const put1 = await jsonFetch(`/api/customers/${id}/onboarding`, {
    method: 'PUT',
    headers: { 'If-Match-Updated-At': firstGet.data.updatedAt },
    body: onboarding1,
  })
  assert(put1.ok, `PUT onboarding #1 failed: ${put1.status} ${JSON.stringify(put1.data)}`)
  console.log('✅ PUT onboarding #1 ok')

  const after1 = await jsonFetch(`/api/customers/${id}`)
  assert(after1.ok, `GET after #1 failed: ${after1.status} ${JSON.stringify(after1.data)}`)
  assert(after1.data.updatedAt, 'Expected updatedAt after #1')

  // Partial update: only change a single nested field, omit other branches entirely
  const onboarding2 = {
    customer: {
      name,
      accountData: {
        clientProfile: {
          clientHistory: 'Updated history only',
        },
      },
    },
    contacts: [],
  }

  const put2 = await jsonFetch(`/api/customers/${id}/onboarding`, {
    method: 'PUT',
    headers: { 'If-Match-Updated-At': after1.data.updatedAt },
    body: onboarding2,
  })
  assert(put2.ok, `PUT onboarding #2 failed: ${put2.status} ${JSON.stringify(put2.data)}`)
  console.log('✅ PUT onboarding #2 ok')

  const after2 = await jsonFetch(`/api/customers/${id}`)
  assert(after2.ok, `GET after #2 failed: ${after2.status} ${JSON.stringify(after2.data)}`)

  const ad = after2.data.accountData || {}
  assert.strictEqual(ad?.clientProfile?.clientHistory, 'Updated history only', 'Expected updated history')

  // These must be preserved from onboarding1
  assert.strictEqual(ad?.accountDetails?.primaryContact?.firstName, 'Ada', 'Expected primaryContact preserved')
  assert.deepStrictEqual(ad?.clientProfile?.targetJobRoleIds, ['role_a', 'role_b'], 'Expected array preserved')
  assert.strictEqual(ad?.progressTracker?.steps?.company?.complete, true, 'Expected progressTracker preserved')
  assert.strictEqual(Array.isArray(ad?.notes), true, 'Expected notes preserved')

  // Concurrency check: reuse stale updatedAt should conflict
  const conflict = await jsonFetch(`/api/customers/${id}/onboarding`, {
    method: 'PUT',
    headers: { 'If-Match-Updated-At': firstGet.data.updatedAt },
    body: onboarding2,
  })
  assert.strictEqual(conflict.status, 409, `Expected 409 conflict, got ${conflict.status}`)
  console.log('✅ Conflict check ok (409)')

  console.log('✅ PASS: onboarding saves are non-destructive + concurrency guarded')
}

main().catch((err) => {
  console.error('❌ FAIL:', err)
  process.exitCode = 1
})

