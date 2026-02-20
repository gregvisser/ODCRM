# Marketing Tab — Sunday Ship Plan (Staged PRs)

**Target:** Ship by Sunday evening. Each PR is shippable and minimal blast radius.

---

## PR 1: Lists API — Tenant from header or query

**Goal:** Make `/api/lists` use the same tenant resolution as other routes (x-customer-id or customerId query). No breaking change if frontend already sends header.

**Files to modify**

- `server/src/routes/lists.ts`

**Tasks**

1. Add a `getCustomerId(req)` helper (same pattern as in `templates.ts` / `reports.ts`): `(req.headers['x-customer-id'] as string) || (req.query.customerId as string)`; throw 400 if missing.
2. Replace every `req.query.customerId` usage with `getCustomerId(req)` for reads.
3. For POST/PUT/DELETE and GET `/:id`, ensure every Prisma call is scoped by `customerId` from `getCustomerId(req)`; for POST, do not trust `customerId` from body — use request context only.
4. Run existing server tests (if any) and manual smoke: from a tab that uses lists (or Postman), call GET `/api/lists` with header `X-Customer-Id` and with query `?customerId=...`; both should return that customer’s lists.

**Tests**

- Manual: GET with header only; GET with query only; POST list (customerId from header); GET list by id for another customer → 404.

**Risks / rollback**

- Low. If something breaks, revert the route file; frontend can continue passing `?customerId=`.

---

## PR 2: Reports & Inbox — Use selected customer

**Goal:** Reports and Inbox tabs show data for the **selected** customer (dropdown), not the global header-only customer.

**Files to modify**

- `server/src/routes/reports.ts` (optional backend change)
- `src/tabs/marketing/components/ReportsTab.tsx`
- `src/tabs/marketing/components/InboxTab.tsx`

**Tasks**

**Option A (recommended): Frontend syncs selection to store**

1. **ReportsTab:** When user changes “Select customer” dropdown, call `settingsStore.setCurrentCustomerId(selectedCustomerId)`. Before `loadReport()`, ensure `selectedCustomerId` is set and optionally call `settingsStore.setCurrentCustomerId(selectedCustomerId)` so the next api.get uses the right header. Then call `api.get(\`/api/reports/customer?customerId=${selectedCustomerId}&dateRange=...\`)`. Backend already accepts query; ensure backend uses query when present (see Option B) so report matches dropdown even if another tab changed the global customer.
2. **InboxTab:** When user changes customer dropdown (if any), call `settingsStore.setCurrentCustomerId(selectedCustomerId)` before loading threads/replies. Ensure all inbox API calls run after that so header is correct.

**Option B (backend): Prefer query for reports**

1. In `server/src/routes/reports.ts`, for GET `/customer` only: if `req.query.customerId` is present, use it; else use header. Then frontend only needs to pass `customerId` in URL; no need to sync store for Reports.

**Tests**

- Manual: Select Customer A in Reports, verify metrics are for A; switch to B, verify metrics for B. Same for Inbox (threads for selected customer).

**Risks / rollback**

- Low. Revert component changes and/or reports route if issues.

---

## PR 3: Overview — Ensure customer context

**Goal:** Overview always has a valid customer (no silent wrong-tenant data when no customer was ever selected).

**Files to modify**

- `src/tabs/marketing/components/OverviewDashboard.tsx`

**Tasks**

1. On mount, if `settingsStore.getCurrentCustomerId()` is the fallback (e.g. `prod-customer-1`) and you have a list of customers from elsewhere, consider not auto-overwriting; or ensure first load uses a known-good customer (e.g. from `/api/customers` first item) and set it once. Document in code that Overview uses global customer context.
2. Ensure loading and error states are shown when `/api/overview` returns 400 (no customerId). Show a short message: “Select a customer in the header” or similar if 400.
3. Optional: add a small customer selector in Overview that calls `settingsStore.setCurrentCustomerId` so user can switch without going to another tab.

**Tests**

- Manual: Open Marketing → Overview with valid customer; then clear customer (if possible) and reload → expect 400 handling or prompt to select customer.

**Risks / rollback**

- Low. Revert OverviewDashboard changes.

---

## PR 4: Empty states and error handling (Marketing tabs)

**Goal:** Every Marketing sub-tab has explicit loading, error, and empty state so “fully functional” includes UX.

**Files to modify**

- `src/tabs/marketing/components/PeopleTab.tsx`
- `src/tabs/marketing/components/TemplatesTab.tsx`
- `src/tabs/marketing/components/ComplianceTab.tsx`
- `src/tabs/marketing/components/SequencesTab.tsx`
- `src/tabs/marketing/components/SchedulesTab.tsx`
- `src/tabs/marketing/components/InboxTab.tsx`
- `src/tabs/marketing/components/ReportsTab.tsx`
- `src/tabs/marketing/components/LeadSourcesTab.tsx`
- `src/tabs/marketing/components/EmailAccountsTab.tsx`

**Tasks**

1. For each tab, ensure: (a) loading spinner or skeleton while fetching; (b) error message (Alert or toast) on API error; (c) when list/table is empty (0 items), show a clear “No X yet” message and a primary action (e.g. “Add contact”, “Create template”) where it makes sense.
2. Prefer existing Chakra patterns (Alert, AlertIcon, Empty State pattern if present in design system).
3. No change to API or backend.

**Tests**

- Manual: For each tab, simulate empty list (e.g. new customer with no data) and verify empty state; simulate error (e.g. wrong customer id or network off) and verify error state.

**Risks / rollback**

- Low. Revert component changes per file.

---

## PR 5: Schedules — Align UI with backend (no EmailSendSchedule)

**Goal:** Schedules tab does not call POST/PUT/PATCH/DELETE that depend on non-existent `EmailSendSchedule` model; list and pause/resume remain working.

**Files to modify**

- `server/src/routes/schedules.ts`
- `src/tabs/marketing/components/SchedulesTab.tsx`

**Tasks**

1. **Backend:** In `server/src/routes/schedules.ts`, for DELETE `/:id`: today it calls `prisma.emailSendSchedule.findFirst` (model does not exist). Either remove DELETE or implement it as “delete campaign” (if business accepts) or return 501 with message “Schedule delete not supported”. For POST and PUT that create/update “schedule” entity, if they exist and use `emailSendSchedule`, return 501 or remove routes so they don’t throw at runtime.
2. **Frontend:** In SchedulesTab, if backend returns 501 or 404 for schedule create/update/delete, show a toast “Not available” and do not crash. Optionally hide “Create schedule” / “Edit schedule” / “Delete schedule” buttons, or keep them but show “Coming soon” when clicked.
3. Ensure GET `/api/schedules` (list) and POST `/:id/pause` and `/:id/resume` are unchanged and working; Schedules tab shows list of campaigns and pause/resume work.

**Tests**

- Manual: Open Schedules, see list; pause/resume a campaign; try create/edit/delete if still visible → no server crash, graceful message.

**Risks / rollback**

- Medium if we remove routes (any client calling them would get 404). Prefer 501 + frontend handling so API surface stays.

---

## PR 6: CognismProspectsTab — Hide or no-op (optional)

**Goal:** Avoid 404 from `/api/prospects`. No new API in Sunday scope.

**Files to modify**

- `src/tabs/marketing/MarketingHomePage.tsx` — only if CognismProspectsTab is in nav (currently it is not).
- `src/components/CampaignWizard.tsx` — copy that says “Import prospects first in Marketing → Cognism Prospects” can stay or be updated to “Import contacts in Marketing → People” or “Import via Lead Sources”.

**Tasks**

1. Confirm CognismProspectsTab is not in `defaultNavItems` (it isn’t). So no nav change.
2. If CampaignWizard is used and links to “Cognism Prospects”, change the copy to point to People or Lead Sources so users don’t open a missing/broken view.
3. Optional: Add a stub GET `/api/prospects` that returns `[]` and 200 (customer-scoped) so any future use of CognismProspectsTab doesn’t 404; document as stub. Otherwise leave as-is and document “CognismProspectsTab not in nav; /api/prospects not implemented”.

**Tests**

- Manual: Open CampaignWizard (if possible), check copy; confirm no Marketing nav item for Cognism Prospects.

**Risks / rollback**

- Low. Copy change only.

---

## Order of merges

1. **PR 1** (Lists API) — no frontend dependency.
2. **PR 2** (Reports/Inbox customer) — improves correctness immediately.
3. **PR 3** (Overview customer context) — quick win.
4. **PR 4** (Empty/error states) — can be split into smaller PRs per tab if preferred.
5. **PR 5** (Schedules) — prevents runtime errors.
6. **PR 6** (CognismProspects copy) — optional, any time.

---

## Testing summary (all PRs)

- **Unit:** None required for these changes unless you add tests for `getCustomerId` in lists.
- **Integration:** Manual smoke: switch customer in each Marketing tab, verify data and tenant.
- **Manual:** Per-PR checks above; full run from MARKETING_TAB_QA.md before Sunday EOD.

---

*End of SUNDAY_SHIP_PLAN.md*
