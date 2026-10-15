# Seja Engajado — desenvolvimento local

Sobe só o frontend. A API Nest ainda não está neste repositório, e o banco não entra neste compose: com `apiUrl` vazio o `ng serve` usa o mock em memória. A build de produção troca esse mock pelo cliente HTTP e não inclui a semente.

## Subir

Na raiz:

```bash
docker compose up
```

O painel e a landing ficam em `http://127.0.0.1:4200/`. O admin local é `http://app.localhost:4200/`.

## Apontar o web para uma API

Em `web/src/environments/environment.development.ts`, defina `apiUrl` com a base da API, por exemplo `http://localhost:3000`. Reinicie o `ng serve`. O cliente chama essa origem; os caminhos estão em `HttpApiService`.

Sem `apiUrl`, o desenvolvimento continua no mock. A chave do Google Places, se existir, vai em `googlePlacesApiKey` no mesmo arquivo. Não commite segredo: use o `.env.example` só como lembrete.

Fora do Docker, na pasta `web`:

```bash
npx ng serve --host 127.0.0.1 --port 4200
```
