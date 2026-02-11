/**
 * Regression test: Onboarding wiring (customer + primary contact + additional contact).
 *
 * Goals:
 * 1) Create customer via API (POST /api/customers)
 * 2) Save onboarding details (PUT /api/customers/:id) including accountData + revenue + lead sheet
 * 3) Ensure primary contact is persisted into CustomerContact table (via onboarding save logic + /contacts upsert)
 * 4) Add an additional contact (POST /api/customers/:id/contacts)
 * 5) Fetch customer detail (GET /api/customers/:id) and assert:
 *    - customer scalar fields persisted
 *    - customerContacts contains primary + additional, linked to customerId
 * 6) Soft-archive customer at end (NO hard deletes)
 *
 * Usage:
 *   node server/scripts/test-onboarding-wiring.cjs
 *
 * Env:
 *   API_BASE_URL (optional) defaults to http://localhost:3001
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function httpJson(method, path, body) {
  const url = `${API_BASE_URL}${path}`
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      // Keep consistent with app behavior; not auth, just tenant/customer context if needed.
      'x-customer-id': 'prod-customer-1',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    // leave json null
  }
  return { status: res.status, json, text }
}

async function run() {
  console.log('🧪 test-onboarding-wiring')
  console.log('API_BASE_URL:', API_BASE_URL)

  let customerId = null

  try {
    // 1) Create customer
    const createName = `TEST Onboarding Wiring ${Date.now()}`
    const createRes = await httpJson('POST', '/api/customers', {
      name: createName,
      domain: 'example.com',
      clientStatus: 'onboarding',
      accountData: {
        createdViaOnboarding: true,
        createdAt: new Date().toISOString(),
      },
    })

    assert(createRes.status === 201, `Expected 201 from create, got ${createRes.status}: ${createRes.text}`)
    assert(createRes.json && createRes.json.id, 'Create response missing id')
    customerId = createRes.json.id
    console.log('✅ Created customer:', customerId)

    // 2) Save onboarding details (incl. primary contact data in accountData)
    const primaryContactId = `contact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const sheetUrl = 'https://docs.google.com/spreadsheets/d/example'
    const sheetLabel = 'Test Lead Sheet'

    const putRes = await httpJson('PUT', `/api/customers/${customerId}`, {
      name: createName,
      accountData: {
        accountDetails: {
          primaryContact: {
            id: primaryContactId,
            firstName: 'Main',
            lastName: 'Contact',
            email: 'main.contact@example.com',
            phone: '0123456789',
            roleLabel: 'Manager',
            status: 'Active',
          },
          headOfficeAddress: '1 Test Street, London',
          assignedAccountManagerId: 'test-user-id',
          assignedAccountManagerName: 'Test Manager',
          assignedClientDdiNumber: '0207 000 0000',
          daysPerWeek: 3,
          emailAccounts: ['am@example.com'],
        },
        // Convenience top-level fields (expected by legacy Account Card)
        contactPersons: 'Main Contact',
        contactEmail: 'main.contact@example.com',
        contactNumber: '0123456789',
        contactRoleLabel: 'Manager',
        contactActive: true,
        headOfficeAddress: '1 Test Street, London',
        assignedAccountManager: 'Test Manager',
        assignedAccountManagerId: 'test-user-id',
        assignedClientDdiNumber: '0207 000 0000',
        emailAccounts: ['am@example.com'],
        emailAccountsSetUp: true,
        days: 3,
      },
      monthlyRevenueFromCustomer: 5000,
      monthlyIntakeGBP: 5000,
      leadsReportingUrl: sheetUrl,
      leadsGoogleSheetLabel: sheetLabel,
    })

    assert(putRes.status >= 200 && putRes.status < 300, `Expected 2xx from update, got ${putRes.status}: ${putRes.text}`)
    console.log('✅ Saved onboarding details')

    // 3) Add an additional customer contact
    const addRes = await httpJson('POST', `/api/customers/${customerId}/contacts`, {
      name: 'Additional Contact',
      email: 'additional@example.com',
      phone: '07123456789',
      title: 'Ops',
      isPrimary: false,
    })
    assert(addRes.status === 201, `Expected 201 from add contact, got ${addRes.status}: ${addRes.text}`)
    console.log('✅ Added additional CustomerContact:', addRes.json?.id)

    // 4) Fetch customer detail and assert
    const getRes = await httpJson('GET', `/api/customers/${customerId}`)
    assert(getRes.status === 200, `Expected 200 from get, got ${getRes.status}: ${getRes.text}`)
    assert(getRes.json && getRes.json.id === customerId, 'GET customer returned wrong id')
    assert(getRes.json.leadsReportingUrl === sheetUrl, 'leadsReportingUrl did not persist')
    assert(getRes.json.leadsGoogleSheetLabel === sheetLabel, 'leadsGoogleSheetLabel did not persist')
    assert(String(getRes.json.monthlyRevenueFromCustomer) === '5000', 'monthlyRevenueFromCustomer did not persist')

    const contacts = Array.isArray(getRes.json.customerContacts) ? getRes.json.customerContacts : []
    assert(contacts.length >= 1, 'Expected at least 1 customerContact')
    assert(contacts.every((c) => c.customerId === customerId), 'One or more customerContacts have wrong customerId')
    assert(contacts.some((c) => c.isPrimary === true), 'Expected a primary customerContact (isPrimary=true)')
    assert(contacts.some((c) => c.name === 'Additional Contact'), 'Expected additional contact to be present')

    console.log('✅ Wiring assertions passed')

    // 5) Soft archive customer to keep slate clean (no hard delete)
    await prisma.customer.update({
      where: { id: customerId },
      data: { isArchived: true, archivedAt: new Date(), archivedByEmail: 'test@script.local' },
    })
    console.log('✅ Soft-archived test customer')

    return { success: true }
  } catch (err) {
    console.error('❌ TEST FAILED:', err.message)
    return { success: false, error: err.message, customerId }
  } finally {
    await prisma.$disconnect()
  }
}

run().then((r) => process.exit(r.success ? 0 : 1))

