# Production Deployment Steps - Quick Reference

This document provides step-by-step instructions for deploying ODCRM to production. Follow these steps in order.

## Prerequisites

- [x] Environment files created (`server/.env` and `.env`)
- [x] Background workers re-enabled in `server/src/index.ts`
- [ ] GoDaddy domain name ready
- [ ] Microsoft Azure account access

---

## Phase 1: Cloud Database Setup (Neon)

**Estimated Time: 15-30 minutes**

1. **Sign up at Neon**
   - Go to https://neon.tech
   - Sign up for free account
   - Email verification required

2. **Create Project**
   - Click "New Project"
   - Project name: `ODCRM Production`
   - Region: Choose closest to your users (e.g., `US East`)
   - PostgreSQL version: `15` (or latest)
   - Click "Create Project"

3. **Get Connection String**
   - After project creation, you'll see a connection string
   - Format: `postgresql://username:password@host/neondb?sslmode=require`
   - Click "Copy" to copy the connection string
   - **Important**: Save this securely - you'll need it for `server/.env`

4. **Update server/.env**
   ```bash
   # Edit server/.env and update DATABASE_URL:
   DATABASE_URL="<paste-connection-string-here>"
   ```

5. **Run Migrations**
   ```bash
   cd server
   npx prisma migrate deploy
   ```
   Expected output: "All migrations have been successfully applied"

6. **Verify Database**
   ```bash
   # Option 1: Use Prisma Studio (connect to Neon)
   DATABASE_URL="<your-neon-connection-string>" npx prisma studio
   
   # Option 2: Use Neon SQL Editor
   # Go to Neon dashboard → SQL Editor → Run:
   SELECT tablename FROM pg_tables WHERE schemaname = 'public';
   ```
   Should see: customers, contacts, email_identities, email_campaigns, etc.

**✅ Phase 1 Complete:** Database is provisioned and migrated.

---

## Phase 2: Microsoft Azure App Registration

**Estimated Time: 20-30 minutes**

1. **Access Azure Portal**
   - Go to https://portal.azure.com
   - Sign in with Microsoft account
   - Navigate to **Azure Active Directory** → **App registrations**

2. **Create App Registration**
   - Click **"+ New registration"**
   - Configure:
     - **Name**: `OpensDoors CRM Production`
     - **Supported account types**: 
       - Select "Accounts in any organizational directory and personal Microsoft accounts"
     - **Redirect URI**:
       - Platform: `Web`
       - URI: `https://api.yourdomain.com/api/outlook/callback`
       - **Note**: Update this after backend deployment with actual URL
   - Click **"Register"**

3. **Copy Application (Client) ID**
   - After registration, you'll see the Overview page
   - Copy the **Application (client) ID**
   - Save this - you'll need it for `server/.env`

4. **Create Client Secret**
   - Go to **Certificates & secrets** (left sidebar)
   - Click **"+ New client secret"**
   - Description: `Production Secret`
   - Expires: Choose 12 or 24 months
   - Click **"Add"**
   - **IMPORTANT**: Copy the **Value** immediately (you won't see it again!)
   - Save this securely - you'll need it for `server/.env`

5. **Configure API Permissions**
   - Go to **API permissions** (left sidebar)
   - Click **"+ Add a permission"**
   - Select **Microsoft Graph**
   - Select **Delegated permissions**
   - Search and add these permissions:
     - `Mail.Send` - Send mail as the user
     - `Mail.Read` - Read user mail
     - `User.Read` - Sign in and read user profile
     - `offline_access` - Maintain access to data you have given it access to
   - Click **"Add permissions"**

6. **Grant Admin Consent**
   - After adding permissions, click **"Grant admin consent for [Your Organization]"**
   - Click **"Yes"** to confirm
   - All permissions should now show "Granted for [Your Organization]"

7. **Update server/.env**
   ```bash
   # Edit server/.env and update:
   MICROSOFT_CLIENT_ID=<paste-client-id-here>
   MICROSOFT_CLIENT_SECRET=<paste-client-secret-value-here>
   MICROSOFT_TENANT_ID=common
   ```

**✅ Phase 2 Complete:** Azure app is registered (update REDIRECT_URI after backend deployment).

---

## Phase 3: Backend Deployment (Render)

**Estimated Time: 30-45 minutes**

1. **Sign up at Render**
   - Go to https://render.com
   - Sign up (GitHub login recommended)
   - Email verification required

2. **Connect GitHub Repository**
   - Click **"New +"** → **"Web Service"**
   - Connect your GitHub account if not already connected
   - Select repository: `ODCRM` (or your repo name)

3. **Configure Web Service**
   - **Name**: `odcrm-api`
   - **Region**: Choose closest to your database region
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: `server`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npx prisma generate && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: `Starter` ($7/month) - **Required for persistent connections**
   - Click **"Create Web Service"**

4. **Add Environment Variables**
   In Render dashboard → Your service → **Environment** tab, add:
   ```
   DATABASE_URL = <your-neon-connection-string>
   PORT = 3001
   NODE_ENV = production
   FRONTEND_URL = https://crm.yourdomain.com
   MICROSOFT_CLIENT_ID = <your-azure-client-id>
   MICROSOFT_CLIENT_SECRET = <your-azure-client-secret>
   MICROSOFT_TENANT_ID = common
   REDIRECT_URI = https://api.yourdomain.com/api/outlook/callback
   EMAIL_TRACKING_DOMAIN = https://api.yourdomain.com
   ```
   **Note**: Replace `yourdomain.com` with your actual domain

5. **Deploy**
   - Render will automatically start building
   - Watch the build logs for errors
   - Build should complete in 2-5 minutes
   - After build, service will be running

6. **Verify Deployment**
   - Note your Render URL: `https://odcrm-api.onrender.com`
   - Test health endpoint: `https://odcrm-api.onrender.com/health`
   - Should return: `{"status":"ok","timestamp":"..."}`
   - Check logs for workers starting: Should see "📧 Starting email scheduler..." and "📬 Starting reply detection worker..."

7. **Add Custom Domain (Optional - Can Do After DNS Setup)**
   - In Render dashboard → Your service → **Settings** → **Custom Domains**
   - Click **"Add Custom Domain"**
   - Enter: `api.yourdomain.com`
   - Render will show DNS instructions (save for Phase 5)

**✅ Phase 3 Complete:** Backend is deployed and workers are running.

---

## Phase 4: Frontend Deployment (Vercel)

**Estimated Time: 20-30 minutes**

1. **Sign up at Vercel**
   - Go to https://vercel.com
   - Sign up (GitHub login recommended)
   - Email verification required

2. **Import Project**
   - Click **"Add New Project"**
   - Import your GitHub repository: `ODCRM`
   - Click **"Import"**

3. **Configure Project**
   - **Project Name**: `odcrm` (or leave default)
   - **Framework Preset**: `Vite` (important!)
   - **Root Directory**: Leave **blank** (not `./`)
   - **Build Command**: `npm run build` (should be auto-detected)
   - **Output Directory**: `dist` (should be auto-detected)
   - **Install Command**: `npm install` (should be auto-detected)
   - Click **"Deploy"**

4. **Add Environment Variable**
   After first deployment (or go to Settings → Environment Variables):
   - Click **"Add Environment Variable"**
   - Key: `VITE_API_URL`
   - Value: `https://api.yourdomain.com` (or `https://odcrm-api.onrender.com` for testing)
   - Environment: `Production` (and `Preview` if you want)
   - Click **"Save"**
   - **Redeploy** after adding environment variable

5. **Verify Deployment**
   - Note your Vercel URL: `https://odcrm.vercel.app`
   - Visit the URL - should load the CRM app
   - Open browser console (F12) - check for errors
   - Test API connection - navigate to Marketing tab

6. **Add Custom Domain (Optional - Can Do After DNS Setup)**
   - In Vercel dashboard → Your project → **Settings** → **Domains**
   - Click **"Add Domain"**
   - Enter: `crm.yourdomain.com`
   - Vercel will show DNS instructions (save for Phase 5)

**✅ Phase 4 Complete:** Frontend is deployed and accessible.

---

## Phase 5: DNS Configuration (GoDaddy)

**Estimated Time: 15-30 minutes + propagation time (10-60 minutes)**

1. **Log into GoDaddy**
   - Go to https://godaddy.com
   - Sign in to your account
   - Go to **My Products** → **Domains** → Select your domain

2. **Access DNS Management**
   - Click **"DNS"** or **"Manage DNS"**
   - You'll see current DNS records

3. **Add CNAME Record for Frontend**
   - Click **"Add"** or **"+ Add Record"**
   - **Type**: `CNAME`
   - **Name**: `crm`
   - **Value**: Get from Vercel:
     - If custom domain already added in Vercel: Use value shown in Vercel dashboard
     - Otherwise: `cname.vercel-dns.com` (temporary - update after adding domain in Vercel)
   - **TTL**: `600` (or default)
   - Click **"Save"**

4. **Add CNAME Record for Backend API**
   - Click **"Add"** or **"+ Add Record"** again
   - **Type**: `CNAME`
   - **Name**: `api`
   - **Value**: Get from Render:
     - If custom domain already added in Render: Use value shown in Render dashboard
     - Otherwise: `odcrm-api.onrender.com` (temporary)
   - **TTL**: `600` (or default)
   - Click **"Save"**

5. **Update Azure Redirect URI** (Now that you have the domain)
   - Go back to Azure Portal → App registrations → Your app
   - Go to **Authentication**
   - Update Redirect URI to: `https://api.yourdomain.com/api/outlook/callback`
   - Click **"Save"**

6. **Wait for DNS Propagation**
   - DNS changes can take 10-60 minutes to propagate
   - Check propagation: https://www.whatsmydns.net
   - Search for `crm.yourdomain.com` and `api.yourdomain.com`
   - Wait until both show your servers

7. **Verify SSL Certificates**
   - Vercel and Render automatically provision SSL certificates
   - After DNS propagates, visit `https://crm.yourdomain.com` - should have SSL lock
   - Visit `https://api.yourdomain.com/health` - should have SSL lock

**✅ Phase 5 Complete:** Custom domains are configured and SSL is active.

---

## Phase 6: Create Production Customer

**Estimated Time: 5-10 minutes**

1. **Connect to Production Database**
   ```bash
   cd server
   DATABASE_URL="<your-neon-connection-string>" npx prisma studio
   ```

2. **Create Customer Record**
   - Prisma Studio will open in browser
   - Click **"Customer"** model
   - Click **"+ Add record"**
   - Fill in:
     - `id`: `prod-customer-1` (or generate unique ID)
     - `name`: `OpensDoors` (or your company name)
     - `domain`: `yourdomain.com` (your actual domain)
     - `createdAt`: Leave as default (current time)
     - `updatedAt`: Leave as default
   - Click **"Save 1 change"**

3. **Set Customer in Frontend**
   - Visit `https://crm.yourdomain.com`
   - Open browser console (F12)
   - Run:
     ```javascript
     localStorage.setItem('currentCustomerId', 'prod-customer-1')
     ```
   - Refresh the page

**✅ Phase 6 Complete:** Production customer is created and set.

---

## Phase 7: Testing & Verification

**Estimated Time: 30-60 minutes**

### 7.1 Test All Marketing Sub-Tabs

Visit `https://crm.yourdomain.com` and test each Marketing sub-tab:

1. ✅ **Overview** - Dashboard should load with metrics
2. ✅ **Campaigns** - Should list campaigns (empty initially)
3. ✅ **Sequences** - Should load sequences interface
4. ✅ **People** - Should load contacts interface
5. ✅ **Lists** - Should load lists interface
6. ✅ **Inbox** - Should load inbox interface
7. ✅ **Reports** - Should load reports dashboard
8. ✅ **Templates** - Should load templates interface
9. ✅ **Email Accounts** - Should show "Connect Outlook" button
10. ✅ **Schedules** - Should load schedules interface
11. ✅ **Cognism Prospects** - Should load prospects interface
12. ✅ **Leads** - Should show your 73 leads (if imported from localStorage)

### 7.2 Test Outlook OAuth Flow

1. Navigate to **Marketing** → **Email Accounts**
2. Click **"Connect Outlook Account"**
3. You should be redirected to Microsoft login
4. Sign in with Microsoft account
5. Grant permissions (Mail.Send, Mail.Read, etc.)
6. You should be redirected back to CRM
7. Outlook account should appear in Email Accounts list

### 7.3 Test Email Campaign (Full Flow)

1. **Connect Outlook** (if not done in 7.2)
2. **Import Contacts**:
   - Go to **Marketing** → **People**
   - Click **"Import CSV"** or **"Add Contact"**
   - Add at least 2-3 test contacts with valid email addresses
3. **Create Email List**:
   - Go to **Marketing** → **Lists**
   - Create new list: `Test Campaign List`
   - Add contacts to list
4. **Create Email Sequence**:
   - Go to **Marketing** → **Sequences**
   - Create new sequence: `Test Sequence`
   - Add 2-3 email steps with templates
5. **Create Campaign**:
   - Go to **Marketing** → **Campaigns**
   - Click **"New Campaign"**
   - Configure:
     - Name: `Test Campaign`
     - Sender: Select connected Outlook account
     - Attach list or contacts
   - Save and **Start** campaign
6. **Verify Email Sending**:
   - Check Render logs - should see scheduler activity
   - Check Outlook Sent folder - should see sent emails
   - Go back to Campaign detail - should see sent count increasing
7. **Test Reply Detection**:
   - Reply to one of the campaign emails from test contact email
   - Wait 5 minutes for reply detection worker
   - Check Campaign detail - reply should be detected
   - Prospect status should update to "replied"

### 7.4 Verify Background Workers

1. **Check Render Logs**:
   - Go to Render dashboard → Your backend service → **Logs**
   - Should see logs like:
     ```
     📧 Starting email scheduler...
     ✅ Email scheduler started (runs every minute)
     📬 Starting reply detection worker...
     ✅ Reply detection worker started (runs every 5 minutes)
     ```
   - Should see periodic activity every 1 minute (scheduler) and 5 minutes (reply detection)

2. **Verify Workers Running**:
   - Workers run automatically when backend is running
   - No manual start required
   - Workers survive server restarts (automatically restart with service)

**✅ Phase 7 Complete:** All features are tested and working.

---

## Post-Deployment Checklist

- [ ] All 12 Marketing sub-tabs load without errors
- [ ] Outlook OAuth flow works end-to-end
- [ ] Email campaigns can be created and started
- [ ] Emails send successfully (check Outlook Sent folder)
- [ ] Reply detection works (test by replying to campaign email)
- [ ] Background workers running (check Render logs)
- [ ] Analytics update in real-time
- [ ] Custom domains working with SSL
- [ ] 73 existing leads preserved (if applicable)
- [ ] No console errors in browser
- [ ] Health endpoints respond: `/health` and `/api/health`

---

## Troubleshooting

### Backend Not Starting
- Check Render logs for errors
- Verify all environment variables are set correctly
- Check DATABASE_URL connection string format
- Ensure Prisma client is generated: `npx prisma generate`

### Frontend Can't Connect to API
- Verify `VITE_API_URL` is set correctly in Vercel
- Check CORS settings in backend (`FRONTEND_URL` in server/.env)
- Check browser console for CORS errors
- Verify API URL is accessible: `curl https://api.yourdomain.com/health`

### Outlook OAuth Not Working
- Verify REDIRECT_URI matches exactly in Azure and server/.env
- Check admin consent is granted in Azure
- Verify client secret hasn't expired
- Check Azure app redirect URI matches: `https://api.yourdomain.com/api/outlook/callback`

### Background Workers Not Running
- Check Render logs for worker startup messages
- Verify workers are uncommented in `server/src/index.ts`
- Check for errors in worker code (email scheduler, reply detection)
- Ensure database connection is working

### DNS Not Propagating
- Use https://www.whatsmydns.net to check propagation
- Wait up to 60 minutes for full propagation
- Verify DNS records are correct in GoDaddy
- Check TTL values (lower = faster propagation, but higher = less DNS load)

---

## Rollback Plan

If something goes wrong:

1. **Backend Issues**:
   - Go to Render → Your service → **Events**
   - Click on previous successful deployment
   - Click **"Rollback"**

2. **Frontend Issues**:
   - Go to Vercel → Your project → **Deployments**
   - Find previous successful deployment
   - Click **"..."** → **"Promote to Production"**

3. **Database Issues**:
   - Neon has automatic backups (on paid plan)
   - Can restore from backup if needed
   - Check Neon dashboard → Backups

4. **Code Issues**:
   - Revert git commit: `git revert <commit-hash>`
   - Push to GitHub
   - Vercel/Render will auto-deploy

---

## Next Steps After Go-Live

1. **Set up monitoring**:
   - UptimeRobot (free) for uptime monitoring
   - Set alerts for downtime

2. **Implement authentication**:
   - Add user login/signup
   - Replace localStorage customer ID with authenticated session

3. **Set up backups**:
   - Neon free tier has basic backups
   - Consider upgrading for point-in-time recovery

4. **Scale as needed**:
   - Monitor Render usage
   - Upgrade Render plan if needed ($25/month for better performance)
   - Upgrade Neon plan if database size grows ($19/month for 3GB)

5. **Optimize**:
   - Enable CDN caching in Vercel
   - Optimize database queries
   - Add database connection pooling

---

## Support

- **Render Support**: https://render.com/docs
- **Vercel Support**: https://vercel.com/docs
- **Neon Support**: https://neon.tech/docs
- **Azure Support**: https://learn.microsoft.com/en-us/graph
- **Prisma Support**: https://www.prisma.io/docs

---

**Deployment Complete!** 🎉

Your ODCRM is now live at `https://crm.yourdomain.com` with all Marketing features functional.
