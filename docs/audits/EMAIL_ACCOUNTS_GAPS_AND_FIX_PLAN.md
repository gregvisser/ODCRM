# Email Accounts – Gaps and Incremental Fix Plan

**Date:** 2026-02-20  
**Scope:** Safe, incremental fixes for tenant safety, universal linkage, and onboarding completion. No major refactors unless requested.

---

## 1. Issues Ranked by Risk

### P0 (Critical – security / data integrity)

| ID | Issue | Location | Fix |
|----|--------|----------|-----|
| P0-1 | **PATCH `/api/outlook/identities/:id`** passes `req.body` directly to Prisma; client could send `accessToken`/`refreshToken` and overwrite or leak. | `server/src/routes/outlook.ts` | Whitelist allowed fields (displayName, dailySendLimit, sendWindow*, isActive) and pass only those to `update`. |

### P1 (High – correctness / tenant / product)

| ID | Issue | Location | Fix |
|----|--------|----------|-----|
| P1-1 | **Marketing Email Accounts tab** list fetch uses global `X-Customer-Id`; dropdown `selectedCustomerId` may not match, so list can be for wrong customer. | `src/tabs/marketing/components/EmailAccountsTab.tsx` | When fetching identities, pass selected customer explicitly: e.g. send `customerId` in query or set global customer when dropdown changes; prefer query `?customerId=${selectedCustomerId}` so backend uses it. |
| P1-2 | **No “Emails” step** that auto-completes at 5 linked accounts. Progress Tracker has no DB-derived completion for emails. | Backend + frontend | Add backend-derived completion (e.g. linkedEmailCount ≥ 5) and a visible “Emails” step (progress tracker or onboarding progress) that reads from DB; revalidate after connect/disconnect. |
| P1-3 | **Onboarding Emails list** should reflect same linked accounts as Marketing. | Already true for **linked** list (both use EmailIdentity). Optional: clarify or remove duplicate **slots** (`accountDetails.emailAccounts`) to avoid confusion. | Confirm UX: onboarding “Email Accounts” section is already the same (EmailAccountsEnhancedTab). Document that slots are display-only; no code change required unless product wants to deprecate slots. |

### P2 (Medium – consistency / ops)

| ID | Issue | Location | Fix |
|----|--------|----------|-----|
| P2-1 | Two list endpoints return same data with slight shape differences (`/api/customers/:id/email-identities` vs `/api/outlook/identities`); no `delegatedReady`/`tokenExpired` on the first. | Both endpoints | Unify response shape or have one delegate to the other; add delegatedReady/tokenExpired to customer-scoped endpoint if needed by UI. |
| P2-2 | No `x-request-id` (or similar) on success responses for tracing. | Server responses | Add optional trace header to JSON responses. |
| P2-3 | GET `/api/outlook/identities` does not validate that customer exists before querying (only Prisma scope). | `server/src/routes/outlook.ts` | Optional: `findUnique` customer first; return 404 if not found. |

---

## 2. Minimal Safe Fix Steps (Incremental, PR-sized)

### Step 1 – P0: Whitelist PATCH identity (single small PR) ✅ IMPLEMENTED

- **File:** `server/src/routes/outlook.ts` (PATCH `/identities/:id`).
- **Change:** Build update payload from whitelist only, e.g.  
  `const { displayName, dailySendLimit, sendWindowHoursStart, sendWindowHoursEnd, sendWindowTimeZone, isActive } = req.body || {}`  
  then `data: { displayName, dailySendLimit, sendWindowHoursStart, sendWindowHoursEnd, sendWindowTimeZone, isActive }.filter(v => v !== undefined)` (or use a schema). Do **not** pass `req.body` or `...req.body` into Prisma.
- **Implemented (2026-02-20):** Added `PATCH_IDENTITY_WHITELIST` and build `data` by copying only whitelisted keys from `req.body`; pass `data` to `prisma.emailIdentity.update`. Request body is no longer passed through to Prisma.
- **Verification:** (1) Unit or integration test: PATCH with `accessToken: 'x'` in body → DB identity accessToken unchanged. (2) Manual: Edit an identity (display name, limit) and confirm it still works.
- **Rollback:** Revert commit; no migration.

### Step 2 – P1-1: Marketing tab uses selected customer for list

- **File:** `src/tabs/marketing/components/EmailAccountsTab.tsx`.
- **Change:** In `loadIdentities`, call `api.get(\`/api/outlook/identities?customerId=${selectedCustomerId}\`)` when `selectedCustomerId` is set; otherwise skip or use global. Ensure `loadIdentities` is called when `selectedCustomerId` changes (already in useEffect). Optionally also set global current customer when user changes dropdown so other API calls stay consistent.
- **Verification:** Select customer A, open Email Accounts, see A’s list; switch dropdown to B, see B’s list. Connect for B and confirm new identity appears for B.
- **Rollback:** Revert commit.

### Step 3 – P1-2: Onboarding “Emails” step completes at 5 linked accounts (DB truth) ✅ IMPLEMENTED (PR2)

- **Backend:**  
  - Add a way to expose **linked email count** for a customer (e.g. include in `GET /api/customers/:id` response under `accountData` or a new field `linkedEmailCount`, or add `GET /api/customers/:id/email-identities/count`).  
  - Count = active EmailIdentity for that customer (provider in ['outlook','smtp'] if desired).  
  - Add or reuse an “Emails” completion rule: either (a) a new step in `onboardingProgress` (e.g. `emails`) and backend sets `complete: true` when count ≥ 5, or (b) a new item in `progressTracker` (e.g. ops or am) that is auto-ticked when count ≥ 5. Prefer one place; recommend extending **progressTracker** with an auto-tick rule in `progressAutoTick.ts` (e.g. when `linkedEmailCount >= 5` set a specific key true), and ensure this runs on every customer save or on a dedicated “recompute progress” path (e.g. after connect/disconnect).  
- **Frontend:**  
  - Progress Tracker (or onboarding overview) shows an “Emails” step; its checked state comes from backend (progressTracker or onboardingProgress).  
  - After connect/disconnect, invalidate/refetch customer or progress so the checkbox updates (e.g. refetch on return from OAuth, and after disconnect in same tab).
- **Verification:**  
  - Link 5 accounts for a customer; open Progress Tracker (or wherever “Emails” step lives); step is complete.  
  - Disconnect one; step becomes incomplete.  
  - No way to set “Emails” complete client-side without 5 in DB.
- **Rollback:** Feature-flag or revert; no destructive migration.

### Step 4 (optional) – P2: Unify list response / add count

- **Backend:** Either (1) have `GET /api/customers/:id/email-identities` call the same logic as `/api/outlook/identities` and return same shape (with delegatedReady/tokenExpired), or (2) add `linkedEmailCount` to customer GET or add `GET /api/customers/:id/email-identities/count`.
- **Frontend:** Use single endpoint everywhere if desired; use count for “5/5” and for completion rule.
- **Verification:** Both endpoints return same list for same customer; count matches list length.

---

## 3. Verification Steps (per fix)

| Step | Commands / manual QA | Expected |
|------|----------------------|----------|
| P0 whitelist | (1) Send PATCH with body `{ accessToken: "x", displayName: "Test" }`. (2) Read identity from DB or via GET. | (1) 200. (2) displayName updated; accessToken unchanged. |
| P1-1 Marketing customer | Select customer A → Email Accounts → list shows A’s identities. Change to B → list shows B’s. Connect as B → new identity appears for B. | List always matches selected customer. |
| P1-2 Emails step | Backend: GET customer or count endpoint shows linkedEmailCount. Link 5 → count 5; Progress (or onboarding) shows Emails complete. Disconnect 1 → count 4; Emails incomplete. | Completion only when count ≥ 5 from DB; UI updates after connect/disconnect. |
| P2 count/unify | GET list and GET count for same customer. | Count equals list length; response shapes consistent. |

---

## 4. Rollback Strategy

- **P0:** Revert PATCH handler to previous version; redeploy. No DB change.
- **P1-1:** Revert frontend; list again uses global customer only.
- **P1-2:** Revert backend (no count / no auto-tick) and frontend (no Emails step or always manual); or leave backend additive and hide “Emails” step in UI.
- **P2:** Revert endpoint or response changes; frontend may need to support old shape briefly.

---

## 5. Logging Plan

- **Never log:** accessToken, refreshToken, smtpPassword, or any credential.
- **Do log (structured):** customerId (id only), identity id, action (connect, disconnect, patch, test-send), success/failure, HTTP status, requestId/correlationId. On token refresh failure: log identity id and “refresh_failed”, not token value.
- **Optional:** Log linkedEmailCount on customer fetch for debugging (no PII).

---

## 6. Specific Fix: Onboarding Email List = Marketing Linked Accounts

- **Current state:** Onboarding “Email Accounts” section is already the same as Marketing: it embeds `EmailAccountsEnhancedTab` and fetches `GET /api/outlook/identities?customerId=${customerId}`. So the **linked** list is the same. The only duplication is **accountDetails.emailAccounts** (slots) in Account Details / onboarding save, which is a separate field (display/labels), not the linked senders.
- **Action:** No code change required for “same list.” Optional: (1) Document in UI or docs that “Email Accounts” = linked senders (OAuth/SMTP), and “Email slots” in Account Details = optional labels. (2) If product wants one source of truth for display, consider syncing slots from linked identities (e.g. on save, set accountDetails.emailAccounts from EmailIdentity.emailAddress for that customer) in a later iteration; for this audit, no change.

---

## 7. Specific Fix: Onboarding Progress Checkbox at 5 Linked Accounts (DB Truth)

- **Requirement:** “Emails” step checkbox becomes complete when **5 email addresses** are linked to the customer; completion from DB; updates after connect/disconnect; tenant-safe; not spoofable client-side.

**Proposed flow:**

1. **Backend**
   - **Count:** In `GET /api/customers/:id` (or a small summary endpoint), include `linkedEmailCount` = count of EmailIdentity where customerId = id and isActive = true (and optionally provider in ['outlook','smtp']). Alternatively expose `GET /api/customers/:id/email-identities/count` returning `{ count }`.
   - **Auto-tick:** In `progressAutoTick.ts`, add a rule: if `linkedEmailCount >= 5`, set an “emails” item to true (e.g. a new key under `progressTracker.ops` like `ops_emails_linked` or reuse “Create/Set Up Emails” if product agrees). Apply this in the same place other auto-ticks run (e.g. when saving customer or when recomputing progress). Pass `linkedEmailCount` into `applyAutoTicksToAccountData` (e.g. from a pre-fetched count or from a small query inside the service).
   - **When to recompute:** (a) After OAuth callback (after upserting identity), call progress auto-tick for that customer and save; (b) After DELETE identity (disconnect), same; (c) Optionally on GET customer (lazy recompute) or via a dedicated “refresh progress” call. Prefer (a)+(b) so checkbox updates immediately after connect/disconnect.

2. **Frontend**
   - **Display:** Progress Tracker (or onboarding overview) shows an “Emails” step: “5 email accounts linked” or “Emails (5/5)”. Checked when backend says so (progressTracker.ops.ops_emails_linked or equivalent).
   - **Revalidate:** After connect: on return from OAuth (e.g. URL param `emailConnected=1`), refetch customer or progress-tracker for current customer so new count and checkbox state load. After disconnect: on success of DELETE, refetch customer or progress. Use existing patterns (e.g. `emit('customerUpdated')`, or refetch in EmailAccountsEnhancedTab and parent refetches progress).

**Edge cases:**

- **Disconnect drops below 5:** Auto-tick sets the item to true only when count ≥ 5; it does not set to false. So when count goes to 4, the **manual** checkbox can be unchecked by user, or you can introduce “auto-uncheck” when count < 5 (product decision). Recommendation: allow manual unchecked; auto-tick only sets true when ≥ 5.
- **Pending/invalid accounts:** Count “active” only (isActive === true). Token-expired but still active identities still count; product can later exclude them if desired.
- **Duplicate addresses:** DB has unique (customerId, emailAddress); no duplicate rows.
- **Shared mailbox:** Current model is one identity per (customerId, emailAddress); shared mailbox would be a single row; no change needed unless product adds shared-mailbox-specific logic.

---

## 8. How We Guarantee Onboarding Checkbox Ticks at 5 Linked Emails

- **Proposed endpoint/data flow:**  
  (1) Backend exposes `linkedEmailCount` (e.g. on GET customer or GET …/email-identities/count).  
  (2) Progress auto-tick service sets an “Emails” completion flag (e.g. in progressTracker) when `linkedEmailCount >= 5`.  
  (3) Auto-tick runs after OAuth callback (connect) and after disconnect (DELETE identity), and optionally on customer fetch.  
  (4) Frontend reads completion from backend (progressTracker or onboardingProgress) and does not set it client-side.

- **Revalidation after connect/disconnect:**  
  After OAuth return: URL has `emailConnected=1`; onboarding or Marketing tab refetches customer or progress-tracker for the current customer. After disconnect: on successful DELETE, same refetch (or event + refetch). Progress Tracker and any “Emails” step UI then show the updated checkbox.

- **Edge cases:** See Section 7 (disconnect below 5, pending/invalid, duplicates, shared mailbox).

---

## 9. PR2 Implemented (2026-02-20) – Emails step at 5 linked

**Final approach (computed on read):**

- **Backend:** `GET /api/customers/:id` now includes `linkedEmailCount` (count of EmailIdentity where customerId = id, isActive = true, provider in ['outlook','smtp']). Inactive identities do not count.
- **Frontend:** Progress Tracker has a new Ops item **"Emails (5 linked)"** (`ops_emails_linked`). It is **read-only** (checkbox disabled); checked when `linkedEmailCount >= 5` from the same GET customer response. No value is persisted in progressTracker for this step; it is derived on each load.
- **Revalidation:** After OAuth connect, SMTP create, or identity disconnect, the app emits `customerUpdated` with the customer id. ProgressTrackerTab subscribes and refetches that customer when selected, so the Emails checkbox updates without full refresh. Onboarding and Marketing both emit after connect/disconnect.
- **Edge case (disconnect below 5):** Because the step is derived on read, when count drops to 4 the next refetch shows it unchecked; no backend “auto-uncheck” needed.

---

*End of Gaps and Fix Plan.*
