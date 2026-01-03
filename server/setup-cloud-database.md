# Cloud Database Setup (Production Ready)

## Why Cloud Database?

✅ **Works in production hosting** (Vercel, Railway, Render, etc.)  
✅ **No infrastructure management**  
✅ **Built-in backups and scaling**  
✅ **Same connection locally and in production**  
✅ **Free tier available**

## Recommended: Neon (Serverless PostgreSQL)

**Why Neon:**
- Serverless PostgreSQL (auto-scales)
- Free tier: 3 projects, 0.5 GB storage
- Works perfectly with Prisma
- Production-ready
- Easy connection string

### Quick Setup (5 minutes):

1. **Sign up for free:** https://neon.tech
2. **Create a project:**
   - Click "Create Project"
   - Name: `odcrm`
   - Region: Choose closest to you
   - Click "Create Project"

3. **Get connection string:**
   - After project creation, you'll see "Connection string"
   - Copy the connection string (looks like: `postgresql://user:pass@host.neon.tech/dbname`)

4. **Update `.env` file:**
   - Open `server/.env`
   - Replace `DATABASE_URL` with your Neon connection string
   - Save the file

5. **Done!** Ready to run migrations.

## Alternative: Supabase

**Why Supabase:**
- PostgreSQL with additional features
- Free tier: 500 MB database, 2 GB bandwidth
- Built-in dashboard

### Setup:
1. Sign up: https://supabase.com
2. Create project
3. Go to Settings → Database
4. Copy connection string (URI format)
5. Update `.env` with connection string

## Alternative: Railway

**Why Railway:**
- Simple PostgreSQL hosting
- Free tier: $5 credit/month
- One-click setup

### Setup:
1. Sign up: https://railway.app
2. New Project → Add PostgreSQL
3. Copy connection string from Variables tab
4. Update `.env` with connection string

## Update .env File

Once you have your connection string, update `server/.env`:

```env
DATABASE_URL="your-cloud-connection-string-here"
```

## Test Connection

```bash
cd server
npx prisma db pull
```

If it works, your connection is configured correctly!

## For Production Deployment

When deploying to Vercel/Railway/Render:

1. Add `DATABASE_URL` as environment variable
2. Use your cloud database connection string
3. No additional setup needed - it just works!

## Next Steps After Cloud DB Setup

1. ✅ Connection string in `.env`
2. ✅ Run migrations: `npx prisma migrate dev --name init`
3. ✅ Verify: `npx prisma studio`
4. ✅ Deploy - works automatically!
