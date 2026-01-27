# Customer Data Migration Guide

## 🔍 Problem Identified

After the Azure migration, your Customers tab appears empty. Here's why:

### Root Cause
ODCRM has **two separate customer systems**:

1. **Old System (localStorage-based)**:
   - Component: `AccountsTab`
   - Storage: Browser localStorage (`odcrm_accounts` key)
   - Location: Stored locally in your browser
   - Used by: Customers tab currently

2. **New System (Database-based)**:
   - Component: `CustomersManagementTab`  
   - Storage: Azure PostgreSQL database
   - Location: Cloud database
   - API: `/api/customers`

**The Issue**: After the Azure migration, your localStorage was cleared or the data was never migrated from localStorage to the database. The Customers page still uses the old localStorage system, so it appears empty.

---

## ✅ Solution: Migrate Your Data

I've created an automated migration tool with a user-friendly interface to help you migrate your accounts from localStorage to the database.

### Option 1: Use the Built-in Migration Panel (Recommended)

1. **Open your ODCRM application** in the browser where you previously had customer data:
   - **Local development**: http://localhost:5173
   - **Production**: https://odcrm.bidlow.co.uk
   
   ⚠️ **Important**: Use the **same browser and computer** where you originally created your accounts, as localStorage is browser-specific.

2. **Navigate to the Customers tab**

3. **You'll see a blue "Account Migration Tool" panel** at the top if no accounts are detected

4. **Follow the migration steps**:
   - Click **"Check for Accounts in Browser Storage"** to scan your localStorage
   - If accounts are found, click **"Preview Migration (Dry Run)"** to see what will happen
   - Review the preview results
   - Click **"Run Migration"** to import accounts into the database
   - Click **"Refresh Page"** when complete

5. **Your accounts should now appear** in both:
   - The Customers tab
   - The database (check at http://localhost:5555 with Prisma Studio)

### Option 2: Use Browser Console (Advanced)

If the migration panel doesn't work or you prefer command-line:

1. **Open your ODCRM application** in the browser where you had customer data

2. **Open browser DevTools** (F12 or right-click → Inspect)

3. **Go to the Console tab**

4. **Run the migration function**:

   ```javascript
   // Preview what will happen (dry run)
   await window.migrateAccountsToDatabase({ dryRun: true, verbose: true })
   
   // If preview looks good, run the actual migration
   await window.migrateAccountsToDatabase({ dryRun: false, verbose: true })
   ```

5. **Refresh the page** to see your migrated accounts

---

## 🔍 Troubleshooting

### No Accounts Found in localStorage

If the migration tool reports 0 accounts, this could mean:

1. **Different Browser/Computer**: You're using a different browser or computer than where you originally created accounts
   - **Solution**: Open ODCRM on your old browser/computer and run migration there

2. **Browser Storage Cleared**: Your browser's localStorage was cleared
   - **Check**: Open DevTools → Application tab → Local Storage → Check for `odcrm_accounts` key
   - **Solution**: If you have a backup or snapshot, you may need to restore it

3. **Production vs Local Mismatch**: You're on localhost but data is on production (or vice versa)
   - **Solution**: Visit the actual site where you had data (production URL vs localhost)

4. **Never Had Accounts**: You haven't created any accounts yet
   - **Solution**: Start creating accounts using the "Create New Account" button

### Migration Fails

If the migration fails:

1. **Check backend is running**:
   ```powershell
   cd server
   npm run dev
   ```

2. **Check database connection**:
   - Verify `server/.env` has correct `DATABASE_URL`
   - Test with: `npm run prisma:studio` in server directory

3. **Check browser console** for error messages

4. **Try manual API test**:
   ```javascript
   // In browser console
   const response = await fetch('/api/customers')
   const data = await response.json()
   console.log('Current customers:', data)
   ```

---

## 📊 Verification

After migration, verify your data:

### 1. Check Frontend
- Go to http://localhost:5173/customers (or production URL)
- You should see your accounts listed
- Try expanding an account to see details

### 2. Check Database
- Open Prisma Studio: `npm run prisma:studio` (in server directory)
- Navigate to http://localhost:5555
- Click on "Customer" model
- You should see all migrated customers

### 3. Check API
- Test endpoint: http://localhost:3001/api/customers
- Should return JSON array of customers (not empty `[]`)

---

## 🔄 Data Mapping

The migration tool maps localStorage `Account` fields to database `Customer` fields:

| localStorage (Account) | Database (Customer) |
|------------------------|---------------------|
| `name` | `name` |
| `domain` / `website` | `domain`, `website` |
| `whatTheyDo` | `whatTheyDo` |
| `sector` | `sector` |
| `status` | `clientStatus` |
| `monthlySpendGBP` | `monthlyIntakeGBP` |
| `defcon` | `defcon` |
| `weeklyTarget` | `weeklyLeadTarget` |
| `monthlyTarget` | `monthlyLeadTarget` |
| `targetJobTitle` | `targetJobTitle` |
| `prospectingLocation` | `prospectingLocation` |
| `leadsReportingUrl` | `leadsReportingUrl` |

All other fields (company profile, social presence, etc.) are also migrated.

---

## 🚀 Next Steps After Migration

Once your data is successfully migrated:

1. ✅ **Verify all accounts** are visible in the Customers tab
2. ✅ **Check that details** (contacts, leads, etc.) are intact
3. ✅ **Test creating a new account** to ensure system works
4. ✅ **Deploy to production** if testing on local:
   ```bash
   git add .
   git commit -m "Add customer data migration tool"
   git push origin main
   ```

---

## 🔒 Important Notes

- **Data Safety**: The migration is **additive only** - it doesn't delete localStorage data
- **Duplicates**: The tool **skips existing customers** (matches by name) to avoid duplicates
- **Dry Run First**: Always run with `{ dryRun: true }` first to preview changes
- **Browser Specific**: localStorage data is tied to the specific browser + domain/port combination

---

## 📞 Need Help?

If you encounter issues:

1. Check the **browser console** for error messages (F12 → Console tab)
2. Check the **server logs** in your terminal where backend is running
3. Verify **database connection** with Prisma Studio
4. Review the **troubleshooting section** above

---

## 🎯 Summary

**Problem**: Customers tab is empty after Azure migration  
**Cause**: Data is in localStorage, not database  
**Solution**: Use migration tool to sync localStorage → Database  
**Result**: Customers appear in tab and are stored in cloud database

**Quick Fix**:
```bash
# 1. Start your local servers
cd server && npm run dev
cd .. && npm run dev

# 2. Open http://localhost:5173/customers
# 3. Use the blue "Account Migration Tool" panel
# 4. Click through the migration steps
# 5. Refresh page when done
```

Your customer data should now be visible! 🎉
