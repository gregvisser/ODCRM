# How to Find Your PostgreSQL Database Credentials

## 🔍 Finding Your PostgreSQL Information

### Option 1: Check if PostgreSQL is Installed

**Windows:**
- Look for "PostgreSQL" in Start Menu
- Check if it's running: Services app → look for "postgresql" service
- Default installation location: `C:\Program Files\PostgreSQL\[version]`

**Common Installations:**
- PostgreSQL 15, 16, etc.
- pgAdmin (GUI tool) - if you have this, PostgreSQL is installed

### Option 2: Find Your PostgreSQL Username

**Default usernames:**
- `postgres` - Default superuser (most common)
- Your Windows username - Sometimes used during installation
- Custom username - If you created one during setup

**To check:**
1. Open Command Prompt or PowerShell
2. Try to connect: `psql -U postgres`
3. If that doesn't work, try: `psql -U YOUR_WINDOWS_USERNAME`

### Option 3: Find/Reset Your Password

**If you remember:**
- Use the password you set during PostgreSQL installation
- Check your installation notes or password manager

**If you forgot:**
- **Option A**: Reset via pgAdmin
  1. Open pgAdmin
  2. Right-click on server → Properties → Connection tab
  3. View or change password

- **Option B**: Reset via Windows Services
  1. Open Services (services.msc)
  2. Find "postgresql" service
  3. Stop the service
  4. Edit `pg_hba.conf` file (usually in `C:\Program Files\PostgreSQL\[version]\data\`)
  5. Change authentication method temporarily
  6. Restart service and reset password

- **Option C**: Use default/blank password (if set during install)
  - Some installations allow blank password for local connections

### Option 4: Find PostgreSQL Port

**Default port:** `5432`

**To check:**
1. Open pgAdmin → Server Properties
2. Or check `postgresql.conf` file
3. Look for `port = 5432`

### Option 5: Test Connection

Try connecting to PostgreSQL:

```bash
# Test with default postgres user
psql -U postgres -h localhost -p 5432

# If prompted for password, enter your PostgreSQL password
# If it connects, you'll see: postgres=#
```

**If connection works:**
- Username: `postgres` (or whatever worked)
- Password: The one you entered
- Host: `localhost`
- Port: `5432`

**If connection fails:**
- PostgreSQL might not be installed
- Service might not be running
- Credentials might be incorrect

## 📝 Building Your DATABASE_URL

Once you have your information, format it like this:

```
postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE?schema=SCHEMA
```

**Example:**
```
postgresql://postgres:MyPassword123@localhost:5432/odcrm?schema=public
```

**Components:**
- `postgresql://` - Protocol
- `postgres` - Username
- `MyPassword123` - Password
- `localhost` - Host
- `5432` - Port
- `odcrm` - Database name (we'll create this)
- `schema=public` - Schema name (usually 'public')

## 🚀 Quick Setup Guide

### Step 1: Test PostgreSQL Connection

```bash
psql -U postgres
```

If this works, you're good to go!

### Step 2: Create the Database

Once connected to PostgreSQL:

```sql
CREATE DATABASE odcrm;
\q
```

Or from command line:

```bash
createdb -U postgres odcrm
```

### Step 3: Update .env File

Edit `server/.env`:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/odcrm?schema=public"
```

Replace `YOUR_PASSWORD` with your actual password.

### Step 4: Test Connection

```bash
cd server
npx prisma db pull
```

If this works without errors, your connection is configured correctly!

## 🆘 Troubleshooting

### "psql: command not found"
- PostgreSQL might not be installed
- Or PostgreSQL bin directory not in PATH
- Solution: Install PostgreSQL or add to PATH

### "password authentication failed"
- Wrong password
- Solution: Try resetting password or check installation notes

### "could not connect to server"
- PostgreSQL service not running
- Solution: Start PostgreSQL service in Windows Services

### "database does not exist"
- Database `odcrm` hasn't been created yet
- Solution: Create database (see Step 2 above)

## 💡 Alternative: Install PostgreSQL

If PostgreSQL isn't installed:

1. **Download:** https://www.postgresql.org/download/windows/
2. **Install:** Run installer, remember the password you set!
3. **Default settings:**
   - Username: `postgres`
   - Port: `5432`
   - Password: (the one you set during install)

## 📚 Need More Help?

- Check PostgreSQL documentation: https://www.postgresql.org/docs/
- pgAdmin GUI: If installed, use it to view connection details
- Check installation logs for credentials you set during install
