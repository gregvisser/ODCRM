# Prisma Deployment on Azure App Service

## Overview

This guide documents the proper setup for running Prisma migrations on Azure App Service, and how to troubleshoot the error:

```
/home/site/wwwroot/node_modules/.bin/prisma: 1: ../prisma/build/index.js: not found
```

---

## ✅ Correct Setup (Current State)

Your project is already correctly configured:

### 1. Dependencies in `package.json`

```json
"dependencies": {
  "prisma": "^5.19.0",           // ✅ In dependencies (not devDependencies)
  "@prisma/client": "^5.19.0"    // ✅ In dependencies
}
```

**Why this matters:**
- If `prisma` is in `devDependencies`, production installs skip it
- Both packages must be in `dependencies` for runtime migration support

### 2. GitHub Actions Workflow (Migrations Run During Build)

```yaml
- name: Apply database migrations
  run: cd server && npx prisma migrate deploy
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}

- name: Regenerate Prisma client after migrations
  run: cd server && npm run prisma:generate
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

**This is the correct approach:**
- Migrations run during GitHub Actions build
- NOT at runtime on Azure App Service
- Ensures migrations complete before deployment
- Prevents production database issues

### 3. Postinstall Hook

```json
"scripts": {
  "postinstall": "prisma generate --schema=./prisma/schema.prisma"
}
```

**Why this matters:**
- Ensures Prisma Client is generated after `npm install`
- Runs automatically on Azure App Service after deployment
- No manual intervention needed

---

## 🚫 Why You Shouldn't Run Migrations at Runtime

**DO NOT run migrations manually on Azure App Service SSH** unless it's an emergency repair.

### Reasons:

1. **Race Conditions**
   - Multiple instances might run migrations simultaneously
   - Can cause database locks or corruption

2. **No Rollback on Failure**
   - If migration fails mid-way, app is deployed anyway
   - Database and code can be out of sync

3. **No Audit Trail**
   - Manual migrations aren't tracked in CI/CD logs
   - Can't see what changed or when

4. **Deployment Complexity**
   - Adds manual steps to deployment process
   - Prone to human error

**Correct Approach:**
- Migrations run in GitHub Actions (before deployment)
- If migration fails, deployment stops
- Manual SSH access only for emergency repairs

---

## 🔧 Emergency Repair: Prisma CLI Not Working on Azure

If you SSH into Azure App Service and `npx prisma` fails with:

```
/home/site/wwwroot/node_modules/.bin/prisma: 1: ../prisma/build/index.js: not found
```

### Diagnosis

Run the diagnostic script:

```bash
cd /home/site/wwwroot
bash scripts/diagnose-prisma.sh
```

**Common Causes:**

1. **Corrupted node_modules**
   - Previous deployment failed mid-install
   - Symlinks in `.bin` directory broken

2. **Production-only install**
   - If Azure runs `npm install --production`, devDependencies are skipped
   - Prisma must be in `dependencies` (already correct in your case)

3. **Wrong Node.js version**
   - Prisma 5.x requires Node.js 16+
   - Check: `node -v` (should be 24.x based on your `package.json`)

### Fix Steps

#### Option A: Quick Repair (Recommended)

```bash
# 1. Navigate to app directory
cd /home/site/wwwroot

# 2. Remove corrupted installation
rm -rf node_modules package-lock.json

# 3. Reinstall (this uses production dependencies)
npm install --legacy-peer-deps

# 4. Verify Prisma CLI works
npx prisma -v

# Expected output:
# prisma                  : 5.19.0
# @prisma/client          : 5.19.0

# 5. Generate Prisma Client
npm run prisma:generate

# 6. Test database connection
npx prisma db pull --schema=./prisma/schema.prisma

# 7. Run migrations (if needed)
npm run prisma:migrate:deploy
```

#### Option B: Full Reset

```bash
# 1. Stop app service (Azure Portal)
# Portal → App Service → Stop

# 2. SSH to app service
cd /home/site/wwwroot

# 3. Backup current state
tar -czf backup-$(date +%Y%m%d-%H%M%S).tar.gz \
  node_modules package-lock.json dist/

# 4. Clean slate
rm -rf node_modules package-lock.json dist/

# 5. Fresh install
npm install

# 6. Build application
npm run build

# 7. Generate Prisma Client
npm run prisma:generate

# 8. Run migrations
npm run prisma:migrate:deploy

# 9. Start app service (Azure Portal)
# Portal → App Service → Start
```

#### Option C: Redeploy from GitHub

**Safest option - let GitHub Actions handle it:**

```bash
# On your local machine
git commit --allow-empty -m "Trigger Azure redeploy"
git push origin main

# Wait for GitHub Actions to complete
gh run watch

# Verify production
curl https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net/health
```

---

## 🔍 Diagnostic Commands

Use these commands to verify Prisma installation health:

### 1. Check Prisma CLI Version

```bash
npx prisma -v

# ✅ Expected output:
# prisma                  : 5.19.0
# @prisma/client          : 5.19.0
# Computed binaryTarget   : debian-openssl-3.0.x
# Query Engine (Node-API) : libquery-engine 473ed3124229e22d881cb7addf559799debae1ab (at node_modules/@prisma/engines/libquery_engine-debian-openssl-3.0.x.so.node)

# ❌ Bad output:
# /home/site/wwwroot/node_modules/.bin/prisma: 1: ../prisma/build/index.js: not found
```

### 2. Check Prisma Package

```bash
node -p "require('prisma/package.json').version"

# ✅ Expected: 5.19.0
# ❌ Error: Cannot find module 'prisma/package.json'
```

### 3. Check Binary Files

```bash
ls -la node_modules/prisma/build/index.js

# ✅ Expected:
# -rw-r--r-- 1 ... 12345 ... node_modules/prisma/build/index.js

# ❌ Error:
# ls: cannot access 'node_modules/prisma/build/index.js': No such file or directory
```

### 4. Check Symlinks

```bash
ls -la node_modules/.bin/prisma

# ✅ Expected:
# lrwxrwxrwx 1 ... node_modules/.bin/prisma -> ../prisma/build/index.js

# ❌ Error (broken symlink):
# lrwxrwxrwx 1 ... node_modules/.bin/prisma -> ../prisma/build/index.js (red text)
```

### 5. Check Environment Variables

```bash
# Check if DATABASE_URL is set
echo $DATABASE_URL | head -c 50

# ✅ Expected:
# postgresql://user:pass@server.postgres.database.azure.com...

# ❌ Empty or error:
# (blank output)
```

### 6. Test Database Connection

```bash
npx prisma db pull --schema=./prisma/schema.prisma

# ✅ Expected:
# Prisma schema loaded from prisma/schema.prisma
# Datasource "db": PostgreSQL database "..."
# Introspecting based on datasource defined in prisma/schema.prisma
# ✔ Introspected 15 models and 0 enums

# ❌ Error:
# Error: P1001: Can't reach database server at `...`
```

---

## 📊 Automated Diagnostic Script

Use the provided diagnostic script:

```bash
# On Azure SSH or local environment
cd server
bash scripts/diagnose-prisma.sh
```

**Output Interpretation:**

```
✅ PASS: All checks passed - Prisma is healthy
⚠️  WARN: Non-critical issue detected (usually OK)
❌ FAIL: Critical issue - follow suggested fix
```

---

## 🚀 Deployment Best Practices

### 1. Local Development

```bash
# Start local backend
cd server
npm run dev

# Run migrations (dev mode)
npm run prisma:migrate:dev
```

### 2. Before Committing

```bash
# Ensure Prisma Client is up to date
npm run prisma:generate

# Test migrations locally
npm run prisma:migrate:dev

# Build to verify TypeScript
npm run build

# Check for errors
npm run build 2>&1 | grep -i error
```

### 3. Deployment via GitHub Actions

```bash
# Commit changes
git add .
git commit -m "Your changes"

# Push (triggers deployment)
git push origin main

# Monitor deployment
gh run watch

# Expected stages:
# ✅ Install dependencies (npm ci)
# ✅ Generate Prisma client
# ✅ Apply migrations (npx prisma migrate deploy)
# ✅ Build application
# ✅ Deploy to Azure
```

### 4. Post-Deployment Verification

```bash
# Check health endpoint
curl https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net/health

# Expected: { "status": "ok", ... }

# Check database connection
curl https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net/api/customers

# Expected: [{ customer data }] or []
```

---

## 🔐 Environment Variables on Azure

Verify these are set in Azure App Service:

### Required Variables

```bash
# Check via Azure CLI
az webapp config appsettings list \
  --name odcrm-api-hkbsfbdzdvezedg8 \
  --resource-group <resource-group> \
  --query "[].{name:name, value:value}" \
  --output table

# Required variables:
# - DATABASE_URL (PostgreSQL connection string)
# - AZURE_STORAGE_CONNECTION_STRING (Blob storage)
# - MICROSOFT_CLIENT_ID (OAuth)
# - MICROSOFT_CLIENT_SECRET (OAuth)
# - PORT (3001)
```

### Set Missing Variables

```bash
# Via Azure Portal:
# App Service → Configuration → Application settings → New application setting

# Via Azure CLI:
az webapp config appsettings set \
  --name odcrm-api-hkbsfbdzdvezedg8 \
  --resource-group <resource-group> \
  --settings DATABASE_URL="postgresql://..." \
  --output table
```

---

## 🛑 Common Errors & Solutions

### Error: "Cannot find module 'prisma'"

**Cause:** Prisma not installed or in devDependencies

**Solution:**
```bash
# Check package.json
grep -A 10 '"dependencies"' package.json | grep prisma

# Should show:
# "prisma": "^5.19.0"

# If in devDependencies, move to dependencies:
npm install --save prisma@latest
npm install --save @prisma/client@latest
```

### Error: "Environment variable not found: DATABASE_URL"

**Cause:** DATABASE_URL not set in Azure App Service

**Solution:**
```bash
# Set via Azure Portal
# App Service → Configuration → Application settings → DATABASE_URL

# Or via Azure CLI
az webapp config appsettings set \
  --name odcrm-api-hkbsfbdzdvezedg8 \
  --resource-group <resource-group> \
  --settings DATABASE_URL="<your-connection-string>"
```

### Error: "Prisma Client is not compatible with this Prisma schema"

**Cause:** Prisma Client generated before schema changes

**Solution:**
```bash
# Regenerate Prisma Client
npm run prisma:generate

# Or in production SSH
cd /home/site/wwwroot
npx prisma generate --schema=./prisma/schema.prisma
```

### Error: "Migration failed to apply"

**Cause:** Database state doesn't match expected state

**Solution:**
```bash
# Check migration history
npx prisma migrate status

# If migrations out of sync, mark as applied (careful!)
npx prisma migrate resolve --applied "<migration-name>"

# Or reset (DESTRUCTIVE - dev only)
npm run prisma:reset
```

---

## 📚 Additional Resources

- [Prisma Deployment Docs](https://www.prisma.io/docs/guides/deployment)
- [Azure App Service Node.js Docs](https://learn.microsoft.com/en-us/azure/app-service/quickstart-nodejs)
- [Prisma Migrate Production Guide](https://www.prisma.io/docs/guides/migrate/production-troubleshooting)

---

## ✅ Verification Checklist

After any Prisma-related changes or repairs:

```
[ ] Prisma CLI works: npx prisma -v
[ ] Prisma Client generated: node_modules/@prisma/client exists
[ ] Database connection works: npx prisma db pull
[ ] Migrations applied: npx prisma migrate status
[ ] App builds: npm run build
[ ] App starts: npm start (or npm run dev)
[ ] API responds: curl http://localhost:3001/health
[ ] Production verified: curl https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net/health
```

---

**Last Updated:** 2026-02-10
**Status:** Production-ready configuration
**Review Schedule:** As needed (when Prisma issues arise)
