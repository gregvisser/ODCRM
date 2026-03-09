import assert from 'node:assert/strict'
import { buildOutboundCanonicalRow, runOutboundAppend } from '../services/leadOutboundSync.js'

const lead = {
  id: 'lead_1',
  customerId: 'cust_sheet',
  sourceUrl: 'https://docs.google.com/spreadsheets/d/testSheetId/edit#gid=0',
  sheetGid: '0',
  externalId: 'odcrm_manual:cust_sheet:2026-03-09T10:00:00.000Z:abcd1234',
  occurredAt: new Date('2026-03-09T00:00:00.000Z'),
  source: 'linkedin',
  owner: 'Alex',
  firstName: 'Jane',
  lastName: 'Doe',
  fullName: 'Jane Doe',
  email: 'jane@example.com',
  phone: '+44 111 222',
  company: 'OpenDoors',
  jobTitle: 'CEO',
  location: 'London',
  status: 'new' as const,
  notes: 'hello',
  syncStatus: 'pending_outbound',
  syncError: null,
  lastOutboundSyncAt: null,
  normalizedData: {},
  createdAt: new Date('2026-03-09T10:00:00.000Z'),
}

const row = buildOutboundCanonicalRow(lead)
assert.equal(row.occurredAt, '2026-03-09')
assert.equal(row.fullName, 'Jane Doe')
assert.equal(row.source, 'linkedin')
assert.equal(row.owner, 'Alex')
assert.equal(row.externalId, lead.externalId)

const fixedNow = new Date('2026-03-09T10:05:00.000Z')
const success = await runOutboundAppend({
  lead,
  now: fixedNow,
  appendFn: async () => ({
    sheetId: 'testSheetId',
    gid: '0',
    sheetTitle: 'Leads',
    updatedRange: "'Leads'!A42:N42",
    rowNumber: 42,
  }),
})
assert.equal(success.ok, true)
if (success.ok) {
  assert.equal(success.rowReference, 'gsheet:testSheetId:0:42')
  assert.equal(success.now.toISOString(), fixedNow.toISOString())
}

const failed = await runOutboundAppend({
  lead,
  now: fixedNow,
  appendFn: async () => {
    throw new Error('sheet append failed')
  },
})
assert.equal(failed.ok, false)
if (!failed.ok) {
  assert.equal(failed.error, 'sheet append failed')
}

console.log('stage2b outbound sync self-test passed')
