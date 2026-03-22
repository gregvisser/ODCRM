# Lead Sources — audit and batch column plan

## Branch

`codex/audit-and-fix-lead-sources-table`

## Start SHA (origin/main at branch creation)

`221b56f0a70f7f729d18a61f54e3853815c65e0d`

## 1. Architecture summary

- **Sources of truth**: Four Google Sheets per logical source type (`COGNISM`, `APOLLO`, `SOCIAL`, `BLACKBOOK`). CSV is fetched via `https://docs.google.com/spreadsheets/d/{id}/export?format=csv&gid=…`.
- **Config**: `LeadSourceSheetConfig` (Prisma) stores `spreadsheetId`, optional `gid`, `appliesTo` (`CUSTOMER_ONLY` vs `ALL_ACCOUNTS`). Resolution: exact `(customerId, sourceType)` first; else first `ALL_ACCOUNTS` row for that `sourceType`.
- **Row tracking**: `POST /api/lead-sources/:sourceType/poll` reads CSV, maps headers via `leadSourcesCanonicalMapping.ts`, computes `computeFingerprint()` per row (`leadSourcesFingerprint.ts`), builds `batchKey` from Europe/London date + normalized `client` + `jobTitle` (`leadSourcesBatch.ts`), upserts `LeadSourceRowSeen` (`skipDuplicates` on fingerprint).
- **Batches UI**: `GET /api/lead-sources/:sourceType/batches?date=…` groups `LeadSourceRowSeen` by `batchKey`, sorts by `_max.firstSeenAt` descending, optional date filter with fallback to latest batches.
- **Contacts UI**: `GET /api/lead-sources/:sourceType/contacts?batchKey&page&pageSize&q=` loads CSV (cached ~45s), filters rows whose `__fp` is in the batch’s fingerprints, sorts by `firstSeenAt` descending (newest imports first), paginates, optional `q` search across columns.
- **Materialize for Sequences**: `POST …/materialize-list` reuses cached CSV, filters by batch fingerprints, creates/updates `Contact` + `ContactList` + `ContactListMember` (`leadSources.ts`).

## 2. Path: sheet rows → poll → batches → contacts → sequence-usable rows

1. Operator connects sheet → `POST …/connect` validates CSV headers (≥2 columns).
2. Operator polls → CSV → mapped rows → fingerprint + batchKey → `LeadSourceRowSeen` rows on **config owner** `customerId` (`getLeadSourceDataScope`).
3. Batches list → `groupBy batchKey` + metadata (`LeadSourceBatchMetadata.operatorName`).
4. Contacts for batch → fingerprint set from DB for `(configCustomerId, sourceType, spreadsheetId, batchKey)` → filter live CSV rows → sort by `firstSeenAt` → page/search.
5. Sequences → optional `materialize-list` → contacts with **email** become list members; template sends use standard `Contact` fields.

## 3. Bugs / gaps found

| Issue | Type | Notes |
|--------|------|--------|
| Stale **in-memory CSV cache** after sheet edits | Backend | `GET /contacts` used 45s cache. If the sheet changed since the last poll, DB fingerprints could reference rows that no longer fingerprint-match the **cached** export → **0 contacts** while batch **count > 0**. |
| Fingerprint query used `config.customerId` before explicit data scope | Clarity | Logically same as `dataScope.configCustomerId`; aligned to scope for consistency with poll/materialize. |
| Search + pagination race | Frontend | Changing search reset page in a separate `useEffect`, risking one request with old page index. |
| Batches table had no sticky header / bounded scroll | UX | Contacts table already had sticky `Th`; batches list did not. |
| No visible **“first seen”** column | Product | Ordering was correct server-side, but operators could not see the truth signal (`LeadSourceRowSeen.firstSeenAt`) in the grid. |

## 4. Root cause: “leads not pulling through”

Primary **backend/cache** issue: **fingerprint mismatch between DB and cached CSV** when the Google Sheet was updated without a corresponding poll (or cache still held an older export). Secondary causes to remember operationally: never connected source, wrong **date** filter for batches, empty sheet rows, or headers that do not map to canonical fields (still appear in “All sheet columns”).

Not a tenant-header bug: `X-Customer-Id` resolves config then uses the **config owner** for `LeadSourceRowSeen` consistently with poll.

## 5. Recommended batch / Email Sequences columns

Grounded in `materializeLeadSourceBatchList` (requires **email** for membership) and canonical mapping.

| Column / concept | Maps to (canonical) | Sequences role |
|------------------|---------------------|------------------|
| **email** | `email` | **REQUIRED** — without email, materialize skips the row. |
| **firstName** / **lastName** | `firstName`, `lastName` | **REQUIRED** for sensible contact records (defaults to “Unknown” if blank). |
| **companyName** | `companyName` | **REQUIRED** for contact record (defaults “Unknown”). |
| **jobTitle** | `jobTitle` | **RECOMMENDED** — stored on `Contact`, personalization. |
| **Phone** | `mobile`, `directPhone`, `officePhone` (first non-empty) | **RECOMMENDED** — stored when present. |
| **linkedinUrl** | `linkedinUrl` | **RECOMMENDED** for identity when email missing in some exports; drives fingerprint when no email. |
| **client** | `client` | **RECOMMENDED** — batch segmentation (part of `batchKey`), operator context. |
| **country** / **city** | `country`, `city` | **OPTIONAL** — targeting / copy. |
| **website**, **industries**, **headcount**, **hq** | canonical | **OPTIONAL** — enrichment. |
| **campaigns**, **campaignNotes**, **telesales**, **teleNotes**, **linkedinStatus**, **linkedinNotes** | canonical | **OPTIONAL / DISPLAY** — context; not required for send mechanics. |
| **odcrmFirstSeenAt** (server) | DB `firstSeenAt` | **DISPLAY / OPERATIONS** — proves import order; not a sheet column. |
| **fingerprint** (internal) | — | **NOT EXPOSED** — stability key, not for copy. |

**Duplicate sheet headers** map to `field_2`, `field_3`, etc. — **DISPLAY-ONLY** unless team promotes them into canonical mapping.

## 6. Classification summary

- **REQUIRED for enrollment**: `email` (and materially `firstName`, `lastName`, `companyName` for the materializer’s `Contact` create path).
- **RECOMMENDED**: `jobTitle`, phone fields, `linkedinUrl`, `client`.
- **OPTIONAL**: geography, firmographics, campaign/notes columns.
- **DISPLAY-ONLY / not sequence-critical**: extra duplicate columns, `odcrmFirstSeenAt` (operator clarity).

## 7. Proposed table UX (implemented)

- **Contacts**: Existing free-text search (`q`) across sheet columns + first-seen ISO; sticky headers; horizontal scroll; priority vs “All sheet columns” preserved; **first-seen** column in review mode when API provides it.
- **Batches**: Scrollable container (`maxH` ~55vh), **sticky** header row, unchanged row actions.
- **Search**: Reset to page 1 in the same handler as query change (no stale page).

## 8. Files changed (this PR)

- `server/src/routes/leadSources.ts` — shared CSV loader, cache-bust retry, `dataScope` for row-seen query, `odcrmFirstSeenAt` column.
- `src/utils/leadSourceReviewColumns.ts` — review + recommended columns for first-seen.
- `src/utils/leadSourcesApi.ts` — document `columns` semantics.
- `src/tabs/marketing/components/LeadSourcesTabNew.tsx` — batches sticky table, search/page fix, first-seen cell formatting.
- `src/tabs/marketing/components/SequencesTab.tsx` — align preview cell formatting + helper text.
- `src/utils/leadSourceReviewColumns.test.ts` — coverage for recommended keys with meta column.

## 9. Files removed

None.

## 10. Latest-first ordering

- **Batches**: `groupBy` with `_max.firstSeenAt` sort descending (API).
- **Contacts within batch**: sort by `LeadSourceRowSeen.firstSeenAt` per fingerprint, descending; **not** sheet row order.
- **UI**: `odcrmFirstSeenAt` surfaces the same DB timestamp for verification.

## 11. Validation approach

- `npm run lint`, `npx tsc --noEmit`, `npm run build`, `cd server && npm run build`
- `npx --yes tsx src/utils/leadSourceReviewColumns.test.ts`
- Manual: connect source → poll → open batch → confirm rows; edit sheet without poll → confirm contacts still appear after one `GET` (cache bust); search + pagination.

### Validation results (pre-merge)

| Gate | Exit code |
|------|-----------|
| `npm run lint` | 0 |
| `npx tsc --noEmit` | 0 |
| `npm run build` | 0 |
| `cd server && npm run build` | 0 |
| `npx --yes tsx src/utils/leadSourceReviewColumns.test.ts` | 0 |

## 12. Limitations / follow-ups

- If sheet and DB diverge **and** fresh CSV still does not match fingerprints (e.g. column mapping changed so fingerprints differ), operator must **re-poll** to re-record rows.
- No schema migration; additive API field only.
- Very large sheets remain bounded by pagination (50 default, 100 max).
