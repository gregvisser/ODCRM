# DNS & Custom Domain Setup: odcrm.bidlow.co.uk

This guide explains how to configure the custom domain `odcrm.bidlow.co.uk` for your Azure-hosted ODCRM application.

## Architecture Overview

Your application will be accessible at:
- **Frontend (Static Web App)**: `https://odcrm.bidlow.co.uk`
- **Backend (App Service)**: `https://odcrm-api.azurewebsites.net` (proxied via Static Web App)

The Static Web App serves as the main entry point and proxies API calls to the App Service.

## Prerequisites

- Azure Static Web App created and deployed
- Azure App Service created and deployed
- Access to GoDaddy DNS management for `bidlow.co.uk`
- Custom domain validation completed in Azure

## 1. Configure Custom Domain in Azure Static Web Apps

### Step 1: Add Custom Domain to Static Web App

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to your Static Web App
3. Under "Settings" → "Custom domains"
4. Click "Add custom domain"
5. Choose "Enter domain name"
6. Enter: `odcrm.bidlow.co.uk`
7. Click "Next"

### Step 2: Domain Validation

Azure will provide validation options:

**Option A: CNAME Record (Recommended)**
- **Host**: `odcrm`
- **Type**: `CNAME`
- **Points to**: `<your-static-web-app-url>.azurestaticapps.net`

**Option B: TXT Record**
- **Host**: `odcrm`
- **Type**: `TXT`
- **Value**: `<azure-provided-validation-code>`

## 2. Update GoDaddy DNS Records

### Access GoDaddy DNS Management

1. Log in to your [GoDaddy account](https://www.godaddy.com)
2. Go to "My Products" → "Domains"
3. Click on `bidlow.co.uk`
4. Click "DNS" or "Manage DNS"

### Add CNAME Record for Static Web App

1. Click "Add" to create a new record
2. Select record type: **CNAME**
3. Fill in the details:
   - **Host**: `odcrm`
   - **Type**: `CNAME`
   - **Points to**: `<your-static-web-app-url>.azurestaticapps.net`
   - **TTL**: `3600` (1 hour)

Example:
```
Host: odcrm
Type: CNAME
Points To: amazing-ocean-123456789.azurestaticapps.net
TTL: 3600
```

### Alternative: A Record (if required)

If Azure requires an A record instead:
1. Get the IP address from Azure Static Web App custom domain setup
2. Add an A record:
   - **Host**: `odcrm`
   - **Type**: `A`
   - **Points to**: `<azure-ip-address>`
   - **TTL**: `3600`

## 3. Update Static Web App Configuration

### Update API Proxy URL

Edit your `staticwebapp.config.json` to use the correct backend URL:

```json
{
  "routes": [
    {
      "route": "/api/*",
      "allowedRoles": ["anonymous"],
      "backend": {
        "url": "https://odcrm-api.azurewebsites.net"
      }
    }
  ]
}
```

Replace `odcrm-api.azurewebsites.net` with your actual App Service URL.

## 4. SSL Certificate Setup

Azure Static Web Apps automatically provisions SSL certificates for custom domains. This process may take up to 24 hours.

### Verify SSL Status

1. In Azure Portal, go to your Static Web App
2. Under "Custom domains", check the status
3. Wait for "SSL certificate" to show "Ready"

## 5. Test the Configuration

### DNS Propagation Check

Use tools like:
- [DNS Checker](https://dnschecker.org)
- `nslookup odcrm.bidlow.co.uk`
- `dig odcrm.bidlow.co.uk`

### Functional Testing

1. Visit `https://odcrm.bidlow.co.uk`
2. Verify the application loads
3. Test API calls (login, data fetching)
4. Check browser developer tools for any CORS or API errors

## 6. Troubleshooting

### DNS Issues

**Problem**: Domain not resolving
**Solution**:
- Wait 24-48 hours for DNS propagation
- Check CNAME record is correct
- Verify Azure domain validation is complete

**Problem**: SSL certificate not provisioning
**Solution**:
- Ensure domain validation is complete
- Check that DNS records are correct
- Contact Azure support if issues persist

### API Proxy Issues

**Problem**: API calls failing
**Solution**:
- Verify App Service URL in `staticwebapp.config.json`
- Check App Service is running
- Review CORS settings on App Service
- Check API endpoint URLs in frontend code

### Common Issues

1. **CNAME vs A Record Confusion**
   - Use CNAME for subdomains (odcrm.bidlow.co.uk)
   - Use A record only if Azure specifically requires it

2. **DNS Propagation Delays**
   - Changes can take 24-48 hours to propagate globally
   - Use DNS checking tools to monitor progress

3. **SSL Certificate Delays**
   - Azure may take up to 24 hours to provision certificates
   - Check status in Azure Portal

## 7. Backup Domain Configuration

If you need to temporarily point to a different service:

### Point to App Service Directly
Add a CNAME record pointing to your App Service:
```
Host: odcrm
Type: CNAME
Points To: odcrm-api.azurewebsites.net
```

### Point to Vercel/Render (Rollback)
```
Host: odcrm
Type: CNAME
Points To: your-vercel-app.vercel.app
```

## 8. Monitoring & Maintenance

### Regular Checks

- Monitor DNS resolution
- Check SSL certificate validity
- Verify API connectivity
- Monitor Azure resource health

### Renewal Requirements

- SSL certificates auto-renew through Azure
- DNS records rarely need changes
- Update Azure resources if URLs change

## 9. Cost Considerations

- Custom domains are free on Azure Static Web Apps
- SSL certificates are free
- DNS hosting costs depend on your GoDaddy plan

## Support Resources

- [Azure Static Web Apps Custom Domains](https://learn.microsoft.com/en-us/azure/static-web-apps/custom-domain)
- [GoDaddy DNS Management](https://www.godaddy.com/help/manage-dns-680)
- [Azure Support](https://azure.microsoft.com/en-us/support/)