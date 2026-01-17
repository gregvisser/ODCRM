# Start Using Your Live ODCRM System

## ✅ Your System is Live!

- **Frontend**: https://odcrm.vercel.app
- **Backend**: https://odcrm-api.onrender.com  
- **Database**: Neon PostgreSQL (prod-customer-1 created)

---

## STEP 1: Set Customer ID (Required - Do This First!)

1. Visit: **https://odcrm.vercel.app**
2. Open browser console: Press **F12**
3. Go to **Console** tab
4. Paste this command and press Enter:
   ```javascript
   localStorage.setItem('currentCustomerId', 'prod-customer-1')
   ```
5. **Refresh the page** (F5 or Ctrl+R)

✅ You should now see the CRM with data!

---

## STEP 2: Update Environment Variables for OAuth

### A. Update Render Backend

1. Go to https://render.com/dashboard
2. Click your service: **odcrm-api**
3. Go to **Environment** tab
4. Click **Edit** on each of these variables and update:

   **FRONTEND_URL**:
   ```
   https://odcrm.vercel.app
   ```

   **REDIRECT_URI**:
   ```
   https://odcrm-api.onrender.com/api/outlook/callback
   ```

   **EMAIL_TRACKING_DOMAIN**:
   ```
   https://odcrm-api.onrender.com
   ```

5. Click **Save Changes**
6. Service will auto-restart (wait 30 seconds)

### B. Update Azure Redirect URI

1. Go to https://portal.azure.com
2. Navigate to: **Azure Active Directory** → **App registrations**
3. Click: **OpensDoors CRM Production**
4. Click: **Authentication** (left sidebar)
5. Find **Redirect URIs** section
6. Update or add: `https://odcrm-api.onrender.com/api/outlook/callback`
7. Click **Save** at the bottom

✅ OAuth is now configured!

---

## STEP 3: Test Outlook Connection

1. In your CRM (https://odcrm.vercel.app)
2. Click **OpensDoors Marketing** (left sidebar)
3. Click **Email Accounts** tab
4. Click **"Connect Your First Outlook Account"** button
5. You'll be redirected to Microsoft login
6. Sign in with your Microsoft/Outlook account
7. Click **Accept** to grant permissions
8. You'll be redirected back to the CRM
9. Your Outlook account should now appear in the list!

✅ If this works, your OAuth integration is functional!

---

## STEP 4: Test All Marketing Features

Click through each Marketing sub-tab to verify they load:

1. ✅ **Overview** - Dashboard
2. ✅ **Campaigns** - Email campaigns
3. ✅ **Sequences** - Email sequences  
4. ✅ **People** - Contact management
5. ✅ **Lists** - Contact lists
6. ✅ **Inbox** - Email inbox
7. ✅ **Reports** - Analytics
8. ✅ **Templates** - Email templates
9. ✅ **Email Accounts** - Connected accounts
10. ✅ **Schedules** - Send schedules
11. ✅ **Cognism Prospects** - Prospect import
12. ✅ **Leads** - Google Sheets leads

Check browser console (F12) for any errors.

---

## STEP 5: Verify Background Workers

1. Go to https://render.com/dashboard
2. Click your service: **odcrm-api**
3. Go to **Logs** tab
4. Look for these messages:
   ```
   🚀 Server running on port 3001
   📧 Starting email scheduler...
   ✅ Email scheduler started (runs every minute)
   📬 Starting reply detection worker...
   ✅ Reply detection worker started (runs every 5 minutes)
   ```

✅ Workers should be running automatically!

---

## STEP 6: Optional - Create Test Email Campaign

Once Outlook is connected:

1. Go to **Marketing** → **People**
2. Add a test contact (use your own email)
3. Go to **Marketing** → **Lists**  
4. Create a list and add the contact
5. Go to **Marketing** → **Sequences**
6. Create a 2-step email sequence
7. Go to **Marketing** → **Campaigns**
8. Create campaign, attach list & sequence
9. Start the campaign
10. Check your email - you should receive the campaign email!

---

## STEP 7: Optional - Configure Custom Domains

If you want to use your GoDaddy domain (e.g., crm.yourdomain.com):

### A. Add Custom Domain in Vercel
1. Vercel dashboard → Your project → **Settings** → **Domains**
2. Add: `crm.yourdomain.com`
3. Vercel will show DNS instructions

### B. Add Custom Domain in Render  
1. Render dashboard → Your service → **Settings** → **Custom Domains**
2. Add: `api.yourdomain.com`
3. Render will show DNS instructions

### C. Update GoDaddy DNS
1. GoDaddy → Your domain → **Manage DNS**
2. Add CNAME records:
   - Name: `crm` → Value: (from Vercel instructions)
   - Name: `api` → Value: (from Render instructions)
3. Wait 10-60 minutes for DNS propagation

### D. Update Environment Variables & Azure
After DNS propagates, update all URLs to use custom domains:
- Render: Update `FRONTEND_URL`, `REDIRECT_URI`, `EMAIL_TRACKING_DOMAIN`
- Vercel: Update `VITE_API_URL`
- Azure: Update redirect URI

See: `PRODUCTION_DEPLOYMENT_STEPS.md` Phase 5-6 for details

---

## 🎉 You're Ready to Use ODCRM!

Your CRM is fully deployed and functional. You can now:
- ✅ Manage customers and contacts
- ✅ Create email campaigns
- ✅ Send automated email sequences
- ✅ Track opens, replies, and bounces
- ✅ Manage marketing leads
- ✅ Build and execute marketing strategies

---

## 📋 Quick Reference

**Access Your CRM**: https://odcrm.vercel.app  
**Customer ID**: prod-customer-1 (set in localStorage)  
**Backend API**: https://odcrm-api.onrender.com  

**Documentation**:
- Testing: `TESTING_CHECKLIST.md`
- Deployment Summary: `DEPLOYMENT_COMPLETE_SUMMARY.md`
- Full Guide: `PRODUCTION_DEPLOYMENT_STEPS.md`

---

## 🆘 Need Help?

- **Frontend not loading**: Check browser console (F12)
- **OAuth not working**: Verify environment variables and Azure redirect URI
- **API errors**: Check Render logs
- **Workers not running**: Check Render logs for worker startup messages

---

**Next Steps**: Update environment variables → Test OAuth → Start creating campaigns!
