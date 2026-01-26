# Azure PostgreSQL Setup Guide

This guide explains how to migrate from Neon PostgreSQL to Azure Database for PostgreSQL Flexible Server.

## Prerequisites

- Azure subscription with appropriate permissions
- Azure CLI installed (optional, for command-line operations)

## Step 1: Create Azure Database for PostgreSQL Flexible Server

### Option A: Using Azure Portal (Recommended for beginners)

1. Go to [Azure Portal](https://portal.azure.com)
2. Search for "PostgreSQL" and select "Azure Database for PostgreSQL flexible servers"
3. Click "Create"
4. Configure:
   - **Subscription**: Select your subscription
   - **Resource group**: Create new or select existing (e.g., `odcrm-rg`)
   - **Server name**: `odcrm-postgres` (must be unique)
   - **Region**: Select the same region as your App Service
   - **PostgreSQL version**: 15 (latest stable)
   - **Workload type**: Development (can be changed later)
   - **Compute + storage**:
     - Compute size: Burstable, B1ms (cheapest for development)
     - Storage: 32 GiB (minimum)
   - **Admin username**: `odcrmadmin` (or your preferred name)
   - **Password**: Create a strong password
   - **Confirm password**: Repeat the password

5. Click "Review + create" then "Create"
6. Wait for deployment to complete (about 5-10 minutes)

### Option B: Using Azure CLI

```bash
# Set variables
RESOURCE_GROUP="odcrm-rg"
SERVER_NAME="odcrm-postgres"
ADMIN_USER="odcrmadmin"
ADMIN_PASSWORD="YourStrongPasswordHere123!"

# Create resource group
az group create --name $RESOURCE_GROUP --location "UK South"

# Create PostgreSQL server
az postgres flexible-server create \
  --resource-group $RESOURCE_GROUP \
  --name $SERVER_NAME \
  --location "UK South" \
  --admin-user $ADMIN_USER \
  --admin-password $ADMIN_PASSWORD \
  --sku-name "B_Standard_B1ms" \
  --tier "Burstable" \
  --storage-size 32 \
  --version 15
```

## Step 2: Configure Database Connection

### Get Connection Information

1. In Azure Portal, go to your PostgreSQL server
2. Under "Settings" → "Connection strings"
3. Copy the connection string format

### DATABASE_URL Format for Azure PostgreSQL

The connection string should look like this:

```
postgresql://odcrmadmin:YourPassword@odcrm-postgres.postgres.database.azure.com:5432/postgres?sslmode=require
```

**Important Notes:**
- Always use `sslmode=require` for Azure PostgreSQL
- The default database name is `postgres`
- Username format: `username@servername`

### Update Environment Variables

Update your `.env` files with the new DATABASE_URL:

**For local development** (`.env` in root):
```bash
# Keep your Neon URL for local dev if needed
DATABASE_URL="postgresql://your-local-db-url"
```

**For production** (set in Azure App Service):
- Go to Azure Portal → App Service → Configuration → Application settings
- Add: `DATABASE_URL` = `postgresql://odcrmadmin:YourPassword@odcrm-postgres.postgres.database.azure.com:5432/postgres?sslmode=require`

## Step 3: Network Configuration

### Configure Firewall Rules

By default, Azure PostgreSQL blocks all connections. You need to allow:

1. **Your local development IP** (for migrations)
2. **Azure App Service** (for production)

#### Allow Local Development Access

1. In Azure Portal → PostgreSQL server → "Networking"
2. Under "Firewall rules" → "Add current client IP address"
3. Or add your specific IP address range

#### Allow Azure App Service Access

Azure services can connect to PostgreSQL, but you may need to enable "Allow public access from any Azure service within Azure" in the Networking settings.

## Step 4: Run Database Migrations

### Local Development

```bash
# Navigate to server directory
cd server

# Generate Prisma client
npm run prisma:generate

# Run migrations (creates tables, etc.)
npm run prisma:migrate:dev
```

### Production Deployment

For production, migrations run automatically during the App Service deployment via the GitHub Actions workflow.

**Manual production migration** (if needed):

```bash
# Set production DATABASE_URL
export DATABASE_URL="postgresql://odcrmadmin:YourPassword@odcrm-postgres.postgres.database.azure.com:5432/postgres?sslmode=require"

# Run migrations
cd server
npm run prisma:migrate:deploy
```

## Step 5: Verify Connection

### Test Database Connection

Create a simple test script to verify the connection:

```javascript
// test-db.js
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  try {
    await prisma.$connect()
    console.log('✅ Database connection successful!')
    await prisma.$disconnect()
  } catch (error) {
    console.error('❌ Database connection failed:', error)
  }
}

main()
```

Run it:
```bash
cd server
node test-db.js
```

## Troubleshooting

### Common Issues

1. **SSL Connection Error**
   - Ensure `sslmode=require` is in your DATABASE_URL
   - Azure requires SSL connections

2. **Authentication Failed**
   - Double-check username/password
   - Username format: `username@servername`

3. **Server Not Found**
   - Verify server name and region
   - Check if server is running

4. **Firewall Block**
   - Add your IP to firewall rules
   - Ensure Azure services are allowed

### Useful Commands

```bash
# Check server status
az postgres flexible-server show --resource-group odcrm-rg --name odcrm-postgres

# Restart server (if needed)
az postgres flexible-server restart --resource-group odcrm-rg --name odcrm-postgres

# View connection strings
az postgres flexible-server show-connection-string --resource-group odcrm-rg --name odcrm-postgres
```

## Migration Checklist

- [ ] Create Azure PostgreSQL Flexible Server
- [ ] Configure firewall rules
- [ ] Update DATABASE_URL in environment variables
- [ ] Test local connection
- [ ] Run migrations locally
- [ ] Deploy to production and verify
- [ ] Update DNS and domain configuration
- [ ] Clean up old Neon database (after verifying migration)

## Cost Considerations

- **Burstable B1ms**: ~£15/month
- **Storage**: £0.10 per GB per month
- **Backup**: Included in storage
- Monitor usage in Azure Cost Management