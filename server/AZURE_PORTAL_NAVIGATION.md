# Azure Portal Navigation Guide (Updated)

## Finding App Registrations in Azure Portal

Microsoft has updated the Azure Portal interface. Here are different ways to find App Registrations:

## Method 1: Direct Search (Easiest)

1. **At the top of Azure Portal**, there's a search bar that says "Search resources, services, and docs"
2. Type: **"App registrations"** (without quotes)
3. Click on **"App registrations"** from the results
4. You should see the App registrations page with a **"+ New registration"** button

## Method 2: Microsoft Entra ID (New Name)

1. In the search bar, type: **"Microsoft Entra ID"**
2. Click on **"Microsoft Entra ID"** (this is the new name for Azure Active Directory)
3. In the left menu, look for:
   - **"App registrations"** - Click this
4. Then click **"+ New registration"**

## Method 3: All Services

1. Click the hamburger menu (☰) in the top left
2. Click **"All services"**
3. Search for **"App registrations"** or **"Microsoft Entra ID"**
4. Click on it
5. Then click **"+ New registration"**

## Method 4: Direct URL

Go directly to:
```
https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade
```

## What You Should See

When you find App Registrations, you should see:
- A page titled "App registrations"
- A list of existing apps (if any)
- A **"+ New registration"** button (usually blue, top left or as a link)

## If You Still Can't Find It

**Check your Azure subscription:**
- Make sure you're signed in with an account that has access
- You might need an Azure subscription (free tier works)

**Alternative:** Use Azure CLI:
```bash
az ad app create --display-name "OpensDoors CRM"
```

But the portal is easier for getting the Client ID and Secret.

## Visual Cues

Look for these elements:
- **Search bar** at the very top
- **"App registrations"** as a service/tile
- **"+ New registration"** button (usually prominent)

## Still Stuck?

Try this:
1. Go to: https://portal.azure.com
2. In the search bar (top center), type: **"entra"** or **"app registration"**
3. Click the first result
4. Look for "App registrations" in the left menu
