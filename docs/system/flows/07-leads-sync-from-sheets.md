# Flow 07 — Leads sync from Google Sheets

```mermaid
sequenceDiagram
  autonumber
  participant User as User
  participant FE as Frontend Screen<br/>customers.leads-reporting (MarketingLeadsTab)<br/>+ marketing.lists (LeadSourcesTab)
  participant API as API Route Group<br/>/api/leads + /api/sheets
  participant DB as DB Models<br/>LeadRecord + LeadSyncState + SheetSourceConfig + Customer
  participant W as Worker<br/>leadsSync.ts (startLeadsSyncWorker + triggerManualSync)
  participant EXT as External<br/>Google Sheets (CSV export)

  User->>FE: Adds/updates a lead source sheet URL/label
  FE->>FE: Validate URL + label (label required when URL is set)
  FE->>API: PUT/POST /api/sheets (whitelisted fields only)
  API->>API: Validate input (schema)
  API->>API: Enforce whitelist writes
  API->>DB: Write SheetSourceConfig (customer-scoped)
  API-->>FE: 200 OK
  FE->>FE: Rehydrate after save (refetch sheet config + lead views)

  Note over W,EXT: Background sync runs every 10 minutes if ENABLE_LEADS_SYNC=true
  W->>DB: Find Customers with leadsReportingUrl / sheet configs
  W->>EXT: Fetch sheet CSV (Google Sheets export)
  W->>W: Validate/normalize rows (filter non-lead marker rows)
  W->>DB: Upsert LeadRecord rows (customer-scoped)
  W->>DB: Update LeadSyncState (lastSyncAt, status, counts)

  FE->>API: GET /api/leads (to display latest leads)
  API->>DB: Read LeadRecord + LeadSyncState
  API-->>FE: 200 OK (fresh leads)
```

## Inputs
- Google Sheet URL + label (customer-scoped)
- Worker enabled flag: `ENABLE_LEADS_SYNC=true`

## Outputs
- **`SheetSourceConfig`** updated
- Leads stored as **`LeadRecord`**
- Sync tracking in **`LeadSyncState`**
- UI refreshed from DB (rehydrated)

## Non-negotiable rules
- **Whitelist writes only** for sheet config and lead write operations.
- **No destructive overwrites**: new sync must not delete unrelated lead data unless explicitly designed.
- **Customer-scoped writes**: all lead records and sync state must stay within a customer.
- **Rehydrate after save**: UI must refetch after config changes and after sync completes.

## Failure cases
- Sheet not public / not found / invalid format → sync fails; state recorded in LeadSyncState.
- Worker disabled (`ENABLE_LEADS_SYNC!=true`) → leads won’t auto-refresh from sheets.
- Large sheet / rate limits → partial or delayed sync; surface errors in diagnostics/logs.
