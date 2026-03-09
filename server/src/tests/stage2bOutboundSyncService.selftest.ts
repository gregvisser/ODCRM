import assert from 'node:assert/strict'
import { syncManualLeadOutbound } from '../services/leadOutboundSync.js'

type FakeLead = {
  id: string
  customerId: string
  sourceUrl: string | null
  sheetGid: string | null
  externalId: string | null
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
  externalRowFingerprint?: string | null
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

const baseLead: FakeLead = {
  id: 'lead_1',
  customerId: 'cust_sheet',
  sourceUrl: 'https://docs.google.com/spreadsheets/d/sheet123/edit#gid=0',
  sheetGid: '0',
  externalId: 'odcrm_manual:cust_sheet:test',
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
  status: 'new',
  notes: null,
  syncStatus: 'pending_outbound',
  syncError: null,
  lastOutboundSyncAt: null,
  normalizedData: {},
  createdAt: new Date('2026-03-09T10:00:00.000Z'),
  externalRowFingerprint: null,
}

const successPrisma = createFakePrisma(baseLead)
const success = await syncManualLeadOutbound({
  prisma: successPrisma,
  customerId: 'cust_sheet',
  leadId: 'lead_1',
  appendFn: async () => ({
    sheetId: 'sheet123',
    gid: '0',
    sheetTitle: 'Leads',
    updatedRange: "'Leads'!A12:N12",
    rowNumber: 12,
  }),
})
assert.equal(success.status, 'synced')
assert.equal(successPrisma.leadRecord.current.syncStatus, 'synced')
assert.equal(successPrisma.leadRecord.current.syncError, null)
assert.ok(successPrisma.leadRecord.current.lastOutboundSyncAt instanceof Date)

const failedPrisma = createFakePrisma(baseLead)
const failed = await syncManualLeadOutbound({
  prisma: failedPrisma,
  customerId: 'cust_sheet',
  leadId: 'lead_1',
  appendFn: async () => {
    throw new Error('append failed')
  },
})
assert.equal(failed.status, 'sync_error')
assert.equal(failedPrisma.leadRecord.current.syncStatus, 'sync_error')
assert.equal(failedPrisma.leadRecord.current.syncError, 'append failed')

const retryPrisma = createFakePrisma({
  ...baseLead,
  syncStatus: 'sync_error',
  syncError: 'append failed',
})
const retried = await syncManualLeadOutbound({
  prisma: retryPrisma,
  customerId: 'cust_sheet',
  leadId: 'lead_1',
  forceRetry: true,
  appendFn: async () => ({
    sheetId: 'sheet123',
    gid: '0',
    sheetTitle: 'Leads',
    updatedRange: "'Leads'!A13:N13",
    rowNumber: 13,
  }),
})
assert.equal(retried.status, 'synced')
assert.equal(retryPrisma.leadRecord.current.syncStatus, 'synced')
assert.equal(retryPrisma.leadRecord.current.syncError, null)

console.log('stage2b outbound sync service self-test passed')
