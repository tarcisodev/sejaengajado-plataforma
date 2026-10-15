# API

NestJS 11 + Prisma 6. Prefixo `/api`, mesma origem (sem CORS). Config zod; segredos via `NOME_FILE` (Docker secrets). OpenAPI em `/api/docs` e `/api/docs-json`. Checklist: `PRODUCTION-CHECKLIST.md`.

Auth: Supabase Auth self-hosted (JWT HS256). ADMIN exige `aal2`. Banco de produção: Postgres do Supabase (`sejaengajado`), role `se_app` sem `BYPASSRLS`. Local/testes: Postgres 16 (`docker-compose.dev.yml` / Testcontainers).

Prontidão: `GET /api/health` e `GET /api/health/ready`. Body limit 100kb. Migrações só com `npm run migrate:deploy` (manual no deploy).

## Local

Na raiz do monorepo:

```bash
docker compose -f docker-compose.dev.yml up
```

Em `api/.env`, `DATABASE_URL=postgres://sejaengajado:local-dev-only@localhost:5432/sejaengajado` e `ADMIN_DATABASE_URL` com o role admin de desenvolvimento.

```bash
npm ci
npm run migrate:deploy
npx prisma db seed
npm test
npm run test:int
npm run test:cov
npm run lint
npm run lint:money
npm run audit:prod
npm run build
npm start
```

O seed é idempotente. O e-mail do admin vem de `SEED_ADMIN_EMAIL` (padrão `admin@sejaengajado.com.br`).

Imagem: `docker build -t se-api .` (usuário não-root; entrypoint monta `DATABASE_URL_FILE`).