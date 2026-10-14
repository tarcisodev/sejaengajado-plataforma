# Cursor — Fase 01: Frontend mock (Angular 19.2 + Tailwind 3.4)
Contexto: Seja Engajado (sejaengajado.com.br), uma plataforma de mini sites por subdomínio para negócios locais, vendida com placa de avaliação Google. Leia ../00-plano.md.
## Regras gerais (valem para todos os blocos)
- Execute **um bloco por vez**. No fim de cada bloco: rode os testes, faça commits pequenos (Conventional Commits) e **PARE**, mostrando um resumo e o que testar. Só siga quando eu disser "continuar".
- **Nenhum segredo no código.** Use `.env.example` com placeholders e leia de env/Docker secrets. Mantenha `.env` no `.gitignore`.
- **Sem deploy automático** e sem rodar comandos contra produção.
- Textos da UI em pt-BR. Código e nomes em inglês.

## Bloco 1: Setup
Crie o workspace Angular 19.2 standalone, com SSR (`@angular/ssr`), Tailwind 3.4, ESLint, Prettier e Jest ou Karma. Estrutura: `core/`, `features/landing`, `features/admin`, `features/customer`, `features/tenant-site`, `mocks/`.
**Pronto:** `ng serve` e `ng build` OK, e um teste de exemplo passa. Commit. **PARE.**

## Bloco 2: Mocks e serviços
Crie interfaces iguais ao modelo de dados do plano (Site com status DRAFT|PUBLISHED|READ_ONLY|SUSPENDED|ARCHIVED e `hostingRenewsAt`/`plaqueFidelityEndsAt`, Template, Plan incluindo ANNUAL_HOSTING, PlatformConfig, Coupon, Customer, Reseller com status ACTIVE|DELINQUENT|BLOCKED e `blockReason`, ResellerPlan, ResellerPrice, ResellerGoal, PlaqueStock, Payment, Cancellation, ResellerInvoice, NoticeLog) e uma `MockApiService` com dados de Uberaba (fictícios) atrás de uma interface `ApiPort`, para trocar pela API real depois. Inclua configs mock de prazos de atraso (1/8/16/60), valor de renovação anual, `plaqueValueCentavos` e `plaquePenaltyPct`. A multa do mock usa a fórmula do plano (`ceil` só em `mesesRestantes`; centavos por divisão inteira) e grava o resultado no `Cancellation`.
**Pronto:** testes unitários dos serviços. Commit. **PARE.**

## Bloco 3: Resolução de tenant simulada
`TenantResolver`: lê o host. Se for `localhost`, `app.` ou a raiz, mostra a landing ou o app. Caso contrário, extrai o slug. Em dev, aceita `?tenant=slug` ou `*.localhost`. Rota `/` decide entre a landing e o site do tenant. Sites `SUSPENDED` mostram a página "temporariamente indisponível"; `ARCHIVED` respondem 410/indisponível permanente; `READ_ONLY` renderizam o site normalmente (a restrição é só no painel).
**Pronto:** testes cobrindo raiz, app, slug válido, slug inexistente (404 amigável), site suspenso e arquivado. Commit. **PARE.**

## Bloco 4: Landing sejaengajado.com.br
Seções: hero, como funciona (3 passos), a placa Google, planos (preços vindos do mock e marcados como configuráveis — Pronto com hospedagem 1º ano incluso + renovação anual; Mensal Engajado Pro com placa de brinde e fidelidade 12 meses), FAQ e CTA de WhatsApp. Responsiva, com meta tags e SEO. Domínio próprio e white label **não** entram na landing do MVP (fase 2/3).
**Pronto:** Lighthouse SEO de 90 ou mais em dev. Commit. **PARE.**

## Bloco 5: Templates de site (3)
`barbearia`, `restaurante` e `servicos`, compostos por blocos reutilizáveis: header (logo/cores), botões (WhatsApp, Instagram, mapa, ligar), **avaliar no Google** (`/avaliar`), horários, galeria, catálogo simples, promoção com contagem, Pix (chave + QR) e rodapé "feito por Seja Engajado". Tema por CSS variables a partir de `site.content.theme`. Renderizar no SSR com title/description/OG/JSON-LD `LocalBusiness`. Página estática de suspensão ("temporariamente indisponível") reutilizável.
**Pronto:** os 3 slugs mock renderizam via `?tenant=`, e o HTML do SSR contém as meta tags; `?tenant=suspenso` mostra a página de indisponível. Commit. **PARE.**

## Bloco 6: Painel admin (mock)
Dashboard (receita do mês, sites ativos, MRR, inadimplentes); clientes; revendedores (quantos sites cada um tem, status ACTIVE/DELINQUENT/BLOCKED, ação "oferecer migração" só após 30 dias de `DELINQUENT`); **bloquear revendedor** (motivo obrigatório, escolher os sites ligados à fraude para suspender na hora; desbloquear não republica esses sites); sites (status, plano, suspender/reativar); planos (CRUD, incluindo renovação anual do Pronto); **configs da plataforma** (prazos com `>=`: aviso 1, só leitura 8, suspensão 16, arquivo 60, valor renovação anual, `plaqueValueCentavos` e `plaquePenaltyPct`); cupons (CRUD); relatório de receita com filtro de período e de revendedor. A fatura do revendedor no mock é a foto do fechamento (`PUBLISHED` e `READ_ONLY`), com a lista de sites gravada.
**Pronto:** navegação completa, tabelas com filtro e testes dos componentes principais. Commit. **PARE.**

## Bloco 7: Painel do cliente (mock)
Login mock (OTP por e-mail simulado). Wizard: dados do negócio → links → horários → fotos → escolha do template e das cores → preview ao vivo → publicar. Se `site.editable=false` (plano Pronto), mostrar só leitura com CTA "assinar o plano mensal" e "pedir alteração". Se status `READ_ONLY` (atraso 8–15 dias), bloquear edição e mostrar banner de pendência. Banner de renovação anual do Pronto quando `hostingRenewsAt` se aproxima. Cancelamento do mensal com placa de brinde: mostrar a multa calculada (`mesesRestantes = ceil(diasRestantes / 30)`, centavos inteiros) e, ao confirmar, gravar o `Cancellation` com esse valor — o aviso não recalcula se o mock de preço da placa mudar depois.
**Pronto:** a edição reflete no preview, a regra de "editável"/READ_ONLY é testada e há validação de formulário. Commit. **PARE.**

## Bloco 8: Painel do revendedor (mock, mobile-first)
Rotas `/revendedor/*` com role RESELLER simulada: dashboard (sites ativos, receita do mês, meta x realizado, custo devido à plataforma = mensalidade + sites ativos × custo atacado); clientes e sites (só os dele); **criar site pelo celular** (wizard curto: ramo/template → dados → cores → link + QR) — **desabilitado** se status DELINQUENT ou BLOCKED, com aviso (no BLOCKED, citar que a suspensão dos sites de fraude já ocorreu); meus preços (quanto cobra por plano — cobrança do cliente final é fora da plataforma na fase 1); financeiro (fatura da plataforma = foto do fechamento, lista auditável de sites `PUBLISHED`/`READ_ONLY`); metas; estoque de placas (entrada/saída vinculada a site; placa de brinde só no mensal).
Admin ganha: CRUD de planos de revendedor, vínculo revendedor↔plano, cupons por revendedor, fluxo de migração após 30 dias só de `DELINQUENT`, e bloqueio manual com motivo obrigatório.
**Pronto:** testes de que o mock filtra por resellerId (revendedor A não vê dados de B); criação bloqueada em DELINQUENT e em BLOCKED; layout validado em 375px. Commit. **PARE.**
