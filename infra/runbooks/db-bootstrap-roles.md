# Bootstrap de roles Postgres (passo único, superuser)

Migrations Prisma **não** embutem senha de role (`CREATE ROLE … PASSWORD` é proibido).
Crie/ajuste `se_app` / `se_admin` / `se_backup` aqui, com senha só a partir de secret
(stdin / manager do Swarm). Atlas rotaciona em produção.

`ALTER ROLE … BYPASSRLS` / `NOBYPASSRLS` **exige superuser**. Rode isto **uma vez**
no Postgres (como `postgres` / superuser) antes ou logo após o primeiro
`prisma migrate deploy`.

Host Docker típico na VPS: `supabase_supabase_db` (rede `TarcisoDevNet`).

## 1) Criar roles (se ainda não existem) e definir senha do secret

```bash
# Exemplo — senha NUNCA no histórico do shell; use stdin:
read -s -p 'se_app password: ' SE_APP_PW; echo
read -s -p 'se_admin password: ' SE_ADMIN_PW; echo

docker exec -i supabase_supabase_db psql -U postgres -d sejaengajado <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'se_app') THEN
    CREATE ROLE se_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'se_admin') THEN
    CREATE ROLE se_admin LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END
\$\$;
ALTER ROLE se_app WITH PASSWORD :'se_app_pw';
ALTER ROLE se_admin WITH PASSWORD :'se_admin_pw';
SQL
# Preferível: psql -v se_app_pw=... com variáveis, ou ALTER ROLE via script que lê o secret file.
```

Rotação (prod): gerar senha nova → `ALTER ROLE … PASSWORD` → atualizar secrets
`se_database_url_v1` / `se_admin_database_url_v1` → `docker service update --force sejaengajado_api`.

## 2) Atributos RLS

```sql
ALTER ROLE se_app NOSUPERUSER NOBYPASSRLS;
ALTER ROLE se_admin NOSUPERUSER BYPASSRLS;

-- Backup (role só leitura):
-- CREATE ROLE se_backup LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
-- ALTER ROLE se_backup WITH PASSWORD '<from-secret>';
ALTER ROLE se_backup NOSUPERUSER BYPASSRLS;
GRANT CONNECT ON DATABASE sejaengajado TO se_backup;
GRANT USAGE ON SCHEMA public TO se_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO se_backup;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO se_backup;
```

## 3) Conferir

```sql
SELECT rolname, rolsuper, rolbypassrls, rolcanlogin
FROM pg_roles
WHERE rolname IN ('se_app', 'se_admin', 'se_backup');
```

Esperado: `se_app.rolbypassrls = false`; `se_admin` e `se_backup` = `true`.

URLs nos secrets Swarm: `postgresql://se_app:…@supabase_supabase_db:5432/sejaengajado`.

## Checksum de migrations históricas

Se `prisma migrate deploy` reclamar que `20261015193000` / `20261015200000` mudaram
(remoção de `PASSWORD` no SQL), Atlas recalcula o checksum no `_prisma_migrations`
após revisar o diff — **não** reaplique a migration.
