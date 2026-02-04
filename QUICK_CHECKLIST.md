# Quick Setup Checklist

## ✅ Step 1: Check Azure Configuration (5 minutes)

**Current Location:** You're on "General settings" page

**What to do:**
1. In left sidebar, click **"Configuration"** (gear icon ⚙️)
2. Click **"Application settings"** tab at the top
3. Look for `DATABASE_URL` in the list

**If DATABASE_URL exists:**
- ✅ You're good! Just verify it starts with `postgresql://`
- Move to Step 2

**If DATABASE_URL is missing:**
- Click **"+ New application setting"**
- Name: `DATABASE_URL`
- Value: Copy from GitHub Secrets → `DATABASE_URL`
- Click "OK" → "Save"
- Wait for restart (~1 minute)
- Move to Step 2

---

## ✅ Step 2: Create Pull Request (2 minutes)

**Current Location:** GitHub compare page (screenshot 1)

**What to do:**
1. Click the green **"Create pull request"** button
2. **Title:** `Fix: Production persistence and deployment reliability`
3. **Description:** Copy everything from `PR_DESCRIPTION.md` (or use the summary below)
4. Click **"Create pull request"**

**Quick PR Description (copy this):**
```
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
- [ ] Azure App Service DATABASE_URL verified (see Step 1)
- [x] Backend builds successfully
- [x] No TypeScript errors

## Testing After Merge
1. Monitor GitHub Actions deployments
2. Verify health endpoint: `curl https://odcrm.bidlow.co.uk/api/health`
3. Test data persistence in production UI
```

---

## ✅ Step 3: After PR is Merged (10 minutes)

1. **Monitor GitHub Actions:**
   - Go to: https://github.com/gregvisser/ODCRM/actions
   - Wait for both workflows to complete (~3-5 minutes each)
   - Look for green checkmarks ✅

2. **Verify Health Endpoint:**
   ```bash
   curl https://odcrm.bidlow.co.uk/api/health
   ```
   Should return: `{"ok": true, "db": "ok", ...}`

3. **Test in Browser:**
   - Open: https://odcrm.bidlow.co.uk
   - Hard refresh: `Ctrl+Shift+R`
   - Create a test customer/contact
   - Refresh page - data should persist ✅

---

## 🆘 Need Help?

**Azure Navigation:**
- You're looking for: Configuration → Application settings
- Current page: General settings (wrong page)
- Need: Application settings tab (right tab)

**GitHub PR:**
- Current page: Compare page (not a PR yet)
- Need: Click "Create pull request" button
- Then: Fill in title and description

**Questions?**
- See `DEPLOYMENT_INSTRUCTIONS.md` for detailed steps
- See `PRODUCTION_RUNBOOK.md` for troubleshooting
