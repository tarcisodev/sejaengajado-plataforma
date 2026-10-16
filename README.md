# Seja Engajado

Monorepo local.

| Pasta | Conteúdo |
|---|---|
| `web/` | Angular 22.2, SSR, Tailwind 4.3 |
| `api/` | NestJS 11 |
| `infra/` | Runbooks e trechos de infra |

As versões estão em `docs/versions.md`. Node 22, conforme `.nvmrc`.

## Desenvolvimento local (auth real)

Para `/entrar` com OTP local (GoTrue + Mailpit), siga **[docs/DEV.md](docs/DEV.md)**.

Resumo:

```bash
cp .env.local.example .env.local
node scripts/dev-auth.mjs init
docker compose -f docker-compose.dev.yml --env-file .env.local up -d
# migrate + seed + seed-admin (ver DEV.md)
cd api && npm start   # :3000
cd web && npx ng serve --host 127.0.0.1 --port 4200
```

- Painel: http://app.localhost:4200/entrar  
- OTP no Mailpit: http://localhost:8025  
- **Nunca** apontar o localhost para `auth.sejaengajado.com.br`.

## Mock (sem API / sem auth)

Com `apiUrl` vazio o web usa `MockApiService`. O fluxo documentado em `DEV.md` usa `apiUrl: '/api'` + GoTrue local.

## Apontar o web para a API

`web/proxy.conf.json` encaminha `/api` → `http://127.0.0.1:3000`. A chave do Google Places fica só na API. O web chama `GET /api/places/search`.
