# Create Production Customer

## Option 1: Using the Helper Script (Easiest)

Run the interactive customer creation script:

```bash
npm run deploy:create-customer
```

This will:
1. Connect to your Neon database
2. Prompt for customer details
3. Create the customer record
4. Show you the localStorage command to run

---

## Option 2: Using Prisma Studio (GUI)

Open Prisma Studio connected to your production database:

```bash
cd server
npx prisma studio --schema ../prisma/schema.prisma
```

Then in the browser:
1. Click **"Customer"** model in the left sidebar
2. Click **"+ Add record"** button
3. Fill in the fields:
   - **id**: `prod-customer-1` (or any unique ID)
   - **name**: `OpensDoors` (or your company name)
   - **domain**: Your domain (e.g., `yourdomain.com`)
   - Leave other fields as default or empty
4. Click **"Save 1 change"**

---

## Option 3: Using SQL (Advanced)

If you prefer SQL, run this in Neon SQL Editor or psql:

```sql
INSERT INTO customers (id, name, domain, "createdAt", "updatedAt")
VALUES (
  'prod-customer-1',
  'OpensDoors',
  'yourdomain.com',
  NOW(),
  NOW()
);
```

---

## After Creating Customer

Set the customer ID in your browser:

1. Visit your deployed frontend (when ready): `https://odcrm.vercel.app`
2. Open browser console (F12)
3. Run:
   ```javascript
   localStorage.setItem('currentCustomerId', 'prod-customer-1')
   ```
4. Refresh the page

---

## Verify Customer Created

Check in Prisma Studio or run:

```sql
SELECT * FROM customers;
```

Should show your new customer record.

---

**Recommended**: Use Option 1 (helper script) - it's the easiest!

Run: `npm run deploy:create-customer`
