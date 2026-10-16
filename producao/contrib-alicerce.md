# Seja Engajado — ADR-001 + Checklist de go-live (Alicerce, 15/10/2026)

> Base: `00-plano.md`, `cursor-01..04`. Não há código da API no repo; tudo abaixo é decisão/alvo, não descrição de implementação existente. **[PENDENTE]** = falta informação ou decisão.

## 1. Contexto
Revendedores vendem biosite + placa Google. Fluxo obrigatório do MVP:
**admin cria revendedor → revendedor cria site do cliente (`cliente.sejaengajado.com.br`) e vende → plataforma cobra o revendedor (Asaas, atacado por site ativo).**
O revendedor precisa de gestão financeira: entradas/saídas, vendas, custo (atacado personalizável por revendedor e produto), preço ao cliente, margem e estoque de placas.

**Lacuna em relação aos docs atuais:** o modelo da seção 7 do plano tem `ResellerPrice` (preço que o revendedor cobra) e `PlaqueStock` (saldo agregado), mas **não** tem tabela de atacado por revendedor/produto com vigência, venda com itens congelados, lançamento financeiro nem movimentação de estoque. Este ADR acrescenta esses itens; os cursor-02/01 precisam ser atualizados (Bloco 2 do backend e Bloco 8 do front).

## 2. Decisão: multi-tenancy
- **Banco único, schema único**, Postgres dedicado (`sejaengajado`) no Supabase self-hosted da VPS, com usuário de app próprio (sem superuser e sem `BYPASSRLS`).
- **Tenant = revendedor.** Toda tabela de negócio carrega `reseller_id` (NOT NULL). Venda direta do Tarciso = um **revendedor "Plataforma"** reservado, em vez de `resellerId = null` como no plano. Isso evita `NULL` no filtro e em RLS. **[DECIDIR]** confirmar a troca.
- **Isolamento em duas camadas:**
  1. Obrigatória: guard `TenantScope` + extensão Prisma que injeta `reseller_id` em todo model escopado (já previsto no cursor-02 B3); model escopado sem escopo **lança erro** (fail-closed).
  2. Defesa em profundidade: **RLS** nas tabelas escopadas com `current_setting('app.reseller_id')` setado por transação (`SET LOCAL`). ADMIN usa role/conexão separada e auditada. Se o RLS atrasar o MVP, ficam só o guard e o teste de vazamento obrigatório; RLS entra até o fim da fase 1.
- **Resolução pelo Host:** `slug.sejaengajado.com.br` → `GET /public/sites/by-host` (cache de 60 s, invalidado ao publicar). Raiz, `app.` e `api.` são reservados (`ReservedSlug` + blocklist). O tenant das rotas autenticadas vem **do token/DB**, nunca do Host nem de header do cliente.

## 3. Modelo de dados (delta sobre a seção 7 do plano)
Valores sempre em **centavos (int)**; datas em `timestamptz` (UTC), regras de calendário em `America/Sao_Paulo`.

| Entidade | Campos-chave | Nota |
|---|---|---|
| `Platform`/`PlatformConfig` | chave, valor, updatedBy | já existe; acrescentar versionamento via audit |
| `Reseller` | status ACTIVE/DELINQUENT/BLOCKED, delinquentSince, blockedReason, blockedBy | BLOCKED só manual, com motivo |
| `User` | supabaseId, email, role ADMIN/RESELLER/CUSTOMER, resellerId | |
| `Customer` | resellerId, nome, doc, whatsapp | |
| `Site` | resellerId, customerId, slug, status, planId, editable, hostingRenewsAt, plaqueFidelityEndsAt | já existe |
| `Product` | code (SITE_PRONTO, SITE_PRO, PLACA_QR, PLACA_NFC, RENOVACAO…), tipo, precoBaseAtacado | **novo** (hoje é só `Plan`; produto ≠ plano) |
| `WholesalePrice` | resellerId, productId, priceCentavos, validFrom, validTo? | **novo**; exclusion constraint sem sobreposição de vigência; fallback = `Product.precoBaseAtacado` |
| `Sale` + `SaleItem` | sale: resellerId, customerId, siteId?, data, status; item: productId, qty, **unitCostCentavos** e **unitPriceCentavos congelados** | **novo**; a margem é derivada e nunca recalculada |
| `LedgerEntry` | resellerId, tipo IN/OUT, categoria, valor, data, refType/refId | **novo**; entradas e saídas do revendedor (venda gera IN; fatura da plataforma e compra de placa geram OUT) |
| `PlaqueMovement` | resellerId, plaqueId?, tipo IN/OUT/ADJUST, qty, unitCost, siteId?, motivo | **novo**; `PlaqueStock` vira saldo derivado (view/materializado) |
| `Plaque` | codigo, tipo, status, gifted, valorCentavos | já existe |
| `Subscription` | resellerId, siteId?, gateway, gatewaySubId, status, currentPeriodEnd | já existe |
| `ResellerInvoice` + `InvoiceLine` | resellerId, competencia (AAAA-MM) **unique**, snapshot dos sites ativos | **novo**; foto no fechamento: sites PUBLISHED + READ_ONLY |
| `Payment` | gateway, gatewayPaymentId unique, status, paidAt | já existe |
| `WebhookEvent` | unique(gateway, eventId), payload, processedAt, error | já existe |
| `LifecycleEvent` | siteId/resellerId, de→para, motivo, **penaltyCentavos** (multa gravada) | **novo**; trilha do job de atraso |
| `AuditLog` | actorId, role, acao, entidade, entityId, diff, ip, ts | append-only (ver §5) |

Pendências do modelo: **[PENDENTE]** se a mensalidade do `ResellerPlan` continua existindo ao lado do atacado por site; se o atacado por site é por produto (Pronto ≠ Pro); se o revendedor compra placas da plataforma (gera OUT + fatura) ou de terceiros.

## 4. Regras fechadas (v1) — implementar exatamente assim
- **Pronto:** hospedagem anual, 1º ano incluso, renovação `prontoRenewalCentavos` (R$99–149, no admin). Placa = add-on pago.
- **Engajado Pro:** placa brinde com fidelidade de 12 meses. Multa = `ceil(plaqueValueCentavos * mesesRestantes/12 * plaquePenaltyPct/100)`, com `mesesRestantes` arredondado para cima; o valor fica **gravado no evento**.
- **Atraso do mensal:** dia 1 = dia seguinte a `currentPeriodEnd` (America/Sao_Paulo). Faixas com `>=`: 1–7 aviso **só por e-mail**; ≥8 READ_ONLY; ≥16 SUSPENDED; ≥60 ARCHIVED. Reativa ao pagar (webhook). O job é **idempotente** (só transiciona se o estado-alvo difere; grava `LifecycleEvent`). Obs.: o plano/cursor citam WhatsApp nos avisos; no MVP é só e-mail.
- **Revendedor:** DELINQUENT automático (criação bloqueada, sites no ar por 30 dias, depois migração via admin). BLOCKED só manual, com motivo + audit; em fraude, o admin pode suspender os sites na hora.
- **Fatura do revendedor:** site ativo = PUBLISHED ou READ_ONLY na foto do fechamento; um job mensal idempotente por `resellerId+competência`.
- Fora do MVP: adesão do mensal, split Asaas (F2), domínio próprio (F2), white label (F3), cobrança do cliente final pela plataforma (F2).

## 5. RBAC e auditoria
- **ADMIN** (Tarciso): tudo; é o único que cria revendedor, define atacado, bloqueia e migra.
- **RESELLER:** só o próprio `reseller_id`: clientes, sites, vendas, ledger, estoque, faturas (leitura). Não vê o atacado de outros nem configs.
- **CUSTOMER:** só os próprios sites; edição se `editable` e status ∉ {READ_ONLY, SUSPENDED, ARCHIVED}.
- Matriz papel × recurso com testes e2e de 401/403/vazamento A↔B (cursor-02 B3), bloqueando o merge.
- **`audit_log` imutável:** o usuário de app só tem `INSERT`/`SELECT` (sem UPDATE/DELETE, mais trigger que rejeita). Registrar: CRUD de revendedor, atacado, configs, mudança de status de site/revendedor, BLOCK com motivo, impersonação do admin, ações de pagamento manual.

## 6. Segurança
- **Auth:** Supabase Auth (OTP por e-mail), com a API validando o JWT via JWKS; role e reseller vêm do DB, não do claim editável. SMTP transacional próprio **[PENDENTE: provedor, SPF/DKIM/DMARC]**.
- **Webhook Asaas:** validar o header `asaas-access-token` (secret) → 401 se inválido; `INSERT WebhookEvent` com unique → duplicado = 200 sem efeito; **reconsultar o pagamento na API Asaas** antes de mudar estado; processamento tolerante a eventos fora de ordem. **[PENDENTE]** IP allowlist do Asaas no Traefik (opcional).
- **Rate limit:** `@nestjs/throttler` (OTP, auth, by-host, webhooks), mais o middleware rateLimit do Traefik.
- **Segredos:** só Docker secrets (`cf_dns_api_token`, `asaas_api_key`, `asaas_webhook_token`, `database_url`, `supabase_jwt/jwks`, `google_places_key`, `sentry_dsn`). A **Google Places key fica só no backend**, restrita por IP da VPS + API. Nada no repo, `.env.example` com placeholders; GHCR com `GITHUB_TOKEN`.
- **Conteúdo/abuso:** blocos estruturados (sem HTML/JS livre), slugs reservados + blocklist de marcas, botão "denunciar", suspensão imediata pelo admin.
- **LGPD básica:** termos + política de privacidade (**[PENDENTE: texto/jurídico]**), coletar o mínimo, IP em hash nos scans, logs sem PII, exportação e exclusão a pedido, a plataforma como operadora em relação aos dados do cliente final do revendedor.
- Headers de segurança (HSTS, CSP básica no app), CORS restrito a `app.`.

## 7. Infra e deploy (padrão Muda QR)
- Swarm, stack `se`: `se-web` (Angular SSR), `se-api` (NestJS), `se-worker` (jobs), Redis opcional. Rede overlay `TarcisoDevNet`, routers `se-*`, `update_config.order: start-first` + rollback, healthchecks.
- CI: GitHub Actions → build/test → GHCR → **runner self-hosted dedicado** na VPS → `docker stack deploy`. `prisma migrate deploy` como passo manual/job antes do deploy (cursor-04 B3).
- **DNS → Cloudflare** (NS trocados na Hostinger, hoje `dns-parking`). Registros `@`, `*`, `app` (e `api` se separado) → IP da VPS, proxy cinza no início.
- ⚠️ **Wildcard `*.sejaengajado.com.br` só sai via DNS-01.** O Traefik é **compartilhado** e hoje provavelmente usa HTTP/TLS-challenge: é preciso adicionar um **certresolver novo** (`dnsChallenge.provider=cloudflare`, `CF_DNS_API_TOKEN_FILE`, token Zone:DNS:Edit + Zone:Read só desta zona) **sem quebrar os outros sites** do Traefik. Testar com o caServer de staging primeiro. **[PENDENTE]** versão do Traefik (v2 vs v3 muda a sintaxe de HostRegexp) e se ele já monta secrets.
- Front: o doc do cursor-01 diz Angular 19.2 + Tailwind 3.4; o padrão Muda QR usa spartan/helm. **[DECIDIR]** alinhar o cursor-01. Mock em dev, `HttpApiService` em prod via env.

## 8. Backups e observabilidade
- `pg_dump` **diário** do banco `sejaengajado`, criptografado (age/gpg), enviado **para fora da VPS** (S3-compatível **[PENDENTE: provedor/bucket]**), retenção de 7 diários + 4 semanais. Backup também dos uploads/imagens **[PENDENTE: onde ficam — Supabase Storage?]**.
- **Restore testado** antes do go-live e depois mensalmente (restore num container descartável + contagem de linhas/smoke). Runbook escrito.
- **Sentry** (api + web SSR + browser), release = SHA do commit; logs JSON (pino) no stdout com `requestId`/`resellerId`, sem PII; `/health` (liveness) e `/health/ready` (DB) nos healthchecks do Swarm; uptime externo (UptimeRobot/BetterStack) em raiz, `app.`, um tenant de teste e `/health`; alerta de expiração do certificado; alerta se o job diário/mensal não rodou (heartbeat).

## 9. MVP x depois
**MVP:** admin (revendedores, atacado com vigência, planos, configs, sites, bloqueio/migração), painel do revendedor mobile-first (criar site, vender, ledger, margem, estoque, faturas), painel do cliente (edição só no Pro), 3 templates, wildcard, `/avaliar` com scans, Asaas (cobrança do revendedor, Pronto/Pro direto, renovação, multa), jobs de atraso, e-mail de aviso, audit, backups, Sentry.
**Depois:** split Asaas e cobrança do cliente final (F2), domínio próprio via Cloudflare for SaaS (F2), Mercado Pago, leads/Google Places import (F2), WhatsApp nos avisos, adesão do mensal, agenda/catálogo com carrinho, white label (F3), RLS completo se não entrar na F1.

## 10. Checklist de go-live
**Código/qualidade**
- [ ] API NestJS criada (não existe ainda) com schema + delta do §3 migrado e seed
- [ ] Testes de vazamento A↔B e da matriz RBAC verdes no CI
- [ ] Testes do job de atraso (fake timers, fuso SP, faixas `>=`, reexecução idempotente)
- [ ] Teste da fórmula da multa (casos de borda: 0, 12 e 1 mês restante) e da fatura mensal sem duplicar
- [ ] Webhook: token inválido 401, duplicado sem efeito, fora de ordem, reconsulta
- [ ] Front trocado para `HttpApiService` em prod; SSR by-host funcionando
**Pagamentos**
- [ ] Fluxo completo no sandbox Asaas: revendedor criado → site → fatura → pago → reativação
- [ ] Conta Asaas de produção aprovada, chave e webhook token como secrets, URL do webhook cadastrada
- [ ] Valores reais em `PlatformConfig` (renovação, placa, %multa, prazos) e atacado inicial cadastrado
**Infra**
- [ ] Zona na Cloudflare com MX/registros de e-mail conferidos antes de trocar NS
- [ ] NS trocados na Hostinger; propagação ok
- [ ] Token CF restrito criado como Docker secret `cf_dns_api_token`
- [ ] Certresolver DNS-01 no Traefik compartilhado; wildcard emitido no **staging** → produção; outros sites do Traefik intactos
- [ ] Banco `sejaengajado` próprio no Supabase, usuário de app sem superuser
- [ ] Runner self-hosted dedicado registrado; pipeline GHCR → `docker stack deploy se` ok; rollback testado
- [ ] `https://teste.sejaengajado.com.br` com cert wildcard válido; `app.` e raiz ok
**Operação/segurança**
- [ ] Backup diário offsite rodando + **restore testado** e documentado
- [ ] Sentry recebendo erros de api/web; uptime e alerta de cert ativos; heartbeat dos jobs
- [ ] Rate limit (Nest + Traefik) e headers de segurança ativos
- [ ] SMTP com SPF/DKIM/DMARC; e-mail de OTP e de aviso entregando
- [ ] Termos de uso, política de privacidade e contrato do revendedor publicados
- [ ] Slugs reservados + blocklist carregados; botão denunciar e suspensão admin testados
- [ ] Piloto: 1 revendedor + 5 clientes reais em Uberaba

## 11. Riscos e pendências
- **Wildcard/Traefik compartilhado:** mexer no Traefik pode afetar os outros projetos → staging + janela + OK do Tarciso (execução pelo Atlas, cursor-04).
- **Modelo financeiro do revendedor ausente nos docs** (atacado com vigência, venda, ledger, movimentação) → atualizar cursor-02 B2 e cursor-01 B8 antes de codar.
- **Vazamento entre revendedores** é o risco nº 1 de produto → fail-closed + testes no CI; RLS como segunda camada.
- **Abuso de subdomínio** derruba a reputação do domínio inteiro (Safe Browsing) → moderação e suspensão rápida.
- Pendências: venda direta como revendedor "Plataforma"?; mensalidade do revendedor + atacado ou só atacado?; preço de atacado por produto do site; origem das placas; provedor de backup offsite e de SMTP; storage de imagens; versão do Traefik; stack do front (Tailwind puro vs spartan/helm); textos jurídicos LGPD; WhatsApp nos avisos citado no plano, mas MVP = só e-mail.
