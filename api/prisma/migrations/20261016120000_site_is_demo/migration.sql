-- Expand: flag demo em sites (não entra em cobrança/métricas).
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "is_demo" BOOLEAN NOT NULL DEFAULT false;
