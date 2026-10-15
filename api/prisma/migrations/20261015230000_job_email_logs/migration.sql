-- CreateTable
CREATE TABLE "job_email_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reseller_id" UUID NOT NULL,
    "band" TEXT NOT NULL,
    "local_date" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_email_logs_reseller_id_band_local_date_key" ON "job_email_logs"("reseller_id", "band", "local_date");

-- CreateIndex
CREATE INDEX "job_email_logs_local_date_idx" ON "job_email_logs"("local_date");

-- AddForeignKey
ALTER TABLE "job_email_logs" ADD CONSTRAINT "job_email_logs_reseller_id_fkey" FOREIGN KEY ("reseller_id") REFERENCES "resellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS: jobs write via se_admin (BYPASSRLS); se_app has no policy → deny.
ALTER TABLE "job_email_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "job_email_logs" FORCE ROW LEVEL SECURITY;
