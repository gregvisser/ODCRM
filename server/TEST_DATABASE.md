# Testing Your Database Connection

## Quick Test Commands

### Test 1: Check if PostgreSQL Port is Open

```powershell
Test-NetConnection -ComputerName localhost -Port 5432
```

If successful, PostgreSQL service is running.

### Test 2: Try to Connect with psql

```bash
psql -U postgres
```

You'll be prompted for password. If it connects:
- ✅ Username: `postgres` works
- ✅ Password: The one you entered
- ✅ Connection works!

### Test 3: List Existing Databases

Once connected:
```sql
\l
\q
```

This shows all databases. We'll create `odcrm` if it doesn't exist.

### Test 4: Create the Database

If `odcrm` doesn't exist:

```sql
CREATE DATABASE odcrm;
```

### Test 5: Test with Prisma

Once `.env` is configured:

```bash
cd server
npx prisma db pull
```

This will test your DATABASE_URL connection.

## Common Issues & Solutions

### Issue: "psql: command not found"
**Solution:**
- PostgreSQL not installed OR not in PATH
- Add PostgreSQL bin to PATH: `C:\Program Files\PostgreSQL\[version]\bin`

### Issue: "password authentication failed"
**Solutions:**
1. Check if you're using the correct password
2. Try your Windows username instead of 'postgres'
3. Check pgAdmin for saved credentials
4. Reset password if needed

### Issue: "could not connect to server"
**Solutions:**
1. Check if PostgreSQL service is running:
   - Services app → Find "postgresql-x64-[version]"
   - Right-click → Start (if stopped)
2. Check if firewall is blocking port 5432
3. Verify PostgreSQL is installed

### Issue: "database 'odcrm' does not exist"
**Solution:**
```sql
CREATE DATABASE odcrm;
```

## Next Steps After Testing

Once connection works:

1. ✅ Update `server/.env` with correct DATABASE_URL
2. ✅ Create `odcrm` database
3. ✅ Run migrations: `npx prisma migrate dev --name init`
4. ✅ Verify with Prisma Studio: `npx prisma studio`
