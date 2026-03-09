import assert from 'node:assert/strict'
import { buildManualLeadCreatePayload } from '../services/leadCreateContract.js'

const fixedNow = new Date('2026-03-09T10:00:00.000Z')

const dbBacked = buildManualLeadCreatePayload({
  customerId: 'cust_db',
  accountName: 'DB Client',
  sourceOfTruth: 'db',
  now: fixedNow,
  values: {
    occurredAt: '2026-03-08',
    fullName: 'Jane Doe',
    email: 'JANE@EXAMPLE.COM',
    source: 'linkedin',
    owner: 'Alex',
  },
})

assert.equal(dbBacked.syncStatus, 'synced')
assert.equal(dbBacked.email, 'jane@example.com')
assert.equal(dbBacked.firstName, 'Jane')
assert.equal(dbBacked.lastName, 'Doe')
assert.equal(dbBacked.source, 'linkedin')
assert.equal(dbBacked.owner, 'Alex')
assert.ok(dbBacked.occurredAt instanceof Date)

const sheetBacked = buildManualLeadCreatePayload({
  customerId: 'cust_sheet',
  accountName: 'Sheet Client',
  sourceOfTruth: 'google_sheets',
  now: fixedNow,
  values: {
    company: 'OpenDoors',
    phone: '+44 111 222 333',
    status: 'qualified',
  },
})

assert.equal(sheetBacked.syncStatus, 'pending_outbound')
assert.equal(sheetBacked.leadStatus, 'qualified')
assert.equal(sheetBacked.company, 'OpenDoors')
assert.equal(sheetBacked.phone, '+44 111 222 333')
assert.equal(sheetBacked.normalizedData.sync.status, 'pending_outbound')
assert.ok(String(sheetBacked.externalId).startsWith('odcrm_manual:cust_sheet:'))

console.log('stage2a lead create self-test passed')
