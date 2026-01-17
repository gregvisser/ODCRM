# Render Rollback Instructions - CRITICAL

## Problem

Backend keeps breaking because of Prisma schema changes. The backend that WAS working is still available - we just need to roll back to it.

---

## Solution: Rollback Render to Working Deployment

### Step 1: Find Working Deployment

1. Go to https://render.com/dashboard
2. Click your service: **odcrm-api**
3. Go to **Events** tab
4. Look for deployments that show "Deploy live"
5. Find a deployment from earlier today that was successful

**Look for commits around**:
- `777388b` - "Comment out SMTP implementation completely"
- `2270491` - "Fix schedules.ts type assertion"  
- `a648d81` - Earlier successful builds

### Step 2: Rollback

1. Click on a successful deployment in the Events tab
2. Click **"Rollback to this version"** or similar option
3. Confirm rollback
4. Service will redeploy with that working version

---

## Alternative: Manual Deploy Specific Commit

If rollback button isn't available:

1. Go to **Manual Deploy**
2. Select branch: `main`
3. Enter commit: `2270491` (or another working commit)
4. Deploy

---

## After Rollback

1. Backend will be running the working version
2. Email identities API will work
3. Frontend can fetch greg@bidlow.co.uk
4. Campaigns will work

---

## DO NOT Auto-Deploy New Commits

After rolling back:
1. Settings → Build & Deploy
2. **Disable** auto-deploy (if possible)
3. Or manually control when to deploy

This prevents broken schemas from auto-deploying.

---

**DO THIS NOW**: Rollback Render to commit `2270491` or `777388b` (whichever shows as successful)
