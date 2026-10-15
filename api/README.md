# API

Esqueleto NestJS 11. Prefixo `/api`, sem CORS. A config usa zod e aceita segredo em arquivo (`NOME_FILE` vira `NOME`).

Auth (P2, 15/10/2026): Supabase Auth self-hosted. A API não faz login próprio. O helper `loginAs` do harness gera JWT no formato do Supabase (`sub`, `aal`) para o guard do 02-B4. As chaves `JWT_SIGNING_KEY_FILE` e `MFA_ENC_KEY_FILE` ainda estão reservadas e saem no B4.

Banco (P3): em produção, database `sejaengajado` no Postgres do Supabase, usuário de app sem superuser e sem `BYPASSRLS`. Em local e nos testes, Postgres 16 próprio (`docker-compose.dev.yml` e Testcontainers).

A fila pg-boss (⏳P10) entra depois; o readiness trata a fila como pronta até lá. Com Postgres no ar, `GET /api/health/ready` responde 200. Sem banco, 503.

## Local

Na raiz do monorepo:

```bash
docker compose -f docker-compose.dev.yml up
```

Em `api/.env`, `DATABASE_URL=postgres://sejaengajado:local-dev-only@localhost:5432/sejaengajado`. A senha é só desse compose.

```bash
npm ci
npx prisma migrate deploy
npm test
npm run test:int
npm run lint
npm run build
npm start
```

`test:int` sobe `postgres:16-alpine` via Testcontainers (Docker local), aplica as migrations, usa o role `se_app` e trunca as tabelas entre os casos.