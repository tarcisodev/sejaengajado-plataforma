-- SEC-GOLIVE (expand-only):
-- - revoke TRUNCATE from se_app (se_admin stays full for prisma migrate deploy)
-- - add unique index (reseller_id, email); keep customers_email_key until a later release
-- Role passwords: never change here — rotate via infra/runbooks/db-bootstrap-roles.md

-- 1) se_app: no TRUNCATE (existing tables + future defaults)
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM se_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE TRUNCATE ON TABLES FROM se_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO se_app;

-- 2) customers.email unique per reseller (expand: new index only)
-- Dedupe first: keep oldest row per (reseller_id, lower(email)); clear email on losers.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY reseller_id, lower(email)
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM customers
  WHERE email IS NOT NULL AND btrim(email) <> ''
)
UPDATE customers AS c
SET email = NULL
FROM ranked r
WHERE c.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "customers_reseller_id_email_key"
  ON "customers" ("reseller_id", lower("email"))
  WHERE "email" IS NOT NULL AND btrim("email") <> '';
