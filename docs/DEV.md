# Desenvolvimento local — auth (GoTrue + Mailpit)

Fluxo para entrar em `http://app.localhost:4200/entrar` **sem** usar o auth de produção.

**Regra:** `SUPABASE_URL` no localhost é sempre `http://localhost:9999`. Nunca `https://auth.sejaengajado.com.br`.

## 1. Segredos de dev (uma vez)

Na raiz do monorepo:

```bash
cp .env.local.example .env.local
node scripts/dev-auth.mjs init
```

Isso gera (só em disco local, fora do git):

- `.env.local` — `SUPABASE_JWT_SECRET`, anon/service_role JWTs
- `web/public/se-public-config.json` — lido pelo browser (`supabaseUrl` → GoTrue local)
- `api/.env` + `.local/dev-secrets/*` — mesma JWT secret na API

## 2. Subir Postgres + GoTrue + Mailpit

```bash
docker compose -f docker-compose.dev.yml --env-file .env.local up -d
```

| Serviço | URL |
| --- | --- |
| Mailpit (OTP) | http://localhost:8025 |
| GoTrue (via gateway) | http://localhost:9999/auth/v1 |
| Postgres | `localhost:5432` user/pass `postgres` / `local-dev-only` (DB `sejaengajado`) |

Health: `curl -fsS http://localhost:9999/health`

## 3. API — migrate, roles, seed

```bash
cd api
npm ci

# 1ª vez: migrate com o superuser do compose
# PowerShell:
$env:DATABASE_URL="postgresql://postgres:local-dev-only@127.0.0.1:5432/sejaengajado"
# bash: export DATABASE_URL=postgresql://postgres:local-dev-only@127.0.0.1:5432/sejaengajado
npx prisma migrate deploy

# BYPASSRLS (precisa superuser; uma vez por volume)
docker compose -f ../docker-compose.dev.yml --env-file ../.env.local exec postgres `
  psql -U postgres -d sejaengajado `
  -c "ALTER ROLE se_admin WITH BYPASSRLS; ALTER ROLE se_app WITH NOBYPASSRLS;"

# Usa api/.env gerado (se_app / se_admin) — limpe DATABASE_URL da shell se sobrou o superuser
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
npx prisma db seed

cd ..
node scripts/dev-auth.mjs seed-admin
```


O `seed-admin` cria `tarcisojun@gmail.com` no GoTrue (`DISABLE_SIGNUP=true`) e na tabela `users` como **ADMIN**.

## 4. Subir API e web

```bash
# terminal 1
cd api && npm run start:dev
# se não houver start:dev: npx nest start --watch  ou  npm run build && npm start

# terminal 2
cd web && npm ci && npx ng serve --host 127.0.0.1 --port 4200
```

Abra **http://app.localhost:4200/entrar** (host `app.` ativa o painel).

1. Informe `tarcisojun@gmail.com` → **Receber código**
2. Abra http://localhost:8025 → abra o e-mail → copie o OTP de 6 dígitos
3. Cole no formulário e entre

ADMIN exige MFA (`aal2`) nas rotas `/admin/*`: na primeira vez, em `/mfa`, enroll TOTP no autenticador.

## O que o web usa

- `environment.development.ts` → `apiUrl: '/api'` (proxy → Nest `:3000`)
- `web/public/se-public-config.json` → `supabaseUrl: http://localhost:9999` + anon key
- API valida JWT HS256 com o **mesmo** `SUPABASE_JWT_SECRET` do GoTrue (`iss` = `http://localhost:9999/auth/v1`)

## Troubleshooting

| Sintoma | Causa provável |
| --- | --- |
| "Supabase indisponível" | Falta `se-public-config.json` → rode `node scripts/dev-auth.mjs init` e reinicie o `ng serve` |
| OTP não chega | Mailpit em :8025; GoTrue healthy; e-mail precisa existir (`seed-admin`) |
| 403 AUTH_NOT_INVITED | Usuário no GoTrue sem linha em `users` → `seed-admin` de novo |
| 401 na API | `api/.env` com JWT secret diferente do compose → `init` de novo e reinicie API + `docker compose ... up -d --force-recreate gotrue` |
| Signup bloqueado | Esperado (`GOTRUE_DISABLE_SIGNUP=true`); só entra quem foi criado via admin API |
| GoTrue exit 1 / `role "postgres"` / `auth.factor_type` | Volume antigo: `docker compose -f docker-compose.dev.yml --env-file .env.local down -v` e suba de novo (user DB = `postgres`, URL com `search_path=auth`) |

## Comandos úteis

```bash
node scripts/dev-auth.mjs init
node scripts/dev-auth.mjs seed-admin
docker compose -f docker-compose.dev.yml --env-file .env.local logs -f gotrue
docker compose -f docker-compose.dev.yml --env-file .env.local down
```
