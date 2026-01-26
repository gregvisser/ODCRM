# 🚀 ODCRM Azure Migration - Complete Step-by-Step Guide

## Prerequisites Checklist ✅
- [ ] Azure subscription active
- [ ] Azure CLI installed (`winget install Microsoft.AzureCLI` or download from Microsoft)
- [ ] Node.js 18+ installed
- [ ] GitHub repository access
- [ ] GoDaddy DNS access
- [ ] All configuration files committed to repository

---

## PHASE 1: Azure Resource Provisioning

### Step 1.1: Install Azure CLI
```powershell
# Install Azure CLI
winget install Microsoft.AzureCLI

# Or download from: https://aka.ms/installazurecliwindows
```

### Step 1.2: Login to Azure
```powershell
az login
```
- This opens a browser for authentication
- Sign in with your Azure account

### Step 1.3: Run Azure Setup Script
```powershell
# Run the setup script I created
.\azure-setup-commands.ps1
```

This creates:
- Resource Group: `odcrm-rg`
- PostgreSQL Database: `odcrm-postgres`
- App Service Plan: `odcrm-app-plan`
- App Service: `odcrm-api`
- Static Web App: `odcrm-frontend`

---

## PHASE 2: Configuration

### Step 2.1: Configure Environment Variables
```powershell
# Run the configuration script
.\azure-config-commands.ps1
```

**IMPORTANT**: Update these values in the script first:
- Replace `"YourStrongPassword123!"` with your actual PostgreSQL password
- Replace Microsoft authentication values with your actual Azure AD app values
- Add API keys manually in Azure Portal (OPENAI_API_KEY, etc.)

### Step 2.2: Set Up GitHub Secrets
Follow the instructions in `github-secrets-setup.md`

### Step 2.3: Database Migration
```powershell
# Run database migration
.\database-migration-commands.ps1
```

---

## PHASE 3: DNS & Domain Setup

### Step 3.1: Configure Custom Domain
Follow instructions in `dns-setup-instructions.md`

### Step 3.2: Update Static Web App Configuration
Update `staticwebapp.config.json` with your actual App Service URL:
```json
{
  "routes": [
    {
      "route": "/api/*",
      "backend": {
        "url": "https://your-app-service-name.azurewebsites.net"
      }
    }
  ]
}
```

---

## PHASE 4: Testing & Verification

### Step 4.1: Run Tests
```powershell
# Run the testing script
.\testing-verification.ps1
```

### Step 4.2: Manual Testing
1. Visit `https://odcrm.bidlow.co.uk`
2. Test user login (Microsoft authentication)
3. Test data operations (CRUD operations)
4. Check browser developer tools for API calls

### Step 4.3: Test CI/CD
1. Make a small change to trigger deployment
2. Push to main branch
3. Check GitHub Actions for successful deployment

---

## PHASE 5: Go-Live & Cleanup

### Step 5.1: Update DNS (Final Cutover)
Once everything works:
1. Update GoDaddy DNS to point to Azure
2. Wait 24-48 hours for propagation
3. Verify at `https://odcrm.bidlow.co.uk`

### Step 5.2: Decommission Old Services
Follow `docs/cleanup-after-migration.md`:
- Delete Vercel project
- Delete Render service
- Optionally delete Neon database

### Step 5.3: Monitor & Optimize
- Monitor Azure costs
- Set up alerts
- Test backups
- Optimize resource sizes if needed

---

## Emergency Rollback Plan

If something goes wrong:

1. **DNS Rollback**: Point DNS back to Vercel/Render temporarily
2. **Service Recreation**: Recreate services if needed
3. **Database**: Keep Neon as backup

---

## Success Criteria ✅

Migration is complete when:
- [ ] `https://odcrm.bidlow.co.uk` loads successfully
- [ ] User authentication works
- [ ] All API endpoints function
- [ ] Database operations work
- [ ] CI/CD deploys automatically
- [ ] DNS resolves correctly
- [ ] SSL certificates are valid

---

## Files Created for You

- ✅ `.github/workflows/deploy-backend-azure.yml` - Backend CI/CD
- ✅ `.github/workflows/deploy-frontend-azure-static-web-app.yml` - Frontend CI/CD
- ✅ `staticwebapp.config.json` - Static Web App routing
- ✅ `server/.env.example` - Backend environment variables
- ✅ `docs/README-azure-migration.md` - Complete migration guide
- ✅ All setup scripts and configuration files

**You're ready to migrate! Follow the phases above in order.**