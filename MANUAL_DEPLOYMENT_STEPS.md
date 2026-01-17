# Manual Deployment Steps - What YOU Need To Do

This document lists exactly what you need to do manually. I've automated everything I can - here's what requires your action.

## ✅ Already Automated

- ✅ Code changes (workers enabled)
- ✅ Helper scripts created
- ✅ Environment file templates ready
- ✅ Deployment documentation complete

---

## 🔧 Manual Steps Required

### STEP 1: Neon Database (15-30 minutes)

**Action Required:**
1. Go to https://neon.tech and sign up
2. Click "New Project"
3. Name: `ODCRM Production`
4. Copy the connection string (looks like: `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`)

**Then:**
```bash
# Update server/.env with your connection string
# DATABASE_URL="<paste-your-neon-connection-string-here>"

# Run migrations
npm run deploy:migrate
```

**OR use the interactive guide:**
```bash
npm run deploy:guide
```

**Status Check:**
- [ ] Neon account created
- [ ] Database project created
- [ ] Connection string copied
- [ ] `DATABASE_URL` updated in `server/.env`
- [ ] Migrations run successfully

---

### STEP 2: Azure App Registration (20-30 minutes)

**Action Required:**
1. Go to https://portal.azure.com
2. Navigate: **Azure Active Directory** → **App registrations** → **New registration**
3. Configure:
   - Name: `OpensDoors CRM Production`
   - Redirect URI: `https://api.yourdomain.com/api/outlook/callback` (use your actual domain)
   - Account types: "Accounts in any organizational directory and personal Microsoft accounts"
4. After creation, copy **Application (client) ID**
5. Go to **Certificates & secrets** → **New client secret** → Copy the **Value** (you won't see it again!)
6. Go to **API permissions** → Add:
   - `Mail.Send`
   - `Mail.Read`
   - `User.Read`
   - `offline_access`
7. Click **Grant admin consent**

**Then:**
Update `server/.env`:
```
MICROSOFT_CLIENT_ID=<paste-client-id>
MICROSOFT_CLIENT_SECRET=<paste-client-secret>
```

**OR use the interactive guide:**
```bash
npm run deploy:guide
```

**Status Check:**
- [ ] Azure app registered
- [ ] Client ID copied
- [ ] Client secret created and copied
- [ ] API permissions added
- [ ] Admin consent granted
- [ ] Credentials updated in `server/.env`

---

### STEP 3: Render Backend Deployment (30-45 minutes)

**Action Required:**
1. Go to https://render.com and sign up
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository (ODCRM)
4. Configure:
   - **Name**: `odcrm-api`
   - **Root Directory**: `server`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npx prisma generate && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: `Starter` ($7/month) - **Required for workers**
5. Add **Environment Variables** (from `server/.env`):
   ```
   DATABASE_URL=<your-neon-connection-string>
   PORT=3001
   NODE_ENV=production
   FRONTEND_URL=https://crm.yourdomain.com
   MICROSOFT_CLIENT_ID=<your-azure-client-id>
   MICROSOFT_CLIENT_SECRET=<your-azure-client-secret>
   MICROSOFT_TENANT_ID=common
   REDIRECT_URI=https://api.yourdomain.com/api/outlook/callback
   EMAIL_TRACKING_DOMAIN=https://api.yourdomain.com
   ```
6. Click **"Create Web Service"**
7. Wait for deployment (2-5 minutes)
8. Test: Visit `https://odcrm-api.onrender.com/health` (should return `{"status":"ok"}`)
9. (Optional) Add custom domain: `api.yourdomain.com`

**Status Check:**
- [ ] Render account created
- [ ] Backend service created
- [ ] All environment variables added
- [ ] Deployment successful
- [ ] Health endpoint working: `/health`
- [ ] Custom domain added (optional)

---

### STEP 4: Vercel Frontend Deployment (20-30 minutes)

**Action Required:**
1. Go to https://vercel.com and sign up
2. Click **"Add New Project"**
3. Import your GitHub repository (ODCRM)
4. Configure:
   - **Framework Preset**: `Vite` (important!)
   - **Root Directory**: Leave **blank** (not `./`)
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `dist` (auto-detected)
5. Add **Environment Variable**:
   ```
   VITE_API_URL=https://api.yourdomain.com
   ```
   (Use your Render backend URL if custom domain not set yet)
6. Click **"Deploy"**
7. Wait for deployment (1-2 minutes)
8. Test: Visit your Vercel URL (should load the CRM)
9. (Optional) Add custom domain: `crm.yourdomain.com`

**Status Check:**
- [ ] Vercel account created
- [ ] Frontend project created
- [ ] Environment variable `VITE_API_URL` added
- [ ] Deployment successful
- [ ] App loads without errors
- [ ] Custom domain added (optional)

---

### STEP 5: GoDaddy DNS Configuration (15-30 minutes + propagation)

**Action Required:**
1. Log into https://godaddy.com
2. Go to **My Products** → **Domains** → Select your domain
3. Click **"DNS"** or **"Manage DNS"**
4. Add **CNAME Record for Frontend**:
   - **Type**: `CNAME`
   - **Name**: `crm`
   - **Value**: Get from Vercel (after adding custom domain) or use `cname.vercel-dns.com`
   - **TTL**: `600`
5. Add **CNAME Record for Backend**:
   - **Type**: `CNAME`
   - **Name**: `api`
   - **Value**: Get from Render (after adding custom domain) or use `odcrm-api.onrender.com`
   - **TTL**: `600`
6. Wait 10-60 minutes for DNS propagation
7. Verify: Visit `https://crm.yourdomain.com` and `https://api.yourdomain.com/health`
8. Verify SSL certificates are active (lock icon in browser)

**Status Check:**
- [ ] DNS records added in GoDaddy
- [ ] DNS propagated (check at https://www.whatsmydns.net)
- [ ] `crm.yourdomain.com` loads correctly
- [ ] `api.yourdomain.com/health` works
- [ ] SSL certificates active (HTTPS lock icon)

---

### STEP 6: Create Production Customer (5-10 minutes)

**Action Required:**

**Option A: Using Script (Easier)**
```bash
npm run deploy:create-customer
```
Follow the prompts.

**Option B: Using Prisma Studio**
```bash
cd server
DATABASE_URL="<your-neon-connection-string>" npx prisma studio
```
Then:
1. Click **"Customer"** model
2. Click **"+ Add record"**
3. Fill in:
   - `id`: `prod-customer-1`
   - `name`: `OpensDoors`
   - `domain`: `yourdomain.com`
4. Click **"Save"**

**Set in Frontend:**
1. Visit `https://crm.yourdomain.com`
2. Open browser console (F12)
3. Run:
   ```javascript
   localStorage.setItem('currentCustomerId', 'prod-customer-1')
   ```
4. Refresh page

**Status Check:**
- [ ] Customer record created in database
- [ ] Customer ID set in browser localStorage
- [ ] CRM loads with customer context

---

### STEP 7: Testing & Verification (30-60 minutes)

**Action Required:**

1. **Test All Marketing Sub-Tabs:**
   - [ ] Overview
   - [ ] Campaigns
   - [ ] Sequences
   - [ ] People
   - [ ] Lists
   - [ ] Inbox
   - [ ] Reports
   - [ ] Templates
   - [ ] Email Accounts
   - [ ] Schedules
   - [ ] Cognism Prospects
   - [ ] Leads

2. **Test Outlook OAuth:**
   - [ ] Navigate to Marketing → Email Accounts
   - [ ] Click "Connect Outlook Account"
   - [ ] Complete Microsoft login
   - [ ] Grant permissions
   - [ ] Verify account appears in list

3. **Test Email Campaign:**
   - [ ] Create test contacts
   - [ ] Create email list
   - [ ] Create email sequence
   - [ ] Create campaign
   - [ ] Start campaign
   - [ ] Verify emails send
   - [ ] Test reply detection

4. **Verify Background Workers:**
   - [ ] Check Render logs for scheduler messages
   - [ ] Check Render logs for reply detection messages
   - [ ] Verify workers running every 1-5 minutes

**Status Check:**
- [ ] All Marketing sub-tabs functional
- [ ] Outlook OAuth works
- [ ] Email campaigns send
- [ ] Reply detection works
- [ ] Background workers running
- [ ] No console errors
- [ ] Health endpoints responding

---

## 🚀 Quick Command Reference

```bash
# Check prerequisites
npm run deploy:check

# Run migrations (after Neon setup)
npm run deploy:migrate

# Interactive deployment guide
npm run deploy:guide

# Create production customer
npm run deploy:create-customer
```

---

## 📋 Current Status

**Ready to Start:**
- ✅ Code changes complete
- ✅ Scripts ready
- ✅ Documentation complete

**Next Action:**
👉 **Start with STEP 1: Neon Database**

Follow the steps above, or use:
```bash
npm run deploy:guide
```

---

## 🆘 Need Help?

- **Detailed guide**: See `PRODUCTION_DEPLOYMENT_STEPS.md`
- **Quick checklist**: See `DEPLOYMENT_QUICK_START.md`
- **Environment setup**: See `DEPLOYMENT_ENV_SETUP.md`
