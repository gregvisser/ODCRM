# Production Testing Checklist

## Step 1: Access Frontend

1. **Visit**: https://odcrm.vercel.app
2. **Verify**: Page loads without errors
3. **Check console** (F12) for any errors

---

## Step 2: Set Customer ID

In browser console (F12):

```javascript
localStorage.setItem('currentCustomerId', 'prod-customer-1')
```

Then **refresh** the page.

---

## Step 3: Test All Marketing Sub-Tabs

Navigate to **Marketing** tab and click through each sub-tab:

- [ ] **Overview** - Dashboard loads with metrics
- [ ] **Campaigns** - Campaign list loads
- [ ] **Sequences** - Sequence interface loads
- [ ] **People** - Contact management loads
- [ ] **Lists** - Lists interface loads
- [ ] **Inbox** - Inbox loads
- [ ] **Reports** - Reports dashboard loads
- [ ] **Templates** - Templates interface loads
- [ ] **Email Accounts** - Shows "Connect Outlook" button
- [ ] **Schedules** - Schedules interface loads
- [ ] **Cognism Prospects** - Prospects interface loads
- [ ] **Leads** - Should show your 73 leads (if preserved)

**Check**: No blank screens, no console errors

---

## Step 4: Test Outlook OAuth Flow

1. Go to **Marketing** → **Email Accounts**
2. Click **"Connect Outlook Account"**
3. You should be redirected to Microsoft login
4. Sign in and grant permissions
5. You should be redirected back to the CRM
6. Outlook account should appear in the list

**If OAuth fails**: Check that Azure redirect URI and Render `REDIRECT_URI` are both set to `https://odcrm-api.onrender.com/api/outlook/callback`

---

## Step 5: Verify Background Workers

1. Go to Render dashboard → Your service → **Logs**
2. Check for these messages:
   ```
   🚀 Server running on port 3001
   📧 Starting email scheduler...
   ✅ Email scheduler started (runs every minute)
   📬 Starting reply detection worker...
   ✅ Reply detection worker started (runs every 5 minutes)
   ```

---

## Step 6: Test API Connection

1. In browser at https://odcrm.vercel.app
2. Open **Network** tab (F12 → Network)
3. Navigate to Marketing tabs
4. Check for API calls to `odcrm-api.onrender.com`
5. Verify responses are 200 OK (not CORS errors)

---

## Common Issues & Solutions

### "Cannot connect to API" / CORS Errors
- **Fix**: Update `FRONTEND_URL` in Render to `https://odcrm.vercel.app`
- Restart Render service

### OAuth Redirect Fails
- **Fix**: Update `REDIRECT_URI` in Render to `https://odcrm-api.onrender.com/api/outlook/callback`
- Update Azure redirect URI to match
- Restart Render service

### Blank Marketing Tabs
- **Fix**: Check browser console for errors
- Verify customer ID is set: `localStorage.getItem('currentCustomerId')`
- Check Network tab for failed API calls

### 73 Leads Not Showing
- Leads are stored in localStorage (not database)
- Check: `localStorage.getItem('marketingLeads')`
- May need to re-import from Google Sheets

---

## Success Criteria

✅ Frontend loads at https://odcrm.vercel.app  
✅ All Marketing sub-tabs load without errors  
✅ No console errors  
✅ API calls succeed (Network tab shows 200 responses)  
✅ Outlook OAuth flow works end-to-end  
✅ Background workers running (check Render logs)  

---

## After Testing

If all tests pass:
- ✅ Deployment is complete and functional
- ⏭️ Optional: Configure custom domains (see DNS_CONFIGURATION.md)
- ⏭️ Optional: Create test email campaign
- ⏭️ Optional: Set up monitoring (UptimeRobot)

---

**Current URLs:**
- Frontend: https://odcrm.vercel.app
- Backend: https://odcrm-api.onrender.com
- Database: Neon (connected)

**Next**: Test the frontend and report any issues!
