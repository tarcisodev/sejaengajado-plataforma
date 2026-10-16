-- SEC-GOLIVE: revoke TRUNCATE from se_app; tighten se_admin table grants;
-- customer email unique per reseller (dedupe existing).

-- 1) se_app: no TRUNCATE (existing + default privileges)
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM se_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE TRUNCATE ON TABLES FROM se_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO se_app;

-- 2) se_admin: drop ALL, grant DML (+ sequence use) needed for migrations/admin
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM se_admin;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM se_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM se_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM se_admin;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO se_admin;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO se_admin;
GRANT SELECT ON plaque_stock TO se_admin;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO se_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO se_admin;

-- 3) customers.email: unique per reseller (not global)
-- Dedupe: keep oldest row per (reseller_id, lower(email)); clear email on losers.
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

DROP INDEX IF EXISTS "customers_email_key";

CREATE UNIQUE INDEX IF NOT EXISTS "customers_reseller_id_email_key"
  ON "customers" ("reseller_id", lower("email"))
  WHERE "email" IS NOT NULL AND btrim("email") <> '';
