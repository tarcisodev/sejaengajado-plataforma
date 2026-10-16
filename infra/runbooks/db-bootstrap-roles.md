# Bootstrap de roles Postgres (passo único, superuser)

`ALTER ROLE … BYPASSRLS` / `NOBYPASSRLS` **exige superuser**. As migrations Prisma
criam `se_app` / `se_admin` sem esses atributos; rode isto **uma vez** no Postgres
do Supabase (como `postgres` / superuser) antes ou logo após o primeiro
`prisma migrate deploy`.

Host Docker típico na VPS: `supabase_supabase_db` (rede `TarcisoDevNet`).

```sql
-- App: nunca bypassar RLS
ALTER ROLE se_app NOSUPERUSER NOBYPASSRLS;

-- Admin / SYSTEM / migrations: bypass RLS (FORCE RLS nas tabelas)
ALTER ROLE se_admin NOSUPERUSER BYPASSRLS;

-- Backup (role só leitura): bypass para dump completo sob FORCE RLS
-- Crie a role se ainda não existir, depois:
-- CREATE ROLE se_backup LOGIN PASSWORD '<offsite>' NOSUPERUSER NOCREATEDB NOCREATEROLE;
ALTER ROLE se_backup NOSUPERUSER BYPASSRLS;
GRANT CONNECT ON DATABASE sejaengajado TO se_backup;
GRANT USAGE ON SCHEMA public TO se_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO se_backup;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO se_backup;
```

Conferir:

```sql
SELECT rolname, rolsuper, rolbypassrls
FROM pg_roles
WHERE rolname IN ('se_app', 'se_admin', 'se_backup');
```

Esperado: `se_app.rolbypassrls = false`; `se_admin` e `se_backup` = `true`.

URLs nos secrets Swarm devem apontar o host para `supabase_supabase_db`
(ex.: `postgresql://se_app:…@supabase_supabase_db:5432/sejaengajado`).
