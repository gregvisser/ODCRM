# Verify Vercel Environment Variable

## Check if VITE_API_URL is Actually Set

1. Go to Vercel dashboard: https://vercel.com/dashboard
2. Click project: **odcrm**
3. Click **Settings** → **Environment Variables**
4. Look for: **VITE_API_URL**

### Should show:
- **Key**: VITE_API_URL
- **Value**: https://odcrm-api.onrender.com
- **Environments**: ☑ Production (checked)

### If NOT there or Production is unchecked:
1. Add it or edit it
2. Make sure **Production** checkbox is checked
3. Save
4. Redeploy

### If it IS there and Production is checked:
The variable is set correctly, just need one more deploy to pick it up.

---

## Force Clean Redeploy

After verifying variable is set:

1. Go to **Deployments** tab
2. Find latest deployment
3. Click **"..."** menu
4. Click **"Redeploy"**
5. **IMPORTANT**: Uncheck "Use existing Build Cache"
6. Click **"Redeploy"**

This forces Vercel to rebuild from scratch with the environment variable.

---

## Verify After Deployment

1. Visit: https://odcrm.vercel.app
2. Open console (F12)
3. Type: `import.meta.env.VITE_API_URL`
4. Should show: `"https://odcrm-api.onrender.com"`

If it shows `undefined`, the variable still isn't set correctly.
