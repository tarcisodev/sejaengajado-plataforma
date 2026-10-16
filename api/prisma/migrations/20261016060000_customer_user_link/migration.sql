-- Expand: link Customer ↔ User for customer self-service (nullable; backfill later).
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "user_id" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "customers_email_key" ON "customers"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "customers_user_id_key" ON "customers"("user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customers_user_id_fkey'
  ) THEN
    ALTER TABLE "customers"
      ADD CONSTRAINT "customers_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
