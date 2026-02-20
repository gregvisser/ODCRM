# Lead Sources Contacts — Audit Log

**Purpose:** Prove contacts columns and config resolution with real production evidence. No guessing.

---

## Phase 0 — Environment

| Item | Value |
|------|--------|
| **Current HEAD SHA** | `36a026c` (after commit *fix(lead-sources): contacts columns proven + config trace*) |
| **Production backend base URL** | `https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net` |
| **Production frontend URL** | `https://odcrm.bidlow.co.uk` |
| **Contacts endpoint pattern** | `GET /api/lead-sources/:sourceType/contacts?batchKey=...&page=1&pageSize=50` |
| **Required header** | `x-customer-id: <CUSTOMER_ID>` |

### Test values (to be filled from real request)

| Item | Value |
|------|--------|
| **customerId tested** | *(paste from x-customer-id or URL)* |
| **sourceType tested** | e.g. `COGNISM` |
| **batchKey tested** | *(paste from query string)* |
| **Full contacts URL** | *(paste full Request URL from DevTools)* |

---

## Phase 1 — Reproduce with Real Production Call

### 1.1 How to get request details

1. Open production: https://odcrm.bidlow.co.uk
2. Go to **Marketing → Lead Sources**
3. Select a customer, click **View Batches** for a source, then **View contacts**
4. Open DevTools (F12) → **Network** tab
5. Find the request to `.../contacts?batchKey=...`
6. Copy:
   - **Request URL** (full)
   - **Request Headers** → `x-customer-id` value

**ACTION REQUIRED (if Cursor cannot access the browser):**  
Greg, please paste only these two values into this audit (or into chat):

1. The **full contacts request URL** from the Network tab (e.g. `https://odcrm-api-.../api/lead-sources/COGNISM/contacts?batchKey=...&page=1&pageSize=50`)  
2. The **x-customer-id** header value  

No other questions. Once provided, the PowerShell in 1.2 can be run and results pasted into Phase 1 results.

### 1.2 PowerShell production request

Run in PowerShell (replace placeholders with real values from 1.1):

```powershell
$headers = @{ "x-customer-id" = "<CUSTOMER_ID>" }
$r = Invoke-WebRequest -Uri "<FULL_CONTACTS_URL>" -Headers $headers -UseBasicParsing
$j = $r.Content | ConvertFrom-Json
"status=" + $r.StatusCode
"columns.length=" + $j.columns.Count
"columns(first20)=" + (($j.columns | Select-Object -First 20) -join ", ")
$first = $j.contacts | Select-Object -First 1
"row0.keys=" + (($first.PSObject.Properties).Name -join ", ")
```

### 1.3 Response headers to record (after deploy with trace headers)

```powershell
$r.Headers['x-odcrm-leadsource-config-scope']
$r.Headers['x-odcrm-leadsource-spreadsheet-id']
$r.Headers['x-odcrm-leadsource-sheet-gid']
```

### Phase 1 results (paste here after running)

```
status=
columns.length=
columns(first20)=
row0.keys=

x-odcrm-leadsource-config-scope=
x-odcrm-leadsource-spreadsheet-id=
x-odcrm-leadsource-sheet-gid=
```

**Decision Gate A:**

- If **columns.length == 1** → backend still returning one column → Phase 2 (trace backend).
- If **columns.length > 1** → backend OK; if UI still shows one column, fix frontend filtering.

---

## Phase 2 — Backend data path (CSV → parse → cache → response)

*(Backend now sets response headers and DEBUG_LEAD_SOURCES logs; see implementation.)*

- **Resolved config:** Response headers `x-odcrm-leadsource-config-scope` (customer | all_accounts), `x-odcrm-leadsource-spreadsheet-id`, `x-odcrm-leadsource-sheet-gid`.
- **Raw CSV:** When `DEBUG_LEAD_SOURCES=1`, server logs csvUrl, first line (trunc 500), delimiter and counts.
- **Parser output:** When `DEBUG_LEAD_SOURCES=1`, server logs parsedHeaders.length, first 30 headers, first row keys count and list.

---

## Phase 6 — Post-deploy verification

After deploy of `fix(lead-sources): contacts columns proven + config trace`:

1. Re-run the PowerShell from Phase 1.2 with the same (or updated) URL and customer ID.
2. Paste the outputs into **Phase 1 results** above.
3. **Success criteria:**
   - `columns.length >= 5` (or at least > 1)
   - `row0.keys` includes more than `FIRSTNAME`
   - UI shows multiple columns in the contacts table
   - Config scope header matches expectation (customer vs all_accounts)

---

## Phase 7 — Cleanup (after stable)

- **Temporary logs:** All extra logging is behind `DEBUG_LEAD_SOURCES=1`; no removal needed.
- **Response headers** `x-odcrm-leadsource-*` are kept for verification.
- **Dead code:** None removed in this pass.

---

## Changelog

| Date | Change |
|------|--------|
| (today) | Audit file created. Backend: response headers (config-scope, spreadsheet-id, sheet-gid); DEBUG log for resolved config, CSV first line + delimiter, parser output (headers length, first 30, first row keys). Connect: validate ≥2 columns or reject with clear error. GET /: usingGlobalConfig per source. Frontend: LeadSourceConfig.usingGlobalConfig; "Using global config" badge + tooltip. Phase 5: guard confirmed (handleCustomerChange clears view state; empty state when no customer). Committed as *fix(lead-sources): contacts columns proven + config trace*. |
