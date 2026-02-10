# Implementation Summary — DATABASE_URL Mismatch Fix + Guardrails

**Date:** 2026-02-10  
**Issue:** Backend returns "column agreementBlobName does not exist" because DATABASE_URL differs between CI (migrations) and App Service (runtime)

---

## 🎯 What Was Implemented

### 1. Diagnostic Checklist
**File:** `PROOF_CHECKLIST.md` (new)

Complete step-by-step checklist for:
- Diagnosing DATABASE_URL mismatch between CI and Azure App Service
- Two fix paths: align DATABASE_URL (Section 2A) or apply migrations (Section 2B)
- Verifying blob security (private container + SAS-only)
- PowerShell and Azure SSH commands with PASS/FAIL criteria

### 2. Guardrails to Prevent Recurrence
**Files modified:**
- `.github/workflows/deploy-backend-azure.yml`
- `server/README.md`
- `server/scripts/show-db-host.sh` (new)
- `server/scripts/show-db-host.ps1` (new)

**Changes:**
- GitHub Actions now validates Prisma setup (schema + migrations exist)
- GitHub Actions logs DB hostname (sanitized, never password) before migrations
- README emphasizes running Prisma commands from `/server` not repo root
- Created scripts to safely show DB hostname for verification

---

## 📋 Unified Diffs

### Diff 1: `.github/workflows/deploy-backend-azure.yml`

```diff
diff --git a/.github/workflows/deploy-backend-azure.yml b/.github/workflows/deploy-backend-azure.yml
index e51461c..cbd566f 100644
--- a/.github/workflows/deploy-backend-azure.yml
+++ b/.github/workflows/deploy-backend-azure.yml
@@ -32,6 +32,39 @@ jobs:
       env:
         DATABASE_URL: ${{ secrets.DATABASE_URL }}
 
+    - name: Validate Prisma setup
+      run: |
+        cd server
+        # Fail build if critical paths are wrong
+        if [ ! -f "prisma/schema.prisma" ]; then
+          echo "❌ ERROR: prisma/schema.prisma not found in /server"
+          exit 1
+        fi
+        if [ ! -d "prisma/migrations" ]; then
+          echo "❌ ERROR: prisma/migrations folder not found in /server"
+          exit 1
+        fi
+        MIGRATION_COUNT=$(find prisma/migrations -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)
+        if [ "$MIGRATION_COUNT" -eq 0 ]; then
+          echo "❌ ERROR: No migrations found in prisma/migrations"
+          exit 1
+        fi
+        echo "✅ Validation passed:"
+        echo "   - Schema: prisma/schema.prisma exists"
+        echo "   - Migrations: $MIGRATION_COUNT migrations found"
+
+    - name: Log DB connection info (sanitized)
+      run: |
+        cd server
+        # Extract and log only the hostname (never password)
+        DB_HOST=$(echo "$DATABASE_URL" | grep -oP '(?<=@)[^:/]+' || echo "PARSE_FAILED")
+        echo "✅ DB Host: $DB_HOST"
+        if [ "$DB_HOST" = "PARSE_FAILED" ]; then
+          echo "⚠️  WARNING: Could not parse DB hostname from DATABASE_URL"
+        fi
+      env:
+        DATABASE_URL: ${{ secrets.DATABASE_URL }}
+
     - name: Baseline existing migrations (if needed)
       run: |
         cd server
```

**Purpose:**
- **Validation:** Fails build early if Prisma files are in wrong location
- **Logging:** Shows DB hostname in logs for comparison with App Service
- **Security:** Never logs password, only hostname

---

### Diff 2: `server/README.md`

```diff
diff --git a/server/README.md b/server/README.md
index fedb359..b4d672f 100644
--- a/server/README.md
+++ b/server/README.md
@@ -2,6 +2,21 @@
 
 Backend API server for the OpensDoors CRM Email Campaigns module.
 
+## ⚠️ IMPORTANT: Always Run Prisma Commands from `/server`
+
+**Single source of truth:** All Prisma files are in `server/prisma/`
+
+```bash
+# ❌ WRONG (from repo root) - will fail or show "0 migrations found"
+npx prisma migrate status
+
+# ✅ CORRECT (from server directory)
+cd server
+npx prisma migrate status
+```
+
+**Why:** The repo root has `prisma/schema.prisma` (legacy/unused), but the canonical location is `server/prisma/`. Running from root will use the wrong path.
+
 ## Quick Start
 
 1. Install dependencies:
@@ -88,18 +103,44 @@ The server automatically starts two background workers:
 
 ## Database
 
-Uses Prisma ORM with PostgreSQL. Run migrations with:
+Uses Prisma ORM with PostgreSQL.
+
+### Run migrations (from `/server` directory):
 
 ```bash
+cd server
+
+# Development (creates migration + applies)
 npx prisma migrate dev
+
+# Production (applies existing migrations only)
+npx prisma migrate deploy
+
+# Check migration status
+npx prisma migrate status
 ```
 
-View database in Prisma Studio:
+### View database in Prisma Studio:
 
 ```bash
+cd server
 npx prisma studio
 ```
 
+### Check which database you're connected to:
+
+```bash
+cd server
+
+# Linux/macOS/Git Bash:
+bash scripts/show-db-host.sh
+
+# Windows PowerShell:
+.\scripts\show-db-host.ps1
+```
+
+This will print only the hostname (never the password) to verify you're connected to the correct database.
+
 ## Development
 
 ```bash
```

**Purpose:**
- **Education:** Emphasizes running from `/server` not repo root
- **Documentation:** Adds migration commands with clear labels
- **Verification:** Points to scripts for checking DB hostname

---

### New File: `server/scripts/show-db-host.sh`

```bash
#!/bin/bash
# show-db-host.sh - Safely display database hostname without exposing credentials
# Usage: bash scripts/show-db-host.sh

set -e

if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is not set"
  echo ""
  echo "Set it with:"
  echo "  export DATABASE_URL='postgresql://user:pass@hostname:5432/dbname'"
  echo ""
  exit 1
fi

# Extract hostname (everything between @ and : or /)
DB_HOST=$(echo "$DATABASE_URL" | grep -oP '(?<=@)[^:/]+' || echo "PARSE_FAILED")

if [ "$DB_HOST" = "PARSE_FAILED" ]; then
  echo "❌ ERROR: Could not parse hostname from DATABASE_URL"
  echo "Format should be: postgresql://user:pass@HOSTNAME:5432/dbname"
  exit 1
fi

echo "✅ Database hostname: $DB_HOST"
echo ""
echo "Example connection test (requires psql):"
echo "  psql \"\$DATABASE_URL\" -c 'SELECT version();'"
```

**Purpose:** Safe hostname extraction for Linux/macOS/Git Bash

---

### New File: `server/scripts/show-db-host.ps1`

```powershell
# show-db-host.ps1 - Safely display database hostname without exposing credentials
# Usage: .\scripts\show-db-host.ps1

$ErrorActionPreference = "Stop"

$DATABASE_URL = $env:DATABASE_URL

if (-not $DATABASE_URL) {
    Write-Host "❌ ERROR: DATABASE_URL environment variable is not set" -ForegroundColor Red
    Write-Host ""
    Write-Host "Set it with:" -ForegroundColor Yellow
    Write-Host "  `$env:DATABASE_URL = 'postgresql://user:pass@hostname:5432/dbname'" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# Extract hostname (everything between @ and : or /)
if ($DATABASE_URL -match '@([^:/]+)') {
    $DB_HOST = $matches[1]
    Write-Host "✅ Database hostname: $DB_HOST" -ForegroundColor Green
} else {
    Write-Host "❌ ERROR: Could not parse hostname from DATABASE_URL" -ForegroundColor Red
    Write-Host "Format should be: postgresql://user:pass@HOSTNAME:5432/dbname" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "To verify this matches your Azure App Service:" -ForegroundColor Cyan
Write-Host "1. Azure Portal → App Services → odcrm-api-hkbsfbdzdvezedg8" -ForegroundColor Gray
Write-Host "2. Configuration → Application settings → DATABASE_URL" -ForegroundColor Gray
Write-Host "3. Compare hostname in the connection string" -ForegroundColor Gray
```

**Purpose:** Safe hostname extraction for Windows PowerShell

---

### New File: `PROOF_CHECKLIST.md`

(See file content — complete diagnostic and fix checklist with Windows PowerShell and Azure SSH steps)

**Purpose:**
- Step-by-step instructions to diagnose mismatch
- Two fix paths depending on diagnosis
- PASS/FAIL criteria for every check
- Blob security verification steps

---

## 🚀 Next Steps for User

1. **Commit these changes:**
   ```powershell
   git add .
   git commit -m "Add DATABASE_URL diagnostic tools + guardrails

   - Add GitHub Actions validation for Prisma setup
   - Log DB hostname in CI (sanitized)
   - Create scripts to show DB host safely
   - Update docs: emphasize running from /server
   - Add PROOF_CHECKLIST.md for troubleshooting"
   git push origin main
   ```

2. **Follow PROOF_CHECKLIST.md:**
   - Open `PROOF_CHECKLIST.md`
   - Run Section 1 (diagnose mismatch)
   - Run Section 2A or 2B depending on diagnosis
   - Run Section 3 (verify blob security)
   - Run Section 4 (final verification)

3. **Monitor next GitHub Actions run:**
   - Check for new "Validate Prisma setup" step
   - Check "Log DB connection info" step for hostname
   - Compare with Azure App Service DATABASE_URL

---

## 🔍 Root Cause Analysis

**Why this happened:**
1. GitHub Actions `secrets.DATABASE_URL` points to DB A (migrations applied here)
2. Azure App Service `DATABASE_URL` points to DB B (migrations NOT applied)
3. No logging to catch the mismatch
4. No validation to ensure Prisma files in correct location

**How this fix prevents recurrence:**
1. ✅ GitHub Actions now logs DB hostname (sanitized)
2. ✅ GitHub Actions validates Prisma setup before migrations
3. ✅ Documentation emphasizes single source of truth (`server/prisma/`)
4. ✅ Scripts provided for user to check their DATABASE_URL
5. ✅ `PROOF_CHECKLIST.md` provides diagnostic procedure for future issues

---

## 📊 Files Changed Summary

```
Modified:
  .github/workflows/deploy-backend-azure.yml (+33 lines)
  server/README.md                            (+41 lines, reorganized)

Created:
  PROOF_CHECKLIST.md                          (370 lines)
  IMPLEMENTATION_SUMMARY.md                   (this file)
  server/scripts/show-db-host.sh              (25 lines)
  server/scripts/show-db-host.ps1             (30 lines)

Total: 2 modified, 4 new files
```

---

## ✅ Verification

**Before these changes:**
- ❌ No way to see which DB CI uses
- ❌ No validation of Prisma setup
- ❌ Unclear where to run Prisma commands
- ❌ No diagnostic procedure for DATABASE_URL mismatch

**After these changes:**
- ✅ GitHub Actions logs DB hostname
- ✅ Build fails if Prisma files wrong location
- ✅ Clear documentation: run from `/server`
- ✅ Scripts to check DATABASE_URL safely
- ✅ Complete diagnostic checklist in `PROOF_CHECKLIST.md`

---

**Status:** Ready for user to commit and follow `PROOF_CHECKLIST.md`  
**Next:** User runs checklist steps to fix their environment
