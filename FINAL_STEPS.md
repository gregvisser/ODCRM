# Final Steps - Complete Your ODCRM Setup

## ✅ What's Complete

- ✅ Backend deployed: https://odcrm-api.onrender.com
- ✅ Frontend deployed: https://odcrm.vercel.app
- ✅ Database: Neon PostgreSQL with migrations
- ✅ Data restored: 73 leads, 15 accounts, 19 contacts
- ✅ Azure client secret updated
- ✅ All hardcoded localhost references fixed
- ✅ Environment variables configured

---

## ⏳ Final Test: Outlook OAuth (2 minutes)

### Wait 30 seconds (Render is restarting)

Then:

1. **Visit**: https://odcrm.vercel.app
2. **Hard refresh**: Ctrl+Shift+R (clear cache)
3. **Navigate**: Marketing → Email Accounts
4. **Click**: "Connect Your First Outlook Account"
5. **Sign in**: With your Microsoft/Outlook account
6. **Grant permissions**: Click "Accept"
7. **Redirected back**: To CRM
8. **Verify**: Outlook account appears in Email Accounts list

### If Successful:

✅ **OAuth integration works!**  
✅ **You can now send email campaigns!**

---

## ⏳ Verify Background Workers (1 minute)

1. **Go to**: https://render.com/dashboard
2. **Click**: odcrm-api service
3. **Click**: Logs tab
4. **Look for**:
   ```
   🚀 Server running on port 3001
   📧 Starting email scheduler...
   ✅ Email scheduler started (runs every minute)
   📬 Starting reply detection worker...
   ✅ Reply detection worker started (runs every 5 minutes)
   ```

### If you see these:

✅ **Background workers are running!**  
✅ **Email campaigns will send automatically!**

---

## ⏳ Optional: Configure Custom Domains

If you want `crm.yourdomain.com` instead of `odcrm.vercel.app`:

### A. Add Domains

**Vercel**:
- Settings → Domains → Add `crm.yourdomain.com`

**Render**:
- Settings → Custom Domains → Add `api.yourdomain.com`

### B. Update GoDaddy DNS

1. **Go to**: GoDaddy → Your domain → Manage DNS
2. **Add CNAME records**:
   - Name: `crm` → Value: (from Vercel instructions)
   - Name: `api` → Value: (from Render instructions)
3. **Wait**: 10-60 minutes for DNS propagation

### C. Update Environment Variables

After DNS propagates, update URLs to use custom domains:
- Render: Update `FRONTEND_URL`, `REDIRECT_URI`, `EMAIL_TRACKING_DOMAIN`
- Vercel: Update `VITE_API_URL`
- Azure: Update redirect URI

**See**: `PRODUCTION_DEPLOYMENT_STEPS.md` Phase 5-6 for details

---

## 🎉 SUCCESS CRITERIA

After OAuth test:

- [x] Frontend loads
- [x] Data restored (73 leads)
- [ ] OAuth works (connecting Outlook)
- [ ] Workers running (check Render logs)
- [ ] Ready to create campaigns!

---

## 📋 Next Actions

1. ⏰ **Wait 30 seconds** (Render restart)
2. 🧪 **Test OAuth** (should work now!)
3. 🔍 **Check Render logs** (verify workers)
4. 🎉 **Start using ODCRM!**

---

**Current Status**: 95% complete. Just need to verify OAuth and workers!
