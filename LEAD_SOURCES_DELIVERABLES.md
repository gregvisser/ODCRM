# Lead Sources Rebuild — Deliverables

**Date:** 2026-02-19  
**Scope:** Marketing → Lead Sources using Google Sheets as immutable source of truth (metadata only in DB; contacts not persisted).

---

## 1. Exact file paths created/modified

### Created

| Path | Purpose |
|------|--------|
| `LEAD_SOURCES_INVENTORY.md` | Repo inventory (frontend/backend/DB), reuse vs create, conflicts |
| `server/prisma/migrations/20260219120000_add_lead_source_sheet_config_and_row_seen/migration.sql` | Migration for new enum and tables |
| `server/src/services/leadSourcesCanonicalMapping.ts` | Canonical column mapping, header normalization, duplicate handling |
| `server/src/services/leadSourcesFingerprint.ts` | Fingerprint (email > linkedin > name+company+job) |
| `server/src/services/leadSourcesBatch.ts` | Virtual batch key (Europe/London date + client + jobTitle) |
| `server/src/routes/leadSources.ts` | GET /, POST /:sourceType/connect, POST /:sourceType/poll, GET /:sourceType/batches, GET /:sourceType/open-sheet, GET /:sourceType/contacts |
| `src/utils/leadSourcesApi.ts` | Frontend API client for lead-sources |
| `src/tabs/marketing/components/LeadSourcesTabNew.tsx` | New UI: source cards, batches view, contacts wide table |
| `LEAD_SOURCES_DELIVERABLES.md` | This file |

### Modified

| Path | Change |
|------|--------|
| `server/prisma/schema.prisma` | Added enum `LeadSourceType`, models `LeadSourceSheetConfig`, `LeadSourceRowSeen`; added relations on `Customer` |
| `server/src/index.ts` | Mounted `leadSourcesRouter` at `/api/lead-sources`; added route to debug list |
| `src/tabs/marketing/MarketingHomePage.tsx` | Replaced `LeadSourcesTab` with `LeadSourcesTabNew` for view `lists` |

### Unchanged (existing Lead Sources tab kept for reference)

| Path | Note |
|------|------|
| `src/tabs/marketing/components/LeadSourcesTab.tsx` | Old UI using `/api/sheets`; not removed so it can be compared or reverted |

---

## 2. Prisma migration details

- **Migration name:** `20260219120000_add_lead_source_sheet_config_and_row_seen`
- **Enum:** `LeadSourceType` = `COGNISM`, `APOLLO`, `SOCIAL`, `BLACKBOOK`
- **Tables:**
  - `lead_source_sheet_configs`: id, customerId, sourceType, spreadsheetId, gid, displayName, isLocked, lastFetchAt, lastError, createdAt, updatedAt. Unique (customerId, sourceType).
  - `lead_source_row_seen`: id, customerId, sourceType, spreadsheetId, fingerprint, batchKey, firstSeenAt, createdAt, updatedAt. Unique (customerId, sourceType, spreadsheetId, fingerprint). Indexes: customerId; (customerId, sourceType); (customerId, sourceType, firstSeenAt); (customerId, sourceType, batchKey).
- **Foreign keys:** Both tables reference `customers(id)` ON DELETE CASCADE.
- **Apply:** `cd server && npx prisma migrate deploy` (or `migrate dev` for dev). If shadow DB fails, apply SQL manually against target DB.

---

## 3. Manual QA steps

1. **Customer scope**  
   Select customer A; connect a sheet for Cognism. Switch to customer B; confirm Cognism is not connected. Connect for B; confirm A’s config unchanged.

2. **Connect**  
   Marketing → Lead Sources → Connect (e.g. Cognism). Enter valid Google Sheet URL and display name. Submit. Card shows Connected, no raw URL visible.

3. **Open Sheet**  
   Click “Open Sheet” on a connected source. New tab opens to the sheet (redirect from backend). URL in address bar is Google’s (no spreadsheetId in our UI).

4. **Poll**  
   Click “Poll now”. After success, “Last fetch” updates. Call GET batches for today; batches appear if sheet has data and fingerprinting produced batch keys.

5. **Batches**  
   View Batches → choose date. Table shows client, job title, count, last updated. Change date; list updates. Poll automatically every 45s while viewing.

6. **Contacts viewer**  
   Click “View contacts” on a batch. Wide table loads with sticky header; horizontal and vertical scroll; columns aligned. Change page; data updates. Empty state when 0 contacts.

7. **Use in sequence**  
   Click “Use in sequence” on a batch. Toast confirms selection stored. (Sequences tab can listen for `leadSourceBatchSelected` and use sourceType + batchKey; no DB persistence of contacts.)

8. **Errors**  
   Connect with invalid URL → error message. Poll with sheet returning HTML → lastError shown on card.

9. **No raw URLs**  
   Confirm spreadsheetId never appears in UI or in network response bodies (only in backend redirect target).

10. **Tenant isolation**  
    Call GET /api/lead-sources with x-customer-id A; then B. Response only that customer’s configs.

---

## 4. Tenant isolation checklist

- [x] **GET /api/lead-sources** — `getCustomerId(req)`; `findMany({ where: { customerId } })`.
- [x] **POST /:sourceType/connect** — `getCustomerId(req)`; upsert by `customerId_sourceType`; validate sheet access (no cross-tenant).
- [x] **POST /:sourceType/poll** — `getCustomerId(req)`; config and `LeadSourceRowSeen` createMany scoped by customerId.
- [x] **GET /:sourceType/batches** — `getCustomerId(req)`; config and row queries filtered by customerId.
- [x] **GET /:sourceType/open-sheet** — `getCustomerId(req)`; config lookup by customerId; redirect only for that config.
- [x] **GET /:sourceType/contacts** — `getCustomerId(req)`; config and fingerprint list by customerId; cache key includes customerId.
- [x] **In-memory cache** — Key is `customerId|sourceType`; no cross-tenant reuse.

---

## 5. Performance considerations

- **Poll:** createMany with skipDuplicates (one batch insert per poll). No N+1.
- **Batches:** Single aggregate query on `LeadSourceRowSeen` filtered by customerId, sourceType, spreadsheetId, batchKey startsWith date. Index (customerId, sourceType, batchKey) supports this.
- **Contacts:** Sheet fetched once per (customerId, sourceType) and cached 45s. Filter in memory by batchKey fingerprints; then paginate. For very large sheets (e.g. 10k+ rows), consider server-side pagination of sheet read or longer cache.
- **Canonical mapping:** Done once per poll and once per contacts fetch (or from cache); duplicate headers handled in single pass.
- **Frontend:** Batches poll every 45s only when batches view is open. Contacts load on demand with page size 50.

---

## 6. “Use in sequence” (Sunday scope)

- **Stored:** Only a reference `{ sourceType, batchKey }` (no contacts in DB).
- **UI:** Button dispatches `leadSourceBatchSelected` custom event with `detail: { sourceType, batchKey }`. Toast tells user to open Sequences.
- **Sequence logic:** Not implemented in this deliverable. Sequences tab (or campaign start) can listen for the event and resolve contacts at launch time by calling GET /api/lead-sources/:sourceType/contacts?batchKey=... and then attaching those contacts to the sequence/campaign without persisting them to Contact table.

---

*End of LEAD_SOURCES_DELIVERABLES.md*
