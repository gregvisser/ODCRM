# Marketing Tab — Repo Inventory

**Date:** 2026-02-19  
**Purpose:** Phase 1 inventory for making the Marketing tab fully functional by Sunday.

---

## 1. Entry Points

| Type | Location | Details |
|------|----------|---------|
| **Top-level nav** | `src/components/nav/CrmTopTabs.tsx` | Tab id `marketing-home`, label "OpenDoors Marketing", path `/marketing` |
| **Route contract** | `src/contracts/nav.ts` | `CRM_TOP_TABS`, `CRM_CATEGORY_HOME_TAB.marketing` → `marketing-home` |
| **App routing** | `src/App.tsx` | `case 'marketing-home':` renders `<MarketingHomePage view={activeView} onNavigate={...} focusAccountName={...} />` |
| **URL state** | `?tab=marketing-home&view=<viewId>` | Path can be `/marketing`; view in query. Deep links: `inbox`, `reports`, `email-accounts`, `schedules` map to marketing-home + view |
| **Main page** | `src/tabs/marketing/MarketingHomePage.tsx` | Renders `SubNavigation` with 10 items; no subroutes (single SPA view switch) |

### Sub-views (no URL path segments)

All views are `OpenDoorsViewId`: `overview` | `sequences` | `people` | `lists` | `email-accounts` | `templates` | `compliance` | `reports` | `inbox` | `schedules`.  
Rendered by passing `view` into `MarketingHomePage`; content is the corresponding component in `defaultNavItems`.

---

## 2. Files List (grouped)

### Frontend

| File | Role |
|------|------|
| `src/tabs/marketing/MarketingHomePage.tsx` | Container: SubNavigation, tab order from UserPreferences (DB), drag reorder |
| `src/tabs/marketing/types.ts` | Local scaffolding types |
| `src/tabs/marketing/constants.ts` | Local constants |
| `src/tabs/marketing/README.md` | High-level doc |
| `src/tabs/marketing/components/OverviewDashboard.tsx` | Overview: stats, employee performance, recent activity; calls `/api/overview`, `/api/campaigns?limit=3`, `/api/inbox?limit=3` |
| `src/tabs/marketing/components/ReportsTab.tsx` | Reports: customer dropdown + date range; `/api/reports/customers`, `/api/reports/customer?customerId=...&dateRange=...` |
| `src/tabs/marketing/components/PeopleTab.tsx` | People (contacts): list, add/edit/delete; `/api/contacts` |
| `src/tabs/marketing/components/LeadSourcesTab.tsx` | Lead Sources: Google Sheets (Cognism/Apollo/Social); `/api/customers`, `/api/sheets/sources`, connect/sync/lists/preview |
| `src/tabs/marketing/components/ComplianceTab.tsx` | Suppression list: add/delete/import CSV; `/api/suppression` (GET/POST/DELETE, `import-csv`) with `?customerId=` |
| `src/tabs/marketing/components/EmailAccountsTab.tsx` | Email accounts: Outlook identities; `/api/customers`, `/api/outlook/identities`, PATCH/DELETE/test-send |
| `src/tabs/marketing/components/TemplatesTab.tsx` | Templates: CRUD; `/api/customers`, `/api/templates` with `X-Customer-Id` |
| `src/tabs/marketing/components/SequencesTab.tsx` | Sequences (campaigns + steps): full CRUD, start/pause, prospects; `/api/customers`, `/api/campaigns`, `/api/sequences`, `/api/suppression/check`, lists/templates/senders |
| `src/tabs/marketing/components/SchedulesTab.tsx` | Schedules: list campaigns, pause/resume, create/edit schedules; `/api/schedules` (GET, POST, PUT, PATCH, DELETE) |
| `src/tabs/marketing/components/InboxTab.tsx` | Inbox: threads + replies; `/api/customers`, `/api/inbox/threads`, `/api/inbox/threads/:id/messages`, `/api/inbox/threads/:id/reply` |
| `src/tabs/marketing/components/CampaignsTab.tsx` | Campaigns (not in current nav): CRUD campaigns; `/api/campaigns` |
| `src/tabs/marketing/components/ListsTab.tsx` | Lists (not in current nav): CRUD lists + members; `/api/lists` |
| `src/tabs/marketing/components/CognismProspectsTab.tsx` | Cognism prospects (not in nav): uses **`/api/prospects`** — **route does not exist** |

Shared/global:

- `src/utils/api.ts` — All requests send `X-Customer-Id` from `settingsStore.getCurrentCustomerId('prod-customer-1')`
- `src/platform/stores/settings.ts` — `currentCustomerId` in localStorage (UI context only; API uses it for tenant)
- `src/platform/keys.ts` — `marketingLeads`, `marketingLeadsLastRefresh` (legacy; Marketing **Leads** tab is under Customers, not Marketing)
- `src/design-system/components/SubNavigation.tsx` — Reusable nav used by Marketing (and Onboarding, etc.)

### Backend

| File | Role |
|------|------|
| `server/src/index.ts` | Mounts `/api/overview`, `/api/reports`, `/api/campaigns`, `/api/contacts`, `/api/outlook`, `/api/schedules`, `/api/inbox`, `/api/lists`, `/api/sequences`, `/api/templates`, `/api/suppression`, `/api/sheets`, etc. |
| `server/src/routes/overview.ts` | GET `/` — stats (contacts, sequences, emails sent, employee stats); **requires** `x-customer-id` or `customerId` query |
| `server/src/routes/reports.ts` | GET `/customer`, GET `/customers`; `getCustomerId(req)` (header then query) |
| `server/src/routes/campaigns.ts` | POST/GET/PATCH/DELETE campaigns, POST `/:id/templates`, `/:id/prospects`, `/:id/start`, `/:id/pause`, `/:id/complete`; all use `getCustomerId(req)` |
| `server/src/routes/contacts.ts` | GET/POST/PUT/DELETE contacts, bulk-upsert; `getCustomerId(req)` |
| `server/src/routes/outlook.ts` | Auth, callback, GET/POST/PATCH/DELETE identities, test-send; customer from query `customerId` |
| `server/src/routes/templates.ts` | GET/POST/PATCH/DELETE templates, POST preview; `getCustomerId(req)` |
| `server/src/routes/sequences.ts` | Full CRUD sequences + steps, POST enroll; `getCustomerId(req)` |
| `server/src/routes/schedules.ts` | GET list, GET emails, POST pause/resume, GET stats, PUT/POST/DELETE schedule; `getCustomerId(req)` |
| `server/src/routes/inbox.ts` | GET replies, GET threads, GET threads/:id/messages, POST threads/:id/reply; `getCustomerId(req)` |
| `server/src/routes/suppression.ts` | POST check, GET list, POST create, DELETE by id, POST import-csv; `getCustomerId(req)` |
| `server/src/routes/lists.ts` | GET/POST/PUT/DELETE lists, POST/DELETE list contacts; **only** `req.query.customerId` (no `x-customer-id`) |
| `server/src/routes/sheets.ts` | GET sources, POST connect/sync, GET lists/rows/preview; `getCustomerId(req)` |
| **Missing** | **`/api/prospects`** | **Not mounted** — CognismProspectsTab calls PUT/DELETE `/api/prospects` → 404 |

### Database (Prisma)

| Model | Use in Marketing |
|-------|------------------|
| `Customer` | Tenant root |
| `Contact` | People tab; campaign prospects |
| `EmailIdentity` | Email accounts, sequences/campaigns sender |
| `EmailCampaign` | Campaigns / Sequences tab (sequence-style campaigns) |
| `EmailCampaignTemplate` | Campaign steps |
| `EmailCampaignProspect`, `EmailCampaignProspectStep` | Prospects, scheduling, inbox replies |
| `EmailSequence`, `EmailSequenceStep` | Reusable sequences |
| `SequenceEnrollment` | Enrollments |
| `EmailTemplate` | Templates tab |
| `ContactList`, `ContactListMember` | Lists (ListsTab) |
| `EmailEvent` | Reports, overview stats |
| `EmailMessageMetadata` | Inbox threads |
| `SuppressionEntry` | Compliance tab |
| `LeadRecord`, `LeadSyncState` | Leads (sync from sheets; reporting under **Customers** tab) |
| `SheetSourceConfig`, `ContactSourceRow` | Lead Sources (sheets) |

### Workers / cron

- `server/src/workers/emailScheduler.ts` — Sends scheduled campaign emails (scoped by `campaign.customerId`)
- `server/src/workers/campaignSender.ts` — Campaign send (suppression, etc.)
- `server/src/workers/leadsSync.ts` — Lead sync from sheets (customer-scoped)
- Started from `server/src/index.ts` when `ENABLE_EMAIL_SCHEDULER` / etc. are set

---

## 3. Current Behavior (click-path)

1. **Open Marketing**  
   User clicks "OpenDoors Marketing" in top nav → `activeTab = 'marketing-home'`, `activeView` from URL or default → `MarketingHomePage` renders with `SubNavigation`; first item is Overview (or saved order).

2. **Overview**  
   `OverviewDashboard` mounts → `api.get('/api/overview')` (with global X-Customer-Id) → backend returns contacts count, active sequences, emails sent today, employee stats. Then `api.get('/api/campaigns?limit=3')`, `api.get('/api/inbox?limit=3')` for recent activity. Loading/error states present. Quick action buttons (Create Sequence, etc.) are non-functional (no navigation).

3. **Reports**  
   Loads `/api/reports/customers` → dropdown. On customer + date change → `/api/reports/customer?customerId=...&dateRange=...`. **Issue:** Backend `getCustomerId(req)` uses **header first**; if dropdown selection is not synced to `settingsStore`, report can show the wrong customer.

4. **People**  
   `api.get('/api/contacts')` (header = current customer). List, add/edit/delete; loading/error handled.

5. **Lead Sources**  
   Loads customers, then `/api/sheets/sources` (header). Connect/sync/lists/preview per source. Customer selector syncs to `settingsStore`; sources are customer-scoped in DB.

6. **Suppression List (Compliance)**  
   Customer selector; GET/POST/DELETE suppression, POST import-csv with `?customerId=` in URL. Backend also accepts header.

7. **Email Accounts**  
   Customers list, then Outlook identities for selected customer. PATCH/DELETE/test-send; auth flow uses `customerId` in query.

8. **Templates**  
   Customers list; with `selectedCustomerId`, GET/POST/PATCH/DELETE `/api/templates` with `X-Customer-Id` override. CRUD and loading/error present.

9. **Sequences**  
   Loads customers, campaigns, templates, lists, senders (all with header or explicit customer). Create/edit sequence (campaign + steps), attach prospects, start/pause; suppression check before start. Full flow wired; uses campaigns API as “sequence” campaigns.

10. **Schedules**  
    GET `/api/schedules` (header) → list of sequence-based campaigns; pause/resume; create/edit schedule (PUT/POST). Some schedule create payload may expect body shape that backend expects (needs verification).

11. **Inbox**  
    Customers → threads (GET `/api/inbox/threads`) and replies. Select thread → messages; reply POST. Customer context: if dropdown updates `settingsStore`, header is correct; else same header issue as Reports.

**Not in current nav:** CampaignsTab, ListsTab, CognismProspectsTab. CampaignsTab and ListsTab are implemented but not linked. CognismProspectsTab calls non-existent `/api/prospects` (404).

---

## 4. Missing Pieces / Bugs (ranked by impact)

### Critical

1. **CognismProspectsTab → 404**  
   Uses PUT `/api/prospects/:id`, DELETE `/api/prospects/:id`. No `/api/prospects` route. **Fix:** Either add customer-scoped prospects API (e.g. alias to contacts or a dedicated prospect resource) or remove/replace the tab and update CampaignWizard that references “Marketing → Cognism Prospects”.

2. **Lists API tenant from query only**  
   `server/src/routes/lists.ts` uses only `req.query.customerId`. Other routes use `getCustomerId(req)` (header or query). **Fix:** Use same `getCustomerId(req)` helper so X-Customer-Id works and tenant is consistent.

3. **Reports / Inbox customer dropdown vs header**  
   Backend prefers `x-customer-id` over `customerId` query. If UI shows a “Select customer” dropdown but does not set `settingsStore.setCurrentCustomerId(selectedCustomerId)` before calling the API, the report/inbox data can be for the wrong tenant. **Fix:** Either sync dropdown to `settingsStore` before requests or add a backend rule for these endpoints to prefer query when present (or always pass header override from UI with selected id).

### High

4. **Overview / campaigns / inbox calls without explicit customer**  
   Overview and recent activity use global header only. If user never picked a customer, `prod-customer-1` fallback may show wrong data. **Fix:** Ensure Marketing always has a valid customer context (e.g. from first customer or explicit selector) and document fallback.

5. **ListsTab not in nav**  
   README and flows mention “Lists”. ListsTab exists but is not in `MarketingHomePage` defaultNavItems. **Fix:** Add “Lists” to nav (or confirm “Lead Sources” is the intended list/source UI and rename docs).

6. **CampaignsTab not in nav**  
   “Sequences” tab doubles as campaign create/start; CampaignsTab is redundant in current nav. **Fix:** Either add Campaigns as a nav item for a dedicated campaign list view or keep single “Sequences” entry and treat CampaignsTab as optional/future.

### Medium

7. **Schedules POST body / validation**  
   SchedulesTab sends `editingSchedule` to POST/PUT. Confirm backend schemas and that `customerId` is not required in body (should come from header).

8. **Empty states**  
   Some tabs may not show an explicit “No data yet” message (e.g. empty templates, empty sequences). **Fix:** Add empty state copy and primary action where appropriate.

9. **Marketing Leads data location**  
   `MarketingLeadsTab` (under **Customers** → leads-reporting) still uses `odcrm_marketing_leads` / `marketingLeadsLastRefresh` in localStorage for some data; DB has `LeadRecord` and leads API. **Fix:** Out of scope for “Marketing tab” but document; migration to DB-first for leads is separate.

### Low

10. **Feature gating / permissions**  
    No explicit feature flags or role checks for Marketing sub-views. If needed, add in line with rest of app.

11. **Environment / config**  
    Sheets, Outlook, and send limits use env (e.g. `DATABASE_URL`, Outlook client, scheduler flags). No Marketing-specific env called out for “tracking domain” or UTM; add to env.example if new tracking is added.

---

## 5. Summary Table

| Area | Status | Notes |
|------|--------|------|
| Nav & routing | OK | marketing-home + view; deep links work |
| Overview | OK | API + loading/error; quick actions not wired |
| Reports | Bug | Customer dropdown can be ignored (header wins) |
| People | OK | Contacts API, tenant from header |
| Lead Sources | OK | Sheets API, customer-scoped |
| Compliance | OK | Suppression API, query + header |
| Email Accounts | OK | Outlook identities, customer in query |
| Templates | OK | CRUD, customer in header |
| Sequences | OK | Campaigns + sequences APIs |
| Schedules | Verify | Payload/validation for create/update |
| Inbox | Bug | Same customer/header sync as Reports |
| Lists API | Bug | Does not use x-customer-id |
| CampaignsTab | Not in nav | Implemented, not linked |
| ListsTab | Not in nav | Implemented, not linked |
| CognismProspectsTab | Broken | /api/prospects 404 |

---

*End of MARKETING_TAB_INVENTORY.md*
