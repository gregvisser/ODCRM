# GitHub Secrets Setup for Azure CI/CD

## Backend Deployment Secrets

Go to: https://github.com/yourusername/odcrm/settings/secrets/actions

### Required Secrets:

1. **AZURE_WEBAPP_NAME**
   - Value: `odcrm-api`
   - Description: Your Azure App Service name

2. **AZURE_PUBLISH_PROFILE**
   - How to get it:
     1. Go to Azure Portal → App Services → odcrm-api
     2. Click "Get publish profile"
     3. Download the XML file
     4. Open it and copy the entire contents
     5. Paste as the secret value (it will be a long XML string)

3. **DATABASE_URL**
   - Value: Your Azure PostgreSQL connection string
   - Format: `postgresql://username:password@host:port/database?sslmode=require`
   - Description: Required for database migrations during deployment

## Frontend Deployment Secrets

### AZURE_STATIC_WEB_APPS_API_TOKEN
- How to get it:
  1. Go to Azure Portal → Static Web Apps → odcrm-frontend
  2. Click on "API token" in the left menu
  3. Click "Copy" to get the token
  4. Paste as the secret value

## Verification

After adding secrets:
1. Go to GitHub Actions tab in your repository
2. You should see the workflow files are ready
3. The workflows will trigger on your next push to main branch