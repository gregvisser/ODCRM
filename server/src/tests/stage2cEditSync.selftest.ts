import assert from 'node:assert/strict'
import { retryLeadOutboundSync, syncManualLeadEditOutbound } from '../services/leadOutboundSync.js'

type FakeLead = {
  id: string
  customerId: string
  sourceUrl: string | null
  sheetGid: string | null
  externalId: string | null
  externalRowFingerprint: string | null
  occurredAt: Date | null
  source: string | null
  owner: string | null
  firstName: string | null
  lastName: string | null
  fullName: string | null
  email: string | null
  phone: string | null
  company: string | null
  jobTitle: string | null
  location: string | null
  status: string | null
  notes: string | null
  syncStatus: string | null
  syncError: string | null
  lastOutboundSyncAt: Date | null
  normalizedData: Record<string, unknown>
  createdAt: Date
}

function pick<T extends Record<string, unknown>>(obj: T, select: Record<string, boolean>) {
  const out: Record<string, unknown> = {}
  Object.keys(select).forEach((k) => {
    if (select[k]) out[k] = obj[k]
  })
  return out
}

function createFakePrisma(seed: FakeLead) {
  let lead = { ...seed }
  let syncState: Record<string, unknown> | null = null
  return {
    leadRecord: {
      async findFirst({ where, select }: any) {
        if (where?.id !== lead.id || where?.customerId !== lead.customerId) return null
        return pick(lead as unknown as Record<string, unknown>, select)
      },
      async update({ where, data, select }: any) {
        if (where?.id !== lead.id) throw new Error('lead not found')
        lead = { ...lead, ...data }
        return pick(lead as unknown as Record<string, unknown>, select)
      },
      get current() {
        return lead
      },
    },
    leadSyncState: {
      async upsert({ create, update }: any) {
        syncState = syncState ? { ...syncState, ...update } : { ...create }
        return syncState
      },
      get current() {
        return syncState
      },
    },
  } as any
}

const baseSheetLead: FakeLead = {
  id: 'lead_edit_1',
  customerId: 'cust_sheet',
  sourceUrl: 'https://docs.google.com/spreadsheets/d/sheet123/edit#gid=0',
  sheetGid: '0',
  externalId: 'odcrm_manual:cust_sheet:lead_edit_1',
  externalRowFingerprint: 'gsheet:sheet123:0:22',
  occurredAt: new Date('2026-03-09T00:00:00.000Z'),
  source: 'linkedin',
  owner: 'Alex',
  firstName: 'Jane',
  lastName: 'Doe',
  fullName: 'Jane Doe',
  email: 'jane@example.com',
  phone: '+44 100 200',
  company: 'OpenDoors',
  jobTitle: null,
  location: null,
  status: 'qualified',
  notes: null,
  syncStatus: 'pending_outbound',
  syncError: null,
  lastOutboundSyncAt: null,
  normalizedData: { sync: { pendingOperation: 'update' } },
  createdAt: new Date('2026-03-09T10:00:00.000Z'),
}

let updatedRowNum: number | null = null
const successPrisma = createFakePrisma(baseSheetLead)
const updated = await syncManualLeadEditOutbound({
  prisma: successPrisma,
  customerId: 'cust_sheet',
  leadId: 'lead_edit_1',
  updateFn: async ({ rowNumber }) => {
    updatedRowNum = rowNumber
    return {
      sheetId: 'sheet123',
      gid: '0',
      sheetTitle: 'Leads',
      updatedRange: "'Leads'!A22:N22",
      rowNumber: 22,
    }
  },
})
assert.equal(updated.status, 'synced')
assert.equal(updated.operation, 'update')
assert.equal(updatedRowNum, 22)
assert.equal(successPrisma.leadRecord.current.syncStatus, 'synced')
assert.equal(successPrisma.leadRecord.current.syncError, null)

let attemptedUnsafeUpdate = false
const missingLinkPrisma = createFakePrisma({
  ...baseSheetLead,
  externalRowFingerprint: null,
  normalizedData: { sync: { pendingOperation: 'update' } },
})
const missingLinkResult = await syncManualLeadEditOutbound({
  prisma: missingLinkPrisma,
  customerId: 'cust_sheet',
  leadId: 'lead_edit_1',
  updateFn: async () => {
    attemptedUnsafeUpdate = true
    return {
      sheetId: 'sheet123',
      gid: '0',
      sheetTitle: 'Leads',
      updatedRange: "'Leads'!A22:N22",
      rowNumber: 22,
    }
  },
})
assert.equal(missingLinkResult.status, 'sync_error')
assert.equal(attemptedUnsafeUpdate, false)
assert.match(String(missingLinkResult.error), /requires row linkage/i)

const retryPrisma = createFakePrisma({
  ...baseSheetLead,
  syncStatus: 'sync_error',
  syncError: 'temporary update error',
  normalizedData: { sync: { pendingOperation: 'update' } },
})
const retried = await retryLeadOutboundSync({
  prisma: retryPrisma,
  customerId: 'cust_sheet',
  leadId: 'lead_edit_1',
  updateFn: async () => ({
    sheetId: 'sheet123',
    gid: '0',
    sheetTitle: 'Leads',
    updatedRange: "'Leads'!A22:N22",
    rowNumber: 22,
  }),
})
assert.equal(retried.status, 'synced')
assert.equal(retried.operation, 'update')

console.log('stage2c edit sync self-test passed')
