# Quick Guide: Check Azure Permissions

## Step-by-Step to Verify Permissions

### 1. Open Azure Portal
Go to: https://portal.azure.com

### 2. Navigate to Your App
- Click the search bar at the top
- Type: **"App registrations"**
- Click on **App registrations**

### 3. Select Your App
- Find your app (Client ID: `0205e8c0-56dd-4427-89da-5a3feea8373a`)
- Click on it to open

### 4. Check API Permissions
- In the left menu, click **"API permissions"**
- You should see a list of permissions

### 5. Required Permissions (Must Have All 3):

✅ **User.Read**
- Type: Delegated
- Admin consent: Not required (for personal accounts)

✅ **Mail.Send**
- Type: Delegated  
- Admin consent: Not required (for personal accounts)

✅ **Mail.Read**
- Type: Delegated
- Admin consent: Not required (for personal accounts)

### 6. If Any Permission is Missing:

1. Click **"+ Add a permission"** button at the top
2. Select **"Microsoft Graph"**
3. Select **"Delegated permissions"**
4. In the search box, type the permission name (e.g., "User.Read")
5. Check the checkbox next to the permission
6. Click **"Add permissions"** at the bottom
7. Repeat for any missing permissions

### 7. Important Notes:

- **Status should show "Granted"** for your account
- For personal accounts, permissions are auto-granted when you consent
- For work accounts, you may see "Not granted" - you'll grant them during OAuth

### 8. After Adding Permissions:

- If you added permissions, you're done!
- Try OAuth flow again
- The permissions will be requested during login

## Quick Checklist:

- [ ] User.Read is listed (Delegated)
- [ ] Mail.Send is listed (Delegated)
- [ ] Mail.Read is listed (Delegated)
- [ ] All show "Granted" or will be granted during OAuth

