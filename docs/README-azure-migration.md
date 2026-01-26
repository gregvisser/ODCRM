# Azure Migration Guide: ODCRM SaaS Application

This guide provides a complete migration plan to move your ODCRM application from Vercel + Render + Neon to Azure cloud services.

## 🎯 Migration Overview

**Current Architecture:**
- Frontend: Vercel (React + Vite)
- Backend: Render (Node.js + Express + TypeScript)
- Database: Neon PostgreSQL
- Domain: bidlow.co.uk (GoDaddy)

**Target Architecture:**
- Frontend: Azure Static Web Apps
- Backend: Azure App Service (Linux, Node.js)
- Database: Azure Database for PostgreSQL Flexible Server
- CI/CD: GitHub Actions
- Domain: odcrm.bidlow.co.uk (GoDaddy → Azure)

## 📋 Pre-Migration Checklist

### ✅ Development Environment
- [ ] Node.js 18+ installed locally
- [ ] Azure CLI installed (`az --version`)
- [ ] GitHub repository access
- [ ] GoDaddy domain management access

### ✅ Azure Account Setup
- [ ] Azure subscription active
- [ ] Sufficient credits/quota for services
- [ ] Owner/contributor access to resource group

### ✅ Backup & Testing
- [ ] Current production data backed up
- [ ] Staging environment tested with current setup
- [ ] Rollback plan documented
- [ ] Emergency contacts identified

## 🚀 Step-by-Step Migration Guide

### Phase 1: Azure Resource Provisioning

#### 1.1 Create Azure Resource Group
```bash
az group create --name odcrm-rg --location uksouth
```

#### 1.2 Create Azure Database for PostgreSQL Flexible Server
```bash
az postgres flexible-server create \
  --resource-group odcrm-rg \
  --name odcrm-postgres \
  --location uksouth \
  --admin-user odcrmadmin \
  --admin-password "YourStrongPassword123!" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --storage-size 32 \
  --version 15 \
  --public-access Enabled
```

#### 1.3 Create Azure App Service for Backend
```bash
az appservice plan create \
  --name odcrm-app-plan \
  --resource-group odcrm-rg \
  --location uksouth \
  --sku B1 \
  --is-linux

az webapp create \
  --resource-group odcrm-rg \
  --plan odcrm-app-plan \
  --name odcrm-api \
  --runtime "NODE:18-lts"
```

#### 1.4 Create Azure Static Web App for Frontend
```bash
az staticwebapp create \
  --name odcrm-frontend \
  --resource-group odcrm-rg \
  --location uksouth \
  --source https://github.com/yourusername/odcrm \
  --branch main \
  --app-location "/" \
  --output-location "dist" \
  --login-with-github
```

### Phase 2: Database Migration

#### 2.1 Get Azure PostgreSQL Connection String
1. Go to Azure Portal → PostgreSQL server → Connection strings
2. Copy the connection string and format for PostgreSQL

#### 2.2 Update Environment Variables
**Local Development (.env):**
```bash
DATABASE_URL="postgresql://odcrmadmin:YourPassword@odcrm-postgres.postgres.database.azure.com:5432/postgres?sslmode=require"
```

**Azure App Service:**
```bash
az webapp config appsettings set \
  --resource-group odcrm-rg \
  --name odcrm-api \
  --setting DATABASE_URL="postgresql://odcrmadmin:YourPassword@odcrm-postgres.postgres.database.azure.com:5432/postgres?sslmode=require"
#### 2.3 Run Database Migration
```bash
cd server
npm install
npm run prisma:generate
npm run prisma:db:push  # For initial setup
```

### Phase 3: Backend Deployment Setup

#### 3.1 Configure App Service Environment Variables
```bash
# Database
az webapp config appsettings set --resource-group odcrm-rg --name odcrm-api --setting DATABASE_URL="..."

# Authentication (Azure Entra ID)
az webapp config appsettings set --resource-group odcrm-rg --name odcrm-api --setting MICROSOFT_CLIENT_ID="..."
az webapp config appsettings set --resource-group odcrm-rg --name odcrm-api --setting MICROSOFT_CLIENT_SECRET="..."
az webapp config appsettings set --resource-group odcrm-rg --name odcrm-api --setting MICROSOFT_TENANT_ID="common"

# API Configuration
az webapp config appsettings set --resource-group odcrm-rg --name odcrm-api --setting FRONTEND_URL="https://odcrm.bidlow.co.uk"
az webapp config appsettings set --resource-group odcrm-rg --name odcrm-api --setting NODE_ENV="production"

# API Keys (set these manually in Azure Portal for security)
# - OPENAI_API_KEY
# - CLEARBIT_API_KEY
# - GOOGLE_GEMINI_API_KEY
```

#### 3.2 Set Up GitHub Secrets for Backend Deployment
1. Go to GitHub → Repository → Settings → Secrets and variables → Actions
2. Add secrets:
   - `AZURE_WEBAPP_NAME`: `odcrm-api`
   - `AZURE_PUBLISH_PROFILE`: (Download from Azure Portal → App Service → Get publish profile)

### Phase 4: Frontend Deployment Setup

#### 4.1 Update Static Web App Configuration
The `staticwebapp.config.json` is already created in your repository. Update the backend URL:

```json
{
  "routes": [
    {
      "route": "/api/*",
      "backend": {
        "url": "https://odcrm-api.azurewebsites.net"
      }
    }
  ]
}
```

#### 4.2 Set Up GitHub Secrets for Frontend Deployment
1. Go to Azure Static Web App → API token
2. Copy the token
3. Add to GitHub secrets: `AZURE_STATIC_WEB_APPS_API_TOKEN`

### Phase 5: DNS & Custom Domain Configuration

#### 5.1 Configure Custom Domain in Azure Static Web Apps
1. Azure Portal → Static Web App → Custom domains
2. Add `odcrm.bidlow.co.uk`
3. Choose CNAME validation
4. Note the Azure-provided hostname

#### 5.2 Update GoDaddy DNS Records
1. Go to GoDaddy → Domain settings → DNS management
2. Add CNAME record:
   - **Host**: `odcrm`
   - **Type**: `CNAME`
   - **Points to**: `your-azure-static-web-app.azurestaticapps.net`
   - **TTL**: `3600`

#### 5.3 Verify DNS and SSL
- DNS propagation: 24-48 hours
- SSL certificate: Azure provisions automatically
- Test: Visit `https://odcrm.bidlow.co.uk`

### Phase 6: CI/CD Pipeline Setup

#### 6.1 Backend Deployment
The workflow `.github/workflows/deploy-backend-azure.yml` is ready. It will:
- Trigger on pushes to `main` affecting `server/**`
- Build and deploy to Azure App Service
- Run Prisma migrations

#### 6.2 Frontend Deployment
The workflow `.github/workflows/deploy-frontend-azure-static-web-app.yml` is ready. It will:
- Trigger on pushes to `main` (excluding server changes)
- Build and deploy to Azure Static Web Apps

#### 6.3 Test CI/CD
1. Make a small change to trigger deployment
2. Monitor GitHub Actions logs
3. Verify deployment in Azure Portal

### Phase 7: Testing & Verification

#### 7.1 Functional Testing Checklist
- [ ] Frontend loads at `https://odcrm.bidlow.co.uk`
- [ ] User authentication works (Entra ID)
- [ ] API endpoints respond correctly
- [ ] Database connections work
- [ ] Email functionality works
- [ ] File uploads work
- [ ] All user flows complete successfully

#### 7.2 Performance Testing
- [ ] Page load times acceptable (< 3 seconds)
- [ ] API response times < 1 second
- [ ] No CORS errors in browser console
- [ ] Mobile responsiveness works

#### 7.3 Security Testing
- [ ] HTTPS enforced
- [ ] Authentication required for protected routes
- [ ] API keys not exposed in frontend
- [ ] CORS properly configured

### Phase 8: Go-Live & Monitoring

#### 8.1 Update DNS to Point to Azure
Once testing is complete:
1. Update GoDaddy DNS records to Azure
2. Monitor traffic and errors
3. Set up Azure Monitor alerts

#### 8.2 Monitoring Setup
- Azure Application Insights for app monitoring
- Azure Monitor for infrastructure
- GitHub Actions for deployment monitoring
- Database performance monitoring

#### 8.3 Backup Verification
- Azure PostgreSQL automatic backups
- Application deployment history in GitHub
- Static Web App deployment history

### Phase 9: Cleanup & Optimization

#### 9.1 Remove Old Services
See `docs/cleanup-after-migration.md` for detailed cleanup instructions.

#### 9.2 Cost Optimization
- Monitor Azure costs weekly
- Adjust App Service plan based on usage
- Set up budget alerts

#### 9.3 Performance Optimization
- Enable Azure CDN if needed
- Configure caching headers
- Monitor and optimize database queries

## 🔧 Troubleshooting Guide

### Common Issues & Solutions

#### Database Connection Issues
```bash
# Test connection locally
cd server
npm run prisma:studio
```

#### Deployment Failures
- Check GitHub Actions logs
- Verify Azure credentials and permissions
- Check resource quotas and limits

#### DNS Issues
- Use `nslookup odcrm.bidlow.co.uk` to verify DNS
- Wait 24-48 hours for propagation
- Check GoDaddy DNS records are correct

#### API Proxy Issues
- Verify `staticwebapp.config.json` backend URL
- Check App Service CORS settings
- Test API directly at App Service URL

## 📞 Support & Resources

### Azure Documentation
- [Azure Static Web Apps](https://docs.microsoft.com/azure/static-web-apps/)
- [Azure App Service](https://docs.microsoft.com/azure/app-service/)
- [Azure Database for PostgreSQL](https://docs.microsoft.com/azure/postgresql/)

### Migration-Specific Docs
- `docs/azure-postgres-setup.md` - Database setup guide
- `docs/dns-and-domain-setup-odcrm-bidlow-co-uk.md` - DNS configuration
- `docs/cleanup-after-migration.md` - Post-migration cleanup

### Emergency Contacts
- Azure Support: [Azure Portal](https://portal.azure.com) → Help + Support
- GitHub Issues: Create issue in repository
- GoDaddy Support: Domain management issues

## ✅ Success Criteria

Migration is complete when:
- [ ] `https://odcrm.bidlow.co.uk` loads successfully
- [ ] All user authentication flows work
- [ ] Database operations function correctly
- [ ] CI/CD pipelines deploy automatically
- [ ] Monitoring and alerts are configured
- [ ] Old services are decommissioned
- [ ] Costs are optimized and monitored

## 🎉 Post-Migration Tasks

1. **Monitor for 7 days** - Watch for any issues
2. **Optimize costs** - Review Azure usage and adjust resources
3. **Document lessons learned** - Update this guide based on experience
4. **Plan for scaling** - Consider Azure Front Door, scaling strategies
5. **Security review** - Audit Azure security settings

---

**Need Help?** Refer to the detailed documentation in the `docs/` folder or create a GitHub issue.