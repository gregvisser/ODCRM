# DO THIS NOW — Checklist + Proof

## 1) STEP-BY-STEP CHECKLIST (copy/paste)

### A) PRISMA — Verify strategy and fix SSH if needed

**Decision: Migrations run ONLY in GitHub Actions (preferred).**  
You do not need to run `prisma migrate deploy` on Azure SSH for normal operation. If you need to run it in an emergency, use the repair sequence below.

**1. Prove CI runs migrations (you already have this):**  
Open: https://github.com/gregvisser/ODCRM/actions → latest successful "Deploy Backend to Azure App Service" → "Apply database migrations" step.  
You should see the log lines shown in **PROOF A** below.

**2. On Azure App Service SSH, run these and record outputs:**

```bash
node -v
```

```bash
cd /home/site/wwwroot && ls -la node_modules/prisma/build/index.js
```

```bash
cd /home/site/wwwroot && npx prisma -v
```

```bash
cd /home/site/wwwroot && npx prisma migrate status
```

**3. If (2c) or (2d) fails** (e.g. `../prisma/build/index.js: not found`), run this **emergency repair** then re-run (2c) and (2d):

```bash
cd /home/site/wwwroot
rm -rf node_modules package-lock.json
npm install
npx prisma -v
npx prisma migrate status
```

Then **restart the app** from Azure Portal: App Service → Overview → Restart.

---

### B) BLOB — Make container private and prove SAS-only access

**1. In code (already correct):**  
No change. Container is created with no public access. See **PROOF B** below.

**2. In Azure Portal (you must do this):**

1. Azure Portal → **Storage accounts** → [your storage account]
2. Left menu → **Containers** → **customer-agreements**
3. Click **Change access level** (top bar)
4. Select **Private (no anonymous access)** → **OK**

**3. Verify container is private (run one of these):**

**Option 1 (az login):**

```bash
az storage container show --name customer-agreements --account-name <STORAGE_ACCOUNT_NAME> --auth-mode login --query "properties.publicAccess"
```

**Expected output:** `null`  
(If you see `"blob"` or `"container"`, access is still public.)

**Option 2 (connection string in env):**

```bash
# On a machine where AZURE_STORAGE_CONNECTION_STRING is set, or pass it inline:
az storage container show --name customer-agreements --connection-string "$AZURE_STORAGE_CONNECTION_STRING" --query "properties.publicAccess"
```

**Expected output:** `null`

**4. Prove direct blob URL does NOT work (anonymous):**

Replace `<storage>`, `<blob>.pdf` with a real storage account name and any blob name in that container (e.g. from a customer record).

```bash
curl -I "https://<storage>.blob.core.windows.net/customer-agreements/<blob>.pdf"
```

**Acceptable:** `HTTP/1.1 403` (AuthenticationFailed) or `HTTP/1.1 404` (ResourceNotFound).  
**Not acceptable:** `HTTP/1.1 200 OK` (container still public).

**5. Prove SAS endpoint works:**

Replace `<id>` with a real customer id that has an agreement (e.g. from your app).  
If your API requires auth, use the browser: open a customer with an agreement, open DevTools → Network → click "View agreement" → right‑click the `agreement-download` request → Copy as cURL, then run that (or add the same Cookie/Authorization to the curl below).

```bash
curl -sS "https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net/api/customers/<id>/agreement-download"
```

**Expected:** JSON with a SAS URL, e.g.:

```json
{"url":"https://...blob.core.windows.net/.../...?sv=...&sig=...","fileName":"...","mimeType":"application/pdf","expiresAt":"..."}
```

Copy the `url` value, then:

```bash
curl -I "<SAS_URL>"
```

**Expected:** `HTTP/1.1 200 OK`

**6. Prove SAS expires (optional):**  
Wait 16 minutes, then run `curl -I "<SAS_URL>"` again.  
**Expected:** `HTTP/1.1 403` (AuthenticationFailed / signature expired).

---

### C) FRONTEND — Confirm “View Agreement” uses SAS only

No code changes. Frontend already calls `/agreement-download` and opens the returned URL. See **PROOF C** below.

---

## 2) CODE DIFFS

**Blob (container private):** Already correct in repo. No diff.

- **File:** `server/src/utils/blobUpload.ts`  
- **Lines 66–71:** `createIfNotExists()` is called with **no** `access` option, so the container is created with default (private) access.

**Frontend:** No changes. Both “View agreement” handlers call the SAS endpoint and open `data.url`.

**No unified diffs to apply.**

---

## 3) PROOF

### PROOF A — GitHub Actions: `prisma migrate deploy` ran and succeeded

From run **21879116571** (Fix: Resolve failed migration blocking deployment), step **Apply database migrations**:

```
##[group]Run cd server && npx prisma migrate deploy
cd server && npx prisma migrate deploy
shell: /usr/bin/bash -e {0}
env:
  DATABASE_URL: ***
##[endgroup]
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "postgres", schema "public" at "odcrm-postgres-yesterday.postgres.database.azure.com:5432"
30 migrations found in prisma/migrations
No pending migrations to apply.
```

So in CI: dependencies are installed with `npm ci`, then `npx prisma migrate deploy` runs and reports “No pending migrations to apply.” **Migrations are run only in GitHub Actions; that is the chosen strategy.**

---

### PROOF A — SSH: What you should see (and if not, why)

Run these on App Service SSH and compare.

**a) `node -v`**  
**Expected:** `v24.x.x` (or at least v20+).  
If different, Node version may not match `engines` in package.json.

**b) `cd /home/site/wwwroot && ls -la node_modules/prisma/build/index.js`**  
**Expected:** A line like `-rw-r--r-- 1 ... node_modules/prisma/build/index.js` (file exists).  
**If:** `No such file or directory` → Prisma CLI is missing or broken (e.g. deploy omitted it or used production-only install). Use the emergency repair in section 1A.

**c) `cd /home/site/wwwroot && npx prisma -v`**  
**Expected:** Something like:
```
prisma                  : 5.19.0 (or 5.22.0)
@prisma/client          : 5.19.0 (or 5.22.0)
...
```
**If:** `../prisma/build/index.js: not found` → Same as (b). Use emergency repair.

**d) `cd /home/site/wwwroot && npx prisma migrate status`**  
**Expected:** 
```
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database ...
X migrations found in prisma/migrations
Database schema is up to date!
```
**If:** Same “not found” error → Use emergency repair, then re-run (c) and (d).

**Why SSH can be broken:** Azure may deploy only part of the app (e.g. `dist` + `package.json`) and run `npm install --production` or a different install, or the packaged `node_modules` may not include Prisma’s build. Keeping migrations in CI avoids relying on Prisma CLI on the server.

---

### PROOF B — Code: Container is not created with public access

**File:** `server/src/utils/blobUpload.ts`  
**Lines 65–71 (exact snippet):**

```ts
    // Get container client (create if not exists)
    const containerClient = blobServiceClient.getContainerClient(containerName)
    
    // Create container if it doesn't exist (idempotent)
    // CRITICAL: Container MUST be private - all access via SAS only
    // Omitting 'access' property defaults to private (no anonymous access)
    await containerClient.createIfNotExists()
```

There is no `access: 'blob'` or any public access. So **we do NOT create containers with public access**. Making the existing container private in the Portal is still required (see checklist B).

---

### PROOF C — Frontend uses SAS endpoint only

**1. CustomerOnboardingTab.tsx**

- **Lines 1466, 1480–1481:**  
  - Calls `fetch(\`/api/customers/${customer.id}/agreement-download\`)`, then `const data = await response.json()` and `window.open(data.url, '_blank')`.  
  - So it uses the **SAS URL** returned by the backend. No direct blob URL.

**2. AccountsTab.tsx**

- **Lines 6294, 6309–6310:**  
  - Same: `fetch(\`/api/customers/${customer.id}/agreement-download\`)`, then `const data = await response.json()` and `window.open(data.url, '_blank')`.  
  - Again, only the SAS URL from the API is used.

**Conclusion:** “View Agreement” only uses `/agreement-download` and the returned `url`. It does not render or store direct blob URLs. **No frontend changes needed.**

---

## 4) What cannot be proven from here

- **Your actual SSH output** — You must run (a)–(d) and compare to the expected outputs above.
- **Your actual blob URL** — You must run the direct-blob `curl -I` with a real URL; we can’t run it for you.
- **Your actual SAS response** — You must run the agreement-download `curl` with a real customer id and confirm the JSON shape and that `curl -I <SAS_URL>` returns 200, then 403 after 16 minutes.

**Next action if something doesn’t match:**  
- Prisma on SSH: run the emergency repair in 1A, then re-check (2c) and (2d).  
- Direct blob returns 200: set container to Private in Portal and re-run the `curl -I` check.  
- SAS endpoint fails: check backend logs and `AZURE_STORAGE_CONNECTION_STRING` (and that the customer has `agreementBlobName` / `agreementContainerName` or legacy URL for backfill).
