# AUDIT_ARCHITECTURE_TRUTH.md — What Actually Runs in Production
**Generated:** 2026-02-22

---

## 1. Production Topology

```
Browser (any)
    │
    ▼
Azure Static Web Apps
  odcrm.bidlow.co.uk
  ├── Serves: /dist/** (immutable assets, 1-year cache)
  ├── Serves: /index.html (navigation fallback for SPA)
  └── NO /api/* proxy — frontend calls App Service directly
           │
           │ Direct HTTPS (CORS)
           ▼
Azure App Service (Node 24)
  odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net
  ├── Express 5 + Prisma ORM
  ├── CORS: allows odcrm.bidlow.co.uk + *.vercel.app + localhost (dev)
  └── Connects to: Azure PostgreSQL Flexible Server
           │
           ▼
Azure PostgreSQL Flexible Server
  odcrm-postgres.postgres.database.azure.com
  Database: postgres, Schema: public
```

---

## 2. Authentication Flow (Production)

```
1. User visits odcrm.bidlow.co.uk
2. MSAL (Microsoft OAuth) → loginRedirect to Microsoft identity platform
3. Microsoft returns id_token to configured redirectUri (https://odcrm.bidlow.co.uk)
4. MSAL stores tokens in browser (session storage, not localStorage)
5. AuthGate acquires token silently → calls GET /api/users/me (Bearer token)
6. Backend verifies Entra JWT → checks User table in PostgreSQL
7. If user exists and active → authorized; otherwise → 403 Unauthorized
```

**Auth is DB-authoritative** — no allowlist files, no environment variable email lists in production. `VITE_AUTH_ALLOWED_EMAILS` and `VITE_AUTH_ALLOWED_DOMAINS` in `.env.local` are LOCAL ONLY and are NOT baked into the production build.

---

## 3. Tenant Resolution in Production

**Tenant ID = `currentCustomerId`** stored in `localStorage['currentCustomerId']`.

Every API call includes header `X-Customer-Id: <value from localStorage>` injected in `src/utils/api.ts → getCurrentCustomerId()`.

**Risk:** If localStorage is cleared, `getCurrentCustomerId()` falls back to hardcoded `'prod-customer-1'`, which will cause all API calls to return 404/empty data for an unknown customer ID. The app will appear to work (no crash) but return no data.

**Resolution path:** Customer selection UI (customer dropdown in pages) calls `setCurrentCustomerId()` → writes to localStorage → subsequent API calls pick up the correct ID.

---

## 4. Build-Time Environment Variables (Production)

These are baked into the frontend bundle at GitHub Actions build time:

| Variable | Source | Value |
|----------|--------|-------|
| `VITE_API_URL` | Hardcoded in workflow | `https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net` |
| `VITE_AZURE_CLIENT_ID` | GitHub Secret | `c4fd4112-...` |
| `VITE_AZURE_TENANT_ID` | GitHub Secret | |
| `VITE_AZURE_REDIRECT_URI` | Hardcoded in workflow | `https://odcrm.bidlow.co.uk` |
| `VITE_AUTH_ALLOWED_EMAILS` | GitHub Secret | (not used in AuthGate) |
| `VITE_BUILD_SHA` | `github.sha` | Git commit SHA |
| `VITE_BUILD_TIME` | Date command | UTC timestamp |

**Not set in production build:**
- `VITE_AUTH_ALLOWED_DOMAINS` — declared in `vite-env.d.ts`, in `.env.local`, but never read in AuthGate code. Dead config.

---

## 5. Backend Runtime Environment (Azure App Service)

Variables set in Azure App Service configuration (not in committed files):

| Variable | Used For |
|----------|---------|
| `DATABASE_URL` | Prisma PostgreSQL connection |
| `PORT` | Express listen port |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | CORS allowed origins |
| `MICROSOFT_CLIENT_ID` | Entra JWT verification |
| `MICROSOFT_CLIENT_SECRET` | Entra JWT verification |
| `MICROSOFT_TENANT_ID` | Entra JWT verification |
| `REDIRECT_URI` | OAuth callback |
| `EMAIL_TRACKING_DOMAIN` | Email open/click pixel domain |
| `ENABLE_LEADS_SYNC` | Controls leads sync worker |
| `LEADS_SYNC_CRON` | Cron schedule for leads sync |
| `ENABLE_EMAIL_SCHEDULER` | Controls email scheduler worker |
| `ENABLE_REPLY_DETECTOR` | Controls reply detection worker |
| `ADMIN_SECRET` | Admin route protection |
| `GIT_SHA` | Served in `/api/__build` |

---

## 6. Database Source of Truth Boundaries

| Data Type | Source of Truth | Notes |
|-----------|----------------|-------|
| Customers/Accounts | PostgreSQL `customers` | `accountData` JSON column for rich data |
| Contacts | PostgreSQL `contacts` | |
| Email Identities | PostgreSQL `email_identities` | Includes OAuth tokens (stored in DB) |
| Campaigns | PostgreSQL `email_campaigns` | |
| Sequences | PostgreSQL `email_sequences` | |
| Templates | PostgreSQL `email_templates` | |
| Lists | PostgreSQL `contact_lists` | |
| Users | PostgreSQL `users` | Migrated from localStorage |
| User Preferences | PostgreSQL `user_preferences` | |
| Lead Records | PostgreSQL `lead_records` | Source: Google Sheets (imported) |
| Lead Sync State | PostgreSQL `lead_sync_states` | |
| Lead Source Configs | PostgreSQL `lead_source_sheet_configs` | Sheet metadata only |
| Lead Source Rows | PostgreSQL `lead_source_row_seen` | Fingerprint dedup only |
| Google Sheets data | Google Sheets (external) | Not persisted in DB, fetched live |
| Current Customer ID | `localStorage['currentCustomerId']` | ⚠️ UI state in localStorage |
| UI preferences | PostgreSQL `user_preferences` (DB-backed) | Sync'd via `/api/user-preferences` |
| Header image | `localStorage['odcrm_header_image_data_url']` | UI preference only — acceptable |

---

## 7. Single Bundle Architecture

The frontend builds as a **single JavaScript chunk** (`index-*.js`, ~1.38MB gzipped: 400KB). There is no code splitting or lazy loading. All tabs, all components, and all dependencies load at once.

**Implication:** Any module-level initialization error (TDZ, circular import) in any component will crash the **entire application**, not just the affected tab. This was the root cause of the production TDZ incident in `EmailAccountsTab.tsx` (fixed in commit `60f6695`).

**Risk level:** High. A single bad import in any of the 135 source files can take down the whole app.

---

## 8. Worker Safety Architecture

Workers check `ENABLE_*=true` environment flag before starting. The leads sync worker additionally checks the DB hostname to prevent running against non-Azure databases:

```typescript
const isAzureLike = dbHost.includes('.postgres.database.azure.com') ||
                    dbHost.includes('neon.tech')
if (wantLeadsSync && !isAzureLike) {
  console.warn('Leads sync BLOCKED: non-Azure DB host')
}
```

**Note:** `aboutEnrichment` worker file exists at `server/src/workers/aboutEnrichment.ts` but is **never started** — no `ENABLE_ABOUT_ENRICHMENT` flag in `index.ts`. Dead worker.
