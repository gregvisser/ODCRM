# Email Accounts – API Contracts and Types

**Date:** 2026-02-20  
**Purpose:** Canonical types and endpoint contracts for Email Accounts (linked identities) and onboarding.

---

## 1. Canonical Types

### 1.1 Backend (Prisma / server)

```ts
// EmailIdentity – DB model (server). Tokens never exposed in list/get.
interface EmailIdentityRecord {
  id: string
  customerId: string
  emailAddress: string
  displayName: string | null
  provider: 'outlook' | 'smtp'
  // OAuth: outlookTenantId, outlookUserId, accessToken, refreshToken, tokenExpiresAt (server-only)
  // SMTP: smtpHost, smtpPort, smtpUsername, smtpPassword, smtpSecure
  dailySendLimit: number
  sendWindowHoursStart: number
  sendWindowHoursEnd: number
  sendWindowTimeZone: string
  isActive: boolean
  createdAt: string  // ISO
  updatedAt: string  // ISO
}
```

### 1.2 List response (no tokens)

```ts
interface EmailIdentityPublic {
  id: string
  emailAddress: string
  displayName: string | null
  provider: string
  isActive: boolean
  dailySendLimit: number
  sendWindowHoursStart?: number
  sendWindowHoursEnd?: number
  sendWindowTimeZone?: string
  createdAt: string
  delegatedReady?: boolean   // true if Outlook has refresh token
  tokenExpired?: boolean      // true if Outlook token past expiry
  smtpHost?: string | null
  smtpPort?: number | null
  smtpUsername?: string | null
  smtpSecure?: boolean | null
}
```

### 1.3 PATCH body (whitelist – recommended)

```ts
interface EmailIdentityPatch {
  displayName?: string | null
  dailySendLimit?: number
  sendWindowHoursStart?: number
  sendWindowHoursEnd?: number
  sendWindowTimeZone?: string
  isActive?: boolean
}
```

### 1.4 Onboarding / progress

```ts
// Progress tracker (existing)
interface ProgressTrackerResponse {
  sales: Record<string, boolean>
  ops: Record<string, boolean>
  am: Record<string, boolean>
}

// Proposed: customer summary including linked-account count for “Emails” step
interface CustomerOnboardingSummary {
  id: string
  name: string
  accountData?: {
    progressTracker?: ProgressTrackerResponse
    onboardingProgress?: { steps?: Record<string, { complete: boolean }>; percentComplete?: number }
  }
  linkedEmailCount?: number   // proposed: count of active EmailIdentity for this customer
}
```

---

## 2. Endpoint Contracts

### 2.1 GET `/api/customers/:id/email-identities`

- **Purpose:** List connected email identities for a customer (used by AccountsTab).
- **Headers:** Optional `x-customer-id` (ignored for scope; path wins).
- **Response:** `200` → array of `EmailIdentityPublic` (no tokens).  
- **Errors:** `404` customer not found; `500` server error.  
- **Example response:**  
  `[{ "id": "...", "emailAddress": "a@b.com", "displayName": "A", "provider": "outlook", "isActive": true, "dailySendLimit": 150, "createdAt": "..." }]`

### 2.2 GET `/api/outlook/identities`

- **Purpose:** List email identities for the customer implied by request (Marketing, Onboarding, etc.).
- **Query:** `customerId` (optional if header set).
- **Headers:** `x-customer-id` (optional).  
- **Resolution:** `customerId = req.body?.customerId || req.headers['x-customer-id'] || req.query.customerId`. At least one required.
- **Response:** `200` → array of `EmailIdentityPublic` (with `delegatedReady`, `tokenExpired` for Outlook).  
- **Errors:** `400` Customer ID required; `500` server error.

### 2.3 POST `/api/outlook/auth`

- **Query:** `customerId` (required), `returnTo` (optional, internal path).
- **Response:** Redirect to Microsoft OAuth (no JSON).

### 2.4 GET `/api/outlook/callback`

- **Query:** `code`, `state` (and optional error params).
- **Response:** Redirect to frontend URL with query params (e.g. `emailConnected=1`, `connectedEmail`, `customerId`).

### 2.5 PATCH `/api/outlook/identities/:id`

- **Headers:** `x-customer-id` or body/query `customerId`.
- **Body:** Currently **any**; must be restricted to `EmailIdentityPatch` (whitelist) to prevent token overwrite.
- **Response:** `200` → updated identity (server should return only safe fields; no tokens).  
- **Errors:** `400` invalid input; `404` identity not found or wrong customer; `500` server error.

### 2.6 DELETE `/api/outlook/identities/:id`

- **Headers:** `x-customer-id` (or body/query customerId).
- **Response:** `200` → `{ message: 'Identity disconnected' }`.  
- **Errors:** `404` identity not found or wrong customer.

### 2.7 PUT `/api/customers/:id/progress-tracker`

- **Body:** `{ group: 'sales'|'ops'|'am', itemKey: string, checked: boolean }`.
- **Response:** `200` → `{ success: true, progressTracker: ProgressTrackerResponse }`.

### 2.8 Error shape (consistent)

- **JSON:** `{ error: string, code?: string, details?: unknown, requestId?: string }`.
- **Status:** 400 validation/tenant, 404 not found, 401 auth/token, 500 server.

---

## 3. Header Requirements

- **x-customer-id:** Required for all email-identity endpoints that are customer-scoped (GET list, PATCH, DELETE, test-send). Frontend `api.ts` sets it globally from `settingsStore.getCurrentCustomerId()`. When a tab has its own customer selector, it should either set the global customer or pass `customerId` explicitly (e.g. query) and ensure backend uses it.
- **Auth:** Application auth (e.g. Microsoft Entra) is separate; not specified in this contract.

---

## 4. Trace Headers

- Backend does not currently return a standard trace header (e.g. `x-request-id`) on success. Some error responses include `requestId`. Recommendation: add `x-request-id` or `request-id` to all JSON responses for tracing.

---

## 5. Universal Linked Accounts Contract

### 5.1 One canonical read for linked accounts

- **Recommended:** Use a single canonical read for “linked accounts” everywhere:
  - **Option A:** `GET /api/customers/:id/email-identities` only. All UIs (Marketing, Onboarding, AccountsTab) call this with the relevant `customerId`. Same response shape.
  - **Option B:** Keep `GET /api/outlook/identities` but require `customerId` (query or header) and document it as the canonical list; align response shape with `GET /api/customers/:id/email-identities` (e.g. same fields, same naming).

Current state: two endpoints return the same underlying data; `/api/customers/:id/email-identities` does not include `delegatedReady`/`tokenExpired`. Unify either by (1) making one redirect to the other internally, or (2) having one handler and reusing it, and returning the same DTO (including delegatedReady/tokenExpired where applicable).

### 5.2 Count for onboarding completion

- **Option A – Count in response:** Add to a customer summary or to the list response a field `linkedEmailCount` (or `totalCount`) so the frontend can show “5/5” and mark “Emails” step complete without a second request.
- **Option B – Dedicated count endpoint:** `GET /api/customers/:id/email-identities/count` returning `{ count: number }` (or include in customer GET response).
- **Definition of “linked/valid”:** Count = `EmailIdentity` rows for customer where `isActive === true` (and optionally provider in ['outlook','smtp']). Pending/invalid (e.g. token expired) can still count as “linked” unless product decides otherwise; recommendation: count active identities only.

---

*End of Email Accounts Contracts.*
