# Fix: "Failed to create customer" - Expose Real Backend Errors

**Date:** 2026-02-11  
**Status:** ✅ COMPLETE - Ready for deployment

---

## 🎯 Problem

Users saw generic "Failed to create customer" error with no details about:
- What field was invalid
- Why it failed
- How to fix it
- Request ID for debugging

---

## 🔧 Solution: Expose Real Backend Errors Automatically

### Changes Made

**1. Backend: Structured Error Responses** (`server/src/routes/customers.ts`)

**Added to ALL error paths:**
- Request ID in every response
- PrismaCode for database errors
- User-friendly messages
- Structured one-line logging: `[create_customer_failed] requestId=... prismaCode=... message="..." meta=...`

**Error Mapping:**
- **Validation (Zod)** → 400 with `validation_failed`, field details
- **P2002 (unique)** → 409 with `customer_exists`, conflicting fields
- **P2003 (foreign key)** → 400 with `invalid_reference`
- **P2025 (not found)** → 404 with `not_found`
- **Other P-codes** → 500 with `database_error`, prismaCode
- **Generic errors** → 500 with `server_error`

**2. Frontend: Show Full Error Details** (`src/utils/api.ts`)

Enhanced error message to include:
- Backend message (human-readable)
- RequestId: `(requestId: req_123_abc)`
- PrismaCode: `[P2002]`
- Validation details

**3. Frontend: Better Toast** (`src/tabs/onboarding/components/CreateCustomerStep.tsx`)

Changed toast title to "Create customer failed" and increased duration to 8 seconds.

**4. Reproduction Script** (`server/scripts/repro-create-customer.cjs`)

Tests all error scenarios against live API endpoint.

---

## 📊 Expected Toast Formats

### Scenario 1: Missing Required Field (400)

**Backend Response:**
```json
{
  "error": "validation_failed",
  "message": "name: Required",
  "details": [{"path": ["name"], "message": "Required"}],
  "requestId": "req_1770816_abc123"
}
```

**Toast Displayed:**
```
Title: Create customer failed
Description: name: Required (requestId: req_1770816_abc123)
```

**Backend Log:**
```
[create_customer_failed] requestId=req_1770816_abc123 prismaCode=none message="name: Required" meta={}
```

---

### Scenario 2: Duplicate Name (409) - IF Unique Constraint Exists

**Backend Response:**
```json
{
  "error": "customer_exists",
  "message": "Customer already exists (unique constraint on name)",
  "details": "A customer with this name already exists in the database",
  "prismaCode": "P2002",
  "meta": {"conflictingFields": ["name"]},
  "requestId": "req_1770816_abc123"
}
```

**Toast Displayed:**
```
Title: Create customer failed
Description: Customer already exists (unique constraint on name) (requestId: req_1770816_abc123) [P2002]
```

**Backend Log:**
```
[create_customer_failed] requestId=req_1770816_abc123 prismaCode=P2002 message="Customer already exists (unique constraint on name)" meta={"target":["name"]}
```

**Note:** Current schema has NO unique constraint on customer name, so duplicates are allowed.

---

### Scenario 3: Database Connection Error (500)

**Backend Response:**
```json
{
  "error": "database_error",
  "message": "Database error (P1001): Can't reach database server",
  "details": "Can't reach database server at odcrm-postgres.postgres.database.azure.com:5432",
  "prismaCode": "P1001",
  "meta": {},
  "requestId": "req_1770816_abc123"
}
```

**Toast Displayed:**
```
Title: Create customer failed
Description: Database error (P1001): Can't reach database server (requestId: req_1770816_abc123) [P1001]
```

**Backend Log:**
```
[create_customer_failed] requestId=req_1770816_abc123 prismaCode=P1001 message="Database error (P1001): Can't reach database server" meta={...}
```

---

### Scenario 4: Invalid Data Type (400)

**Backend Response:**
```json
{
  "error": "validation_failed",
  "message": "monthlyIntakeGBP: Expected number, received string",
  "details": [{"path": ["monthlyIntakeGBP"], "message": "Expected number, received string"}],
  "requestId": "req_1770816_abc123"
}
```

**Toast Displayed:**
```
Title: Create customer failed
Description: monthlyIntakeGBP: Expected number, received string (requestId: req_1770816_abc123)
```

**Backend Log:**
```
[create_customer_failed] requestId=req_1770816_abc123 prismaCode=none message="monthlyIntakeGBP: Expected number, received string" meta={}
```

---

## 🧪 Testing Results

**Reproduction Script:** `server/scripts/repro-create-customer.cjs`

```bash
cd server
node scripts/repro-create-customer.cjs
```

**Results:**
```
✅ ALL TESTS PASSED

Error handling works correctly:
  1. Valid customers can be created (201)
  2. Missing required fields return validation error (400)
  3. Invalid data types are caught (400)
  4. All errors include requestId for debugging
  5. Error messages are user-friendly
```

**Backend Logs Show:**
- ✅ Structured one-line logging: `[create_customer_failed] requestId=... prismaCode=... message="..." meta=...`
- ✅ Request ID generation working
- ✅ Validation errors properly caught
- ✅ User-friendly error messages

---

## 🔍 Root Cause Analysis

**Original Issue:**
- Generic "Failed to create customer" error was likely caused by:
  1. **Validation failures** (missing name, invalid field types)
  2. **Network errors** (backend not reachable)
  3. **Database errors** (connection issues, schema mismatches)

**Why Users Saw Generic Error:**
- Frontend only showed the error string without details
- Backend returned simple error messages without structure
- No request ID for debugging production failures
- No prismaCode to identify database-specific issues

**After This Fix:**
- Users see: "name: Required (requestId: req_123_abc)"
- Backend logs: `[create_customer_failed] requestId=req_123_abc prismaCode=none message="name: Required" meta={}`
- Support can grep logs for request ID
- Error messages are specific and actionable

---

## 📝 Files Changed

| File | Lines | Change | Purpose |
|------|-------|--------|---------|
| `src/utils/api.ts` | 16-26 | Added errorDetails to ApiResponse type | Type safety for error metadata |
| `src/utils/api.ts` | 42-77 | Enhanced error parsing to include requestId & prismaCode | Show real backend errors in UI |
| `server/src/routes/customers.ts` | 533-540 | Added structured logging for validation failures | One-line grep-able logs |
| `server/src/routes/customers.ts` | 581-643 | Enhanced Prisma error handling with codes | Map P2002, P2003, P2025, etc. |
| `src/tabs/onboarding/components/CreateCustomerStep.tsx` | 69-81 | Improved toast error display | Show full error message |
| `server/scripts/repro-create-customer.cjs` | **NEW** | Reproduction script for all error scenarios | Test without UI |
| `CREATE_CUSTOMER_ERROR_FIX.md` | **NEW** | This documentation | Complete error reference |

---

## ✅ Verification

**Run reproduction script:**
```bash
# Start backend
cd server && npm run dev

# In another terminal
cd server
node scripts/repro-create-customer.cjs
```

**Expected:** All 5 tests pass

**Check backend logs for:**
```
[create_customer_failed] requestId=req_... prismaCode=... message="..." meta=...
```

---

## 🚀 Deployment

**Status:**
- ✅ Backend builds successfully
- ✅ Frontend builds successfully (previous test)
- ✅ Reproduction script passes all tests
- ✅ Structured logging verified
- ✅ No breaking changes
- ✅ Backward compatible

**Git Commands:**
```bash
git add src/utils/api.ts
git add src/tabs/onboarding/components/CreateCustomerStep.tsx
git add server/src/routes/customers.ts
git add server/scripts/repro-create-customer.cjs
git add CREATE_CUSTOMER_ERROR_FIX.md

git commit -m "Fix: expose real backend errors in create customer UI

WHAT CHANGED:
- Frontend: Show requestId and prismaCode in error toast
- Backend: Return structured errors with requestId, prismaCode, meta
- Backend: Log one-line structured errors for grep: [create_customer_failed]
- Added repro script: server/scripts/repro-create-customer.cjs

WHY:
- Users saw generic 'Failed to create customer' without details
- No way to debug production failures (no request ID)
- Backend errors not properly mapped to user messages

TESTING:
- Repro script passes all 5 test scenarios
- Validation errors show field name and details
- RequestId included in all error responses
- Structured logging works for grep-ability

IMPACT:
- Users see actionable error messages with request ID
- Support can debug with: grep 'req_123_abc' logs
- No breaking changes, fully backward compatible"

git push origin main
```

---

## 🐛 Common Scenarios & Expected Behavior

### 1. User Forgot to Enter Name

**What Happens:**
1. User clicks "Create Customer & Continue" with empty name
2. Frontend validates (already has client-side check)
3. If bypassed, backend returns:
   ```json
   {
     "error": "validation_failed",
     "message": "name: Required",
     "requestId": "req_..."
   }
   ```
4. Toast shows: **"name: Required (requestId: req_...)"**
5. Backend logs: `[create_customer_failed] requestId=req_... prismaCode=none message="name: Required" meta={}`

**User Action:** Enter a name and try again

---

### 2. Invalid Field Type (unlikely but possible)

**What Happens:**
1. User somehow submits invalid data type (e.g., string for number field)
2. Backend Zod validation catches it
3. Returns: `"monthlyIntakeGBP: Expected number, received string"`
4. Toast shows full message with requestId

**User Action:** Fix the data type (or report bug if UI allowed invalid input)

---

### 3. Network/Connection Error

**What Happens:**
1. Backend not reachable or database down
2. Frontend catches network error
3. Shows: "Network error" or "Database error (P1001): Can't reach database server"

**User Action:** Check internet connection, try again later, contact support

---

### 4. Duplicate Customer (if unique constraint added in future)

**What Happens:**
1. User creates customer "Acme Corp"
2. User tries to create "Acme Corp" again
3. Backend returns 409 with P2002
4. Toast shows: **"Customer already exists (unique constraint on name) [P2002]"**

**User Action:** Use a different name or find the existing customer

**Note:** Currently, schema allows duplicate names (no unique constraint).

---

## 🔍 Debugging Production Issues

**If user reports "Failed to create customer":**

1. **Ask for the full error message:**
   - After this fix, they should see: "name: Required (requestId: req_...)"
   - Get the request ID

2. **Search backend logs:**
   ```bash
   grep "req_1770816_abc123" logs/server.log
   ```
   
   Or search for structured line:
   ```bash
   grep "[create_customer_failed]" logs/server.log | tail -10
   ```

3. **Look for:**
   - `requestId` - Correlate with user report
   - `prismaCode` - Database-specific errors (P2002, P1001, etc.)
   - `message` - Human-readable error
   - `meta` - Additional context (conflicting fields, etc.)

4. **Common Fixes:**
   - **Validation errors** → Guide user to fix input
   - **P1001** → Database connection issue, check Azure
   - **P2002** → Duplicate data, help user find existing record
   - **P2003** → Foreign key issue, check references

---

## 📚 Technical Details

### Request ID Format

```typescript
const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
// Example: req_1770816190327_g1j16a
```

### Structured Log Format

```
[create_customer_failed] requestId=<id> prismaCode=<code|none> message="<msg>" meta=<json>
```

**Why this format:**
- Grep-able: `grep "[create_customer_failed]" logs/server.log`
- Key-value pairs for parsing
- Single line for easy log aggregation
- JSON meta for structured data

### Error Response Schema

```typescript
{
  error: string          // Machine-readable code (validation_failed, customer_exists, etc.)
  message: string        // Human-readable message for UI
  details?: any          // Additional context (validation errors array, etc.)
  prismaCode?: string    // Prisma error code (P2002, P1001, etc.)
  meta?: object          // Error-specific metadata
  requestId: string      // Unique request identifier
}
```

### Frontend Error Display Logic

```typescript
// api.ts builds error message:
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
// "Customer already exists (unique constraint on name) (requestId: req_123_abc) [P2002]"
```

---

## 🧪 Test Coverage

**Reproduction script tests:**
1. ✅ Valid customer creation (201)
2. ✅ Missing required field (400, validation_failed)
3. ✅ Duplicate customer (409 if unique constraint exists, 201 currently)
4. ✅ Invalid data type (400, validation_failed)
5. ✅ Empty payload (400, validation_failed)

**All tests verify:**
- Correct HTTP status codes
- Error response structure
- RequestId inclusion
- User-friendly messages

---

## 🚨 Important Notes

### No Tenant/Scoping Issues

**Finding:** POST /api/customers does NOT require X-Customer-Id header.

**Why:** Creating a customer doesn't need an existing customer context.

**Frontend behavior:**
- `api.ts` sends `X-Customer-Id` if available (from settingsStore)
- Backend ignores it for customer creation
- No conflicts or errors from this

**Recommendation:** Keep as-is. No changes needed.

### No Unique Constraints on Customer Name/Domain

**Finding:** Prisma schema has indexes but NO unique constraints:

```prisma
model Customer {
  name   String
  domain String?
  
  @@index([name])    // Index for performance
  @@index([domain])  // Index for performance
  // NO @@unique constraints
}
```

**Impact:**
- Multiple customers can have same name ✅ (intentional for business flexibility)
- P2002 errors won't occur for customer name/domain
- Test script confirms this is working as designed

**Recommendation:** Keep as-is. This is correct business logic.

---

## 📋 Checklist

**Implementation:**
- [x] Backend returns structured JSON errors (error, message, requestId, prismaCode)
- [x] Backend logs one-line structured errors with all fields
- [x] Frontend shows full backend error message in toast
- [x] Frontend includes requestId in displayed error
- [x] Frontend includes prismaCode in displayed error
- [x] Validation errors show field name and reason
- [x] Prisma errors mapped to proper HTTP status codes
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

**Safety:**
- [x] No breaking changes
- [x] No schema modifications
- [x] No auth/tenant rule changes
- [x] Validation enhanced, not removed
- [x] Minimal diff, targeted changes only

---

## 🎯 Summary

**What we fixed:**
1. ✅ Backend now returns structured errors with requestId and prismaCode
2. ✅ Frontend automatically shows these details in error toast
3. ✅ Backend logs one grep-able line per failure
4. ✅ Error messages are specific and actionable
5. ✅ No silent failures - all errors observable

**Changes are:**
- Minimal (3 files + 1 new script)
- Safe (backward compatible, no breaking changes)
- Observable (structured logging, requestId, prismaCode)

**Ready for production deployment!**

---

## 🚀 Post-Deployment Verification

1. **Deploy to production** (git push triggers auto-deploy)
2. **Test create customer:**
   - Try without name → Should show: "name: Required (requestId: req_...)"
   - Try with valid data → Should succeed
3. **Check logs:**
   - Search for: `grep "[create_customer_failed]" logs`
   - Verify structured format
4. **Verify UI:**
   - Error toasts show full message with requestId
   - Duration is 8 seconds (enough time to read and copy requestId)

---

**End of Fix Documentation**