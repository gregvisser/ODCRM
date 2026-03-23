# Lead Sources — batch table truth and columns (follow-up)

## Branch

`codex/fix-lead-sources-batch-table-truth`

## Start SHA (origin/main at branch time)

`a365967d98e59ae7c080d6583bedc53962719f93`

## 1. Batch model (current truth)

- **batchKey** format: `YYYY-MM-DD|client=<norm>|job=<norm>` (see `server/src/services/leadSourcesBatch.ts`).
- **Norm**: empty strings become the literal **`(none)`** in the key string.
- **client** in the key is **not** a CRM “account” field — it is whatever was mapped from the sheet row at **poll** time into the canonical `client` slot. If that column is empty or unmapped, the segment is **`(none)`**.
- **Batches** are **aggregates** of `leadSourceRowSeen` rows grouped by `batchKey`; there is no separate batch-level “client” entity in the database beyond what is encoded in the key.
- **Contact/review** rows carry full sheet columns (email, company, etc.) after CSV mapping; that is the right place for **row-level** account/company data.

## 2. Is batch-level `client` a truthful, useful column?

**Mostly no for typical operational use.** When the sheet does not populate the mapped client field, every batch has `client=(none)` in the key, so a dedicated **Client** column was either **empty** or **misleading** (looked like a missing CRM attribute).

## 3. Why the PR #355 placeholder fix was insufficient

PR #355 correctly mapped `(none)` → `null` and showed **—** instead of the literal `(none)`. That did **not** add real client data; operators still saw a column of **—** with no operational value. The underlying issue is **column choice**, not placeholder formatting.

## 4. Final batch table columns (this PR)

| Column | Purpose |
|--------|--------|
| **Batch name** | Operator name + system fallback label under the input. |
| **Date** | `dateBucket` from the batch key (`YYYY-MM-DD`, Europe/London poll day). Always meaningful for valid keys. |
| **Job title** | Parsed `job=` segment when not empty / not `(none)`; otherwise **—**. |
| **Count** | Rows seen in this batch. |
| **Last updated** | Latest `firstSeenAt` in the group. |
| **Actions** | Review contacts / Use in sequence (unchanged). |

**Removed from the batch list:** dedicated **Client** column (data rarely useful at batch level; company/contact detail lives in **Review contacts**).

## 5. Batch list vs contact/review table

| Surface | Holds |
|--------|--------|
| **Batch list** | Grouping dimensions (date bucket, job title when present), counts, operator labels, actions. |
| **Review contacts** | Full lead rows: email, name, company, sheet columns, `odcrmFirstSeenAt`, etc. |

## 6. Email Sequences / downstream

- Sequence enrollment still uses **materialized lists** and **batch identity** (`sourceType` + `batchKey`); this PR does not change materialization or tenant scope.
- **Company / account** fields for personalization should continue to come from **contact** data, not from the batch key’s `client` segment unless you intentionally map that column in the sheet and accept it as a batch-grouping label.

## 7. Files modified

- `server/src/routes/leadSources.ts` — `dateBucket` in batch JSON; shared segment normalization for labels and API; fallback labels omit `(none)` segments.
- `src/utils/leadSourcesApi.ts` — `LeadSourceBatch` type (`dateBucket`, nullable `jobTitle`).
- `src/tabs/marketing/components/LeadSourcesTabNew.tsx` — batch table columns (Date, Job title); copy; wider `minW`; filter text.
- `server/tests/lead-sources-batch-table.test.ts` — narrow guardrail.

## 8. Files removed

None.

## 9. Validation

Run: `npm run lint`, `npx tsc --noEmit`, `npm run build`, `cd server && npm run build`.

## 10. Limitations / follow-up

- If a tenant **does** map a meaningful “client” dimension into the batch key and wants it visible, consider a **single** “Grouping” column later (combined segments) rather than resurrecting a misleading **Client** label.
- **Schema** changes are not required for truthful batch UX; batch identity remains in `batchKey`.
