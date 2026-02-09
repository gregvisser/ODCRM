# Production Hotfix - 2026-02-09

**Status:** 🔄 DEPLOYMENT IN PROGRESS  
**Severity:** CRITICAL - Production Down  
**Time to Resolution:** ~15 minutes (from diagnosis to fix deployed)

---

## 🚨 SYMPTOMS REPORTED

1. ✅ 500 error when loading/creating Contacts
2. ✅ No data shown in OpenDoors Customers / Onboarding
3. ⏳ Google Sheet link still shows raw/ugly or unlabeled (need to verify after fix)
4. ✅ Most changes not showing up

---

## 🎯 ROOT CAUSE IDENTIFIED

**Problem:** Agreement fields added via `prisma db push` but NO MIGRATION FILE created

### Timeline
- **11:47 AM** - Last proper migration: `20260209600000_add_customer_audit_events`
- **~1:00 PM** - Agreement fields added using `prisma db push --accept-data-loss`
  - This synced local database
  - **NO migration file created**
- **1:11 PM** - Code pushed to production with agreement field references
- **1:14 PM** - Backend deployment completed
  - Migration system found NO pending migrations
  - Production database missing agreement columns
- **1:15 PM+** - **PRODUCTION BROKEN**
  - All customer endpoints returning 500
  - Serialization failing on missing `agreementUploadedAt` field

### Technical Details

**Missing Columns in Production:**
- `agreementFileUrl` TEXT
- `agreementFileName` TEXT
- `agreementFileMimeType` TEXT
- `agreementUploadedAt` TIMESTAMP(3)
- `agreementUploadedByEmail` TEXT

**Code Attempting to Serialize Missing Fields:**
- `server/src/routes/customers.ts` line 87: `agreementUploadedAt: customer.agreementUploadedAt?.toISOString() || null`
- `server/src/routes/customers.ts` line 95: Same serialization in list endpoint

**Error Cascade:**
1. GET /api/customers → 500 (can't serialize missing columns)
2. GET /api/customers/:id → 500 (same issue)
3. Frontend fails to load customer list → No data in UI
4. Frontend fails to load customer details → No onboarding data
5. Contacts endpoints fail → Dependent on customer fetch

---

## ✅ FIX IMPLEMENTED

### Solution: Create Missing Migration

**Migration File:** `server/prisma/migrations/20260209132434_add_customer_agreement_fields/migration.sql`

```sql
-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "agreementFileUrl" TEXT,
ADD COLUMN     "agreementFileName" TEXT,
ADD COLUMN     "agreementFileMimeType" TEXT,
ADD COLUMN     "agreementUploadedAt" TIMESTAMP(3),
ADD COLUMN     "agreementUploadedByEmail" TEXT;
```

**Commit:** `734daf5` - "HOTFIX: Add missing migration for agreement fields - fixes production 500 errors"

**Deployed:** 2026-02-09 13:25:16 UTC

---

## 🔍 DEPLOYMENT VERIFICATION

### Deployment Status
- **Started:** 13:25:16 UTC
- **Expected Duration:** 3-5 minutes
- **Status:** 🔄 IN PROGRESS

### Post-Deployment Checklist (MANDATORY)

Once deployment completes:

#### 1. Backend Migration Applied
```bash
# Check GitHub Actions logs for:
"1 migrations found to apply"
"Migration 20260209132434_add_customer_agreement_fields applied successfully"
```

#### 2. Production API Endpoints
- [ ] GET https://odcrm.bidlow.co.uk/api/health → 200 OK
- [ ] GET https://odcrm.bidlow.co.uk/api/customers → 200 OK (not 500)
- [ ] GET https://odcrm.bidlow.co.uk/api/customers/{any-id} → 200 OK (not 500)

#### 3. Frontend Data Loading
- [ ] Open https://odcrm.bidlow.co.uk
- [ ] Hard refresh: Ctrl+Shift+R (clear cache)
- [ ] OpenDoors Customers tab → Data loads (no empty state)
- [ ] Customer Onboarding tab → Customer data shows
- [ ] Contacts section → Loads without 500 error

#### 4. Google Sheet Label Display
- [ ] Accounts tab → Customer with leadsReportingUrl
- [ ] Check "Google Sheets for Leads" field
- [ ] Should show custom label if leadsGoogleSheetLabel is set
- [ ] Should NOT show raw URL

#### 5. Browser Console (F12)
- [ ] No 500 errors in Network tab
- [ ] No JavaScript errors in Console tab
- [ ] API responses contain data (not error messages)

---

## 📊 IMPACT ANALYSIS

### Duration of Outage
- **Start:** ~13:15 UTC (after Phase 2 Item 4 deployment)
- **Fix Deployed:** 13:25 UTC
- **Total:** ~10 minutes of production downtime

### Affected Functionality
- ✅ All customer data fetching (100% broken)
- ✅ Customer Onboarding tab (100% broken)
- ✅ Contacts management (100% broken)
- ✅ Accounts tab customer display (100% broken)

### User Impact
- **Severity:** CRITICAL - Application unusable
- **Affected Users:** ALL users
- **Data Loss:** NONE (DB intact, only missing columns)

---

## 🔐 LESSONS LEARNED

### What Went Wrong

1. **Used `prisma db push` instead of `prisma migrate dev`**
   - `db push` syncs schema without creating migration files
   - Works for local dev but breaks production deployment
   - Migration system needs actual SQL files

2. **Didn't verify migration files before pushing**
   - Should have checked `server/prisma/migrations/` directory
   - Would have caught missing migration immediately

3. **Didn't test with fresh database**
   - Local database had columns from `db push`
   - Code worked locally but failed in production
   - Need to test migrations in clean environment

### Prevention Measures

**MANDATORY RULE:** Always use `prisma migrate dev --name <description>` for schema changes

**Never use `prisma db push` except for:**
- Rapid prototyping (throwaway code)
- Local experimentation
- Schema exploration

**Pre-Deployment Checklist:**
1. ✅ Check migrations directory for new migration files
2. ✅ Verify migration SQL matches schema changes
3. ✅ Test migration on clean database
4. ✅ Commit migration files BEFORE pushing code changes

**Additional Safeguards:**
1. Add CI/CD check to fail if code references fields not in migrations
2. Add pre-push hook to verify migrations exist for schema changes
3. Document migration workflow in mandatory rules

---

## 🔧 RELATED ISSUES TO ADDRESS

### Red Flag #1: Agreement Storage (LOCAL FILESYSTEM)

**Current Implementation:**
- Files stored in `server/uploads/` directory
- Served via `express.static`
- **PROBLEM:** Azure App Service filesystem is ephemeral
  - Deployments wipe files
  - Restarts lose files
  - Scaling breaks file availability

**Required Fix:** Migrate to Azure Blob Storage
- **Priority:** HIGH (data loss risk)
- **Complexity:** LOW (straightforward migration)
- **Impact:** Zero downtime possible

**Implementation Plan:**
1. Create Azure Storage Account (if not exists)
2. Create Blob container: `customer-agreements`
3. Update upload endpoint to use Azure Blob SDK
4. Generate SAS URLs for secure access
5. Update existing file URLs (migration script)
6. Test upload + retrieval
7. Deploy

### Red Flag #2: Base64 Upload Method

**Current Implementation:**
- Client sends `{ fileName, dataUrl: "data:...;base64,..." }`
- Large files = large JSON payloads
- Can be slow, risky

**Assessment:**
- Acceptable short-term (already used elsewhere)
- Lower priority than Blob storage
- Consider multipart/form-data later if issues arise

**Status:** ACCEPTABLE - No immediate action needed

---

## 📋 NEXT STEPS (IN ORDER)

### 1. Verify Hotfix (IMMEDIATE - Within 5 minutes)
- [ ] Check deployment completed successfully
- [ ] Run all verification checks above
- [ ] Confirm production stable
- [ ] Document any remaining issues

### 2. Address Storage Red Flag (HIGH PRIORITY - Today)
- [ ] Verify current agreement files persist
- [ ] Check Azure App Service filesystem behavior
- [ ] Implement Azure Blob storage migration
- [ ] Test in production
- [ ] Mark Item 4 complete only after this

### 3. Resume Phase 2 Work (ONLY AFTER ABOVE COMPLETE)
- [ ] Item 5: Account Manager linked to Settings Users
- [ ] Item 6: Notes linked to user accounts
- [ ] Item 7: Start/end date + renewal notifications
- [ ] Item 8: De-dup fields + compact UI

---

## 🎯 VERIFICATION TIMESTAMP

**Fix Deployed At:** 2026-02-09 13:25:16 UTC  
**Verification Required By:** 2026-02-09 13:35:00 UTC (10 min window)

**Verifier Checklist:**
- [ ] Deployment status: ✅ SUCCESS / ❌ FAILED
- [ ] Migration applied: ✅ YES / ❌ NO
- [ ] API endpoints: ✅ WORKING / ❌ BROKEN
- [ ] Frontend loads: ✅ WORKING / ❌ BROKEN
- [ ] Contacts work: ✅ WORKING / ❌ BROKEN
- [ ] Console clean: ✅ YES / ❌ ERRORS

**Production Status:** 🔄 PENDING VERIFICATION

---

**Created:** 2026-02-09 13:28 UTC  
**Last Updated:** 2026-02-09 13:28 UTC  
**Status:** 🔄 AWAITING DEPLOYMENT COMPLETION
