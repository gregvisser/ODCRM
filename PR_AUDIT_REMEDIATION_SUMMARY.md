# PR: Audit Remediation P0 — Branch `audit-remediation-p0`

**Date:** 2026-02-22  
**Branch:** `audit-remediation-p0`  
**Target:** `main`  
**Author:** audit-remediation sprint (automated + manual review)  
**Build status:** ✅ Frontend build pass | ✅ Backend build pass | ✅ `tsc --noEmit` pass (0 errors)

---

## Commit Table (newest first)

| SHA | Type | Summary |
|---|---|---|
| `88294a9` | Chore | Remove accidental `_commit_msg.txt` + add to `.gitignore` |
| `0497081` | Chore | Remove Marketing Overview and People tabs (UI only) |
| `02556f9` | Docs | Add `VERIFY_AUDIT_REMEDIATION.md` with smoke test commands |
| `15c32b4` | Docs | Comprehensive audit reports (6 markdown files) |
| `7870c51` | Fix(P1) | Remove `prod-customer-1` fallback write-back from `getCurrentCustomerId` |
| `5d85586` | Docs | Migration drift report and safe reconciliation plan |
| `eb1b9e3` | Chore | Strengthen backend post-deploy smoke probes (`_build` + health + DB) |
| `6e2a367` | Fix(P0) | Lock leads aggregations to tenant (no cross-tenant access) |
| `007750b` | Fix(P0) | Prevent IDOR in contact lists routes and contact delete |

**Divergence from `main`:** 0 commits ahead on main / 9 commits ahead on branch (clean fork point).

---

## Changes by Area

### 🔴 P0 Security — Backend Route IDOR / Tenant Leaks

#### `server/src/routes/lists.ts` (commit `007750b`)
- Added `getCustomerId` helper: resolves `x-customer-id` header (falls back to `req.query.customerId`); throws HTTP 400 if absent.
- `GET /:id` — changed `findUnique({ where: { id } })` → `findFirst({ where: { id, customerId } })`. Returns 404 if not owned by tenant.
- `PUT /:id` — added ownership check before update. Returns 404 if not owned.
- `DELETE /:id` — added ownership check before delete. Returns 404 if not owned.
- `POST /:id/contacts` — verifies list ownership AND validates all `contactIds` belong to same tenant. Returns 400 on foreign contacts.
- `DELETE /:id/contacts/:contactId` — verifies list ownership before member removal.

**Backward compat:** Callers that already send `x-customer-id` see no change. Callers with no header get 400 (was previously a data leak).

#### `server/src/routes/contacts.ts` (commit `007750b`)
- `DELETE /:id` — added `getCustomerId` resolution and `findFirst({ where: { id, customerId } })` before delete. Returns 404 if not owned by tenant.
- Previously: deleted any contact by ID with no ownership check.

**Backward compat:** Same as above — callers with correct header unaffected.

#### `server/src/routes/leads.ts` (commit `6e2a367`)
- `GET /aggregations` — now requires either:
  - `x-customer-id` header **or** `customerId` query param (tenant scope), **or**
  - `x-admin-secret` header matching `ADMIN_SECRET` env var (admin bypass).
  - Returns 400 if neither provided.
  - Previously: `customerId` was fully optional; omitting it leaked aggregates across all tenants.
- `GET /sync/status/all` — now gated behind `x-admin-secret` check. Returns 403 if secret is absent or wrong.
  - Previously: fully unauthenticated; exposed all customers' Google Sheet URLs and sync states.

**Backward compat:**
- UI frontend always sends `x-customer-id` for `/aggregations` — no change visible to users.
- `/sync/status/all` was never called from the frontend UI — only internal tooling/admin use.

---

### 🟡 P1 Correctness — Frontend Tenant Drift

#### `src/platform/stores/settings.ts` + `src/utils/api.ts` (commit `7870c51`)
- `getCurrentCustomerId()` no longer writes a fallback value (`prod-customer-1`) back to `localStorage`.
- If no customer ID is in storage, returns `''` (empty string).
- The `api.ts` request builder no longer sends `X-Customer-Id` if the value is empty, causing a clean 400 from the backend instead of silently querying under a hardcoded ghost tenant.
- Default `fallback` parameter changed from `'prod-customer-1'` → `''`.

**Backward compat:** User must have selected a customer in the UI (normal flow). No regression for authenticated users.

---

### 🟡 P1 UI — Marketing Tab Removal

#### `src/tabs/marketing/MarketingHomePage.tsx` (commit `0497081`)
- Removed `Overview` and `People` tabs from the `defaultNavItems` array.
- `coerceViewId()` now maps `?view=overview` and `?view=people` → `'email-accounts'` (safe deep-link fallback).
- Unknown/missing view also defaults to `'email-accounts'` (was `'overview'`).
- `'overview'` and `'people'` retained in `OpenDoorsViewId` type union for backward-compat type safety.
- Deleted orphaned components (confirmed zero references outside `MarketingHomePage.tsx`):
  - `src/tabs/marketing/components/OverviewDashboard.tsx` (-668 lines)
  - `src/tabs/marketing/components/PeopleTab.tsx` (-519 lines)
- Removed now-unused icon and hook imports (`InfoIcon`, `AtSignIcon`, `EmailIcon`, `useState`, `useEffect`).

**Backward compat:** Old bookmark URLs (`?view=overview`, `?view=people`) land on Email Accounts tab — no crash, no blank page.

---

### 🔵 CI/CD — Smoke Probe Hardening

#### `.github/workflows/deploy-backend-azure.yml` (commit `eb1b9e3`)
- `/api/health` probe: now fails the build (not just warns) if non-200.
- `/api/__build` probe: fails the build if non-200; additionally verifies deployed SHA matches `github.sha`.
- New DB connectivity probe: calls `/api/customers` without tenant header, expects 400 (Customer ID required) or 200 — fails the build on 500 (DB connectivity issue).

---

### 📄 Documentation

| File | Description |
|---|---|
| `AUDIT_REPO_MAP.md` | Repo inventory: routes, workers, migrations, entry points |
| `AUDIT_ARCHITECTURE_TRUTH.md` | Production topology, auth flow, tenant resolution |
| `AUDIT_CICD_ENV.md` | CI/CD workflow analysis, env var audit |
| `AUDIT_BACKEND_FINDINGS.md` | Route-by-route tenant safety table, Prisma audit |
| `AUDIT_FRONTEND_FINDINGS.md` | TDZ inventory, dead code list, localStorage findings |
| `AUDIT_DB_MIGRATIONS.md` | Migration drift, stale objects, safe migration policy |
| `AUDIT_FIX_PLAN.md` | Prioritized P0/P1/P2 plan with diffs and verification |
| `MIGRATION_DRIFT_REPORT.md` | Prod vs local migration history discrepancies + safe reconciliation steps |
| `VERIFY_AUDIT_REMEDIATION.md` | Smoke test commands + expected outputs for all P0 fixes |

---

## Verification Commands and Results

### Frontend
```
npm run build          → ✅ PASS — 1353 modules, 0 errors
npx tsc --noEmit       → ✅ PASS — 0 TypeScript errors
```

### Backend
```
cd server && npm run build   → ✅ PASS — tsc, 0 errors
```

### P0 Grep Confirmations

**lists.ts — `findFirst` with `{ id, customerId }`:**
```
Lines 80, 161, 205, 231, 294 — all ownership-scoped queries confirmed present
```

**contacts.ts — `findFirst` ownership before delete:**
```
Lines 67, 103, 131, 155 — ownership checks confirmed present
```

**leads.ts — `/aggregations` gate:**
```
Line 267: const adminSecret = process.env.ADMIN_SECRET
Line 268: const isAdmin = adminSecret && req.headers['x-admin-secret'] === adminSecret
Line 272: return res.status(400).json({ error: 'Customer ID required' })
```

**leads.ts — `/sync/status/all` admin gate:**
```
Line 1448: // Gate: x-admin-secret header must match ADMIN_SECRET env var.
Line 1451: const adminSecret = process.env.ADMIN_SECRET
Line 1452: const isAdmin = adminSecret && req.headers['x-admin-secret'] === adminSecret
Line 1454: return res.status(403).json({ error: 'Admin access required' })
```

---

## Backward Compatibility Risk Notes

| Endpoint | Change | Risk | Mitigation |
|---|---|---|---|
| `GET /api/lists/:id` | Returns 404 instead of wrong-tenant data | Low — correct behavior | Any call without header gets 400; with correct header gets 200 as before |
| `DELETE /api/contacts/:id` | Returns 404 instead of deleting cross-tenant | Low | Same mitigation |
| `GET /api/leads/aggregations` | Returns 400 if no tenant or admin header | Low — UI always sends header | Frontend unchanged; only affects raw API callers without header |
| `GET /api/leads/sync/status/all` | Returns 403 without admin secret | None for UI (never called) | Internal tooling must add `x-admin-secret` header |
| `?view=overview` / `?view=people` | Redirects to `email-accounts` tab | None | Old bookmarks still work, land on valid tab |
| `getCurrentCustomerId()` | No longer persists `prod-customer-1` fallback | Low | Unauthenticated/no-tenant state produces clean 400 instead of ghost queries |

---

## Rollback Plan

Each logical change can be independently reverted:

```bash
# Revert junk file removal (not needed — it's a cleanup commit)
git revert 88294a9

# Revert Marketing tab removal
git revert 0497081

# Revert P1 getCurrentCustomerId fallback removal
git revert 7870c51

# Revert CI smoke probe hardening
git revert eb1b9e3

# Revert leads aggregations + sync/status/all gating
git revert 6e2a367

# Revert lists + contact delete IDOR fixes (these are the core P0 security fixes)
git revert 007750b
```

Docs commits (`15c32b4`, `5d85586`, `02556f9`) can be reverted without any production impact.

---

## Outstanding Items (Not in This PR)

Documented in `VERIFY_AUDIT_REMEDIATION.md` and `AUDIT_FIX_PLAN.md`:

| Item | Priority | Reason Deferred |
|---|---|---|
| Remove `// @ts-nocheck` from `server/src/routes/leads.ts` | P1 | 12 TypeScript errors surfaced — non-trivial, needs dedicated sprint |
| Workspaces table investigation (prod DB has migration with no local counterpart) | P1 | Requires prod DB inspection — see `MIGRATION_DRIFT_REPORT.md` |
| Dead component cleanup (~20 orphaned files in `src/components/`) | P2 | Low risk, deferred to housekeeping sprint |
| Code splitting / React.lazy for large bundle | P2 | Performance improvement, separate sprint |

---

## Files NOT in This PR (Untracked, Left as-is)

These exist in the working tree but are intentionally NOT committed:

| File | Reason |
|---|---|
| `E2E-VERIFY-REPORT.md` | Pre-existing local report, not audit-sprint output |
| `PRODUCTION-VERIFY-REPORT.md` | Pre-existing local report, not audit-sprint output |
| `_WIP_diff_before_fix.patch` | Pre-existing local patch file |
