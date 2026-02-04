# Production Persistence & Deployment Reliability Fix

## 🎯 Problem Statement

Users reported that data (accounts/contacts/forms) created in production would "disappear" or fail to persist reliably. Investigation revealed:

1. **Frontend API routing inconsistency**: Some code paths used absolute backend URLs, bypassing Azure Static Web Apps proxy
2. **Missing database migrations**: Migrations weren't running automatically on deployment
3. **Silent failures**: No startup guard for missing DATABASE_URL, no structured logging
4. **No verification**: No way to verify production was using correct database or that persistence worked

## ✅ Solution

### Backend Changes
- ✅ Added DATABASE_URL startup guard (crashes if missing in production - fail-fast)
- ✅ Enhanced `/api/health` endpoint with DB connectivity check
- ✅ Added structured logging to create/update endpoints (customers, contacts)
- ✅ Fixed dotenv usage (only loads in development, not production)

### CI/CD Changes
- ✅ Added `prisma migrate deploy` to backend workflow (runs before build)
- ✅ Fixed frontend workflow to use `VITE_API_URL` secret with empty string fallback
- ✅ Ensures frontend uses `/api` proxy consistently

### Verification & Documentation
- ✅ Created `verify-prod.js` script for end-to-end production verification
- ✅ Created `PRODUCTION_RUNBOOK.md` with operational procedures

## 📋 Pre-Merge Checklist

### GitHub Secrets (Already Verified ✅)
- [x] `VITE_API_URL` is **NOT SET** (correct - defaults to empty string for proxy)
- [x] `DATABASE_URL` exists (required for backend)

### Azure App Service Configuration (Needs Verification)
- [ ] `DATABASE_URL` is set in Azure Portal → App Service → Configuration → Application settings
- [ ] `DATABASE_URL` points to Azure PostgreSQL Flexible Server
- [ ] `NODE_ENV` is set to `production` (optional but recommended)

### Testing
- [x] Backend builds successfully (`npm run build`)
- [x] No TypeScript errors
- [x] Health endpoint enhanced with DB check
- [ ] **After merge**: Verify production health endpoint: `curl https://odcrm.bidlow.co.uk/api/health`

## 🚀 Deployment Steps

1. **Merge this PR** to `main` branch
2. **Monitor GitHub Actions**:
   - Backend deployment: https://github.com/gregvisser/ODCRM/actions (runs on `server/**` changes)
   - Frontend deployment: https://github.com/gregvisser/ODCRM/actions (runs on other changes)
3. **Wait for deployments** (~3-5 minutes each)
4. **Verify production**:
   ```bash
   # Check health endpoint
   curl https://odcrm.bidlow.co.uk/api/health
   
   # Expected response:
   # {
   #   "ok": true,
   #   "env": "production",
   #   "db": "ok",
   #   "database": { "connected": true, "customerCount": <number> }
   # }
   ```

## 🔍 Verification After Deployment

### 1. Check Backend Health
```bash
curl https://odcrm.bidlow.co.uk/api/health
```

Should return:
```json
{
  "ok": true,
  "env": "production",
  "db": "ok",
  "database": {
    "connected": true,
    "customerCount": 123
  }
}
```

### 2. Verify Frontend Uses Proxy
1. Open https://odcrm.bidlow.co.uk
2. Open DevTools (F12) → Network tab
3. Perform any action (e.g., load customers)
4. Check API requests:
   - ✅ **CORRECT**: `https://odcrm.bidlow.co.uk/api/customers`
   - ❌ **WRONG**: `https://odcrm-api-*.azurewebsites.net/api/customers`

### 3. Test Data Persistence
1. Create a test customer/contact in production
2. Refresh the page
3. Verify data persists (doesn't disappear)

### 4. Run Verification Script (Optional)
```bash
cd server
DATABASE_URL="your-production-database-url" npm run verify:prod
```

## 📝 Files Changed

### Backend
- `server/src/index.ts` - DATABASE_URL guard, enhanced health endpoint
- `server/src/routes/customers.ts` - Structured logging
- `server/src/routes/contacts.ts` - Structured logging
- `server/package.json` - Added verify:prod script
- `server/scripts/verify-prod.js` - New verification script

### CI/CD
- `.github/workflows/deploy-backend-azure.yml` - Added prisma migrate deploy
- `.github/workflows/deploy-frontend-azure-static-web-app.yml` - Fixed VITE_API_URL usage

### Documentation
- `PRODUCTION_RUNBOOK.md` - New operational guide

## ⚠️ Breaking Changes

**None** - All changes are additive or fix existing issues.

## 🔐 Security Notes

- No secrets committed to code
- DATABASE_URL must be set in Azure App Service Configuration (not in code)
- Backend will fail-fast on startup if DATABASE_URL missing (prevents silent failures)

## 📚 Related Documentation

- See `PRODUCTION_RUNBOOK.md` for detailed operational procedures
- See `ARCHITECTURE.md` for system architecture overview
