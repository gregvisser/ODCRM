# Azure Configuration Setup Guide

## Step 1: Navigate to Application Settings

You're currently on **"General settings"** - we need to go to **"Configuration"** instead.

### Instructions:

1. **In the left sidebar** (under "Settings"), click on **"Configuration"** (not "Configuration (preview)")
   - It should be right above or below "General settings"
   - Look for the gear icon ⚙️

2. **Once in Configuration**, you'll see tabs at the top:
   - **Application settings** ← This is what we need!
   - Connection strings
   - General settings
   - etc.

3. **Click on "Application settings" tab**

4. **Look for `DATABASE_URL`** in the list of application settings

## Step 2: Verify DATABASE_URL

### If DATABASE_URL EXISTS:
- ✅ Check that the value starts with `postgresql://`
- ✅ Check that it includes `?sslmode=require` at the end
- ✅ The value should match your Azure PostgreSQL connection string

### If DATABASE_URL DOES NOT EXIST:
- Click **"+ New application setting"** button
- **Name:** `DATABASE_URL`
- **Value:** Copy from GitHub Secrets (you have `DATABASE_URL` secret there)
- Click **"OK"**
- Click **"Save"** at the top
- App Service will restart automatically

## Step 3: Verify Other Settings (Optional but Recommended)

While you're in Application settings, verify these exist:
- `NODE_ENV` = `production` (optional but recommended)
- `PORT` = `3001` (Azure usually sets this automatically)

## Visual Guide

```
Azure Portal
└── App Services
    └── odcrm-api
        └── Settings (left sidebar)
            └── Configuration ← CLICK HERE
                └── Application settings tab ← CLICK HERE
                    └── Look for DATABASE_URL
```

## What to Look For

The Application settings page will show a table like:

| Name | Value | Slot Setting |
|------|-------|--------------|
| DATABASE_URL | postgresql://... | ☐ |
| NODE_ENV | production | ☐ |
| PORT | 3001 | ☐ |

If `DATABASE_URL` is missing, add it using the "+ New application setting" button.
