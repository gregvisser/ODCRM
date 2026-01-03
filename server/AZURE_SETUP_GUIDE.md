# Azure App Registration Setup - Step by Step

## 🎯 Goal
Create an Azure App Registration to enable Outlook OAuth integration for sending emails.

## ⏱️ Time Required: 10-15 minutes

## Step 1: Access Azure Portal

1. Go to: https://portal.azure.com
2. Sign in with your Microsoft account (personal or work)

## Step 2: Navigate to App Registrations

1. In the Azure Portal search bar, type: **"Azure Active Directory"**
2. Click on **Azure Active Directory** (or **Microsoft Entra ID**)
3. In the left menu, click **App registrations**
4. Click **+ New registration** button (top left)

## Step 3: Register New Application

Fill in the form:

**Name:**
```
OpensDoors CRM
```
(Or any name you prefer)

**Supported account types:**
- Select: **"Accounts in any organizational directory and personal Microsoft accounts (Any Azure AD directory - Multitenant)"**
- This allows both work and personal Microsoft accounts

**Redirect URI:**
- **Platform:** Select **Web**
- **URI:** Enter: `http://localhost:3001/api/outlook/callback`
- Click **Register**

## Step 4: Copy Application (Client) ID

After registration:

1. You'll see the **Overview** page
2. Find **Application (client) ID**
3. **Copy this value** - you'll need it for `.env`

**Example:** `12345678-1234-1234-1234-123456789abc`

## Step 5: Create Client Secret

1. In the left menu, click **Certificates & secrets**
2. Click **+ New client secret**
3. Fill in:
   - **Description:** `Development Secret` (or any name)
   - **Expires:** Choose **24 months** (or your preference)
4. Click **Add**

⚠️ **IMPORTANT:** Copy the **Value** immediately! 
- You won't be able to see it again after leaving this page
- It looks like: `abc~def-ghi-jkl-mno-pqr-stu-vwx-yz`

## Step 6: Configure API Permissions

1. In the left menu, click **API permissions**
2. Click **+ Add a permission**
3. Select **Microsoft Graph**
4. Select **Delegated permissions** (not Application permissions)
5. Search and add these permissions one by one:
   - ✅ `Mail.Send` - Send mail as the user
   - ✅ `Mail.Read` - Read user mail
   - ✅ `User.Read` - Sign in and read user profile
   - ✅ `offline_access` - Maintain access to data you've given it access to

6. Click **Add permissions**

## Step 7: Grant Admin Consent

⚠️ **Critical Step!**

1. After adding permissions, you'll see a yellow banner
2. Click **Grant admin consent for [Your Organization]**
3. Click **Yes** to confirm

**What this does:**
- Allows users in your organization to use the app
- Required for the OAuth flow to work

**Note:** If you're using a personal Microsoft account, you may need to consent individually when first connecting.

## Step 8: Update Redirect URI for Production (Optional)

For production deployment:

1. Go back to **Overview**
2. Click **Add a platform** or **Redirect URIs**
3. Add your production URL:
   ```
   https://your-api-domain.com/api/outlook/callback
   ```

## Step 9: Update .env File

Once you have your credentials, update `server/.env`:

```env
MICROSOFT_CLIENT_ID=your-client-id-here
MICROSOFT_CLIENT_SECRET=your-client-secret-value-here
MICROSOFT_TENANT_ID=common
REDIRECT_URI=http://localhost:3001/api/outlook/callback
```

## ✅ Verification Checklist

- [ ] Application created
- [ ] Client ID copied
- [ ] Client secret created and copied
- [ ] API permissions added (Mail.Send, Mail.Read, User.Read, offline_access)
- [ ] Admin consent granted
- [ ] Redirect URI set to: `http://localhost:3001/api/outlook/callback`
- [ ] `.env` file updated with credentials

## 🧪 Test the Setup

After updating `.env`:

1. Start your server: `npm run dev`
2. Navigate to: `http://localhost:3001/api/outlook/auth`
3. You should be redirected to Microsoft login
4. After login, you'll be redirected back

## 🐛 Troubleshooting

### "AADSTS50011: Redirect URI mismatch"
- Check redirect URI matches exactly: `http://localhost:3001/api/outlook/callback`
- No trailing slash, exact protocol (http vs https)

### "Insufficient privileges"
- Grant admin consent in API permissions
- Check all 4 permissions are added

### "Invalid client secret"
- Client secret may have expired
- Create a new secret and update `.env`

### "AADSTS7000215: Invalid client secret"
- Make sure you copied the **Value**, not the Secret ID
- Check for extra spaces when pasting

## 📸 Visual Guide

**Where to find each item:**

1. **Client ID:** Overview page → Application (client) ID
2. **Client Secret:** Certificates & secrets → Value (copy immediately!)
3. **Permissions:** API permissions → Add permission → Microsoft Graph
4. **Admin Consent:** API permissions → Grant admin consent button

## 🔐 Security Notes

- Never commit `.env` file to Git
- Client secrets expire - set a reminder
- Use different apps for development and production
- Rotate secrets periodically

## 🚀 Next Steps After Setup

1. ✅ Azure App configured
2. ✅ `.env` updated
3. Start server: `npm run dev`
4. Test OAuth flow
5. Connect Outlook account in the UI
