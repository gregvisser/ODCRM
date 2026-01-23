# Environment Configuration Guide

This document explains how to run the OpenDoors CRM in both **local development** and **production** environments.

---

## Architecture Overview

### Stack

- **Frontend**: React + TypeScript + Vite
  - Production: Deployed on Vercel
  - Domain: https://www.bidlow.co.uk

- **Backend**: Node.js + Express + TypeScript
  - Production: Deployed on Render
  - Domain: https://api.bidlow.co.uk

- **Database**: PostgreSQL (Neon in production)
  - Production: Managed Neon database
  - Dev: Local PostgreSQL or Neon dev database

---

## Local Development Setup

### Prerequisites

1. Node.js 18+ and npm
2. PostgreSQL (local install or Neon free tier)
3. Azure App Registration for OAuth (see `AZURE_SETUP_GUIDE.md`)

### 1. Clone and Install

```bash
# Clone repository
cd C:\CodeProjects\Clients\Opensdoors\ODCRM

# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

### 2. Configure Frontend Environment

Create `.env.local` in the root directory (copy from `.env.example`):

```env
# Frontend Environment Variables (.env.local)
VITE_API_URL=http://localhost:3001
VITE_AZURE_CLIENT_ID=your-azure-client-id
VITE_AZURE_TENANT_ID=your-azure-tenant-id
VITE_AZURE_REDIRECT_URI=http://localhost:5173
VITE_AUTH_ALLOWED_EMAILS=your-email@domain.com
```

### 3. Configure Backend Environment

Create `server/.env` (copy from `server/env.example`):

```env
# Backend Environment Variables (server/.env)
DATABASE_URL="postgresql://postgres:password@localhost:5432/odcrm"
NODE_ENV=development
PORT=3001

# Frontend CORS
FRONTEND_URL=http://localhost:5173
FRONTEND_URLS=http://localhost:5173

# Microsoft OAuth
MICROSOFT_CLIENT_ID=your-azure-client-id
MICROSOFT_CLIENT_SECRET=your-azure-client-secret
MICROSOFT_TENANT_ID=common
REDIRECT_URI=http://localhost:3001/api/outlook/callback

# Email tracking
EMAIL_TRACKING_DOMAIN=http://localhost:3001

# API Keys (optional for dev)
OPENAI_API_KEY=your-key-here
CLEARBIT_API_KEY=your-key-here

# Workers (can disable for faster dev)
LEADS_SYNC_DISABLED=false
ABOUT_ENRICHMENT_DISABLED=true
```

### 4. Set Up Database

```bash
cd server

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate:dev

# Optional: Open Prisma Studio to view/edit data
npm run prisma:studio
```

### 5. Run Development Servers

**Option A: Run both in parallel (recommended)**

```bash
# From root directory
npm run dev:all
```

**Option B: Run separately in two terminals**

```bash
# Terminal 1 - Frontend
npm run dev

# Terminal 2 - Backend
npm run dev:server
```

Access the app at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- API Health: http://localhost:3001/health

---

## Production Deployment

### Frontend (Vercel)

#### Initial Setup

1. **Connect GitHub Repository** to Vercel
   - Go to https://vercel.com
   - Import your repository
   - Root directory: `./` (project root)

2. **Configure Build Settings**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

3. **Set Environment Variables** in Vercel Dashboard

```env
VITE_API_URL=https://api.bidlow.co.uk
VITE_AZURE_CLIENT_ID=your-production-client-id
VITE_AZURE_TENANT_ID=your-tenant-id
VITE_AZURE_REDIRECT_URI=https://www.bidlow.co.uk
VITE_AUTH_ALLOWED_EMAILS=user1@domain.com,user2@domain.com
VITE_AUTH_ALLOWED_DOMAINS=yourdomain.com
```

4. **Configure Custom Domain**
   - Add `www.bidlow.co.uk` in Vercel domains
   - Update DNS records as instructed by Vercel

#### Deploy Frontend

Vercel automatically deploys on every push to `main` branch.

**Manual deploy:**

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to production
vercel --prod
```

---

### Backend (Render)

#### Initial Setup

1. **Connect GitHub Repository** to Render
   - Go to https://render.com
   - Create new Web Service
   - Connect your repository
   - Root directory: `./server`

2. **Configure Build Settings**
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run start`
   - Auto-deploy: Yes (on push to main)

3. **Set Environment Variables** in Render Dashboard

**CRITICAL**: Set these in the Render dashboard, NOT in code:

```env
NODE_ENV=production
PORT=10000

# Database (from Neon dashboard)
DATABASE_URL=postgresql://user:password@host.region.neon.tech/neondb?sslmode=require

# Frontend CORS
FRONTEND_URL=https://www.bidlow.co.uk
FRONTEND_URLS=https://www.bidlow.co.uk,https://bidlow.co.uk

# Microsoft OAuth
MICROSOFT_CLIENT_ID=your-production-client-id
MICROSOFT_CLIENT_SECRET=your-production-client-secret
MICROSOFT_TENANT_ID=common
REDIRECT_URI=https://api.bidlow.co.uk/api/outlook/callback

# Email tracking
EMAIL_TRACKING_DOMAIN=https://api.bidlow.co.uk

# API Keys
OPENAI_API_KEY=your-production-key
CLEARBIT_API_KEY=your-production-key

# Workers
LEADS_SYNC_DISABLED=false
LEADS_SYNC_CRON=*/10 * * * *
ABOUT_ENRICHMENT_DISABLED=false
ABOUT_ENRICHMENT_CRON=0 2 * * *
EMAIL_WORKERS_DISABLED=true

# Email sender config
SENDER_BATCH_SIZE=25
MAILBOX_DAILY_CAP=50
```

4. **Configure Custom Domain** (Optional)
   - Add `api.bidlow.co.uk` in Render domains
   - Update DNS CNAME record to point to Render

#### Deploy Backend

Render automatically deploys on every push to `main` branch.

**Manual deploy via Render Dashboard:**
- Go to your service
- Click "Manual Deploy" → "Deploy latest commit"

---

### Database (Neon)

#### Production Database Setup

1. **Create Neon Project**
   - Go to https://console.neon.tech
   - Create new project
   - Region: Choose closest to Render region
   - Note the connection string

2. **Copy Connection String**
   ```
   postgresql://user:password@host.region.neon.tech/neondb?sslmode=require
   ```

3. **Set in Render**
   - Add as `DATABASE_URL` environment variable
   - Restart service after adding

#### Running Migrations in Production

**IMPORTANT**: Migrations should be run manually or via deploy hooks, never automatically.

**Method 1: Manual via Render Shell**

```bash
# In Render dashboard, open Shell for your service
npm run prisma:migrate:deploy
```

**Method 2: Local with Production Database** (Use with caution!)

```bash
# Set DATABASE_URL temporarily to production
DATABASE_URL="your-production-url" npm run prisma:migrate:deploy
```

**Method 3: Automated via Deploy Hook** (Advanced)

Add to `server/package.json`:

```json
{
  "scripts": {
    "build": "tsc && npm run prisma:migrate:deploy"
  }
}
```

> ⚠️ **WARNING**: Only use automated migrations if you're confident in your migration safety.

---

## Environment Variable Reference

### Frontend Variables

| Variable | Dev Value | Production Value | Required |
|----------|-----------|------------------|----------|
| `VITE_API_URL` | `http://localhost:3001` | `https://api.bidlow.co.uk` | ✅ |
| `VITE_AZURE_CLIENT_ID` | From Azure | From Azure | ✅ |
| `VITE_AZURE_TENANT_ID` | From Azure | From Azure | ✅ |
| `VITE_AZURE_REDIRECT_URI` | `http://localhost:5173` | `https://www.bidlow.co.uk` | ✅ |
| `VITE_AUTH_ALLOWED_EMAILS` | Optional | Recommended | ❌ |
| `VITE_AUTH_ALLOWED_DOMAINS` | Optional | Recommended | ❌ |

### Backend Variables

| Variable | Dev Value | Production Value | Required |
|----------|-----------|------------------|----------|
| `DATABASE_URL` | Local or dev DB | Neon production | ✅ |
| `NODE_ENV` | `development` | `production` | ✅ |
| `PORT` | `3001` | `10000` (auto) | ✅ |
| `FRONTEND_URL` | `http://localhost:5173` | `https://www.bidlow.co.uk` | ✅ |
| `MICROSOFT_CLIENT_ID` | From Azure | From Azure | ✅ |
| `MICROSOFT_CLIENT_SECRET` | From Azure | From Azure | ✅ |
| `REDIRECT_URI` | `http://localhost:3001/api/outlook/callback` | `https://api.bidlow.co.uk/api/outlook/callback` | ✅ |
| `EMAIL_TRACKING_DOMAIN` | `http://localhost:3001` | `https://api.bidlow.co.uk` | ✅ |
| `OPENAI_API_KEY` | Optional | Required | ⚠️ |
| `CLEARBIT_API_KEY` | Optional | Optional | ❌ |
| `LEADS_SYNC_DISABLED` | `true` or `false` | `false` | ❌ |
| `ABOUT_ENRICHMENT_DISABLED` | `true` (for dev) | `false` | ❌ |

---

## Common Commands Reference

### Development

```bash
# Run everything (frontend + backend)
npm run dev:all

# Frontend only
npm run dev

# Backend only
npm run dev:server

# Database tools
cd server
npm run prisma:studio          # View data
npm run prisma:migrate:dev     # Create migration
npm run prisma:generate        # Regenerate Prisma client
```

### Production Database Migrations

```bash
# From server directory
npm run prisma:migrate:deploy  # Apply pending migrations (production-safe)
```

### Deployment

```bash
# Frontend (via Vercel CLI)
vercel --prod

# Backend (via git push)
git push origin main  # Render auto-deploys
```

---

## Troubleshooting

### Frontend Can't Connect to Backend

**Symptoms**: API calls fail with network errors

**Check**:
1. Is `VITE_API_URL` set correctly?
   - Dev: `http://localhost:3001`
   - Prod: `https://api.bidlow.co.uk`
2. Is backend running (dev) or deployed (prod)?
3. Check browser console for CORS errors

### CORS Errors in Production

**Check**:
1. `FRONTEND_URL` set in Render: `https://www.bidlow.co.uk`
2. Frontend domain matches exactly (including `www` or not)
3. Both `http` and `https` can cause issues if mixed

### Database Connection Fails

**Dev**:
- Is PostgreSQL running locally?
- Is `DATABASE_URL` in `server/.env` correct?

**Prod**:
- Is Neon database running?
- Is connection string in Render env vars?
- Check Neon dashboard for connection issues

### Migrations Don't Apply

**Check**:
1. Run `npm run prisma:generate` after schema changes
2. Run `npm run prisma:migrate:dev` (dev) or `prisma:migrate:deploy` (prod)
3. Ensure `DATABASE_URL` points to correct database

### OAuth Redirect Issues

**Check**:
1. Azure App Registration redirect URIs match:
   - Dev: `http://localhost:5173`
   - Prod: `https://www.bidlow.co.uk`
2. Backend `REDIRECT_URI` matches:
   - Dev: `http://localhost:3001/api/outlook/callback`
   - Prod: `https://api.bidlow.co.uk/api/outlook/callback`

---

## Security Checklist

- [ ] `.env` files are in `.gitignore`
- [ ] No secrets committed to repository
- [ ] Production secrets set only in Vercel/Render dashboards
- [ ] `NODE_ENV=production` in Render
- [ ] Database connection uses SSL (`?sslmode=require`)
- [ ] CORS restricted to specific origins (no wildcard `*` in production)
- [ ] Azure redirect URIs restricted to production domains only

---

## Additional Resources

- [Azure Setup Guide](../AZURE_SETUP_GUIDE.md)
- [Email Campaigns Setup](../EMAIL_CAMPAIGNS_SETUP.md)
- [Vercel Documentation](https://vercel.com/docs)
- [Render Documentation](https://render.com/docs)
- [Neon Documentation](https://neon.tech/docs)
- [Prisma Migrations](https://www.prisma.io/docs/concepts/components/prisma-migrate)
