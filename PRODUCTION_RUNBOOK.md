# Production Runbook - ODCRM

**Last Updated:** 2026-02-04  
**Purpose:** Operational guide for verifying and maintaining production reliability

---

## 🎯 Quick Health Check

### Verify Production is Healthy

```bash
# Option 1: Use the verification script
cd server
DATABASE_URL="your-production-database-url" npm run verify:prod

# Option 2: Manual health check
curl https://odcrm.bidlow.co.uk/api/health
```

**Expected Response:**
```json
{
  "ok": true,
  "env": "production",
  "db": "ok",
  "database": {
    "connected": true,
    "customerCount": 123
  },
  "timestamp": "2026-02-04T12:00:00.000Z"
}
```

**If health check fails:**
- Check Azure App Service logs
- Verify DATABASE_URL is set in Azure App Service Configuration
- Check database connectivity from Azure

---

## 🔍 Verifying Production Configuration

### 1. Frontend API Routing

**How to verify frontend uses `/api` proxy:**

1. Open production site: https://odcrm.bidlow.co.uk
2. Open browser DevTools (F12) → Network tab
3. Perform any action (e.g., load customers)
4. Check API requests:
   - ✅ **CORRECT:** Requests go to `https://odcrm.bidlow.co.uk/api/customers`
   - ❌ **WRONG:** Requests go to `https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net/api/customers`

**If wrong:**
- Check GitHub Actions workflow: `.github/workflows/deploy-frontend-azure-static-web-app.yml`
- Verify `VITE_API_URL` secret is empty or set to `/api` (not absolute URL)
- Rebuild and redeploy frontend

**Configuration:**
- `staticwebapp.config.json` routes `/api/*` → backend URL
- Frontend should use relative URLs (`/api/*`) not absolute backend URLs
- This ensures requests go through Azure Static Web Apps proxy

---

### 2. Backend Database Connection

**How to verify backend uses Azure PostgreSQL:**

1. Check Azure App Service Configuration:
   - Portal → App Service → Configuration → Application settings
   - Verify `DATABASE_URL` is set (should start with `postgresql://`)
   - Should point to Azure PostgreSQL Flexible Server

2. Check backend logs:
   ```bash
   # Via Azure Portal or Azure CLI
   az webapp log tail --name odcrm-api-hkbsfbdzdvezedg8 --resource-group <resource-group>
   ```
   - Look for: `✅ DATABASE_URL is configured`
   - If you see: `❌ CRITICAL: DATABASE_URL environment variable is missing` → Fix immediately

3. Test database connectivity:
   ```bash
   curl https://odcrm.bidlow.co.uk/api/health
   ```
   - Should return `"db": "ok"` and `"database": { "connected": true }`

**If database connection fails:**
- Verify DATABASE_URL in Azure App Service Configuration
- Check Azure PostgreSQL firewall rules allow App Service IPs
- Verify PostgreSQL server is running
- Check connection string format (must include `?sslmode=require`)

---

### 3. Database Schema Migrations

**How to verify migrations are applied:**

1. Check migration status:
   ```bash
   cd server
   DATABASE_URL="your-production-database-url" npx prisma migrate status
   ```

2. Check Prisma Studio (read-only):
   ```bash
   cd server
   DATABASE_URL="your-production-database-url" npm run prisma:studio
   ```
   - Opens browser at http://localhost:5555
   - Verify tables exist and have correct schema

**If migrations are missing:**
- Migrations should run automatically during deployment (GitHub Actions)
- Check `.github/workflows/deploy-backend-azure.yml` for `prisma migrate deploy` step
- If missing, run manually:
  ```bash
  cd server
  DATABASE_URL="your-production-database-url" npm run prisma:migrate:deploy
  ```

---

## 🚀 Deployment Process

### Backend Deployment

**Automatic (via GitHub Actions):**
1. Push to `main` branch with changes in `server/**`
2. Workflow runs:
   - `npm ci` (install dependencies)
   - `npm run prisma:generate` (generate Prisma client)
   - `npm run prisma:migrate:deploy` (apply migrations)
   - `npm run build` (build TypeScript)
   - Deploy to Azure App Service

**Manual (if needed):**
```bash
cd server
npm ci
DATABASE_URL="your-production-database-url" npm run prisma:generate
DATABASE_URL="your-production-database-url" npm run prisma:migrate:deploy
npm run build
# Then deploy dist/ folder to Azure App Service
```

**Verify deployment:**
```bash
curl https://odcrm.bidlow.co.uk/api/health
# Should return healthy status
```

---

### Frontend Deployment

**Automatic (via GitHub Actions):**
1. Push to `main` branch (excluding `server/**`)
2. Workflow runs:
   - `npm ci` (install dependencies)
   - `npm run build` (build with Vite)
   - Deploy to Azure Static Web Apps

**Critical Configuration:**
- `VITE_API_URL` must be empty string (`''`) or `/api` in production
- This ensures frontend uses relative URLs that go through proxy
- Never set `VITE_API_URL` to absolute backend URL in production

**Verify deployment:**
1. Open https://odcrm.bidlow.co.uk
2. Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
3. Check browser console (F12) for errors
4. Verify API calls go to `/api/*` (not absolute backend URL)

---

## 🔧 Troubleshooting

### Problem: Data "Disappears" After Creation

**Symptoms:**
- User creates account/contact/form
- Data appears briefly, then disappears
- Refresh shows data is gone

**Diagnosis Steps:**

1. **Check backend logs:**
   ```bash
   az webapp log tail --name odcrm-api-hkbsfbdzdvezedg8 --resource-group <resource-group>
   ```
   - Look for `✅ POST /api/customers - Created customer:` (success)
   - Look for `❌ POST /api/customers - Error:` (failure)

2. **Check database directly:**
   ```bash
   cd server
   DATABASE_URL="your-production-database-url" npm run prisma:studio
   ```
   - Check if record exists in database
   - If missing → backend write failed silently
   - If exists → frontend read issue

3. **Check frontend API calls:**
   - Open DevTools → Network tab
   - Create a record
   - Check response:
     - Status 201 = success (should persist)
     - Status 500 = backend error (won't persist)
     - Network error = connection issue

**Common Causes:**
- Backend not connected to database (check DATABASE_URL)
- Frontend calling wrong API URL (bypassing proxy)
- Database transaction not committed (Prisma handles this, but check logs)
- CORS errors preventing requests

---

### Problem: Frontend Can't Reach Backend

**Symptoms:**
- Network errors in browser console
- CORS errors
- 404 errors on API calls

**Diagnosis Steps:**

1. **Check API URL:**
   - DevTools → Network → Check request URL
   - Should be: `https://odcrm.bidlow.co.uk/api/*`
   - Should NOT be: `https://odcrm-api-*.azurewebsites.net/api/*`

2. **Check proxy configuration:**
   - Verify `staticwebapp.config.json` exists
   - Verify `/api/*` route points to backend URL
   - Verify backend URL is correct

3. **Check backend health:**
   ```bash
   curl https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net/api/health
   ```
   - If fails → backend is down
   - If succeeds → proxy issue

**Fixes:**
- If frontend uses absolute URL → Fix `VITE_API_URL` in GitHub Secrets
- If proxy misconfigured → Update `staticwebapp.config.json`
- If backend down → Check Azure App Service status

---

### Problem: Database Migrations Not Applied

**Symptoms:**
- Backend crashes on startup
- "Table does not exist" errors
- Schema mismatch errors

**Diagnosis:**
```bash
cd server
DATABASE_URL="your-production-database-url" npx prisma migrate status
```

**Fix:**
```bash
cd server
DATABASE_URL="your-production-database-url" npm run prisma:migrate:deploy
```

**Prevention:**
- Migrations run automatically in CI/CD (`.github/workflows/deploy-backend-azure.yml`)
- If workflow is missing migration step, add it

---

## 📊 Monitoring & Alerts

### Key Metrics to Monitor

1. **Health Endpoint:**
   - URL: `https://odcrm.bidlow.co.uk/api/health`
   - Frequency: Every 5 minutes
   - Alert if: `ok: false` or `db: "error"`

2. **Database Connection:**
   - Check backend logs for `DATABASE_URL is configured`
   - Alert if: Missing DATABASE_URL or connection errors

3. **API Response Times:**
   - Monitor `/api/customers`, `/api/contacts` endpoints
   - Alert if: Response time > 5 seconds

4. **Error Rates:**
   - Monitor 500 errors in backend logs
   - Alert if: Error rate > 1% of requests

---

## 🔄 Rollback Procedures

### Rollback Backend

**If backend breaks production:**

1. **Identify last working commit:**
   ```bash
   git log --oneline -10
   ```

2. **Revert to last working version:**
   ```bash
   git revert <bad-commit-hash>
   git push origin main
   ```
   OR
   ```bash
   git reset --hard <last-working-commit>
   git push origin main --force  # Only if necessary
   ```

3. **Monitor deployment:**
   - Watch GitHub Actions: https://github.com/gregvisser/ODCRM/actions
   - Wait for deployment to complete (~3-5 minutes)

4. **Verify rollback:**
   ```bash
   curl https://odcrm.bidlow.co.uk/api/health
   ```

---

### Rollback Frontend

**If frontend breaks production:**

1. **Revert frontend changes:**
   ```bash
   git revert <bad-commit-hash>
   git push origin main
   ```

2. **Monitor deployment:**
   - Watch GitHub Actions
   - Wait for deployment (~3-5 minutes)

3. **Verify rollback:**
   - Open https://odcrm.bidlow.co.uk
   - Hard refresh: `Ctrl+Shift+R`
   - Check browser console for errors

---

## 🔐 Security Checklist

- [ ] DATABASE_URL is set in Azure App Service Configuration (not in code)
- [ ] DATABASE_URL uses SSL (`?sslmode=require`)
- [ ] Backend CORS allows only production frontend URL
- [ ] No secrets committed to git
- [ ] GitHub Secrets configured correctly
- [ ] Azure firewall rules restrict database access

---

## 📝 Environment Variables Reference

### Backend (Azure App Service Configuration)

**Required:**
- `DATABASE_URL` - PostgreSQL connection string
- `PORT` - Server port (default: 3001, Azure sets automatically)
- `NODE_ENV` - Set to `production`

**Optional:**
- `FRONTEND_URL` - Frontend URL for CORS (defaults to production URL)
- `FRONTEND_URLS` - Comma-separated list of allowed frontend URLs
- `EMAIL_WORKERS_DISABLED` - Set to `true` to disable email workers
- `LEADS_SYNC_DISABLED` - Set to `true` to disable leads sync worker
- `ABOUT_ENRICHMENT_DISABLED` - Set to `true` to disable enrichment worker

### Frontend (GitHub Secrets for Build)

**Required:**
- `VITE_API_URL` - Should be empty (`''`) or `/api` for production
- `VITE_AZURE_CLIENT_ID` - Azure AD client ID
- `VITE_AZURE_TENANT_ID` - Azure AD tenant ID
- `VITE_AZURE_REDIRECT_URI` - OAuth redirect URI
- `VITE_AUTH_ALLOWED_EMAILS` - Comma-separated list of allowed emails

---

## ✅ Pre-Deployment Checklist

Before deploying to production:

- [ ] All changes tested locally
- [ ] Backend builds successfully: `cd server && npm run build`
- [ ] Backend starts successfully: `cd server && npm run dev`
- [ ] Frontend builds successfully: `npm run build`
- [ ] Database migrations tested: `cd server && npm run prisma:migrate:deploy`
- [ ] Health endpoint works: `curl http://localhost:3001/api/health`
- [ ] No TypeScript errors: `cd server && npx tsc --noEmit`
- [ ] No console errors in browser
- [ ] Changes committed to git
- [ ] Commit message explains what changed and why

---

## 🆘 Emergency Contacts

**If production is down:**

1. Check GitHub Actions: https://github.com/gregvisser/ODCRM/actions
2. Check Azure Portal: https://portal.azure.com
3. Check backend logs: Azure Portal → App Service → Log stream
4. Run verification script: `cd server && npm run verify:prod`

**Escalation:**
- If database is down → Azure PostgreSQL support
- If App Service is down → Azure App Service support
- If Static Web App is down → Azure Static Web Apps support

---

**Remember:** Database is the single source of truth. Always verify data is in the database, not just in the UI.
