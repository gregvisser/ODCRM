# Azure Blob Storage Setup for Agreement Files

**Purpose:** Durable storage for customer agreement files (PDF, DOC, DOCX)  
**Date:** 2026-02-10  
**Status:** Required for production deployment

---

## Environment Variables Required

### 1. `AZURE_STORAGE_CONNECTION_STRING`

**Format:**
```
DefaultEndpointsProtocol=https;AccountName=<storage-account-name>;AccountKey=<account-key>;EndpointSuffix=core.windows.net
```

**How to get:**
1. Log into Azure Portal: https://portal.azure.com
2. Navigate to your Storage Account (or create new one)
3. Go to **Security + networking** → **Access keys**
4. Copy **Connection string** from key1 or key2

**Where to set:**

**Development (.env file):**
```bash
AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=odcrmstorage;AccountKey=...;EndpointSuffix=core.windows.net"
```

**Production (Azure App Service):**
1. Open Azure Portal → App Service → **Configuration**
2. Click **+ New application setting**
3. Name: `AZURE_STORAGE_CONNECTION_STRING`
4. Value: Paste connection string
5. Click **OK** → **Save**

---

### 2. `AZURE_STORAGE_CONTAINER_AGREEMENTS` (Optional)

**Default:** `customer-agreements`  
**Purpose:** Name of the blob container where agreements are stored

**Where to set (if different from default):**

**Development (.env file):**
```bash
AZURE_STORAGE_CONTAINER_AGREEMENTS=customer-agreements
```

**Production (Azure App Service):**
Only set if you want a different container name than default.

---

## Azure Storage Account Setup

### Step 1: Create Storage Account (if not exists)

```bash
# Via Azure CLI (optional)
az storage account create \
  --name odcrmstorage \
  --resource-group odcrm-rg \
  --location uksouth \
  --sku Standard_LRS \
  --kind StorageV2
```

**Or via Azure Portal:**
1. Search: "Storage accounts"
2. Click **+ Create**
3. Fill in:
   - Subscription: Your subscription
   - Resource group: Same as ODCRM app
   - Storage account name: `odcrmstorage` (or your choice)
   - Region: UK South (same as app)
   - Performance: Standard
   - Redundancy: LRS (or your choice)
4. Click **Review + create** → **Create**

---

### Step 2: Create Blob Container

**Option A: Auto-create (Handled by app)**

The app will automatically create the container on first upload with:
- Name: `customer-agreements`
- Access level: Blob (public read access for individual blobs)

**Option B: Pre-create (Recommended for production)**

```bash
# Via Azure CLI
az storage container create \
  --name customer-agreements \
  --account-name odcrmstorage \
  --public-access blob
```

**Or via Azure Portal:**
1. Open Storage Account → **Containers**
2. Click **+ Container**
3. Name: `customer-agreements`
4. Public access level: **Blob (anonymous read access for blobs only)**
5. Click **Create**

---

### Step 3: Set CORS (if serving files from browser)

If you need to download/preview files directly from browser:

**Azure Portal:**
1. Storage Account → **Settings** → **Resource sharing (CORS)**
2. **Blob service** tab
3. Add rule:
   - Allowed origins: `https://odcrm.bidlow.co.uk` (your frontend URL)
   - Allowed methods: GET, HEAD
   - Allowed headers: *
   - Exposed headers: *
   - Max age: 3600
4. Click **Save**

---

## Testing

### Test Connection (Local Development)

```bash
# From server directory
cd server
npm run dev

# In another terminal, test upload
curl -X POST http://localhost:3001/api/customers/cust_test123/agreement \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "test-agreement.pdf",
    "dataUrl": "data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKNCAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMSAwIFI+PgplbmRvYmoKMSAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMiAwIFJdL0NvdW50IDE+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDEgMCBSL1Jlc291cmNlcyAzIDAgUi9NZWRpYUJveFswIDAgNjEyIDc5Ml0vQ29udGVudHMgNSAwIFI+PgplbmRvYmoKMyAwIG9iago8PC9Gb250PDw+Pj4+CmVuZG9iago1IDAgb2JqCjw8L0xlbmd0aCA0NT4+CnN0cmVhbQpCVAovRjEgMTIgVGYKNTAgNzAwIFRkCihUZXN0IEFncmVlbWVudCkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYNCjAwMDAwMDAwMTUgMDAwMDAgbg0KMDAwMDAwMDA2NiAwMDAwMCBuDQowMDAwMDAwMTc2IDAwMDAwIG4NCjAwMDAwMDAyMDMgMDAwMDAgbg0KMDAwMDAwMDI2MyAwMDAwMCBuDQp0cmFpbGVyCjw8L1NpemUgNi9Sb290IDQgMCBSPj4Kc3RhcnR4cmVmCjM1NwolJUVPRgo="
  }'
```

**Expected response:**
```json
{
  "success": true,
  "customer": {
    "agreementFileUrl": "https://odcrmstorage.blob.core.windows.net/customer-agreements/agreement_cust_test123_1234567890_abc123_test-agreement.pdf",
    "agreementFileName": "test-agreement.pdf"
  }
}
```

---

### Test in Production

1. Deploy with environment variables set
2. Upload agreement via UI
3. Verify:
   - `agreementFileUrl` is a blob URL (not `/uploads/`)
   - URL format: `https://<storage-account>.blob.core.windows.net/customer-agreements/agreement_...`
   - Clicking link opens/downloads file
   - File persists after app restart

---

## Troubleshooting

### Error: "AZURE_STORAGE_CONNECTION_STRING environment variable is required"

**Solution:** Add connection string to environment variables (see above)

---

### Error: "Blob upload failed with status 403"

**Possible causes:**
- Incorrect connection string
- Storage account key revoked/changed
- Storage account firewall blocking requests

**Solution:**
1. Verify connection string is correct
2. Check Storage Account → **Access keys** → Regenerate if needed
3. Check Storage Account → **Networking** → Allow access from Azure services

---

### Error: Container not found

**Solution:**
- Container auto-creates on first upload
- Or manually create container (see Step 2 above)

---

### Files not loading (CORS error)

**Solution:**
- Set up CORS rules (see Step 3 above)
- Ensure blob access level is "Blob" (public read for individual blobs)

---

## Migration from Local Filesystem

**If you have existing files in `/uploads/` directory:**

1. Old files remain accessible at `/uploads/` URLs (legacy support)
2. New uploads automatically go to Azure Blob Storage
3. Old URLs will break if app restarts (ephemeral filesystem)
4. **Action:** Manually re-upload critical old agreements via UI

**No automatic migration needed** - old URLs kept for backwards compatibility.

---

## Cost Estimate

**Azure Blob Storage Pricing (LRS, UK South, approximate):**
- Storage: £0.0152 per GB/month
- Transactions: £0.0036 per 10,000 operations
- Bandwidth: First 5GB free, then £0.0622 per GB

**Example for 100 customers:**
- 100 agreements × 500KB each = 50MB = ~£0.001/month
- ~500 uploads + views/month = ~£0.00018/month
- **Total: < £0.01/month**

**Negligible cost, high reliability benefit.**

---

## Security Notes

1. **Connection String Security:**
   - Never commit connection string to git
   - Use Azure Key Vault for production (optional enhancement)
   - Rotate keys periodically

2. **Blob Access:**
   - Container set to "Blob" access (public read for individual blobs)
   - Container listing is NOT public
   - Blob URLs are unguessable (random IDs in filename)

3. **Alternative (More Secure):**
   - Use private container + SAS URLs with expiry
   - Requires generating SAS tokens on each request
   - Trade-off: More complex, short-lived URLs

**Current approach:** Public blob URLs (simple, no expiry issues)

---

## Summary

**Required for production:**
✅ Set `AZURE_STORAGE_CONNECTION_STRING` in Azure App Service config  
✅ Create or verify `customer-agreements` container exists  
✅ Set CORS if needed for browser access  

**Optional:**
- Set custom container name via `AZURE_STORAGE_CONTAINER_AGREEMENTS`
- Pre-create container instead of auto-create
- Use Azure Key Vault for connection string

**Cost:** < £0.01/month for typical usage  
**Benefit:** Durable file storage that survives restarts/scaling
