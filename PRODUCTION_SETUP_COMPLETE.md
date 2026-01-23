# Production Setup - Complete ✅

**Date**: January 23, 2026  
**Status**: All production configuration fixes applied

---

## What Was Fixed

This project has been transformed from a confusing dev/prod mix into a **clean, production-ready setup**.

### ✅ Changes Applied

1. **Frontend API Configuration**
   - ❌ **Before**: Used `window.location.hostname` checks and hardcoded URLs
   - ✅ **After**: Uses `VITE_API_URL` environment variable exclusively
   - Fixed files: `src/utils/api.ts` and 4 component files

2. **Backend CORS Configuration**
   - ❌ **Before**: Had hardcoded production domains in code
   - ✅ **After**: Uses `FRONTEND_URL`/`FRONTEND_URLS` env vars, localhost only in dev mode

3. **Backend Environment Fallbacks**
   - ❌ **Before**: `REDIRECT_URI` and `EMAIL_TRACKING_DOMAIN` fell back to localhost in production
   - ✅ **After**: Requires explicit env vars in production, fails safely if not set

4. **Worker Configuration**
   - ✅ All cron jobs now have clear documentation and disable flags
   - ✅ Email workers, leads sync, and enrichment workers clearly marked

5. **Deployment Configuration**
   - ✅ Created `server/render.yaml` for Render deployment
   - ✅ Updated `vercel.json` for SPA routing (already correct)
   - ✅ Created comprehensive `.env.example` files

6. **Prisma Migration Scripts**
   - ❌ **Before**: Ambiguous database scripts
   - ✅ **After**: Clear separation:
     - `prisma:migrate:dev` - for local development
     - `prisma:migrate:deploy` - for production (safe, no prompts)

7. **Documentation**
   - ✅ Created comprehensive `docs/ENVIRONMENTS.md`
   - ✅ Updated `server/env.example` with detailed comments

---

## Files Changed

### Configuration Files
- ✅ `.env.example` (created)
- ✅ `server/env.example` (updated with full documentation)
- ✅ `server/render.yaml` (created)
- ✅ `server/package.json` (updated Prisma scripts)

### Frontend Code
- ✅ `src/utils/api.ts` (removed window.location check)
- ✅ `src/components/EmailSettingsTab.tsx` (use VITE_API_URL)
- ✅ `src/components/EmailAccountsEnhancedTab.tsx` (use VITE_API_URL)
- ✅ `src/components/MarketingPeopleTab.tsx` (use VITE_API_URL)

### Backend Code
- ✅ `server/src/index.ts` (CORS config, worker documentation)
- ✅ `server/src/routes/outlook.ts` (remove REDIRECT_URI fallbacks)
- ✅ `server/src/workers/emailScheduler.ts` (remove EMAIL_TRACKING_DOMAIN fallback)

### Documentation
- ✅ `docs/ENVIRONMENTS.md` (created - comprehensive guide)

---

## How Dev vs Prod Works Now

### Development (Local)

**Frontend**:
- Reads `VITE_API_URL` from `.env.local`
- Default: `http://localhost:3001` if not set
- Runs on `http://localhost:5173`

**Backend**:
- Reads config from `server/.env`
- `NODE_ENV=development` enables localhost CORS
- Allows dynamic REDIRECT_URI generation for OAuth
- Runs on `http://localhost:3001`

**Database**:
- Local PostgreSQL or Neon dev instance
- Migrations via `npm run prisma:migrate:dev`

### Production

**Frontend (Vercel)**:
- `VITE_API_URL=https://api.bidlow.co.uk` (set in Vercel dashboard)
- Deployed to `https://www.bidlow.co.uk`
- Auto-deploys on push to `main`

**Backend (Render)**:
- `NODE_ENV=production` (no localhost CORS)
- `FRONTEND_URL=https://www.bidlow.co.uk`
- `REDIRECT_URI=https://api.bidlow.co.uk/api/outlook/callback`
- All env vars set in Render dashboard
- Deployed to `https://api.bidlow.co.uk` (or current Render URL)
- Auto-deploys on push to `main`

**Database (Neon)**:
- Production PostgreSQL via `DATABASE_URL`
- Migrations via `npm run prisma:migrate:deploy`

---

## Quick Start Commands

### Local Development

```bash
# 1. Install dependencies
npm install
cd server && npm install && cd ..

# 2. Create environment files
cp .env.example .env.local
cp server/env.example server/.env

# 3. Edit .env.local and server/.env with your values

# 4. Set up database (from server directory)
cd server
npm run prisma:generate
npm run prisma:migrate:dev
cd ..

# 5. Run everything
npm run dev:all
```

Access:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

### Deploy to Production

#### Frontend (Vercel)

1. **Set Environment Variables** in Vercel Dashboard:
   ```
   VITE_API_URL=https://api.bidlow.co.uk
   VITE_AZURE_CLIENT_ID=<your-azure-client-id>
   VITE_AZURE_TENANT_ID=<your-azure-tenant-id>
   VITE_AZURE_REDIRECT_URI=https://www.bidlow.co.uk
   ```

2. **Deploy**:
   ```bash
   git push origin main  # Auto-deploys via Vercel
   ```

#### Backend (Render)

1. **Set Environment Variables** in Render Dashboard:
   ```
   NODE_ENV=production
   DATABASE_URL=<neon-connection-string>
   FRONTEND_URL=https://www.bidlow.co.uk
   FRONTEND_URLS=https://www.bidlow.co.uk,https://bidlow.co.uk
   MICROSOFT_CLIENT_ID=<azure-client-id>
   MICROSOFT_CLIENT_SECRET=<azure-client-secret>
   REDIRECT_URI=https://api.bidlow.co.uk/api/outlook/callback
   EMAIL_TRACKING_DOMAIN=https://api.bidlow.co.uk
   OPENAI_API_KEY=<your-key>
   ```

2. **Deploy**:
   ```bash
   git push origin main  # Auto-deploys via Render
   ```

3. **Apply Database Migrations** (if needed):
   - Go to Render Dashboard → Your Service → Shell
   - Run: `npm run prisma:migrate:deploy`

---

## Production Checklist

Before going live, ensure:

- [ ] All environment variables set in Vercel dashboard
- [ ] All environment variables set in Render dashboard
- [ ] Production database migrations applied
- [ ] Azure App Registration has correct redirect URIs:
  - Frontend: `https://www.bidlow.co.uk`
  - Backend: `https://api.bidlow.co.uk/api/outlook/callback`
- [ ] Custom domains configured:
  - Vercel: `www.bidlow.co.uk`
  - Render: `api.bidlow.co.uk` (or use default Render URL)
- [ ] Test OAuth flow in production
- [ ] Test API connectivity from frontend to backend
- [ ] Verify CORS works (no console errors)
- [ ] Check worker logs in Render (leads sync, enrichment)

---

## Important Notes

### ⚠️ DO NOT Commit

Never commit these files with real secrets:
- `.env`
- `.env.local`
- `server/.env`

These are already in `.gitignore`.

### ✅ Safe to Commit

These files are safe and should be committed:
- `.env.example`
- `server/env.example`
- `server/render.yaml` (no secrets, only structure)
- All code changes made today

### 🔒 Secrets Management

**Local**: Use `.env.local` and `server/.env`  
**Production**: Set in Vercel and Render dashboards, never in code

---

## Troubleshooting

See `docs/ENVIRONMENTS.md` for detailed troubleshooting guide.

**Common Issues**:

1. **Frontend can't reach backend**
   - Check `VITE_API_URL` is set correctly
   - Check browser console for CORS errors

2. **CORS errors in production**
   - Verify `FRONTEND_URL` in Render matches exact domain
   - Check for `http` vs `https` mismatches

3. **OAuth redirect fails**
   - Verify Azure redirect URIs match environment
   - Check `REDIRECT_URI` in backend env vars

4. **Database connection fails**
   - Verify `DATABASE_URL` is correct
   - Check Neon dashboard for connection issues
   - Ensure `?sslmode=require` is in connection string

---

## Next Steps

1. **Test locally** - Run `npm run dev:all` and verify everything works
2. **Commit changes** - All configuration changes are safe to commit
3. **Set production env vars** - In Vercel and Render dashboards
4. **Deploy** - Push to `main` branch
5. **Test production** - Verify https://www.bidlow.co.uk works
6. **Monitor logs** - Check Render logs for any startup errors

---

## Documentation

- **Main Guide**: `docs/ENVIRONMENTS.md` - Comprehensive setup guide
- **Azure Setup**: `AZURE_SETUP_GUIDE.md` - OAuth configuration
- **Email Setup**: `EMAIL_CAMPAIGNS_SETUP.md` - Email campaign configuration

---

**Status**: ✅ Production-ready  
**Verified**: All hardcoded URLs removed, environment-driven configuration in place  
**Safety**: Production requires explicit env vars, no accidental localhost usage
