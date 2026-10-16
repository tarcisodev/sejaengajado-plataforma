# Seja Engajado — PROMPT MESTRE de produção (índice) · 15/10/2026

> Para o Cursor local do Tarciso. Projeto: `E:\dev\sejaengajado\plataforma\` (`web/` = Angular, `api/` = NestJS, `infra/`).
> Fontes: `00-plano.md`, `cursor-01..04`, `contrib-alicerce.md` (ADR), `contrib-lumen.md` (visual), `contrib-nucleo.md` (backend), `contrib-atlas.md` (infra). **Onde houver conflito, vale este prompt.**

## 🛑 FASE 0 — Pré-requisitos na VPS (ANTES DE QUALQUER DEPLOY)
Estado em 03/10 (não re-verificado): VPS Hostinger KVM 2 (2 vCPU, 7,8 GiB), **~390 MB de RAM livre e nenhum swap**, logs Docker sem rotação (~7,5 GB), SSH com senha e root, sem firewall, portas Swarm 2377/7946/4789 abertas, **Portainer público**, nenhum backup de banco.
Nenhum bloco de deploy (PRODUCAO-06) começa sem os itens abaixo marcados. Cada um exige OK explícito do Tarciso, e quem executa é ele ou o Atlas. O Cursor não roda nada na VPS.
1. Levantamento read-only atualizado (`free -m`, `swapon --show`, `docker stats`, versão e args do Traefik, `ufw status`, `sshd -T`).
2. **Liberar RAM** (parar stacks ociosos) até ter ≥ 1,2 GB livre, **ou subir para o KVM 4** (16 GB). ⏳P21
3. **Criar swap** de 4 GB (`vm.swappiness=10`) e configurar a rotação de logs do Docker.
4. **Hardening:** SSH só por chave (`PasswordAuthentication no`, root sem senha), fail2ban, firewall (só 22, 80 e 443; no Docker, via firewall da Hostinger ou `DOCKER-USER`), **Portainer fechado** (túnel SSH ou Tailscale).
5. **Testar o certresolver novo (`cfdns`, DNS-01 Cloudflare) no staging do Let's Encrypt**, numa **janela marcada** (⏳P22), com backup do `acme.json` e do spec do Traefik e `docker service rollback traefik` pronto.
Detalhe passo a passo: `PRODUCAO-01-fundacao.md`, blocos F0.1 a F0.6.

## Versões e stack (fonte: package.json, 15/10/2026)
- Front: **Angular 22.2** (standalone, signals, **Angular SSR** `@angular/ssr`), TypeScript ~6.0, **Tailwind 4.3** CSS-first (`@tailwindcss/postcss`, `@theme`, sem `tailwind.config.js`), **spartan 1.6.3** (`@spartan-ng/brain` + helm) **só no painel** `app.`.
- Back: Node 22 LTS, **NestJS 11 + Prisma 6 + Postgres 16**, zod, pino, `@nestjs/throttler`, Jest + Testcontainers.
- Pagamentos: **Asaas** (sandbox até o go-live), atrás da porta `PaymentGateway`. DNS: **Cloudflare** (o registro continua na Hostinger). Infra: Docker Swarm + Traefik v3 compartilhado, GHCR e runner self-hosted.
- ⚠️ Qualquer menção a "Angular 19", "Tailwind 3.4" ou "TypeORM" nos docs antigos está **errada**: use as versões acima e Prisma.

## Arquitetura (resumo obrigatório)
- **Banco único e schema único.** Tenant = revendedor. Toda tabela de negócio tem `reseller_id NOT NULL`. A venda direta usa o revendedor reservado "Plataforma" (⏳P1).
- Isolamento: **guard `TenantScope` + extensão do Prisma fail-closed** (camada 1, obrigatória) e **RLS** com `SET LOCAL app.reseller_id` (camada 2). O tenant das rotas autenticadas vem do token e do banco, nunca do Host nem de header.
- **Site público resolvido pelo Host:** `slug.sejaengajado.com.br` → SSR → `GET /api/public/sites/by-host` (chamada interna `http://api:3000`) (cache de 60 s, invalidado ao publicar). Raiz, `app`, `api`, `www` etc. são slugs reservados. Um único certificado wildcard cobre tudo.
- **Modelo financeiro (Alicerce):** `Product`, `WholesalePrice` (por revendedor e produto, com vigência `validFrom/validTo`, sem sobreposição), `Sale` + `SaleItem` (com **unitCostCents e unitPriceCents congelados**), `LedgerEntry` (IN/OUT, append-only), `PlaqueMovement` (o saldo de placas é derivado), `ResellerInvoice` + `InvoiceLine` (snapshot por competência) e `LifecycleEvent` (com a multa gravada). Dinheiro sempre em centavos inteiros.

## Fluxo do MVP (critério de aceite do produto)
1. O admin (Tarciso) cria o revendedor e define o atacado por produto (personalizável por revendedor, com vigência).
2. O revendedor cria o cliente e o site e publica em `cliente.sejaengajado.com.br`.
3. O revendedor registra a venda: o custo vem do atacado vigente e fica congelado; o preço que ele cobrou fica congelado; a margem é derivada.
4. O painel do revendedor mostra **entradas, saídas, margem e estoque de placas**.
5. O Tarciso cobra o revendedor pelo **Asaas** (fatura mensal = mensalidade + sites ativos; ⏳P4 ⏳P5).

## Regras de cobrança já decididas (00-plano §4/§10, não rediscutir)
- **Cliente mensal em atraso:** dias 1–7 só aviso (e-mail ⏳P15); a partir do dia 8, painel só leitura com o site no ar; a partir do 16, site suspenso ("temporariamente indisponível"); no dia 60, arquivado. Reativa sozinho ao pagar (webhook). Os prazos são configuráveis no admin.
- **Revendedor inadimplente:** os sites dos clientes dele ficam **30 dias** no ar e ele fica bloqueado de criar sites novos; depois disso, o admin pode oferecer a migração do cliente final.
- **Fase 1:** o revendedor cobra o cliente final **por fora** e fica com a margem. Split no Asaas só na fase 2.
- Pronto: 1º ano de hospedagem incluso, renovação anual configurável e placa como add-on pago. Pro: placa de brinde com fidelidade de 12 meses e multa proporcional configurável.

## Arquivos e blocos
| Arquivo | Conteúdo | Blocos |
|---|---|---|
| `PRODUCAO-01-fundacao.md` | **Fase 0 VPS (F0.1–F0.6)**, repositório, esqueleto da API, harness, CI de qualidade | 6 + 4 |
| `PRODUCAO-02-backend.md` | schema, tenant, RLS, auth, auditoria, revendedores, sites, by-host, atacado, ledger, placas, vendas, configs, jobs, relatórios, endurecimento | 16 |
| `PRODUCAO-03-frontend-sites.md` | alinhamento Tailwind 4.3, temas por nicho, divisores, faixa animada, layout revisado, SSR by-host, templates/vitrines | 7 |
| `PRODUCAO-04-paineis.md` | HTTP/auth no front, admin, revendedor (sites, vendas, financeiro, estoque), editor de aparência, lista /sites, painel do cliente | 8 |
| `PRODUCAO-05-pagamentos.md` | porta de gateway, adapter Asaas, webhooks, fatura do revendedor, cobrança direta, checkout, e2e sandbox | 7 |
| `PRODUCAO-06-infra-golive.md` | Dockerfiles, stack, secrets, CI/CD, wildcard de produção, backup R2, observabilidade, go-live | 8 |
Ordem: 01 (F0 em paralelo, conduzida pelo Tarciso) → 02 → 03 → 04 → 05 → 06. O 03 pode começar em paralelo ao 02 usando mocks.

## Decisões técnicas já resolvidas (não perguntar)
- **D10:** prontidão em `/health/ready` (liveness em `/health`) na API, no healthcheck do Swarm e no uptime.
- **D14:** código, tabelas, campos e códigos em inglês (ex.: `unitCostCents`, `period`, `SITE_ONE_TIME`); textos da interface em pt-BR.
- **D15:** a venda grava a **margem prevista** (preço − atacado congelado no `SaleItem`) e o IN no ledger; o **custo real** entra pela fatura (OUT `PLATFORM_INVOICE`). O relatório mostra as duas: margem prevista e margem realizada.
- **D11:** listas usam cursor + botão **"Carregar mais"** (sem total nem páginas numeradas).
- **D12:** erro de validação = `{code:"VALIDATION_FAILED", message, fields:[{path,code,message}]}`.
- **D17:** a API fica em **`app.sejaengajado.com.br/api`** (mesma origem, **sem CORS**); não existe host `api.`. A sessão é do Supabase Auth (supabase-js no painel, com refresh pelo SDK) e a API recebe `Authorization: Bearer <access_token>`; não há cookie de sessão próprio (P2).
- **D18:** versões reais (Angular 22.2, Tailwind 4.3, spartan 1.6.3, Angular SSR).
- **D16:** o RLS entra na fase 1 (02-B3).

## Regras para o Cursor (valem para todos os arquivos)
- **Um bloco por vez.** Cada bloco traz: Objetivo, Arquivos, Critério de pronto, Testes, Commit e **PARE**. No fim de cada bloco: lint, testes, commit pequeno (Conventional Commits), resumo do que foi feito e do que testar, e **PARE**. Só siga quando eu disser "continuar".
- **Segredos:** nunca escreva valores. Só nomes de variáveis e de Docker secrets; `.env.example` só com placeholders; `.env` no `.gitignore`; gitleaks no CI.
- Sem deploy, sem comandos contra produção e sem tocar na VPS, no DNS ou no Traefik: isso é do Tarciso ou do Atlas, com OK. Asaas só no sandbox.
- UI em pt-BR, código em inglês. `⏳P#` = recomendação padrão da tabela abaixo usada como placeholder: implemente de forma configurável ou fácil de trocar, e cite no resumo do bloco.

## Decisões pendentes do Tarciso
(Lista deduplicada de Alicerce, Lumen, Núcleo e Atlas. Enquanto não houver resposta, vale a recomendação padrão.)
| # | Decisão | Recomendação padrão (placeholder) | Usada em |
|---|---|---|---|
| P1 | Venda direta como revendedor "Plataforma" (sem `resellerId` nulo) | Sim: revendedor reservado `PLATAFORMA` no seed | 02-B1, B2, B3 |
| P2 | Login (D1) | **Decidido em 15/10/2026: Supabase self-hosted da VPS.** Supabase Auth (GoTrue) com OTP/magic link por e-mail e SMTP transacional configurado no Supabase; a API valida o JWT do Supabase (HS256 com o JWT secret, ver P2a) e só aceita quem já tem `User` (criado no convite) com aquele `supabaseId` e status ACTIVE, sem auto-criar; **a instância é compartilhada com o SaaS de QR** (mesma base de usuários, mesmo JWT secret e `aud`), então token válido não basta; **pendente:** reduzir `GOTRUE_JWT_EXP` de 31536000 (1 ano) para 3600 (afeta também o SaaS de QR, precisa de OK do Tarciso); `GOTRUE_URI_ALLOW_LIST` já inclui `https://app.sejaengajado.com.br` e `/**` (15/10); `GOTRUE_MAILER_AUTOCONFIRM=true` segue ligado (instância compartilhada); papel e `resellerId` sempre lidos do DB; MFA do admin = TOTP do Supabase (exige `aal2`); convite e reset pela Admin API do Supabase (`inviteUserByEmail` / `generateLink`) | 01-B2, 02-B4, 04-B1 |
| P3 | Onde roda o Postgres | **Decidido em 15/10/2026: Supabase self-hosted da VPS.** Banco dedicado `sejaengajado` dentro do Postgres do Supabase, com usuário de app próprio (sem superuser, sem `BYPASSRLS`); nenhum serviço Postgres no stack (a RAM da VPS está apertada, mais um motivo para reaproveitar). Testes seguem com Testcontainers `postgres:16` | 01-B2, 06-B2, 06-B6 |
| P2a | Checagem do P2: JWKS e SMTP do Supabase Auth | **Conferido em 15/10/2026 (GoTrue v2.182.1):** não há JWKS; tokens HS256 assinados com `GOTRUE_JWT_SECRET` → a API valida com o JWT secret via Docker secret `se_supabase_jwt_secret_v1` (HS256, confere `iss`, `aud=authenticated` e `exp`). ✅ SMTP configurado (Resend, `smtp.resend.com:587`, remetente `no-reply@sejaengajado.com.br`, domínio verificado na Cloudflare: `send.`, `rsend.`, `resend._domainkey`) | 02-B4, 06-B3, 06-B8 |
| P4 | Mensalidade do revendedor junto com o atacado por site, ou só o atacado | Os dois; a mensalidade do `ResellerPlan` pode ser 0 | 02-B9, 05-B4 |
| P5 | Atacado por produto (Pronto ≠ Pro) e relação com a fatura | Fatura = mensalidade + Σ sites ativos × `WholesalePrice` vigente do produto do site (snapshot na `InvoiceLine`) | 02-B9, 05-B4 |
| P6 | Valores reais de atacado, renovação, placa e % de multa | Placeholders no seed; o Tarciso preenche no admin antes do go-live | 02-B1, B13, 06-B8 |
| P7 | Origem das placas do revendedor | Compra da plataforma: transferência gera `PlaqueMovement` + OUT no ledger + linha na fatura; placa de terceiros entra como IN manual | 02-B11, 05-B4 |
| P8 | Revendedor pode dar placa de brinde no Pronto | Não: `OUT_GIFT` só para site Pro | 02-B11 |
| P9 | Ledger por regime de caixa x competência | Caixa: OUT `PLATFORM_INVOICE` quando o pagamento é confirmado | 02-B10, 05-B4 |
| P10 | Fila de jobs e webhooks: pg-boss x BullMQ | pg-boss (sem Redis) | 02-B14, 05-B3 |
| P11 | Redis no MVP | Não; cache by-host em memória (1 réplica) | 02-B8, 06-B2 |
| P12 | HTTP entre tenants | 404 (não revela existência); 401/403 só para papel e rota | 02-B2 |
| P27 | Escopo da impersonação do admin (D13) | Somente leitura, com audit | 02-B6, 04-B2 |
| P13 | Sites de revendedor BLOCKED | Mesma regra do DELINQUENT (30 dias); em fraude, o admin suspende na hora | 02-B6, 05-B4 |
| P14 | Chargeback/estorno no Asaas | Lançamento inverso no ledger e fatura de volta para OVERDUE | 05-B3, B4 |
| P15 | Avisos de atraso por WhatsApp | Só e-mail no MVP; WhatsApp na fase 2 | 02-B14 |
| P16 | Provedor de SMTP transacional (convite, reset, avisos) | Resend (ou Brevo), com SPF/DKIM/DMARC na Cloudflare | 02-B4, B14, 06-B8 |
| P17 | Storage de imagens | Cloudflare R2 `sejaengajado-media` + `img.sejaengajado.com.br`, upload por URL pré-assinada | 02-B7, 06-B2 |
| P18 | Destino do backup e onde roda o restore-test | R2 `se-backups` (age); restore-test mensal em runner GitHub-hosted | 06-B6 |
| P19 | `app.` em nginx separado ou no `web-ssr` | No mesmo `web-ssr` (um serviço a menos) | 03-B6, 06-B2 |
| P20 | Proxy da Cloudflare (cinza x laranja) | DNS-only (cinza) no MVP; Full (strict) desde já | 01-F0.5, 06-B5 |
| P21 | Liberar RAM x KVM 4 | Primeiro limpar stacks ociosos; se não chegar a 1,2 GB livre, KVM 4 | 01-F0.2 |
| P22 | Janela para mexer no Traefik (afeta todos os stacks) | Domingo, 01:00–03:00 (BRT), data a marcar pelo Tarciso | 01-F0.6, 06-B5 |
| P23 | Monitor de uptime | UptimeRobot free + Healthchecks.io para jobs e backup | 06-B7 |
| P24 | Validação: zod x class-validator | zod em config e DTOs | 01-B2 |
| P25 | Textos jurídicos (termos, privacidade, contrato do revendedor) | Modelo próprio revisado por advogado antes do go-live (bloqueia o go-live) | 06-B8 |
| P26 | IP allowlist do Asaas no Traefik | Não no MVP; token do webhook + reconsulta bastam | 05-B3 |
