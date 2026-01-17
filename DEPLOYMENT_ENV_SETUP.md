# Environment Variables Setup Guide

This guide shows you exactly what to put in your `.env` files. **These files are not in git** (by design, for security), so you need to create them manually.

## Step 1: Create `server/.env`

Create a new file at `server/.env` with the following content:

```env
# Database
# IMPORTANT: Update this with your Neon database connection string after provisioning
# Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
# Example: postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/odcrm?sslmode=require
DATABASE_URL="postgresql://postgres:password@localhost:5432/odcrm?schema=public"

# Server Configuration
PORT=3001
NODE_ENV=production
# IMPORTANT: Update with your production frontend URL after deployment
# Example: https://crm.yourdomain.com
FRONTEND_URL=http://localhost:5173

# Microsoft Graph / Outlook OAuth
# IMPORTANT: Update these after creating Azure App Registration (see PRODUCTION_DEPLOYMENT_STEPS.md Phase 2)
MICROSOFT_CLIENT_ID=your-client-id-here
MICROSOFT_CLIENT_SECRET=your-client-secret-here
MICROSOFT_TENANT_ID=common
# IMPORTANT: Update with your production API URL after deployment
# Example: https://api.yourdomain.com/api/outlook/callback
REDIRECT_URI=http://localhost:3001/api/outlook/callback

# Email Tracking
# IMPORTANT: Update with your production API URL after deployment
# Example: https://api.yourdomain.com
EMAIL_TRACKING_DOMAIN=http://localhost:3001

# Optional: JWT Secret (if implementing authentication)
# JWT_SECRET=your-jwt-secret-here
```

**To create this file:**
1. Open your code editor
2. Create new file: `server/.env`
3. Copy the content above
4. Update values as you complete each phase (see PRODUCTION_DEPLOYMENT_STEPS.md)

---

## Step 2: Create Root `.env`

Create a new file at `.env` (in the project root, same level as `package.json`) with the following content:

```env
# Frontend Environment Variables
# IMPORTANT: Update this with your production API URL after backend deployment
# Example: https://api.yourdomain.com
# For local development, this defaults to http://localhost:3001 (see src/utils/api.ts)
VITE_API_URL=http://localhost:3001

# Optional: AI Configuration (if using AI features)
# VITE_AI_ABOUT_ENDPOINT=https://api.openai.com/v1/chat/completions
# VITE_AI_ABOUT_API_KEY=your-ai-api-key-here
# VITE_AI_ABOUT_MODEL=gpt-4o-mini
# VITE_CLEARBIT_API_KEY=your-clearbit-api-key-here
```

**To create this file:**
1. Open your code editor
2. Create new file: `.env` (at project root)
3. Copy the content above
4. Update `VITE_API_URL` after backend deployment (see PRODUCTION_DEPLOYMENT_STEPS.md Phase 3)

---

## Quick Reference: When to Update Each Value

| Variable | When to Update | Where to Get Value |
|----------|----------------|-------------------|
| `DATABASE_URL` | After Neon database setup | Neon dashboard → Connection string |
| `MICROSOFT_CLIENT_ID` | After Azure app registration | Azure Portal → App registration → Overview |
| `MICROSOFT_CLIENT_SECRET` | After Azure app registration | Azure Portal → App registration → Certificates & secrets |
| `REDIRECT_URI` | After backend deployment | `https://api.yourdomain.com/api/outlook/callback` |
| `FRONTEND_URL` | After frontend deployment | `https://crm.yourdomain.com` |
| `EMAIL_TRACKING_DOMAIN` | After backend deployment | `https://api.yourdomain.com` |
| `VITE_API_URL` | After backend deployment | `https://api.yourdomain.com` |

---

## Verification

After creating both files, verify they exist:

**Windows PowerShell:**
```powershell
Test-Path server\.env
Test-Path .env
# Both should return: True
```

**Windows Command Prompt:**
```cmd
dir server\.env
dir .env
# Both should show the files
```

**Mac/Linux:**
```bash
ls -la server/.env
ls -la .env
# Both should show the files
```

---

## Security Note

✅ **These files are correctly excluded from git** (see `.gitignore`).  
✅ **Never commit `.env` files to version control.**  
✅ **Never share `.env` files publicly.**

---

## Next Steps

Once you've created both `.env` files, proceed with:
- See `PRODUCTION_DEPLOYMENT_STEPS.md` Phase 1: Cloud Database Setup
- Update `DATABASE_URL` after Neon setup
- Continue through all deployment phases
