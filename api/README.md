# API

Esqueleto NestJS 11. Prefixo `/api`, sem CORS. A config usa zod e aceita segredo em arquivo (`NOME_FILE` vira `NOME`).

Login próprio (⏳P2) ainda não está aqui: só os nomes `JWT_SIGNING_KEY_FILE` e `MFA_ENC_KEY_FILE`. A fila pg-boss (⏳P10) entra depois; o readiness trata a fila como pronta até lá. Com Postgres no ar, `GET /api/health/ready` responde 200. Sem banco, 503.

## Local

Na raiz do monorepo, o Postgres 16 (⏳P3):

```bash
docker compose -f docker-compose.dev.yml up
```

Em `api/.env`, `DATABASE_URL=postgres://sejaengajado:local-dev-only@localhost:5432/sejaengajado`. A senha é só desse compose.

```bash
npm ci
npm test
npm run lint
npm run build
npm start
```
