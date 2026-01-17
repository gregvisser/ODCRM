# Manual Vercel Deployment - Deploy Specific Commit

## Problem

Vercel is deploying commit `e98ff2f` but we need commit `254c338` which has the API URL fix.

---

## Solution: Manual Deploy in Vercel

### Option 1: Redeploy Latest

1. Go to Vercel dashboard → **Deployments** tab
2. Click **"..."** menu on the TOP deployment
3. Click **"Redeploy"**
4. Uncheck "Use existing Build Cache"
5. Click **"Redeploy"**

### Option 2: Deploy Specific Commit

If Option 1 doesn't work:

1. Go to Vercel dashboard
2. Click **"Deployments"** tab
3. Click **"Deploy"** button (if available)
4. Or use Vercel CLI:
   ```bash
   npx vercel --prod
   ```

### Option 3: Check Git Integration

1. Vercel Settings → **Git**
2. Verify connected to correct repository
3. Verify watching correct branch: `main`
4. Try disconnecting and reconnecting

---

## Verify Correct Commit

After deployment, check that it shows:
- **Commit**: `254c338` or newer
- **Message**: "Add smart API URL fallback for production"

---

I've pushed another commit to trigger auto-deployment. Check if Vercel picks it up.
