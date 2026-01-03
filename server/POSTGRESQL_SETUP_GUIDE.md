# PostgreSQL Setup Guide

## Current Status

It appears PostgreSQL might not be installed or not in your system PATH. Here's how to set it up:

## Option 1: Install PostgreSQL (Recommended)

### Download & Install

1. **Download PostgreSQL:**
   - Go to: https://www.postgresql.org/download/windows/
   - Click "Download the installer"
   - Choose latest version (15, 16, or 17)
   - Download the installer

2. **Run the Installer:**
   - Run the downloaded `.exe` file
   - Follow the installation wizard
   - **IMPORTANT:** Remember the password you set for the `postgres` superuser!
   - Default settings are usually fine
   - Make sure "Command Line Tools" is selected

3. **During Installation, Note:**
   - **Port:** Usually `5432` (default)
   - **Superuser:** `postgres`
   - **Password:** The one you set (WRITE THIS DOWN!)

4. **After Installation:**
   - pgAdmin will be installed (GUI tool)
   - PostgreSQL service will start automatically
   - Command line tools will be available

### Verify Installation

```powershell
# Check if service is running
Get-Service | Where-Object { $_.Name -like "*postgres*" }

# Try to connect (will prompt for password)
psql -U postgres
```

## Option 2: Use Docker (Alternative)

If you prefer Docker:

```bash
docker run --name odcrm-postgres `
  -e POSTGRES_PASSWORD=password `
  -e POSTGRES_DB=odcrm `
  -p 5432:5432 `
  -d postgres:15

# Then use:
DATABASE_URL="postgresql://postgres:password@localhost:5432/odcrm?schema=public"
```

## Option 3: Use Cloud Database (Alternative)

You can use a free cloud PostgreSQL service:

### Options:
- **Supabase:** https://supabase.com (free tier)
- **Neon:** https://neon.tech (free tier)
- **Railway:** https://railway.app (free tier)
- **ElephantSQL:** https://www.elephantsql.com (free tier)

**For cloud databases:**
- Get connection string from the provider
- It will look like: `postgresql://user:pass@host:5432/dbname`
- Use that as your `DATABASE_URL`

## After Installation: Next Steps

### 1. Start PostgreSQL Service (if stopped)

```powershell
# Check service status
Get-Service | Where-Object { $_.Name -like "*postgres*" }

# Start service (if stopped)
Start-Service -Name "postgresql-x64-[version]"
```

### 2. Test Connection

```bash
psql -U postgres
```

Enter your password. If it connects, you're ready!

### 3. Create Database

Once connected:
```sql
CREATE DATABASE odcrm;
\q
```

Or from command line:
```bash
createdb -U postgres odcrm
```

### 4. Update .env File

Edit `server/.env`:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/odcrm?schema=public"
```

Replace `YOUR_PASSWORD` with the password you set during installation.

### 5. Test with Prisma

```bash
cd server
npx prisma db pull
```

If this works, your connection is configured correctly!

## Finding Your Password

### If you forgot your password:

1. **Check pgAdmin:**
   - Open pgAdmin
   - Try to connect - password might be saved

2. **Check installation notes:**
   - Look for any files created during installation
   - Check if you saved it anywhere

3. **Reset password:**
   - See: https://www.postgresql.org/docs/current/auth-pg-hba-conf.html
   - Or reinstall PostgreSQL (simple but loses data)

## Quick Reference

**Default PostgreSQL Settings:**
- Username: `postgres`
- Port: `5432`
- Host: `localhost`
- Password: (The one you set during install)

**Example DATABASE_URL:**
```
postgresql://postgres:MyPassword123@localhost:5432/odcrm?schema=public
```

## Need Help?

- PostgreSQL docs: https://www.postgresql.org/docs/
- Windows installation guide: https://www.postgresql.org/download/windows/
- pgAdmin docs: https://www.pgadmin.org/docs/
