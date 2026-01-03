# Production Deployment Guide

## 🎯 Architecture for Hosting Services

This setup is **100% ready** for production hosting services like:
- **Vercel** (Serverless Functions)
- **Railway** (Containers)
- **Render** (Web Services)
- **Fly.io** (Global Apps)

## 📋 What's Configured

✅ **Cloud Database Ready** - Uses connection strings (works anywhere)  
✅ **Environment Variables** - All config via env vars  
✅ **No Local Dependencies** - Everything cloud-based  
✅ **Production Config** - Ready for deployment  

## 🚀 Deployment Steps

### For Vercel

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Deploy Backend:**
   ```bash
   cd server
   vercel
   ```

3. **Set Environment Variables in Vercel Dashboard:**
   - `DATABASE_URL` - Your cloud database connection string
   - `MICROSOFT_CLIENT_ID` - Azure app client ID
   - `MICROSOFT_CLIENT_SECRET` - Azure app secret
   - `FRONTEND_URL` - Your frontend URL
   - `REDIRECT_URI` - Your API URL + `/api/outlook/callback`
   - `EMAIL_TRACKING_DOMAIN` - Your API URL

4. **Deploy Frontend:**
   ```bash
   cd ..
   vercel
   ```

### For Railway

1. **Connect Repository:**
   - Go to https://railway.app
   - New Project → Deploy from GitHub
   - Select your repository

2. **Add Services:**
   - **Backend Service:** Point to `server/` directory
   - **PostgreSQL Service:** Railway auto-creates (or use external)
   - **Frontend Service:** Point to root directory

3. **Configure Environment Variables:**
   - Railway auto-detects `.env` files
   - Add production values in Railway dashboard

### For Render

1. **Create Web Service:**
   - New → Web Service
   - Connect repository
   - Root Directory: `server`
   - Build Command: `npm install && npx prisma generate && npm run build`
   - Start Command: `npm start`

2. **Add PostgreSQL Database:**
   - New → PostgreSQL
   - Copy connection string
   - Add as `DATABASE_URL` environment variable

3. **Deploy Frontend:**
   - New → Static Site
   - Build Command: `npm run build`
   - Publish Directory: `dist`

## 🔧 Required Environment Variables (Production)

```env
# Database (Cloud PostgreSQL)
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

# Server
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://your-frontend.vercel.app

# Microsoft Graph OAuth
MICROSOFT_CLIENT_ID=your-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret
MICROSOFT_TENANT_ID=common
REDIRECT_URI=https://your-api.vercel.app/api/outlook/callback

# Email Tracking
EMAIL_TRACKING_DOMAIN=https://your-api.vercel.app
```

## 📝 Pre-Deployment Checklist

- [ ] Cloud database set up (Neon, Supabase, etc.)
- [ ] `DATABASE_URL` configured
- [ ] Azure App Registration created
- [ ] Azure redirect URI updated for production URL
- [ ] Environment variables set in hosting platform
- [ ] Database migrations run: `npx prisma migrate deploy`
- [ ] Background workers configured (cron jobs or alternative)

## 🔄 Background Workers in Production

Background workers (email scheduler, reply detection) need to run continuously.

**Options:**

1. **Vercel Cron Jobs:**
   - Create `vercel.json` with cron configuration
   - Runs serverless functions on schedule

2. **Separate Worker Service:**
   - Deploy worker script as separate service
   - Use hosting platform's cron/worker features

3. **External Cron Service:**
   - Use cron-job.org or similar
   - Hit your API endpoints on schedule

4. **Railway/Render Workers:**
   - Deploy as separate worker service
   - Runs continuously

## ✅ Testing Production Setup

1. **Database Connection:**
   ```bash
   npx prisma db pull
   ```

2. **Run Migrations:**
   ```bash
   npx prisma migrate deploy
   ```

3. **Test API:**
   - Health check: `GET /health`
   - Should return: `{ "status": "ok" }`

4. **Test OAuth Flow:**
   - Connect Outlook account
   - Verify token storage

## 🐛 Troubleshooting

### Database Connection Fails
- Check `DATABASE_URL` is correct
- Verify SSL mode: `?sslmode=require`
- Check database allows connections from hosting IP

### OAuth Callback Fails
- Update Azure redirect URI to production URL
- Check `REDIRECT_URI` env var matches

### Background Workers Not Running
- Verify worker deployment
- Check cron configuration
- Review hosting platform logs

## 📚 Documentation

- `server/CLOUD_DB_QUICK_START.md` - Database setup
- `EMAIL_CAMPAIGNS_SETUP.md` - Full feature documentation
- `server/.env.production.example` - Production env template
