-- Allow draft campaigns without sender identity
ALTER TABLE "email_campaigns" ALTER COLUMN "sender_identity_id" DROP NOT NULL;

-- Store raw sheet rows per contact and snapshot list
CREATE TABLE "contact_source_rows" (
  "id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "contact_id" TEXT NOT NULL,
  "list_id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "sheet_name" TEXT NOT NULL,
  "sheet_row_number" INTEGER NOT NULL,
  "raw_data" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "contact_source_rows_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contact_source_rows_customer_id_idx" ON "contact_source_rows"("customer_id");
CREATE INDEX "contact_source_rows_list_id_idx" ON "contact_source_rows"("list_id");
CREATE INDEX "contact_source_rows_contact_id_idx" ON "contact_source_rows"("contact_id");

ALTER TABLE "contact_source_rows" ADD CONSTRAINT "contact_source_rows_contact_id_fkey"
  FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contact_source_rows" ADD CONSTRAINT "contact_source_rows_list_id_fkey"
  FOREIGN KEY ("list_id") REFERENCES "contact_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contact_source_rows" ADD CONSTRAINT "contact_source_rows_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
