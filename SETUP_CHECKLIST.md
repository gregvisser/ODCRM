# Setup Checklist - Email Campaigns Module

Follow these steps in order to set up the Email Campaigns module.

## ✅ Step 1: Install Dependencies

### Backend
```bash
cd server
npm install
```

### Frontend (if not already done)
```bash
# From project root
npm install
```

## ✅ Step 2: PostgreSQL Database Setup

### Option A: Using PostgreSQL locally
1. **Install PostgreSQL** (if not installed):
   - Windows: Download from [postgresql.org](https://www.postgresql.org/download/windows/)
   - Mac: `brew install postgresql` or use Postgres.app
   - Linux: `sudo apt-get install postgresql` (Ubuntu/Debian)

2. **Create Database**:
   ```bash
   createdb odcrm
   ```
   
   Or using psql:
   ```bash
   psql -U postgres
   CREATE DATABASE odcrm;
   \q
   ```

### Option B: Using Docker
```bash
docker run --name odcrm-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=odcrm \
  -p 5432:5432 \
  -d postgres:15
```

### Configure Database Connection
1. Copy the example env file:
   ```bash
   cd server
   cp .env.example .env
   ```

2. Edit `server/.env` and update `DATABASE_URL`:
   ```env
   DATABASE_URL="postgresql://postgres:password@localhost:5432/odcrm?schema=public"
   ```
   
   Replace:
   - `postgres` with your PostgreSQL username
   - `password` with your PostgreSQL password
   - `localhost:5432` if using a different host/port
   - `odcrm` if you used a different database name

## ✅ Step 3: Run Database Migrations

```bash
cd server

# Generate Prisma Client
npx prisma generate

# Create and run migrations
npx prisma migrate dev --name init

# Optional: Open Prisma Studio to view database
npx prisma studio
```

This will:
- Create all database tables
- Set up indexes
- Create enums

**Expected output:**
```
✔ Generated Prisma Client
The following migration(s) have been created and applied from new schema changes:
  migration_name
```

## ✅ Step 4: Microsoft Azure App Registration

### 4.1 Create App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Sign in with your Microsoft account
3. Navigate to **Azure Active Directory** > **App registrations**
4. Click **+ New registration**

### 4.2 Configure App Registration

Fill in:
- **Name**: `OpensDoors CRM` (or any name)
- **Supported account types**: 
  - Select "Accounts in any organizational directory and personal Microsoft accounts"
  - Or "Accounts in this organizational directory only" if you only need work accounts
- **Redirect URI**:
  - Platform: `Web`
  - URI: `http://localhost:3001/api/outlook/callback`

5. Click **Register**

### 4.3 Get Client ID

After registration:
- Copy the **Application (client) ID** - you'll need this for `MICROSOFT_CLIENT_ID`

### 4.4 Create Client Secret

1. In your app registration, go to **Certificates & secrets**
2. Click **+ New client secret**
3. Add description: `Development Secret`
4. Set expiration (6 months, 12 months, or 24 months)
5. Click **Add**
6. **IMPORTANT**: Copy the **Value** immediately (you won't see it again!)
   - This is your `MICROSOFT_CLIENT_SECRET`

### 4.5 Configure API Permissions

1. Go to **API permissions**
2. Click **+ Add a permission**
3. Select **Microsoft Graph**
4. Select **Delegated permissions**
5. Add these permissions:
   - `Mail.Send` - Send emails on behalf of users
   - `Mail.Read` - Read user mailboxes
   - `User.Read` - Sign in and read user profile
   - `offline_access` - Maintain access to data (required for refresh tokens)

6. Click **Add permissions**

7. **Grant admin consent**:
   - Click **Grant admin consent for [Your Organization]**
   - Click **Yes** to confirm

### 4.6 Update Environment Variables

Edit `server/.env`:

```env
MICROSOFT_CLIENT_ID=your-actual-client-id-here
MICROSOFT_CLIENT_SECRET=your-actual-client-secret-here
MICROSOFT_TENANT_ID=common
REDIRECT_URI=http://localhost:3001/api/outlook/callback
```

**Note**: 
- `MICROSOFT_TENANT_ID=common` allows both personal and work Microsoft accounts
- For work accounts only, use your tenant ID from Azure AD

## ✅ Step 5: Configure Environment Variables

Ensure `server/.env` has all required variables:

```env
# Database (update with your credentials)
DATABASE_URL="postgresql://postgres:password@localhost:5432/odcrm?schema=public"

# Server
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Microsoft Graph (from Step 4)
MICROSOFT_CLIENT_ID=your-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret
MICROSOFT_TENANT_ID=common
REDIRECT_URI=http://localhost:3001/api/outlook/callback

# Email Tracking
EMAIL_TRACKING_DOMAIN=http://localhost:3001
```

## ✅ Step 6: Verify Setup

### Test Database Connection
```bash
cd server
npx prisma db pull
```

Should complete without errors.

### Test Server Startup
```bash
cd server
npm run dev
```

You should see:
```
🚀 Server running on port 3001
📧 Starting email scheduler...
✅ Email scheduler started (runs every minute)
📬 Starting reply detection worker...
✅ Reply detection worker started (runs every 5 minutes)
```

Press `Ctrl+C` to stop.

## ✅ Step 7: Start Development Servers

### Option A: Start Both Servers Together
```bash
# From project root
npm run dev:all
```

This starts:
- Frontend on `http://localhost:5173`
- Backend on `http://localhost:3001`

### Option B: Start Servers Separately

**Terminal 1 - Frontend:**
```bash
npm run dev
```

**Terminal 2 - Backend:**
```bash
cd server
npm run dev
```

## ✅ Step 8: Set Customer Context (For Testing)

The app requires a `customerId` for multi-tenancy. Set it in browser console:

1. Open your browser at `http://localhost:5173`
2. Open Developer Console (F12)
3. Run:
   ```javascript
   localStorage.setItem('currentCustomerId', 'test-customer-id')
   ```
4. Refresh the page

**Note**: In production, this would come from authentication. For now, you can:
- Create a Customer record in the database
- Use Prisma Studio: `cd server && npx prisma studio`
- Or create via API after setting up authentication

## ✅ Step 9: Create Test Customer (Optional)

If you want to test immediately, create a customer in the database:

**Using Prisma Studio:**
```bash
cd server
npx prisma studio
```

Then:
1. Go to `Customer` model
2. Click "Add record"
3. Add:
   - `id`: `test-customer-1`
   - `name`: `Test Customer`
   - `domain`: `example.com` (optional)

**Using SQL:**
```sql
INSERT INTO customers (id, name, domain, "createdAt", "updatedAt")
VALUES ('test-customer-1', 'Test Customer', 'example.com', NOW(), NOW());
```

Then set in browser:
```javascript
localStorage.setItem('currentCustomerId', 'test-customer-1')
```

## ✅ Step 10: Test Outlook Connection

1. Navigate to the Email Campaigns section
2. Look for "Connect Outlook Account" or go to Settings
3. Click the button - you should be redirected to Microsoft login
4. Sign in and grant permissions
5. You'll be redirected back and the account should be connected

## Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running: `pg_isready` or check services
- Check `DATABASE_URL` in `.env` matches your PostgreSQL setup
- Test connection: `psql -U postgres -d odcrm`

### Migration Issues
- Ensure Prisma Client is generated: `npx prisma generate`
- Reset database (WARNING: deletes all data): `npx prisma migrate reset`

### Azure OAuth Issues
- Verify redirect URI matches exactly: `http://localhost:3001/api/outlook/callback`
- Check admin consent is granted
- Verify client secret hasn't expired
- Check client ID is correct in `.env`

### Port Already in Use
- Change `PORT` in `server/.env`
- Or stop the process using port 3001/5173

## Next Steps

Once setup is complete:
1. ✅ Connect an Outlook account
2. ✅ Create test contacts
3. ✅ Create your first email campaign
4. ✅ Test sending emails

See `EMAIL_CAMPAIGNS_SETUP.md` for detailed usage instructions.
