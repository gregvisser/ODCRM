# Azure Resource Provisioning Commands
# Run these commands in PowerShell after installing Azure CLI

# Step 1: Login to Azure
Write-Host "Step 1: Logging into Azure..."
az login

# Step 2: Create Resource Group
Write-Host "Step 2: Creating resource group..."
az group create --name odcrm-rg --location uksouth

# Step 3: Create PostgreSQL Flexible Server
Write-Host "Step 3: Creating PostgreSQL database..."
az postgres flexible-server create `
  --resource-group odcrm-rg `
  --name odcrm-postgres `
  --location uksouth `
  --admin-user odcrmadmin `
  --admin-password "YourStrongPassword123!" `
  --sku-name Standard_B1ms `
  --tier Burstable `
  --storage-size 32 `
  --version 15 `
  --public-access Enabled

# Step 4: Create App Service Plan
Write-Host "Step 4: Creating App Service Plan..."
az appservice plan create `
  --name odcrm-app-plan `
  --resource-group odcrm-rg `
  --location uksouth `
  --sku B1 `
  --is-linux

# Step 5: Create App Service for Backend
Write-Host "Step 5: Creating App Service for backend..."
az webapp create `
  --resource-group odcrm-rg `
  --plan odcrm-app-plan `
  --name odcrm-api `
  --runtime "NODE:18-lts"

# Step 6: Create Static Web App for Frontend
Write-Host "Step 6: Creating Static Web App for frontend..."
az staticwebapp create `
  --name odcrm-frontend `
  --resource-group odcrm-rg `
  --location uksouth `
  --source https://github.com/yourusername/odcrm `
  --branch main `
  --app-location "/" `
  --output-location "dist" `
  --login-with-github

Write-Host "Azure resources created successfully!"
Write-Host "Next: Configure environment variables and database connection"