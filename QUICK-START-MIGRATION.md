# 🚀 Quick Start: Fix Missing Customers

## ✅ What I Did

I found the issue and created an automated solution to restore your customer data:

### The Problem
- Your Customers tab is empty after Azure migration
- Data exists in **browser localStorage** but not in the **database**
- The app currently reads from localStorage (browser-only storage)

### The Solution
I created:
1. ✅ **Migration utility** (`migrateAccountsToDatabase.ts`) - syncs localStorage → database
2. ✅ **User-friendly panel** (`MigrateAccountsPanel.tsx`) - built into the UI
3. ✅ **Comprehensive guide** (`CUSTOMER-DATA-MIGRATION-GUIDE.md`) - detailed instructions

---

## 🎯 Quick Fix (5 minutes)

### Step 1: Access Your ODCRM Application

Open ODCRM where your customer data exists:

- **If you had customers locally**: http://localhost:5173
- **If you had customers on production**: https://odcrm.bidlow.co.uk

⚠️ **Important**: Use the **same browser** where you originally created your customers!

### Step 2: Navigate to Customers Tab

Click on "Customers" in the sidebar or navigation

### Step 3: Use the Migration Tool

You'll see a **blue "Account Migration Tool"** panel at the top:

1. Click **"Check for Accounts in Browser Storage"**
2. If accounts found, click **"Preview Migration (Dry Run)"**
3. Review what will be migrated
4. Click **"Run Migration"** to import to database
5. Click **"Refresh Page"** when complete

### Step 4: Verify

Your customers should now appear! Check:
- ✅ Customers tab shows your accounts
- ✅ You can click into accounts and see details
- ✅ Database at http://localhost:5555 shows Customer records

---

## 📊 Current Status

**Servers Running**:
- ✅ Frontend: http://localhost:5173 ← **Go here to migrate**
- ✅ Backend API: http://localhost:3001
- ✅ Prisma Studio: http://localhost:5555 ← **Check database here**

**Database Status**:
- Customers table: Empty (0 records) - This is why tab is empty
- Migration tool: Ready to use

---

## ❓ What if No Accounts Found?

If the tool says "0 accounts found", try:

1. **Different browser?** Open on the browser where you created accounts
2. **Production data?** If you created accounts on https://odcrm.bidlow.co.uk, open that URL
3. **Local data?** If you created accounts on localhost, open http://localhost:5173
4. **Browser storage cleared?** Unfortunately, you may need to recreate accounts

---

## 🔄 Alternative: Use Browser Console

If the UI panel doesn't work:

1. Open DevTools (F12)
2. Go to Console tab
3. Run this:

```javascript
// Preview migration
await window.migrateAccountsToDatabase({ dryRun: true, verbose: true })

// If preview looks good, run migration
await window.migrateAccountsToDatabase({ dryRun: false, verbose: true })
```

---

## 📝 After Migration is Complete

Once your customers are migrated:

1. **Test locally** - verify everything works
2. **Commit changes**:
   ```bash
   git add .
   git commit -m "Add customer data migration tool for Azure migration"
   git push origin main
   ```
3. **Deploy to production** - GitHub Actions will deploy automatically
4. **Repeat migration on production** if you had different data there

---

## 📖 Full Documentation

For detailed troubleshooting and advanced options, see:
- `CUSTOMER-DATA-MIGRATION-GUIDE.md` (comprehensive guide)

---

## 🎉 Summary

**Problem**: Customers disappeared after Azure migration  
**Cause**: Data in localStorage, not database  
**Solution**: Migration tool syncs localStorage → Database  
**Time**: 5 minutes  
**Status**: Ready to use at http://localhost:5173

**Next**: Open http://localhost:5173/customers and use the blue migration panel!
