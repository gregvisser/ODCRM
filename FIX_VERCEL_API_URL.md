# Fix Vercel API URL Configuration

## Problem

Frontend is trying to connect to `localhost:3001` instead of `https://odcrm-api.onrender.com`

This means `VITE_API_URL` environment variable isn't set in Vercel.

---

## Solution

### Step 1: Add Environment Variable in Vercel

1. Go to https://vercel.com/dashboard
2. Click your project: **odcrm**
3. Click **Settings** (top menu)
4. Click **Environment Variables** (left sidebar)
5. Click **Add** or **Add Environment Variable**
6. Fill in:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://odcrm-api.onrender.com`
   - **Environment**: Check **Production** (and Preview if you want)
7. Click **Save**

### Step 2: Redeploy

After adding the variable:
1. Go to **Deployments** tab (top menu)
2. Click **"..."** menu on the latest deployment
3. Click **"Redeploy"**
4. Uncheck "Use existing Build Cache"
5. Click **"Redeploy"**

OR simply push a new commit:
```bash
git commit --allow-empty -m "Redeploy with VITE_API_URL"
git push
```

### Step 3: Verify

After deployment completes:
1. Visit https://odcrm.vercel.app
2. Open console (F12)
3. Type: `import.meta.env.VITE_API_URL`
4. Should show: `https://odcrm-api.onrender.com`
5. If it shows `undefined`, the variable isn't set

---

## Quick Fix Command

I can push an empty commit to trigger redeploy for you.

Let me know if you want me to do that, or you can add the variable in Vercel manually.
