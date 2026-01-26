# DNS Setup for odcrm.bidlow.co.uk

## Step 1: Get Azure Hostnames

### Static Web App Hostname
1. Go to Azure Portal → Static Web Apps → odcrm-frontend
2. Copy the "Default domain" URL (something like: `amazing-ocean-123456789.azurestaticapps.net`)

### App Service Hostname (for reference)
- Your App Service URL: `https://odcrm-api.azurewebsites.net`

## Step 2: Configure Custom Domain in Azure

### Add Custom Domain to Static Web App
1. Azure Portal → Static Web Apps → odcrm-frontend
2. Settings → Custom domains
3. Click "Add custom domain"
4. Enter: `odcrm.bidlow.co.uk`
5. Choose "CNAME" validation
6. Copy the validation code shown

## Step 3: Update GoDaddy DNS Records

Go to GoDaddy Domain Manager → bidlow.co.uk → DNS Management

### Add CNAME Record
- **Type**: CNAME
- **Host**: `odcrm`
- **Points to**: `your-static-web-app-hostname.azurestaticapps.net` (from Step 1)
- **TTL**: `3600` (1 hour)

### Example:
```
Type: CNAME
Host: odcrm
Points To: amazing-ocean-123456789.azurestaticapps.net
TTL: 3600
```

## Step 4: Verify DNS

Wait 24-48 hours for DNS propagation, then:

1. Test DNS: `nslookup odcrm.bidlow.co.uk`
2. Visit: `https://odcrm.bidlow.co.uk`
3. Check SSL certificate (Azure provides it automatically)

## Step 5: Update Static Web App Config

If your App Service hostname is different, update `staticwebapp.config.json`:

```json
{
  "routes": [
    {
      "route": "/api/*",
      "backend": {
        "url": "https://odcrm-api.azurewebsites.net"
      }
    }
  ]
}
```

Replace with your actual App Service URL if different.