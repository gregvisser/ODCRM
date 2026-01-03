# Next Steps - Setup Progress

## ✅ Completed
- [x] Dependencies installed
- [x] Prisma Client generated
- [x] .env file created

## 🔄 Current Step: Database Setup

### Step 1: Configure Database Connection

Edit `server/.env` and update the `DATABASE_URL`:

```env
DATABASE_URL="postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/odcrm?schema=public"
```

**Replace:**
- `YOUR_USER` - Your PostgreSQL username (usually `postgres`)
- `YOUR_PASSWORD` - Your PostgreSQL password
- `localhost:5432` - Change if PostgreSQL is on a different host/port
- `odcrm` - Database name (create it if it doesn't exist)

### Step 2: Create Database (if needed)

If the database doesn't exist, create it:

**Using psql:**
```bash
psql -U postgres
CREATE DATABASE odcrm;
\q
```

**Or using createdb:**
```bash
createdb -U postgres odcrm
```

### Step 3: Run Migrations

Once your database is set up and `.env` is configured:

```bash
cd server
npx prisma migrate dev --name init
```

This will:
- Create all database tables
- Set up indexes
- Create enums

### Step 4: Verify Database

Open Prisma Studio to view your database:

```bash
npx prisma studio
```

This opens a web interface at `http://localhost:5555` where you can:
- View all tables
- Create test data (like a Customer record)
- Verify migrations worked

## 🔄 After Database Setup: Azure Configuration

### Step 5: Set Up Azure App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **New registration**
4. Configure:
   - **Name**: `OpensDoors CRM`
   - **Redirect URI**: `http://localhost:3001/api/outlook/callback` (Platform: Web)
5. Click **Register**
6. Copy the **Application (client) ID**

7. **Create Client Secret:**
   - Go to **Certificates & secrets** > **New client secret**
   - Copy the **Value** immediately!

8. **Add API Permissions:**
   - Go to **API permissions** > **Add a permission** > **Microsoft Graph** > **Delegated permissions**
   - Add: `Mail.Send`, `Mail.Read`, `User.Read`, `offline_access`
   - Click **Grant admin consent**

9. **Update `server/.env`:**
   ```env
   MICROSOFT_CLIENT_ID=your-actual-client-id
   MICROSOFT_CLIENT_SECRET=your-actual-client-secret
   ```

## 🚀 Final Step: Start Servers

Once database and Azure are configured:

```bash
# From project root
npm run dev:all
```

Or separately:
```bash
# Terminal 1 - Frontend
npm run dev

# Terminal 2 - Backend
cd server
npm run dev
```

## 📝 Quick Reference

**Database Commands:**
```bash
cd server
npx prisma generate          # Generate Prisma Client
npx prisma migrate dev       # Run migrations
npx prisma studio            # Open database GUI
npx prisma db pull           # Pull schema from database
```

**Development:**
```bash
npm run dev:all              # Start both servers
npm run dev                  # Frontend only
cd server && npm run dev      # Backend only
```

## ❓ Need Help?

- See `START_HERE.md` for quick start guide
- See `SETUP_CHECKLIST.md` for detailed instructions
- See `EMAIL_CAMPAIGNS_SETUP.md` for usage guide
