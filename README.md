# Seja Engajado

Monorepo local.

| Pasta | Conteúdo |
|---|---|
| `web/` | Angular 22.2, SSR, Tailwind 4.3 |
| `api/` | NestJS 11 |
| `infra/` | Runbooks e trechos de infra |

As versões estão em `docs/versions.md`. Node 22, conforme `.nvmrc`.

## Desenvolvimento local

O `ng serve` sobe o frontend. Com `apiUrl` vazio ele usa o mock em memória. A build de produção troca esse mock pelo cliente HTTP e não inclui a semente. O Postgres local sobe à parte, com `docker compose -f docker-compose.dev.yml up`.

## Subir

Na raiz:

```bash
docker compose up
```

O painel e a landing ficam em `http://127.0.0.1:4200/`. O admin local é `http://app.localhost:4200/`.

## Apontar o web para uma API

Em `web/src/environments/environment.development.ts`, defina `apiUrl` com a base da API, por exemplo `http://localhost:3000`. Reinicie o `ng serve`. O cliente chama essa origem; os caminhos estão em `HttpApiService`.

Sem `apiUrl`, o desenvolvimento continua no mock. A chave do Google Places fica em `web/.env` como `GOOGLE_PLACES_API_KEY`. O `npm start` copia essa chave para um arquivo local que o git ignora. Não commite segredo.

Fora do Docker, na pasta `web`:

```bash
npx ng serve --host 127.0.0.1 --port 4200
```
