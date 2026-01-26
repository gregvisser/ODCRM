# Azure PostgreSQL Flexible Server Setup Guide

This guide explains how to set up Azure Database for PostgreSQL Flexible Server for the ODCRM application.

## Prerequisites

- Azure subscription
- Azure CLI installed (optional, for CLI setup)

## 1. Create Azure Database for PostgreSQL Flexible Server

### Option A: Azure Portal (Recommended for beginners)

1. Go to [Azure Portal](https://portal.azure.com)
2. Search for "PostgreSQL Flexible Server"
3. Click "Create"
4. Fill in the details:
   - **Subscription**: Your Azure subscription
   - **Resource group**: Create new or select existing (e.g., `odcrm-rg`)
   - **Server name**: `odcrm-postgres` (must be globally unique)
   - **Region**: Select the same region as your App Service
   - **PostgreSQL version**: 15 (or latest stable)
   - **Workload type**: Development (for cost optimization)
   - **Compute + storage**:
     - Compute size: Burstable, B1ms (1 vCore, 2 GiB RAM)
     - Storage: 32 GiB (can increase later)
   - **Availability zone**: Zone-redundant (for production)
   - **Authentication**: PostgreSQL authentication only
   - **Admin username**: `odcrmadmin` (or your choice)
   - **Password**: Set a strong password
5. Click "Review + create" then "Create"

### Option B: Azure CLI

```bash
# Set variables
RESOURCE_GROUP="odcrm-rg"
SERVER_NAME="odcrm-postgres"
LOCATION="uksouth"  # or your preferred region
ADMIN_USER="odcrmadmin"
ADMIN_PASSWORD="YourStrongPassword123!"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create PostgreSQL Flexible Server
az postgres flexible-server create \
  --resource-group $RESOURCE_GROUP \
  --name $SERVER_NAME \
  --location $LOCATION \
  --admin-user $ADMIN_USER \
  --admin-password $ADMIN_PASSWORD \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --storage-size 32 \
  --version 15 \
  --public-access Enabled
```

## 2. Configure Firewall Rules

After creation, you need to allow access from your App Service and development machines.

### Allow Azure services access:
1. In Azure Portal, go to your PostgreSQL server
2. Under "Settings" → "Networking"
3. Check "Allow public access from any Azure service within Azure to this server"
4. Click "Save"

### For local development:
Add your IP address under "Firewall rules" or use "Allow all IPs" temporarily for development.

## 3. Get Connection String

1. In Azure Portal, go to your PostgreSQL server
2. Under "Settings" → "Connection strings"
3. Copy the "ADO.NET" connection string and modify it for PostgreSQL format

The connection string will look like:
```
postgresql://odcrmadmin:YourPassword@odcrm-postgres.postgres.database.azure.com:5432/postgres?sslmode=require
```

## 4. Environment Variables

Set the following environment variables in your Azure App Service:

### Backend (App Service)
```
DATABASE_URL=postgresql://odcrmadmin:YourPassword@odcrm-postgres.postgres.database.azure.com:5432/postgres?sslmode=require
```

### Frontend (Static Web Apps)
No database variables needed in frontend.

### Local Development (.env)
```
DATABASE_URL=postgresql://odcrmadmin:YourPassword@odcrm-postgres.postgres.database.azure.com:5432/postgres?sslmode=require
```

## 5. Database Migration

### Initial Setup (run once)
```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Create initial migration (if schema changes exist)
npm run prisma:migrate:dev -- --name init

# Push schema to database
npm run prisma:push
```

### Production Deployment
For production deployments, run:
```bash
npm run setup:prod
```

This runs:
- `npm install`
- `npm run prisma:generate`
- `npm run prisma:migrate:deploy`

## 6. Verify Connection

Test the database connection:

```bash
cd server
npm run prisma:studio
```

This should open Prisma Studio and connect to your Azure PostgreSQL database.

## 7. Cost Optimization

### Development/Staging
- Use Burstable B1ms compute tier
- 32 GiB storage
- Estimated cost: ~£15-20/month

### Production
- Consider General Purpose or Memory Optimized tiers based on your load
- Enable auto-scaling if needed
- Monitor usage and adjust compute size accordingly

## 8. Backup and Security

- Azure PostgreSQL automatically creates backups
- Retention period: 7 days (can be increased)
- Encryption at rest is enabled by default
- Consider enabling Azure Defender for PostgreSQL for advanced security

## Troubleshooting

### Connection Issues
- Verify firewall rules allow your IP
- Check that SSL mode is set to `require`
- Ensure username/password are correct
- Try connecting with a PostgreSQL client like pgAdmin

### Migration Issues
- Check that DATABASE_URL is set correctly
- Run `npm run prisma:generate` before migrations
- Use `prisma db push` for initial schema deployment

### Performance Issues
- Monitor query performance with `EXPLAIN ANALYZE`
- Consider adding indexes for frequently queried columns
- Check Azure Monitor for database metrics