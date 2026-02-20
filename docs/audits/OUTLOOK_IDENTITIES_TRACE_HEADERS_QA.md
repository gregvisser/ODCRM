# QA: Outlook identities customerId trace headers

**Commit:** `chore(observability): add customerId source/mismatch trace headers for outlook identities`

## What changed

- `GET /api/outlook/identities` now sets response headers for debugging:
  - **x-odcrm-customer-source:** `query` | `header` | `body` (which source was used to resolve `customerId`)
  - **x-odcrm-customer-mismatch:** `true` (only when both query and header were present and differed; query wins)
- When query and header differ, a warning is logged (no customer IDs, no tokens, no emails): `[customerId mismatch] { route, queryPresent, headerPresent }`

## QA steps

1. **Headers appear in Network tab**
   - Open Marketing → Email Accounts, select a customer so the list loads.
   - In DevTools → Network, select the request to `/api/outlook/identities`.
   - In Response Headers, confirm:
     - `x-odcrm-customer-source` is present and is `query` (because the tab sends `?customerId=...`).

2. **Mismatch header when query and header differ**
   - Force a mismatch: e.g. call the API with both `?customerId=<customerA>` and header `x-customer-id: <customerB>` (different IDs).
   - Confirm response header `x-odcrm-customer-mismatch: true` is set.
   - Confirm server logs one warning line with `[customerId mismatch]` and no IDs.
   - Confirm the list returned is for the **query** customer (customerA), not the header.

3. **No mismatch when they match**
   - Call with same customer in query and header (or only one).
   - Confirm `x-odcrm-customer-mismatch` is **not** present (or not set).
   - Confirm `x-odcrm-customer-source` is set as expected (`query` when query present, etc.).
