# AUDIT_REPO_MAP.md — ODCRM Repository Map
**Generated:** 2026-02-22  
**Auditor:** Cursor Comprehensive Audit

---

## 1. Repository Root Layout

```
ODCRM/
├── src/                          # Frontend (React + Vite + TS)
├── server/                       # Backend (Node/Express + Prisma)
│   ├── src/
│   │   ├── index.ts              # Express entry point + worker startup
│   │   ├── lib/prisma.ts         # PrismaClient singleton
│   │   ├── routes/               # 22 route files
│   │   ├── services/             # Business logic services
│   │   ├── workers/              # Background cron workers
│   │   └── utils/                # Auth, blob, audit helpers
│   ├── prisma/
│   │   ├── schema.prisma         # Canonical schema (39 migrations applied locally)
│   │   └── migrations/           # 39 migration folders
│   └── scripts/                  # verify-columns.cjs, resolve-sourcemap.cjs
├── .github/workflows/
│   ├── deploy-frontend-azure-static-web-app.yml   # Active
│   ├── deploy-backend-azure.yml                   # Active (path-filtered)
│   ├── resolve-prisma-migration-lock.yml           # Utility
│   └── azure-static-web-apps-happy-sand-0fc981903.yml.disabled  # DEAD
├── staticwebapp.config.json      # Azure SWA routing config (no /api proxy)
├── vite.config.ts                # Vite build config
├── .env.local                    # Local dev env (NOT deployed)
└── server/.env                   # Backend env (NOT deployed - Azure uses App Settings)
```

---

## 2. Frontend Entry Points & Routing

| File | Role |
|------|------|
| `src/main.tsx` | Root render, MSAL provider, ErrorBoundary, DiagPage route (`/__diag`) |
| `src/App.tsx` | Top-level tab routing via URL params (`?tab=...&view=...`) |
| `src/auth/AuthGate.tsx` | MSAL auth + `/api/users/me` DB authorization check |
| `src/auth/msalConfig.ts` | MSAL config from `VITE_AZURE_*` env vars |
| `src/version.ts` | Build SHA/time from `VITE_BUILD_SHA` / `VITE_BUILD_TIME` |

### Top-Level Tabs (CRM_TOP_TABS)
| Tab ID | Home Component | Views |
|--------|---------------|-------|
| `dashboards-home` | `DashboardsHomePage` | (single view) |
| `customers-home` | `CustomersHomePage` | accounts, contacts, reporting |
| `marketing-home` | `MarketingHomePage` | overview, sequences, people, email-accounts, templates, compliance, reports, inbox, schedules |
| `onboarding-home` | `OnboardingHomePage` | overview, customers, progress |
| `sales-home` | `SalesHomePage` | (placeholder) |
| `operations-home` | `OperationsHomePage` | (placeholder) |
| `settings-home` | `SettingsHomePage` | (placeholder) |

### Marketing Tab Components (active)
```
src/tabs/marketing/components/
├── EmailAccountsTab.tsx     — Email identity management
├── SequencesTab.tsx         — Sequence builder + dry-run
├── PeopleTab.tsx            — Contact/prospect management
├── LeadSourcesTabNew.tsx    — Lead sources (Google Sheets)
├── LeadSourcesTab.tsx       — OLD (still in use by MarketingHomePage?)
├── TemplatesTab.tsx         — Email templates
├── ReportsTab.tsx           — Lead reporting
├── InboxTab.tsx             — Reply inbox
├── ComplianceTab.tsx        — Suppression management
├── SchedulesTab.tsx         — Schedule management
├── OverviewDashboard.tsx    — Marketing overview
├── CampaignsTab.tsx         — Email campaigns
└── CognismProspectsTab.tsx  — Prospect tab
```

---

## 3. API Client

**File:** `src/utils/api.ts`

- All requests go to `VITE_API_URL` (App Service direct URL, baked at build time in CI)
- Tenant header `X-Customer-Id` is injected from `getCurrentCustomerId()` which reads `localStorage['currentCustomerId']`
- Handles 304 responses defensively
- No-cache headers on all requests
- Response envelope unwrapper (`unwrapResponsePayload`)

---

## 4. Platform Layer (localStorage abstraction)

```
src/platform/
├── keys.ts         — All localStorage key constants (OdcrmStorageKeys)
├── storage.ts      — getItem/setItem/removeItem wrappers
├── events.ts       — Custom events (settingsUpdated) via BroadcastChannel
├── crossTab.ts     — Cross-tab communication
├── index.ts        — Re-exports
└── stores/
    ├── settings.ts         — getCurrentCustomerId / setCurrentCustomerId
    ├── accounts.ts         — localStorage account store (LEGACY)
    ├── contacts.ts         — localStorage contact store (LEGACY)
    ├── leads.ts            — localStorage leads store (LEGACY)
    ├── emailTemplates.ts   — localStorage templates store (LEGACY)
    ├── campaignWorkflows.ts
    ├── cognismProspects.ts
    ├── headerImage.ts
    ├── leadSourceSelection.ts
    └── users.ts
```

**Key concern:** Multiple platform stores still exist for business-critical entities (accounts, contacts, leads, emailTemplates). These are legacy from the pre-DB era. The active app uses DB-backed API hooks, but these stores still hold localStorage keys, and some components (especially those in `src/components/`) still write to them.

---

## 5. Backend Routes

| Mount Point | File | Description |
|-------------|------|-------------|
| `/api/campaigns` | routes/campaigns.ts | Campaign CRUD + sending |
| `/api/contacts` | routes/contacts.ts | Contact CRUD + bulk-upsert |
| `/api/outlook` | routes/outlook.ts | Outlook OAuth + identity management |
| `/api/email` | routes/tracking.ts | Email open/click tracking |
| `/api/schedules` | routes/schedules.ts | Send schedule management |
| `/api/reports` | routes/reports.ts | Lead reporting |
| `/api/inbox` | routes/inbox.ts | Reply inbox |
| `/api/lists` | routes/lists.ts | Contact list CRUD |
| `/api/sequences` | routes/sequences.ts | Sequence CRUD + dry-run |
| `/api/customers` | routes/customers.ts | Customer/account management |
| `/api/leads` | routes/leads.ts | Lead records + sync |
| `/api/live` | routes/liveLeads.ts | Live leads feed |
| `/api/lead-sources` | routes/leadSources.ts | Lead source sheet configs |
| `/api/templates` | routes/templates.ts | Email templates |
| `/api/company-data` | routes/companyData.ts | Company enrichment |
| `/api/admin` | routes/admin.ts | Admin operations |
| `/api/job-sectors` | routes/jobSectors.ts | Job sector taxonomy |
| `/api/job-roles` | routes/jobRoles.ts | Job role taxonomy |
| `/api/places` | routes/places.ts | Places/location lookup |
| `/api/uploads` | routes/uploads.ts | File uploads (Azure Blob) |
| `/api/suppression` | routes/suppression.ts | Email suppression |
| `/api/users` | routes/users.ts | User management + `/me` |
| `/api/user-preferences` | routes/userPreferences.ts | User UI preferences |
| `/api/sheets` | routes/sheets.ts | Google Sheets integration |
| `/api/_diag` | routes/diag.ts | Internal diagnostics |
| `/api/overview` | routes/overview.ts | Dashboard overview |

### Special Endpoints (no auth)
| Endpoint | Purpose |
|----------|---------|
| `GET /api/__build` | Deploy fingerprint (SHA + time) |
| `GET /api/_build` | Alias |
| `GET /api/health` | Health check |
| `GET /api/version` | Version info |
| `GET /__build.json` | Frontend build fingerprint (served by Vite plugin) |

---

## 6. Background Workers

| Worker | File | Env Flag | Guard |
|--------|------|----------|-------|
| Email Scheduler | `workers/emailScheduler.ts` | `ENABLE_EMAIL_SCHEDULER=true` | Flag only |
| Reply Detection | `workers/replyDetection.ts` | `ENABLE_REPLY_DETECTOR=true` | Flag only |
| Leads Sync | `workers/leadsSync.ts` | `ENABLE_LEADS_SYNC=true` | Flag + Azure DB hostname check |
| About Enrichment | `workers/aboutEnrichment.ts` | No worker mount in index.ts | **NOT STARTED** |

---

## 7. Google Sheets Integration Boundaries

- **Source of truth:** Google Sheets CSV export (not stored persistently in ODCRM DB beyond metadata)
- `LeadSourceRowSeen` — tracks fingerprints of rows seen (email/linkedin/name+company+job) per batch, per customer
- `LeadSourceSheetConfig` — sheet URL/GID metadata per customer per source type
- `SheetSourceConfig` — older model for 3-source (cognism/apollo/blackbook) configs
- `ContactSourceRow` — raw sheet row storage per contact
- Sync worker: `workers/leadsSync.ts` + service `services/leadSourcesBatch.ts`

---

## 8. Prisma Schema Summary

**39 migrations locally, 40 applied in production** (drift — see AUDIT_DB_MIGRATIONS.md)

| Model | Table | Key Relations |
|-------|-------|--------------|
| Customer | customers | contacts, emailCampaigns, emailIdentities, emailSequences, emailTemplates, leadRecords, leadSyncState, suppressionEntries, sheetSourceConfigs, contactSourceRows, leadSourceSheetConfigs, leadSourceRowSeen |
| Contact | contacts | customer, emailCampaignProspects, contactListMembers, sequenceEnrollments, sourceRows |
| EmailIdentity | email_identities | customer, emailCampaignProspects, emailCampaigns, emailMessageMetadata |
| EmailCampaign | email_campaigns | customer, senderIdentity, list, sequence, prospects, templates |
| EmailSequence | email_sequences | customer, senderIdentity, enrollments, campaigns |
| ContactList | contact_lists | customer, members, campaigns |
| LeadRecord | lead_records | customer, convertedContact |
| LeadSyncState | lead_sync_states | customer (1:1) |
| User | users | preferences |
| UserPreferences | user_preferences | user |
| LeadSourceSheetConfig | lead_source_sheet_configs | customer |
| LeadSourceRowSeen | lead_source_row_seen | customer |

---

## 9. CI/CD

| Workflow | Trigger | Deploys |
|----------|---------|---------|
| `deploy-frontend-azure-static-web-app.yml` | push to main, workflow_dispatch | Azure Static Web Apps |
| `deploy-backend-azure.yml` | push to main (path-filtered), workflow_dispatch | Azure App Service |
| `resolve-prisma-migration-lock.yml` | workflow_dispatch | Utility — resolves lock |
| `azure-static-web-apps-happy-sand-0fc981903.yml.disabled` | DISABLED | Dead workflow |

**Production URLs:**
- Frontend: `https://odcrm.bidlow.co.uk`
- Backend: `https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net`
- Frontend → Backend: **Direct call** (VITE_API_URL baked at build time, no SWA proxy)
