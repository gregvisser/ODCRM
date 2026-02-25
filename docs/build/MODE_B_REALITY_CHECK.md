# MODE B Reality Check — What Exists RIGHT NOW

**Generated:** 2026-02-25  
**Purpose:** Single source of truth for current state (file paths, routes, nav, tenant behavior). Repo-verified. Every claim backed by file path or quoted snippet.

---

## A) Current top nav (repo truth)

**File:** `src/contracts/nav.ts`

```ts
export const CRM_TOP_TABS: readonly CrmTopTab[] = [
  { id: 'dashboards-home', label: 'Dashboards', ownerAgent: 'UI Agent', path: '/dashboards' },
  { id: 'customers-home', label: 'OpenDoors Clients', ownerAgent: 'Customers Agent', path: '/customers' },
  { id: 'marketing-home', label: 'OpenDoors Marketing', ownerAgent: 'Marketing Agent', path: '/marketing' },
  { id: 'onboarding-home', label: 'Onboarding', ownerAgent: 'Onboarding Agent', path: '/onboarding' },
  { id: 'settings-home', label: 'Settings', ownerAgent: 'Settings Agent', path: '/settings' },
] as const
```

Tab → component: `src/App.tsx` switches on `activeTab`; customers-home → `CustomersHomePage`, marketing-home → `MarketingHomePage`, etc. Sub-views (accounts, contacts, inbox, …) driven by `activeView` / route-like state.

---

## B) Tenant context flow (repo truth)

**Active client getter/store:** `src/platform/stores/settings.ts`

```ts
export function getCurrentCustomerId(): string | null {
  const v = getItem(OdcrmStorageKeys.currentCustomerId)
  if (v && String(v).trim()) return String(v).trim()
  return null
}
export function setCurrentCustomerId(customerId: string): void {
  setItem(OdcrmStorageKeys.currentCustomerId, String(customerId || '').trim())
  emit('settingsUpdated', { currentCustomerId: String(customerId || '').trim() })
}
```

**API header:** `src/utils/api.ts` — local helper `getActiveClientId()` (no fallback), then in `buildRequestInit`:

```ts
// Caller-provided X-Customer-Id wins. Only set from store when we have an active client (no silent fallback).
if (!headers.has('X-Customer-Id') && customerId) headers.set('X-Customer-Id', customerId)
```

So: X-Customer-Id is set only when `getActiveClientId()` returns non-null; no silent default tenant.

**Storage key:** `src/platform/keys.ts` — `OdcrmStorageKeys.currentCustomerId = 'currentCustomerId'`.

**Empty state:** `src/components/NoActiveClientEmptyState.tsx` — "Select a client to continue", CTA "Go to Clients" (dispatches `navigateToAccount`).

---

## C) Backend route map (repo truth)

**File:** `server/src/index.ts`. Mount path → router variable → source file:

| Mount path | Router | Source file |
|------------|--------|-------------|
| /api/campaigns | campaignRoutes | server/src/routes/campaigns.js |
| /api/contacts | contactsRoutes | server/src/routes/contacts.js |
| /api/outlook | outlookRoutes | server/src/routes/outlook.js |
| /api/email | trackingRoutes | server/src/routes/tracking.js |
| /api/schedules | schedulesRoutes | server/src/routes/schedules.js |
| /api/reports | reportsRoutes | server/src/routes/reports.js |
| /api/inbox | inboxRoutes | server/src/routes/inbox.js |
| /api/lists | listsRoutes | server/src/routes/lists.js |
| /api/sequences | sequencesRoutes | server/src/routes/sequences.js |
| /api/customers | customersRoutes | server/src/routes/customers.js |
| /api/leads | leadsRoutes | server/src/routes/leads.js |
| /api/live | liveLeadsRouter | server/src/routes/liveLeads.js |
| /api/lead-sources | leadSourcesRouter | server/src/routes/leadSources.js |
| /api/templates | templatesRoutes | server/src/routes/templates.js |
| /api/company-data | companyDataRoutes | server/src/routes/companyData.js |
| /api/admin | adminRoutes | server/src/routes/admin.js |
| /api/job-sectors | jobSectorsRoutes | server/src/routes/jobSectors.js |
| /api/job-roles | jobRolesRoutes | server/src/routes/jobRoles.js |
| /api/places | placesRoutes | server/src/routes/places.js |
| /api/uploads | uploadsRoutes | server/src/routes/uploads.js |
| /api/suppression | suppressionRoutes | server/src/routes/suppression.js |
| /api/users | usersRoutes | server/src/routes/users.js |
| /api/user-preferences | userPreferencesRoutes | server/src/routes/userPreferences.js |
| /api/sheets | sheetsRoutes | server/src/routes/sheets.js |
| /api/_diag | diagRoutes | server/src/routes/diag.js |
| /api/overview | overviewRoutes | server/src/routes/overview.js |

Probes (before routes): `/api/__build`, `/api/_build`, `/api/__routes`, `/api/_routes`, `/api/health`, `/api/version`; no auth. Rate limiting and CORS in index.ts.

---

## D) Prisma inventory (repo truth)

**File:** `server/prisma/schema.prisma`. Models (from `Select-String -Path "server\prisma\schema.prisma" -Pattern "^model\s"`):

Customer, Contact, EmailIdentity, EmailCampaign, EmailCampaignTemplate, EmailTemplate, EmailCampaignProspect, EmailCampaignProspectStep, EmailEvent, SuppressionEntry, EmailMessageMetadata, CustomerContact, ContactList, ContactSourceRow, ContactListMember, EmailSequence, EmailSequenceStep, SequenceEnrollment, LeadRecord, LeadSyncState, JobSector, JobRole, User, UserPreferences, CustomerAuditEvent, SheetSourceConfig, LeadSourceSheetConfig, LeadSourceRowSeen.

**Migrate status (command:** `cd server; npx prisma migrate status --schema=.\prisma\schema.prisma` **):**

```
40 migrations found in prisma/migrations
Your local migration history and the migrations table from your database are different:
The last common migration is: 20260219120000_add_lead_source_sheet_config_and_row_seen
The migrations have not yet been applied:
  20260220140000_add_lead_source_applies_to
  20260222120000_add_inbox_read_signature
The migrations from the database are not found locally in prisma/migrations:
  20260218120000_add_lead_record_occurred_source_owner_external_id
  20260218180000_add_workspaces_table
```

(Exit code 1.)

---

## E) Remaining UI strings that say "Customer" (should be "Client")

**Command:** `Select-String -Path "src\**\*.tsx","src\**\*.ts" -Pattern "\bCustomer(s)?\b" -AllMatches`

Top 10 hits (file path + line or context):

| # | File | Line / context |
|---|------|----------------|
| 1 | src/components/AccountsTab.tsx | 3734, 4051, 4056, 5550 "Create New Customer (via Onboarding)", 6072, 6118 "Customer ID", 6160, 6248 "Customer name", 7669 "Customer Onboarding", 7832 "Customer Onboarding" |
| 2 | src/tabs/onboarding/components/CustomerSelector.tsx | 98 "Customer created", 154 "Customer created", 175 "Customer", 240 "Customer Name" |
| 3 | src/components/MarketingEmailTemplatesTab.tsx | 55 type Customer, 281 "Customer filter", 304 \<Th>Customer\</Th>, 403 "Customer (optional)" |
| 4 | src/components/ContactsTab.tsx | 186 "Customer", 266 "Customer" |
| 5 | src/tabs/marketing/components/ComplianceTab.tsx | 293 "Customer-scoped DNC" |
| 6 | src/tabs/onboarding/ProgressTrackerTab.tsx | 64 "Ideal Customer Profile", 88 "Customer Onboarding" |
| 7 | src/tabs/marketing/components/EmailAccountsTab.tsx | 88 type Customer, 338 "Customer", 405 "Customer" |
| 8 | src/components/MigrateAccountsPanel.tsx | 5 "Customers page" |
| 9 | src/components/MarketingCognismProspectsTab.tsx | 52 type Customer, 364 "Customer account" |
| 10 | src/components/CampaignsEnhancedTab.tsx | 308 "Customer" (FormLabel) |

(Many other files use "Customer" in types or API names; above focuses on user-visible or prominent strings. Full audit: run the Select-String command above and filter for labels, placeholders, toasts, headings.)

---

## Files referenced in this doc

- `src/contracts/nav.ts` — CRM_TOP_TABS, tab ids/paths
- `src/App.tsx` — activeTab → page component
- `src/utils/api.ts` — getActiveClientId, X-Customer-Id header
- `src/platform/stores/settings.ts` — get/set/clear currentCustomerId
- `src/platform/keys.ts` — OdcrmStorageKeys.currentCustomerId
- `src/components/NoActiveClientEmptyState.tsx` — empty state when no client selected
- `server/src/index.ts` — route mounting, imports from ./routes/*.js
