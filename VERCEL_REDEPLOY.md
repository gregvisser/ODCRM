# Vercel Redeploy Instructions

## Issue

Vercel is building an old commit (`777388b`) but the latest commit is `e41156a` which has all the build fixes.

## Solution

Manually trigger a redeploy with the latest commit:

### Option 1: Redeploy in Vercel Dashboard

1. Go to Vercel dashboard
2. Click on your project (`odcrm`)
3. Go to **Deployments** tab
4. Click **"..."** menu (three dots) on the right
5. Click **"Redeploy"**
6. Make sure "Use existing Build Cache" is **unchecked**
7. Click **"Redeploy"**

### Option 2: Push a New Commit

If redeploying doesn't work, push a new commit to trigger build:

```bash
git commit --allow-empty -m "Trigger Vercel redeploy"
git push
```

This creates an empty commit that will trigger Vercel to rebuild.

---

## What to Expect

After redeploying with the latest commit (`e41156a` or newer):
- ✅ TypeScript build should succeed
- ✅ No TS6133 unused variable errors
- ✅ Build completes in ~1-2 minutes
- ✅ Deployment succeeds

---

## Verify Latest Commit

Check that Vercel is building the correct commit:
- Latest commit: `e41156a` or newer
- Should see: "Fix ContactsTab and MarketingPeopleTab to use correct types"

If Vercel shows `777388b`, it's building the wrong commit - trigger redeploy.
