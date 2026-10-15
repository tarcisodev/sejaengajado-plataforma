-- AlterEnum: WebhookStatus + PROCESSING
ALTER TYPE "WebhookStatus" ADD VALUE 'PROCESSING';

-- Payment ↔ Asaas payment id (reconsulta no webhook)
ALTER TABLE "payments" ADD COLUMN "gateway_payment_id" TEXT;
CREATE UNIQUE INDEX "payments_gateway_payment_id_key" ON "payments"("gateway_payment_id");

-- Invoice ↔ Asaas payment id (chargeback → OVERDUE)
ALTER TABLE "reseller_invoices" ADD COLUMN "gateway_payment_id" TEXT;
CREATE UNIQUE INDEX "reseller_invoices_gateway_payment_id_key" ON "reseller_invoices"("gateway_payment_id");

-- Webhook processing metadata
ALTER TABLE "webhook_events" ADD COLUMN "last_error" TEXT;
ALTER TABLE "webhook_events" ADD COLUMN "processed_at" TIMESTAMPTZ(3);
