# Azure Resource Configuration Commands
# Run these after the resources are created

# Step 1: Get PostgreSQL connection string
Write-Host "Getting PostgreSQL connection string..."
az postgres flexible-server show-connection-string `
  --resource-group odcrm-rg `
  --name odcrm-postgres `
  --admin-user odcrmadmin `
  --admin-password "YourStrongPassword123!" `
  --query connectionStrings.psycopg2

# Step 2: Configure App Service Environment Variables
Write-Host "Configuring App Service environment variables..."

# Database connection
az webapp config appsettings set `
  --resource-group odcrm-rg `
  --name odcrm-api `
  --setting DATABASE_URL="postgresql://odcrmadmin:YourStrongPassword123!@odcrm-postgres.postgres.database.azure.com:5432/postgres?sslmode=require"

# Application settings
az webapp config appsettings set `
  --resource-group odcrm-rg `
  --name odcrm-api `
  --setting NODE_ENV="production"

az webapp config appsettings set `
  --resource-group odcrm-rg `
  --name odcrm-api `
  --setting FRONTEND_URL="https://odcrm.bidlow.co.uk"

az webapp config appsettings set `
  --resource-group odcrm-rg `
  --name odcrm-api `
  --setting FRONTEND_URLS="https://odcrm.bidlow.co.uk"

# Microsoft Authentication (REPLACE WITH YOUR VALUES)
az webapp config appsettings set `
  --resource-group odcrm-rg `
  --name odcrm-api `
  --setting MICROSOFT_CLIENT_ID="your-client-id"

az webapp config appsettings set `
  --resource-group odcrm-rg `
  --name odcrm-api `
  --setting MICROSOFT_CLIENT_SECRET="your-client-secret"

az webapp config appsettings set `
  --resource-group odcrm-rg `
  --name odcrm-api `
  --setting MICROSOFT_TENANT_ID="common"

az webapp config appsettings set `
  --resource-group odcrm-rg `
  --name odcrm-api `
  --setting REDIRECT_URI="https://odcrm-api.azurewebsites.net/api/outlook/callback"

az webapp config appsettings set `
  --resource-group odcrm-rg `
  --name odcrm-api `
  --setting EMAIL_TRACKING_DOMAIN="https://odcrm-api.azurewebsites.net"

# Worker settings
az webapp config appsettings set `
  --resource-group odcrm-rg `
  --name odcrm-api `
  --setting LEADS_SYNC_DISABLED="false"

az webapp config appsettings set `
  --resource-group odcrm-rg `
  --name odcrm-api `
  --setting ABOUT_ENRICHMENT_DISABLED="false"

az webapp config appsettings set `
  --resource-group odcrm-rg `
  --name odcrm-api `
  --setting EMAIL_WORKERS_DISABLED="true"

# Email settings
az webapp config appsettings set `
  --resource-group odcrm-rg `
  --name odcrm-api `
  --setting SENDER_BATCH_SIZE="25"

az webapp config appsettings set `
  --resource-group odcrm-rg `
  --name odcrm-api `
  --setting SENDER_LOCK_MINUTES="5"

az webapp config appsettings set `
  --resource-group odcrm-rg `
  --name odcrm-api `
  --setting MAILBOX_DAILY_CAP="50"

az webapp config appsettings set `
  --resource-group odcrm-rg `
  --name odcrm-api `
  --setting MAILBOX_SPREAD_HOURS="10"

Write-Host "App Service configured successfully!"
Write-Host "Next: Set up API keys manually in Azure Portal and configure GitHub secrets"