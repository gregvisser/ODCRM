-- Add monthly revenue from customer field
-- This tracks how much revenue ODCRM makes from this customer monthly
ALTER TABLE "customers" ADD COLUMN "monthly_revenue_from_customer" DECIMAL(10,2);
