# DNS & Custom Domain Setup: odcrm.bidlow.co.uk

This guide explains how to configure the custom domain `odcrm.bidlow.co.uk` to point to your Azure-hosted OpenDoors CRM application.

## Overview

Your application architecture:
- **Frontend**: Azure Static Web Apps (main entry point)
- **Backend**: Azure App Service (proxied via `/api/*` routes)
- **Domain**: `odcrm.bidlow.co.uk` hosted on GoDaddy

## Prerequisites

- GoDaddy account with access to bidlow.co.uk domain
- Azure Static Web App deployed and running
- Azure App Service deployed and running
- Custom domain verified in Azure (see Step 2)

## Step 1: Prepare Azure Resources

### Get Azure Static Web App URL

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to your Static Web App
3. Under "Settings" → "Custom domains"
4. Note the "Default hostname" (e.g., `random-name.azurestaticapps.net`)

### Enable Custom Domain in Azure Static Web App

1. In Azure Portal → Static Web App → "Custom domains"
2. Click "Add custom domain"
3. Enter: `odcrm.bidlow.co.uk`
4. Select "CNAME" validation method
5. Azure will show you the required CNAME record values
6. **Don't complete this step yet** - you'll do it after DNS configuration

## Step 2: Configure DNS Records in GoDaddy

### Access GoDaddy DNS Settings

1. Log in to your [GoDaddy account](https://account.godaddy.com)
2. Go to "My Products" → Domain Settings
3. Find `bidlow.co.uk` and click "DNS" or "Manage DNS"

### Add CNAME Record for www/odcrm subdomain

You need to add a CNAME record that points `odcrm.bidlow.co.uk` to your Azure Static Web App.

**Record Details:**
- **Type**: CNAME
- **Host**: `odcrm` (this creates `odcrm.bidlow.co.uk`)
- **Points to**: Your Azure Static Web App hostname (e.g., `random-name.azurestaticapps.net`)
- **TTL**: 600 (10 minutes) or 3600 (1 hour)

**Example:**
```
Type: CNAME
Host: odcrm
Points to: amazing-sky-123456789.azurestaticapps.net
TTL: 3600
```

### Optional: Root Domain Redirect

If you want `bidlow.co.uk` to redirect to `odcrm.bidlow.co.uk`:

**Record Details:**
- **Type**: A
- **Host**: `@` (root domain)
- **Points to**: The IP address of your redirect service (check GoDaddy forwarding options)

Or use GoDaddy's domain forwarding feature to redirect `bidlow.co.uk` to `https://odcrm.bidlow.co.uk`.

## Step 3: Verify DNS Propagation

### Check DNS Records

Use these tools to verify your DNS records are set correctly:

1. **GoDaddy DNS Checker**: In GoDaddy, use their DNS lookup tool
2. **Online DNS Tools**:
   - [DNS Checker](https://dnschecker.org)
   - [MX Toolbox](https://mxtoolbox.com)
   - Command line: `nslookup odcrm.bidlow.co.uk`

**Expected Results:**
- `odcrm.bidlow.co.uk` should resolve to your Azure Static Web App hostname
- The CNAME record should show: `odcrm.bidlow.co.uk CNAME amazing-sky-123456789.azurestaticapps.net`

## Step 4: Complete Azure Custom Domain Setup

### Add Custom Domain in Azure

1. Return to Azure Portal → Static Web App → "Custom domains"
2. Click "Add custom domain"
3. Enter: `odcrm.bidlow.co.uk`
4. Select "CNAME" validation method
5. Azure will verify the DNS record exists
6. If verification succeeds, the domain will be added

### Configure SSL Certificate

Azure Static Web Apps automatically provides SSL certificates for custom domains. This may take a few minutes to provision.

## Step 5: Test the Setup

### Verify Application Access

1. Wait 5-10 minutes for DNS propagation
2. Visit `https://odcrm.bidlow.co.uk`
3. Verify:
   - Frontend loads correctly
   - API calls work (should proxy to your App Service)
   - SSL certificate is valid (padlock icon)

### Test API Proxy

Your `staticwebapp.config.json` should proxy `/api/*` requests to your backend:

```json
{
  "route": "/api/*",
  "backend": {
    "url": "https://odcrm-api.azurewebsites.net"
  }
}
```

Test API endpoints:
- Visit: `https://odcrm.bidlow.co.uk/api/health` (if you have a health endpoint)
- Check browser network tab to ensure API calls go through the proxy

## Troubleshooting

### DNS Issues

1. **DNS not propagating**
   - Wait longer (up to 24 hours for full propagation)
   - Clear local DNS cache: `ipconfig /flushdns` (Windows)
   - Try different DNS servers (8.8.8.8, 1.1.1.1)

2. **Wrong CNAME target**
   - Double-check the Azure Static Web App hostname
   - Ensure no extra dots or spaces in the record

3. **CNAME record not found**
   - Verify the record was added correctly in GoDaddy
   - Check if there are conflicting records (A, AAAA, etc.)

### Azure Issues

1. **Custom domain validation fails**
   - Ensure DNS record is live (use online DNS checkers)
   - Wait a few minutes and try again
   - Check Azure status page for outages

2. **SSL certificate issues**
   - Azure provisions certificates automatically
   - May take up to 24 hours for new domains
   - Check Azure Static Web App logs

3. **API proxy not working**
   - Verify `staticwebapp.config.json` is deployed
   - Check backend App Service is running
   - Ensure CORS is configured on the backend

### Common GoDaddy Issues

1. **Records not saving**
   - Try clearing browser cache
   - Use incognito/private browsing mode
   - Contact GoDaddy support if persistent

2. **Multiple records conflict**
   - GoDaddy allows multiple records of the same type
   - Ensure the correct record has priority
   - Remove old/incorrect records

## DNS Record Summary

**Required Records for odcrm.bidlow.co.uk:**

```
Type: CNAME
Host: odcrm
Value: [your-azure-static-web-app-hostname].azurestaticapps.net
TTL: 3600
```

**Optional: Root domain redirect**
- Use GoDaddy's domain forwarding feature
- Or add A record pointing to redirect service

## Next Steps

After DNS setup is complete:

1. Update your `.env.example` files to reflect production URLs
2. Test all application features
3. Set up monitoring and alerts in Azure
4. Consider setting up Azure Front Door for additional features (CDN, WAF, etc.)

## Support Resources

- [Azure Static Web Apps Documentation](https://docs.microsoft.com/en-us/azure/static-web-apps/)
- [GoDaddy DNS Help](https://www.godaddy.com/help/manage-dns-680)
- [Azure DNS Troubleshooting](https://docs.microsoft.com/en-us/azure/dns/dns-troubleshoot)