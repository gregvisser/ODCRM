# Lead Sources Rebuild — Repo Inventory

**Date:** 2026-02-19  
**Purpose:** Rebuild Marketing → Lead Sources with Google Sheets as immutable source of truth (metadata only in DB; no contacts persisted).

---

## 1. Frontend

### 1.1 Marketing routing

| Path | File | Notes |
|------|------|--------|
| Top-level nav | `src/contracts/nav.ts` | `marketing-home` |
| App switch | `src/App.tsx` | `case 'marketing-home':` → `MarketingHomePage` |
| Marketing container | `src/tabs/marketing/MarketingHomePage.tsx` | Renders `SubNavigation`; view `lists` → `LeadSourcesTab` |
| Sub-nav item | `src/tabs/marketing/MarketingHomePage.tsx` | `id: 'lists', label: 'Lead Sources', content: <LeadSourcesTab />` |

**Reuse:** Existing Marketing routing; no change to tab id or path.  
**Create:** None.

### 1.2 Lead Sources tab / components

| Path | Purpose |
|------|--------|
| `src/tabs/marketing/components/LeadSourcesTab.tsx` | Current Lead Sources UI: uses `/api/sheets/sources`, connect/sync/lists/preview, snapshot lists, raw rows. |

**Reuse:** Customer selector pattern, `settingsStore`, `api`, `normalizeCustomersListResponse`, `GoogleSheetLink` (for “Open Sheet” only as link text, never raw URL).  
**Must create:** New Lead Sources UI: Source Cards (4 sources), Batches view, Contacts viewer (wide table with sticky header, horizontal/vertical scroll, pagination). Optionally a separate `LeadSourceBatchesView.tsx` and `LeadSourceContactsView.tsx` for clarity.

### 1.3 Existing sheets / Google integration (frontend)

| Path | Purpose |
|------|--------|
| `src/components/links/GoogleSheetLink.tsx` | Displays label + link; never shows raw URL. |
| `src/utils/liveLeadsApi.ts` | Calls `/api/live/leads` and `/api/live/leads/metrics` (single customer URL; not 4-source). |
| `src/hooks/useLiveLeadsPolling.ts` | Polling for live leads (single URL). |

**Reuse:** `GoogleSheetLink` for “Open Sheet” (construct URL server-side or from stored spreadsheetId only in backend; frontend receives display label/link only).  
**Conflict:** Current Lead Sources use `/api/sheets/sources` and sync/lists; new flow uses `/api/lead-sources` and batches/contacts. New UI will call new API only.  
**Create:** API client for `/api/lead-sources` (sources list, connect, poll, batches, contacts); optional polling hook for batches (30–60s).

### 1.4 Polling patterns

| Path | Pattern |
|------|--------|
| `src/hooks/useLiveLeadsPolling.ts` | `useEffect` + `setInterval` + `refetch`; interval ~60s. |

**Reuse:** Same pattern for batches view (poll every 30–60s).  
**Create:** Optional `useLeadSourceBatchesPolling(customerId, sourceType, date)`.

### 1.5 Wide-table components

| Path | Notes |
|------|--------|
| `src/components/DataTable.tsx` | Generic data table. |
| `src/tabs/marketing/components/LeadSourcesTab.tsx` | Uses Chakra `Table`, `Thead`, `Tbody`; raw rows in expandable section. |
| `src/components/LeadsTab.tsx` | Table with many columns. |

**Reuse:** Chakra `Table`; **must implement** sticky header, `overflow-x: auto`, `overflow-y: auto`, `max-height: 60vh`, `min-width` or `table-layout: fixed`, loading/empty/error and pagination.  
**Create:** A dedicated “wide table” block inside Lead Sources (or reusable `WideDataTable.tsx`) that meets the spec (sticky header, no layout jump, pagination).

---

## 2. Backend

### 2.1 Sheet fetch / validator routes

| Path | Purpose |
|------|--------|
| `server/src/routes/sheets.ts` | GET `/sources`, POST `/sources/:source/connect`, POST `/sources/:source/sync`, GET `/sources/:source/lists`, GET `/sources/:source/lists/:listId/rows`, GET `/sources/:source/preview`. Uses `SheetSource` (cognism, apollo, blackbook), `SheetSourceConfig`, Google Sheets API via service. |
| `server/src/routes/leads.ts` | GET `/sync/validate`, GET `/sync/status`, POST `/sync/trigger`, etc. For LeadRecord sync. |
| `server/src/routes/liveLeads.ts` | GET `/leads`, GET `/leads/metrics` — single URL per customer (`Customer.leadsReportingUrl`), uses `liveSheets.ts` (CSV fetch, no DB writes). |

**Reuse:** `getCustomerId(req)` pattern; optionally `parseSheetUrl` from googleSheetsService or same logic in new route.  
**Conflict:** New design: 4 sources per customer (Cognism, Apollo, Social, Blackbook), no contacts in DB, virtual batching, metadata-only config. So **new** route prefix `/api/lead-sources` and new config/row-seen models; do not reuse `SheetSourceConfig` for this flow (or we could migrate later; spec says new models `LeadSourceSheetConfig` + `LeadSourceRowSeen`).  
**Create:** `server/src/routes/leadSources.ts` — GET `/`, POST `/:sourceType/connect`, POST `/:sourceType/poll`, GET `/:sourceType/batches`, GET `/:sourceType/contacts`.

### 2.2 CSV / Google API utilities

| Path | Purpose |
|------|--------|
| `server/src/utils/liveSheets.ts` | `resolveCsvUrl`, `fetchCsv`, `parseCsv`, `rowsToLiveLeads` (canonical: occurredAt, source, owner, company, name + raw). In-memory cache per (customerId, url). |
| `server/src/services/googleSheetsService.ts` | Service account auth, `parseSheetUrl`, `readSheet` (returns headers + rows), `findFieldMappings`, `extractContactFromRow`. |

**Reuse:** `resolveCsvUrl` (or equivalent) to get CSV export URL from spreadsheet ID + gid; `fetchCsv`-style fetch (or use `readSheet` if we keep Google API for 4-sheet flow). Sheets “cannot be modified” and “users append rows” — reading via CSV export or Sheets API both valid; CSV is simpler and matches live leads.  
**Must create:** Canonical mapping layer (all 20+ canonical fields + extraFields, header normalization, duplicate header handling as per spec). New module (e.g. `server/src/services/leadSourcesCanonicalMapping.ts`) used by poll and contacts endpoints.  
**Conflict:** `liveSheets.ts` maps to a small canonical set (occurredAt, source, owner, company, name); new spec has many more fields (firstName, lastName, email, linkedinUrl, companyName, jobTitle, etc.). New mapping layer is separate and used only for lead-sources rebuild.

### 2.3 Customer config models (existing)

| Model | File | Notes |
|-------|------|--------|
| `Customer` | `server/prisma/schema.prisma` | `leadsReportingUrl`, `leadsGoogleSheetLabel` (single URL per customer for legacy/live leads). |
| `SheetSourceConfig` | `server/prisma/schema.prisma` | `customerId`, `source` (cognism/apollo/blackbook), `sheetUrl`, `sheetId`, `gid`, `sheetName`, `lastSyncAt`, `lastError`, etc. Unique `(customerId, source)`. |

**Reuse:** `Customer` for tenant.  
**Create:** New models `LeadSourceSheetConfig` (metadata only: customerId, sourceType enum COGNISM|APOLLO|SOCIAL|BLACKBOOK, spreadsheetId, displayName, isLocked, lastFetchAt, lastError) and `LeadSourceRowSeen` (customerId, sourceType, spreadsheetId, fingerprint, firstSeenAt). Do not store contacts in DB.

### 2.4 Leads-related polling logic

| Path | Purpose |
|------|--------|
| `server/src/workers/leadsSync.ts` | Syncs leads from sheet into `LeadRecord` (DB). |
| `server/src/routes/liveLeads.ts` | No polling on server; client polls GET `/api/live/leads`. |

**Reuse:** None for “no contacts in DB” flow. New flow: POST `/:sourceType/poll` fetches sheet, normalizes, upserts `LeadSourceRowSeen` only, returns summary.  
**Create:** Poll endpoint that fetches CSV/sheet, runs canonical mapping, computes fingerprints, upserts LeadSourceRowSeen, updates LeadSourceSheetConfig lastFetchAt/lastError.

---

## 3. Database

### 3.1 Existing integration config models

| Model | Table | Key fields |
|-------|--------|------------|
| `SheetSourceConfig` | `sheet_source_configs` | customerId, source (enum), sheetUrl, sheetId, gid, sheetName, lastSyncAt, lastSyncStatus, lastError, rowsImported, rowsUpdated, rowsSkipped. |

**Reuse:** Pattern (customerId + source unique).  
**Create:** `LeadSourceSheetConfig` (id, customerId, sourceType enum, spreadsheetId, displayName, isLocked, lastFetchAt, lastError, createdAt, updatedAt). Unique (customerId, sourceType).  
**Create:** `LeadSourceRowSeen` (id, customerId, sourceType, spreadsheetId, fingerprint, firstSeenAt, createdAt, updatedAt). Unique (customerId, sourceType, spreadsheetId, fingerprint). Index (customerId, sourceType, firstSeenAt).

### 3.2 Existing enum patterns

| Enum | Values |
|------|--------|
| `SheetSource` | cognism, apollo, blackbook |
| `SheetSyncStatus` | pending, syncing, success, error |

**Reuse:** Enum style.  
**Create:** `LeadSourceType`: COGNISM, APOLLO, SOCIAL, BLACKBOOK (4 separate spreadsheets).

---

## 4. What can be reused

- Marketing routing and `LeadSourcesTab` mount point (replace content only).
- `getCustomerId(req)` on all new routes.
- `GoogleSheetLink` for “Open Sheet” (backend returns display label + internal link or sheet id only; frontend never shows spreadsheetId as raw text).
- Chakra `Table` + Box with overflow for wide table.
- Polling pattern from `useLiveLeadsPolling` (interval + refetch).
- `resolveCsvUrl` / `fetchCsv` / `parseCsv` from `liveSheets.ts` (or server-side equivalent) for reading sheet as CSV.
- `parseSheetUrl` from googleSheetsService for connect validation.
- Customer list loading and selector (same as current Lead Sources tab).

---

## 5. What must be created

- **DB:** Enum `LeadSourceType`; models `LeadSourceSheetConfig`, `LeadSourceRowSeen`; migration.
- **Backend:** Canonical column mapping (header normalization, duplicate handling, 20+ canonical fields + extraFields).
- **Backend:** Fingerprint computation (email → linkedin → name+company+jobTitle); normalization (trim, lowercase, collapse whitespace, trailing slashes).
- **Backend:** Virtual batch key (Europe/London date bucket + client + jobTitle); batch aggregation from LeadSourceRowSeen.
- **Backend:** Routes: GET `/api/lead-sources`, POST `/:sourceType/connect`, POST `/:sourceType/poll`, GET `/:sourceType/batches?date=`, GET `/:sourceType/contacts?batchKey=&page=&pageSize=`.
- **Backend:** 30–60s in-memory cache for (customerId, sourceType) for contacts response.
- **Frontend:** Source cards (4 sources: displayName, connected, lastFetchAt, lastError; View Batches, Open Sheet, Connect [admin]).
- **Frontend:** Batches view (by date; client, job title, count, last updated; poll 30–60s; click → Contacts viewer).
- **Frontend:** Contacts viewer: wide table (sticky header, horizontal/vertical scroll, aligned columns, loading/empty/error, pagination).
- **Frontend:** “Use in sequence” button storing `{ sourceType, batchKey }` (no contact copy to DB).
- **API client:** Functions for new lead-sources endpoints (with x-customer-id).

---

## 6. Known conflicts

- **Two sheet systems:** Existing `/api/sheets` + `SheetSourceConfig` vs new `/api/lead-sources` + `LeadSourceSheetConfig`. Both can coexist: Marketing → Lead Sources will use only the new API and new UI. Legacy sheets sync (ContactList, etc.) can keep using `/api/sheets`. Document which entry point uses which.
- **Source enum:** Current `SheetSource` has cognism, apollo, blackbook (3). New enum has COGNISM, APOLLO, SOCIAL, BLACKBOOK (4). “Social” in current UI is label for blackbook; in new spec Social and Blackbook are separate sources. Use new enum only for new flow.
- **Single URL vs 4 URLs:** `Customer.leadsReportingUrl` and `/api/live/leads` are one URL per customer. New flow is 4 configs per customer (one per source type). No conflict if we don’t change Customer.leadsReportingUrl for this feature.
- **Duplicate headers (Cognism):** Spec requires first occurrence canonical, subsequent as client_2, campaigns_2, etc. Existing googleSheetsService may not handle duplicates; new canonical layer must.

---

*End of LEAD_SOURCES_INVENTORY.md*
