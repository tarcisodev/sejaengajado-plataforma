# Marco 1 — fluxo feliz testável

Objetivo: admin cria revendedor → revendedor entra → cria cliente/biosite → gera placa → vê lucro e o que deve à plataforma.

## Pré-requisitos locais

1. Postgres (`docker compose -f docker-compose.dev.yml up -d` ou harness do `test:int`).
2. API: `cd api && npm run prisma:migrate:deploy && npm run seed:demo && npm run start` (ou `nest start`).
3. Web: `cd web && npm start` (ou `serve:ssr:web` após build).
4. Auth: Supabase local/dev com captura de e-mail (P16 — sem SMTP real). OTP + MFA aal2 para admin/revendedor.

## Seed DEMO (só dev/e2e)

```bash
cd api
npm run seed:demo
```

Em produção use `npm run seed:showcase` (ver `docs/GO-LIVE.md` §9) — `seed:demo` aborta se `NODE_ENV=production` ou se `DATABASE_URL` for o banco `sejaengajado` (salvo `ALLOW_DEMO_SEED=1`).

- Admin: `SEED_ADMIN_EMAIL` (padrão `admin@sejaengajado.com.br`)
- Revendedor demo: `SEED_DEMO_RESELLER_EMAIL` (padrão `demo.revenda@example.com`)
- Preços são **placeholders DEMO (P6)**; a UI mostra selo “valor de exemplo”.

## Roteiro manual

1. Entrar como admin (OTP) → Admin → criar revendedor → copiar `inviteActionLink` (dev).
2. Abrir o link / entrar como revendedor (OTP + MFA se exigido).
3. Revenda → Sites → wizard: cliente manual → template → Pix exemplo → slug → prévia → Publicar.
4. Sites → Placa → baixar QR/SVG/PNG → Registrar saída no estoque (ASSIGN).
5. Início: ver lucro previsto, “A pagar à plataforma” (linhas da fatura) e link do extrato.
6. Vendas: registrar venda com preço editável; conferir margem e Idempotency-Key (sem duplicar no duplo clique).
7. Abrir biosite `https://{slug}.localhost:4200` ou `?tenant={slug}` → Pix/Google com placeholders.

## E2E automatizado

```bash
# API sandbox / FakeGateway (já existente)
cd api && npm run test:e2e:sandbox

# Playwright (web) — opcional, stack local
cd web
set E2E_HAPPY_PATH=1
set E2E_BASE_URL=http://127.0.0.1:4200
npx playwright test
```

Sem `E2E_HAPPY_PATH=1`, o Playwright só registra skip (não quebra CI).

## DoD do Marco 1

- [x] `seed:demo` idempotente
- [x] e2e sandbox (`api`) + spec Playwright happy-path (HX: biosite `?tenant=` + páginas jurídicas)
- [x] lint / test / build web verdes no loop PROGRESS (2026-10-16)
- [ ] test:int API verde na máquina local/CI antes do merge
- [ ] **OK do Tarciso para o primeiro deploy de teste** (aprovação no environment `production` — não automatizar)

## Bloqueios restantes (Tarciso)

Ver `PROGRESS.md` › Bloqueios. Issues #1–#6 fechados por decisão; deploy continua com aprovação manual no environment `production`.
