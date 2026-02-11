# Fix: "Can't delete customer" - Expose Real Backend Errors

**Date:** 2026-02-11  
**Status:** ✅ COMPLETE - Ready for deployment

---

## 🎯 Problem

Users trying to delete customers saw generic errors:
- "Failed to delete customer" with no details about why
- No information about related records blocking deletion
- No request ID for debugging
- No prismaCode for database-specific issues

---

## 🔧 Solution: Structured Error Responses with RequestId

### Changes Made

**1. Backend: DELETE Route Enhancement** (`server/src/routes/customers.ts`)

**Added:**
- Request ID generation at start of request
- Structured error responses with: `{ error, message, details, prismaCode, meta, requestId }`
- One-line structured logging: `[delete_customer_failed] requestId=... customerId=... prismaCode=... message="..." meta=...`
- Check for BOTH `Contact` and `CustomerContact` tables (bug fix)

**Error Mapping:**
- **Has related records** → 409 with `customer_has_relations`, P2003, detailed counts
- **P2025 (not found)** → 404 with `not_found`, customer ID
- **Other P-codes** → 500 with `database_error`, prismaCode
- **Generic errors** → 500 with `server_error`

**2. Frontend: Already Enhanced** (`src/utils/api.ts`)

The API wrapper was already enhanced in the previous fix to:
- Parse JSON error responses
- Extract requestId and prismaCode
- Build detailed error messages: `"<message> (requestId: <id>) [<prismaCode>]"`

**3. Frontend: Delete Handlers** (multiple files)

All delete handlers already use `api.delete()` and display the error directly in toasts:
- `src/hooks/useCustomersFromDatabase.ts` - `deleteCustomer` function
- `src/components/CustomersManagementTab.tsx` - `handleDeleteConfirm`
- `src/components/AccountsTab.tsx` - delete account

**4. Reproduction Script** (`server/scripts/repro-delete-customer.cjs`)

Tests delete error scenarios against live API endpoint.

---

## 📊 Expected Toast Formats

### Scenario 1: Customer Has Related Records (409)

**Backend Response:**
```json
{
  "error": "customer_has_relations",
  "message": "Cannot delete customer because related records exist: 1 contacts, 0 campaigns, 0 lists, 0 sequences",
  "details": "Delete all related contacts, campaigns, lists, and sequences first, then try again",
  "prismaCode": "P2003",
  "meta": {
    "totalContacts": 1,
    "contactsCount": 0,
    "customerContactsCount": 1,
    "campaignsCount": 0,
    "listsCount": 0,
    "sequencesCount": 0
  },
  "requestId": "req_1770816708108_qbjowj"
}
```

**Toast Displayed:**
```
Title: Delete failed
Description: Cannot delete customer because related records exist: 1 contacts, 0 campaigns, 0 lists, 0 sequences (requestId: req_1770816708108_qbjowj) [P2003]
```

**Backend Log:**
```
[delete_customer_failed] requestId=req_1770816708108_qbjowj customerId=cust_1770816659709_pb5o2m prismaCode=P2003 message="Cannot delete customer because related records exist: 1 contacts, 0 campaigns, 0 lists, 0 sequences" meta={"totalContacts":1,"contacts":0,"customerContacts":1,"campaigns":0,"lists":0,"sequences":0}
```

---

### Scenario 2: Customer Not Found (404)

**Backend Response:**
```json
{
  "error": "not_found",
  "message": "Customer not found",
  "details": "No customer exists with ID: cust_does_not_exist_12345",
  "prismaCode": "P2025",
  "requestId": "req_1770816716081_e4nstr"
}
```

**Toast Displayed:**
```
Title: Delete failed
Description: Customer not found (requestId: req_1770816716081_e4nstr) [P2025]
```

**Backend Log:**
```
[delete_customer_failed] requestId=req_1770816716081_e4nstr customerId=cust_does_not_exist_12345 prismaCode=P2025 message="..." meta={...}
```

---

### Scenario 3: Successful Delete (200)

**Backend Response:**
```json
{
  "success": true,
  "requestId": "req_1770816577720_1n0sw9"
}
```

**Toast Displayed:**
```
Title: Success
Description: Customer deleted
```

---

## 🐛 Bug Fixed: Missing CustomerContact Check

**Problem:** Original DELETE route only checked `prisma.contact.count()` but not `prisma.customerContact.count()`.

**Impact:** Customers with CustomerContact records (POCs) could be deleted, leaving orphaned records.

**Tables:**
- `Contact` - Prospects/leads linked to customers
- `CustomerContact` - Customer POCs (primary contacts)

**Fix:** Now checks BOTH tables and combines counts.

---

## 🧪 Testing Results

**Reproduction Script:** `server/scripts/repro-delete-customer.cjs`

### Test 1: Delete Customer Without Relations (Success)

```bash
node server/scripts/repro-delete-customer.cjs cust_1770816571277_igdwy

✅ DELETE SUCCEEDED
   Customer cust_1770816571277_igdwy was deleted successfully
   RequestId: req_1770816577720_1n0sw9
```

### Test 2: Delete Customer With Contacts (Blocked)

```bash
node server/scripts/repro-delete-customer.cjs cust_1770816659709_pb5o2m

✅ DELETE BLOCKED (expected - has related records)
   Error: customer_has_relations
   Message: Cannot delete customer because related records exist: 1 contacts, 0 campaigns, 0 lists, 0 sequences
   PrismaCode: P2003
   RequestId: req_1770816708108_qbjowj
   
   Expected UI Toast:
   Title: "Delete failed"
   Description: "Cannot delete customer because related records exist: 1 contacts, 0 campaigns, 0 lists, 0 sequences (requestId: req_1770816708108_qbjowj) [P2003]"
```

### Test 3: Delete Non-Existent Customer (404)

```bash
node server/scripts/repro-delete-customer.cjs cust_does_not_exist_12345

✅ DELETE FAILED (expected - customer not found)
   Error: not_found
   Message: Customer not found
   PrismaCode: P2025
   RequestId: req_1770816716081_e4nstr
   
   Expected UI Toast:
   Title: "Delete failed"
   Description: "Customer not found (requestId: req_1770816716081_e4nstr) [P2025]"
```

**All tests passed!** ✅

---

## 📝 Files Changed

| File | Lines | Change | Purpose |
|------|-------|--------|---------|
| `server/src/routes/customers.ts` | 768-831 | Enhanced DELETE route with structured errors & requestId | Show real errors in UI |
| `server/scripts/repro-delete-customer.cjs` | **NEW** | Reproduction script for delete scenarios | Test without UI |
| `DELETE_CUSTOMER_ERROR_FIX.md` | **NEW** | This documentation | Complete error reference |

**Note:** Frontend files (`src/utils/api.ts`, `src/hooks/useCustomersFromDatabase.ts`, etc.) were already enhanced in the previous create customer fix and require no changes.

---

## 🔍 Root Cause Analysis

**Original Issue:**
- Generic "Failed to delete customer" error was caused by:
  1. **Foreign key constraints** (related contacts, campaigns, lists, sequences)
  2. **Missing customer** (P2025 Prisma error)
  3. **Database errors** (connection issues, etc.)

**Why Users Saw Generic Error:**
- Backend returned simple error strings without structure
- No request ID for debugging production failures
- No prismaCode to identify database-specific issues
- Bug: CustomerContact records weren't checked, leading to orphaned records

**After This Fix:**
- Users see: "Cannot delete customer because related records exist: 1 contacts... (requestId: req_123_abc) [P2003]"
- Backend logs: `[delete_customer_failed] requestId=req_123_abc customerId=cust_xyz prismaCode=P2003 message="..." meta={...}`
- Support can grep logs for request ID
- Error messages are specific and actionable
- No orphaned CustomerContact records

---

## ✅ Verification

**Run reproduction script:**
```bash
# Start backend
cd server && npm run dev

# In another terminal - test delete with customer that has contacts
cd server
node scripts/repro-delete-customer.cjs <customerId>
```

**Expected:** Error response with structured JSON including requestId and prismaCode

**Check backend logs for:**
```
[delete_customer_failed] requestId=req_... customerId=... prismaCode=... message="..." meta=...
```

---

## 🚀 Deployment

**Status:**
- ✅ Backend builds successfully
- ✅ Frontend already enhanced (previous fix)
- ✅ Reproduction script passes all tests
- ✅ Structured logging verified
- ✅ No breaking changes
- ✅ Backward compatible
- ✅ Bug fixed: CustomerContact check added

**Git Commands:**
```bash
git add server/src/routes/customers.ts
git add server/scripts/repro-delete-customer.cjs
git add DELETE_CUSTOMER_ERROR_FIX.md

git commit -m "Fix: expose real backend errors in delete customer UI

WHAT CHANGED:
- Backend DELETE: Return structured errors with requestId, prismaCode, meta
- Backend DELETE: Log one-line structured errors for grep
- Backend DELETE: Check BOTH Contact and CustomerContact tables (bug fix)
- Added repro script: server/scripts/repro-delete-customer.cjs
- Frontend already enhanced in previous fix (no changes needed)

WHY:
- Users saw generic 'Failed to delete customer' without details
- No way to debug production failures (no request ID)
- Backend errors not properly mapped to user messages
- Bug: CustomerContact records not checked, causing orphaned records

TESTING:
- Repro script passes 3 test scenarios
- Related records error shows counts and requestId
- Not found error shows P2025 and requestId
- Structured logging works for grep-ability

IMPACT:
- Users see actionable error messages with request ID
- Support can debug with: grep 'req_123_abc' logs
- No breaking changes, fully backward compatible
- Bug fixed: No more orphaned CustomerContact records"

git push origin main
```

---

## 🐛 Common Scenarios & Expected Behavior

### 1. User Tries to Delete Customer With Contacts

**What Happens:**
1. User clicks delete button
2. Backend checks for related records
3. Finds 1 CustomerContact
4. Returns 409 with detailed message
5. Toast shows: **"Cannot delete customer because related records exist: 1 contacts, 0 campaigns, 0 lists, 0 sequences (requestId: req_...) [P2003]"**

**User Action:** Delete all contacts first, then delete customer

---

### 2. User Tries to Delete Non-Existent Customer

**What Happens:**
1. User clicks delete button
2. Backend checks for related records (none)
3. Attempts to delete customer
4. Prisma throws P2025 (record not found)
5. Returns 404 with P2025
6. Toast shows: **"Customer not found (requestId: req_...) [P2025]"**

**User Action:** Refresh page to ensure customer list is up-to-date

---

### 3. User Deletes Customer Successfully

**What Happens:**
1. User clicks delete button
2. Backend checks for related records (none)
3. Deletes customer successfully
4. Returns 200 with success
5. Toast shows: **"Customer deleted"**

**User Action:** Customer is removed from list

---

## 🔍 Debugging Production Issues

**If user reports "Can't delete customer":**

1. **Ask for the full error message:**
   - After this fix, they should see the reason: "Cannot delete customer because related records exist..."
   - Get the request ID

2. **Search backend logs:**
   ```bash
   grep "req_1770816_abc123" logs/server.log
   ```
   
   Or search for structured line:
   ```bash
   grep "[delete_customer_failed]" logs/server.log | tail -10
   ```

3. **Look for:**
   - `requestId` - Correlate with user report
   - `customerId` - Which customer they tried to delete
   - `prismaCode` - P2003 (has relations), P2025 (not found), etc.
   - `message` - Human-readable error
   - `meta` - Counts of related records

4. **Common Fixes:**
   - **P2003 with meta counts** → Customer has related records, guide user to delete them first
   - **P2025** → Customer already deleted or doesn't exist, refresh list
   - **P1001** → Database connection issue, check Azure
   - **500 errors** → Check backend logs for stack trace

---

## 📚 Technical Details

### Request ID Format

```typescript
const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
// Example: req_1770816708108_qbjowj
```

### Structured Log Format

```
[delete_customer_failed] requestId=<id> customerId=<id> prismaCode=<code|none> message="<msg>" meta=<json>
```

**Why this format:**
- Grep-able: `grep "[delete_customer_failed]" logs/server.log`
- Key-value pairs for parsing
- Single line for easy log aggregation
- JSON meta for structured data

### Error Response Schema

```typescript
{
  error: string          // Machine-readable code (customer_has_relations, not_found, etc.)
  message: string        // Human-readable message for UI
  details?: string       // Additional context
  prismaCode?: string    // Prisma error code (P2003, P2025, etc.)
  meta?: object          // Error-specific metadata (record counts, etc.)
  requestId: string      // Unique request identifier
}
```

### Frontend Error Display Logic

```typescript
// api.ts builds error message (already implemented):
let errorMessage = errorResponse.message || errorResponse.error

// Add requestId
if (errorResponse.requestId) {
  errorMessage += ` (requestId: ${errorResponse.requestId})`
}

// Add prismaCode  
if (errorResponse.prismaCode) {
  errorMessage += ` [${errorResponse.prismaCode}]`
}

// Example result:
// "Cannot delete customer because related records exist: 1 contacts, 0 campaigns, 0 lists, 0 sequences (requestId: req_123_abc) [P2003]"
```

---

## 🧪 Test Coverage

**Reproduction script tests:**
1. ✅ Delete customer without relations (200, success)
2. ✅ Delete customer with contacts (409, customer_has_relations, P2003)
3. ✅ Delete non-existent customer (404, not_found, P2025)

**All tests verify:**
- Correct HTTP status codes
- Error response structure
- RequestId inclusion
- PrismaCode inclusion (for errors)
- User-friendly messages
- Structured logging

---

## 🚨 Important Notes

### No Tenant/Scoping Issues

**Finding:** DELETE /api/customers/:id does NOT require X-Customer-Id header.

**Why:** Deleting a customer uses the customer ID in the URL path, not a header.

**Security:** No scoping issues - customer ID is explicitly specified.

**Recommendation:** Keep as-is. No changes needed.

### Bug Fixed: CustomerContact Check

**Previous Code:**
```typescript
const [contactsCount, campaignsCount, listsCount, sequencesCount] = await Promise.all([
  prisma.contact.count({ where: { customerId: id } }),
  // Missing: prisma.customerContact.count()
  ...
])
```

**Fixed Code:**
```typescript
const [contactsCount, customerContactsCount, campaignsCount, listsCount, sequencesCount] = await Promise.all([
  prisma.contact.count({ where: { customerId: id } }),
  prisma.customerContact.count({ where: { customerId: id } }),  // ADDED
  ...
])

const totalContacts = contactsCount + customerContactsCount
```

**Impact:** Prevents orphaned CustomerContact records.

---

## 📋 Checklist

**Implementation:**
- [x] Backend returns structured JSON errors (error, message, requestId, prismaCode, meta)
- [x] Backend logs one-line structured errors with all fields
- [x] Backend checks BOTH Contact and CustomerContact tables
- [x] Frontend already enhanced (previous fix)
- [x] Reproduction script created and tested
- [x] No tenant/scoping header issues
- [x] No schema changes needed
- [x] Backward compatible

**Testing:**
- [x] Reproduction script passes all tests
- [x] Backend builds successfully
- [x] Structured logging verified in server logs
- [x] RequestId generation working
- [x] PrismaCode extraction working
- [x] Error messages user-friendly
- [x] CustomerContact bug fixed

**Safety:**
- [x] No breaking changes
- [x] No schema modifications
- [x] No auth/tenant rule changes
- [x] Enhanced, not removed, error handling
- [x] Minimal diff, targeted changes only

---

## 🎯 Summary

**What we fixed:**
1. ✅ Backend DELETE route now returns structured errors with requestId and prismaCode
2. ✅ Backend logs one grep-able line per failure
3. ✅ Frontend automatically shows these details in error toast (already enhanced)
4. ✅ Error messages are specific and actionable
5. ✅ Bug fixed: CustomerContact records now checked
6. ✅ No silent failures - all errors observable

**Changes are:**
- Minimal (1 file modified + 1 new script)
- Safe (backward compatible, no breaking changes)
- Observable (structured logging, requestId, prismaCode)
- Bug fix (CustomerContact check added)

**Ready for production deployment!**

---

## 🚀 Post-Deployment Verification

1. **Deploy to production** (git push triggers auto-deploy)
2. **Test delete customer:**
   - Try to delete customer with contacts → Should show: "Cannot delete customer because related records exist: 1 contacts... (requestId: req_...) [P2003]"
   - Try to delete non-existent customer → Should show: "Customer not found (requestId: req_...) [P2025]"
   - Try to delete customer without relations → Should succeed
3. **Check logs:**
   - Search for: `grep "[delete_customer_failed]" logs`
   - Verify structured format
4. **Verify UI:**
   - Error toasts show full message with requestId and prismaCode
   - Duration is sufficient to read and copy requestId

---

**End of Fix Documentation**
