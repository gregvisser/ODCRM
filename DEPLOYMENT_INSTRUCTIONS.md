# Step-by-Step Deployment Instructions

## ✅ Step 1: Verify GitHub Secrets (COMPLETED)

**Status:** ✅ Verified via screenshot
- `VITE_API_URL` is **NOT SET** → ✅ Correct (defaults to empty string for proxy)
- `DATABASE_URL` exists → ✅ Required for backend

**Action Required:** None - GitHub secrets are correctly configured.

---

## 🔍 Step 2: Verify Azure App Service Configuration

**You need to verify:** `DATABASE_URL` is set in Azure App Service

### Option A: Via Azure Portal (Recommended)

1. **Go to Azure Portal**: https://portal.azure.com
2. **Navigate to App Service**:
   - Search for: `odcrm-api-hkbsfbdzdvezedg8`
   - Or go to: Resource Groups → [Your Resource Group] → App Services → `odcrm-api-hkbsfbdzdvezedg8`
3. **Check Configuration**:
   - Click **"Configuration"** in left sidebar
   - Click **"Application settings"** tab
   - Look for `DATABASE_URL` in the list
   - **Verify:**
     - ✅ `DATABASE_URL` exists
     - ✅ Value starts with `postgresql://`
     - ✅ Points to Azure PostgreSQL Flexible Server
     - ✅ Includes `?sslmode=require`

**If `DATABASE_URL` is missing:**
- Click **"+ New application setting"**
- Name: `DATABASE_URL`
- Value: Your PostgreSQL connection string (from GitHub secrets or Azure PostgreSQL)
- Click **"Save"**
- App Service will restart automatically

### Option B: Via Azure CLI

```bash
# Check if DATABASE_URL is set
az webapp config appsettings list \
  --name odcrm-api-hkbsfbdzdvezedg8 \
  --resource-group <your-resource-group> \
  --query "[?name=='DATABASE_URL']"

# If missing, set it (use value from GitHub secrets)
az webapp config appsettings set \
  --name odcrm-api-hkbsfbdzdvezedg8 \
  --resource-group <your-resource-group> \
  --settings DATABASE_URL="postgresql://..."
```

---

## 🚀 Step 3: Create Pull Request

**PR URL:** https://github.com/gregvisser/ODCRM/pull/new/fix/prod-persistence-and-deploy

### PR Details:

**Title:**
```
Fix: Production persistence and deployment reliability
```

**Description:** (Copy from `PR_DESCRIPTION.md` or use this summary)

```markdown
## Problem
Users reported data disappearing after creation. Root causes:
- Frontend using absolute backend URLs (bypassing proxy)
- Database migrations not running automatically
- No verification of production database connection

## Solution
- ✅ Added DATABASE_URL startup guard (fail-fast if missing)
- ✅ Enhanced /api/health endpoint with DB connectivity check
- ✅ Added prisma migrate deploy to CI/CD workflow
- ✅ Fixed frontend to use /api proxy consistently
- ✅ Added structured logging to create/update endpoints
- ✅ Created verification script and production runbook

## Pre-Merge Checklist
- [x] GitHub secrets verified (VITE_API_URL not set - correct)
- [ ] Azure App Service DATABASE_URL verified (see Step 2)
- [x] Backend builds successfully
- [x] No TypeScript errors

## Testing After Merge
1. Monitor GitHub Actions deployments
2. Verify health endpoint: `curl https://odcrm.bidlow.co.uk/api/health`
3. Test data persistence in production UI
```

**Reviewers:** Add yourself or team members

**Labels:** `bug`, `production`, `deployment`

---

## ✅ Step 4: After PR is Merged

### 4.1 Monitor Deployments

1. **Watch GitHub Actions**: https://github.com/gregvisser/ODCRM/actions
2. **Backend deployment** will trigger automatically (changes in `server/**`)
3. **Frontend deployment** will trigger automatically (other changes)
4. **Wait for both to complete** (~3-5 minutes each)
5. **Look for green checkmarks** ✅

### 4.2 Verify Backend Deployment

```bash
# Check health endpoint
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
  "timestamp": "2026-02-04T..."
}
```

**If health check fails:**
- Check Azure App Service logs
- Verify DATABASE_URL is set correctly
- Check backend logs: Azure Portal → App Service → Log stream

### 4.3 Verify Frontend Uses Proxy

1. **Open production**: https://odcrm.bidlow.co.uk
2. **Hard refresh**: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
3. **Open DevTools**: Press `F12`
4. **Go to Network tab**
5. **Perform action**: Load customers or create a record
6. **Check API requests**:
   - ✅ **CORRECT**: Requests go to `https://odcrm.bidlow.co.uk/api/customers`
   - ❌ **WRONG**: Requests go to `https://odcrm-api-*.azurewebsites.net/api/customers`

**If wrong:**
- Check GitHub Actions build logs
- Verify `VITE_API_URL` secret is not set (should default to empty)
- Rebuild frontend if needed

### 4.4 Test Data Persistence

1. **Create test data**:
   - Create a test customer/account
   - Create a test contact
   - Fill out a form
2. **Refresh page**: `Ctrl+Shift+R` or `Cmd+Shift+R`
3. **Verify data persists**: Data should still be there
4. **Check browser console**: No errors (F12 → Console)

**If data disappears:**
- Check backend logs for errors
- Verify database connection (health endpoint)
- Check browser console for API errors
- See troubleshooting in `PRODUCTION_RUNBOOK.md`

---

## 🔧 Step 5: Run Verification Script (Optional)

```bash
cd server
DATABASE_URL="your-production-database-url" npm run verify:prod
```

**Expected Output:**
```
🚀 Production Verification Script
================================
API URL: https://odcrm.bidlow.co.uk
Database: configured (postgresql://...)

🔍 Step 1: Checking /api/health endpoint...
✅ Health check passed: { ok: true, env: 'production', db: 'ok', customerCount: 123 }

🔍 Step 2: Testing database persistence...
   Creating test customer record...
   ✅ Created: { id: 'verify_...', name: '[VERIFY] Test Customer ...' }
   Reading test customer record...
   ✅ Read back successfully: { id: 'verify_...', name: '[VERIFY] Test Customer ...' }
   Cleaning up test record...
   ✅ Cleanup complete

🔍 Step 3: Verifying database connection...
✅ Database connection verified
   Customer count: 123

📊 Verification Summary
======================
Health Endpoint:     ✅ PASS
Database Connection: ✅ PASS
Data Persistence:   ✅ PASS

✅ All checks passed! Production is healthy.
```

---

## 📋 Summary Checklist

**Before Merging PR:**
- [x] GitHub secrets verified (`VITE_API_URL` not set)
- [ ] Azure App Service `DATABASE_URL` verified
- [x] Code builds successfully
- [x] PR created and ready for review

**After Merging PR:**
- [ ] GitHub Actions deployments completed successfully
- [ ] Health endpoint returns `ok: true, db: "ok"`
- [ ] Frontend uses `/api` proxy (not absolute backend URL)
- [ ] Data persistence tested and working
- [ ] No errors in browser console
- [ ] Verification script passes (optional)

---

## 🆘 Troubleshooting

### Health Endpoint Returns Error

**Check:**
1. Azure App Service logs: Portal → App Service → Log stream
2. DATABASE_URL is set correctly
3. Database firewall allows App Service IPs
4. PostgreSQL server is running

### Frontend Still Uses Absolute Backend URL

**Check:**
1. GitHub Actions build logs - verify `VITE_API_URL` is empty
2. Hard refresh browser (`Ctrl+Shift+R`)
3. Check `staticwebapp.config.json` proxy configuration

### Data Still Disappears

**Check:**
1. Backend logs for create/update errors
2. Database directly (Prisma Studio) to see if data exists
3. Browser Network tab for API response status codes
4. See `PRODUCTION_RUNBOOK.md` troubleshooting section

---

## 📞 Need Help?

- See `PRODUCTION_RUNBOOK.md` for detailed procedures
- Check GitHub Actions logs: https://github.com/gregvisser/ODCRM/actions
- Check Azure App Service logs: Azure Portal → App Service → Log stream
