# AUDIT_FIX_PLAN.md — Prioritized Fix Plan
**Generated:** 2026-02-22  
**Scope:** Post-audit action items. Do NOT implement without reading the relevant audit report first.

---

## Executive Summary

| Priority | Count | Category |
|----------|-------|----------|
| **P0 — Production Blockers** | 4 | Tenant IDOR vulnerabilities |
| **P1 — Correctness Issues** | 6 | Tenant fallback, ts-nocheck, migration drift, smoke test |
| **P2 — Cleanup** | 12 | Dead code, stale config, redundant imports |

**Current production state:** App is functional. No known active exploits. P0 issues are exploitable but require an authenticated user (must have valid Microsoft login for `odcrm.bidlow.co.uk`). Address P0s in next release window.

---

## P0 — Production Blockers

### P0-1: `lists.ts` — IDOR on GET/PUT/DELETE `/:id`

**Risk:** Authenticated user can read/modify/delete any customer's contact list by ID  
**File:** `server/src/routes/lists.ts`  
**Lines:** ~65 (GET), ~130 (POST create uses body customerId, ✅), ~143 (PUT), ~179 (DELETE), ~197 (POST /:id/contacts)

**Fix:** Add `customerId` ownership check to each ID-scoped operation.

```typescript
// Pattern to apply to GET /:id, PUT /:id, DELETE /:id, POST /:id/contacts
import { getCustomerId } from '../utils/auth.js'  // or inline

// GET /:id — change findUnique to findFirst with customerId
const customerId = getCustomerId(req)  // throws 400 if missing
const list = await prisma.contactList.findFirst({
  where: { id, customerId }
})
if (!list) return res.status(404).json({ error: 'List not found' })
```

For DELETE — add `customerId` to where clause:
```typescript
const customerId = getCustomerId(req)
const existing = await prisma.contactList.findFirst({ where: { id, customerId } })
if (!existing) return res.status(404).json({ error: 'List not found' })
await prisma.contactList.delete({ where: { id } })
```

**Verification:**
```bash
# With wrong customerId → 404
curl -H "X-Customer-Id: wrong-id" https://.../api/lists/<known-id>
# Expected: 404

# Without customerId → 400
curl https://.../api/lists/<known-id>
# Expected: 400 "Customer ID required"
```

**Rollback:** Git revert the commit. No DB changes.

---

### P0-2: `contacts.ts` — DELETE `/:id` without ownership check

**Risk:** Authenticated user can delete any contact by ID  
**File:** `server/src/routes/contacts.ts`  
**Lines:** ~126-135

**Fix:**
```typescript
router.delete('/:id', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const contact = await prisma.contact.findFirst({
      where: { id: req.params.id, customerId }
    })
    if (!contact) return res.status(404).json({ error: 'Contact not found' })
    await prisma.contact.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})
```

**Verification:**
```bash
curl -X DELETE -H "X-Customer-Id: wrong-id" https://.../api/contacts/<known-id>
# Expected: 404
```

**Rollback:** Git revert. No DB changes.

---

### P0-3: `leads.ts` — `/aggregations` cross-tenant data leak

**Risk:** Any authenticated user can fetch aggregated lead data for all customers  
**File:** `server/src/routes/leads.ts`  
**Lines:** ~260-330

**Fix (Option A — require customerId OR admin, recommended):**
```typescript
router.get('/aggregations', async (req, res) => {
  const customerId = req.query.customerId as string | undefined
  const isAdmin = process.env.ADMIN_SECRET &&
                  req.headers['x-admin-secret'] === process.env.ADMIN_SECRET

  if (!customerId && !isAdmin) {
    return res.status(400).json({ error: 'customerId required' })
  }
  // Rest of existing logic unchanged
})
```

**Verification:**
```bash
# No customerId, no admin secret → 400
curl https://.../api/leads/aggregations
# Expected: 400

# With admin secret → all customers (admin only)
curl -H "X-Admin-Secret: <secret>" https://.../api/leads/aggregations
# Expected: 200 with all customer data (admin view)
```

**Rollback:** Git revert. No DB changes.

---

### P0-4: `leads.ts` — `/sync/status/all` no auth guard

**Risk:** Returns all customers' names and Google Sheet URLs to any authenticated user  
**File:** `server/src/routes/leads.ts`  
**Lines:** ~1430-1470

**Fix:**
```typescript
router.get('/sync/status/all', async (req, res) => {
  const isAdmin = process.env.ADMIN_SECRET &&
                  req.headers['x-admin-secret'] === process.env.ADMIN_SECRET
  if (!isAdmin) return res.status(403).json({ error: 'Admin access required' })
  // existing logic unchanged
})
```

**Verification:**
```bash
# No admin secret → 403
curl https://.../api/leads/sync/status/all
# Expected: 403

# With admin secret → list of all sync states
curl -H "X-Admin-Secret: <secret>" https://.../api/leads/sync/status/all
# Expected: 200 with sync states
```

**Rollback:** Git revert. No DB changes.

---

## P1 — Correctness Issues

### P1-1: `leads.ts` `// @ts-nocheck` — TypeScript disabled for entire file

**File:** `server/src/routes/leads.ts` line 1  
**Fix:** Remove `// @ts-nocheck`, run `npx tsc --noEmit` in `/server`, fix any resulting errors

**Approach:**
1. Remove the `// @ts-nocheck` comment
2. Run `cd server && npx tsc --noEmit` 
3. Fix each TypeScript error (likely type assertions for Prisma query results)
4. Commit separately from P0 fixes

---

### P1-2: `leads.ts` `/diagnostics` cross-tenant by default

**File:** `server/src/routes/leads.ts` lines ~343-410  
**Fix:** Same admin-secret gate as P0-4, or require customerId explicitly.

```typescript
router.get('/diagnostics', async (req, res) => {
  const customerId = req.query.customerId as string | undefined
  const isAdmin = process.env.ADMIN_SECRET &&
                  req.headers['x-admin-secret'] === process.env.ADMIN_SECRET
  if (!customerId && !isAdmin) {
    return res.status(400).json({ error: 'customerId required' })
  }
  // existing logic unchanged
})
```

---

### P1-3: `getCurrentCustomerId` hardcoded fallback `'prod-customer-1'`

**File:** `src/platform/stores/settings.ts`

**Current:**
```typescript
export function getCurrentCustomerId(fallback = 'prod-customer-1'): string {
  const v = getItem(OdcrmStorageKeys.currentCustomerId)
  if (v && String(v).trim()) return String(v)
  if (fallback) setItem(OdcrmStorageKeys.currentCustomerId, fallback)  // ❌ writes bad value
  return fallback
}
```

**Fix:**
```typescript
export function getCurrentCustomerId(): string | null {
  const v = getItem(OdcrmStorageKeys.currentCustomerId)
  return (v && String(v).trim()) ? String(v).trim() : null
}
```

Update `src/utils/api.ts`:
```typescript
const customerId = getCurrentCustomerId()
// Only set header if we have a real customer ID
if (customerId) headers.set('X-Customer-Id', customerId)
```

**Impact:** If no customer is selected (localStorage empty), API calls omit the header → backend returns 400 → frontend shows error message instead of silently showing empty data.

**Verification:**
1. Open app in private browser (no localStorage)
2. Log in, navigate to Marketing tab
3. Without selecting a customer: should see an error/empty state, NOT data for `prod-customer-1`
4. Select a customer from dropdown: should load correct data

---

### P1-4: Migration drift — `add_workspaces_table` in prod only

**See:** AUDIT_DB_MIGRATIONS.md Issue A

**Required investigation (before any fix):**
```bash
# Check if workspaces table has data
cd server && node -e "
const { PrismaClient } = require('./node_modules/@prisma/client');
const p = new PrismaClient();
p.\$queryRaw\`SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name = 'workspaces' AND table_schema = 'public'\`
  .then(r => { console.log(JSON.stringify(r)); p.\$disconnect(); });
"
```

**Fix options (after investigation):**
- If table is empty and unused: create a local no-op migration that documents it
- If table has data: create a Prisma model for it, add to schema, add local migration

---

### P1-5: Backend smoke test doesn't verify DB

**File:** `.github/workflows/deploy-backend-azure.yml`

**Current:** Smoke test only calls `/api/health` (always returns 200 even if DB is down).

**Fix:** Add a DB-connected check:
```yaml
- name: Smoke test DB connectivity
  run: |
    db_status=$(curl -s -o /tmp/db.json -w "%{http_code}" \
      "${{ env.BACKEND_DEPLOY_URL }}/api/customers?limit=1" \
      -H "X-Customer-Id: smoke-test-nonexistent")
    cat /tmp/db.json
    echo "DB check status: $db_status"
    # 400 = requires valid tenant (DB connected, route working)
    # 500 = DB connection failed
    if [ "$db_status" = "500" ]; then
      echo "FAIL: Backend returned 500 - possible DB connectivity issue"
      exit 1
    fi
    echo "DB connectivity: OK"
```

---

### P1-6: `deploy-backend-azure.yml` baseline migration list is stale

**File:** `.github/workflows/deploy-backend-azure.yml`

The `Baseline existing migrations` step only lists 14 migration names. The migration `20260220140000_add_lead_source_applies_to` and others added after the last workflow update are missing.

**Fix:** Add all current migrations to the baseline list. Also document this as a required step when adding new migrations.

```yaml
# Add to the existing list:
npx prisma migrate resolve --applied "20260218120000_leadrecord_source_owner_occurredAt_externalId" || true
npx prisma migrate resolve --applied "20260219120000_add_lead_source_sheet_config_and_row_seen" || true
npx prisma migrate resolve --applied "20260220140000_add_lead_source_applies_to" || true
```

---

## P2 — Cleanup

### P2-1: Remove 20 dead components from `src/components/`

**Files to delete (confirmed no active imports):**
```
src/components/MarketingSequencesTab.tsx
src/components/MarketingInboxTab.tsx
src/components/MarketingListsTab.tsx
src/components/MarketingEmailTemplatesTab.tsx
src/components/MarketingReportsTab.tsx
src/components/MarketingSchedulesTab.tsx
src/components/MarketingCognismProspectsTab.tsx
src/components/MarketingPeopleTab.tsx
src/components/MarketingDashboard.tsx
src/components/MarketingLeadsTab.tsx
src/components/CampaignsEnhancedTab.tsx
src/components/CampaignSequencesTab.tsx
src/components/EmailCampaignsTab.tsx
src/components/EmailAccountsEnhancedTab.tsx
src/components/EmailSettingsTab.tsx
src/components/DashboardTab.tsx
src/components/CustomersManagementTab.tsx
src/components/ExportImportButtons.tsx
src/components/DataPortability.tsx
src/components/DiagnosticBanner.tsx
```

**Verification:** `npm run build` must succeed after deletions (Vite already tree-shakes these, but confirm no dynamic imports).

---

### P2-2: Remove redundant prisma import in `server/src/index.ts`

**File:** `server/src/index.ts` line 8  
**Fix:** Delete `import './lib/prisma.js'` (the side-effect-only import). The named import on line 7 already loads the module.

---

### P2-3: Remove Vercel CORS exception

**File:** `server/src/index.ts` (~line 190)  
**Fix:** Remove the `if (origin.endsWith('.vercel.app'))` block. App is on Azure SWA, not Vercel.

---

### P2-4: Remove dead env vars from `.env.local`

**File:** `.env.local`  
**Fix:** Remove `VITE_AUTH_ALLOWED_EMAILS` and `VITE_AUTH_ALLOWED_DOMAINS` — never read in code.

---

### P2-5: Remove dead `VITE_AUTH_ALLOWED_EMAILS` from frontend workflow

**File:** `.github/workflows/deploy-frontend-azure-static-web-app.yml`  
**Fix:** Remove the env line that passes `VITE_AUTH_ALLOWED_EMAILS` to the build — not read by code.

---

### P2-6: Move `VITE_API_URL` to GitHub secret

**File:** `.github/workflows/deploy-frontend-azure-static-web-app.yml`  
**Fix:** Change `VITE_API_URL: https://...` to `VITE_API_URL: ${{ secrets.VITE_API_URL }}`, create the secret in GitHub repo settings.

---

### P2-7: Document/deprecate stale `aboutEnrichment` worker

**File:** `server/src/workers/aboutEnrichment.ts`  
**Fix:** Add comment `// DEPRECATED: This worker is never started. See index.ts worker startup section.` OR wire up with `ENABLE_ABOUT_ENRICHMENT` flag.

---

### P2-8: Add bundle code splitting for tab pages

**File:** `vite.config.ts`  
**Fix (optional, not urgent):**
```typescript
// In vite.config.ts build.rollupOptions:
output: {
  manualChunks: {
    'marketing': ['./src/tabs/marketing/MarketingHomePage.tsx'],
    'onboarding': ['./src/tabs/onboarding/OnboardingHomePage.tsx'],
    'customers': ['./src/tabs/customers/CustomersHomePage.tsx'],
  }
}
```
Combined with `React.lazy()` + `Suspense` for each top-level tab import in `App.tsx`. Reduces initial parse time and isolates future TDZ crashes to individual chunks.

---

## Implementation Order

### Sprint 1 (This week — P0s only)
| # | Task | Files | Est |
|---|------|-------|-----|
| 1 | Fix `lists.ts` IDOR (P0-1) | server/src/routes/lists.ts | 30min |
| 2 | Fix `contacts.ts` DELETE (P0-2) | server/src/routes/contacts.ts | 15min |
| 3 | Fix `leads.ts` aggregations (P0-3) | server/src/routes/leads.ts | 15min |
| 4 | Fix `leads.ts` sync/status/all (P0-4) | server/src/routes/leads.ts | 15min |
| — | Deploy + verify all P0 fixes | — | 10min |

**Commit pattern for each P0:**
```
Fix(security): scope <endpoint> to tenant customerId

WHAT CHANGED: Add customerId ownership check to <endpoint>
WHY: IDOR — any authenticated user could <read/delete/etc> another tenant's data
TESTING: Manual test with wrong customerId → 404; no customerId → 400
IMPACT: Non-breaking for correct callers; blocks unauthorized cross-tenant access
```

### Sprint 2 (Next week — P1s)
1. Remove `// @ts-nocheck` from `leads.ts` + fix TS errors
2. Fix `/diagnostics` cross-tenant (P1-2)
3. Fix `getCurrentCustomerId` fallback (P1-3)
4. Update deploy workflow baseline migration list (P1-6)
5. Investigate `workspaces` table in production (P1-4)

### Sprint 3 (Cleanup — P2s)
1. Delete 20 dead components
2. Remove redundant imports / dead env vars / Vercel CORS
3. Consider code splitting (P2-8) if bundle growth continues

---

## Non-Goals (Out of Scope for This Audit)

- No schema migrations for new features
- No dropping DB tables or columns (even stale ones)
- No data migrations (workspaces investigation is read-only initially)
- No frontend refactoring beyond the targeted fixes above
