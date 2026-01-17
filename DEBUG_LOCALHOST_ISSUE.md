# Debug Localhost Issue

## Problem

Frontend still redirecting to localhost:3001 instead of odcrm-api.onrender.com

---

## Debugging Steps

### Step 1: Verify Latest Deployment

1. Go to Vercel dashboard → Deployments tab
2. Check the top deployment:
   - **Status**: Should be "Ready" (green)
   - **Commit**: Should be `254c338` or newer
   - **Message**: Should include "Add smart API URL fallback"

If it's an older commit, wait for deployment to complete.

---

### Step 2: Clear Browser Cache

The issue might be browser caching the old JavaScript files.

**Hard Refresh:**
- **Windows**: Ctrl+Shift+R or Ctrl+F5
- **Mac**: Cmd+Shift+R

**Or Clear Cache:**
1. Press F12 (open DevTools)
2. Right-click the refresh button
3. Click "Empty Cache and Hard Reload"

---

### Step 3: Verify You're on the New Version

In browser console (F12 → Console), type:

```javascript
window.location.hostname
```

**Should show**: Part of vercel.app domain (like `gregvisser-odcrm-xxx.vercel.app`)

**If shows**: `localhost` → You're running a local version, not the deployed one!

---

### Step 4: Check Which URL You're Visiting

Make sure you're visiting:
- ✅ **https://odcrm.vercel.app** (or your full Vercel URL)
- ❌ **NOT** http://localhost:5173

---

### Step 5: Force Check API URL

In console, type:

```javascript
console.log(import.meta.env.VITE_API_URL)
```

**Expected**:
- Shows: `https://odcrm-api.onrender.com`
- OR Shows: `undefined` (but code falls back to production URL)

---

## If Still Not Working

### Option 1: Hardcode API URL (Quick Fix)

I can hardcode the production API URL so it always works, regardless of environment variables.

### Option 2: Check Network Tab

1. F12 → Network tab
2. Try connecting Outlook
3. Look at the request URL
4. Screenshot the failed request

This will show us what URL it's actually trying to connect to.

---

## Quick Diagnostic

Please check:
1. What's the URL in your browser address bar?
2. What does `window.location.hostname` show in console?
3. Is Vercel deployment status "Ready" for commit 254c338?

Let me know and I'll help fix it!
