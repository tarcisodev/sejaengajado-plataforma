-- B3: FORCE RLS + policies + se_admin for ADMIN connection.
-- Atributo BYPASSRLS (se_admin / se_backup) e NOBYPASSRLS (se_app) exigem
-- superuser — aplicar uma vez via infra/runbooks/db-bootstrap-roles.md.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'se_admin') THEN
    -- Sem senha no SQL: senha vem do bootstrap/secret (infra/runbooks/db-bootstrap-roles.md).
    CREATE ROLE se_admin LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO se_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO se_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO se_admin;
GRANT SELECT ON plaque_stock TO se_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO se_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO se_admin;

CREATE OR REPLACE FUNCTION app_reseller_id() RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.reseller_id', true), '')::uuid;
$$;

REVOKE ALL ON FUNCTION app_reseller_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_reseller_id() TO se_app, se_admin;

-- Direct reseller_id columns
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'customers',
    'sites',
    'plaques',
    'wholesale_prices',
    'reseller_prices',
    'sales',
    'ledger_entries',
    'plaque_movements',
    'reseller_invoices',
    'lifecycle_events',
    'orders',
    'payments',
    'subscriptions',
    'users'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         FOR ALL
         TO se_app
         USING (reseller_id = app_reseller_id())
         WITH CHECK (reseller_id = app_reseller_id())',
      tbl
    );
  END LOOP;
END
$$;

-- Nested: sale_items → sales
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON sale_items;
CREATE POLICY tenant_isolation ON sale_items
  FOR ALL
  TO se_app
  USING (
    EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_items.sale_id
        AND s.reseller_id = app_reseller_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_items.sale_id
        AND s.reseller_id = app_reseller_id()
    )
  );

-- Nested: invoice_lines → reseller_invoices
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON invoice_lines;
CREATE POLICY tenant_isolation ON invoice_lines
  FOR ALL
  TO se_app
  USING (
    EXISTS (
      SELECT 1 FROM reseller_invoices i
      WHERE i.id = invoice_lines.invoice_id
        AND i.reseller_id = app_reseller_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM reseller_invoices i
      WHERE i.id = invoice_lines.invoice_id
        AND i.reseller_id = app_reseller_id()
    )
  );

-- Nested: scan_events → sites
ALTER TABLE scan_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON scan_events;
CREATE POLICY tenant_isolation ON scan_events
  FOR ALL
  TO se_app
  USING (
    EXISTS (
      SELECT 1 FROM sites s
      WHERE s.id = scan_events.site_id
        AND s.reseller_id = app_reseller_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sites s
      WHERE s.id = scan_events.site_id
        AND s.reseller_id = app_reseller_id()
    )
  );
