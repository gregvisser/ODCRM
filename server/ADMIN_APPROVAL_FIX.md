# Fix: "Approval Required" - Admin Approval Needed

## What's Happening

Microsoft is requiring admin approval because:
1. **App is unverified** - Shows "unverified" status
2. **Organization policy** - Your organization requires admin approval for all apps
3. **Work/school account** - Using an organizational account with strict policies

## Solutions

### Solution 1: Request Admin Approval (For Work/School Accounts)

If you're using a work/school Microsoft account:

1. **Fill in the justification:**
   - Enter text like: "Internal CRM tool for email campaigns"
   - Explain the business purpose

2. **Click "Request approval"**
   - Your IT admin will receive the request
   - They can approve it in Azure Portal

3. **Wait for approval** - Then try again

### Solution 2: Use Personal Microsoft Account (Quick Test)

For immediate testing:

1. **Use a personal Microsoft account** (not work/school):
   - Sign out of your work account
   - Click "Sign in with another account"
   - Use a personal @outlook.com or @hotmail.com account

2. **Personal accounts don't require admin approval**
   - You can consent directly
   - Perfect for development/testing

### Solution 3: Mark App as Verified (Production Solution)

For production use, verify your app:

1. **In Azure Portal:**
   - Go to your App Registration
   - Navigate to **Branding & properties**
   - Complete verification process
   - This can take time (days/weeks)

2. **Or use Publisher Verification:**
   - Submit for Microsoft Partner Network verification
   - Required for production apps

### Solution 4: Admin Grants Consent Directly (Fastest for Work Account)

Ask your IT admin to:

1. Go to Azure Portal → Your App Registration
2. Go to **API permissions**
3. Click **Grant admin consent for [Organization]**
4. This bypasses individual approval requests

## ✅ Recommended: Use Personal Account for Testing

For development and testing, use a personal Microsoft account:

1. **In the browser:**
   - Click "Sign in with another account"
   - Use personal @outlook.com account

2. **Personal accounts:**
   - No admin approval needed
   - Direct consent
   - Perfect for testing

## 🔄 Quick Test Steps

1. Click **"Sign in with another account"** on the approval screen
2. Sign in with personal Microsoft account (@outlook.com, @hotmail.com, etc.)
3. You'll see consent screen (not approval request)
4. Click "Accept"
5. Account connected!

## 📝 Note

The "unverified" status is normal for development apps. You can:
- Use personal accounts for testing (no verification needed)
- Request verification later for production
- Or get admin approval for your work account
