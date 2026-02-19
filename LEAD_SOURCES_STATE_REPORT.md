# Lead Sources Rebuild — State Report

**Date:** 2026-02-19  
**Purpose:** Establish current state (what compiles, what’s partial/broken, what’s missing).

---

## Files confirmed

| Area | Path | Status |
|------|------|--------|
| Schema | `server/prisma/schema.prisma` | Present. New enum `LeadSourceType`, models `LeadSourceSheetConfig`, `LeadSourceRowSeen`; Customer has `leadSourceSheetConfigs`, `leadSourceRowSeen`. No duplicate `contactSourceRows` (single occurrence). |
| Server entry | `server/src/index.ts` | Present. `leadSourcesRouter` imported and mounted at `/api/lead-sources`. |
| Routes | `server/src/routes/leadSources.ts` | Present. GET /, POST /:sourceType/connect, POST /:sourceType/poll, GET /:sourceType/batches, GET /:sourceType/open-sheet, GET /:sourceType/contacts. Uses getCustomerId(req). |
| Canonical | `server/src/services/leadSourcesCanonicalMapping.ts` | Present. Header normalization, duplicate handling, csvToMappedRows. |
| Fingerprint | `server/src/services/leadSourcesFingerprint.ts` | Present. email > linkedinUrl > name+company+job. |
| Batch | `server/src/services/leadSourcesBatch.ts` | Present. Europe/London date + client + jobTitle, (none) fallback. |
| Frontend tab | `src/tabs/marketing/components/LeadSourcesTabNew.tsx` | Present. Source cards, batches, contacts viewer (sticky header, scroll). |
| API client | `src/utils/leadSourcesApi.ts` | Present. All endpoints + buildOpenSheetUrl(apiBase, sourceType, customerId). |
| Marketing home | `src/tabs/marketing/MarketingHomePage.tsx` | Uses `LeadSourcesTabNew` for Lead Sources view. |
| Docs | `LEAD_SOURCES_INVENTORY.md`, `LEAD_SOURCES_DELIVERABLES.md` | Present. |

---

## What compiles now / likely errors

- **Backend:** TypeScript compiles if Prisma client is generated (`npx prisma generate`). Routes use `@prisma/client` and service imports; no spreadsheetId in JSON responses (only in redirect server-side).
- **Frontend:** Compiles; `LeadSourcesTabNew` and `leadSourcesApi` have no obvious type errors. `buildOpenSheetUrl` takes API_BASE (may be empty in dev); link still works with relative `/api/lead-sources/...?customerId=`.
- **Likely errors without migration applied:** Prisma client will not include `LeadSourceSheetConfig` / `LeadSourceRowSeen` until migration is applied and `prisma generate` run. So server may fail at runtime when hitting lead-sources routes until migration is deployed.
- **Migration:** `npx prisma migrate dev --create-only` can fail with “underlying table for model customer does not exist” when using a **shadow database** (Prisma replays all migrations in a temporary DB). CI uses `migrate deploy` against the real DB, which does have customers table. So the failure is shadow-DB-specific, not a bug in our migration SQL.

---

## What is missing to finish

1. **Schema (Task 1):** Confirm no duplicate relations; ensure new relations on separate lines and naming consistent. Run `npx prisma validate`.
2. **Migration (Task 2):** Normalize migration.sql formatting (indentation in `lead_source_row_seen`); ensure newline after `-- CreateEnum`; document “How to apply” for local and Azure. No baseline change needed—migrations exist; user runs `migrate deploy` on real DB.
3. **Backend (Task 3):** Remove unused `POLL_STALE_MS`; ensure connect is guarded (comment or optional admin check); ensure 45s cache is 30–60s; no background fetch (already removed). Response for connect must never include spreadsheetId (already does not).
4. **Frontend (Task 4):** Polling without flicker (keep previous batches/contacts while refetching); ensure Open Sheet uses backend redirect URL with customerId in query (already does); verify wide table sticky header and scroll.
5. **Sequence stub (Task 5):** Shared client store or route state for `{ sourceType, batchKey }`; CTA to Sequences; “Preview recipients” that calls GET contacts for chosen batch.
6. **QA doc (Task 6):** `LEAD_SOURCES_QA.md` with tenant isolation, manual steps, curl smoke tests.
7. **Ship checklist (Task 7):** `LEAD_SOURCES_SHIP_CHECKLIST.md` with preconditions, migration steps, Azure, rollback, monitoring.

---

*End of State Report*
