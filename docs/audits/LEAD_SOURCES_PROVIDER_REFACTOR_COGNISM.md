# Lead Sources — provider refactor (Cognism, no Google Sheets)

## Prior state

- Lead Sources was **sheet-oriented**: operators pasted Google Sheets URLs, the backend fetched CSV exports, and **contacts were held in an in-memory cache** (not durable across restarts).
- Cognism could use **Cognism API** mode with a sentinel `spreadsheetId` (`COGNISM_API`), but the UI still offered **legacy Google Sheet** connect for Cognism and sheet-centric copy (“Refresh from sheet”, “Open linked sheet”).

## Product decision

- **Remove Google Sheets from the Lead Sources feature** for this implementation.
- **Cognism is the first real provider**: connect with API token (server-side only, masked last4 on reads), search/redeem via existing `cognismClient` + `cognismNormalizer`.
- **ODCRM database is truth** for imported rows, batches (`lead_source_row_seen`), batch names (`lead_source_batch_metadata`), contacts preview, and materialize-list.

## New state (this PR)

- **Additive migration** `20260323130000_lead_source_imported_contacts`: table `lead_source_imported_contacts` stores normalized + `flatFields` JSON per `(customerId, sourceType, spreadsheetId, fingerprint)`.
- **Poll** (`POST /api/lead-sources/:sourceType/poll`): only **Cognism API**; upserts imported rows, then `lead_source_row_seen` as before.
- **GET contacts** and **materialize-list** read **only from DB** (imported contacts + row-seen for batch membership and first-seen ordering).
- **Removed routes**: `POST /api/lead-sources/:sourceType/connect` (sheet URL), `GET /api/lead-sources/:sourceType/open-sheet`.
- **Legacy `SHEET` providerMode** configs are **ignored** by `resolveLeadSourceConfig` (no silent migration; data remains in DB for reference).
- **UI**: provider framing, Cognism-only connect modal, no sheet URL / legacy checkbox; Apollo/Social/Blackbook show **Coming soon** (disabled).

## Intentionally deferred

- Renaming `lead_source_sheet_configs` / `spreadsheetId` column to neutral names (Option A: keep table/column names; behavior is neutral).
- Backfill of `lead_source_imported_contacts` from legacy sheet-only installs (operators must re-import via Cognism API).

## Operator-visible behaviour

- Connect **Cognism API token** + optional search defaults; **Import from Cognism** replaces “refresh from sheet”; no “open sheet” actions in Lead Sources.
