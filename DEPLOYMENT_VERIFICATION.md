# Deployment Verification Checklist

**Date:** January 23, 2026  
**Commit:** `8dd0999` - Configure production-ready environment setup  
**Status:** Code pushed to GitHub ✅

---

## ✅ Step 1: GitHub Push - COMPLETE

- [x] Changes committed locally
- [x] Pushed to `origin/main`
- [x] Commit visible on GitHub: https://github.com/gregvisser/ODCRM

---

## 📋 Step 2: Verify Vercel Connection

### Check if Vercel is Connected

1. **Go to Vercel Dashboard:** https://vercel.com/dashboard
2. **Look for your project:** `ODCRM` or similar name
3. **Check deployment status:**
   - Should show "Building" or "Ready"
   - Should show latest commit `8dd0999`

### If Vercel is Connected:

- [ ] Vercel shows deployment in progress or completed
- [ ] Build logs show no errors
- [ ] Preview URL works (click to test)

### If Vercel is NOT Connected:

**Connect it now:**

1. Go to https://vercel.com/new
2. Click "Import Git Repository"
3. Select `gregvisser/ODCRM`
4. Configure:
   - **Root Directory:** `./` (leave as default)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
5. Click "Deploy"

### Set Vercel Environment Variables

**Required** (set in Vercel Dashboard → Settings → Environment Variables):

```env
VITE_API_URL=https://api.bidlow.co.uk
VITE_AZURE_CLIENT_ID=c4fd4112-e6e0-4a34-a9a3-c1465bf4f90d
VITE_AZURE_TENANT_ID=common
VITE_AZURE_REDIRECT_URI=https://www.bidlow.co.uk
```

**Optional:**
```env
VITE_AUTH_ALLOWED_EMAILS=your-email@domain.com
VITE_AUTH_ALLOWED_DOMAINS=yourdomain.com
```

⚠️ **After setting env vars, redeploy:**
- Go to Deployments → Latest → ⋯ Menu → Redeploy

### Configure Custom Domain

- [ ] Add domain: `www.bidlow.co.uk`
- [ ] Update DNS (follow Vercel's instructions)
- [ ] Verify SSL certificate issued

---

## 📋 Step 3: Verify Render Connection

### Check if Render is Connected

1. **Go to Render Dashboard:** https://dashboard.render.com
2. **Look for your service:** Backend API service
3. **Check deployment status:**
   - Should show "Building" or "Live"
   - Should show latest commit `8dd0999`

### If Render is Connected:

- [ ] Render shows deployment in progress or live
- [ ] Build logs show no errors
- [ ] Service URL is active

### If Render is NOT Connected:

**Connect it now:**

1. Go to https://dashboard.render.com/create
2. Select "Web Service"
3. Connect your GitHub repository: `gregvisser/ODCRM`
4. Configure:
   - **Name:** `odcrm-api`
   - **Root Directory:** `server`
   - **Runtime:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start`
   - **Branch:** `main`
5. Click "Create Web Service"

### Set Render Environment Variables

**Required** (set in Render Dashboard → Environment):

```env
NODE_ENV=production
PORT=10000

# Database (get from Neon dashboard)
DATABASE_URL=postgresql://neondb_owner:npg_V68MsRrTpEwI@ep-steep-water-ad5t53l2-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require

# CORS
FRONTEND_URL=https://www.bidlow.co.uk
FRONTEND_URLS=https://www.bidlow.co.uk,https://bidlow.co.uk

# Microsoft OAuth
MICROSOFT_CLIENT_ID=c4fd4112-e6e0-4a34-a9a3-c1465bf4f90d
MICROSOFT_CLIENT_SECRET=0bdcd959-9595-434e-8a39-00fe2a65e935
MICROSOFT_TENANT_ID=common
REDIRECT_URI=https://api.bidlow.co.uk/api/outlook/callback

# Email tracking
EMAIL_TRACKING_DOMAIN=https://api.bidlow.co.uk

# Workers
LEADS_SYNC_DISABLED=false
ABOUT_ENRICHMENT_DISABLED=false
EMAIL_WORKERS_DISABLED=true
```

**Optional but recommended:**
```env
OPENAI_API_KEY=your-key-here
CLEARBIT_API_KEY=your-key-here
```

⚠️ **After setting env vars:**
- Render will auto-redeploy
- Check logs for startup success

### Configure Custom Domain (Optional)

- [ ] Add domain: `api.bidlow.co.uk`
- [ ] Update DNS CNAME to Render
- [ ] Verify SSL certificate

**OR** use default Render URL:
- Format: `https://odcrm-api.onrender.com`
- Update `VITE_API_URL` in Vercel to match

---

## 📋 Step 4: Verify Database (Neon)

### Check Neon Connection

1. **Go to Neon Console:** https://console.neon.tech
2. **Find your project:** `neondb`
3. **Get connection string:**
   - Go to Dashboard → Connection Details
   - Copy the pooled connection string

### Verify in Render:

- [ ] `DATABASE_URL` in Render matches Neon connection string
- [ ] Connection string includes `?sslmode=require`

### Apply Migrations (if needed)

**Via Render Shell:**
```bash
# In Render Dashboard → Shell
npm run prisma:migrate:deploy
```

---

## 📋 Step 5: Verify Azure App Registration

### Check Redirect URIs

1. **Go to Azure Portal:** https://portal.azure.com
2. **Navigate to:** App Registrations → Your App
3. **Click:** Authentication
4. **Verify these Redirect URIs exist:**

Frontend:
- `https://www.bidlow.co.uk`
- `http://localhost:5173` (for local dev)

Backend:
- `https://api.bidlow.co.uk/api/outlook/callback`
- `http://localhost:3001/api/outlook/callback` (for local dev)

### If URLs are missing:

- [ ] Add production URIs
- [ ] Click "Save"

---

## 🧪 Step 6: Test Everything

### Test Frontend

- [ ] **Visit:** https://www.bidlow.co.uk (or Vercel preview URL)
- [ ] **Check:** Page loads without errors
- [ ] **Check:** No console errors (F12 → Console)
- [ ] **Check:** Can login with Microsoft account

### Test Backend

- [ ] **Visit:** https://api.bidlow.co.uk/health (or `{render-url}/health`)
- [ ] **Check:** Returns JSON: `{"status":"ok","timestamp":"..."}`

### Test API Connection

- [ ] **Login to frontend**
- [ ] **Try to create/view data**
- [ ] **Check browser console:** No CORS errors
- [ ] **Verify:** Data persists (backend communicating with database)

### Test OAuth Flow

- [ ] **Click "Connect Outlook"** in Email Settings
- [ ] **Check:** Redirects to Microsoft login
- [ ] **Check:** Redirects back to app after auth
- [ ] **Check:** Email account shows as connected

---

## 🚨 Troubleshooting

### Frontend shows blank page
**Check:**
- Vercel build logs for errors
- Browser console for errors
- `VITE_API_URL` is set in Vercel env vars

### CORS errors in browser
**Check:**
- `FRONTEND_URL` in Render matches frontend domain exactly
- Include/exclude `www` consistently
- Check for `http` vs `https` mismatch

### Backend won't start
**Check:**
- Render logs for error messages
- `DATABASE_URL` is set correctly
- All required env vars are set
- Try redeploying in Render

### Can't login / OAuth fails
**Check:**
- Azure redirect URIs match production URLs
- `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET` are correct
- `REDIRECT_URI` in Render env vars is correct

### Database errors
**Check:**
- Neon database is running (check Neon console)
- `DATABASE_URL` includes `?sslmode=require`
- Migrations applied via `npm run prisma:migrate:deploy`

---

## 📊 Current Status

Track your progress:

- [ ] GitHub push complete
- [ ] Vercel connected and deployed
- [ ] Vercel env vars set
- [ ] Vercel custom domain configured
- [ ] Render connected and deployed
- [ ] Render env vars set
- [ ] Render custom domain configured (or using default URL)
- [ ] Database migrations applied
- [ ] Azure redirect URIs updated
- [ ] Frontend loads successfully
- [ ] Backend health check passes
- [ ] OAuth login works
- [ ] Data persists correctly

---

## 🎉 When Everything is Green

Once all checkboxes are complete:

1. **Test thoroughly** - Create a customer, add contacts, send test email
2. **Monitor logs** - Check Render logs for any errors
3. **Document issues** - Note any problems for future reference
4. **Celebrate!** 🚀 Your app is live!

---

## 📞 Support Resources

- **Vercel Docs:** https://vercel.com/docs
- **Render Docs:** https://render.com/docs
- **Neon Docs:** https://neon.tech/docs
- **Project Docs:** `docs/ENVIRONMENTS.md`

---

**Next:** Go through each section above and check off items as you verify them!
