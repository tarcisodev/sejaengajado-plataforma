-- AlterTable
ALTER TABLE "coupons" ADD COLUMN "valid_from" TIMESTAMPTZ(3),
ADD COLUMN "valid_to" TIMESTAMPTZ(3),
ADD COLUMN "max_uses" INTEGER,
ADD COLUMN "used_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "coupons" ADD CONSTRAINT "coupons_value_nonnegative" CHECK ("value" >= 0);
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_used_count_nonnegative" CHECK ("used_count" >= 0);
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_max_uses_positive" CHECK ("max_uses" IS NULL OR "max_uses" > 0);
