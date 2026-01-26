# Cleanup After Azure Migration

This document lists files and configurations that should be removed or updated after successfully migrating to Azure.

## 🗑️ Files to Delete

### Root Level Files
- [ ] `vercel.json` - No longer needed, Azure Static Web Apps handles routing
- [ ] `.env` - Contains Neon database URL, replace with Azure-focused .env.example

### Server Directory Files
- [ ] `server/render.yaml` - Render-specific configuration, no longer needed
- [ ] `server/.env` - Contains Neon-specific URLs, replace with Azure-focused .env.example

## 📝 Files to Update

### Environment Files
Update `.env.example` files to use Azure URLs instead of Render/Neon:

**Root `.env.example`:**
```bash
# Update API URL for Azure
VITE_API_URL=https://odcrm.bidlow.co.uk/api
```

**Server `.env.example`:**
```bash
# Update all URLs to use Azure domains
DATABASE_URL=postgresql://odcrmadmin:password@odcrm-postgres.postgres.database.azure.com:5432/postgres?sslmode=require
FRONTEND_URL=https://odcrm.bidlow.co.uk
FRONTEND_URLS=https://odcrm.bidlow.co.uk
REDIRECT_URI=https://odcrm.bidlow.co.uk/api/outlook/callback
EMAIL_TRACKING_DOMAIN=https://odcrm.bidlow.co.uk
```

### Documentation Updates
- [ ] Update main README.md to reference Azure URLs
- [ ] Update any deployment documentation
- [ ] Update API documentation with new base URLs

## 🏗️ Azure Resources to Clean Up Later

### After 30-Day Verification Period
- [ ] **Delete Neon PostgreSQL database** (after confirming Azure DB works)
- [ ] **Delete Vercel app** (after confirming Azure Static Web App works)
- [ ] **Delete Render service** (after confirming Azure App Service works)

### Cost Optimization
- [ ] Review Azure resource sizing (scale down if over-provisioned)
- [ ] Set up Azure Cost Management alerts
- [ ] Consider reserved instances for long-term cost savings

## 🔍 Verification Before Cleanup

### Test Everything Works on Azure
- [ ] Frontend loads at `https://odcrm.bidlow.co.uk`
- [ ] API endpoints work through proxy
- [ ] Database operations functional
- [ ] Authentication works
- [ ] Email functionality works
- [ ] All user workflows complete successfully

### Backup Verification
- [ ] Neon database backup available (export if needed)
- [ ] Vercel deployment history accessible
- [ ] Render logs and configurations backed up

## 🚨 Critical: Don't Delete Yet!

**Wait 7-14 days after migration before deleting old resources:**
- Allows time to fix any issues discovered post-migration
- Provides fallback if Azure migration has problems
- Gives time for DNS propagation and SSL setup

## 📋 Cleanup Checklist

### Immediate (After Successful Migration)
- [ ] Update .env.example files with Azure URLs
- [ ] Update documentation references
- [ ] Commit and push cleanup changes

### After 7 Days
- [ ] Delete vercel.json
- [ ] Delete server/render.yaml
- [ ] Update .gitignore if needed

### After 30 Days (Only if everything works perfectly)
- [ ] Delete Neon database
- [ ] Delete Vercel app
- [ ] Delete Render service
- [ ] Archive any local configuration backups

## 🔄 Rollback Plan

If issues arise after cleanup:

1. **Quick Rollback**: Redeploy to Vercel/Render using git history
2. **Data Rollback**: Restore from Neon backup if needed
3. **DNS Rollback**: Point domain back to original services

**Keep backups until you're 100% confident in Azure setup!**

## 📞 Support

If you encounter issues during cleanup:
- Check Azure resource dependencies
- Verify all services are running
- Test from multiple locations/devices
- Contact Azure support if needed