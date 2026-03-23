# Cognism API integration — audit (2026-03-23)

## Prior state

- Lead Sources (`server/src/routes/leadSources.ts`) treated all four source types (including **COGNISM**) as **Google Sheets**: `spreadsheetId` + CSV export, `LeadSourceRowSeen` for batching, in-memory contact cache keyed by sheet identity.
- Operators exporting Cognism data via Sheets were required to paste a Sheet URL for **COGNISM** like other sources.

## Live docs / contract (verified)

Source: Postman collection embedded at [Cognism API](https://developers.cognism.com/) (collection id `UVJhBu4C`, fetched via `https://developers.cognism.com/api/collections/14862827/UVJhBu4C`).

| Item | Shipped behavior |
|------|------------------|
| Base URL | `https://app.cognism.com` (override: `COGNISM_API_BASE_URL`) |
| Auth | `Authorization: Bearer <API key>` (alternative `api_key` query param documented; we use header only) |
| Search | `POST /api/search/contact/search?lastReturnedKey=&indexSize=` — body JSON per Cognism examples (e.g. `firstName`, `jobTitles`, `regions`, nested `account.names`, …) |
| Pagination | Sequential only: `lastReturnedKey` from response; `indexSize` default 20, max 100 (per collection) |
| Redeem | `POST /api/search/contact/redeem` with `{ "redeemIds": [ "<token>", ... ] }` — used after search to obtain emails/phones for materialization |
| Entitlement check | `GET /api/search/entitlement/contactEntitlementSubscription` — used on connect to validate the API key |

## Design decision

- **Preserve** the Lead Sources abstraction: same routes for batches, contacts, materialize-list, sequences hand-off.
- **Add** `LeadSourceProviderMode`: `SHEET` (default) vs `COGNISM_API` for rows where `sourceType === COGNISM`.
- **Sentinel** `spreadsheetId = 'COGNISM_API'` for API mode so existing `LeadSourceRowSeen` / batch metadata keys stay structurally compatible (no destructive migration).
- **Secrets**: API token encrypted at rest with AES-256-GCM (`server/src/utils/leadSourceTokenCrypto.ts`), key from `LEAD_SOURCE_SECRETS_KEY` (32-byte base64). Last four characters stored denormalized (`cognismApiTokenLast4`) for UI hints without decrypting.
- **Poll**: Search (paginated up to `COGNISM_POLL_MAX_PAGES`) → collect `redeemId` → redeem in chunks → normalize → `LeadSourceRowSeen` + merged in-memory cache (same fingerprint / batch semantics as sheets).

## What changed (high level)

1. Prisma: `providerMode`, `cognismApiTokenEncrypted`, `cognismApiTokenLast4`, `cognismSearchDefaults` (JSON).
2. `POST /api/lead-sources/cognism/connect` — validate token, encrypt, save defaults.
3. `POST /api/lead-sources/COGNISM/poll` — when `providerMode === COGNISM_API`, call Cognism instead of CSV.
4. Contacts / materialize — Cognism API path uses merged cache; open-sheet returns 400 for API mode.
5. UI — Cognism default connect flow: API token + optional comma-separated filters; legacy Sheet connect behind checkbox.

## Non-goals (V1)

- No advanced query builder UI beyond simple comma-separated filters mapped into Cognism JSON.
- No background worker redesign; poll remains operator-driven via existing POST poll.
