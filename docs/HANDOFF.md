# HANDOFF — próximo agente (Antigravity)

**Data:** 2026-10-16 · **Repo:** `tarcisodev/sejaengajado-plataforma`  
**Leia antes:** este arquivo + `docs/PLANO-FLUXO-FELIZ.md`. Epic #18: corpo da [issue #18](https://github.com/tarcisodev/sejaengajado-plataforma/issues/18) + `FORMULA-nour-biosite.md` (raiz). Não há `PROMPT-VENDEDOR-ADMIN-BIO` no repo.

## Estado atual

| Item | Valor |
|---|---|
| `origin/master` tip | `35785362ec4c` — Merge PR #19 (ci harden) |
| Produção (último deploy **success**) | `29093c95d074` — Merge PR #17 (SSR_PUBLIC_SITE) |
| Deploy de `3578536` | environment `production` ainda **waiting** (sem aprovação) |
| Worktree extra | `E:/dev/sejaengajado/plataforma-feat18` → `feat/18-vendedor-login-biosite` |

### Branches WIP (já no remote)

| Branch | Tip | Objetivo |
|---|---|---|
| `feat/8-fluxo-feliz` | `6f69cb6` | #8 FLUXO-FELIZ M1–M3 (+ stash M2 e2e salvo) |
| `feat/18-vendedor-login-biosite` | `70a253b` | #18 vendedor/login/admin/biosite FORMULA |
| `docs/handoff` | (este PR) | Handoff docs — **não mergear pelo agente** |
| `chore/dependabot-grouping` | `ed8e19b` | PR #39 Dependabot groups |

### PRs abertos (relevantes)

| PR | URL | Propósito | CI |
|---|---|---|---|
| #39 | https://github.com/tarcisodev/sejaengajado-plataforma/pull/39 | Dependabot: group minor/patch, ignore majors | pr-ci-ok + CodeQL verdes (jobs pesados skipped — docs/chore) |
| #20–#38 | Dependabot bumps (vários majors) | Deps — **não priorizar** vs P0 | — |

**Sem PR ainda:** `feat/8-fluxo-feliz`, `feat/18-vendedor-login-biosite`.  
**Já merged:** #19 (ci harden), #17/#11 (biosite SSR), #15/#9 (pipeline).

### Issues abertas (P0 / relacionadas)

| # | Título | Status |
|---|---|---|
| [#18](https://github.com/tarcisodev/sejaengajado-plataforma/issues/18) | vendedor, login senha+MFA, admin total site, biosite FORMULA | P0 core, **pronto**, WIP em `feat/18` |
| [#8](https://github.com/tarcisodev/sejaengajado-plataforma/issues/8) | FLUXO-FELIZ M1–M3 | P0 core, **pronto**, WIP em `feat/8` |
| [#13](https://github.com/tarcisodev/sejaengajado-plataforma/issues/13) | pipeline PR B | P1, triagem |
| [#14](https://github.com/tarcisodev/sejaengajado-plataforma/issues/14) | pipeline PR C | P2, triagem |

Fechados recentes: #10, #16 (biosite SSR).

## Marcos M0–M4 (`docs/PLANO-FLUXO-FELIZ.md`) + #18

| Marco | Estado | Onde |
|---|---|---|
| **M0** | Feito em master (`579ee61` + fixes #11/#17) | `publico.spec`, bugs 0.a/0.b endereçados no código; prod ainda no SHA do #17 até aprovar deploy do tip |
| **M1** | Parcial em `feat/8` (`2471b8d` admin-site/f5 + confirm/resume) | **Não** em master; matriz-crud existe mas incompleta |
| **M2** | WIP e2e salvo (`6f69cb6` — revenda/cliente/isolamento + helpers) | Specs ampliados; **não** verdes/fechados; há `test-results` históricos de falha |
| **M3** | Parcial nos mesmos specs (crud-admin/cobranca stubs) | Falta fechar + sandbox |
| **M4** | Fora de escopo | impersonar, troca plano cliente, etc. |
| **#18** | Iniciado (`70a253b`) | password login, reseller profile, admin site meta, FORMULA fields/SSR/seed — **não** continuar neste handoff; epic incompleto (MFA reset, demos estáveis, CI, PR) |

`docs/matriz-crud.md` veio do início do M1 — atualizar quando specs verdes existirem.

## Bugs conhecidos / risco

- **404 intermitente com UA de browser** em demos (`demo-forno`, etc.): histórico; mitigations em #11/#17 (REQUEST_CONTEXT, retry soft 404/429, CDN no-store). Smoke recente relatado **20/20 verde** em demo-forno, mas risco permanece até tip com fix estar em prod **e** validação contínua.
- Produção efetiva = `29093c9` (#17). Tip `3578536` (#19) ainda **waiting** aprovação.
- Bugs do plano 0.c (Sentry `@sentry/server-runtime-injection`), 0.d (segfault 139), 0.e (site DRAFT sem editar) — verificar se ainda abertos ao retomar M1.

## Como rodar local

Setup: `docs/DEV.md` + `docs/marco-1.md`.

```bash
cp .env.local.example .env.local
node scripts/dev-auth.mjs init
docker compose -f docker-compose.dev.yml --env-file .env.local up -d
# api: migrate + seed + seed-admin (ver DEV.md)
cd api && npm ci && npm run start:dev
cd web && npm ci && npx ng serve --host 127.0.0.1 --port 4200
```

| Ação | Comando |
|---|---|
| Unit web | `cd web && npm test -- --watch=false --browsers=ChromeHeadless` |
| Unit/int api | `cd api && npm test` · `npm run test:int` |
| Lint | `web`: `npm run lint` · `api`: `npm run lint` · `npm run lint:money` |
| E2E fluxo feliz | `cd web && npm run e2e:fluxo-feliz` |
| Smoke e2e | `cd web && npm run e2e:fluxo-feliz:smoke` |

### Nomes de env (só nomes — sem valores)

`.env.local.example`: `SUPABASE_JWT_SECRET`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `SUPABASE_JWT_AUD`, `DEV_ADMIN_EMAIL`

`api/.env.example`: `NODE_ENV`, `PORT`, `DATABASE_URL`, `ADMIN_DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_JWT_AUD`, `SUPABASE_JWT_SECRET_FILE`, `SUPABASE_SERVICE_ROLE_KEY_FILE`, `SMTP_URL_FILE`, `ASAAS_BASE_URL`, `ASAAS_API_KEY_FILE`, `ASAAS_WEBHOOK_TOKEN_FILE`, `MELHORENVIO_BASE_URL`, `MELHORENVIO_TOKEN_FILE`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_BACKUP_BUCKET`, `S3_ACCESS_KEY_FILE`, `S3_SECRET_KEY_FILE`, `SENTRY_DSN`, `SENTRY_DSN_FILE`, `SENTRY_RELEASE`, `GOOGLE_PLACES_API_KEY`, `HC_JOBS_URL`, `HC_JOBS_URL_FILE`, `ENABLE_DOCS`

E2E/seed (quando usados): `E2E_BASE_URL`, `E2E_HAPPY_PATH`, `SEED_ADMIN_EMAIL`, `SEED_DEMO_RESELLER_EMAIL`, `ALLOW_DEMO_SEED`

## Regras da casa (agente)

1. Issue → branch `feat|fix/<n>-...` → PR para `master` com `Closes #n`.
2. **Agente nunca faz merge nem deploy.**
3. Deploy só com aprovação do Tarciso no environment `production`.
4. Migrations **expand-only** (sem DROP/RENAME; não editar migration já aplicada).
5. Nunca commitar IP/token/e-mail/senha.
6. Não tocar auth dedicado: `auth.sejaengajado.com.br`, secrets `se_auth_*`.
7. Dinheiro em centavos; ledger append-only; RLS fail-closed (cross-tenant → 404); Idempotency-Key em POSTs de dinheiro.
8. UI pt-BR; código em inglês. Triagem: `TRIAGEM.md`.

## Stashes (local)

| Stash | Conteúdo | Ação feita |
|---|---|---|
| `wip-e2e-m2-before-epic` (`stash@{1}` na época) | e2e M2 | **Aplicado + commitado** em `feat/8` → `6f69cb6` (stash original pode ainda existir localmente) |
| `wip-before-ci-harden` | só `.cursor/mcp.json` (conn local) + `producao/brand/favicon.ico` | **Não** commitado (mcp tem credencial local). Stash mantido. |
| `wip-m2-fluxo` | — | **Não encontrado** (equivalente: `wip-e2e-m2-before-epic`) |

## Próximo passo (primeiro comando + arquivo)

Prioridade P0: retomar **#18** (já começado) **ou** fechar **#8** M1–M3 — escolher um; não misturar.

```bash
git fetch origin && git checkout feat/18-vendedor-login-biosite && git pull
```

Primeiro arquivo: corpo da issue #18 + `FORMULA-nour-biosite.md` (raiz).  
Se preferir fluxo-feliz: `git checkout feat/8-fluxo-feliz && git pull` → `docs/PLANO-FLUXO-FELIZ.md` seção M2, depois `web/e2e/fluxo-feliz/revenda-site.spec.ts`.

**Não** mergear este PR de handoff sem o Tarciso. **Não** deployar.
