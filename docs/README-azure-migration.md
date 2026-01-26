# Azure Migration Guide: OpenDoors CRM

This guide covers migrating your OpenDoors CRM application from Vercel + Render + Neon to Azure cloud services.

## 📋 Migration Overview

### Current Architecture (Before Migration)
- **Frontend**: Vercel (React + Vite)
- **Backend**: Render (Node.js + Express + TypeScript)
- **Database**: Neon PostgreSQL
- **Domain**: Various subdomains

### New Azure Architecture (After Migration)
- **Frontend**: Azure Static Web Apps
- **Backend**: Azure App Service (Linux, Node.js)
- **Database**: Azure Database for PostgreSQL Flexible Server
- **Domain**: `odcrm.bidlow.co.uk` (custom domain)
- **CI/CD**: GitHub Actions

### Architecture Diagram

```
Internet
    ↓
odcrm.bidlow.co.uk (Azure Static Web App)
    ↓ (SPA routing)
React Frontend (dist/)
    ↓ (/api/* proxy)
Azure App Service
    ↓ (Node.js/Express)
Business Logic + API
    ↓ (DATABASE_URL)
Azure PostgreSQL
```

## 🚀 Migration Checklist

### Phase 1: Azure Resources Setup

- [ ] **Create Azure Subscription** (if needed)
- [ ] **Create Resource Group** (e.g., `odcrm-rg`)
- [ ] **Create Azure Database for PostgreSQL Flexible Server**
  - Server name: `odcrm-postgres`
  - Admin user: `odcrmadmin`
  - Note connection string for later
- [ ] **Create Azure App Service** (for backend)
  - Runtime: Node.js 24
  - Name: `odcrm-api`
- [ ] **Create Azure Static Web Apps** (for frontend)
  - Build preset: React
  - Output location: `dist`
  - API location: (leave blank, we'll use proxy)

### Phase 2: GitHub Secrets Configuration

Set these secrets in your GitHub repository (Settings → Secrets and variables → Actions):

**For Backend Deployment:**
```
AZURE_WEBAPP_NAME=odcrm-api
AZURE_WEBAPP_PUBLISH_PROFILE=<from Azure App Service>
DATABASE_URL=postgresql://odcrmadmin:password@odcrm-postgres.postgres.database.azure.com:5432/postgres?sslmode=require
```

**For Frontend Deployment:**
```
AZURE_STATIC_WEB_APPS_API_TOKEN=<from Azure Static Web Apps>
VITE_AZURE_CLIENT_ID=<your Azure AD client ID>
VITE_AZURE_TENANT_ID=<your Azure AD tenant ID>
VITE_AZURE_REDIRECT_URI=https://odcrm.bidlow.co.uk
```

### Phase 3: Database Migration

1. **Export data from Neon** (optional, if keeping existing data)
2. **Run migrations on Azure PostgreSQL**
   ```bash
   cd server
   export DATABASE_URL="postgresql://odcrmadmin:password@odcrm-postgres.postgres.database.azure.com:5432/postgres?sslmode=require"
   npm run prisma:migrate:deploy
   ```
3. **Verify database connection**

### Phase 4: DNS & Domain Setup

1. **Configure DNS records in GoDaddy**
   - Add CNAME: `odcrm` → `[your-static-web-app].azurestaticapps.net`
2. **Add custom domain in Azure Static Web Apps**
   - Domain: `odcrm.bidlow.co.uk`
   - Validation method: CNAME
3. **Wait for SSL certificate provisioning** (automatic)

### Phase 5: Application Deployment

1. **Push code to trigger deployments**
   ```bash
   git add .
   git commit -m "Azure migration: update configurations"
   git push origin main
   ```
2. **Monitor GitHub Actions**
   - Backend deployment: `.github/workflows/deploy-backend-azure.yml`
   - Frontend deployment: `.github/workflows/deploy-frontend-azure-static-web-app.yml`
3. **Verify deployments in Azure Portal**

### Phase 6: Testing & Verification

- [ ] **Test frontend**: `https://odcrm.bidlow.co.uk`
- [ ] **Test API proxy**: API calls should work through `/api/*` routes
- [ ] **Test authentication**: Azure AD login should work
- [ ] **Test database operations**: CRUD operations should work
- [ ] **Test email functionality** (if applicable)

### Phase 7: Cleanup

- [ ] **Remove old deployments**
  - Delete Vercel app
  - Delete Render service
  - Keep Neon database as backup for 30 days
- [ ] **Remove old configuration files**
  - Delete `vercel.json`
  - Delete `server/render.yaml`
  - Update `.gitignore` if needed
- [ ] **Update documentation**
  - Update README with new URLs
  - Update deployment instructions

## 📁 File Changes Made

### New Files Created
- `.github/workflows/deploy-backend-azure.yml` - Backend CI/CD
- `.github/workflows/deploy-frontend-azure-static-web-app.yml` - Frontend CI/CD
- `staticwebapp.config.json` - Azure Static Web Apps routing
- `docs/azure-postgres-setup.md` - Database migration guide
- `docs/dns-and-domain-setup-odcrm-bidlow-co-uk.md` - DNS setup guide

### Modified Files
- `server/package.json` - Simplified build script, added Node.js 24.x engines
- `package.json` - Updated Node.js version to 24.x

### Files to Delete After Migration
- `vercel.json` - No longer needed
- `server/render.yaml` - No longer needed

## 🔧 Environment Variables

### Backend (Azure App Service)
Set these in Azure Portal → App Service → Configuration → Application settings:

```
NODE_ENV=production
PORT=8080
DATABASE_URL=postgresql://odcrmadmin:password@odcrm-postgres.postgres.database.azure.com:5432/postgres?sslmode=require
MICROSOFT_CLIENT_ID=your-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret
MICROSOFT_TENANT_ID=common
REDIRECT_URI=https://odcrm.bidlow.co.uk/api/outlook/callback
EMAIL_TRACKING_DOMAIN=https://odcrm.bidlow.co.uk
FRONTEND_URL=https://odcrm.bidlow.co.uk
FRONTEND_URLS=https://odcrm.bidlow.co.uk
```

### Frontend (Azure Static Web Apps)
Set these in Azure Portal → Static Web Apps → Configuration:

```
VITE_AZURE_CLIENT_ID=your-client-id
VITE_AZURE_TENANT_ID=your-tenant-id
VITE_AZURE_REDIRECT_URI=https://odcrm.bidlow.co.uk
```

## 🛠 Troubleshooting

### Deployment Issues

**Backend deployment fails:**
- Check Azure App Service logs
- Verify DATABASE_URL is correct
- Ensure Node.js version is 24.x

**Frontend deployment fails:**
- Check build logs for TypeScript errors
- Verify environment variables are set
- Ensure `staticwebapp.config.json` is valid

**Database connection fails:**
- Check firewall rules allow Azure services
- Verify DATABASE_URL format and credentials
- Test connection with Prisma Studio

### Runtime Issues

**API calls failing:**
- Check Static Web Apps routing configuration
- Verify backend App Service is running
- Check CORS settings on backend

**Authentication not working:**
- Verify Azure AD app registration settings
- Check redirect URIs match exactly
- Ensure custom domain SSL is provisioned

**Domain not resolving:**
- Wait for DNS propagation (up to 24 hours)
- Check DNS records with online tools
- Verify CNAME points to correct Azure hostname

## 📞 Support

- **Azure Documentation**: [Azure Static Web Apps](https://docs.microsoft.com/en-us/azure/static-web-apps/)
- **GitHub Actions**: [Azure Actions](https://github.com/marketplace?type=actions&query=Azure)
- **Prisma Azure**: [Database Setup](docs/azure-postgres-setup.md)
- **DNS Setup**: [Domain Configuration](docs/dns-and-domain-setup-odcrm-bidlow-co-uk.md)

## 🎯 Success Criteria

✅ Application accessible at `https://odcrm.bidlow.co.uk`
✅ All API endpoints working through proxy
✅ Database operations functional
✅ Authentication working with Azure AD
✅ SSL certificate valid
✅ CI/CD pipelines running successfully
✅ Old deployments cleaned up

## 📝 Next Steps

1. Follow the migration checklist above
2. Test thoroughly in staging environment first
3. Plan a maintenance window for production migration
4. Monitor application performance post-migration
5. Set up Azure monitoring and alerts
6. Consider Azure Front Door for CDN and security features