# Marketing Tab — Quality & Safety Checks

**Purpose:** Tenant isolation audit, performance, security, and manual QA script for the Marketing tab.

---

## 1. Tenant Isolation Audit Checklist

Every Marketing-related API MUST filter by `customerId` from the request (header or query). Use this checklist to verify.

### 1.1 Backend routes — every Prisma read/write

| Route file | Endpoint / action | Where customerId is applied | Pass? |
|------------|-------------------|-----------------------------|--------|
| overview.ts | GET / | All queries: Contact.count(where customerId), groupBy(where customerId), email_sequences join customerId, emailEvent (campaign.customerId), employeeStats (ei.customerId) | ☐ |
| reports.ts | GET /customer | eventCounts where customerId; sequencesCompleted where sequence.customerId; senders from identities where customerId | ☐ |
| reports.ts | GET /customers | List customers (no tenant filter; returns all for dropdown) | ☐ |
| campaigns.ts | All | getCustomerId(req); every findMany/findFirst/update/delete includes customerId | ☐ |
| contacts.ts | All | getCustomerId(req); where customerId on all operations | ☐ |
| templates.ts | All | getCustomerId(req); where customerId; existing.customerId check on update/delete | ☐ |
| sequences.ts | All | getCustomerId(req); where customerId on sequences and steps | ☐ |
| schedules.ts | GET /, GET /emails, GET /:id/stats, POST :id/pause/resume | where campaign.customerId or where id,customerId | ☐ |
| schedules.ts | DELETE /:id | Uses emailSendSchedule (model missing); when fixed, must where customerId | ☐ |
| inbox.ts | All | Replies/threads/messages filtered by senderIdentity.customerId or campaign.customerId | ☐ |
| suppression.ts | All | getCustomerId(req); where customerId on all SuppressionEntry ops | ☐ |
| lists.ts | All | **After PR1:** getCustomerId(req); where customerId; do not trust body.customerId for tenant | ☐ |
| sheets.ts | All | getCustomerId(req); SheetSourceConfig and sync scoped by customerId | ☐ |
| outlook (identities) | All | customerId from query; validate identity belongs to customer | ☐ |

### 1.2 Frontend — no cross-tenant leakage

- [ ] Tabs that show customer-specific data use a single customer context per request (header or explicit header override).
- [ ] Reports and Inbox use the **selected** customer (dropdown) for the request that fetches data, not a stale or different customer.
- [ ] No customer id from URL or state is sent to the API for a different customer than the one in scope (e.g. avoid mixing Customer A in dropdown with Customer B in header).

### 1.3 Workers

- [ ] emailScheduler: uses campaign.customerId for suppression and sends.
- [ ] campaignSender: uses campaign.customerId for suppression and events.
- [ ] leadsSync: customer-scoped by trigger param / job context.

---

## 2. Performance Check

- [ ] **N+1:** No list endpoint should load a large list and then loop to fetch related entities one-by-one. Use Prisma `include` or `select` in the list query (e.g. campaigns with senderIdentity, templates list without body if not needed).
- [ ] **Pagination:** Contacts, templates, campaigns, suppression list, threads: if any single response can exceed ~500 items, add pagination (limit/offset or cursor) and use it in the UI. Current contacts route has `take: 1000`; consider limit + offset for very large tenants.
- [ ] **Indexes:** Prisma schema already has indexes on `customerId` and compound (e.g. `customerId, status`). No new indexes required for Sunday scope.
- [ ] **Overview:** Single overview request; employee stats use raw query — ensure it’s one round-trip per customer.

---

## 3. Security Check

- [ ] **Input validation:** All POST/PUT/PATCH bodies validated with Zod (or equivalent) in campaigns, templates, sequences, contacts, suppression, lists, sheets. No raw body passed to Prisma.
- [ ] **Auth guard parity:** Marketing routes use the same auth middleware as the rest of the app (e.g. no public access to /api/campaigns, /api/contacts). Confirm that unauthenticated requests to Marketing endpoints return 401 if the app enforces auth.
- [ ] **customerId from request only:** Never take customerId from body for tenant scoping; always from header or query (and optionally validated against auth context if you add per-customer permissions later).
- [ ] **Id in path:** For GET/PATCH/DELETE by id, always verify resource belongs to customer (e.g. findFirst({ where: { id, customerId } })).

---

## 4. Manual QA Script (Marketing Tab)

Run these steps before signing off Sunday scope. Use two different customers (A and B) with different data where possible.

### 4.1 Setup

1. [ ] Log in; ensure at least two customers exist and have different data (e.g. different contact counts, templates, or campaigns).
2. [ ] Note current “global” customer (e.g. from header or first tab that shows customer selector).

### 4.2 Navigation and entry

3. [ ] Click **OpenDoors Marketing** in top nav; URL shows `tab=marketing-home` (or path `/marketing`).
4. [ ] Default view loads (Overview or first in saved order); no white screen, no console errors.
5. [ ] Switch through all 10 views (Overview, Reports, People, Lead Sources, Suppression List, Email Accounts, Templates, Sequences, Schedules, Inbox); each loads without crash.

### 4.3 Overview

6. [ ] On Overview, note stats (e.g. total contacts, emails sent today). Change customer (if selector exists) or global customer; refresh or re-open Overview; stats change to match selected customer.
7. [ ] If backend returns 400 (e.g. no customer), error message or prompt is shown (no silent fail).

### 4.4 Reports

8. [ ] Open Reports; select Customer A; choose “This week”; report loads with A’s metrics.
9. [ ] Switch to Customer B; report updates to B’s metrics (not A’s).
10. [ ] Change date range; report refreshes. Check console: no 404/500.

### 4.5 People

11. [ ] Open People; list shows contacts for current customer. Add a contact; it appears in list.
12. [ ] Edit contact; save; change persists. Delete a test contact (or skip if risky).
13. [ ] Switch customer; list shows other customer’s contacts (no overlap). Empty state appears if customer has no contacts.

### 4.6 Lead Sources

14. [ ] Open Lead Sources; sources list loads (or empty). Select customer; if credentials/sheets configured, connect or sync one source; no cross-customer data visible.
15. [ ] Check console for 400 (missing customerId); fix if any.

### 4.7 Compliance (Suppression)

16. [ ] Open Suppression List; add one email or domain; entry appears.
17. [ ] Switch customer; list is different (or empty). Delete test entry. No 404 when deleting with correct customer.

### 4.8 Email Accounts

18. [ ] Open Email Accounts; list of identities for current customer. If possible, test “Test send” or disconnect without breaking other tabs.

### 4.9 Templates

19. [ ] Open Templates; list for current customer. Create a template; edit; duplicate if supported; delete test template. Empty state when 0 templates.

### 4.10 Sequences

20. [ ] Open Sequences; list campaigns/sequences for current customer. Create a sequence (campaign + steps); attach prospects if possible; run suppression check; start then pause (or leave draft). No data from other customer in dropdowns or list.
21. [ ] Empty state when 0 sequences.

### 4.11 Schedules

22. [ ] Open Schedules; list of scheduled/running campaigns for current customer. Pause one; resume. If “Create schedule” / “Edit” / “Delete” exist, either they work or show “Not available” / “Coming soon” without server error.
23. [ ] Empty state when no scheduled campaigns.

### 4.12 Inbox

24. [ ] Open Inbox; select customer; threads (or empty) load for that customer. Select a thread; messages load. If reply is enabled, send a test reply; no 404/500.
25. [ ] Switch customer; threads update to selected customer (no mix-up).

### 4.13 Cross-tenant sanity

26. [ ] With Customer A selected, open People and note one contact email. Switch to Customer B; open People; that contact must not appear in B’s list.
27. [ ] Same idea for Templates or Sequences: create under A, switch to B, confirm not visible under B.

### 4.14 Loading and errors

28. [ ] For at least two tabs, trigger loading (refresh) and confirm spinner or loading state.
29. [ ] Simulate error (e.g. invalid customer id in header, or disconnect network); confirm error message is shown and app does not crash.

### 4.15 Console and network

30. [ ] Leave DevTools open; no uncaught errors in console during the above. All API calls that should include customer context have `X-Customer-Id` or `customerId` in query where expected.

---

## 5. Sign-off

- [ ] Tenant isolation: all checklist items in §1 passed or documented as exception.
- [ ] Performance: no N+1; pagination or limits in place for large lists.
- [ ] Security: validation and auth parity confirmed.
- [ ] Manual QA: all 30 steps run and passed (or exceptions documented).

---

*End of MARKETING_TAB_QA.md*
