# AUDIT_CICD_ENV.md — CI/CD & Environment Audit
**Generated:** 2026-02-22

---

## 1. Workflow Inventory

| Workflow | Status | Trigger | Target |
|----------|--------|---------|--------|
| `deploy-frontend-azure-static-web-app.yml` | ✅ Active | push to main + workflow_dispatch | Azure SWA |
| `deploy-backend-azure.yml` | ✅ Active | push to main (path-filtered) + workflow_dispatch | Azure App Service |
| `resolve-prisma-migration-lock.yml` | ✅ Active | workflow_dispatch | Utility — mark migration resolved |
| `azure-static-web-apps-happy-sand-0fc981903.yml.disabled` | ❌ Disabled | — | Stale artifact |

---

## 2. Frontend Deploy Workflow Analysis

**File:** `.github/workflows/deploy-frontend-azure-static-web-app.yml`

### What it does:
1. Checks out code
2. Installs Node 22
3. Runs `npm ci` (no explicit cache for node_modules beyond `cache: 'npm'`)
4. Builds with `VITE_API_URL` hardcoded to App Service URL
5. Deploys pre-built `dist/` to Azure SWA (skips SWA build)

### Issues Found:

| Severity | Issue | Evidence | Impact |
|----------|-------|----------|--------|
| **P1** | `VITE_API_URL` hardcoded in workflow YAML (not a secret) | Line: `VITE_API_URL: https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net` | If App Service is renamed or moved, this must be updated manually in two places (workflow + any local env) |
| **P2** | `VITE_AUTH_ALLOWED_EMAILS` is passed as a secret but **never read in frontend code** | AuthGate calls `/api/users/me` instead | Unnecessary secret exposure in build env |
| **P2** | `VITE_AUTH_ALLOWED_DOMAINS` is NOT set in workflow (present in `.env.local`, declared in `vite-env.d.ts`) | Missing from workflow env block | Variable is dead — never read in AuthGate or msalConfig — no runtime impact but creates confusing drift between local and prod |
| **P2** | No build artifact verification step | No SHA crosscheck after `dist/` deploy | Could deploy wrong artifact if build step fails silently (unlikely with GitHub Actions, but no explicit guard) |
| **P2** | Node 22 in frontend, Node 24 in backend | Different node versions between workflows | Potential inconsistencies in `npm ci` behavior; should be same LTS or explicitly justified |

### What's Working Well:
- ✅ `skip_app_build: true` — SWA doesn't re-build; pre-built `dist/` is used
- ✅ `VITE_BUILD_SHA: ${{ github.sha }}` — build fingerprint baked in
- ✅ `VITE_BUILD_TIME` — timestamp baked in
- ✅ `/__build.json` served by Vite plugin for frontend deploy verification

---

## 3. Backend Deploy Workflow Analysis

**File:** `.github/workflows/deploy-backend-azure.yml`

### What it does:
1. Path filter: only runs if `server/**` or the workflow file changed (or `ALWAYS_DEPLOY_BACKEND=true`)
2. Runs `npm ci` in `/server`
3. Generates Prisma client
4. Validates schema file and migration folder exist
5. Baselines migrations (marks existing ones as applied via `migrate resolve`)
6. Runs `prisma migrate deploy`
7. Verifies migration status
8. Runs `verify-columns.cjs`
9. Writes `buildInfo.generated.json`
10. Builds TypeScript
11. Deploys to Azure App Service
12. Smoke tests `/api/health` and `/api/__build` after 45-second wait

### Issues Found:

| Severity | Issue | Evidence | Impact |
|----------|-------|----------|--------|
| **P0** | Baseline migration step hardcodes 14 migration names | Lines `npx prisma migrate resolve --applied "20251210132629_init"` ... | New migrations added to the repo will NOT be in the baseline list. If a new migration runs on a DB that already has the changes, `migrate deploy` will try to apply it twice → possible error or data modification. However, `migrate deploy` is idempotent for already-applied migrations, so risk is lower. Main risk: a developer adds migration but forgets to update baseline list. |
| **P1** | Missing smoke test for actual functionality | Only tests `/api/health` (returns `ok`) and `/api/__build` | Backend could deploy with Prisma client out of sync or routes broken; health endpoint doesn't verify DB connectivity |
| **P1** | Path filter uses `git diff --name-only $BEFORE $SHA` | If `BEFORE` is zeroed (first push), uses `$SHA^` | Edge case: first commit or force-push could skip deploy |
| **P2** | `resolve-prisma-migration-lock.yml` has hardcoded migration names too | Same baseline hardcoding pattern | Maintenance burden |
| **P2** | `ALWAYS_DEPLOY_BACKEND` repo variable must be manually set | No documentation of when to use it | Risk of accidentally always-deploying backend on every frontend-only commit |

### What's Working Well:
- ✅ Post-deploy smoke test with 45s wait
- ✅ `verify-columns.cjs` column check after migration
- ✅ Path filter prevents unnecessary backend deploys
- ✅ DB host logged (sanitized) — good observability
- ✅ `buildInfo.generated.json` written and copied to `dist/`

---

## 4. Environment Configuration Audit

### Frontend `.env.local` (local dev, NOT deployed)

| Variable | Value | Status |
|----------|-------|--------|
| `VITE_API_URL` | `http://localhost:3001` | ✅ Correct for local dev |
| `VITE_AZURE_CLIENT_ID` | `c4fd4112-...` | ✅ |
| `VITE_AZURE_TENANT_ID` | `common` | ✅ |
| `VITE_AZURE_REDIRECT_URI` | `http://localhost:5173` | ✅ |
| `VITE_AUTH_ALLOWED_EMAILS` | `greg@opensdoors.co.uk` | ⚠️ Never read in code — dead config |
| `VITE_AUTH_ALLOWED_DOMAINS` | `opensdoors.co.uk` | ⚠️ Never read in code — dead config |

### Backend `server/.env` (local dev, NOT deployed to Azure)

Present variables: `DATABASE_URL`, `PORT`, `NODE_ENV`, `FRONTEND_URL`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID`, `REDIRECT_URI`, `EMAIL_TRACKING_DOMAIN`, `ENABLE_LEADS_SYNC`, `LEADS_SYNC_CRON`

**Missing from local `.env` but needed:**
- `ENABLE_EMAIL_SCHEDULER` — defaults to false (safe)
- `ENABLE_REPLY_DETECTOR` — defaults to false (safe)
- `ADMIN_SECRET` — admin routes unsecured locally
- `GIT_SHA` — `/api/__build` returns `'unknown'` locally

---

## 5. staticwebapp.config.json Audit

```json
{
  "routes": [
    { "route": "/*.{css,js,...}", "headers": { "cache-control": "public, max-age=31536000, immutable" } }
  ],
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/api/*", "/*.{css,...}"]
  },
  "globalHeaders": { "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", ... }
}
```

| Finding | Severity | Notes |
|---------|----------|-------|
| No `/api/*` proxy rule | ✅ Correct | Frontend calls backend directly; SWA doesn't proxy API. This is intentional. |
| `X-Frame-Options: DENY` | ✅ Good | Prevents clickjacking |
| No CSP header | P2 | Content-Security-Policy not set; would be good to add but requires careful configuration |
| Asset cache `immutable` | ✅ Correct | Vite content-hashed filenames make this safe |

---

## 6. Secrets Logging Risk

**Backend startup logs CORS configuration including all allowed origins** — these are URLs, not secrets, so no credential leakage. ✅

**Backend startup logs `ADMIN_SECRET: SET/NOT_SET`** — reveals presence/absence but not value. ✅ Acceptable.

**No DATABASE_URL, CLIENT_SECRET, or ACCESS_TOKEN logged.** ✅

---

## 7. Recommended Minimal Fixes

| Priority | Fix | File | Change |
|----------|-----|------|--------|
| P1 | Add DB connectivity check to smoke test | `deploy-backend-azure.yml` | After health check, call `/api/customers?limit=1` with valid header and verify non-500 |
| P1 | Remove `VITE_AUTH_ALLOWED_EMAILS` from frontend build env | `deploy-frontend-azure-static-web-app.yml` | Delete the env line — it is not read |
| P1 | Move `VITE_API_URL` to a GitHub secret | `deploy-frontend-azure-static-web-app.yml` | `${{ secrets.VITE_API_URL }}` |
| P2 | Add missing migrations to baseline list after each new migration | `deploy-backend-azure.yml` | Document process in README/CONTRIBUTING |
| P2 | Remove dead `.yml.disabled` workflow | `.github/workflows/` | Delete file |
| P2 | Remove dead `VITE_AUTH_ALLOWED_EMAILS` / `VITE_AUTH_ALLOWED_DOMAINS` from `.env.local` | `.env.local` | Delete or document as unused |

---

## 8. Verification Commands

After any workflow change:
```bash
# Verify frontend deploy
curl https://odcrm.bidlow.co.uk/__build.json
# Expected: {"sha":"<github.sha>","time":"..."}

# Verify backend deploy
curl https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net/api/__build
# Expected: {"sha":"<github.sha>","time":"...","service":"odcrm-api"}

# Verify backend health
curl https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net/api/health
# Expected: {"status":"ok",...}
```
