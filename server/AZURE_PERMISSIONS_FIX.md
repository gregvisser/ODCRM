# Fix for "Authorization_RequestDenied" Error

## Error: Status 403 - Insufficient privileges

This error occurs when the OAuth token is successfully obtained, but the app doesn't have permission to access Microsoft Graph API endpoints.

## Solution 1: Add User.Read Permission to Scopes ✅ (Already Fixed)

The code now includes `User.Read` in the OAuth scopes. This permission is required to read user profile information via the `/me` endpoint.

## Solution 2: Verify Azure App Registration Permissions

### Required Permissions:

1. **User.Read** (Delegated)
   - Purpose: Read user profile
   - Needed for: `/v1.0/me` endpoint
   - Admin consent: Not required for personal accounts

2. **Mail.Send** (Delegated)
   - Purpose: Send emails
   - Needed for: Sending campaign emails
   - Admin consent: Not required for personal accounts

3. **Mail.Read** (Delegated)
   - Purpose: Read mailbox
   - Needed for: Reply detection
   - Admin consent: Not required for personal accounts

### How to Verify in Azure Portal:

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to: **Azure Active Directory** → **App registrations** → Your App
3. Click **API permissions** in the left menu
4. Verify these permissions are listed:
   - `Microsoft Graph` → `User.Read` → Delegated
   - `Microsoft Graph` → `Mail.Send` → Delegated
   - `Microsoft Graph` → `Mail.Read` → Delegated

### If Permissions Are Missing:

1. Click **+ Add a permission**
2. Select **Microsoft Graph**
3. Select **Delegated permissions**
4. Search for and add:
   - `User.Read`
   - `Mail.Send`
   - `Mail.Read`
5. Click **Add permissions**

### For Personal Microsoft Accounts:

- Permissions are automatically granted when user consents
- No admin approval needed
- Just click "Accept" during OAuth flow

### For Work/School Accounts:

- May require admin approval if organization policy requires it
- If "Grant admin consent" button is greyed out, use a personal account for testing
- Or request admin to approve the app

## Solution 3: Use Personal Account for Testing

If you're using a work/school account and getting permission errors:

1. During Microsoft login, click **"Sign in with another account"**
2. Use a personal Microsoft account (like @outlook.com, @hotmail.com, @live.com)
3. Personal accounts automatically grant permissions without admin approval

## After Making Changes:

1. Restart the server
2. Try OAuth flow again
3. The error should be resolved

## Common Error Codes:

- **403 - Authorization_RequestDenied**: Missing permissions (this error)
- **401 - Unauthorized**: Invalid/expired token
- **400 - Bad Request**: Invalid request parameters
- **AADSTS50011**: Redirect URI mismatch

