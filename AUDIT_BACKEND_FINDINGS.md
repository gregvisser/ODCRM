# AUDIT_BACKEND_FINDINGS.md — Backend Audit
**Generated:** 2026-02-22

---

## Executive Summary

| Category | P0 | P1 | P2 |
|----------|----|----|-----|
| Tenant Safety | 4 | 1 | 0 |
| Error Handling | 0 | 1 | 0 |
| Prisma/DB | 0 | 1 | 2 |
| Code Quality | 0 | 1 | 3 |

---

## 1. Route-by-Route Tenant Safety Audit

### Tenant ID Resolution Pattern

Most routes use a `getCustomerId(req)` helper that checks:
1. `req.headers['x-customer-id']`
2. `req.query.customerId`
3. Throws 400 if neither present

This is **correct** and consistent across most routes. The exceptions are documented below.

---

### CRITICAL Issues (P0) — IDOR / Cross-Tenant Data Leakage

#### Issue 1: `lists.ts` — GET/PUT/DELETE by `:id` without tenant ownership check

**File:** `server/src/routes/lists.ts`  
**Lines:** ~70 (GET), ~143 (PUT), ~179 (DELETE), ~197 (POST /:id/contacts)

```typescript
// GET /api/lists/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params
  const list = await prisma.contactList.findUnique({ where: { id } })
  // ❌ No check: list.customerId === req.headers['x-customer-id']
  if (!list) return res.status(404).json({ error: 'List not found' })
  return res.json(list)  // Returns ANY customer's list if you know the ID
})
```

**Risk:** An authenticated user who knows a list ID (via enumeration or leak) can read, update, or delete a list belonging to any other customer.

**Fix:**
```typescript
router.get('/:id', async (req, res) => {
  const { id } = req.params
  const customerId = getCustomerId(req)  // throws 400 if missing
  const list = await prisma.contactList.findFirst({
    where: { id, customerId }  // ✅ scoped
  })
  if (!list) return res.status(404).json({ error: 'List not found' })
  return res.json(list)
})
// Same pattern for PUT, DELETE, POST /:id/contacts
```

---

#### Issue 2: `contacts.ts` — DELETE by `:id` without ownership check

**File:** `server/src/routes/contacts.ts`  
**Lines:** ~126-135

```typescript
router.delete('/:id', async (req, res, next) => {
  // ❌ No customerId check before delete
  await prisma.contact.delete({ where: { id: req.params.id } })
  res.json({ success: true })
})
```

**Risk:** An authenticated user can delete any contact if they know the contact ID.

**Fix:**
```typescript
router.delete('/:id', async (req, res, next) => {
  const customerId = getCustomerId(req)
  const contact = await prisma.contact.findFirst({
    where: { id: req.params.id, customerId }
  })
  if (!contact) return res.status(404).json({ error: 'Contact not found' })
  await prisma.contact.delete({ where: { id: req.params.id } })
  res.json({ success: true })
})
```

---

#### Issue 3: `leads.ts` — `/aggregations` exposes cross-tenant data

**File:** `server/src/routes/leads.ts`  
**Lines:** ~272-320

```typescript
router.get('/aggregations', async (req, res) => {
  const customerId = req.query.customerId as string | undefined
  const where: any = { customer: { leadsReportingUrl: { not: null } } }
  if (customerId) {
    where.customerId = customerId
  }
  // ❌ If customerId omitted, returns aggregated data for ALL customers
  const leadRecords = await prisma.leadRecord.findMany({ where })
```

**Risk:** Any authenticated user can call `/api/leads/aggregations` without a `customerId` and receive aggregated lead data across **all customers**. This is a direct cross-tenant data leak.

**Note:** This endpoint appears intentional for "global dashboard" (all-accounts view). If that is the intent, it should be behind an explicit admin check (`X-Admin-Secret` header).

**Fix Option A (require tenant or admin):**
```typescript
router.get('/aggregations', async (req, res) => {
  const customerId = req.query.customerId as string | undefined
  const isAdmin = req.headers['x-admin-secret'] === process.env.ADMIN_SECRET
  if (!customerId && !isAdmin) {
    return res.status(400).json({ error: 'customerId required' })
  }
  // ...
})
```

**Fix Option B (always require customerId, remove global view):**
```typescript
const customerId = getCustomerId(req)  // throws 400 if missing
```

---

#### Issue 4: `leads.ts` — `/sync/status/all` has no auth or tenant guard

**File:** `server/src/routes/leads.ts`  
**Lines:** ~1430-1460

```typescript
router.get('/sync/status/all', async (req, res) => {
  // ❌ No customerId check, no admin check
  const syncStates = await prisma.leadSyncState.findMany({
    include: { customer: { select: { id: true, name: true, leadsReportingUrl: true } } },
  })
  // Returns sync state for ALL customers + their names + leadsReportingUrl (Google Sheet URLs)
```

**Risk:** Returns all customers' names, Google Sheet URLs, and sync status to any authenticated user. Serious information disclosure.

**Fix:**
```typescript
router.get('/sync/status/all', async (req, res) => {
  const isAdmin = req.headers['x-admin-secret'] === process.env.ADMIN_SECRET
  if (!isAdmin) return res.status(403).json({ error: 'Admin only' })
  // ...
})
```

---

### Medium Issues (P1)

#### Issue 5: `leads.ts` — `/diagnostics` cross-tenant by default

**File:** `server/src/routes/leads.ts`  
**Lines:** ~343-400

```typescript
router.get('/diagnostics', async (req, res) => {
  const customerId = req.query.customerId as string | undefined
  const syncStates = customerId
    ? await prisma.leadSyncState.findUnique({ where: { customerId } })
    : await prisma.leadSyncState.findMany({ take: 10 })  // all customers

  // Also queries ALL leads unconditionally:
  const leadCounts = await prisma.leadRecord.groupBy({ by: ['customerId', 'accountName'], _count: { id: true } })
  const totalLeads = await prisma.leadRecord.count()  // global count
```

**Risk:** Returns global lead counts and sync states for all customers when no `customerId` supplied. Lower severity than aggregations as it's a diagnostic endpoint, but should still be admin-gated.

**Fix:** Gate behind `ADMIN_SECRET` check, same pattern as Issue 4 fix.

---

## 2. Prisma Usage Audit

### `$queryRaw` Usage (10 instances in `customers.ts`)

**File:** `server/src/routes/customers.ts`  
**Lines:** 1002, 1233, 1334, 2087, 2165, 2524, 2649, 2821, 3217, 3579

All instances follow this pattern:
```typescript
await tx.$queryRaw`SELECT "id" FROM "customers" WHERE "id" = ${id} FOR UPDATE`
```

**Assessment:** ✅ **Justified and safe.**
- Tagged template literals (not string concatenation) — Prisma parameterizes all values
- Purpose: PostgreSQL row-level locks (`SELECT FOR UPDATE`) to prevent concurrent writes to the same customer record
- No equivalent Prisma API for `SELECT FOR UPDATE` — raw SQL is the only option
- All instances pass `id` from validated/typed route params, not raw user input

### PrismaClient Singleton

**File:** `server/src/lib/prisma.ts`

```typescript
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ ... })
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

**Assessment:** ⚠️ **Minor issue.** In production (`NODE_ENV=production`), `globalForPrisma.prisma` is NOT set, so the singleton pattern only works in development. However, since `prisma.ts` is a module, Node.js module caching means it is only evaluated once per process, so in practice a single `PrismaClient` instance is created. This is fine for the App Service deployment model (single process).

**But note:** There is a redundant import in `server/src/index.ts`:
```typescript
import { prisma } from './lib/prisma.js'  // used
import './lib/prisma.js'                  // ❌ redundant side-effect import
```

**Fix:** Remove the redundant `import './lib/prisma.js'` line (line 8 of index.ts).

### Prisma Middleware (lib/prisma.ts)

The Prisma middleware strips `id` from `EmailCampaign` create operations. This is unusual — it means client-supplied IDs for email campaigns are silently discarded. This prevents duplicate-ID issues but should be documented as intentional behavior.

**Assessment:** P2 — add a comment explaining why this is needed.

---

## 3. Worker Audit

| Worker | Flag | Guard | Risk |
|--------|------|-------|------|
| `emailScheduler` | `ENABLE_EMAIL_SCHEDULER=true` | Flag only | If enabled accidentally, will start sending emails |
| `replyDetection` | `ENABLE_REPLY_DETECTOR=true` | Flag only | Safe (read-only Outlook poll) |
| `leadsSync` | `ENABLE_LEADS_SYNC=true` | Flag + Azure hostname check | ✅ Good — prevents running against non-prod DB |
| `aboutEnrichment` | N/A | **Never started** | Dead worker — file exists but no startup code |

**Issue:** `server/src/workers/aboutEnrichment.ts` exists but is never imported or started in `index.ts`. It is either dead code or a feature that was removed mid-implementation.

---

## 4. CORS Configuration

**File:** `server/src/index.ts`

```typescript
if (origin.endsWith('.vercel.app')) {
  return callback(null, true)  // ⚠️ Allow ALL Vercel previews
}
```

**Risk (P2):** This allows any `*.vercel.app` domain to make credentialed requests to the API. While unlikely to be exploited in practice (attacker would need a valid user token), it's unnecessary — the app is hosted on Azure SWA, not Vercel.

**Fix:** Remove the Vercel preview exception or scope it to a specific project prefix.

---

## 5. Error Handling Assessment

**Pattern used across routes:**
```typescript
} catch (error) {
  console.error('Error in X:', error)
  res.status(500).json({ error: 'Failed to ...' })
}
```

✅ All routes have try-catch. No unhandled promise rejections found in route code.

⚠️ **`leads.ts` has `// @ts-nocheck` at the top** — the entire file bypasses TypeScript type checking. This is a P1 code quality issue because:
- Type errors in this file will not be caught at build time
- Runtime errors are more likely

**Fix:** Remove `// @ts-nocheck` and resolve any TypeScript errors that surface.

---

## 6. Route Mounting Issues

### Double Prisma Import (P2)
`server/src/index.ts` lines 7-8:
```typescript
import { prisma } from './lib/prisma.js'  // named import (used by workers)
import './lib/prisma.js'                  // ❌ side-effect only, redundant
```
The side-effect import is harmless (module is cached) but clutters the code.

### No Route Conflict Found
No duplicate route mounting detected. All 22 route files are mounted at unique prefixes.

### `/api/routes` in Production (P2)
```typescript
app.get('/api/routes', (req, res) => {
  const isDebug = process.env.DEBUG === 'true' || process.env.NODE_ENV !== 'production'
  if (!isDebug) return res.status(403).json({ error: 'Debug endpoint not available in production' })
```
✅ Correctly gated. Returns 403 in production.

---

## 7. Complete Findings Table

| Route | Severity | Finding | Evidence (file:line) | Fix Summary |
|-------|----------|---------|---------------------|-------------|
| `lists.ts` GET/PUT/DELETE `/:id` | **P0** | No customerId ownership check — IDOR | lists.ts:70, 143, 179, 197 | Add `findFirst({ where: { id, customerId } })` before each operation |
| `contacts.ts` DELETE `/:id` | **P0** | No ownership check before delete | contacts.ts:126 | findFirst to verify ownership before delete |
| `leads.ts` GET `/aggregations` | **P0** | Optional customerId → cross-tenant data leak | leads.ts:272 | Require customerId or admin secret |
| `leads.ts` GET `/sync/status/all` | **P0** | No auth/tenant guard, returns all customers' data | leads.ts:1430 | Gate behind ADMIN_SECRET check |
| `leads.ts` GET `/diagnostics` | **P1** | Optional customerId → cross-tenant diagnostics | leads.ts:343 | Gate behind ADMIN_SECRET or require customerId |
| `server/src/index.ts` | **P2** | Redundant `import './lib/prisma.js'` | index.ts:8 | Remove redundant import |
| `server/src/routes/leads.ts` | **P1** | `// @ts-nocheck` disables type safety | leads.ts:1 | Remove and fix TypeScript errors |
| CORS config | **P2** | `*.vercel.app` wildcard allowed | index.ts:~190 | Remove Vercel exception |
| `workers/aboutEnrichment.ts` | **P2** | Dead worker — file exists, never started | aboutEnrichment.ts | Document as deprecated or wire up |
| Prisma middleware | **P2** | Strips `id` from EmailCampaign writes silently | lib/prisma.ts:~25 | Add comment explaining intent |

---

## 8. Verification Steps for P0 Fixes

After fixing `lists.ts`:
```bash
# Attempt to access a list with wrong customerId header → must return 404
curl -H "X-Customer-Id: wrong-customer" \
  https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net/api/lists/<any-known-id>
# Expected: {"error":"List not found"}

# Attempt without customerId → must return 400
curl https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net/api/lists/<id>
# Expected: {"error":"Customer ID required"} 400
```

After fixing `contacts.ts` DELETE:
```bash
# Delete contact with wrong customerId → must return 404
curl -X DELETE -H "X-Customer-Id: wrong-customer" \
  .../api/contacts/<known-id>
# Expected: {"error":"Contact not found"} 404
```

After fixing `leads.ts` aggregations:
```bash
# No customerId → must return 400 (or require admin secret)
curl https://...backend.../api/leads/aggregations
# Expected: {"error":"customerId required"} 400
```
