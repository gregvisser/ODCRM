# PROOF CHECKLIST — DATABASE_URL Mismatch + Blob Security

## ⚠️ THE PROBLEM

Backend error: `"The column customers.agreementBlobName does not exist in the current database."`

**Root cause:** DATABASE_URL mismatch between:
- **GitHub Actions** (runs migrations on DB A)
- **Azure App Service** (connects to DB B at runtime)

## 🎯 GOAL

1. Identify which databases are being used
2. Align Azure App Service to use the same database as migrations
3. Verify blob security (private container + SAS-only access)

---

## 📋 SECTION 1: DIAGNOSE DATABASE_URL MISMATCH

### Windows PowerShell Steps (run from your dev machine)

**Step 1.1: Check GitHub Actions DATABASE_URL (from logs)**

```powershell
# Go to: https://github.com/gregvisser/ODCRM/actions
# Click latest "Deploy Backend to Azure App Service" run
# Find step: "Log DB connection info (sanitized)"
# Look for output: "DB Host: <hostname>.postgres.database.azure.com"
```

**PASS:** You see a hostname like `odcrm-postgres-yesterday.postgres.database.azure.com`  
**RECORD THIS:** CI DB Host = `_______________________________`

---

**Step 1.2: Check Azure App Service DATABASE_URL**

```powershell
# Option A: Via Azure Portal (easiest)
# 1. Azure Portal → App Services → odcrm-api-hkbsfbdzdvezedg8
# 2. Left menu → Configuration → Application settings
# 3. Find: DATABASE_URL
# 4. Click "Show value" (👁️ icon)
# 5. Look for hostname after @ symbol
#    Format: postgresql://user:pass@HOSTNAME.postgres.database.azure.com:5432/...

# Option B: Via Azure CLI
az webapp config appsettings list --name odcrm-api-hkbsfbdzdvezedg8 --resource-group <YOUR_RESOURCE_GROUP> --query "[?name=='DATABASE_URL'].value" -o tsv
# Parse hostname from output
```

**PASS:** You see a DATABASE_URL  
**RECORD THIS:** App Service DB Host = `_______________________________`

---

**Step 1.3: Compare hostnames**

**MISMATCH if:** CI DB Host ≠ App Service DB Host  
**Example:**
- CI uses: `odcrm-postgres-yesterday.postgres.database.azure.com`
- App Service uses: `odcrm-postgres.postgres.database.azure.com` ← different!

**If MISMATCH:** Go to Section 2A (Fix: Align DATABASE_URL)  
**If SAME:** Go to Section 2B (Fix: Apply migrations on correct DB)

---

### Azure SSH Steps (verify column existence)

**Step 1.4: Check if agreementBlobName column exists on running backend's DB**

```bash
# SSH to Azure App Service
# Portal: App Service → SSH → Go

# Print DB host (sanitized)
cd /home/site/wwwroot
node -e "const url = process.env.DATABASE_URL; const match = url?.match(/@([^:\/]+)/); console.log('DB Host:', match ? match[1] : 'NOT SET');"
```

**RECORD THIS:** Runtime DB Host = `_______________________________`

```bash
# Check if column exists
cd /home/site/wwwroot
node -e "
const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();
prisma.\$queryRaw\`
  SELECT column_name 
  FROM information_schema.columns 
  WHERE table_name = 'customer' 
    AND column_name IN ('agreementBlobName', 'agreementContainerName')
  ORDER BY column_name
\`.then(rows => {
  console.log('Columns found:', rows.length);
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
"
```

**PASS:** Output shows:
```json
Columns found: 2
[
  { "column_name": "agreementBlobName" },
  { "column_name": "agreementContainerName" }
]
```

**FAIL:** Output shows `Columns found: 0` → Columns don't exist on this DB

---

## 📋 SECTION 2A: FIX — Align DATABASE_URL (if mismatch)

### Azure Portal Steps

**Step 2A.1: Update DATABASE_URL in Azure App Service**

1. **Azure Portal** → **App Services** → **odcrm-api-hkbsfbdzdvezedg8**
2. Left menu → **Configuration** → **Application settings**
3. Find **DATABASE_URL** → Click **Edit** (pencil icon)
4. **Replace** the connection string with the one used by GitHub Actions:
   ```
   postgresql://USER:PASS@odcrm-postgres-yesterday.postgres.database.azure.com:5432/postgres?schema=public
   ```
   ⚠️ **Use the EXACT hostname from Step 1.1 (CI DB Host)**
5. Click **OK**
6. Click **Save** (top bar)
7. Click **Continue** (confirm save)

**Step 2A.2: Restart App Service**

1. Top bar → **Restart** → **Yes**
2. Wait 30-60 seconds

**Step 2A.3: Verify fix**

```powershell
# Test endpoint (replace <CUSTOMER_ID> with real ID that has an agreement)
$response = Invoke-RestMethod "https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net/api/customers/<CUSTOMER_ID>/agreement-download" -Method Get
$response | ConvertTo-Json
```

**PASS:** JSON with `url`, `fileName`, `expiresAt` (no "column does not exist" error)  
**FAIL:** Still error → Go to Section 2B

---

## 📋 SECTION 2B: FIX — Apply migrations on correct DB (if same host but columns missing)

### Azure SSH Steps

**Step 2B.1: Apply migrations**

```bash
cd /home/site/wwwroot
npx prisma migrate deploy --schema=./prisma/schema.prisma
```

**PASS:** Output shows:
```
30 migrations found in prisma/migrations
X migrations applied
Database is now up to date!
```

**Step 2B.2: Verify columns exist**

```bash
# Re-run the column check from Step 1.4
cd /home/site/wwwroot
node -e "
const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();
prisma.\$queryRaw\`
  SELECT column_name 
  FROM information_schema.columns 
  WHERE table_name = 'customer' 
    AND column_name IN ('agreementBlobName', 'agreementContainerName')
  ORDER BY column_name
\`.then(rows => {
  console.log('Columns found:', rows.length);
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
"
```

**PASS:** Output shows `Columns found: 2`

**Step 2B.3: Restart app (from Azure Portal)**

Portal → App Service → Restart

---

## 📋 SECTION 3: VERIFY BLOB SECURITY

### Step 3.1: Set container to PRIVATE in Azure Portal

1. **Azure Portal** → **Storage accounts** → [your storage account]
2. Left menu → **Containers** → **customer-agreements**
3. Click **Change access level** (top bar)
4. Select **Private (no anonymous access)**
5. Click **OK**

**PASS:** Container shows "Access level: Private"

---

### Step 3.2: Verify direct blob URL fails (anonymous access blocked)

```powershell
# Replace with a REAL blob name from your storage (e.g., from a customer record)
curl.exe -I "https://<STORAGE_ACCOUNT>.blob.core.windows.net/customer-agreements/<BLOB_NAME>.pdf"
```

**PASS:** HTTP 403 (AuthenticationFailed) OR 404 (ResourceNotFound)  
**FAIL:** HTTP 200 OK → Container is still public; repeat Step 3.1

---

### Step 3.3: Verify SAS endpoint works

**PowerShell:**

```powershell
# Replace <CUSTOMER_ID> with real ID that has an agreement
$response = Invoke-RestMethod "https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net/api/customers/<CUSTOMER_ID>/agreement-download" -Method Get
Write-Host "Response:"
$response | ConvertTo-Json

# Extract SAS URL
$sasUrl = $response.url
Write-Host "`nTesting SAS URL..."
curl.exe -I $sasUrl
```

**PASS:**
- First command returns JSON with `"url":"https://...?sv=...&sig=..."`
- Second command (curl.exe) returns `HTTP/1.1 200 OK`

**FAIL:** 
- If JSON missing or error → DATABASE_URL still wrong or migrations not applied
- If curl returns 403 → SAS generation failed; check AZURE_STORAGE_CONNECTION_STRING in App Service

---

### Step 3.4: Verify SAS expires after 15 minutes (optional)

```powershell
# Wait 16 minutes after Step 3.3, then:
curl.exe -I $sasUrl
```

**PASS:** HTTP 403 (AuthenticationFailed / signature expired)

---

## 📋 SECTION 4: VERIFY COLUMNS EXIST (Azure SSH)

```bash
cd /home/site/wwwroot
npx prisma migrate status
```

**PASS:** Shows `Database schema is up to date!` and `30 migrations found`

```bash
# List customer table columns
cd /home/site/wwwroot
node -e "
const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();
prisma.\$queryRaw\`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'customer' 
    AND column_name LIKE 'agreement%'
  ORDER BY column_name
\`.then(rows => {
  console.log('Agreement columns:');
  console.table(rows);
  process.exit(0);
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
"
```

**PASS:** Output shows:
```
┌─────┬──────────────────────────────┬───────────┐
│     │ column_name                  │ data_type │
├─────┼──────────────────────────────┼───────────┤
│ 0   │ agreementBlobName            │ text      │
│ 1   │ agreementContainerName       │ text      │
│ 2   │ agreementFileName            │ text      │
│ 3   │ agreementFileMimeType        │ text      │
│ 4   │ agreementFileUrl             │ text      │
│ 5   │ agreementUploadedAt          │ timestamp │
│ 6   │ agreementUploadedByEmail     │ text      │
└─────┴──────────────────────────────┴───────────┘
```

---

## ✅ FINAL CHECKLIST

```
DATABASE FIX:
[ ] Step 1.1: CI DB Host recorded
[ ] Step 1.2: App Service DB Host recorded
[ ] Step 1.3: Mismatch identified (if any)
[ ] Step 2A: DATABASE_URL updated + App Service restarted (if mismatch)
  OR
[ ] Step 2B: Migrations applied on correct DB (if same host)
[ ] Step 1.4: agreementBlobName columns exist (verified on SSH)
[ ] Step 2A.3 or 2B.3: Endpoint returns SAS URL without error

BLOB SECURITY:
[ ] Step 3.1: Container set to Private in Azure Portal
[ ] Step 3.2: Direct blob URL returns 403/404 (not 200)
[ ] Step 3.3: SAS endpoint returns valid URL + curl returns 200
[ ] Step 3.4: SAS expires after 15 minutes (optional)

VERIFICATION:
[ ] Step 4: npx prisma migrate status shows "up to date"
[ ] Step 4: Agreement columns visible in information_schema
```

---

## 🚨 TROUBLESHOOTING

### Problem: Step 1.4 shows Runtime DB Host different from CI DB Host

**Solution:** Follow Section 2A (align DATABASE_URL)

### Problem: Step 2A.3 still returns "column does not exist"

**Possible causes:**
1. App Service didn't restart → Manually restart again
2. DATABASE_URL still wrong → Check spelling of hostname
3. Cached connections → Wait 2-3 minutes, restart again

### Problem: Step 2B.1 prisma migrate deploy fails

**Error:** "Migration X failed"

**Solution:**
```bash
# Check migration status
cd /home/site/wwwroot
npx prisma migrate status

# If a migration is marked as failed:
npx prisma migrate resolve --applied "<MIGRATION_NAME>"

# Then retry:
npx prisma migrate deploy
```

### Problem: Step 3.3 returns 401 Unauthorized

**Solution:** Your API requires authentication.
1. Open https://odcrm.bidlow.co.uk in browser
2. Log in
3. Open a customer with an agreement
4. Open DevTools (F12) → Network tab
5. Click "View agreement"
6. Right-click the `/agreement-download` request → Copy as PowerShell
7. Run the copied command (includes auth cookies)

### Problem: Step 3.3 SAS URL returns 403 immediately

**Possible causes:**
1. AZURE_STORAGE_CONNECTION_STRING not set in App Service
2. Storage account key rotated
3. Container name mismatch

**Solution:**
```bash
# On Azure SSH, verify env var is set:
cd /home/site/wwwroot
node -e "console.log('AZURE_STORAGE_CONNECTION_STRING:', process.env.AZURE_STORAGE_CONNECTION_STRING ? 'SET (length: ' + process.env.AZURE_STORAGE_CONNECTION_STRING.length + ')' : 'NOT SET');"
```

If NOT SET → Add it in Azure Portal → App Service → Configuration → Application settings

---

**Last Updated:** 2026-02-10  
**Status:** Active troubleshooting checklist
