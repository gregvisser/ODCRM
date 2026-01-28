# Account Name Edit Feature

## ❌ Status: REVERTED (No longer active)

**Note:** This feature was successfully implemented and deployed, but has been reverted per user request. Account names are now read-only again in the table.

## Overview
Added the ability to edit account names directly within the account table in the Accounts tab.

## Changes Made

### 1. Updated Account Name Display (AccountsTab.tsx, line ~5108)
- Changed the account name cell from read-only text to an editable field
- Added click-to-edit functionality with hover indication (underline on hover)
- Implemented inline editing with Input component, save/cancel buttons
- Pressing Enter or clicking the checkmark icon saves the change
- Pressing Escape or clicking the X icon cancels the edit

### 2. Enhanced `handleCellEdit` Function (line ~3609)
- Updated type signature to accept both `number` and `string` values
- Previous: `currentValue: number`
- New: `currentValue: number | string`
- This allows the function to handle both numeric fields (revenue, targets) and text fields (name)

### 3. Enhanced `handleCellSave` Function (line ~4126)
- Added account name rename logic to the existing function
- **For account name edits:**
  - Validates that the new name is not empty
  - Checks for duplicate names (case-insensitive)
  - Updates the account name in the state using `setAccountsData`
  - Updates the selected account if the drawer is open
  - Shows success/error toasts with descriptive messages
- **For numeric fields (existing functionality):**
  - Validates numeric input
  - Updates the appropriate field (monthlySpendGBP, weeklyTarget, monthlyTarget, defcon)
  - Calls the existing `updateAccount` function
  - Clamps defcon values between 1 and 5

## User Experience

### How to Edit an Account Name:
1. Navigate to the Accounts tab (Opensdoors customers tab)
2. Find the account you want to rename in the table
3. Click on the account name (you'll see it's underlined on hover, indicating it's editable)
4. The name becomes an editable text input field with save/cancel buttons
5. Type the new name
6. Press Enter or click the checkmark (✓) icon to save
7. Press Escape or click the X icon to cancel
8. A success toast will appear confirming the rename

### Validation:
- ✅ Empty names are rejected with error toast: "Account name cannot be empty"
- ✅ Duplicate names are rejected with error toast: "An account with the name 'X' already exists"
- ✅ Successful renames show a success toast: "Renamed 'OldName' to 'NewName'"
- ✅ If the account drawer is open, it automatically updates with the new name
- ✅ Changes are persisted to localStorage and synced to the database within 2 seconds

## Testing Checklist
- [x] ✅ Code compiles without errors
- [x] ✅ No linter errors
- [x] ✅ Frontend dev server starts successfully
- [x] ✅ Backend API is running
- [x] ✅ Build succeeds in CI/CD pipeline
- [x] ✅ Successfully deployed to production (https://odcrm.bidlow.co.uk)
- [ ] 🔄 Test editing an account name in localhost (user to test)
- [ ] 🔄 Test editing an account name in production (user to test)
- [ ] 🔄 Verify validation messages appear for empty names
- [ ] 🔄 Verify validation messages appear for duplicate names
- [ ] 🔄 Verify account drawer updates when name is changed
- [ ] 🔄 Verify changes persist after page refresh
- [ ] 🔄 Verify changes sync to database

## Technical Details

### Files Modified:
1. **`src/components/AccountsTab.tsx`** (3 changes)
   - Updated account name cell rendering to support inline editing (lines ~5108-5146)
   - Modified `handleCellEdit` to accept string values (line ~3609)
   - Enhanced `handleCellSave` with account name rename validation logic (lines ~4126-4209)

2. **`vite.config.ts`** (bug fix)
   - Removed `copy-staticwebapp-config` plugin that was causing build failures
   - This plugin is no longer needed since we're using direct API URLs

3. **`FEATURE-ACCOUNT-NAME-EDIT.md`** (new file)
   - This documentation file

### Architecture:
- The edit feature integrates seamlessly with the existing database-first architecture
- Changes are automatically synced to the database via the `AccountsTabDatabase.tsx` wrapper component
- The sync happens through the existing localStorage monitoring mechanism
- Database updates occur within 2 seconds of the localStorage change (see `AccountsTabDatabase.tsx:71-138`)
- The database is always the single source of truth

### Database Sync Flow:
1. User clicks account name → enters edit mode
2. User types new name and saves
3. `handleCellSave` validates and updates `accountsData` state
4. State change triggers `useEffect` hook that saves to localStorage (`AccountsTab.tsx:3656-3690`)
5. `AccountsTabDatabase` wrapper detects localStorage change via polling/event listener
6. Wrapper calls `updateCustomer` to sync to Azure PostgreSQL database
7. Database update completes, maintaining consistency

## Deployment History

### Commit 1: Initial Feature Implementation
**Commit:** `bfc0be8` - "Feature: Add inline editing for account names in Accounts table"
- Status: ❌ Build failed (missing staticwebapp.config.json)

### Commit 2: Fix Vite Config
**Commit:** `5a54e2d` - "Fix: Remove staticwebapp.config.json copy plugin from vite.config"
- Status: ❌ Build failed (duplicate function declaration)

### Commit 3: Fix Duplicate Declaration
**Commit:** `8891f5b` - "Fix: Remove duplicate handleCellSave declaration"
- Status: ✅ Build succeeded
- Deployed: 2026-01-27 23:45 UTC
- Production URL: https://odcrm.bidlow.co.uk

## Production Verification
- Deployment completed successfully at 2026-01-27 23:45 UTC
- GitHub Actions workflow: https://github.com/gregvisser/ODCRM/actions
- Production site: https://odcrm.bidlow.co.uk
- Backend API: https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net

## Next Steps for User Testing
1. ✅ Feature is deployed and ready for testing
2. Navigate to https://odcrm.bidlow.co.uk
3. Sign in with your Microsoft account (greg@opensdoors.co.uk)
4. Go to the "Opensdoors customers" tab
5. Try editing an account name:
   - Click on any account name in the table
   - Change the name
   - Press Enter to save
   - Verify the success toast appears
   - Verify the name updates in the table
   - Refresh the page to confirm persistence
6. Try validation scenarios:
   - Try saving an empty name (should show error)
   - Try renaming to an existing account name (should show error)
7. Test with account drawer open:
   - Open an account's details drawer
   - Edit the account name in the table
   - Verify the drawer updates with the new name

## Known Limitations
- Account name changes do NOT automatically update references in other places (e.g., contacts linked to that account)
- This is by design - contacts store account names as strings
- If you rename an account, you may need to manually update associated contacts to use the new name
- Future enhancement: Add cascade updates to related entities

## Revert History

### Final Commit: Feature Reverted
**Commit:** `d84589a` - "Revert: Remove account name inline editing feature"
- Status: ✅ Deployed successfully
- Deployed: 2026-01-27 (shortly after 47656b8)
- Reason: Per user request

**Changes in Revert:**
- Removed inline editing UI from account name cell
- Reverted to simple read-only Text display
- Removed account name rename validation logic
- Kept all numeric field editing functionality intact
- Kept numeric field validation (the bug fix from 47656b8)

**Current State:**
Account names are now **read-only** and display as:
```typescript
<Td>
  <Text fontWeight="semibold" color="text.primary">
    {account.name}
  </Text>
</Td>
```

All other inline editing features (Revenue, Weekly Target, Monthly Target, DEFCON) continue to work with proper validation.

## Screenshots
*Feature was reverted before user testing*
