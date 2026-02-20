# Email Accounts – Full System Audit

**Date:** 2026-02-20  
**Scope:** Email Accounts as a universal feature across Marketing, Onboarding, and Progress Tracker.  
**Rules:** DB as single source of truth; tenant isolation via `x-customer-id`; additive-only migrations; no destructive changes.

---

## 1. Feature Map

### 1.1 Marketing → Email Accounts

| Area | Location | Purpose |
|------|----------|---------|
| **Route / entry** | Marketing home → subnav "Email Accounts" (`view === 'email-accounts'`) | `MarketingHomePage.tsx` renders `EmailAccountsTab` |
| **Component** | `src/tabs/marketing/components/EmailAccountsTab.tsx` | List view, connect Outlook, edit/delete identities, test send |
| **State** | React `useState`: identities, customers, selectedCustomerId, loading, error, editingIdentity | No React Query; no shared store |
| **Customer selection** | Dropdown from `/api/customers`; initial from `getCurrentCustomerId('prod-customer-1')` | **Issue:** List fetch uses global `X-Customer-Id` (from `api.ts`), not necessarily the tab’s `selectedCustomerId` |
| **Connect** | `handleConnectOutlook`: redirect to `${VITE_API_URL}/api/outlook/auth?customerId=${selectedCustomerId}` | OAuth uses selected customer |
| **List fetch** | `api.get('/api/outlook/identities')` — no `customerId` in URL | Backend uses `getCustomerId(req)` → body / `x-customer-id` / `customerId` query. Frontend relies on default header from `api.ts` (`settingsStore.getCurrentCustomerId`) |
| **Other components** | `EmailAccountsEnhancedTab.tsx` (used in Onboarding and optionally elsewhere) | Same backend; accepts `customerId` prop and passes it in query |

### 1.2 Onboarding → Emails tab

| Area | Location | Purpose |
|------|----------|---------|
| **Route** | Onboarding → Customer Onboarding → "Emails" section (no separate tab; section in form) | `CustomerOnboardingTab.tsx` |
| **Component** | Embedded `EmailAccountsEnhancedTab` with `customerId={customerId}` (onboarding customer) | Same linked-accounts UX as Marketing |
| **Data source** | `GET /api/outlook/identities?customerId=${customerId}` | Explicit customerId in URL; tenant-correct |
| **Connect** | Same OAuth flow with `returnTo` for post-connect redirect | `emailConnected=1` etc. in URL; toast + `fetchIdentities()` |

**Separate data (not the same as linked identities):**  
`accountDetails.emailAccounts` (JSON array, up to 5 slots) is stored in `Customer.accountData.accountDetails.emailAccounts`. It is:

- Edited in **AccountsTab** → Account Details → "Email accounts (slots)" (comma-separated).
- Saved in **CustomerOnboardingTab** as part of the big onboarding save (`emailAccounts`, `emailAccountsSetUp`).
- **Not** synced with `EmailIdentity` table. So there are two concepts: (1) **linked senders** = `EmailIdentity` rows; (2) **slots/labels** = `accountDetails.emailAccounts` (legacy/display).

### 1.3 Onboarding progress tracker (checkbox completion)

| Area | Location | Purpose |
|------|----------|---------|
| **Progress Tracker tab** | `OnboardingHomePage` → "Progress Tracker" → `ProgressTrackerTab.tsx` | Sales / Ops / AM checklists |
| **Data** | `accountData.progressTracker` (sales, ops, am) | Loaded via `GET /api/customers/:id`; saved via `PUT /api/customers/:id/progress-tracker` |
| **“Emails” step** | **Not present.** Steps are: Sales (e.g. Client Agreement, Start Date, Assign AM, …), Ops (e.g. Create/Set Up Emails for Outreach, …), AM (e.g. Send DNC, …). | "Create/Set Up Emails for Outreach" is **manual only** (no auto-tick from linked-account count) |
| **Onboarding progress (other)** | `PUT /api/customers/:id/onboarding-progress` | Steps: `company`, `ownership`, `leadSource`, `documents`, `contacts`, `notes`. **No `emails` step.** |

**Conclusion:** There is currently **no** “Emails” step that automatically becomes complete when 5 email addresses are linked. The requirement (checkbox complete at 5 linked accounts, DB-derived, tenant-safe) is a **gap** to be implemented.

---

## 2. UI Routes, Components, Modals, Tables, Actions

### 2.1 Marketing → Email Accounts

- **Route:** App route to marketing; subnav item `email-accounts` → `EmailAccountsTab`.
- **Components:** `EmailAccountsTab` (list, filters, stats), modal for edit (displayName, dailySendLimit, send window, isActive).
- **Actions:** Connect Outlook (redirect), Edit identity (PATCH), Delete (DELETE → isActive: false), Test send (POST test-send).
- **Tables:** Identity table (email, displayName, provider, status, daily limit, actions).
- **Empty/error:** "No email accounts connected yet", "Failed to load email accounts", "Select a customer first".

### 2.2 Onboarding → Emails

- **Section:** "Email Accounts Section" in `CustomerOnboardingTab` → `<EmailAccountsEnhancedTab customerId={customerId} ... />`.
- **Same actions** as Marketing (connect, disconnect, SMTP add, edit, test) scoped to onboarding `customerId`.
- **Post-OAuth:** URL params `emailConnected=1`, `connectedEmail`, `customerId`; toast and `fetchIdentities()`.

### 2.3 AccountsTab (legacy / account details)

- **Tab:** "Email Accounts" tab in drawer: (1) **Account Details** sub-tab includes "Email accounts (slots)" from `accountDetails.emailAccounts` (editable comma-separated); (2) **Connected Email Accounts** block uses `GET /api/customers/${selectedCustomerId}/email-identities`, refresh, connect (OAuth), disconnect.
- **Two sources:** Slots = JSON; connected list = EmailIdentity (same DB as Marketing/Onboarding).

### 2.4 Progress Tracker

- **Components:** `ProgressTrackerTab` – customer dropdown, Sales/Ops/AM sub-tabs, checkboxes per item.
- **No** dedicated “Emails” checkbox tied to linked-account count.

---

## 3. API Map

| Method | Endpoint | Used by | Request | Response | Tenant |
|--------|----------|---------|---------|----------|--------|
| GET | `/api/customers/:id/email-identities` | AccountsTab (connected list) | — | Array of `{ id, emailAddress, displayName, provider, isActive, dailySendLimit, createdAt }` | `:id` in path; validated (customer exists) |
| GET | `/api/outlook/identities` | EmailAccountsTab, EmailAccountsEnhancedTab, CampaignWizard, SequencesTab, etc. | Query `customerId` or header `x-customer-id` | Array of identities (no tokens); `delegatedReady`, `tokenExpired` | `getCustomerId(req)` |
| POST | `/api/outlook/auth` | All connect flows | Query `customerId`, optional `returnTo` | Redirect to Microsoft | customerId required + validated |
| GET | `/api/outlook/callback` | OAuth redirect | code, state | Redirect to frontend with params | state contains customerId |
| POST | `/api/outlook/identities` | SMTP add | body: customerId, emailAddress, displayName, smtpHost, … | Created identity | getCustomerId(req) |
| PATCH | `/api/outlook/identities/:id` | Edit identity | body: displayName, dailySendLimit, sendWindow*, isActive | Updated identity | **P0:** body passed to Prisma without whitelist; client could send tokens |
| DELETE | `/api/outlook/identities/:id` | Disconnect | — | `{ message: 'Identity disconnected' }` | Sets isActive: false |
| POST | `/api/outlook/identities/:id/test-send` | Test send | body: toEmail | success/error | Token refresh inline if expired |
| PUT | `/api/customers/:id/progress-tracker` | ProgressTrackerTab | body: group, itemKey, checked | { success, progressTracker } | :id in path |
| PUT | `/api/customers/:id/onboarding-progress` | (Optional separate flow) | body: steps: { company, ownership, … } | { success, onboardingProgress } | :id in path |

---

## 4. Data Model Map

- **EmailIdentity (Prisma):**  
  `id`, `customerId`, `emailAddress`, `displayName`, `provider` (outlook | smtp), OAuth fields (`outlookTenantId`, `outlookUserId`, `accessToken`, `refreshToken`, `tokenExpiresAt`), SMTP fields, `dailySendLimit`, send window, `isActive`, timestamps.  
  Unique `(customerId, emailAddress)`.  
  **Tokens:** Stored in DB; not returned by list endpoint (select omits them; response strips refreshToken/tokenExpiresAt after computing delegatedReady/tokenExpired).

- **Customer.accountData:**  
  JSON: `accountDetails.emailAccounts` (array of strings), `progressTracker` (sales/ops/am), `onboardingProgress` (steps: company, ownership, leadSource, documents, contacts, notes), etc.

- **Linkage:** Marketing and Onboarding both read **linked** accounts from `EmailIdentity` (via `/api/outlook/identities` or `/api/customers/:id/email-identities`). The **same** underlying table is used; no second “store” for linked accounts. The **slots** in `accountDetails.emailAccounts` are a separate, non-synced concept.

---

## 5. Tenant Isolation Audit

| Endpoint | Where customerId comes from | Validated? | Cross-tenant risk |
|----------|-----------------------------|------------|-------------------|
| GET `/api/customers/:id/email-identities` | Path `:id` | Yes (customer findUnique) | Low |
| GET `/api/outlook/identities` | `getCustomerId(req)` = body / `x-customer-id` / query `customerId` | No explicit “customer exists” check; Prisma `where: { customerId }` scopes query | Medium: wrong header/query shows wrong data |
| POST `/api/outlook/auth` | query or header | Yes (customer findUnique) | Low |
| Callback | state (decoded) + fallback query/header | Yes (customer findUnique before save) | Low |
| PATCH/DELETE `/api/outlook/identities/:id` | getCustomerId(req) | Yes (findFirst where id + customerId) | Low |
| PUT `/api/customers/:id/progress-tracker` | Path `:id` | Yes (row lock + update by id) | Low |

**Holes:**

1. **Marketing EmailAccountsTab:** Does not send `customerId` in URL; relies on global `X-Customer-Id`. If the tab’s dropdown `selectedCustomerId` is not synced to the global store, the list can be for a different customer than the one shown in the dropdown (and used for Connect).
2. **GET /api/outlook/identities** when `customerId` is missing returns 400; when present from header it is trusted. No server-side check that the authenticated user is allowed to see that customer (application-level auth is out of scope here but noted).

---

## 6. Auth / Graph Audit

- **OAuth:** Initiate `/api/outlook/auth?customerId=...&returnTo=...`. State = base64({ customerId, returnTo }). Scopes: User.Read, Mail.Send, Mail.Read, offline_access. prompt=select_account. Redirect URI from env: dev `http://localhost:3001/api/outlook/callback`; prod by `OAUTH_CALLBACK_MODE` (frontdoor vs backend).
- **Callback:** Code exchange; customerId from state (validated); Graph `/me` for mail/UPN; upsert EmailIdentity (max 5 active per customer for new connects).
- **Token storage:** Access + refresh + tokenExpiresAt in DB. Not sent to frontend (list response strips them).
- **Refresh:** In `outlookEmailService.ts` (e.g. send path) and in test-send handler (inline refresh and DB update). 5‑minute buffer before expiry.
- **Failure cases:** Token exchange failure (redirect URI mismatch, expired code, wrong secret); Graph /me failure; no email from Graph; DB error; 5-identity limit (HTML error page with back link).

---

## 7. Universal Linkage Audit

- **Where each UI reads linked emails from:**
  - **Marketing Email Accounts:** `GET /api/outlook/identities` (header customerId).
  - **Onboarding Emails:** `GET /api/outlook/identities?customerId=...` (same backend, explicit customer).
  - **AccountsTab connected block:** `GET /api/customers/:id/email-identities` (path customerId).
- **Same endpoint/model:** Yes. All use `EmailIdentity` table. `/api/customers/:id/email-identities` and `/api/outlook/identities` both query `prisma.emailIdentity.findMany({ where: { customerId } })` (outlook also filters provider in ['outlook','smtp']). So they are the same underlying data.
- **Duplication / drift:** (1) **accountDetails.emailAccounts** is a different concept (slots/labels), not synced with EmailIdentity. (2) **Marketing tab** can show the wrong customer’s list if global customer and dropdown selection diverge.

---

## 8. Onboarding Completion Audit

- **How progress tracker checkbox is computed today:**  
  Progress Tracker is purely manual (and auto-tick for other actions: agreement, start date, assign AM, added to CRM, lead tracker, DNC). There is **no** “Emails” step and **no** derivation from linked-account count.
- **Where “5 linked emails” should live:** Backend. A single source of truth: count of active (or valid) EmailIdentity rows for the customer. Expose via e.g. `linkedEmailCount` on a customer summary or a small “onboarding status” endpoint.
- **How UI should revalidate:** After connect/disconnect, refetch the endpoint that carries the count (or full customer/progress) and re-render the “Emails” step checkbox. Use query invalidation / refetch when returning from OAuth or after disconnect.

---

## 9. Production Parity Audit

- **Env vars:**  
  MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID (optional), REDIRECT_URI (optional override), FRONTDOOR_URL, BACKEND_BASE_URL, OAUTH_CALLBACK_MODE (frontdoor | backend), NODE_ENV, VITE_API_URL (frontend).
- **Code:** Redirect URI and callback URL are env-driven; no hardcoded localhost in production paths. Worker flags (e.g. email scheduler) do not affect Email Accounts UI or OAuth.
- **Assumptions:** Azure App Service for backend; Static Web App / frontdoor for frontend; same DB for dev and prod (per project setup).

---

## 10. Failure Mode Table

| Symptom | Likely cause | Where to log | How to reproduce |
|---------|--------------|--------------|-------------------|
| Empty list in Marketing Email Accounts | Wrong customer in header vs dropdown; or 400 (no customerId) | Backend: log getCustomerId(req) for GET /identities | Select customer A in global context, open Marketing Email Accounts, select customer B in tab dropdown only; list may still be A’s |
| “Customer ID required” on load | Missing x-customer-id and no query customerId | Backend: 400 response | Call GET /api/outlook/identities with no header/query |
| OAuth redirect 400 / invalid customer | customerId not in state or invalid | Backend: callback log state decode + customer lookup | Tamper state or use expired link |
| Connect then list doesn’t update | Frontend not refetching after redirect | Frontend: EmailAccountsTab doesn’t refetch on focus/return | Complete OAuth; return to tab; list not refreshed if no refetch on mount/visibility |
| Token expired / send fails | Refresh failed (secret, tenant, revoke) | Backend: refresh token response in test-send and outlookEmailService | Let token expire; trigger send or test-send |
| PATCH identity overwrites with junk | req.body passed to Prisma | Backend: PATCH handler | Send PATCH with accessToken/refreshToken in body |

---

## 11. Definition of Done – Email Accounts Readiness for Sequences

- [ ] **Single source of truth:** All UIs show linked accounts from EmailIdentity only (no second store for “connected” list).
- [ ] **Tenant-safe:** Every email-account read/write is scoped by customerId; backend validates customer where applicable; Marketing tab uses selected customer for list fetch (header or query).
- [ ] **No token leakage:** Tokens never in API responses to frontend; PATCH identity uses a whitelist of allowed fields.
- [ ] **Onboarding “Emails” step:** Exists and auto-completes when linked (active) count ≥ 5; count from DB; UI revalidates after connect/disconnect.
- [ ] **accountDetails.emailAccounts:** Decision made: either deprecated in favour of EmailIdentity, or clearly documented as “display slots only” and not used for senders/sequences.
- [ ] **OAuth:** Redirect URI and callback mode correct for production; token refresh tested; 5-identity limit enforced.
- [ ] **Logging:** No credentials in logs; correlation id or request id where helpful; errors logged with minimal PII.

---

## 12. Most Likely Hidden Failure (Top 3 Production-Only)

1. **Token refresh timing:** In production, tokens expire (e.g. 1 hour). If no send or test-send runs before expiry, the first send after expiry triggers refresh. Redirect URI or client-secret mismatch in Azure (e.g. wrong secret, wrong callback URL) causes refresh to fail and sends to fail with “reconnect” until someone re-runs OAuth. **Where to log:** Backend token refresh failure (identity id, “refresh_failed”; never log token). **Reproduce:** Wait for token expiry or set tokenExpiresAt in past; trigger send.
2. **Redirect URI mismatch:** Production uses `OAUTH_CALLBACK_MODE` and either frontdoor or backend URL. If Azure App Registration redirect URIs are not updated to match (e.g. trailing slash, http vs https, wrong host), OAuth callback returns 400 and users cannot connect. **Where to log:** Callback hit with hasCode/hasError and redirect URI used. **Reproduce:** Change redirect URI in code to wrong value; try connect.
3. **Missing or wrong tenant header:** If the Marketing Email Accounts tab (or any consumer) does not send `customerId` (query or x-customer-id), backend returns 400 “Customer ID required” and the list fails to load. If another part of the app sets global `x-customer-id` to a different customer, the tab can show the wrong customer’s identities. **Where to log:** Backend GET /identities: log whether customerId came from query vs header (no PII). **Reproduce:** Clear global customer; open Email Accounts; or select customer A globally and customer B in tab only and compare list.

---

*End of Email Accounts Audit.*
