# ⚡ Quick Azure Setup (5 Steps)

## Step 1: Go to Azure Portal
https://portal.azure.com → Sign in

## Step 2: Create App Registration
1. Search: **"Azure Active Directory"**
2. Click **App registrations** → **+ New registration**
3. Name: `OpensDoors CRM`
4. Accounts: **"Any Azure AD directory - Multitenant"**
5. Redirect URI: **Web** → `http://localhost:3001/api/outlook/callback`
6. Click **Register**

## Step 3: Get Client ID
- On Overview page → Copy **Application (client) ID**

## Step 4: Create Secret
1. **Certificates & secrets** → **+ New client secret**
2. Description: `Development Secret`
3. Expires: **24 months**
4. Click **Add**
5. **COPY THE VALUE IMMEDIATELY!** (won't see it again)

## Step 5: Add Permissions
1. **API permissions** → **+ Add a permission** → **Microsoft Graph** → **Delegated**
2. Add these:
   - ✅ `Mail.Send`
   - ✅ `Mail.Read`
   - ✅ `User.Read`
   - ✅ `offline_access`
3. Click **Grant admin consent** → **Yes**

## ✅ Update .env

Update `server/.env` with:
```env
MICROSOFT_CLIENT_ID=paste-your-client-id-here
MICROSOFT_CLIENT_SECRET=paste-your-client-secret-value-here
MICROSOFT_TENANT_ID=common
REDIRECT_URI=http://localhost:3001/api/outlook/callback
```

## 🧪 Test
```bash
npm run dev
```
Then visit: `http://localhost:3001/api/outlook/auth`
