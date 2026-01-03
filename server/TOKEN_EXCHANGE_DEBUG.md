# Debugging Token Exchange Failures

## Common Error: "token_exchange_failed"

This happens when Microsoft rejects the token exchange request.

## Most Common Causes

### 1. Redirect URI Mismatch (Most Common)

**Problem:** Redirect URI in token exchange doesn't match Azure configuration

**Check:**
- Azure Portal → Your App → Authentication
- Redirect URI must be: `http://localhost:3001/api/outlook/callback`
- Must match EXACTLY (no trailing slash, exact case)

**Fix:**
- Update Azure redirect URI to match exactly
- Or update `.env` REDIRECT_URI to match Azure

### 2. Client Secret Wrong

**Problem:** Using Secret ID instead of Secret Value

**Check:**
- Azure Portal → Certificates & secrets
- Make sure you copied the **Value** column (not Secret ID)
- Value looks like: `1GD8Q~kjNrI_8g5txXTku6M70BtnFfVETRNejaGr`

**Fix:**
- If secret expired, create new one
- Update `.env` with new secret value

### 3. Scope Mismatch

**Problem:** Scopes in token exchange don't match auth request

**Fixed:** Now using same scopes in both requests

### 4. Authorization Code Expired

**Problem:** Code expires quickly (usually 10 minutes)

**Fix:** Use code immediately after receiving it

## Debug Steps

1. **Check Server Logs:**
   - Look for "Token exchange request:" log
   - Check error details from Microsoft

2. **Verify Azure Configuration:**
   - Redirect URI matches exactly
   - Client secret is current (not expired)
   - Permissions are granted

3. **Test Redirect URI:**
   - Make sure it's accessible
   - No firewall blocking localhost:3001

## Error Messages from Microsoft

- **AADSTS50011**: Redirect URI mismatch
- **AADSTS7000215**: Invalid client secret
- **AADSTS70011**: Invalid scope
- **AADSTS70008**: Expired authorization code

## Quick Fix Checklist

- [ ] Redirect URI in Azure: `http://localhost:3001/api/outlook/callback`
- [ ] Redirect URI in .env: `http://localhost:3001/api/outlook/callback`
- [ ] Client Secret is the VALUE (not ID)
- [ ] Client Secret hasn't expired
- [ ] Server is running on port 3001
- [ ] Try OAuth flow immediately (code expires fast)
