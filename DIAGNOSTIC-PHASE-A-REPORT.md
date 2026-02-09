# Production Diagnostic Report - Phase A

**Date:** 2026-02-09  
**Status:** 🔄 DIAGNOSTIC DEPLOYMENT IN PROGRESS  
**Commit:** `12f3d1f` - DIAGNOSTIC: Add build fingerprint + API base display + request logging

---

## 🎯 OBJECTIVE

Deploy diagnostic instrumentation to **PROVE** what's actually running in production and identify the root cause of:
1. Customers not showing in OpenDoors Customers tab
2. Google Sheets not labeled (showing ugly URL)
3. No visible changes after hotfix deployment

---

## 🔧 PHASE A: DIAGNOSTIC INSTRUMENTATION DEPLOYED

### 1. Build Fingerprint Display

**Added:** Visible diagnostic banner at bottom of screen

**Displays:**
- **Git SHA:** Short commit hash (7 chars)
- **Build Time:** ISO timestamp of when frontend was built
- **API Base URL:** Shows what API the frontend is calling

**Implementation:**
- `vite.config.ts`: Added Git SHA extraction at build time
- `src/components/DiagnosticBanner.tsx`: Yellow banner component
- `src/App.tsx`: Banner added to app footer
- `src/vite-env.d.ts`: TypeScript declarations for build constants

**Purpose:** Prove whether production is serving latest code or cached/old bundle

### 2. API Request Logging

**Added:** Console logging for ALL API requests

**Logs:**
- `[API] GET /api/customers` - Before request
- `[API] GET /api/customers -> 200` - After response with status
- `[API SUCCESS] /api/customers: {...}` - Response body
- `[API ERROR] /api/customers: {...}` - Error details if failed

**Implementation:**
- `src/utils/api.ts`: Enhanced apiRequest function with logging

**Purpose:** Capture exact request/response to identify failures

### 3. Expected Diagnostic Banner Content

Once deployed, production should show:

```
[BUILD] 12f3d1f  [TIME] 2026-02-09 13:41:31  [API] (relative URLs - Azure SWA proxy)
```

**Critical Checks:**
- ✅ If SHA shows `12f3d1f` → Latest code deployed
- ❌ If SHA shows older hash → Frontend not updated (cache issue)
- ✅ If API shows "(relative URLs...)" → Correct (uses Azure SWA proxy)
- ❌ If API shows "http://localhost:3001" → WRONG (dev config in prod)

---

## 📊 DEPLOYMENT STATUS

### Frontend Deployment
- **Status:** 🔄 IN PROGRESS
- **Started:** 13:41:31 UTC
- **Expected Duration:** ~1-2 minutes
- **Workflow:** Deploy Frontend to Azure Static Web Apps
- **Run ID:** 21827404345

### Backend Deployment (Previous)
- **Status:** ✅ COMPLETE
- **Deployed:** 13:29:34 UTC (hotfix migration)
- **Commit:** `734daf5`
- **Migration:** agreement fields added to database

---

## 🔍 PHASE B: EVIDENCE COLLECTION (AFTER DEPLOYMENT)

Once diagnostic deployment completes, user should:

### 1. Check Diagnostic Banner
- Open: https://odcrm.bidlow.co.uk
- Hard refresh: Ctrl+Shift+R
- Check yellow banner at bottom
- **Record:** Git SHA, Build Time, API Base shown

### 2. Check Browser Console (F12)
- Open Console tab
- Navigate to OpenDoors Customers tab
- **Look for:** `[API] GET /api/customers` logs
- **Record:** 
  - Request URL
  - Response status
  - Response body (success or error)

### 3. Check Network Tab (F12)
- Open Network tab
- Clear network log
- Navigate to OpenDoors Customers tab
- Filter for "customers"
- **Record:**
  - GET /api/customers request
  - Status code
  - Response preview

### 4. Check for JavaScript Errors
- Console tab should show any runtime errors
- **Look for:**
  - TypeError: Cannot read property...
  - Failed to fetch...
  - JSON parse errors

---

## 🎯 EXPECTED FINDINGS

### Scenario 1: Frontend Cache Issue
**Evidence:**
- Diagnostic banner shows OLD SHA (not `12f3d1f`)
- Banner shows `http://localhost:3001` as API base
- Console has no `[API]` logs

**Root Cause:** Azure SWA not serving latest bundle
**Fix:** Force cache invalidation, redeploy with cache busting

### Scenario 2: Backend Returning Errors
**Evidence:**
- Diagnostic banner shows correct SHA `12f3d1f`
- Console shows `[API] GET /api/customers -> 500`
- Response body has error message

**Root Cause:** Backend exception (likely serialization)
**Fix:** Fix backend route, redeploy backend

### Scenario 3: Wrong API Configuration
**Evidence:**
- Diagnostic banner shows `http://localhost:3001`
- Console shows CORS errors or connection refused

**Root Cause:** Production built with dev env vars
**Fix:** Rebuild without VITE_API_URL set

### Scenario 4: Frontend Parsing Failure
**Evidence:**
- Console shows `[API SUCCESS] /api/customers: [...]`
- Response has data (200 OK)
- But UI shows empty/no customers
- JavaScript error in console

**Root Cause:** Frontend can't parse response shape
**Fix:** Fix mapper or component rendering logic

---

## 📋 VERIFICATION CHECKLIST

**MANDATORY - Complete these steps:**

### Step 1: Confirm Deployment
- [ ] GitHub Actions shows "Deploy Frontend" completed with success
- [ ] Timestamp is recent (~13:42 UTC or later)

### Step 2: Confirm Latest Code Loaded
- [ ] Open https://odcrm.bidlow.co.uk
- [ ] Hard refresh (Ctrl+Shift+R)
- [ ] Diagnostic banner visible at bottom
- [ ] Banner shows Git SHA: `12f3d1f` (or later)
- [ ] Banner shows API: "(relative URLs - Azure SWA proxy)"

### Step 3: Capture API Request Evidence
- [ ] Open browser console (F12)
- [ ] Navigate to Customers tab (OpenDoors Customers / Accounts)
- [ ] See `[API] GET /api/customers` in console
- [ ] See response status: `[API] GET /api/customers -> ???`
- [ ] Copy full console output (20-30 lines around the request)

### Step 4: Capture Network Evidence
- [ ] Network tab shows GET /api/customers
- [ ] Record status code: ___
- [ ] Copy response body (first 500 chars)

### Step 5: Check for Errors
- [ ] Console tab checked for red errors
- [ ] Record any TypeErrors, ReferenceErrors, etc.

---

## 🚨 CRITICAL DECISION TREE

Based on evidence collected:

### IF: Banner shows OLD SHA
→ **Frontend not deploying**
→ Action: Investigate Azure SWA deployment, check build logs

### IF: Banner shows correct SHA BUT API is localhost
→ **Built with wrong env vars**
→ Action: Rebuild production without VITE_API_URL

### IF: Banner correct AND console shows 500 error
→ **Backend failing**
→ Action: Check Azure App Service logs, fix backend

### IF: Banner correct AND console shows 200 success BUT UI empty
→ **Frontend rendering issue**
→ Action: Debug mapper/component logic

### IF: Banner correct AND no API requests in console
→ **Hook not firing or conditional rendering blocking**
→ Action: Check AccountsTabDatabase mounting logic

---

## 📝 NEXT STEPS

1. **WAIT** for frontend deployment to complete (~2 minutes from start)
2. **VERIFY** deployment succeeded in GitHub Actions
3. **COLLECT** evidence using checklist above
4. **ANALYZE** evidence against decision tree
5. **IMPLEMENT** minimal fix based on root cause
6. **VERIFY** fix resolves all symptoms

**DO NOT PROCEED** to new features until:
- ✅ Diagnostic banner shows correct SHA
- ✅ GET /api/customers returns 200 with data
- ✅ Customers tab displays customer list
- ✅ Google Sheet label displays correctly (not raw URL)

---

**Created:** 2026-02-09 13:43 UTC  
**Deployment Status:** 🔄 AWAITING COMPLETION  
**Next Update:** After frontend deployment completes
