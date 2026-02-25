# MODE B Reality Check — What Exists RIGHT NOW

**Generated:** 2026-02-25  
**Purpose:** Single source of truth for current state (file paths, routes, nav, tenant behavior). Repo-verified mapping for Navigation Contract and MODE B Stage 0.

---

## A) Current top nav + sub nav

**Canonical nav file:** `src/contracts/nav.ts` — defines `CRM_TOP_TABS`, `CrmTopTabId`, `CRM_CATEGORY_HOME_TAB`.

**Current tabs and labels:**

| Tab id | Label (current) | Path |
|--------|------------------|------|
| dashboards-home | Dashboards | /dashboards |
| customers-home | OpenDoors Customers | /customers |
| marketing-home | OpenDoors Marketing | /marketing |
| onboarding-home | Onboarding | /onboarding |
| settings-home | Settings | /settings |

**Tab → component (file:** `src/App.tsx`): dashboards-home → `<DashboardsHomePage />`; customers-home → `<CustomersHomePage />`; marketing-home → `<MarketingHomePage />`; onboarding-home → `<OnboardingHomePage />`; settings-home → `<SettingsHomePage />`.

**Customers home (tenant list / client management):** `src/tabs/customers/CustomersHomePage.tsx` — sub-views: Accounts, Contacts, Leads (Leads-reporting). Title currently "Customers" (SubNavigation title prop). Client list and CRUD live in `src/components/CustomersManagementTab.tsx` (used from Settings or onboarding flows; see Settings nav).

**Marketing home + subviews:** `src/tabs/marketing/MarketingHomePage.tsx`. Sub-views: Reports, Lead Sources, Suppression List (Compliance), Email Accounts, Templates, Sequences, Schedules, Inbox. Default nav items list: reports, lists (Lead Sources), compliance (Suppression List), email-accounts, templates, sequences, schedules, inbox.

**Client selector (where it lives):** No single global "client switcher" in top nav. Per-tab selectors: (1) Onboarding: `src/tabs/onboarding/components/CustomerSelector.tsx` — dropdown of customers, `selectedCustomerId` / `onCustomerChange`; used in `OnboardingHomePage.tsx`. (2) Marketing sub-tabs (Inbox, Reports, Templates, Sequences, Email Accounts, Lead Sources, etc.) each have their own "Select customer" dropdown setting `selectedCustomerId` and often calling `setCurrentCustomerId`. (3) Settings/customer management: `CustomersManagementTab` for list/create/edit/archive. Active client for API calls comes from localStorage key `currentCustomerId` (see B).

---

## B) Tenant context flow

**Single source of "active customer/client":** localStorage key `currentCustomerId` (legacy key, see `src/platform/keys.ts` L32). Read/write via `src/platform/stores/settings.ts`: `getCurrentCustomerId`, `setCurrentCustomerId`, `clearCurrentCustomerId`. Emits `settingsUpdated` on change.

**localStorage fallbacks (exact file + line):**

- `src/utils/api.ts` L5–9: `getCurrentCustomerId(fallback = 'prod-customer-1')` — if storage empty, writes fallback and returns it. So **silent fallback to `prod-customer-1`** when no client selected.
- `src/utils/api.ts` L49: every `apiRequest` uses `getCurrentCustomerId('prod-customer-1')`; L75–76: sets `X-Customer-Id` from that value when not already in headers.

**How x-customer-id is set:** `src/utils/api.ts` — in `buildRequestInit`, if request headers do not have `X-Customer-Id`, `headers.set('X-Customer-Id', customerId)` where `customerId = getCurrentCustomerId('prod-customer-1')`. Callers can override by passing `headers: { 'X-Customer-Id': id }` (e.g. Templates tab, Inbox tab).

---

## C) Backend route map

**File:** `server/src/index.ts`. Each mounted router and tenant-scoping note:

| Mount path | Router | Tenant-scoped? | How customerId resolved |
|------------|--------|----------------|--------------------------|
| /api/campaigns | campaignRoutes | Yes | x-customer-id header / query (see routes/campaigns.ts) |
| /api/contacts | contactsRoutes | Yes | Header/query in route handlers |
| /api/outlook | outlookRoutes | Yes | Per-handler |
| /api/email | trackingRoutes | Yes | Per-handler |
| /api/schedules | schedulesRoutes | Yes | Per-handler |
| /api/reports | reportsRoutes | Yes | Per-handler |
| /api/inbox | inboxRoutes | Yes | x-customer-id |
| /api/lists | listsRoutes | Yes | Header + row-level scoping |
| /api/sequences | sequencesRoutes | Yes | x-customer-id |
| /api/customers | customersRoutes | Yes | Param :id or list; no tenant from body |
| /api/leads | leadsRoutes | Yes | Per-handler |
| /api/live | liveLeadsRouter | Yes | getCustomerId(req) — header or query |
| /api/lead-sources | leadSourcesRouter | Yes | getCustomerId(req) |
| /api/templates | templatesRoutes | Yes | x-customer-id |
| /api/company-data | companyDataRoutes | Varies | Per-handler |
| /api/admin | adminRoutes | No (admin) | X-Admin-Secret |
| /api/job-sectors | jobSectorsRoutes | No (reference) | — |
| /api/job-roles | jobRolesRoutes | No (reference) | — |
| /api/places | placesRoutes | No (reference) | — |
| /api/uploads | uploadsRoutes | Varies | — |
| /api/suppression | suppressionRoutes | Yes | x-customer-id / query |
| /api/users | usersRoutes | Varies | Per-handler |
| /api/user-preferences | userPreferencesRoutes | Per-user (not tenant) | — |
| /api/sheets | sheetsRoutes | Yes | Per-handler |
| /api/_diag | diagRoutes | No (diag) | X-Admin-Diag-Key |
| /api/overview | overviewRoutes | Yes | x-customer-id |

---

## D) Prisma inventory (major models, CRM/outreach)

**File:** `server/prisma/schema.prisma`. Major models: Customer, Contact, EmailIdentity, EmailCampaign, EmailCampaignTemplate, EmailTemplate, EmailCampaignProspect, EmailCampaignProspectStep, EmailEvent, SuppressionEntry, EmailMessageMetadata, CustomerContact, ContactList, ContactSourceRow, ContactListMember, EmailSequence, EmailSequenceStep, SequenceEnrollment, LeadRecord, LeadSyncState, Workspace, JobSector, JobRole, User, UserPreferences, CustomerAuditEvent, SheetSourceConfig, LeadSourceSheetConfig, LeadSourceRowSeen.

**Drift (migrate status):** Two migrations not applied: `20260220140000_add_lead_source_applies_to`, `20260222120000_add_inbox_read_signature`. Run: `npx prisma migrate status --schema=./prisma/schema.prisma` (exit 1). See Gate 0 in MODE_B_ROADMAP.md.

---

## 1. Repo state (as of run)

- **Branch:** main  
- **Divergence:** Local and origin/main have diverged (15 local commits, 3 remote).  
- **Untracked:** `.github.zip`, `prisma.zip`, `server.zip`, `server/prisma.zip`, `src.zip`, `t Restored DATABASE_URL env for Generate Prisma client step.`  
- **Last 5 commits (local):**  
  - f329e64 test(regression): prevent onboarding unhandled rejections + querystring auth bypass  
  - 040a876 test(regression): guard admin/diag bypass and onboarding completion error handling  
  - 0397080 chore(verification): Phase D checklist + server typecheck fix  
  - 070d770 fix(ui): resolve OnboardingHomePage lint (useCallback deps)  
  - 3dc3892 fix(security): require auth for API mutations  

---

## 2. Server: mounted API routes

**File:** `server/src/index.ts`

All routes are under `/api`. Mount order and prefixes:

| Mount order | Prefix | Notes |
|-------------|--------|--------|
| (before routes) | `/api/__build`, `/api/_build`, `/api/__routes`, `/api/_routes`, `/api/health`, `/api/version`, `/api/routes` | No auth; probes / health |
| 1 | `/api` | `requireAuthForMutations` applied to all /api |
| 2 | `/api/campaigns` | observabilityHeaders + campaignRoutes |
| 3 | `/api/contacts` | contactsRoutes |
| 4 | `/api/outlook` | observabilityHeaders + outlookRoutes |
| 5 | `/api/email` | trackingRoutes |
| 6 | `/api/schedules` | schedulesRoutes |
| 7 | `/api/reports` | reportsRoutes |
| 8 | `/api/inbox` | observabilityHeaders + inboxRoutes |
| 9 | `/api/lists` | listsRoutes |
| 10 | `/api/sequences` | observabilityHeaders + sequencesRoutes |
| 11 | `/api/customers` | customersRoutes (includes /:id/email-identities) |
| 12 | `/api/leads` | leadsRoutes |
| 13 | `/api/live` | liveLeadsRouter |
| 14 | `/api/lead-sources` | leadSourcesRouter |
| 15 | `/api/templates` | observabilityHeaders + templatesRoutes |
| 16 | `/api/company-data` | companyDataRoutes |
| 17 | `/api/admin` | adminRoutes |
| 18 | `/api/job-sectors` | jobSectorsRoutes |
| 19 | `/api/job-roles` | jobRolesRoutes |
| 20 | `/api/places` | placesRoutes |
| 21 | `/api/uploads` | uploadsRoutes |
| 22 | `/api/suppression` | suppressionRoutes |
| 23 | `/api/users` | usersRoutes |
| 24 | `/api/user-preferences` | userPreferencesRoutes |
| 25 | `/api/sheets` | sheetsRoutes |
| 26 | `/api/_diag` | diagRoutes |
| 27 | `/api/overview` | observabilityHeaders + overviewRoutes |

**Auth:** Mutation methods (POST/PUT/PATCH/DELETE) require Bearer JWT via `requireAuthForMutations` except: GET, `gemini-enhance`, `/api/admin`, `/api/_diag`. Admin/diag use header-based auth (X-Admin-Secret, X-Admin-Diag-Key). CORS allows `X-Customer-Id`, `x-customer-id`.

---

## 3. Frontend: top nav and tab home pages

**File:** `src/contracts/nav.ts`

| Tab id | Label | Path (future) | Owner |
|--------|--------|----------------|-------|
| dashboards-home | Dashboards | /dashboards | UI Agent |
| customers-home | OpenDoors Customers | /customers | Customers Agent |
| marketing-home | OpenDoors Marketing | /marketing | Marketing Agent |
| onboarding-home | Onboarding | /onboarding | Onboarding Agent |
| settings-home | Settings | /settings | Settings Agent |

**File:** `src/App.tsx` (switch on `activeTab`)

| Tab id | Component |
|--------|-----------|
| dashboards-home | `<DashboardsHomePage />` |
| customers-home | `<CustomersHomePage view={...} focusAccountName={...} onNavigate={...} />` |
| marketing-home | `<MarketingHomePage view={...} focusAccountName={...} onNavigate={...} />` |
| onboarding-home | `<OnboardingHomePage view={...} onNavigate={...} />` |
| settings-home | `<SettingsHomePage view={...} onNavigate={...} />` |
| default | `<DashboardsHomePage />` |

Sub-views (e.g. accounts, contacts, inbox, reports) are driven by `activeView` and route-like state in App.tsx (e.g. accounts → customers-home/accounts).

---

## 4. Tenant selection and X-Customer-Id behavior

**File:** `src/utils/api.ts`

- `getCurrentCustomerId(fallback = 'prod-customer-1')` is implemented locally in api.ts (to avoid TDZ with marketing chunk). It reads from storage key `OdcrmStorageKeys.currentCustomerId`.
- Every `apiRequest` calls `getCurrentCustomerId('prod-customer-1')` and, if the request headers do not already have `X-Customer-Id`, sets `headers.set('X-Customer-Id', customerId)`.
- So: **tenant for API calls = localStorage `currentCustomerId` with fallback `prod-customer-1`**. Caller can override by passing headers with `X-Customer-Id`.

**File:** `src/platform/stores/settings.ts`

- `getCurrentCustomerId(fallback = 'prod-customer-1')`: reads `OdcrmStorageKeys.currentCustomerId` from storage; if empty and fallback provided, writes fallback and returns it.
- `setCurrentCustomerId(customerId)`: writes to same key and emits `settingsUpdated`.
- `clearCurrentCustomerId()`: removes key and emits.

**File:** `src/platform/keys.ts`

- `OdcrmStorageKeys.currentCustomerId = 'currentCustomerId'` (unprefixed legacy key).

**Implication:** Tenant is chosen from **localStorage** (key `currentCustomerId`) with a **hardcoded default** `prod-customer-1`. DB is source of truth for data, but **which tenant** is selected for the session is UI/storage-driven. No server-side session binding to tenant.

---

## 5. Prisma / migrations

- **Schema:** `server/prisma/schema.prisma` (valid per `npx prisma validate --schema=./prisma/schema.prisma`).
- **Database (from migrate status):** PostgreSQL at `odcrm-postgres.postgres.database.azure.com`, schema `public`.
- **Migrations:** 42 in `prisma/migrations`. **Two not applied:**
  - `20260220140000_add_lead_source_applies_to`
  - `20260222120000_add_inbox_read_signature`
- **Status:** Migration drift. Production/DB may be ahead or behind; must be reconciled before further schema-dependent work.

---

## 6. Startup checks (commands run 2026-02-25)

| Check | Command | Result |
|-------|---------|--------|
| Git status | `cd c:\CodeProjects\Clients\Opensdoors\ODCRM; git status` | Diverged (15 local, 3 remote); untracked zip files + one file |
| Git log | `git log --oneline -10` | Listed above |
| Frontend lint | `npm run lint` | eslint . (started; may have been slow/long) |
| Frontend TypeScript | `npx tsc --noEmit` | Exit 0, no output |
| Prisma validate | `npx prisma validate --schema=./prisma/schema.prisma` | "The schema at prisma\schema.prisma is valid" |
| Prisma migrate status | `npx prisma migrate status --schema=./prisma/schema.prisma` | Exit 1; 2 migrations not applied (see above) |
| Server tsc | `cd server; npx tsc --noEmit` | Run in background (no final exit in captured output) |
| Server build | `cd server; npm run build` | Run in background (tsc; no final exit in captured output) |

---

## 7. Files referenced in this doc

- `server/src/index.ts` — route mounting, auth, CORS
- `server/src/middleware/requireAuth.ts` — requireAuthForMutations, bypass rules
- `src/contracts/nav.ts` — CRM_TOP_TABS, tab ids/paths
- `src/App.tsx` — activeTab → page component mapping
- `src/utils/api.ts` — getCurrentCustomerId, X-Customer-Id header
- `src/platform/stores/settings.ts` — get/set/clear currentCustomerId
- `src/platform/keys.ts` — OdcrmStorageKeys.currentCustomerId
