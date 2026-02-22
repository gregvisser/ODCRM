# PR: ODCRM Audit Remediation — P0 Security + CI Hardening + P1 Fixes

**Branch:** `audit-remediation-p0` → **Target:** `main`  
**Date:** 2026-02-22  
**Build:** ✅ Backend tsc | ✅ Frontend Vite | ✅ `tsc --noEmit` — all pass, 0 errors

---

## What this PR changes

### 🔴 P0 — IDOR Fixes (commits `007750b`, `6e2a367`)

#### `server/src/routes/lists.ts`
Before this PR, `GET /api/lists/:id`, `PUT /api/lists/:id`, `DELETE /api/lists/:id`, `POST /api/lists/:id/contacts`, and `DELETE /api/lists/:id/contacts/:contactId` used `findUnique({ where: { id } })` with no tenant check — any authenticated user could read or modify any tenant's lists.

**Changes:**
- Added `getCustomerId()` helper: resolves `x-customer-id` header (fallback: `req.query.customerId`); throws HTTP 400 if absent.
- All `/:id` routes now use `findFirst({ where: { id, customerId } })` — returns 404 if not owned by the resolved tenant.
- `POST /:id/contacts` also validates that all `contactIds` in the payload belong to the same tenant.

#### `server/src/routes/contacts.ts`
Before this PR, `DELETE /api/contacts/:id` deleted any contact by ID without checking tenant ownership.

**Changes:**
- `DELETE /:id` now resolves `customerId` and calls `findFirst({ where: { id, customerId } })` before deletion — returns 404 if not owned.

#### `server/src/routes/leads.ts` (two sub-fixes)
1. **`GET /api/leads/aggregations`** — `customerId` was fully optional; omitting it leaked aggregated data across all tenants.  
   **Fix:** Now requires `x-customer-id` header OR `customerId` query param, OR `x-admin-secret` matching `ADMIN_SECRET` env var. Returns 400 if neither is provided.

2. **`GET /api/leads/sync/status/all`** — No authentication; exposed all customers' Google Sheet URLs and sync states.  
   **Fix:** Gated behind `x-admin-secret` header. Returns 403 if absent or incorrect.

---

### 🟡 P1 — Remove `prod-customer-1` Fallback Write-back (commit `7870c51`)

#### `src/platform/stores/settings.ts` + `src/utils/api.ts`
Before this PR, `getCurrentCustomerId()` would silently write `'prod-customer-1'` to `localStorage` if no customer was selected — causing all subsequent API calls to be scoped to a ghost/hardcoded tenant.

**Changes:**
- `getCurrentCustomerId()` no longer writes any fallback to `localStorage`.
- Returns `''` (empty string) if no customer is in storage.
- `api.ts` omits `X-Customer-Id` header when value is empty — backend returns a clean 400 rather than silently querying for a non-existent tenant.
- Default `fallback` parameter changed from `'prod-customer-1'` → `''`.

**Backward compat:** Authenticated users who have selected a customer are unaffected. Unauthenticated/no-tenant state now produces a clean, visible 400.

---

### 🔵 CI — Post-deploy Smoke Probe Hardening (commit `eb1b9e3`)

#### `.github/workflows/deploy-backend-azure.yml`
**Changes:**
- `/api/health` probe now **fails the build** (not just warns) on non-200.
- `/api/__build` probe now **fails the build** on non-200; also verifies deployed SHA matches `github.sha`.
- New **DB connectivity probe**: calls `/api/customers` without tenant header, expects 400 or 200 — fails build on 500 (indicates DB connectivity issue).

---

### 📄 Docs (commits `5d85586`, `15c32b4`, `02556f9`, `8990c72`)

| File | Contents |
|---|---|
| `AUDIT_REPO_MAP.md` | Full route, worker, migration, and entry-point inventory |
| `AUDIT_ARCHITECTURE_TRUTH.md` | Production topology, auth flow, tenant resolution |
| `AUDIT_CICD_ENV.md` | CI/CD workflow analysis and env var audit |
| `AUDIT_BACKEND_FINDINGS.md` | Route-by-route tenant safety findings table |
| `AUDIT_FRONTEND_FINDINGS.md` | TDZ inventory, dead code list, localStorage audit |
| `AUDIT_DB_MIGRATIONS.md` | Migration drift analysis, stale objects, safe policy |
| `AUDIT_FIX_PLAN.md` | Prioritized P0/P1/P2 fix plan |
| `MIGRATION_DRIFT_REPORT.md` | Prod vs local migration history discrepancies |
| `VERIFY_AUDIT_REMEDIATION.md` | Smoke test commands + expected outputs for each P0 fix |

### 🧹 Housekeeping (commits `88294a9`, `8990c72`)
- Removed accidentally committed `_commit_msg.txt`.
- Added `_commit_msg*.txt`, `_pr_msg*.txt`, `_WIP_*.patch` to `.gitignore`.

---

## Why this PR is safe

1. **No migrations** — zero schema or data changes.
2. **No destructive changes** — only adds ownership guards (`findFirst` with `customerId`); nothing previously valid becomes broken for callers sending correct headers.
3. **Additive only** — every change is a guard or gate, not a removal of existing logic.
4. **DB remains source of truth** — no localStorage business data introduced.
5. **Marketing UI tab removal NOT in this PR** — already deployed to production as `0150a2d` via cherry-pick. The `git diff origin/main..HEAD` confirms `MarketingHomePage.tsx`, `OverviewDashboard.tsx`, and `PeopleTab.tsx` are absent from the diff.
6. **All builds pass** — backend tsc, frontend Vite build, frontend `tsc --noEmit`.

---

## Behavior changes (explicit)

| Endpoint | Before | After | Risk |
|---|---|---|---|
| `GET /api/lists/:id` | Returns data for any list ID | Returns 404 if not owned by tenant | Low — correct auth callers unaffected |
| `PUT /api/lists/:id` | Updates any list ID | Returns 404 if not owned | Low |
| `DELETE /api/lists/:id` | Deletes any list ID | Returns 404 if not owned | Low |
| `POST /api/lists/:id/contacts` | Adds any contacts to any list | Validates list + contact ownership | Low |
| `DELETE /api/lists/:id/contacts/:cid` | Removes from any list | Validates list ownership | Low |
| `DELETE /api/contacts/:id` | Deletes any contact | Returns 404 if not owned | Low |
| `GET /api/leads/aggregations` | `customerId` optional (leaked cross-tenant) | Requires tenant or admin secret; 400 if neither | Low — UI always sends header |
| `GET /api/leads/sync/status/all` | No auth (exposed all Sheet URLs) | Requires `x-admin-secret`; 403 if absent | None for UI (not called from frontend) |
| `getCurrentCustomerId()` | Persisted `prod-customer-1` fallback to localStorage | Returns `''`; no write-back | Low — only affects unauthenticated/no-tenant state |
| CI post-deploy smoke | Warned on probe failures | Fails build on `/api/health` non-200, `/__build` non-200, or 500 from `/api/customers` | CI-only improvement |

---

## Verification commands (copy-paste)

```bash
# Backend build
cd server && npm run build

# Frontend build
npm run build
npx tsc --noEmit

# lists.ts — tenant ownership checks
Select-String -Path "server\src\routes\lists.ts" -Pattern "findFirst" | Select-Object -First 10

# contacts.ts — delete ownership
Select-String -Path "server\src\routes\contacts.ts" -Pattern "router\.delete|findFirst" | Select-Object -First 10

# leads.ts — aggregations gate (expect line with ADMIN_SECRET + 400)
Select-String -Path "server\src\routes\leads.ts" -Pattern "ADMIN_SECRET|Admin access required|Customer ID required" | Select-Object -First 15

# Confirm Marketing UI files NOT in PR diff
git diff --name-only origin/main..HEAD | Select-String "MarketingHomePage|OverviewDashboard|PeopleTab"
# Expected output: (empty — no matches)
```

---

## Rollback plan

Each logical change is independently revertable:

```bash
# Revert P0 IDOR fixes (lists + contact delete)
git revert 007750b

# Revert leads aggregations + sync/status/all gating
git revert 6e2a367

# Revert CI smoke probe hardening
git revert eb1b9e3

# Revert P1 getCurrentCustomerId fallback removal
git revert 7870c51

# Docs commits (no behavior changes, safe to revert if needed)
git revert 5d85586
git revert 15c32b4
git revert 02556f9
git revert 8990c72

# Housekeeping
git revert 88294a9
```

---

## Post-merge verification steps

After merging to main and deployment completes (~3-5 min):

```powershell
# 1. Confirm correct SHA deployed
Invoke-WebRequest "https://odcrm.bidlow.co.uk/__build.json" -UseBasicParsing | Select-Object -ExpandProperty Content

# 2. Confirm lists endpoint enforces tenant
# Should return 400 (no tenant header)
Invoke-WebRequest "https://odcrm.bidlow.co.uk/api/lists/nonexistent-id" -UseBasicParsing
# Expected: 400 { error: "Customer ID required" }

# 3. Confirm leads aggregations enforces tenant
Invoke-WebRequest "https://odcrm.bidlow.co.uk/api/leads/aggregations" -UseBasicParsing
# Expected: 400 { error: "Customer ID required" }

# 4. Confirm sync/status/all is gated
Invoke-WebRequest "https://odcrm.bidlow.co.uk/api/leads/sync/status/all" -UseBasicParsing
# Expected: 403 { error: "Admin access required" }

# 5. Backend health still healthy
Invoke-WebRequest "https://odcrm.bidlow.co.uk/api/health" -UseBasicParsing
# Expected: 200
```

---

## Outstanding items (deferred — NOT in this PR)

| Item | Priority | Reason |
|---|---|---|
| Remove `// @ts-nocheck` from `server/src/routes/leads.ts` | P1 | 12 TypeScript errors surfaced on removal — needs dedicated sprint |
| `workspaces` table migration drift investigation | P1 | Requires prod DB inspection — see `MIGRATION_DRIFT_REPORT.md` |
| Dead component cleanup (~20 orphaned files in `src/components/`) | P2 | Low risk, deferred housekeeping sprint |
| Code splitting / React.lazy for 1.3 MB frontend bundle | P2 | Performance improvement, separate sprint |
