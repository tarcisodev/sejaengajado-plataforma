-- Reseller Asaas customer id (created once, reused for invoices)
ALTER TABLE "resellers" ADD COLUMN "gateway_customer_id" TEXT;

-- Invoice due date for delinquency job
ALTER TABLE "reseller_invoices" ADD COLUMN "due_date" TIMESTAMPTZ(3);
