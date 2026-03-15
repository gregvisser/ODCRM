export type TruthSource = 'google_sheets' | 'db'
export type LeadDataFreshness = 'live' | 'diagnostic_stale'
export type LeadSyncErrorCode =
  | 'missing_sheet_url'
  | 'never_synced'
  | 'stale_sync'
  | 'sync_failed'
  | 'zero_rows_imported'
  | 'unreadable_sheet'

export type LeadSyncStateCode =
  | 'live'
  | 'stale_last_good'
  | 'sync_failed'
  | 'never_synced'
  | 'connected_empty'
  | 'misconfigured'

export type LeadSyncStateSeverity = 'info' | 'warning' | 'error'

export type LeadSyncMetaInput = {
  mode: 'sheet_backed' | 'db_backed'
  status: string | null
  lastSyncAt: string | null
  lastSuccessAt: string | null
  lastInboundSyncAt: string | null
  lastOutboundSyncAt: string | null
  lastError: string | null
  rowCount: number
}

export type LeadSyncViewState = {
  code: LeadSyncStateCode
  severity: LeadSyncStateSeverity
  canUseLeadData: boolean
  syncInProgress: boolean
  message: string
  detail: string | null
  errorCode: LeadSyncErrorCode | null
  dataFreshness: LeadDataFreshness
  authoritative: boolean
  warning?: string
  hint?: string
  lastSuccessfulSyncAgeMs: number | null
}

export const SHEET_METRICS_FRESH_MS = 15 * 60 * 1000
export const LEAD_SHEET_AUTO_REFRESH_COOLDOWN_MS = 5 * 60 * 1000

export function classifySheetSyncError(message: string | null | undefined): LeadSyncErrorCode | null {
  const text = String(message || '').toLowerCase()
  if (!text) return null
  if (
    text.includes('invalid google sheets url') ||
    text.includes('sheet is not publicly accessible') ||
    text.includes('sheet not found') ||
    text.includes('html instead of csv') ||
    text.includes('url did not return csv')
  ) {
    return 'unreadable_sheet'
  }
  if (text.includes('0 rows')) return 'zero_rows_imported'
  return 'sync_failed'
}

function buildViewState(
  code: LeadSyncStateCode,
  severity: LeadSyncStateSeverity,
  params: {
    canUseLeadData: boolean
    syncInProgress: boolean
    message: string
    detail?: string | null
    errorCode?: LeadSyncErrorCode | null
    dataFreshness: LeadDataFreshness
    authoritative: boolean
    warning?: string
    hint?: string
    lastSuccessfulSyncAgeMs?: number | null
  },
): LeadSyncViewState {
  return {
    code,
    severity,
    canUseLeadData: params.canUseLeadData,
    syncInProgress: params.syncInProgress,
    message: params.message,
    detail: params.detail ?? null,
    errorCode: params.errorCode ?? null,
    dataFreshness: params.dataFreshness,
    authoritative: params.authoritative,
    warning: params.warning,
    hint: params.hint,
    lastSuccessfulSyncAgeMs: params.lastSuccessfulSyncAgeMs ?? null,
  }
}

export function resolveLeadSyncViewState(params: {
  sourceOfTruth: TruthSource
  configuredSheetUrl: string
  sync: LeadSyncMetaInput
  rowCount: number
  bootstrap?: { started: boolean; error: string | null }
}): LeadSyncViewState {
  const {
    sourceOfTruth,
    configuredSheetUrl,
    sync,
    rowCount,
    bootstrap = { started: false, error: null },
  } = params

  const syncInProgress = sync.status === 'syncing'
  const classifiedError = classifySheetSyncError(bootstrap.error || sync.lastError)
  const hasLastSuccess = Boolean(sync.lastSuccessAt)
  const lastSuccessMs = sync.lastSuccessAt ? Date.parse(sync.lastSuccessAt) : Number.NaN
  const lastSuccessfulSyncAgeMs = Number.isFinite(lastSuccessMs) ? Math.max(0, Date.now() - lastSuccessMs) : null
  const syncHasFailedWithoutStatus = sync.status === 'syncing' && !sync.lastSuccessAt && Boolean(sync.lastError)
  const emptySheetState =
    rowCount === 0 &&
    (
      (sync.lastSuccessAt && sync.status === 'success') ||
      classifiedError === 'zero_rows_imported'
    )

  if (sourceOfTruth === 'db') {
    return buildViewState('live', 'info', {
      canUseLeadData: true,
      syncInProgress: false,
      message: 'Lead data is current from ODCRM.',
      dataFreshness: 'live',
      authoritative: true,
    })
  }

  if (!configuredSheetUrl.trim()) {
    const message = 'No leads reporting sheet is configured for this client.'
    return buildViewState('misconfigured', 'error', {
      canUseLeadData: false,
      syncInProgress: false,
      message,
      errorCode: 'missing_sheet_url',
      dataFreshness: 'diagnostic_stale',
      authoritative: false,
      warning: message,
    })
  }

  if (bootstrap.error) {
    const errorCode = classifySheetSyncError(bootstrap.error) ?? 'sync_failed'
    const isMisconfigured = errorCode === 'unreadable_sheet' || errorCode === 'missing_sheet_url'
    const message = isMisconfigured
      ? 'The linked Google Sheet is not readable yet.'
      : 'The initial lead sync failed before a usable snapshot was created.'
    return buildViewState(isMisconfigured ? 'misconfigured' : 'sync_failed', 'error', {
      canUseLeadData: false,
      syncInProgress: false,
      message,
      detail: bootstrap.error,
      errorCode,
      dataFreshness: 'diagnostic_stale',
      authoritative: false,
      warning: `Initial sheet sync failed: ${bootstrap.error}`,
    })
  }

  if (emptySheetState) {
    const hint = 'The linked Google Sheet is connected and currently empty.'
    return buildViewState('connected_empty', 'info', {
      canUseLeadData: true,
      syncInProgress,
      message: hint,
      errorCode: classifiedError === 'zero_rows_imported' ? 'zero_rows_imported' : null,
      dataFreshness: 'live',
      authoritative: true,
      hint,
      lastSuccessfulSyncAgeMs,
    })
  }

  if (sync.status === 'error' || syncHasFailedWithoutStatus) {
    const errorCode = classifiedError ?? 'sync_failed'
    const isMisconfigured = errorCode === 'unreadable_sheet' || errorCode === 'missing_sheet_url'
    const code: LeadSyncStateCode = isMisconfigured ? 'misconfigured' : 'sync_failed'

    if (hasLastSuccess) {
      const message = isMisconfigured
        ? 'The linked Google Sheet is misconfigured. Showing the last successful lead snapshot.'
        : 'The latest lead sync failed. Showing the last successful lead snapshot.'
      return buildViewState(code, 'warning', {
        canUseLeadData: true,
        syncInProgress: false,
        message,
        detail: sync.lastError,
        errorCode,
        dataFreshness: 'diagnostic_stale',
        authoritative: false,
        warning: sync.lastError || message,
        lastSuccessfulSyncAgeMs,
      })
    }

    const message = isMisconfigured
      ? 'The linked Google Sheet is misconfigured and no successful lead snapshot is available.'
      : 'Lead data is unavailable because the latest sheet sync failed before a usable snapshot was created.'
    return buildViewState(code, 'error', {
      canUseLeadData: false,
      syncInProgress: false,
      message,
      detail: sync.lastError,
      errorCode,
      dataFreshness: 'diagnostic_stale',
      authoritative: false,
      warning: sync.lastError || message,
      lastSuccessfulSyncAgeMs,
    })
  }

  if (!hasLastSuccess) {
    const message = syncInProgress || bootstrap.started
      ? 'Initial lead sync is in progress. Lead data will appear after the first successful sync.'
      : 'This sheet-backed client has not completed a successful lead sync yet.'
    return buildViewState('never_synced', syncInProgress || bootstrap.started ? 'info' : 'warning', {
      canUseLeadData: false,
      syncInProgress,
      message,
      errorCode: 'never_synced',
      dataFreshness: 'diagnostic_stale',
      authoritative: false,
      warning: syncInProgress || bootstrap.started ? undefined : message,
    })
  }

  if (lastSuccessfulSyncAgeMs == null || lastSuccessfulSyncAgeMs > SHEET_METRICS_FRESH_MS) {
    const message = 'Showing the last successful lead snapshot. Live refresh is overdue.'
    return buildViewState('stale_last_good', 'warning', {
      canUseLeadData: true,
      syncInProgress,
      message,
      errorCode: 'stale_sync',
      dataFreshness: 'diagnostic_stale',
      authoritative: false,
      warning: message,
      lastSuccessfulSyncAgeMs,
    })
  }

  return buildViewState('live', 'info', {
    canUseLeadData: true,
    syncInProgress,
    message: syncInProgress ? 'Lead data is current. A refresh is in progress.' : 'Lead data is current.',
    dataFreshness: 'live',
    authoritative: true,
    lastSuccessfulSyncAgeMs,
  })
}

function parseIsoMs(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function shouldAutoRefreshLeadSyncState(params: {
  sourceOfTruth: TruthSource
  configuredSheetUrl: string
  sync: LeadSyncMetaInput
  rowCount: number
  bootstrap?: { started: boolean; error: string | null }
  nowMs?: number
}): boolean {
  const {
    sourceOfTruth,
    configuredSheetUrl,
    sync,
    rowCount,
    bootstrap,
    nowMs = Date.now(),
  } = params

  if (sourceOfTruth !== 'google_sheets') return false
  if (!configuredSheetUrl.trim()) return false
  if (sync.status === 'syncing') return false

  const viewState = resolveLeadSyncViewState({
    sourceOfTruth,
    configuredSheetUrl,
    sync,
    rowCount,
    bootstrap,
  })

  const lastSyncMs = parseIsoMs(sync.lastSyncAt)
  const sinceLastSyncMs = lastSyncMs == null ? null : Math.max(0, nowMs - lastSyncMs)

  if (sinceLastSyncMs != null && sinceLastSyncMs < LEAD_SHEET_AUTO_REFRESH_COOLDOWN_MS) {
    return false
  }

  if (viewState.code === 'never_synced') return true

  if (viewState.code === 'stale_last_good') return true

  if (viewState.code === 'sync_failed') {
    return viewState.canUseLeadData
  }

  if (viewState.code === 'connected_empty') {
    if (viewState.lastSuccessfulSyncAgeMs == null) return true
    return viewState.lastSuccessfulSyncAgeMs > SHEET_METRICS_FRESH_MS
  }

  return false
}
