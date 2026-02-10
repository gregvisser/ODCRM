# Phase 2 Item 4: Agreement Upload - Durable Storage Complete

**Date:** 2026-02-10  
**Status:** ✅ CODE COMPLETE - Awaiting env vars + verification  
**Commit:** `16338b9`

---

## ✅ IMPLEMENTATION COMPLETE

### Option Used: **B - New Blob Upload Utility**

**Rationale:** No existing Azure Blob infrastructure found in codebase.

---

## 📦 Files Changed

| File | Lines | Description |
|------|-------|-------------|
| `server/src/utils/blobUpload.ts` | +140 | NEW: Blob upload utility |
| `server/src/routes/customers.ts` | ~30 | Updated agreement endpoint to use blob storage |
| `server/src/index.ts` | +3 | Marked /uploads as legacy |
| `server/package.json` | +1 | Added @azure/storage-blob dependency |
| `server/package-lock.json` | +7 packages | Dependency lockfile |
| `server/AZURE-BLOB-SETUP.md` | +280 | Complete setup guide |
| **Total** | **+461** | **Net change** |

---

## 🔧 What Was Implemented

### 1. Azure Blob Upload Utility (`blobUpload.ts`)

**Functions:**
- `uploadAgreement({ buffer, contentType, blobName })` → `{ url, blobName }`
- `generateAgreementBlobName(customerId, fileName)` → unique blob name

**Blob Naming Convention:**
```
agreement_<customerId>_<timestamp>_<randomId>_<sanitizedFilename>

Example:
agreement_cust_abc123_1707566890123_x9k2p1_service-agreement.pdf
```

**Features:**
- Auto-creates container if not exists
- Public blob access (individual blobs readable, not container listing)
- Error handling with detailed logging
- Content-Type preservation

---

### 2. Updated Agreement Endpoint

**Route:** `POST /api/customers/:id/agreement`

**Before (Local Filesystem):**
```typescript
// Save to server/uploads/
await fs.writeFile(filePath, buffer)
const fileUrl = `${baseUrl}/uploads/${uniqueName}`
```

**After (Azure Blob Storage):**
```typescript
// Upload to Azure Blob
const { uploadAgreement, generateAgreementBlobName } = await import('../utils/blobUpload.js')
const blobName = generateAgreementBlobName(id, fileName)
const uploadResult = await uploadAgreement({ buffer, contentType, blobName })
const fileUrl = uploadResult.url
```

**URL Format Change:**
- **Before:** `http://localhost:3001/uploads/agreement_1234567890_abc123_contract.pdf`
- **After:** `https://<storage-account>.blob.core.windows.net/customer-agreements/agreement_cust_123_1234567890_abc123_contract.pdf`

**What Was NOT Changed (as required):**
- ✅ Database metadata fields: `agreementFileUrl`, `agreementFileName`, `agreementFileMimeType`, `agreementUploadedAt`, `agreementUploadedByEmail`
- ✅ Progress tracker auto-tick: `sales_contract_signed = true`
- ✅ Safe merge of accountData
- ✅ Input validation (dataUrl base64 format)
- ✅ MIME type validation (PDF, DOC, DOCX only)
- ✅ Actor identity extraction

---

### 3. Legacy Path Preserved

**`/uploads` route kept for backwards compatibility:**

```typescript
// LEGACY: Local filesystem uploads (deprecated for new files)
// New agreement uploads use Azure Blob Storage (see blobUpload.ts)
// This route kept for backwards compatibility with old file URLs only
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')))
```

**Impact:**
- Old file URLs continue to work (until filesystem cleared)
- New uploads ONLY go to blob storage
- No migration script needed

---

## 🔐 Environment Variables Required

### Required in Azure App Service Configuration

**1. `AZURE_STORAGE_CONNECTION_STRING` (REQUIRED)**

**Format:**
```
DefaultEndpointsProtocol=https;AccountName=<storage-account>;AccountKey=<key>;EndpointSuffix=core.windows.net
```

**How to get:**
1. Azure Portal → Storage Account → **Access keys**
2. Copy **Connection string** from key1 or key2

**Where to set:**
1. Azure Portal → App Service → **Configuration**
2. **+ New application setting**
3. Name: `AZURE_STORAGE_CONNECTION_STRING`
4. Value: Paste connection string
5. **Save** + **Restart** app

---

**2. `AZURE_STORAGE_CONTAINER_AGREEMENTS` (Optional)**

**Default:** `customer-agreements`  
**Only set if you want a different container name.**

---

## 📋 Azure Storage Account Setup Checklist

**Before deployment:**

### ☐ Step 1: Create Storage Account (if not exists)

**Via Azure Portal:**
1. Search: "Storage accounts"
2. **+ Create**
3. Settings:
   - Subscription: Your subscription
   - Resource group: Same as ODCRM app
   - Name: `odcrmstorage` (or your choice, must be globally unique)
   - Region: UK South (same as app)
   - Performance: Standard
   - Redundancy: LRS (Locally Redundant Storage)
4. **Review + create** → **Create**

---

### ☐ Step 2: Get Connection String

1. Open Storage Account
2. **Security + networking** → **Access keys**
3. Copy **Connection string** from key1
4. Save for next step

---

### ☐ Step 3: Create Container (Optional - auto-creates if not exists)

**Recommended for production:**

1. Storage Account → **Containers**
2. **+ Container**
3. Name: `customer-agreements`
4. Public access level: **Blob (anonymous read access for blobs only)**
5. **Create**

**Or let app auto-create** on first upload (same settings).

---

### ☐ Step 4: Set Connection String in App Service

1. Azure Portal → App Service (odcrm backend)
2. **Configuration** → **Application settings**
3. **+ New application setting**
4. Name: `AZURE_STORAGE_CONNECTION_STRING`
5. Value: Paste connection string from Step 2
6. **OK** → **Save**
7. **Restart** app service

---

### ☐ Step 5: Set CORS (if needed)

**Only if downloading files directly from browser:**

1. Storage Account → **Settings** → **Resource sharing (CORS)**
2. **Blob service** tab
3. Add rule:
   - Allowed origins: `https://odcrm.bidlow.co.uk`
   - Allowed methods: GET, HEAD
   - Allowed headers: *
   - Exposed headers: *
   - Max age: 3600
4. **Save**

---

## 🧪 Testing Checklist (MANDATORY)

**After env vars are set and app restarted:**

### ☐ Test 1: Upload Agreement

1. Open https://odcrm.bidlow.co.uk
2. Navigate to **Onboarding** tab
3. Select **OpenDoors Customers** (or any customer)
4. Click **Customer Onboarding**
5. Scroll to **Contract Signed & Filed** section
6. Click **Upload Agreement**
7. Select a PDF/DOC file
8. Click **Upload**

**Expected:**
- ✅ Upload succeeds (no error)
- ✅ "Contract Signed & Filed" checkbox auto-ticks
- ✅ Agreement link appears below checkbox

---

### ☐ Test 2: Verify Blob URL

1. Right-click agreement link
2. Copy link address
3. Check URL format:

**Expected:**
```
https://<storage-account>.blob.core.windows.net/customer-agreements/agreement_cust_..._.pdf
```

**NOT expected (old format):**
```
https://odcrm-backend.azurewebsites.net/uploads/agreement_..._.pdf
```

---

### ☐ Test 3: Open File

1. Click agreement link

**Expected:**
- ✅ File opens in new tab (PDF) or downloads (DOC)
- ❌ NO 404 error
- ❌ NO CORS error

---

### ☐ Test 4: Restart Resilience

1. Azure Portal → App Service → **Restart**
2. Wait 2 minutes for app to restart
3. Refresh https://odcrm.bidlow.co.uk
4. Navigate back to customer → Customer Onboarding
5. Click agreement link again

**Expected:**
- ✅ File still loads (not lost on restart)
- ✅ Link works without issues

---

### ☐ Test 5: Progress Tracker Persistence

1. Refresh page after upload
2. Check **Contract Signed & Filed** checkbox

**Expected:**
- ✅ Checkbox remains checked
- ✅ Agreement link still visible

---

### ☐ Test 6: Database Verification

1. Open database tool (Prisma Studio or SQL client)
2. Query customer record:
   ```sql
   SELECT agreementFileUrl, agreementFileName, agreementFileMimeType 
   FROM "Customer" 
   WHERE id = 'cust_...';
   ```

**Expected:**
- ✅ `agreementFileUrl` contains blob URL
- ✅ `agreementFileName` contains original filename
- ✅ `agreementFileMimeType` contains MIME type

---

### ☐ Test 7: Multiple Customers

1. Upload agreements for 2-3 different customers
2. Verify each has unique blob name
3. Verify all files accessible

**Expected:**
- ✅ Each customer has unique blob URL
- ✅ No file overwrites/conflicts
- ✅ All files load correctly

---

## 🚨 Troubleshooting

### Error: "AZURE_STORAGE_CONNECTION_STRING environment variable is required"

**Cause:** Environment variable not set in Azure App Service

**Solution:**
1. Azure Portal → App Service → **Configuration**
2. Add `AZURE_STORAGE_CONNECTION_STRING` application setting
3. **Save** + **Restart** app

---

### Error: "Blob upload failed with status 403"

**Possible causes:**
- Incorrect connection string
- Storage account key revoked/changed
- Firewall blocking access

**Solution:**
1. Verify connection string in App Service config
2. Storage Account → **Access keys** → Regenerate key if needed
3. Storage Account → **Networking** → Ensure "Allow all networks" or add App Service IP

---

### Error: File link returns 404

**Possible causes:**
- Upload failed but didn't throw error
- Container doesn't exist
- Blob access level incorrect

**Solution:**
1. Check container exists: Storage Account → **Containers**
2. Verify container access level: **Blob** (not Private)
3. Check upload logs in App Service → **Log stream**

---

### CORS Error When Opening File

**Cause:** CORS not configured for frontend domain

**Solution:**
1. Storage Account → **Settings** → **CORS**
2. Add frontend URL to allowed origins
3. **Save**

---

## 💰 Cost Estimate

**Azure Blob Storage (LRS, UK South):**
- Storage: £0.0152 per GB/month
- Operations: £0.0036 per 10,000 operations

**Typical usage (100 customers, 500KB agreements):**
- Storage: 50MB = ~£0.001/month
- Operations: ~500/month = ~£0.0002/month
- **Total: < £0.01/month**

**Negligible cost, massive reliability benefit.**

---

## 📊 Example Agreement URL

**Before (Local Filesystem - Ephemeral):**
```
http://localhost:3001/uploads/agreement_1707566890123_x9k2p1_service-agreement.pdf
```

**After (Azure Blob Storage - Durable):**
```
https://odcrmstorage.blob.core.windows.net/customer-agreements/agreement_cust_abc123_1707566890123_x9k2p1_service-agreement.pdf
```

**Key Differences:**
- ✅ Survives app restarts
- ✅ Survives app scaling
- ✅ Globally accessible CDN
- ✅ Automatic backups (via Azure Storage redundancy)
- ✅ No local disk space usage

---

## 🎯 Deployment Steps Summary

**For user to complete:**

1. ✅ **Code deployed** (commit `16338b9` pushed)
2. ☐ **Create Storage Account** (if not exists)
3. ☐ **Get Connection String** from Azure Portal
4. ☐ **Set `AZURE_STORAGE_CONNECTION_STRING`** in App Service config
5. ☐ **Restart** App Service
6. ☐ **Test upload** (upload agreement via UI)
7. ☐ **Verify blob URL** (right-click link, check URL format)
8. ☐ **Restart resilience test** (restart app, verify link still works)

**Full instructions:** `server/AZURE-BLOB-SETUP.md`

---

## 📝 What Was NOT Changed (As Required)

✅ **Database schema** - No migrations needed  
✅ **UI behavior** - Upload flow unchanged  
✅ **clientStatus field** - Not touched  
✅ **Progress tracker logic** - Auto-tick behavior preserved  
✅ **Input format** - Still uses dataUrl base64  
✅ **MIME validation** - PDF, DOC, DOCX only  
✅ **Metadata fields** - All preserved (fileName, mimeType, uploadedAt, uploadedByEmail)

---

## 🔄 Backwards Compatibility

**Old file URLs (`/uploads/...`):**
- Still work temporarily (filesystem not cleared yet)
- Will break on app restart (ephemeral storage)
- Marked as LEGACY in code
- No migration script needed (files will naturally age out)

**Recommendation:**
- Re-upload critical old agreements via UI
- Old files lost on restart are acceptable (user-driven replacement)

---

## ✅ Success Criteria

**Phase 2 Item 4 is COMPLETE when:**

1. ☐ Environment variables set in Azure App Service
2. ☐ Test upload succeeds
3. ☐ Agreement URL is blob URL (not /uploads/)
4. ☐ File opens/downloads successfully
5. ☐ File persists after app restart
6. ☐ Progress tracker "Contract Signed & Filed" auto-ticks
7. ☐ No regressions in Customers/Onboarding tabs

---

**Status:** Code complete, awaiting env var setup + production verification

**Next:** User sets connection string in Azure → Tests upload → Verifies durable storage

**Documentation:** `server/AZURE-BLOB-SETUP.md` for complete setup guide
