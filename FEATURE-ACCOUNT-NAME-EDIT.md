# Account Name Edit Feature

## Overview
Added the ability to edit account names directly within the account table in the Accounts tab.

## Changes Made

### 1. Updated Account Name Display (AccountsTab.tsx, line ~5108)
- Changed the account name cell from read-only text to an editable field
- Added click-to-edit functionality with hover indication
- Implemented inline editing with Input component

### 2. Enhanced `handleCellEdit` Function (line ~3609)
- Updated type signature to accept both `number` and `string` values
- Previous: `currentValue: number`
- New: `currentValue: number | string`
- This allows the function to handle both numeric fields (revenue, targets) and text fields (name)

### 3. Implemented `handleCellSave` Function (line ~3615)
- Added complete save logic for inline cell editing
- **For account name edits:**
  - Validates that the new name is not empty
  - Checks for duplicate names (case-insensitive)
  - Updates the account name in the state
  - Updates the selected account if the drawer is open
  - Shows success/error toasts with descriptive messages
- **For numeric fields:**
  - Validates numeric input
  - Updates the appropriate field (monthlySpendGBP, weeklyTarget, monthlyTarget)
  - Calls the existing `updateAccount` function

## User Experience

### How to Edit an Account Name:
1. Navigate to the Accounts tab
2. Find the account you want to rename in the table
3. Click on the account name (you'll see it's underlined on hover)
4. The name becomes an editable text input field
5. Type the new name
6. Press Enter or click the checkmark icon to save
7. Press Escape or click the X icon to cancel

### Validation:
- ✅ Empty names are rejected with error message
- ✅ Duplicate names are rejected with error message
- ✅ Successful renames show a success toast
- ✅ If the account drawer is open, it automatically updates with the new name
- ✅ Changes are persisted to localStorage and synced to the database

## Testing Checklist
- [x] ✅ Code compiles without errors
- [x] ✅ No linter errors
- [x] ✅ Frontend dev server starts successfully
- [x] ✅ Backend API is running
- [ ] 🔄 Test editing an account name in localhost
- [ ] 🔄 Verify validation messages appear for empty names
- [ ] 🔄 Verify validation messages appear for duplicate names
- [ ] 🔄 Verify account drawer updates when name is changed
- [ ] 🔄 Verify changes persist after page refresh
- [ ] 🔄 Deploy to production and verify functionality

## Technical Details

### Files Modified:
1. `src/components/AccountsTab.tsx`
   - Updated account name cell rendering (lines ~5108-5146)
   - Modified `handleCellEdit` to accept string values (line ~3609)
   - Implemented `handleCellSave` with full validation logic (lines ~3615-3703)

### Architecture:
- The edit feature integrates seamlessly with the existing database-first architecture
- Changes are automatically synced to the database via `AccountsTabDatabase.tsx` wrapper
- The sync happens through the existing localStorage monitoring mechanism
- Database updates occur within 2 seconds of the localStorage change

## Screenshots
*Screenshots to be added after testing in localhost and production*

## Next Steps
1. Test the feature thoroughly in localhost
2. Verify all validation scenarios
3. Test with multiple accounts
4. Deploy to production following the standard workflow
5. Verify production functionality
6. Update this document with screenshots
