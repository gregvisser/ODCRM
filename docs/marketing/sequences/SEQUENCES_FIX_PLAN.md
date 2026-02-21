# Sequences module — fix plan

Strict priority order. Each item: files to touch, acceptance criteria, minimal QA steps. No risky refactors; additive and tenant-safe only.

---

## 1. Backend: Scope PUT /api/sequences/:id by customerId (P0)

- **File:** `server/src/routes/sequences.ts`
- **Change:** Before update, `findFirst` where `id` + `customerId` (from `getCustomerId(req)`). If not found → 404. Then `update` where `id` only (sequence already verified).
- **Acceptance:** Request with valid id but wrong/missing X-Customer-Id returns 404. Same customer returns 200.
- **QA:** From UI, edit sequence name → 200. With DevTools, replay PUT with another customer’s id and correct header for that customer → 404 when using other customer’s id with your customerId.

---

## 2. Backend: Scope DELETE /api/sequences/:id by customerId (P0)

- **File:** `server/src/routes/sequences.ts`
- **Change:** Resolve `customerId = getCustomerId(req)`. Find sequence by id + customerId; if not found → 404. Then delete by id.
- **Acceptance:** Delete with wrong customer returns 404. Same customer returns 200.
- **QA:** Delete sequence from UI → 200. Replay DELETE with other customer’s sequence id → 404.

---

## 3. Backend: Scope step mutations by sequence’s customerId (P0)

- **File:** `server/src/routes/sequences.ts`
- **Change:** For POST /:id/steps, PUT /:id/steps/:stepId, DELETE /:id/steps/:stepId: get customerId from request; load sequence by id (include customerId in where or verify after). If sequence not found or sequence.customerId !== customerId → 404. Then perform step op.
- **Acceptance:** Step create/update/delete for another customer’s sequence id returns 404.
- **QA:** Add/edit/delete step in UI → success. Replay with other customer’s sequence id → 404.

---

## 4. SequencesTab: Remove prod-customer-1; use only real cust_* from API (P0)

- **File:** `src/tabs/marketing/components/SequencesTab.tsx`
- **Change:** Mirror TemplatesTab fix. loadCustomers: on error or catch, set `customers = []`, `selectedCustomerId = ''`. On success, set selectedCustomerId from `settingsStore.getCurrentCustomerId('')` only if that id exists in customer list; else first list item; else `''`. Never set synthetic “Default Customer” with prod-customer-1.
- **Acceptance:** No prod-customer-1 in dropdown or in request headers. Empty state when customers fail to load.
- **QA:** Select customer → create sequence → Request Headers show X-Customer-Id: cust_….

---

## 5. SequencesTab: Send X-Customer-Id on all sequence/campaign calls (P0)

- **File:** `src/tabs/marketing/components/SequencesTab.tsx`
- **Change:** Ensure every `api.get|post|put|patch|delete` for `/api/sequences`, `/api/campaigns` (when used by this tab) includes `headers: { 'X-Customer-Id': selectedCustomerId }` when selectedCustomerId is set. Add guard: if no selectedCustomerId or !selectedCustomerId.startsWith('cust_'), do not call APIs that require tenant (or show empty/error state).
- **Acceptance:** All sequence and campaign requests from SequencesTab include X-Customer-Id: cust_… when a customer is selected.
- **QA:** DevTools Network: load tab, open sequence, edit steps, save, delete step → all requests show X-Customer-Id.

---

## 6. Backend: Validate customerId on POST /api/sequences (P1)

- **File:** `server/src/routes/sequences.ts`
- **Change:** After `getCustomerId(req)`, `prisma.customer.findUnique({ where: { id: customerId } })`. If !customer → 400 “Invalid customer context” (same as templates). No logging of customerId value.
- **Acceptance:** POST with non-existent customerId returns 400; no FK violation.
- **QA:** Replay POST with fake customerId → 400.

---

## 7. Backend: Remove or reduce PII in sequence logs (P1)

- **File:** `server/src/routes/sequences.ts`
- **Change:** Remove or replace `console.log('[sequences] POST / - Create sequence request:', { customerId: req.headers['x-customer-id'], ... })` and `Validated payload:` with customerId. Log only presence/validity (e.g. customerId_present=true) or remove.
- **Acceptance:** No customerId or template content in logs.
- **QA:** Create sequence → check server logs.

---

## 8. SequencesTab: Remove debug logs (P2)

- **File:** `src/tabs/marketing/components/SequencesTab.tsx`
- **Change:** Remove or guard with `import.meta.env.DEV` the logs: `[SequencesTab] Creating sequence with payload:`, `Using customer ID:`, `Create sequence failed:`.
- **Acceptance:** No noisy logs in production.
- **QA:** Create sequence → console clean.

---

## 9. Optional: GET /api/campaigns from SequencesTab with header (P1)

- **File:** `src/tabs/marketing/components/SequencesTab.tsx`
- **Change:** loadData: when calling `api.get('/api/campaigns')`, pass `headers: { 'X-Customer-Id': selectedCustomerId }` when selectedCustomerId is set. If no customer selected, may return empty list or skip load (align with UX).
- **Acceptance:** Campaigns list is for selected customer only.
- **QA:** Switch customer → list updates; Request Headers show X-Customer-Id.

---

## 10. Optional: Guard “Start” / enrollment by selectedCustomerId (P2)

- **File:** `src/tabs/marketing/components/SequencesTab.tsx`
- **Change:** Before starting campaign or calling enroll, ensure selectedCustomerId is set and starts with `cust_`; else toast and return.
- **Acceptance:** Cannot start without valid tenant context.
- **QA:** Clear customer (if possible) and try Start → blocked with message.

---

Implementation order recommended: 1 → 2 → 3 (backend tenant scoping), then 4 → 5 (frontend header + no prod-customer-1), then 6–8, then 9–10 if desired.
