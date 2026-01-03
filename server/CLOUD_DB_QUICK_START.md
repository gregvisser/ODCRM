# ⚡ Quick Start: Cloud Database (5 Minutes)

## Step 1: Create Neon Account (Recommended)

1. **Go to:** https://neon.tech
2. **Click:** "Sign Up" (free)
3. **Create Project:**
   - Name: `odcrm`
   - Database: `defaultdb` (auto-created)
   - Region: Choose closest
   - Click "Create Project"

## Step 2: Get Connection String

After project creation:

1. You'll see **"Connection string"** on the dashboard
2. Click **"Copy"** or **"Connection Details"**
3. Look for format like:
   ```
   postgresql://username:password@ep-xxxxx.region.aws.neon.tech/neondb?sslmode=require
   ```

## Step 3: Update .env File

1. Open `server/.env`
2. Find the line: `DATABASE_URL=...`
3. Replace with your Neon connection string:
   ```env
   DATABASE_URL="your-neon-connection-string-here"
   ```
4. Save the file

## Step 4: Test & Setup Database

```bash
cd server

# Test connection
npx prisma db pull

# If successful, create tables
npx prisma migrate dev --name init

# Verify with Prisma Studio
npx prisma studio
```

## ✅ Done!

Your database is now:
- ✅ Cloud-hosted (works in production)
- ✅ Ready for migrations
- ✅ Production-ready

## 🚀 For Production Deployment

When deploying to hosting (Vercel, Railway, etc.):

1. Add environment variable: `DATABASE_URL`
2. Paste your Neon connection string
3. Deploy - it just works!

## 🔄 Alternative Cloud Providers

If you prefer:

**Supabase:** https://supabase.com
- Free tier: 500 MB
- More features (auth, storage)

**Railway:** https://railway.app
- Free tier: $5/month credit
- Simple setup

**ElephantSQL:** https://www.elephantsql.com
- Free tier: 20 MB
- Simple PostgreSQL hosting

All use the same connection string format - just update `DATABASE_URL` in `.env`!
