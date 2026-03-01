-- AlterTable: Stage 1B - add sentAt to outbound_send_queue_items (set when status=SENT)
ALTER TABLE "outbound_send_queue_items" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);
