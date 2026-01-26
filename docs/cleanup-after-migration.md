# Cleanup After Azure Migration

This document lists files and configurations that should be removed or updated after successfully migrating to Azure.

## Files to Delete

### Root Level Files
- `vercel.json` - No longer needed as frontend moves to Azure Static Web Apps

### Server Directory Files
- `server/render.yaml` - No longer needed as backend moves to Azure App Service

## Environment Variables to Remove

### Vercel Environment Variables
Remove these from Vercel dashboard:
- `VITE_API_URL` (will be handled by Static Web Apps config)

### Render Environment Variables
Remove these from Render dashboard after migration:
- `NODE_ENV`
- `PORT`
- `DATABASE_URL` (move to Azure App Service)
- `FRONTEND_URL`
- `FRONTEND_URLS`
- All Microsoft OAuth variables (move to Azure App Service)
- All API key variables (move to Azure App Service)

## Services to Decommission

### Vercel
1. Go to Vercel dashboard
2. Delete the ODCRM frontend project
3. Remove custom domain `odcrm.bidlow.co.uk` from Vercel

### Render
1. Go to Render dashboard
2. Delete the `odcrm-api` service
3. Remove any custom domains or configurations

### Neon PostgreSQL (Optional)
If you want to completely migrate away from Neon:

1. Export any remaining data if needed
2. Delete the Neon database
3. Cancel Neon subscription

**Note**: Keep Neon as backup until Azure setup is fully tested and stable.

## Git History Cleanup (Optional)

If you want to remove sensitive configuration from git history:

```bash
# Remove files from git history (use with caution)
git filter-branch --tree-filter 'rm -f vercel.json server/render.yaml' --prune-empty HEAD

# Or use BFG Repo-Cleaner for better performance
# Download from https://rtyley.github.io/bfg-repo-cleaner/
java -jar bfg.jar --delete-files vercel.json
java -jar bfg.jar --delete-files render.yaml
```

## Scripts to Update

### Root package.json Scripts
Remove or comment out Neon-specific scripts:
- `deploy:update-neon` - No longer needed
- `deploy:migrate` - Update to work with Azure
- `deploy:create-customer` - Update database references

### Server package.json Scripts
The Prisma scripts are already generic and will work with Azure PostgreSQL.

## Documentation to Update

### Environment Documentation
Update `docs/ENVIRONMENTS.md` to reflect Azure deployments instead of Vercel/Render.

### Deployment Documentation
Update any deployment guides to reference Azure instead of Vercel/Render/Neon.

## DNS Records to Update

After Azure migration is complete and tested:

1. Update GoDaddy DNS records to point to Azure (see `docs/dns-and-domain-setup-odcrm-bidlow-co-uk.md`)
2. Remove any Vercel or Render DNS configurations

## Monitoring & Alerts

### Azure Monitor Setup
After migration:
1. Set up Azure Monitor alerts for App Service
2. Configure Static Web Apps monitoring
3. Set up PostgreSQL database monitoring
4. Remove any Vercel/Render monitoring

### GitHub Actions
The new workflows in `.github/workflows/` will handle deployments. Remove any old Vercel/Render webhook configurations.

## Backup & Recovery

### Database Backups
- Azure PostgreSQL provides automatic backups
- Set up additional backup strategies if needed
- Document backup/restore procedures for Azure

### Application Backups
- Azure App Service has deployment slots for staging
- Use GitHub for code backups (already handled)
- Consider Azure Backup for comprehensive disaster recovery

## Cost Management

### Remove Unused Services
- Cancel Vercel subscription or remove unused projects
- Cancel Render subscription or remove unused services
- Monitor Neon usage and cancel if fully migrated

### Azure Cost Optimization
- Set up Azure Cost Management alerts
- Monitor resource usage
- Consider reserved instances for production workloads

## Final Verification Steps

After cleanup:

1. ✅ Verify application works at `https://odcrm.bidlow.co.uk`
2. ✅ Confirm all API endpoints function correctly
3. ✅ Test user authentication flows
4. ✅ Verify database connectivity and data integrity
5. ✅ Check monitoring and logging are working
6. ✅ Confirm CI/CD pipelines deploy successfully
7. ✅ Test backup and restore procedures
8. ✅ Review costs and optimize as needed

## Rollback Plan

If issues arise after cleanup, you can rollback by:

1. **Temporary DNS Change**: Point DNS back to Vercel/Render temporarily
2. **Service Recreation**: Recreate Vercel/Render services if needed
3. **Database**: Keep Neon as backup until confident in Azure setup

Keep this document and all migration documentation for at least 30 days after successful migration.