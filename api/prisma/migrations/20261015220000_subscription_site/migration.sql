-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN "site_id" UUID;

-- CreateIndex
CREATE INDEX "subscriptions_site_id_idx" ON "subscriptions"("site_id");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
