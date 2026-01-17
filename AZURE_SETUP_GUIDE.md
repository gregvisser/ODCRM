# Azure App Registration Setup - Quick Guide

## Step-by-Step Instructions

### Step 1: Access Azure Portal

1. Go to **https://portal.azure.com**
2. Sign in with your Microsoft account

### Step 2: Create App Registration

1. In the search bar at the top, type **"Azure Active Directory"** and click it
2. In the left sidebar, click **"App registrations"**
3. Click **"+ New registration"** (top left)

### Step 3: Configure App Registration

Fill in the form:

- **Name**: `OpensDoors CRM Production`
- **Supported account types**: 
  - Select: **"Accounts in any organizational directory and personal Microsoft accounts"**
  - (This allows both work and personal Microsoft accounts)
- **Redirect URI**:
  - Platform: **Web**
  - URI: `https://api.yourdomain.com/api/outlook/callback`
  - ⚠️ **Note**: Replace `yourdomain.com` with your actual domain
  - For testing, you can also add: `http://localhost:3001/api/outlook/callback`
  
4. Click **"Register"** (bottom left)

### Step 4: Copy Application (Client) ID

After registration, you'll see the Overview page:

1. Find **"Application (client) ID"** - it looks like: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
2. **Copy this ID** - you'll need it for `server/.env`

### Step 5: Create Client Secret

1. In the left sidebar, click **"Certificates & secrets"**
2. Under "Client secrets", click **"+ New client secret"**
3. Fill in:
   - **Description**: `Production Secret`
   - **Expires**: Choose **12 months** or **24 months** (recommended)
4. Click **"Add"**
5. **IMPORTANT**: Copy the **Value** immediately (it shows only once!)
   - The value looks like: `~a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0~`
   - You'll need this for `server/.env`

### Step 6: Configure API Permissions

1. In the left sidebar, click **"API permissions"**
2. Click **"+ Add a permission"**
3. Select **"Microsoft Graph"**
4. Select **"Delegated permissions"**
5. In the search box, search for and check these permissions:
   - `Mail.Send` - Send mail as the user
   - `Mail.Read` - Read user mail
   - `User.Read` - Sign in and read user profile
   - `offline_access` - Maintain access to data (required for refresh tokens)
6. Click **"Add permissions"** (bottom)

### Step 7: Grant Admin Consent

1. After adding permissions, click **"Grant admin consent for [Your Organization]"** button
2. Click **"Yes"** to confirm
3. All permissions should now show **"Granted for [Your Organization]"** with a green checkmark

### Step 8: Verify Configuration

Your app should now have:
- ✅ Application (client) ID copied
- ✅ Client secret created and value copied
- ✅ 4 API permissions added (Mail.Send, Mail.Read, User.Read, offline_access)
- ✅ Admin consent granted (all permissions show green checkmark)

---

## Next Step: Update Environment File

Once you have:
- **Client ID** (from Step 4)
- **Client Secret** (from Step 5)

Run this command to update `server/.env`:

```bash
npm run deploy:update-azure
```

Or provide them to me and I'll update the file for you.

---

## Troubleshooting

### Can't find "App registrations"?
- Make sure you're in **Azure Active Directory**, not a different service
- Try searching for "App registrations" in the top search bar

### Redirect URI issues?
- Make sure you include `https://` for production
- The path must be exactly: `/api/outlook/callback`
- You can add multiple redirect URIs (one for production, one for localhost)

### "Grant admin consent" button not showing?
- You may need to be an Azure AD administrator
- If you're using a personal Microsoft account, admin consent may not be needed
- Try signing in with an organizational account

### Client secret expired?
- Create a new secret in "Certificates & secrets"
- Update `MICROSOFT_CLIENT_SECRET` in `server/.env` with the new value

---

## Quick Reference

- **Azure Portal**: https://portal.azure.com
- **App Registrations**: Azure AD → App registrations
- **Required Permissions**: Mail.Send, Mail.Read, User.Read, offline_access
- **Redirect URI**: `https://api.yourdomain.com/api/outlook/callback`

---

Ready to proceed? Follow the steps above, then provide:
1. Your Client ID
2. Your Client Secret

And I'll update the environment file for you!
