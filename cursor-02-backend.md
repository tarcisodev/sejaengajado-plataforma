# Cursor — Fase 02: Backend (NestJS 11 + Prisma + Postgres + Supabase Auth)
Leia ../00-plano.md (seções 6 e 7).
## Regras gerais (valem para todos os blocos)
- Execute **um bloco por vez**. No fim de cada bloco: rode os testes, faça commits pequenos (Conventional Commits) e **PARE**, mostrando um resumo e o que testar. Só siga quando eu disser "continuar".
- **Nenhum segredo no código.** Use `.env.example` com placeholders e leia de env/Docker secrets. Mantenha `.env` no `.gitignore`.
- **Sem deploy automático** e sem rodar comandos contra produção.
- Textos da UI em pt-BR. Código e nomes em inglês.

## Bloco 1: Setup
NestJS 11 com config validada (zod ou Joi), Prisma, docker-compose **local** (Postgres), healthcheck `/health`, logger com pino e Swagger.
**Pronto:** `docker compose up` local e `/health` OK. Commit. **PARE.**

## Bloco 2: Schema Prisma
Modelos da seção 7 (incluindo `PlatformConfig`, status do Site DRAFT|PUBLISHED|READ_ONLY|SUSPENDED|ARCHIVED, `hostingRenewsAt`, `plaqueFidelityEndsAt`, Reseller ACTIVE|DELINQUENT|BLOCKED com `blockedAt`/`blockReason`, `Cancellation`, `ResellerInvoice`, `NoticeLog`, Plan com ANNUAL_HOSTING), mais a seed (planos Pronto/Mensal/renovação anual, 3 templates, slugs reservados, configs default de atraso 1/8/16/60 e clientes fictícios).
**Pronto:** a migration aplica, a seed roda e há testes de constraints únicas (slug e domínio). Commit. **PARE.**

## Bloco 3: Auth Supabase
Guard que valida o JWT do Supabase via JWKS (`SUPABASE_URL` em env), faz upsert do `User` e aplica `@Roles(ADMIN|RESELLER|CUSTOMER)`. Isolamento de tenant: um CUSTOMER só vê os próprios sites; um RESELLER, só os sites dos seus clientes. Implementar `TenantScope` (resellerId do token) aplicado via guard + extensão Prisma que injeta `where: { resellerId }` em todo model escopado; ADMIN ignora o escopo.
**Pronto:** testes e2e de 401/403 e de vazamento entre revendedores e entre clientes (matriz papel × recurso). Commit. **PARE.**

## Bloco 4: Sites e templates
CRUD de Template (admin) e de Site. O `content` é validado contra o `template.schema` (JSON Schema/ajv). Validação de slug: regex `^[a-z0-9](-?[a-z0-9]){2,30}$`, reservados, blocklist de marcas e unicidade. Edição pelo cliente só se `editable`, assinatura ativa e status ≠ READ_ONLY/SUSPENDED/ARCHIVED. AuditLog em toda alteração.
**Pronto:** testes unitários dos validadores e e2e do CRUD. Commit. **PARE.**

## Bloco 5: Resolução por host
`GET /public/sites/by-host?host=` (público, com throttle e cache em memória/Redis por 60 s, invalidado ao publicar). Suporta slug (e `customDomain` só na fase 2). Retorna só os campos públicos; se SUSPENDED, retorna flag para a página "temporariamente indisponível"; se ARCHIVED, 410. `GET /public/r/:slug/avaliar` registra um ScanEvent (IP com hash) e redireciona para o link de review.
**Pronto:** testes de slug, suspenso, arquivado, inexistente e cache. Commit. **PARE.**

## Bloco 6: Planos, cupons, configs e descontos
CRUD de Plan e Coupon. `PlatformConfig` (admin): prazos de atraso (`notifyFromDias` 1, `readOnlyDias` 8, `suspendDias` 16, `archiveDias` 60), `prontoRenewalCentavos` (hipótese 9900–14900), `plaqueValueCentavos`, `plaquePenaltyPct`, `resellerGraceDays` (default 30). `PricingService.quote(planId, couponCode)` com regras de validade, máximo de usos, planos permitidos e valores em centavos inteiros. Cria a Order. Multa da placa, datas civis em `America/Sao_Paulo`: `mesesRestantes = ceil(diasRestantes / 30)`; `multaCentavos = floor(plaqueValueCentavos × mesesRestantes × plaquePenaltyPct / 1200)` (divisão inteira; só o mês arredonda para cima). Se `diasRestantes <= 0`, multa 0. Cancelar grava `Cancellation` com os insumos e `multaCentavos`; a Order copia esse valor e não relê o config.
**Pronto:** testes de tabela de preços (PCT, FIXED, cupom expirado, desconto maior que o preço), da multa (mês incompleto, dia exato, fidelidade vencida) e de que alterar `plaqueValueCentavos` depois não muda o `Cancellation` já gravado. Commit. **PARE.**

## Bloco 7: Relatórios
`/admin/reports/revenue?from&to&resellerId`: bruto, descontos, líquido, MRR, churn, sites por cliente e revendedor, inadimplentes, renovações anuais do Pronto. Valores sempre a partir de Payment com status pago.
**Pronto:** os testes com seed fecham os totais esperados. Commit. **PARE.**

## Bloco 8: Integrar o front
Implementar o `ApiPort` HTTP no Angular, substituindo o mock por env. O SSR usa o by-host.
**Pronto:** o fluxo de ponta a ponta local funciona. Commit. **PARE.**

## Bloco 9: Revendedores (modelo e endpoints)
Modelos: `Reseller`, `ResellerPlan` (custoPorSiteAtivoCentavos), `ResellerPrice`, `ResellerGoal`, `PlaqueStock`/`PlaqueMovement`; `resellerId` em Customer, Site, Order, Payment.
Endpoints:
- Admin: `POST/GET/PATCH /admin/reseller-plans`, `POST/GET/PATCH /admin/resellers` (convite por e-mail → Supabase, define plano), `GET /admin/resellers/:id/summary`, `POST /admin/resellers/:id/offer-migration` (só após grace de `DELINQUENT`), `POST /admin/resellers/:id/block` (`reason` obrigatório + `siteIds` ligados à fraude → status `BLOCKED`, `AuditLog`, esses sites `SUSPENDED` na hora), `POST /admin/resellers/:id/unblock` (volta a poder criar; não republica sites), cupons com `resellerId?`.
- Revendedor (`@Roles(RESELLER)`, escopado): `GET /reseller/dashboard`, `CRUD /reseller/customers`, `CRUD /reseller/sites` (**403 se DELINQUENT ou BLOCKED** ao criar), `PUT /reseller/prices`, `CRUD /reseller/goals`, `GET/POST /reseller/plaques` (movimentos; brinde só no mensal), `GET /reseller/finance?from&to`.
- `BillingService.resellerInvoice(resellerId, mes)` = mensalidade + (foto no fechamento × custo por site). Site ativo = `PUBLISHED` ou `READ_ONLY` naquele instante. Persiste `ResellerInvoice` com `activeSiteIds`, preços e total; único por `resellerId+mes`. Não usa o pico do mês.
**Pronto:** testes da foto do fechamento (site que ficou ativo no meio do mês e já está suspenso no fechamento não entra), bloqueio manual com motivo vazio rejeitado (400), suspensão imediata dos `siteIds`, 403 ao criar em DELINQUENT e em BLOCKED, e e2e de isolamento em todos os endpoints `/reseller/*`. Commit. **PARE.**

## Bloco 10: Jobs de atraso, renovação e fidelidade
Job diário no fuso `America/Sao_Paulo`. `diasAtraso` = diferença de datas civis entre hoje e `currentPeriodEnd` (0 no dia do vencimento). Faixas com `>=`, lendo `PlatformConfig`:
1. **Mensal atrasado:** `>= notifyFromDias` (1) e `< readOnlyDias` (8) → avisar; `>= 8` e `< 16` → `READ_ONLY`; `>= 16` e `< 60` → `SUSPENDED`; `>= 60` → `ARCHIVED`. Antes de avisar, inserir `NoticeLog` (`entityType`, `entityId`, `kind`, `localDate`); conflito único = não reenviar. Rodar o job duas vezes no mesmo dia não duplica aviso nem oscila status.
2. **Reativação:** tratada no webhook Asaas (cursor-03) — ao pagar, volta a PUBLISHED/editable.
3. **Pronto:** gerar Order/cobrança de renovação anual quando `hostingRenewsAt` se aproxima; se não pagar no prazo, a mesma máquina (`diasAtraso` a partir do vencimento da renovação).
4. **Revendedor inadimplente:** marcar `DELINQUENT` e bloquear criação; sites permanecem no ar durante `resellerGraceDays` (30); depois ficam elegíveis a migração. `BLOCKED` não entra neste job.
5. **Cancelamento mensal com placa brinde:** cria `Cancellation` + Order com `multaCentavos` já gravado (fórmula do bloco 6).
**Pronto:** testes de cada transição com datas fixas (fake timers, fuso São Paulo), inclusive o dia do vencimento (`diasAtraso = 0`) e o dia 16 já suspenso; segunda execução no mesmo dia não cria outro `NoticeLog`. Commit. **PARE.**

## Bloco 11 (opcional, depois): Leads
Busca de negócios sem site (Google Places API, chave em env, respeitar termos). Não implementar no MVP.
