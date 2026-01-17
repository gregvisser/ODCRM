# Quick Start - Your Production ODCRM

## 🚀 System is Live!

**Frontend**: https://odcrm.vercel.app  
**Backend**: https://odcrm-api.onrender.com  
**Database**: Neon PostgreSQL  

---

## ⚡ Quick Start (5 Minutes)

### 1. Set Customer ID

Visit https://odcrm.vercel.app, press F12, run:
```javascript
localStorage.setItem('currentCustomerId', 'prod-customer-1')
```
Refresh page.

### 2. Update Render Environment Variables

Render → odcrm-api → Environment → Edit:
- `FRONTEND_URL` = `https://odcrm.vercel.app`
- `REDIRECT_URI` = `https://odcrm-api.onrender.com/api/outlook/callback`
- `EMAIL_TRACKING_DOMAIN` = `https://odcrm-api.onrender.com`

Save → Wait 30 seconds for restart.

### 3. Update Azure

Azure Portal → App registrations → OpensDoors CRM Production → Authentication:
- Update Redirect URI to: `https://odcrm-api.onrender.com/api/outlook/callback`

Save.

### 4. Test Outlook Connection

CRM → Marketing → Email Accounts → "Connect Your First Outlook Account"

Sign in → Grant permissions → Done!

### 5. Verify Workers Running

Render → odcrm-api → Logs → Should see:
```
📧 Starting email scheduler...
📬 Starting reply detection worker...
```

---

## ✅ That's It!

Your CRM is ready to use. Start creating campaigns!

---

## 🎯 What You Can Do Now

- Import contacts (Marketing → People)
- Create email lists (Marketing → Lists)
- Build sequences (Marketing → Sequences)
- Create campaigns (Marketing → Campaigns)
- Send emails (automated via background workers)
- Track performance (Marketing → Reports)
- Manage leads (Marketing → Leads)

---

## 📊 Monthly Cost

- Neon Database: **$0** (free tier)
- Render Backend: **$7** (Starter plan)
- Vercel Frontend: **$0** (hobby tier)
- **Total: $7/month**

---

## 🔧 Optional: Custom Domains

Want `crm.yourdomain.com` instead of `odcrm.vercel.app`?

See: `START_USING_ODCRM.md` Step 7

---

**Full documentation**: `START_USING_ODCRM.md`

**Questions?** Check `TESTING_CHECKLIST.md` for troubleshooting.
