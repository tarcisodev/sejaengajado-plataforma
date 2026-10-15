# Cursor — Backend de produção (Núcleo): revendedores, atacado, vendas, livro, estoque e cobrança Asaas
> Autor: Núcleo (backend). Versão 2 (15/10/2026), alinhada ao **ADR-001 do Alicerce** (`contrib-alicerce.md`) e ao contrato de front do **Lumen** (`contrib-lumen.md`). Versão anterior: `contrib-nucleo.backup-pre-alicerce.md`.
> Complementa `cursor-02-backend.md` e `cursor-03-pagamentos.md`. **Ordem de precedência:** decisões do Tarciso em `00-plano.md` §10 > ADR do Alicerce > cursor-02/03 > este arquivo. Onde há conflito ainda não decidido, está em "Divergências e pontos abertos" no fim; **não implemente o lado em disputa sem o OK do Tarciso** (o bloco afetado diz isso).
> Leia antes: `00-plano.md` (§4, §6, §7, §8, §10), `contrib-alicerce.md` (§2 a §6, §8, §10), `cursor-02-backend.md`, `cursor-03-pagamentos.md`, `contrib-lumen.md` (versões do front e regras de tema) e `contrib-atlas.md` (hosts `api.`/`app.` e healthchecks).

## Regras gerais (valem para todos os blocos)
- Execute **um bloco por vez**. No fim de cada bloco: rode lint + testes, faça commits pequenos (Conventional Commits) e **PARE**, mostrando um resumo e o que testar. Só siga quando eu disser "continuar".
- **Nenhum segredo no código.** Use `.env.example` com placeholders e leia de Docker secrets (`*_FILE`): `database_url`, `asaas_api_key`, `asaas_webhook_token`, `supabase_jwt/jwks`, `sentry_dsn` (nomes do Alicerce §6). `.env` no `.gitignore`.
- **Sem deploy automático** e sem rodar comandos contra produção. Asaas **só sandbox**.
- Textos para o usuário em pt-BR; código e rotas em inglês. Nomes de entidades/campos/códigos de produto **seguem o Alicerce** (ex.: `priceCentavos`, `competencia`, `SITE_PRONTO`).
- Stack: Node 22 LTS, NestJS 11, Prisma 6, Postgres 16 (banco `sejaengajado` no Supabase self-hosted, usuário de app **sem superuser e sem `BYPASSRLS`**), TypeScript `strict`, Jest, Testcontainers, `nestjs-pino`, `@nestjs/throttler`, zod (config e DTOs), Sentry.
- Datas em `timestamptz` (UTC) e ISO 8601 na API; regras de calendário (atraso, competência, vigência) em `America/Sao_Paulo`.

### Padrões obrigatórios (todos os blocos)
1. **Dinheiro em centavos inteiros** (`Int`, sufixo `Centavos`). Nunca `float`/`Decimal`. Percentuais inteiros. Um único helper `money.ts`; arredondamento explícito e testado (a multa usa `ceil`, conforme Alicerce §4).
2. **Snapshot do atacado**: o `SaleItem` congela `unitCostCentavos` (atacado vigente) e `unitPriceCentavos` (preço ao cliente) no registro. A margem é **derivada** desses campos congelados e nunca recalculada a partir da tabela.
3. **Livro só de inclusão**: `LedgerEntry` sem UPDATE/DELETE (grant só `INSERT/SELECT` + trigger que rejeita). Saldo **derivado** (Σ IN − Σ OUT). Correção = **estorno por lançamento inverso** (`reversalOfId` único).
4. **Estoque**: `PlaqueStock` é **saldo derivado** (view) de `PlaqueMovement` (Alicerce §3). Todo movimento em transação com **lock** por `(resellerId, tipo)` via `pg_advisory_xact_lock` antes de somar o saldo; saída que deixaria saldo negativo → `STOCK_INSUFFICIENT`. `PlaqueMovement` é append-only.
5. **Webhook**: `asaas-access-token` (tempo constante) → 401 se inválido → `INSERT WebhookEvent` com unique `(gateway, eventId)` (`ON CONFLICT DO NOTHING`; duplicado = 200 sem efeito) → 200 → processamento **assíncrono** no `se-worker` → **reconsulta no Asaas** → máquina de estados tolerante a fora de ordem. Reprocessável pelo admin.
6. **Driver de pagamento**: domínio fala só com `PaymentGateway` (cursor-03 B1); Asaas é adaptador; `FakeGateway` nos testes.
7. **Tenant (Alicerce §2)**: banco único, schema único; **toda tabela de negócio tem `resellerId` NOT NULL**. Isolamento em duas camadas: (1) guard `TenantScope` + extensão Prisma que injeta `resellerId` em todo model escopado e **lança erro** se faltar escopo (fail-closed); (2) **RLS** com `current_setting('app.reseller_id')` via `SET LOCAL` por transação; ADMIN usa role/conexão separada e auditada. O tenant vem **do token + DB**, nunca do Host, do body ou de header do cliente. Testes A↔B bloqueiam o merge.
8. **Slug**: regex `^[a-z0-9](-?[a-z0-9]){2,30}$`, `ReservedSlug` (raiz, `app`, `api`, `www`, `admin`, `mail`, `login`, `pix`, `banco`, `gov`…) + blocklist de marcas, unicidade em `lower(slug)`.
9. **Erros** `{ code, message }` (ver Contrato da API). **Paginação por cursor** `{ items, nextCursor }`.
10. **Auth**: depende da **D1** (Supabase OTP do Alicerce x auth própria com Argon2id). Fixo nas duas variantes: role e `resellerId` lidos **do DB**, não de claim editável; MFA para ADMIN; rate limit em auth/OTP.
11. **Auditoria** (Alicerce §5): `AuditLog` imutável (grant `INSERT/SELECT` + trigger). Registrar CRUD de revendedor, atacado, configs, mudança de status de site/revendedor, BLOCK com motivo, impersonação do admin, pagamento manual, transferência/ajuste de estoque.
12. **Config validada na subida**; `/health` (liveness) e `/ready` (DB + migrations + fila) — ver D10; logs pino JSON no stdout com `requestId` e `resellerId`, **sem PII** (redact de `authorization`, `cookie`, `set-cookie`, `password`, `token`, `doc`, `email`, `whatsapp`, payload de webhook); Sentry com release = SHA.
13. **Testes**: unitários + integração com **Postgres real (Testcontainers)**, com RLS ativo e usuário de app sem privilégios, cobrindo margem, livro, estoque, idempotência, RBAC/tenant, job de atraso e fatura.

---

## Contrato da API para o front (Angular 22.2 + Tailwind 4.3 + spartan, conforme Lumen)
O front tem dois consumidores: o **painel** em `https://app.sejaengajado.com.br` (spartan/helm, `HttpApiService` implementando o `ApiPort` já usado pelo mock) e o **SSR do biosite** (`se-web`, `*.sejaengajado.com.br`), que chama o by-host **servidor a servidor**. A API fica em `https://api.sejaengajado.com.br` (hosts do Atlas), **sem prefixo de versão** nas rotas, como no cursor-02 e nos smoke tests do Atlas.

- **CORS**: allowlist **exata**, nunca wildcard nem regex de subdomínio: prod `https://app.sejaengajado.com.br`; dev `http://localhost:4200` (e `http://app.localhost:4200` se usado). Os subdomínios de tenant **não** entram (são *same-site* com a API; ver CSRF). Métodos `GET,POST,PUT,PATCH,DELETE`; headers `Authorization, Content-Type, Idempotency-Key, X-Request-Id`; expor `X-Request-Id`; `credentials: true` só na variante com cookie (D1-B). Preflight cacheado (`max-age` 600). `/public/*` e `/webhooks/*` não precisam de CORS.
- **Auth no front**:
  - Variante Alicerce (D1-A, Supabase OTP): o painel usa o SDK do Supabase e envia `Authorization: Bearer <access_token>`; a API valida pelo JWKS e lê role/`resellerId` do DB. Sem cookie da API, sem CSRF.
  - Variante auth própria (D1-B): access token (15 min) **só em memória** no front, enviado como `Bearer`; refresh token em cookie `__Host-se_rt` (`HttpOnly; Secure; SameSite=Strict; Path=/`, sem `Domain`, host-only em `api.`), rotativo. `POST /auth/refresh` exige `Origin` na allowlist (proteção CSRF, porque os tenants são same-site) e header `X-Requested-With`. O front faz refresh silencioso num interceptor ao receber `401 AUTH_TOKEN_EXPIRED` e enfileira as requisições pendentes.
  - SSR: não envia credenciais; só usa rotas `/public/*`. Nada de token no `TransferState`.
- **Erros**: sempre `application/json` `{ "code": "SITE_NOT_EDITABLE", "message": "Este site está em modo só leitura." }`; `message` em pt-BR pronta para o toast (Sonner) do painel; o front decide pelo `code`. Validação: `{ code: "VALIDATION_FAILED", message, fields: [{ path, code, message }] }` (campo extra opcional, ver D12) para os formulários spartan marcarem cada campo. Status HTTP coerentes (400, 401, 403, 404, 409, 410, 422, 429 com `Retry-After`, 500 com `requestId` só). Códigos mínimos: `AUTH_REQUIRED`, `AUTH_TOKEN_EXPIRED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_FAILED`, `SLUG_INVALID`, `SLUG_RESERVED`, `SLUG_TAKEN`, `SITE_NOT_EDITABLE`, `RESELLER_DELINQUENT`, `RESELLER_BLOCKED`, `SITE_LIMIT_REACHED`, `STOCK_INSUFFICIENT`, `ALREADY_REVERSED`, `IDEMPOTENCY_CONFLICT`, `RATE_LIMITED`, `INTERNAL`.
- **Paginação**: `GET ...?limit=20&cursor=<opaco>` → `{ items: [...], nextCursor: string | null }` (cursor = base64url de `createdAt,id`; `limit` máx. 100; ordenação estável `createdAt desc, id desc`). Filtros e busca por query (`status`, `q`, `from`, `to`). O total para "contagem de resultados" da lista `/sites` do Lumen B6 está em aberto (D11).
- **Valores**: enums crus (`PUBLISHED`, `READ_ONLY`…) — o painel traduz para pt-BR (Lumen B6 mantém o enum em `data-*`). Dinheiro em `*Centavos` inteiros; o front formata com `Intl.NumberFormat('pt-BR')`. Datas ISO 8601 UTC.
- **Idempotência**: `POST` de venda, estorno e movimento de estoque aceitam `Idempotency-Key` (mesma chave + mesmo corpo = mesma resposta; corpo diferente = 409 `IDEMPOTENCY_CONFLICT`), para cliques duplos no mobile.
- **Conteúdo do site** (Lumen B1/B4/B5): o `Site.content` validado pelo `template.schema` deve aceitar `theme { niche: 'barbearia'|'restaurante'|'moda'|'beleza'|'saude'|'generico', brandColor?, overrides? }`, `sections[]` (ordem + divisor `{ shape, height 16–120, flip, invert }`), `strip { enabled, motif, speed, direction }`, `timezone` (padrão `America/Sao_Paulo`), `faq[]`, horários, Pix (chave + recebedor) e `rating` **anulável** (sem nota inventada). `brandColor` validado como hex. Nada de HTML livre.
- **By-host** (`GET /public/sites/by-host?host=`): retorna só campos públicos, incluindo `templateKey`, `content` (com `theme`), `status`, `slug`; `SUSPENDED` → flag para a página "temporariamente indisponível"; `ARCHIVED` → 410; inexistente → 404. `Cache-Control: public, max-age=60` + ETag, invalidado ao publicar/editar. Em dev aceita `*.localhost` (o `?tenant=` é resolvido no front).

---

## Modelo de dados (nomes do Alicerce §3; delta sobre o §7 do plano)
Toda tabela de negócio tem `resellerId` NOT NULL. Venda direta do Tarciso = revendedor reservado **"Plataforma"** (proposta do Alicerce, aguardando confirmação — D2).

- `PlatformConfig`(chave, valor, updatedBy) — prazos de atraso, `prontoRenewalCentavos`, `plaqueValueCentavos`, `plaquePenaltyPct`, `resellerGraceDays`=30; mudanças auditadas (versionamento via audit).
- `Reseller`(id, nome, status ACTIVE|DELINQUENT|BLOCKED, delinquentSince?, blockedReason?, blockedBy?, resellerPlanId, isPlatform bool, asaasCustomerId?, asaasWalletId? (F2)).
- `ResellerPlan`(id, nome, mensalidadeCentavos?, limiteSites?) — mensalidade em aberto (D3).
- `User`(id, supabaseId?, email, role ADMIN|RESELLER|CUSTOMER, resellerId, status) — campos de auth própria só se D1-B: `passwordHash`, `mfaSecretEnc`, `mfaEnabledAt`; e tabela `RefreshToken`(id, userId, familyId, tokenHash @unique, expiresAt, revokedAt?, replacedById?).
- `Customer`(id, resellerId, userId?, nome, doc, whatsapp, cidade).
- `Site`(id, resellerId, customerId, slug @unique (lower), customDomain? @unique, templateId, content Json, status DRAFT|PUBLISHED|READ_ONLY|SUSPENDED|ARCHIVED, planId, editable, publishedAt?, hostingRenewsAt?, plaqueFidelityEndsAt?).
- `Template`, `Plan` (ONE_TIME|RECURRING|ANNUAL_HOSTING), `Coupon`, `Order` — como no plano, com `resellerId`.
- `Product`(id, code @unique: `SITE_PRONTO`, `SITE_PRO`, `PLACA_QR`, `PLACA_NFC`, `RENOVACAO`…, tipo, precoBaseAtacado (centavos), ativo). **Produto ≠ plano.**
- `WholesalePrice`(id, resellerId, productId, priceCentavos, validFrom, validTo?) — **exclusion constraint** (`btree_gist`, `tstzrange(validFrom, validTo)`) sem sobreposição por `(resellerId, productId)`; sem linha vigente → `Product.precoBaseAtacado`.
- `ResellerPrice`(resellerId, productId, precoCentavos) — preço sugerido de venda ao cliente (pré-preenche o formulário de venda).
- `Sale`(id, resellerId, customerId, siteId?, data, status RECORDED|VOIDED, voidedAt?, voidReason?, idempotencyKey, @@unique([resellerId, idempotencyKey])).
- `SaleItem`(id, saleId, resellerId, productId, qty, **unitCostCentavos**, **unitPriceCentavos**, wholesalePriceId?) — congelados; margem do item = `qty × (unitPriceCentavos − unitCostCentavos)` calculada na leitura (pode ser negativa).
- `LedgerEntry`(id, resellerId, tipo IN|OUT, categoria (`VENDA`, `FATURA_PLATAFORMA`, `COMPRA_PLACA`, `MANUAL`, `ESTORNO`…), valorCentavos > 0, data, refType?, refId?, reversalOfId? @unique, createdBy, createdAt). Venda → IN; fatura da plataforma e compra de placa → OUT (Alicerce).
- `Plaque`(id, resellerId, codigo, tipo QR|NFC, status, gifted, valorCentavos?).
- `PlaqueMovement`(id, resellerId, plaqueId?, tipo IN|OUT|ADJUST, qty, unitCostCentavos?, siteId?, saleItemId?, motivo, createdBy, createdAt). `PlaqueStock` = **view** (saldo e custo médio por `resellerId, tipo`).
- `Subscription`(id, resellerId, siteId?, gateway, gatewaySubId, status, currentPeriodEnd).
- `ResellerInvoice`(id, resellerId, **competencia** AAAA-MM, totalCentavos, status OPEN|PAID|OVERDUE|CANCELED, dueDate, gatewayPaymentId?, @@unique([resellerId, competencia])) + `InvoiceLine`(id, invoiceId, resellerId, siteId?, productId?, descricao, qty, unitCentavos, totalCentavos) — **foto no fechamento**: sites PUBLISHED + READ_ONLY.
- `Payment`(id, resellerId, gateway, gatewayPaymentId @unique, metodo, valorCentavos, status, paidAt?).
- `WebhookEvent`(id, gateway, eventId, payload, status RECEIVED|PROCESSING|PROCESSED|FAILED, attempts, error?, processedAt?, @@unique([gateway, eventId])) — sem `resellerId` (resolvido no processamento); acesso só pelo worker/admin.
- `LifecycleEvent`(id, resellerId, siteId?, de, para, motivo, **penaltyCentavos?** (multa gravada), occurredAt, jobRunId?) — trilha do job de atraso e das mudanças de status do revendedor.
- `AuditLog`(id, actorId, role, acao, entidade, entityId, diff Json (sem segredos), ipHash, requestId, ts) — append-only.
- `ScanEvent`, `ReservedSlug` — como no plano.
- Índices: `(resellerId, createdAt, id)` em toda tabela escopada; políticas RLS em todas elas.

## Regras de negócio (Alicerce §4, implementar exatamente assim)
- **Revendedor**: só o ADMIN cria (com convite), define atacado, bloqueia e migra. RESELLER cria clientes e sites no próprio tenant; publicar → `PUBLISHED` em `slug.sejaengajado.com.br` (sem DNS/cert; invalida o cache do by-host); publicar exige conteúdo válido. Criar/publicar bloqueado em DELINQUENT (`RESELLER_DELINQUENT`) e BLOCKED (`RESELLER_BLOCKED`); respeitar `limiteSites`.
- **DELINQUENT** automático ao vencer a fatura: criação bloqueada, sites no ar por `resellerGraceDays` (30); depois o admin pode oferecer migração. **BLOCKED só manual**, com motivo + audit; em fraude, o admin pode suspender os sites na hora. Pagamento confirmado (webhook) → ACTIVE. Toda transição grava `LifecycleEvent`.
- **Venda**: numa transação, resolve o atacado vigente de cada produto, congela custo e preço no `SaleItem`, grava `LedgerEntry` IN (`VENDA`, Σ preço) e, para `PLACA_*`, `PlaqueMovement` OUT. Anular = `VOIDED` + `LedgerEntry` inverso + movimento IN de devolução; nada é apagado.
- **Livro**: IN de vendas; OUT da fatura da plataforma (momento em aberto, D5) e de compra de placa; lançamentos manuais do revendedor; estornos. Extrato com saldo de abertura, movimentos e saldo final.
- **Estoque**: IN (compra/transferência), OUT (venda ou brinde), ADJUST (só ADMIN, com motivo e audit). Brinde só em site Engajado Pro (`SITE_PRO`). Origem das placas em aberto (D6).
- **Fatura do revendedor**: job mensal idempotente por `resellerId + competencia`; linhas = foto dos sites PUBLISHED + READ_ONLY no fechamento × atacado congelado (e mensalidade se D3 confirmar); cobrança Asaas.
- **Cliente mensal (Pro)**: dia 1 = dia seguinte a `currentPeriodEnd` (SP); faixas `>=`: 1–7 aviso **só por e-mail**; ≥8 READ_ONLY; ≥16 SUSPENDED; ≥60 ARCHIVED; reativação no webhook. Job idempotente (só transiciona se o alvo difere), grava `LifecycleEvent`.
- **Multa da placa**: `ceil(plaqueValueCentavos × mesesRestantes/12 × plaquePenaltyPct/100)`, `mesesRestantes` arredondado para cima, valor gravado em `LifecycleEvent.penaltyCentavos`.
- **Pronto**: 1º ano incluso; renovação anual `prontoRenewalCentavos`; placa = add-on pago.

## Endpoints por papel
**Público**: `GET /health`, `GET /ready`, `GET /public/sites/by-host`, `GET /public/r/:slug/avaliar`, `POST /webhooks/:gateway`.
**Auth**: `GET /auth/me` (role, resellerId, status do revendedor e flags para o painel) nas duas variantes. Só D1-B: `POST /auth/login`, `/auth/mfa/verify`, `/auth/refresh`, `/auth/logout`, `/auth/invite/accept`, `/auth/password/forgot|reset`, `/auth/mfa/setup|enable`.
**ADMIN** (MFA obrigatório, tudo auditado):
- `GET|POST /admin/resellers`, `GET|PATCH /admin/resellers/:id`, `POST /admin/resellers/:id/block` (motivo obrigatório) `|unblock|resend-invite|offer-migration`, `POST /admin/resellers/:id/suspend-sites`, `GET /admin/resellers/:id/summary`, `POST /admin/resellers/:id/impersonate` (auditado, somente leitura — D13)
- `GET|POST|PATCH /admin/reseller-plans`, `GET|POST|PATCH /admin/products`
- `GET /admin/resellers/:id/wholesale` (vigente + histórico), `POST /admin/resellers/:id/wholesale` (nova vigência)
- `GET /admin/sales?resellerId&from&to`, `GET /admin/resellers/:id/ledger`, `GET /admin/plaques/stock`, `POST /admin/plaques/movements` (IN, ADJUST)
- `GET /admin/invoices`, `POST /admin/invoices/:id/resend`, `GET /admin/webhooks/events?status`, `POST /admin/webhooks/events/:id/reprocess`, `GET /admin/lifecycle-events`
- `GET /admin/audit-logs`, `GET|PUT /admin/config` (+ planos, cupons, templates e relatórios do cursor-02)
**RESELLER** (escopado):
- `GET /reseller/dashboard` (sites ativos, vendas e margem do mês, saldo, estoque, fatura aberta)
- `CRUD /reseller/customers`, `CRUD /reseller/sites`, `POST /reseller/sites/:id/publish|unpublish`, `GET /reseller/slugs/check?slug=`
- `GET /reseller/wholesale`, `GET|PUT /reseller/prices`
- `GET|POST /reseller/sales`, `GET /reseller/sales/:id`, `POST /reseller/sales/:id/void`
- `GET /reseller/ledger?from&to` (`{items,nextCursor,openingCentavos,closingCentavos}`), `POST /reseller/ledger/entries`, `POST /reseller/ledger/entries/:id/reverse`
- `GET /reseller/plaques/stock`, `GET|POST /reseller/plaques/movements`
- `GET /reseller/invoices`, `GET /reseller/invoices/:id` (linhas + link PIX/boleto), `CRUD /reseller/goals`
**CUSTOMER**: `GET /customer/sites`, `GET|PATCH /customer/sites/:id` (só se `editable` e status ∉ {READ_ONLY, SUSPENDED, ARCHIVED} → senão `SITE_NOT_EDITABLE`), usado pelo editor de aparência do Lumen B5.

---

## Bloco 1: Fundação de produção
Esqueleto NestJS (complete o do cursor-02 B1 se existir): config zod com `*_FILE` (falha na subida), `nestjs-pino` com redact + `requestId`/`resellerId`, Sentry, filtro global de erro, pipe zod global, helmet, **CORS conforme o Contrato**, throttler (global + duro em auth/OTP, webhooks, by-host), `/health` e `/ready`, shutdown gracioso, `money.ts`, helper de cursor e de `Idempotency-Key`.
**Pronto:** `/health` 200; `/ready` 503 sem DB e 200 com DB; config inválida derruba a subida; testes do formato de erro (incl. `fields`), da paginação e do CORS (origem `https://x.sejaengajado.com.br` recusada, `app.` aceita); log sem `authorization`/`cookie`. Commit. **PARE.**

## Bloco 2: Schema, migrations, RLS e seeds
Modelos acima + migration SQL: grants do usuário de app, triggers append-only (`LedgerEntry`, `PlaqueMovement`, `AuditLog`), view `PlaqueStock`, exclusion constraint de `WholesalePrice`, `CHECK`s (`valorCentavos > 0`, `qty > 0`), índice `lower(slug)`, **políticas RLS** em toda tabela escopada. Seed idempotente: revendedor "Plataforma" (se D2 aprovada; senão deixar a migration preparada e parar), admin, 2 revendedores de exemplo, `Product`s com `precoBaseAtacado` **placeholder** (D4), planos/templates/slugs/configs do cursor-02.
**Pronto:** `migrate deploy` limpo no Testcontainers; seed 2× sem duplicar; testes: UPDATE em `LedgerEntry` falha; vigências sobrepostas falham; com `app.reseller_id`=A um `SELECT` cru não retorna linhas de B. Commit. **PARE.**

## Bloco 3: Harness de testes
Jest + Testcontainers (Postgres por suíte, migrations, conexão com o **usuário de app** e RLS ativo, truncate entre testes), factories, supertest, `loginAs(role, resellerId?)`, `FakeGateway`, relógio fixo.
**Pronto:** `test` e `test:int` rodam; exemplo de cada passa. Commit. **PARE.**

## Bloco 4: Auth, RBAC, tenant e MFA — **requer decisão D1 antes de começar**
Comum: `@Roles()` + `RolesGuard`, `TenantScope` (role/`resellerId` do DB), extensão Prisma fail-closed + `SET LOCAL app.reseller_id`, conexão ADMIN separada, `GET /auth/me`.
- **D1-A (Alicerce)**: guard que valida o JWT do Supabase via JWKS, upsert do `User`; ADMIN exige MFA TOTP do Supabase (`aal2` no token).
- **D1-B (auth própria)**: Argon2id, access 15 min, refresh rotativo em cookie `__Host-` com detecção de reuso (revoga a família), convite e reset por token de uso único, TOTP obrigatório para ADMIN, lockout progressivo, checagem de `Origin` no refresh.
**Pronto:** matriz papel × rota (401/403); admin sem MFA bloqueado; teste de que um claim forjado de role/reseller não muda o acesso; (D1-B) reuso de refresh revoga a família e o cookie sai com os atributos certos. Commit. **PARE.**

## Bloco 5: Auditoria
`AuditService` + interceptor nas rotas ADMIN e nos eventos listados no padrão 11; diff sem segredos.
**Pronto:** criar revendedor, nova vigência de atacado, BLOCK e ADJUST de estoque geram `AuditLog`; UPDATE/DELETE no `AuditLog` falha; senha/token nunca aparecem. Commit. **PARE.**

## Bloco 6: Revendedores (admin)
CRUD de revendedor e `ResellerPlan`, convite, block (motivo) / unblock, suspend-sites, summary; transições gravam `LifecycleEvent`.
**Pronto:** e2e convite → acesso do revendedor; BLOCKED não opera; block sem motivo → `VALIDATION_FAILED`. Commit. **PARE.**

## Bloco 7: Clientes e sites do revendedor
CRUD escopado, `slugs/check`, publicar/despublicar com invalidação do cache, validação do `content` (inclui os campos do Lumen), bloqueios por status e limite.
**Pronto:** testes de slug (regex, reservado, marca, caixa diferente); **A↔B**: A recebe 404 ao ler/editar/publicar site ou cliente de B e não vê B em listas; DELINQUENT → `RESELLER_DELINQUENT`; `content` com `theme`/`sections`/`strip` válido passa e `brandColor` inválido falha. Commit. **PARE.**

## Bloco 8: Produtos e atacado com vigência
CRUD de `Product`; nova vigência fecha a anterior na mesma transação; resolução vigente com fallback para `precoBaseAtacado`.
**Pronto:** testes de resolução (override > base; troca no meio do mês; fuso SP); RESELLER só lê o próprio atacado. Commit. **PARE.**

## Bloco 9: Livro (LedgerEntry)
`append`, `reverse` (segundo estorno → `ALREADY_REVERSED`, também concorrente), saldo e extrato.
**Pronto:** saldo = Σ; estorno anula; extrato fecha (abertura + movimentos = final); isolamento A↔B. Commit. **PARE.**

## Bloco 10: Estoque (PlaqueMovement + view PlaqueStock)
`StockService.move()` com `pg_advisory_xact_lock(resellerId, tipo)`, checagem de saldo pela view, custo médio inteiro; brinde só para `SITE_PRO`; ADJUST só ADMIN.
**Pronto:** saída acima do saldo → `STOCK_INSUFFICIENT`; **20 saídas concorrentes** com saldo 10 → exatamente 10 sucessos e saldo 0; isolamento. Commit. **PARE.**

## Bloco 11: Vendas (Sale + SaleItem) e margem
`SalesService.record()` (transação: atacado vigente → itens congelados → `LedgerEntry` IN → movimentos de placa), idempotência por `Idempotency-Key`, `void()` com estornos.
**Pronto:** margem com valores conhecidos (vários itens, qty > 1, margem negativa); nova vigência de atacado não altera venda antiga; mesma chave não duplica nada e corpo diferente → 409; void gera inversos e devolve estoque; falha no estoque desfaz tudo. Commit. **PARE.**

## Bloco 12: Driver de pagamento e adaptador Asaas
cursor-03 B1 e B2 (interface, registry, `FakeGateway`, adapter sandbox com timeouts e retry só em operações idempotentes).
**Pronto:** critérios do cursor-03 + lint de fronteira (domínio não importa o adapter). Commit. **PARE.**

## Bloco 13: Webhooks idempotentes e fila
`POST /webhooks/:gateway` conforme padrão 5; worker com `FOR UPDATE SKIP LOCKED` (ou pg-boss, D7), backoff, `FAILED` após N tentativas, reprocesso pelo admin.
**Pronto:** token inválido 401 sem gravar; duplicado = 1 efeito; fora de ordem não regride; falha → retry → sucesso; reprocesso idempotente. Commit. **PARE.**

## Bloco 14: Fatura e inadimplência do revendedor
Job mensal de `ResellerInvoice` + `InvoiceLine` (foto PUBLISHED + READ_ONLY, idempotente por competência), cobrança Asaas, job diário de DELINQUENT com `resellerGraceDays`, reativação no webhook, `LedgerEntry` OUT da fatura (momento conforme D5), `LifecycleEvent` em toda transição.
**Pronto (relógio fixo, fuso SP):** job 2× não duplica; site SUSPENDED fora da fatura e READ_ONLY dentro; vencida → DELINQUENT e criação bloqueada; sites no ar até o dia 30; depois elegível a migração; pagamento → ACTIVE. Commit. **PARE.**

## Bloco 15: Jobs do cliente direto
cursor-02 B10 e cursor-03 B5 com as regras do Alicerce §4 (faixas `>=`, só e-mail, `LifecycleEvent`, multa com `ceil` gravada), heartbeat dos jobs.
**Pronto:** testes de cada faixa com fake timers, reexecução idempotente, multa nos casos 0, 1 e 12 meses restantes. Commit. **PARE.**

## Bloco 16: Dashboard e relatórios do revendedor
Dashboard, vendas por período (custo, cobrado, margem derivados dos itens), extrato.
**Pronto:** totais batem com a seed; `EXPLAIN` sem seq scan nas tabelas grandes. Commit. **PARE.**

## Bloco 17: Endurecimento e checklist
OpenAPI completo (com exemplos de erro e paginação, base para gerar os tipos do `HttpApiService`), Dockerfile multi-stage não-root, `npm audit`, `migrate deploy` manual.
**Pronto:** checklist abaixo marcado ou com pendências listadas. Commit. **PARE.**

## Checklist de produção
> Espelho atualizado em `api/PRODUCTION-CHECKLIST.md` (02-B16). `/health/ready` e mesma origem (sem CORS).

- [x] Config validada; segredos só por Docker secrets; `.env.example` completo.
- [x] `prisma migrate deploy` manual antes do deploy; sem `db push`.
- [x] Usuário de app sem superuser/`BYPASSRLS`; RLS ativo e testado; conexão ADMIN separada.
- [x] `/health` e `/health/ready` nos healthchecks (Atlas usa `/api/health/ready`).
- [ ] Logs pino JSON com `requestId`/`resellerId`, redact testado; Sentry com release. *(Sentry → 06)*
- [x] Sem CORS (mesma origem); rate limit Nest; helmet; body limit. *(Traefik/HSTS → 06)*
- [x] Auth Supabase; MFA admin (`aal2`); role/reseller do DB.
- [x] Matriz RBAC + A↔B verde no CI (bloqueia merge).
- [x] `LedgerEntry`, `PlaqueMovement`, `AuditLog` append-only por grant + trigger.
- [x] Estoque com lock e teste de concorrência verde.
- [ ] Webhook: token, unique, fila, retries, reprocesso, reconsulta. *(→ 05)*
- [x] Jobs idempotentes, com lock e heartbeat.
- [x] Dinheiro só em centavos inteiros (lint contra `parseFloat`/`Decimal` em valores).
- [x] Contrato da API em OpenAPI (`/api/docs-json`) para o `HttpApiService`.
- [ ] Backups e restore testado (Alicerce §8 / cursor-04 B5); retenção de `WebhookEvent` e logs (LGPD). *(→ 06)*
- [ ] Valores reais em `PlatformConfig` e atacado inicial cadastrado. *(⏳P6)*
- [ ] Cobertura unitária ≥ 90% em sales/ledger/stock/jobs/tenant *(suíte int cobre os caminhos; unificar coverage ⏳; billing/webhooks → 05)*

---

## Divergências e pontos abertos (precisam de decisão do Tarciso)
**Resolvidos pelo Alicerce** (incorporados acima, saíram da lista): tenancy (banco único, `resellerId` NOT NULL, guard + extensão + RLS); BLOCKED só manual com motivo e suspensão em fraude (era o D8); estrutura do atacado com vigência por `Product`; `Sale`/`SaleItem` congelados com margem derivada; `PlaqueStock` como saldo derivado; `ResellerInvoice` + `InvoiceLine` com foto PUBLISHED + READ_ONLY; `LifecycleEvent` com multa gravada; fórmula da multa; avisos só por e-mail; resposta "venda → IN, fatura → OUT" no livro.

**Divergências com o Alicerce**
- **D1 — Auth.** O Alicerce (§6), o plano e o cursor-02 B3 decidem **Supabase Auth com OTP por e-mail** e JWKS. Os padrões do Tarciso pedem **Argon2id, refresh rotativo e MFA para o admin** (auth própria). O Bloco 4 traz as duas variantes e só começa com a decisão. Opções: (A) Supabase para todos, com MFA do Supabase para o admin; (B) auth própria para todos; (C) híbrida (OTP Supabase para CUSTOMER, auth própria para ADMIN/RESELLER).
- **D10 — Rota de prontidão.** O Alicerce usa `/health/ready`; o pedido do Tarciso usa `/ready`. O prompt usa `/ready`; o Atlas precisa usar a mesma rota no healthcheck.
- **D14 — Nomes em português.** Adotar os nomes do Alicerce (`priceCentavos`, `competencia`, `precoBaseAtacado`, `PLACA_QR`) contraria a regra "código em inglês" dos cursor-01..04. Adotei os do Alicerce; confirmar ou padronizar em inglês.
- **D15 — Livro na venda.** O Alicerce lança só IN (receita) na venda; o custo de atacado entra pela fatura (OUT). Assim, a margem do livro só aparece quando a fatura chega e não bate venda a venda com a margem do `SaleItem`. Alternativa: lançar também OUT do custo na venda (com risco de contar o custo duas vezes quando a fatura vier). Mantive o Alicerce.

**Pontos que continuam com o Tarciso (alguns já marcados [DECIDIR]/[PENDENTE] pelo Alicerce)**
- **D2 — Revendedor "Plataforma"** no lugar de `resellerId = null` para venda direta.
- **D3 — Mensalidade do `ResellerPlan`** continua ao lado do atacado por site ativo?
- **D4 — Valores de atacado** por produto (e se Pronto ≠ Pro na fatura); seeds usam placeholders.
- **D5 — Momento do OUT da fatura** no livro: emissão (competência) ou pagamento (caixa).
- **D6 — Origem das placas**: compradas da plataforma (gera OUT + linha de fatura) ou de terceiros; e se o revendedor pode dar brinde fora do Pro.
- **D7 — Fila**: tabela + `SKIP LOCKED`/pg-boss (sem Redis) ou BullMQ (Redis é opcional no Alicerce/Atlas).
- **D9 — Estorno/chargeback** de pagamento já confirmado: proposta = lançamento inverso e fatura volta a OVERDUE.
- **D13 — Impersonação do admin**: o Alicerce manda auditar, mas não define o escopo; proposta = somente leitura.
- **D16 — RLS na F1**: o Alicerce permite adiar o RLS se atrasar o MVP; este prompt o coloca no Bloco 2. Confirmar.

**Divergências e pontos com o Lumen/front**
- **D11 — Total na lista `/sites`.** O Lumen B6 pede "contagem de resultados" e "paginação simples"; o padrão é cursor sem total nem páginas numeradas. Opções: o front usa "Carregar mais" sem total; ou a API devolve `totalCount` opcional (`?withTotal=true`) além de `{items,nextCursor}`.
- **D12 — Erro de validação com `fields`.** Estende `{code,message}` com um campo opcional para os formulários spartan; confirmar que isso respeita o padrão.
- **D17 — Host da API.** O Atlas usa `api.sejaengajado.com.br` (exige CORS e, na D1-B, cookie same-site com checagem de `Origin`, já que os tenants são same-site). Alternativa: servir a API em `app.sejaengajado.com.br/api` (mesma origem, sem CORS). O prompt segue o Atlas.
- **D18 — Versões no cursor-01.** Ele ainda diz Angular 19.2/Tailwind 3.4; o Lumen confirma 22.2/4.3/spartan e o Alicerce marcou [DECIDIR]. Isso não afeta a API, mas o cursor-01 B2/B8 (tipos e `HttpApiService`) precisa ser atualizado com os modelos novos (`Product`, `WholesalePrice`, `Sale`/`SaleItem`, `LedgerEntry`, `PlaqueMovement`, `ResellerInvoice`).
