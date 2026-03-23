# Lead Sources follow-up — batches scroll + client field

## Branch

`codex/fix-lead-sources-scroll-and-client-field`

## Start SHA (origin/main at fix time)

`73f019fd10efbf3d49a632b7a26f51055d3d9f70`

## 1) Root cause — batches horizontal scrollbar not usable

The batches table used a single `TableContainer` with both `overflowY="auto"` and `overflowX="auto"` plus `maxH`. In that structure, horizontal scrolling is tied to the same inner scroll container as vertical table content, so the horizontal scrollbar can be difficult to reach/use in practice.

Additionally, `minW="720px"` can fit many desktop layouts, so users may not get an obvious horizontal scroll affordance even when the table still feels cramped.

## 2) Root cause — `client` showing `none`

`client` is not read directly from a live sheet column in the batches endpoint. It is parsed from `batchKey` (`YYYY-MM-DD|client=...|job=...`) generated during poll. When no client value is present at poll time, `buildBatchKey` stores `(none)`.

The batches endpoint then returned that value as display content, and the UI also fell back to `(none)`, which looked like a meaningful source value instead of a "missing value" state.

So this is primarily a display truthfulness issue, not tenant scope or materialization logic.

## 3) Exact fix implemented

1. **Scrollable wrapper split (batches table):**
   - Outer `Box` owns `overflowX="auto"` and visible border/background.
   - Inner `TableContainer` owns only vertical scroll (`overflowY="auto"`, `maxH="55vh"`).
   - Table `minW` increased to `980px` so horizontal scroll is present when layout is constrained.
   - Sticky header behavior is preserved.

2. **Client display correction:**
   - Backend `GET /api/lead-sources/:sourceType/batches` now returns `client: null` when parsed client is empty or `(none)`.
   - Frontend renders a neutral placeholder (`—`) when `client` is absent.
   - This removes the misleading literal `none` while preserving underlying batch/materialization behavior.

## 4) Files modified

- `server/src/routes/leadSources.ts`
- `src/tabs/marketing/components/LeadSourcesTabNew.tsx`
- `src/utils/leadSourcesApi.ts`

## 5) Files removed

None.

## 6) Validation results

| Gate | Exit code |
|------|-----------|
| `npm run lint` | 0 |
| `npx tsc --noEmit` | 0 |
| `npm run build` | 0 |
| `cd server && npm run build` | 0 |

## 7) Limitations / follow-up notes

- `client` in batches remains derived from `batchKey` (poll-time metadata), not a guaranteed always-populated source column. This follow-up intentionally improves truthfulness of missing values instead of inventing mappings.
- If source data should always provide client, that requirement should be enforced at sheet/process level.
