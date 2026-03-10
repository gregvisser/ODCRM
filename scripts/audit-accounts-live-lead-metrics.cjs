const API_BASE = process.env.ODCRM_API_BASE || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net'
const FRESHNESS_MINUTES = Number(process.env.ODCRM_LEADS_FRESHNESS_MINUTES || 15)
const SHOULD_REFRESH_UNAVAILABLE = process.argv.includes('--refresh-unavailable')

function hasSheetUrl(customer) {
  return typeof customer?.leadsReportingUrl === 'string' && customer.leadsReportingUrl.trim().length > 0
}

function parseJsonSafe(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function fetchJson(path, customerId, init = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(customerId ? { 'x-customer-id': customerId } : {}),
      ...(init.headers || {}),
    },
  })
  const text = await res.text()
  const json = parseJsonSafe(text)
  return {
    ok: res.ok,
    status: res.status,
    json,
    text,
  }
}

function classify(entry) {
  if (!entry.hasLeadsReportingUrl) return null
  if (entry.metricsHttpStatus >= 400 || entry.leadsHttpStatus >= 400) {
    return 'E.invalid_or_unreadable_sheet_url'
  }

  if (entry.errorCode === 'unreadable_sheet' || entry.errorCode === 'missing_sheet_url') {
    return 'E.invalid_or_unreadable_sheet_url'
  }
  if (entry.errorCode === 'never_synced') {
    return 'B.sheet_linked_but_never_synced'
  }
  if (entry.errorCode === 'sync_failed') {
    return 'C.sync_failed'
  }
  if (entry.errorCode === 'zero_rows_imported') {
    return 'D.sheet_linked_but_imported_zero_rows'
  }
  if (entry.errorCode === 'stale_sync') {
    return 'F.stale_sync_older_than_expected_freshness_window'
  }

  const sync = entry.sync || {}
  const warningText = `${entry.warning || ''} ${sync.lastError || ''}`.toLowerCase()
  if (warningText.includes('invalid google sheets url') || warningText.includes('invalid google sheets') || warningText.includes('sheet is not publicly accessible') || warningText.includes('sheet not found') || warningText.includes('html instead of csv') || warningText.includes('url did not return csv')) {
    return 'E.invalid_or_unreadable_sheet_url'
  }
  if (sync.status === 'error' || sync.lastError) {
    return 'C.sync_failed'
  }
  if (!sync.lastSuccessAt && !sync.lastInboundSyncAt && !sync.lastSyncAt) {
    return 'B.sheet_linked_but_never_synced'
  }
  if ((entry.rowCount || 0) === 0) {
    return 'D.sheet_linked_but_imported_zero_rows'
  }
  if (entry.authoritative === true) {
    return 'A.valid_live_metrics'
  }
  return 'C.sync_failed'
}

async function maybeRefreshUnavailableCustomer(entry) {
  if (!SHOULD_REFRESH_UNAVAILABLE) return null
  if (!['never_synced', 'stale_sync', 'sync_failed', 'zero_rows_imported'].includes(entry.errorCode || '')) {
    return null
  }
  const refreshRes = await fetchJson(`/api/live/leads/import?customerId=${encodeURIComponent(entry.customerId)}`, entry.customerId, {
    method: 'POST',
  })
  return {
    status: refreshRes.status,
    body: refreshRes.json || refreshRes.text,
  }
}

async function main() {
  const customersRes = await fetchJson('/api/customers')
  if (!customersRes.ok || !customersRes.json || !Array.isArray(customersRes.json.data)) {
    console.error(JSON.stringify({
      error: 'failed_to_fetch_customers',
      status: customersRes.status,
      body: customersRes.json || customersRes.text,
    }, null, 2))
    process.exit(1)
  }

  const customers = customersRes.json.data.filter(hasSheetUrl)
  const results = []

  for (const customer of customers) {
    const customerId = customer.id
    const leadsRes = await fetchJson(`/api/live/leads?customerId=${encodeURIComponent(customerId)}`, customerId)
    const metricsRes = await fetchJson(`/api/live/leads/metrics?customerId=${encodeURIComponent(customerId)}`, customerId)
    const metrics = metricsRes.json || {}
    const leads = leadsRes.json || {}
    const sync = metrics.sync || leads.sync || null

    const entry = {
      customerId,
      name: customer.name,
      hasLeadsReportingUrl: true,
      sourceOfTruth: metrics.sourceOfTruth || leads.sourceOfTruth || null,
      authoritative: metrics.authoritative ?? leads.authoritative ?? null,
      dataFreshness: metrics.dataFreshness || leads.dataFreshness || null,
      errorCode: metrics.errorCode || leads.errorCode || null,
      rowCount: metrics.rowCount ?? leads.rowCount ?? null,
      counts: metrics.counts || {
        today: metrics.todayLeads ?? null,
        week: metrics.weekLeads ?? null,
        month: metrics.monthLeads ?? null,
        total: metrics.totalLeads ?? null,
      },
      sync: sync ? {
        status: sync.status ?? null,
        lastSyncAt: sync.lastSyncAt ?? null,
        lastSuccessAt: sync.lastSuccessAt ?? null,
        lastInboundSyncAt: sync.lastInboundSyncAt ?? null,
        lastSuccessFreshnessMinutes:
          sync.lastSuccessAt && Number.isFinite(Date.parse(sync.lastSuccessAt))
            ? Math.round((Date.now() - Date.parse(sync.lastSuccessAt)) / 60000)
            : null,
        lastError: sync.lastError ?? null,
      } : null,
      warning: metrics.warning || leads.warning || null,
      leadsHttpStatus: leadsRes.status,
      metricsHttpStatus: metricsRes.status,
    }

    entry.refreshAttempt = await maybeRefreshUnavailableCustomer(entry)
    entry.bucket = classify(entry)
    results.push(entry)
  }

  const buckets = results.reduce((acc, entry) => {
    const key = entry.bucket || 'unknown'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  console.log(JSON.stringify({
    apiBase: API_BASE,
    freshnessMinutes: FRESHNESS_MINUTES,
    refreshUnavailable: SHOULD_REFRESH_UNAVAILABLE,
    sheetBackedCustomers: results.length,
    buckets,
    customers: results,
  }, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  }, null, 2))
  process.exit(1)
})
