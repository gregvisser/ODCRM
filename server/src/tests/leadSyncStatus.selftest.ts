import assert from 'node:assert/strict'
import {
  LEAD_SHEET_AUTO_REFRESH_COOLDOWN_MS,
  SHEET_METRICS_FRESH_MS,
  resolveLeadSyncViewState,
  shouldAutoRefreshLeadSyncState,
} from '../services/leadSyncStatus.js'

const now = Date.now()
const minutesAgo = (minutes: number) => new Date(now - minutes * 60 * 1000).toISOString()

const live = resolveLeadSyncViewState({
  sourceOfTruth: 'google_sheets',
  configuredSheetUrl: 'https://docs.google.com/spreadsheets/d/example/edit#gid=0',
  rowCount: 29,
  sync: {
    mode: 'sheet_backed',
    status: 'success',
    lastSyncAt: minutesAgo(2),
    lastSuccessAt: minutesAgo(2),
    lastInboundSyncAt: minutesAgo(2),
    lastOutboundSyncAt: null,
    lastError: null,
    rowCount: 29,
  },
})
assert.equal(live.code, 'live')
assert.equal(live.canUseLeadData, true)
assert.equal(live.authoritative, true)

const stale = resolveLeadSyncViewState({
  sourceOfTruth: 'google_sheets',
  configuredSheetUrl: 'https://docs.google.com/spreadsheets/d/example/edit#gid=0',
  rowCount: 29,
  sync: {
    mode: 'sheet_backed',
    status: 'success',
    lastSyncAt: minutesAgo(45),
    lastSuccessAt: minutesAgo(45),
    lastInboundSyncAt: minutesAgo(45),
    lastOutboundSyncAt: null,
    lastError: null,
    rowCount: 29,
  },
})
assert.equal(stale.code, 'stale_last_good')
assert.equal(stale.canUseLeadData, true)
assert.equal(stale.authoritative, false)

const failedWithSnapshot = resolveLeadSyncViewState({
  sourceOfTruth: 'google_sheets',
  configuredSheetUrl: 'https://docs.google.com/spreadsheets/d/example/edit#gid=0',
  rowCount: 29,
  sync: {
    mode: 'sheet_backed',
    status: 'error',
    lastSyncAt: minutesAgo(1),
    lastSuccessAt: minutesAgo(20),
    lastInboundSyncAt: minutesAgo(1),
    lastOutboundSyncAt: null,
    lastError: 'HTTP 500 during sheet fetch',
    rowCount: 29,
  },
})
assert.equal(failedWithSnapshot.code, 'sync_failed')
assert.equal(failedWithSnapshot.canUseLeadData, true)

const emptyConnected = resolveLeadSyncViewState({
  sourceOfTruth: 'google_sheets',
  configuredSheetUrl: 'https://docs.google.com/spreadsheets/d/example/edit#gid=0',
  rowCount: 0,
  sync: {
    mode: 'sheet_backed',
    status: 'success',
    lastSyncAt: minutesAgo(5),
    lastSuccessAt: minutesAgo(5),
    lastInboundSyncAt: minutesAgo(5),
    lastOutboundSyncAt: null,
    lastError: null,
    rowCount: 0,
  },
})
assert.equal(emptyConnected.code, 'connected_empty')
assert.equal(emptyConnected.canUseLeadData, true)

const misconfigured = resolveLeadSyncViewState({
  sourceOfTruth: 'google_sheets',
  configuredSheetUrl: 'https://docs.google.com/spreadsheets/d/example/edit#gid=0',
  rowCount: 0,
  sync: {
    mode: 'sheet_backed',
    status: 'error',
    lastSyncAt: minutesAgo(3),
    lastSuccessAt: null,
    lastInboundSyncAt: minutesAgo(3),
    lastOutboundSyncAt: null,
    lastError: 'Sheet is not publicly accessible',
    rowCount: 0,
  },
})
assert.equal(misconfigured.code, 'misconfigured')
assert.equal(misconfigured.canUseLeadData, false)

const bootstrapSyncing = resolveLeadSyncViewState({
  sourceOfTruth: 'google_sheets',
  configuredSheetUrl: 'https://docs.google.com/spreadsheets/d/example/edit#gid=0',
  rowCount: 0,
  sync: {
    mode: 'sheet_backed',
    status: 'syncing',
    lastSyncAt: minutesAgo(0),
    lastSuccessAt: null,
    lastInboundSyncAt: minutesAgo(0),
    lastOutboundSyncAt: null,
    lastError: null,
    rowCount: 0,
  },
  bootstrap: {
    started: true,
    error: null,
  },
})
assert.equal(bootstrapSyncing.code, 'never_synced')
assert.equal(bootstrapSyncing.syncInProgress, true)
assert.equal(bootstrapSyncing.canUseLeadData, false)

const legacyZeroRows = resolveLeadSyncViewState({
  sourceOfTruth: 'google_sheets',
  configuredSheetUrl: 'https://docs.google.com/spreadsheets/d/example/edit#gid=0',
  rowCount: 0,
  sync: {
    mode: 'sheet_backed',
    status: 'error',
    lastSyncAt: minutesAgo(90),
    lastSuccessAt: null,
    lastInboundSyncAt: minutesAgo(90),
    lastOutboundSyncAt: null,
    lastError: 'Sheet returned 0 rows (check publish-to-web CSV and that the sheet has data)',
    rowCount: 0,
  },
})
assert.equal(legacyZeroRows.code, 'connected_empty')
assert.equal(legacyZeroRows.canUseLeadData, true)

assert.equal(
  shouldAutoRefreshLeadSyncState({
    sourceOfTruth: 'google_sheets',
    configuredSheetUrl: 'https://docs.google.com/spreadsheets/d/example/edit#gid=0',
    rowCount: 29,
    sync: {
      mode: 'sheet_backed',
      status: 'success',
      lastSyncAt: minutesAgo(45),
      lastSuccessAt: minutesAgo(45),
      lastInboundSyncAt: minutesAgo(45),
      lastOutboundSyncAt: null,
      lastError: null,
      rowCount: 29,
    },
    nowMs: now,
  }),
  true,
)

assert.equal(
  shouldAutoRefreshLeadSyncState({
    sourceOfTruth: 'google_sheets',
    configuredSheetUrl: 'https://docs.google.com/spreadsheets/d/example/edit#gid=0',
    rowCount: 0,
    sync: {
      mode: 'sheet_backed',
      status: 'success',
      lastSyncAt: new Date(now - SHEET_METRICS_FRESH_MS - 60_000).toISOString(),
      lastSuccessAt: new Date(now - SHEET_METRICS_FRESH_MS - 60_000).toISOString(),
      lastInboundSyncAt: new Date(now - SHEET_METRICS_FRESH_MS - 60_000).toISOString(),
      lastOutboundSyncAt: null,
      lastError: null,
      rowCount: 0,
    },
    nowMs: now,
  }),
  true,
)

assert.equal(
  shouldAutoRefreshLeadSyncState({
    sourceOfTruth: 'google_sheets',
    configuredSheetUrl: 'https://docs.google.com/spreadsheets/d/example/edit#gid=0',
    rowCount: 29,
    sync: {
      mode: 'sheet_backed',
      status: 'error',
      lastSyncAt: minutesAgo(30),
      lastSuccessAt: minutesAgo(45),
      lastInboundSyncAt: minutesAgo(30),
      lastOutboundSyncAt: null,
      lastError: 'HTTP 500 during sheet fetch',
      rowCount: 29,
    },
    nowMs: now,
  }),
  true,
)

assert.equal(
  shouldAutoRefreshLeadSyncState({
    sourceOfTruth: 'google_sheets',
    configuredSheetUrl: 'https://docs.google.com/spreadsheets/d/example/edit#gid=0',
    rowCount: 29,
    sync: {
      mode: 'sheet_backed',
      status: 'success',
      lastSyncAt: minutesAgo(2),
      lastSuccessAt: minutesAgo(2),
      lastInboundSyncAt: minutesAgo(2),
      lastOutboundSyncAt: null,
      lastError: null,
      rowCount: 29,
    },
    nowMs: now,
  }),
  false,
)

assert.equal(
  shouldAutoRefreshLeadSyncState({
    sourceOfTruth: 'google_sheets',
    configuredSheetUrl: 'https://docs.google.com/spreadsheets/d/example/edit#gid=0',
    rowCount: 0,
    sync: {
      mode: 'sheet_backed',
      status: 'error',
      lastSyncAt: minutesAgo(3),
      lastSuccessAt: null,
      lastInboundSyncAt: minutesAgo(3),
      lastOutboundSyncAt: null,
      lastError: 'Sheet is not publicly accessible',
      rowCount: 0,
    },
    nowMs: now,
  }),
  false,
)

assert.equal(
  shouldAutoRefreshLeadSyncState({
    sourceOfTruth: 'google_sheets',
    configuredSheetUrl: 'https://docs.google.com/spreadsheets/d/example/edit#gid=0',
    rowCount: 29,
    sync: {
      mode: 'sheet_backed',
      status: 'success',
      lastSyncAt: new Date(now - LEAD_SHEET_AUTO_REFRESH_COOLDOWN_MS + 30_000).toISOString(),
      lastSuccessAt: minutesAgo(45),
      lastInboundSyncAt: new Date(now - LEAD_SHEET_AUTO_REFRESH_COOLDOWN_MS + 30_000).toISOString(),
      lastOutboundSyncAt: null,
      lastError: null,
      rowCount: 29,
    },
    nowMs: now,
  }),
  false,
)

console.log('leadSyncStatus.selftest passed')
