# Lead Sources — QA & Testing

## API contract (endpoints mounted)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/lead-sources` | List 4 source configs for customer |
| POST | `/api/lead-sources/:sourceType/connect` | Connect sheet (TODO: guard in production) |
| POST | `/api/lead-sources/:sourceType/poll` | Fetch sheet, update first-seen |
| GET | `/api/lead-sources/:sourceType/batches?date=YYYY-MM-DD` | List batches for date |
| GET | `/api/lead-sources/:sourceType/contacts?batchKey=...&page=...&pageSize=...` | Paginated contacts for batch |
| GET | `/api/lead-sources/:sourceType/open-sheet` | 302 redirect to Google Sheet (no spreadsheetId in JSON) |

All use `getCustomerId(req)` (header `x-customer-id` or query `customerId` for redirect). No `spreadsheetId` in any JSON response.

---

## Tenant isolation checks

- **Source:** `customerId` must come only from `x-customer-id` header (or `customerId` query for redirects). Never from request body.
- **How to verify:**
  1. Call any lead-sources endpoint with header `x-customer-id: customer-A`.
  2. Call the same endpoint with `x-customer-id: customer-B`.
  3. Confirm that configs/batches/contacts returned are for the requested customer only (e.g. connect a sheet as customer-A, then call GET with customer-B and see no config for that source).
- **Cross-tenant:** Ensure that changing the header changes the data; no data from another customer appears.

## Manual test steps

### 1. Connect a source (POST connect)

- **Prerequisite:** Valid Google Sheet URL (viewable by the app / service account if used).
- **Steps:**
  1. Open Marketing → Lead Sources.
  2. Select a customer.
  3. Click **Connect** on one source (e.g. Cognism).
  4. Paste sheet URL and display name, submit.
- **Expected:** Success toast; card shows "Connected" and "Last fetch" empty until first poll.

### 2. Poll (POST poll)

- **Steps:** Click **Poll now** on a connected source.
- **Expected:** Toast with row count and new rows detected; "Last fetch" updates; no error.

### 3. Batches (GET batches)

- **Steps:** Click **View Batches** for a connected source; optionally change date.
- **Expected:** Table of batches (client, job title, count, last updated); empty if no rows for that date.

### 4. Contacts (GET contacts)

- **Steps:** Click **View contacts** on a batch.
- **Expected:** Wide table with sticky header, horizontal and vertical scroll; pagination works; columns align.

### 5. Open Sheet (redirect)

- **Steps:** Click **Open Sheet** on a connected source.
- **Expected:** Browser redirects to the Google Sheet; URL in address bar is Google’s (no raw spreadsheet ID shown in our UI).

### 6. Use in sequence + Preview

- **Steps:**
  1. In Lead Sources, select a batch and click **Use in sequence**.
  2. Confirm navigation to Sequences tab and info alert "Lead source batch selected".
  3. Click **Preview recipients**.
- **Expected:** Modal opens with up to 50 contacts from that batch; no console errors.

### 7. No spreadsheetId in JSON

- **Steps:** Call GET `/api/lead-sources`, GET `/:sourceType/batches`, GET `/:sourceType/contacts` and inspect response bodies.
- **Expected:** No `spreadsheetId` (or raw sheet URL) in any JSON; only `displayName`, `batchKey`, etc.

## Backend smoke test (curl)

**Base URL:** `http://localhost:3001` (or your backend URL).  
Replace `CUSTOMER_ID` with a valid customer id.

```bash
# List sources (expect 4 entries; connected: true/false per source)
curl -s -H "x-customer-id: CUSTOMER_ID" "http://localhost:3001/api/lead-sources"

# Batches for a date (expect { batches: [...] })
curl -s -H "x-customer-id: CUSTOMER_ID" "http://localhost:3001/api/lead-sources/COGNISM/batches?date=2025-02-19"

# Contacts (requires valid batchKey from batches response)
curl -s -H "x-customer-id: CUSTOMER_ID" "http://localhost:3001/api/lead-sources/COGNISM/contacts?batchKey=2025-02-19|client=Acme|job=Manager&page=1&pageSize=10"

# Open sheet (expect 302 redirect to Google)
curl -sI -H "x-customer-id: CUSTOMER_ID" "http://localhost:3001/api/lead-sources/COGNISM/open-sheet"
```

**Connect (POST):** requires valid sheet URL; run only if you have a test sheet.

```bash
curl -s -X POST -H "x-customer-id: CUSTOMER_ID" -H "Content-Type: application/json" \
  -d '{"sheetUrl":"https://docs.google.com/spreadsheets/d/YOUR_ID/edit","displayName":"Test"}' \
  "http://localhost:3001/api/lead-sources/COGNISM/connect"
```

**Poll (POST):** run after connect.

```bash
curl -s -X POST -H "x-customer-id: CUSTOMER_ID" "http://localhost:3001/api/lead-sources/COGNISM/poll"
```

## Expected results summary

| Check              | Expected |
|--------------------|----------|
| Tenant isolation   | Data scoped by `x-customer-id` only |
| GET /api/lead-sources | 200, `{ sources: [ { sourceType, displayName, connected, lastFetchAt, lastError, isLocked }, ... ] }` |
| GET batches        | 200, `{ batches: [ { batchKey, date, client, jobTitle, count, firstSeenMin, firstSeenMax }, ... ] }` |
| GET contacts        | 200, `{ columns, contacts, page, pageSize, total }`; no `spreadsheetId` |
| Open sheet         | 302 redirect to Google Sheets URL |
| UI wide table       | Sticky header, horizontal + vertical scroll, stable columns |
| Sequence stub       | "Use in sequence" → navigate to Sequences; "Preview recipients" shows contacts in modal |

## Repo test framework

If the repo has a test runner (e.g. Jest/Vitest) for the server, add a minimal route test that:

1. Mocks Prisma (or uses a test DB) for `LeadSourceSheetConfig` / `LeadSourceRowSeen`.
2. Calls GET `/api/lead-sources` with `x-customer-id` and asserts 200 and `sources` array length 4.

If no test framework is present, the curl examples above serve as the smoke test.
