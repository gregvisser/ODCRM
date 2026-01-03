# Create Test Customer

Before connecting Outlook account, you need a Customer record in the database.

## Quick Method: Using Prisma Studio

1. Open Prisma Studio:
   ```bash
   cd server
   npx prisma studio
   ```

2. Browser opens at http://localhost:5555

3. Click on "Customer" model

4. Click "Add record" or "+" button

5. Fill in:
   - **id**: `test-customer-1`
   - **name**: `Test Customer`
   - **domain**: `bidlow.co.uk` (optional)
   - **createdAt**: (auto-filled)
   - **updatedAt**: (auto-filled)

6. Click "Save 1 change"

## Alternative: Using SQL

Connect to your Neon database and run:

```sql
INSERT INTO customers (id, name, domain, "createdAt", "updatedAt")
VALUES ('test-customer-1', 'Test Customer', 'bidlow.co.uk', NOW(), NOW());
```

## Alternative: Using API (after server is running)

Create a simple script or use curl:

```bash
# This would require an endpoint to create customers
# For now, use Prisma Studio (easiest)
```

## Verify Customer Exists

In Prisma Studio:
- Go to Customer model
- You should see `test-customer-1`

## Then Test OAuth

Once customer exists:
1. Visit: `http://localhost:3001/api/outlook/auth?customerId=test-customer-1`
2. Complete OAuth flow
3. Account will be saved to database
