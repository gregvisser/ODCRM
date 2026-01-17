# Action Plan - Start Using ODCRM Right Now

## 🎯 Your Live System

- **CRM**: https://odcrm.vercel.app
- **API**: https://odcrm-api.onrender.com
- **Status**: ✅ Deployed and running

---

## ⚡ 3-Minute Setup (Do These Now)

### Action 1: Set Customer ID (30 seconds)

1. Visit https://odcrm.vercel.app
2. Press **F12** (open console)
3. Paste and press Enter:
   ```javascript
   localStorage.setItem('currentCustomerId', 'prod-customer-1')
   ```
4. Press **F5** to refresh

---

### Action 2: Update Render Variables (2 minutes)

Go to https://render.com → Your service (odcrm-api) → **Environment**:

Click **Edit** on each and update:

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

Click **Save Changes** (bottom of page)

Wait 30 seconds for service to restart.

---

### Action 3: Update Azure (1 minute)

Go to https://portal.azure.com:

1. Search: "App registrations"
2. Click: **OpensDoors CRM Production**
3. Click: **Authentication** (left menu)
4. Update Redirect URI to: `https://odcrm-api.onrender.com/api/outlook/callback`
5. Click **Save**

---

## ✅ After Setup Complete

### Test Outlook OAuth:

1. Go to https://odcrm.vercel.app
2. Click **OpensDoors Marketing**
3. Click **Email Accounts** tab
4. Click **"Connect Your First Outlook Account"**
5. Sign in → Grant permissions
6. Done!

---

### Verify Workers Running:

1. Go to https://render.com → Your service
2. Click **Logs** tab
3. Should see:
   ```
   📧 Starting email scheduler...
   📬 Starting reply detection worker...
   ```

---

## 🎉 You're Ready!

After completing the 3 actions above, your ODCRM is fully functional and ready to use!

**Start with**:
- Import contacts (Marketing → People)
- Create your first campaign (Marketing → Campaigns)

---

## 📝 Summary of Actions

1. ✅ Set customer ID in browser (30 sec)
2. ⏳ Update Render environment variables (2 min)
3. ⏳ Update Azure redirect URI (1 min)
4. ✅ Test OAuth connection
5. ✅ Verify workers running

**Total time**: ~5 minutes

---

**Questions?** See `START_USING_ODCRM.md` for detailed guide.
