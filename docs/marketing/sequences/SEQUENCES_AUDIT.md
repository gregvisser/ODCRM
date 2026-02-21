# Sequences module — audit

Audit of Marketing → Sequences UI and `/api/sequences` backend. Focus: tenant boundaries, header usage, and known bugs.

---

## UI entry points

| Entry | Location | Notes |
|-------|----------|--------|
| Marketing → Sequences | `MarketingHomePage.tsx` → `SequencesTab` | Main tab; view = `sequences`. |
| Lead sources → “Create sequence” | `LeadSourcesTab.tsx` / `LeadSourcesTabNew.tsx` | `handleCreateFromSnapshot('sequences', snapshotId)`; navigates to sequences with snapshot context. |
| Dashboard metrics | `OverviewDashboard.tsx`, `MarketingDashboard.tsx` | `sequencesRunning` / `totalSequences` from overview or dashboard APIs. |
| Campaigns (enhanced) | `CampaignsEnhancedTab.tsx` | Loads `/api/sequences?customerId=…` for dropdown; does not create sequences. |

Primary UI: **`src/tabs/marketing/components/SequencesTab.tsx`**.

---

## API endpoints used

| Method | Endpoint | Used by | Tenant source |
|--------|----------|---------|----------------|
| GET | `/api/sequences` | Not called directly by SequencesTab | N/A (sequences list comes from campaigns). |
| GET | `/api/campaigns` | `SequencesTab.loadData()` | **No headers** → falls back to api store (risk: prod-customer-1). |
| GET | `/api/sequences/:id` | Sequence detail, steps load, verify | **No headers** in several call sites → store fallback. |
| POST | `/api/sequences` | Create sequence | `headers: { 'X-Customer-Id': selectedCustomerId }` ✓ |
| PUT | `/api/sequences/:id` | Update metadata | **No headers** in SequencesTab (uses api default). |
| POST | `/api/sequences/:id/steps` | Add step | **No headers**. |
| PUT | `/api/sequences/:id/steps/:stepId` | Update step | **No headers**. |
| DELETE | `/api/sequences/:id/steps/:stepId` | Delete step | **No headers**. |
| GET | `/api/templates` | Form options | `headers: { 'X-Customer-Id': selectedCustomerId }` ✓ |
| GET | `/api/outlook/identities` | Sender dropdown | `headers` ✓ (from same `headers` object). |
| POST | `/api/suppression/check` | Start preview | `headers: { 'X-Customer-Id': selectedCustomerId }` ✓ |

Other: `MarketingDashboard` uses `getCurrentCustomerId('prod-customer-1')` and `/api/sequences?customerId=${customerId}` (query param; backend also accepts header).

---

## Tenant boundary risks

1. **SequencesTab.loadCustomers**  
   On API error or normalize throw: sets `selectedCustomerId` and `customers` to `getCurrentCustomerId('prod-customer-1')` and a synthetic “Default Customer”. Same pattern as Templates before fix: can send invalid customerId.

2. **SequencesTab.loadData()**  
   `api.get('/api/campaigns')` with **no** `X-Customer-Id`. Relies on api layer default (store); if store is prod-customer-1 or wrong customer, list is wrong tenant.

3. **GET /api/sequences/:id**  
   Called without headers in: open editor (steps load), saveSequenceWithSteps (detail), handleConfirmStart (verify). Backend uses `getCustomerId(req)` and scopes by `id` + `customerId`; if header is missing, request fails with 400. If header comes from store, wrong customer could see 404 or wrong data if backend had a bug.

4. **Backend: PUT /api/sequences/:id**  
   **Does not check customerId.** Uses `prisma.emailSequence.update({ where: { id } })` only. Any authenticated user who knows a sequence id could update another customer’s sequence.

5. **Backend: DELETE /api/sequences/:id**  
   **Does not check customerId.** Deletes by `id` only → cross-tenant delete possible.

6. **Backend: POST/PUT/DELETE steps**  
   No verification that the sequence belongs to the requesting customer. Relies on sequence id only.

7. **POST /api/sequences/:id/enroll**  
   Correctly uses `getCustomerId(req)` and verifies sequence belongs to customer.

8. **GET /api/sequences** and **GET /api/sequences/:id**  
   Use `getCustomerId(req)` and scope by `customerId`; tenant-safe.

---

## Current known bugs (from repo + behavior)

- **prod-customer-1 in SequencesTab:** Same as pre-fix Templates: fallback to `getCurrentCustomerId('prod-customer-1')` in loadCustomers (error path and “current” selection). Can set selectedCustomerId to invalid id.
- **Missing X-Customer-Id on campaigns and sequence detail/step calls:** loadData (campaigns), GET sequence detail, PUT sequence, step CRUD — all without explicit headers → store fallback; wrong or invalid tenant possible.
- **Backend PUT/DELETE sequence and step mutations not scoped by customer:** Tenant escape: update/delete by id only.
- **Backend POST /api/sequences:** Logs `customerId` (and other fields) in console — PII/ops concern; should be removed or reduced to presence/validity only.
- **SequencesTab:** Debug logs `[SequencesTab] Creating sequence with payload:` and `Using customer ID:` — remove or guard for dev only.

---

## Data flow (brief)

- Sequences list in UI = campaigns that have `sequenceId` set, from `GET /api/campaigns`. No direct `GET /api/sequences` in SequencesTab.
- Create: POST /api/sequences with body + `X-Customer-Id` (correct).
- Edit: load GET /api/sequences/:id (no header), then PUT/POST/DELETE steps (no headers); PUT /api/sequences/:id for metadata not used in current save flow for steps; backend PUT has no customer check.
- Start campaign: PATCH /api/campaigns, etc.; campaigns route is tenant-scoped.
