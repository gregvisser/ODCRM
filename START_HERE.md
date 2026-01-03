# 🚀 Quick Start Guide - Email Campaigns Module

## Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] PostgreSQL installed and running
- [ ] Microsoft Azure account (for Outlook OAuth)

## Step-by-Step Setup

### 1️⃣ Install Dependencies

```bash
# Backend
cd server
npm install

# Frontend (from project root)
cd ..
npm install
```

### 2️⃣ Configure Database

1. **Create PostgreSQL database:**
   ```bash
   createdb odcrm
   ```
   Or using psql:
   ```sql
   CREATE DATABASE odcrm;
   ```

2. **Set up environment file:**
   ```bash
   cd server
   cp env.example .env
   ```

3. **Edit `server/.env`** and update:
   ```env
   DATABASE_URL="postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/odcrm?schema=public"
   ```

### 3️⃣ Run Database Migrations

```bash
cd server
npx prisma generate
npx prisma migrate dev --name init
```

This creates all database tables. You should see:
```
✔ Generated Prisma Client
✔ Applied migration
```

### 4️⃣ Azure App Registration Setup

1. Go to [Azure Portal](https://portal.azure.com)
2. **Azure Active Directory** > **App registrations** > **New registration**
3. Fill in:
   - Name: `OpensDoors CRM`
   - Redirect URI: `http://localhost:3001/api/outlook/callback` (Platform: Web)
4. Click **Register**
5. Copy the **Application (client) ID**

6. **Create Client Secret:**
   - Go to **Certificates & secrets** > **New client secret**
   - Copy the **Value** immediately (won't see it again!)

7. **Add API Permissions:**
   - Go to **API permissions** > **Add a permission** > **Microsoft Graph** > **Delegated permissions**
   - Add: `Mail.Send`, `Mail.Read`, `User.Read`, `offline_access`
   - Click **Grant admin consent**

8. **Update `server/.env`:**
   ```env
   MICROSOFT_CLIENT_ID=your-client-id-from-azure
   MICROSOFT_CLIENT_SECRET=your-client-secret-from-azure
   MICROSOFT_TENANT_ID=common
   REDIRECT_URI=http://localhost:3001/api/outlook/callback
   ```

### 5️⃣ Start Development Servers

**Option A: Both servers together (recommended)**
```bash
# From project root
npm run dev:all
```

**Option B: Separate terminals**
```bash
# Terminal 1 - Frontend
npm run dev

# Terminal 2 - Backend  
cd server
npm run dev
```

You should see:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`
- Email scheduler started
- Reply detection worker started

### 6️⃣ Set Customer Context

The app requires a `customerId` for multi-tenancy. Set it in browser console:

1. Open `http://localhost:5173`
2. Press `F12` to open Developer Console
3. Run:
   ```javascript
   localStorage.setItem('currentCustomerId', 'test-customer-1')
   ```
4. Refresh the page

**To create a customer:**
- Use Prisma Studio: `cd server && npx prisma studio`
- Or insert directly in database (see SETUP_CHECKLIST.md)

### 7️⃣ Test the Setup

1. ✅ Navigate to **Marketing** > **Email campaigns**
2. ✅ Connect an Outlook account
3. ✅ Create your first campaign

## Common Issues

### Database Connection Failed
- Check PostgreSQL is running: `pg_isready`
- Verify `DATABASE_URL` in `server/.env`
- Test: `psql -U postgres -d odcrm`

### Azure OAuth Not Working
- Verify redirect URI matches exactly
- Check admin consent is granted
- Ensure client secret hasn't expired

### Prisma Commands Fail
- Make sure you're in the `server` directory
- Run `npx prisma generate` first

## Need More Help?

- 📖 See `SETUP_CHECKLIST.md` for detailed step-by-step guide
- 📖 See `EMAIL_CAMPAIGNS_SETUP.md` for usage instructions
- 📖 See `IMPLEMENTATION_SUMMARY.md` for technical details

## Quick Commands Reference

```bash
# Database
cd server
npx prisma generate          # Generate Prisma Client
npx prisma migrate dev       # Create/run migrations
npx prisma studio            # Open database GUI

# Development
npm run dev:all              # Start both servers
npm run dev                  # Frontend only
cd server && npm run dev     # Backend only
```

---

**Ready to go? Start with Step 1 above!** 🎉
