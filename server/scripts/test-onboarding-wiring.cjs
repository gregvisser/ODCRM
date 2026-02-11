/**
 * Regression test: Onboarding wiring (customer + primary contact + additional contact).
 *
 * Goals:
 * 1) Create customer via API (POST /api/customers)
 * 2) Save onboarding details (PUT /api/customers/:id/onboarding) including accountData + revenue + lead sheet
 * 3) Ensure primary contact is persisted into CustomerContact table (via onboarding save logic + /contacts upsert)
 * 4) Add an additional contact (POST /api/customers/:id/contacts)
 * 5) Fetch customer detail (GET /api/customers/:id) and assert:
 *    - customer scalar fields persisted
 *    - customerContacts contains primary + additional, linked to customerId
 * 6) Delete a contact (DELETE /api/customers/:customerId/contacts/:contactId) and assert it no longer appears
 * 7) Add a note (stored in accountData.notes) with userId + timestamp
 * 8) Soft-archive customer at end (NO hard deletes)
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
  let managerUser = null

  try {
    // 0) Pick a real user from User Authorization endpoint (single source of truth)
    const usersRes = await httpJson('GET', '/api/users')
    assert(usersRes.status === 200, `Expected 200 from users, got ${usersRes.status}: ${usersRes.text}`)
    assert(Array.isArray(usersRes.json), 'Expected array response from /api/users')

    if (usersRes.json.length === 0) {
      // If the DB has no users yet, create a temporary one via the SAME endpoint used by User Authorization.
      const today = new Date().toISOString().split('T')[0]
      const suffix = String(Date.now()).slice(-8).padStart(8, '0')
      const userId = `ODS${suffix}`
      const email = `test.${suffix}@script.local`
      const createUserRes = await httpJson('POST', '/api/users', {
        userId,
        firstName: 'Test',
        lastName: 'User',
        email,
        username: email,
        phoneNumber: null,
        role: 'Operations',
        department: 'Operations',
        accountStatus: 'Active',
        lastLoginDate: 'Never',
        createdDate: today,
        profilePhoto: null,
      })
      assert(createUserRes.status === 201, `Expected 201 from create user, got ${createUserRes.status}: ${createUserRes.text}`)
      managerUser = createUserRes.json
      console.log('✅ Created temporary user:', managerUser.id)
    } else {
      managerUser = usersRes.json.find((u) => u && u.accountStatus === 'Active') || usersRes.json[0]
    }

    assert(managerUser && managerUser.id, 'Selected manager user missing id')

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
    const managerName = `${managerUser.firstName || ''} ${managerUser.lastName || ''}`.trim() || managerUser.email || 'Manager'

    const onboardingRes = await httpJson('PUT', `/api/customers/${customerId}/onboarding`, {
      customer: {
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
            assignedAccountManagerId: managerUser.id,
            assignedAccountManagerName: managerName,
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
          assignedAccountManager: managerName,
          assignedAccountManagerId: managerUser.id,
          assignedClientDdiNumber: '0207 000 0000',
          emailAccounts: ['am@example.com'],
          emailAccountsSetUp: true,
          days: 3,
        },
        monthlyRevenueFromCustomer: 5000,
        monthlyIntakeGBP: 5000,
        leadsReportingUrl: sheetUrl,
        leadsGoogleSheetLabel: sheetLabel,
      },
      contacts: [],
    })

    assert(onboardingRes.status >= 200 && onboardingRes.status < 300, `Expected 2xx from onboarding save, got ${onboardingRes.status}: ${onboardingRes.text}`)
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
    const additionalContactId = addRes.json?.id
    assert(additionalContactId, 'Add contact response missing id')
    console.log('✅ Added additional CustomerContact:', additionalContactId)

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

    // 5) Delete the additional contact and verify it no longer appears
    const delRes = await httpJson('DELETE', `/api/customers/${customerId}/contacts/${additionalContactId}`)
    assert(delRes.status === 200, `Expected 200 from delete contact, got ${delRes.status}: ${delRes.text}`)

    const getAfterDelete = await httpJson('GET', `/api/customers/${customerId}`)
    assert(getAfterDelete.status === 200, `Expected 200 from get after delete, got ${getAfterDelete.status}: ${getAfterDelete.text}`)
    const contactsAfterDelete = Array.isArray(getAfterDelete.json.customerContacts) ? getAfterDelete.json.customerContacts : []
    assert(!contactsAfterDelete.some((c) => c.id === additionalContactId), 'Deleted contact still present after delete')
    console.log('✅ Contact deletion verified')

    // 6) Add two notes sequentially via append-only endpoint
    const note1Res = await httpJson('POST', `/api/customers/${customerId}/notes`, {
      content: 'Test note 1 from regression script',
      userId: managerUser.id,
      userEmail: managerUser.email,
    })
    assert(note1Res.status === 200, `Expected 200 from add note 1, got ${note1Res.status}: ${note1Res.text}`)

    const note2Res = await httpJson('POST', `/api/customers/${customerId}/notes`, {
      content: 'Test note 2 from regression script',
      userId: managerUser.id,
      userEmail: managerUser.email,
    })
    assert(note2Res.status === 200, `Expected 200 from add note 2, got ${note2Res.status}: ${note2Res.text}`)

    const getAfterNote = await httpJson('GET', `/api/customers/${customerId}`)
    assert(getAfterNote.status === 200, `Expected 200 from get after note, got ${getAfterNote.status}: ${getAfterNote.text}`)
    const notes = getAfterNote.json?.accountData?.notes
    assert(Array.isArray(notes) && notes.length > 0, 'Expected notes array in accountData')
    assert(notes.length >= 2, 'Expected at least 2 notes')
    assert(notes[0].userId === managerUser.id, 'Expected note.userId to match selected user')
    assert(typeof notes[0].timestamp === 'string', 'Expected note.timestamp to be a string')
    console.log('✅ Notes wiring verified')

    // 7) Soft archive customer to keep slate clean (no hard delete)
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

