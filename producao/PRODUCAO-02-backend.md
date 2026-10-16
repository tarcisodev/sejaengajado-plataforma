# PRODUÇÃO 02 — Backend (NestJS 11 + Prisma 6 + Postgres 16)
Pré-requisito: 01-B2 e 01-B3 prontos. Leia `PRODUCAO-00-indice.md` (arquitetura, decisões resolvidas D10–D18 e ⏳P#). Referência de detalhe: `contrib-nucleo.md` v2 (contrato da API, endpoints) e `contrib-alicerce.md` §2–§6. **Onde divergirem, vale este arquivo:** API em `/api` na mesma origem e sem CORS, prontidão em `/health/ready`, nomes em inglês, erro com `fields` e "Carregar mais".

## Padrões (todos os blocos)
- Rotas sob `/api` (ex.: `/api/reseller/sales`). Erros `{code,message,fields?}` com mensagem em pt-BR. Paginação `{items,nextCursor}` (cursor base64url de `createdAt,id`, limite 100). `Idempotency-Key` nos POST de venda, estorno e estoque.
- Dinheiro em centavos `Int` (sufixo `Cents`); percentuais inteiros; um helper `money.ts`. Datas `timestamptz` UTC; calendário em `America/Sao_Paulo`.
- `resellerId NOT NULL` em toda tabela de negócio; tenant vindo do token + DB; entre tenants, **404** (⏳P12).
- Append-only (grant só INSERT/SELECT + trigger) em `LedgerEntry`, `PlaqueMovement`, `AuditLog` e `LifecycleEvent`.
- Testes de integração com Postgres 16 real (Testcontainers), usando o usuário de app sem `BYPASSRLS`.

---
## B1 — Schema Prisma, migrations e seed (⏳P1 ⏳P6)
- **Objetivo:** modelo completo do Alicerce, com nomes em inglês.
- **Arquivos:** `api/prisma/schema.prisma`, `api/prisma/migrations/*` (SQL manual), `api/prisma/seed.ts`.
  - Base: `User`, `Reseller` (status ACTIVE/DELINQUENT/BLOCKED, delinquentSince, blockedReason, blockedBy, isPlatform), `ResellerPlan` (monthlyFeeCents, siteLimit?), `Customer`, `Site` (status DRAFT/PUBLISHED/READ_ONLY/SUSPENDED/ARCHIVED, editable, hostingRenewsAt, plaqueFidelityEndsAt), `Template`, `Plan`, `Coupon`, `Order`, `Subscription`, `Payment`, `WebhookEvent` (unique gateway+eventId, status, attempts), `Plaque`, `ScanEvent`, `ReservedSlug`, `PlatformConfig`, `AuditLog`.
  - **Financeiro:** `Product` (code `SITE_ONE_TIME`, `SITE_PRO`, `PLAQUE_QR`, `PLAQUE_NFC`, `RENEWAL`; baseWholesaleCents), `WholesalePrice` (resellerId, productId, priceCents, validFrom, validTo?; **exclusion constraint** `btree_gist` sem sobreposição), `ResellerPrice` (preço sugerido), `Sale` (status RECORDED/VOIDED, idempotencyKey unique por revendedor) + `SaleItem` (qty, **unitCostCents, unitPriceCents congelados**, wholesalePriceId), `LedgerEntry` (type IN/OUT, category SALE/PLATFORM_INVOICE/PLAQUE_PURCHASE/MANUAL/REVERSAL, amountCents > 0, refType/refId, reversalOfId unique), `PlaqueMovement` (IN/OUT/ADJUST, qty > 0, unitCostCents?, siteId?, saleItemId?) + view `PlaqueStock`, `ResellerInvoice` (period AAAA-MM, unique por revendedor) + `InvoiceLine`, `LifecycleEvent` (from, to, reason, penaltyCents?).
  - Seed idempotente: revendedor `PLATAFORMA` (isPlatform), admin (e-mail lido de env, sem senha no código), 2 revendedores de exemplo, produtos com atacado **placeholder** (⏳P6), slugs reservados (`www`, `app`, `api`, `admin`, `mail`, `login`, `pix`, `banco`, `gov`…), defaults de `PlatformConfig` (7/8/16/60 dias, `resellerGraceDays`=30, renovação, valor e % da placa).
- **Pronto:** `prisma migrate deploy` limpo; o seed rodado 2× não duplica nada.
- **Testes:** UPDATE em `LedgerEntry` falha; vigências sobrepostas falham; `qty` ≤ 0 falha; `lower(slug)` é único.
- **Commit:** `feat(db): production schema with financial model`. **PARE.**

## B2 — Tenant: guard `TenantScope` + extensão Prisma fail-closed (⏳P1 ⏳P12)
- **Objetivo:** camada 1 de isolamento, obrigatória.
- **Arquivos:** `src/tenant/tenant-scope.guard.ts`, `src/tenant/prisma-tenant.extension.ts` (injeta `resellerId` em where/data dos models escopados; sem escopo, **lança erro**), `src/tenant/tenant.context.ts` (AsyncLocalStorage), lista de models escopados num só lugar.
- **Pronto:** nenhum repositório aceita `resellerId` vindo do body ou da query para RESELLER; o ADMIN usa um client explícito `adminPrisma`, auditado.
- **Testes:** matriz A↔B (ler, editar, listar, publicar, vender, estornar) → 404 e listas sem itens do outro; uma query num model escopado sem contexto lança erro. Esses testes bloqueiam o merge no CI.
- **Commit:** `feat(tenant): fail-closed prisma scope`. **PARE.**

## B3 — RLS (segunda camada) (⏳P1)
- **Objetivo:** defesa em profundidade no Postgres.
- **Arquivos:** migration com `ENABLE/FORCE ROW LEVEL SECURITY` e políticas `reseller_id = current_setting('app.reseller_id')::uuid` em toda tabela escopada; `SET LOCAL app.reseller_id` em toda transação (interceptor); role `se_admin` separada para o ADMIN; o usuário de app sem superuser e sem `BYPASSRLS`.
- **Pronto:** com o guard desligado de propósito no teste, o SQL cru de A não retorna linhas de B.
- **Testes:** SELECT, INSERT e UPDATE cruzados falham via RLS; sem `app.reseller_id` → zero linhas.
- **Commit:** `feat(db): row level security`. **PARE.**

## B4 — Auth (Supabase), RBAC e MFA do admin (⏳P16)
- **Objetivo:** autenticação pelo Supabase Auth self-hosted da VPS (P2, decidido em 15/10/2026). A API não faz login: só valida o token do Supabase. **Não escreva autenticação à mão.**
- **Arquivos:** `src/auth/*`: `SupabaseJwtGuard` global (com `jose`: HS256 com `SUPABASE_JWT_SECRET_FILE`, conferindo assinatura, `iss`, `aud=authenticated` e `exp`, ver P2a; JWKS só se um dia o Supabase migrar para chaves assimétricas); **sem auto-criar usuário**: a instância é compartilhada com o SaaS de QR (mesma base, mesmo secret e `aud`), então só passa quem já tem `User` com aquele `supabaseId` (`sub`) e status ACTIVE, criado no convite; senão, 403 `AUTH_NOT_INVITED`; papel e `resellerId` **sempre lidos do DB**, nunca de claims editáveis (`user_metadata`); rotas ADMIN exigem `aal2` (TOTP do Supabase MFA); convite de revendedor e reset pela Admin API do Supabase (`inviteUserByEmail` / `generateLink`, service role só no servidor, `SUPABASE_SERVICE_ROLE_KEY_FILE`), com e-mail entregue pelo SMTP configurado no Supabase Auth (⏳P16); throttle por IP nas rotas de convite; `@Roles()` + `RolesGuard`; `GET /api/auth/me`. **Config:** remova de `src/config/env.ts` as chaves reservadas no B2 para o login próprio (`JWT_SIGNING_KEY`, `MFA_ENC_KEY`) e acrescente `SUPABASE_URL` (valor público), `SUPABASE_JWT_SECRET` (via `_FILE`), `SUPABASE_JWT_AUD` e `SUPABASE_SERVICE_ROLE_KEY` (via `_FILE`). Sem tabela de sessão/refresh e sem campos de senha ou de segredo MFA no `User`.
- **Pronto:** a matriz papel × rota responde 401/403 corretamente; token expirado ou de outro emissor → 401; admin sem `aal2` → 403; token válido de usuário não convidado → 403 `AUTH_NOT_INVITED`.
- **Testes:** (tokens HS256 assinados com secret de teste) assinatura, `iss`, `aud` ou `exp` inválidos → 401; claim forjado (`role`/`resellerId` em metadata) não muda o acesso; admin com `aal1` bloqueado; token válido do Supabase de usuário não convidado (ex.: usuário do SaaS de QR) → 403 `AUTH_NOT_INVITED`; `User` não ACTIVE → 403; nenhuma linha de `User` criada pelo guard; Admin API do Supabase mockada no convite.
- **Commit:** `feat(auth): supabase auth guard with rbac and admin mfa`. **PARE.**

## B5 — Auditoria
- **Objetivo:** trilha imutável.
- **Arquivos:** `src/audit/audit.service.ts` + interceptor em toda rota ADMIN e nas mudanças de atacado, config, status de site e revendedor, BLOCK, impersonação, pagamento manual e estoque.
- **Pronto:** `GET /api/admin/audit-logs` com cursor; o diff sai sem segredos.
- **Testes:** criar revendedor, nova vigência e ADJUST geram log; UPDATE/DELETE no `AuditLog` falha; senha e token nunca aparecem.
- **Commit:** `feat(audit): append-only audit log`. **PARE.**

## B6 — Revendedores (admin) (⏳P13 ⏳P27)
- **Objetivo:** o admin cria e gerencia revendedores.
- **Arquivos:** `src/admin/resellers/*`: CRUD, `ResellerPlan`, convite (Admin API do Supabase `inviteUserByEmail`; o convite já cria a linha `User` com o `supabaseId` devolvido e o `resellerId`), `block` (motivo obrigatório), `unblock`, `suspend-sites` (fraude), `offer-migration`, `summary`, `impersonate` (somente leitura, auditado). Toda transição grava `LifecycleEvent`.
- **Pronto:** e2e convite (Supabase mockado; cria o `User` na hora) → aceite → primeiro acesso do revendedor casado pelo `supabaseId`, sem auto-criação.
- **Testes:** BLOCKED não opera; block sem motivo → `VALIDATION_FAILED` com `fields`; impersonação não escreve.
- **Commit:** `feat(admin): reseller management`. **PARE.**

## B7 — Clientes e sites do revendedor (⏳P17)
- **Objetivo:** o revendedor cria o cliente e o site e publica no subdomínio.
- **Arquivos:** `src/reseller/customers/*`, `src/reseller/sites/*`, `slugs/check` (regex `^[a-z0-9](-?[a-z0-9]){2,30}$`, reservados, blocklist de marcas), `publish`/`unpublish` (invalida o cache do by-host), schema zod do `content` (theme {niche, brandColor hex, overrides}, sections[] com divisor {shape, height 16–120, flip, invert}, strip {enabled, motif, speed, direction}, catalog {layout:'grid' padrão}, pix {key, receiverName}, rating anulável, googleReviewUrl, faq[], hours, timezone), upload por URL pré-assinada S3/R2 (⏳P17) com tipos e tamanho limitados.
- **Pronto:** criar e publicar bloqueados em DELINQUENT (`RESELLER_DELINQUENT`) e BLOCKED (`RESELLER_BLOCKED`); `siteLimit` respeitado (`SITE_LIMIT_REACHED`).
- **Testes:** slug (regex, reservado, marca, caixa diferente); A↔B; content válido passa e `brandColor` inválido falha com `fields`.
- **Commit:** `feat(reseller): customers and sites`. **PARE.**

## B8 — Resolução pelo Host e `/avaliar` (⏳P11)
- **Objetivo:** servir o site público certo.
- **Arquivos:** `GET /api/public/sites/by-host?host=` (só campos públicos; SUSPENDED → flag "temporariamente indisponível"; ARCHIVED → 410; inexistente → 404; `Cache-Control: max-age=60` + ETag; cache em memória de 60 s invalidado ao publicar e editar); `GET /api/public/r/:slug/avaliar` → 302 para o link de review do Google + `ScanEvent` com IP em hash; throttle.
- **Pronto:** `teste.sejaengajado.com.br` resolve o site certo; raiz e `app` nunca resolvem tenant.
- **Testes:** host com porta e maiúsculas; reservados; cache invalidado ao publicar; scan contado sem IP cru.
- **Commit:** `feat(public): host resolution and review redirect`. **PARE.**

## B9 — Produtos e atacado com vigência (⏳P4 ⏳P5 ⏳P6)
- **Objetivo:** custo personalizável por revendedor e por produto.
- **Arquivos:** `src/admin/products/*`, `src/wholesale/*`: nova vigência fecha a anterior na mesma transação; resolve o vigente na data (fuso SP), com fallback para `baseWholesaleCents`; `GET /api/reseller/wholesale` (só o próprio); `GET|PUT /api/reseller/prices` (preço sugerido por produto).
- **Pronto:** o admin define o atacado por revendedor e produto com histórico.
- **Testes:** override > base; troca no meio do mês; revendedor não vê o atacado de outro.
- **Commit:** `feat(wholesale): per-reseller prices with validity`. **PARE.**

## B10 — Ledger (entradas e saídas) (⏳P9)
- **Objetivo:** livro append-only do revendedor.
- **Arquivos:** `src/ledger/*`: `append`, `reverse` (segundo estorno → `ALREADY_REVERSED`, inclusive concorrente), `balance(at?)`, extrato `{items,nextCursor,openingCents,closingCents}`, lançamentos manuais IN/OUT do revendedor.
- **Pronto:** saldo sempre derivado (Σ IN − Σ OUT).
- **Testes:** estorno anula o efeito; abertura + movimentos = saldo final; A↔B.
- **Commit:** `feat(ledger): append-only ledger`. **PARE.**

## B11 — Estoque de placas (PlaqueMovement) (⏳P7 ⏳P8)
- **Objetivo:** estoque sem saldo negativo.
- **Arquivos:** `src/stock/*`: `move()` com `pg_advisory_xact_lock(resellerId, type)`, saldo pela view, custo médio inteiro; transferência da plataforma para o revendedor (OUT na Plataforma + IN no revendedor + OUT `PLAQUE_PURCHASE` no ledger, ⏳P7); brinde (`OUT`, motivo GIFT) só para site `SITE_PRO` (⏳P8); ADJUST só para ADMIN, com motivo.
- **Pronto:** `STOCK_INSUFFICIENT` quando a saída passa do saldo.
- **Testes:** 20 saídas concorrentes com saldo 10 → exatamente 10 sucessos e saldo 0; transferência atômica; A↔B.
- **Commit:** `feat(stock): plaque movements`. **PARE.**

## B12 — Vendas e margem prevista (D15)
- **Objetivo:** registrar a venda com custo e preço congelados.
- **Arquivos:** `src/sales/*`: `record()` numa transação: atacado vigente de cada item → `SaleItem` congelado → IN `SALE` (Σ preço) no ledger → OUT de placa no estoque; `Idempotency-Key` (mesmo corpo = mesma resposta; corpo diferente = 409 `IDEMPOTENCY_CONFLICT`); `void()` = VOIDED + estornos + devolução ao estoque. Margem prevista = Σ qty × (unitPrice − unitCost), calculada na leitura.
- **Pronto:** mudar o atacado depois não altera vendas antigas.
- **Testes:** margem com valores conhecidos (vários itens, qty > 1, margem negativa); idempotência; void; falha no estoque desfaz tudo.
- **Commit:** `feat(sales): sales with frozen cost and price`. **PARE.**

## B13 — Planos, cupons e configs (⏳P6)
- **Objetivo:** cursor-02 B6 adaptado.
- **Arquivos:** `src/admin/plans|coupons|config/*`: cálculo de desconto (PCT/FIXED, validade, máximo de usos), `GET|PUT /api/admin/config` validado (prazos 7/8/16/60, graça de 30 dias, renovação do Pronto, valor e % da placa), auditado.
- **Pronto:** o cupom não deixa o valor negativo.
- **Testes:** bordas do desconto; config inválida → `fields`.
- **Commit:** `feat(admin): plans coupons config`. **PARE.**

## B14 — Jobs do cliente direto (atraso, renovação, multa) (⏳P10 ⏳P15 ⏳P16)
- **Objetivo:** aplicar exatamente as regras do 00-plano.
- **Arquivos:** `src/jobs/*` (pg-boss ⏳P10, rodando no worker ou `@nestjs/schedule` com lock): o dia 1 é o dia seguinte a `currentPeriodEnd` (SP); faixas `>=`: 1–7 aviso só por e-mail; ≥ 8 READ_ONLY; ≥ 16 SUSPENDED; ≥ 60 ARCHIVED; reativação pelo webhook (05-B3); renovação anual do Pronto; multa da placa `ceil(plaqueValueCents × mesesRestantes/12 × pct/100)` gravada em `LifecycleEvent.penaltyCents`; heartbeat (nome do secret: `se_hc_jobs_url`).
- **Pronto:** o job é idempotente (só transiciona se o estado-alvo for diferente).
- **Testes:** fake timers em cada faixa e na virada de dia em SP; reexecução; multa com 0, 1 e 12 meses restantes.
- **Commit:** `feat(jobs): overdue lifecycle and renewals`. **PARE.**

## B15 — Dashboard e relatórios do revendedor (D15)
- **Objetivo:** entradas, saídas, margem e estoque.
- **Arquivos:** `GET /api/reseller/dashboard` (sites ativos, vendas do mês, **margem prevista** das vendas e **margem realizada** = IN de vendas − OUT das faturas pagas, saldo do ledger, estoque por tipo, fatura aberta); `GET /api/reseller/reports/sales?from&to` (custo, cobrado, margem prevista × realizada); relatórios do admin por revendedor.
- **Pronto:** os totais batem com a seed.
- **Testes:** integração com valores conhecidos; `EXPLAIN` sem seq scan nas tabelas grandes.
- **Commit:** `feat(reports): reseller dashboard`. **PARE.**

## B16 — Endurecimento e OpenAPI
- **Objetivo:** API pronta para produção.
- **Arquivos:** OpenAPI completo (com exemplos de erro e de `fields`, base para os tipos do `HttpApiService`), `api/Dockerfile` multi-stage não-root, entrypoint que monta `DATABASE_URL` a partir de `DATABASE_URL_FILE`, script `migrate:deploy` manual, body limit, `npm audit`, lint contra `parseFloat`/`Decimal` em valores.
- **Pronto:** checklist do `contrib-nucleo.md` marcado (trocando `/ready` por `/health/ready` e CORS por mesma origem) ou com as pendências listadas.
- **Testes:** suíte completa + cobertura ≥ 90% em sales, ledger, stock, jobs e tenant.
- **Commit:** `chore(api): production hardening`. **PARE.**
