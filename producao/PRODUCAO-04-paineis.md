# PRODUÇÃO 04 — Painéis (admin, revendedor e cliente) em `app.sejaengajado.com.br`
Angular 22.2 + spartan 1.6.3 (helm) + Tailwind 4.3. API na mesma origem (`/api`, sem CORS, D17). Pré-requisito: o 02 está pronto no endpoint usado em cada bloco. Leia `PRODUCAO-00-indice.md`.

## Regras (todos os blocos)
- Mobile-first (o revendedor vende pelo celular). Labels em pt-BR; enums traduzidos e mantidos em `data-*`. Dinheiro formatado com `Intl.NumberFormat('pt-BR')` a partir de centavos.
- Erros: toast (Sonner) com `message`; formulários marcam cada campo a partir de `fields` (D12). Listas com **"Carregar mais"** (D11).
- POSTs de venda, estorno e estoque enviam `Idempotency-Key` (proteção contra clique duplo).
- Pronto padrão: build, lint, testes e format verdes; click-through 390/1440 sem overflow; Lighthouse A11y ≥ 95.

---
## B1 — HttpApiService, sessão e guards
- **Objetivo:** trocar o mock pela API real atrás do `ApiPort`.
- **Arquivos:** `core/api/http-api.service.ts`, `core/auth/*` (supabase-js: login por OTP/magic link, sessão e refresh pelo SDK, MFA TOTP do Supabase para o admin com enroll/challenge até `aal2`, logout), interceptor que anexa `Authorization: Bearer <access_token>` da sessão atual e, em 401, chama `refreshSession()` uma vez antes de deslogar, interceptor de erro, guards por papel (`/admin`, `/revendedor`, `/conta`), tipos gerados do OpenAPI (02-B16).
- **Pronto:** dev usa mock ou API por env; produção usa só a API.
- **Testes:** interceptor de Bearer/401 (com requisições concorrentes, o refresh do SDK roda uma vez só), guard por papel (papel vem de `GET /api/auth/me`, não do token), admin sem `aal2` vai para o desafio MFA, mapeamento de `fields`.
- **Commit:** `feat(panel): http api and session`. **PARE.**

## B2 — Admin: revendedores, atacado, configs (⏳P6 ⏳P13 ⏳P27)
- **Objetivo:** o Tarciso cria o revendedor e define o atacado.
- **Arquivos:** `features/admin/resellers/*` (lista, criar com convite, detalhe com summary, bloquear com motivo em Dialog, suspender sites, oferecer migração, impersonar só leitura), `features/admin/wholesale/*` (atacado por produto com nova vigência e histórico), `features/admin/config/*` (prazos, graça, renovação, placa, %), `features/admin/plaques/*` (estoque central, entrada, transferência).
- **Pronto:** fluxo "criar revendedor → definir atacado" completo contra a API local.
- **Testes:** o Dialog de bloqueio exige motivo; formulário de vigência; e2e (Playwright) admin → convite.
- **Commit:** `feat(admin): resellers and wholesale`. **PARE.**

## B3 — Revendedor: clientes e sites (criar e publicar)
- **Objetivo:** o revendedor cria e publica o site do cliente no subdomínio.
- **Arquivos:** `features/reseller/customers/*`, `features/reseller/sites/*`: wizard (cliente → template/nicho → conteúdo → checagem de slug ao vivo → prévia → publicar) e link `slug.sejaengajado.com.br`; banner e bloqueio quando DELINQUENT ou BLOCKED.
- **Pronto:** do celular, um site publicado em menos de 5 minutos com dados mock.
- **Testes:** slug inválido, reservado ou ocupado mostra o erro; bloqueio por inadimplência.
- **Commit:** `feat(reseller): create and publish sites`. **PARE.**

## B4 — Revendedor: registrar venda
- **Objetivo:** venda com custo e preço personalizáveis.
- **Arquivos:** `features/reseller/sales/*`: formulário com itens (produto, quantidade), custo = atacado vigente (só leitura), preço pré-preenchido pelo `ResellerPrice` e editável, **margem prevista ao vivo** (negativa em destaque), lista com "Carregar mais", anular com motivo.
- **Pronto:** a venda aparece no ledger e no estoque logo depois.
- **Testes:** cálculo de margem na UI igual ao da API; duplo clique não duplica (mesma `Idempotency-Key`).
- **Commit:** `feat(reseller): record sales`. **PARE.**

## B5 — Revendedor: financeiro e estoque de placas (D15)
- **Objetivo:** painel com entradas, saídas, margem e estoque.
- **Arquivos:** `features/reseller/dashboard/*` (cards: sites ativos, vendas do mês, margem prevista × realizada, saldo, estoque por tipo, fatura aberta com link Pix/boleto), `features/reseller/ledger/*` (extrato com abertura e fechamento, lançamento manual IN/OUT, estorno), `features/reseller/plaques/*` (saldo, movimentos, registrar brinde só em site Pro), `features/reseller/invoices/*`.
- **Pronto:** os números do painel batem com `GET /api/reseller/dashboard`.
- **Testes:** formatação de centavos; estorno com confirmação; brinde bloqueado para site Pronto.
- **Commit:** `feat(reseller): finance and stock`. **PARE.**

## B6 — Editor de aparência com prévia ao vivo (Lumen B5)
- **Objetivo:** escolher tema por nicho, cor, divisores e faixa.
- **Arquivos:** aba "Aparência" (helm Select, RadioGroup, Switch, Tabs) no editor do revendedor e no `/conta`: nicho, `brandColor` com aviso e sugestão de AA, divisor por seção (shape, altura, flip), faixa liga/desliga + motivo, catálogo (grade padrão); **prévia** com os componentes reais do 03 isolados do tema do painel (wrapper com `--t-*`, sem `hlm` dentro), alternância 390/1440, "Restaurar padrão" e "Salvar" (respeita `editable` e READ_ONLY).
- **Pronto:** mudanças refletem na prévia na hora e persistem pela API.
- **Testes:** mudar tema, divisor ou cor atualiza a prévia; reset; salvar; bloqueio quando não editável; nenhum `hlm` na prévia.
- **Commit:** `feat(panel): appearance editor with live preview`. **PARE.**

## B7 — Lista /sites (Lumen B6)
- **Objetivo:** corrigir o diagnóstico do painel.
- **Arquivos:** `features/*/sites-list`: badges em pt-BR (Publicado, Rascunho, Só leitura, Suspenso, Arquivado) que não dependem só da cor; ações padronizadas (Prévia outline, Suspender destructive AA com Dialog, Reativar) com largura fixa e DropdownMenu nas telas estreitas; endereço como link para o subdomínio; busca; **"Carregar mais"** (D11), estado vazio e skeleton; **cards no mobile < 768 px**, "Criar site" sempre visível e navegação em Sheet com rótulos.
- **Pronto:** em 420 px, nada transborda e o botão não fica cortado.
- **Testes:** status → rótulo; filtro; confirmação de suspensão; "Carregar mais" encadeia o cursor.
- **Commit:** `feat(panel): sites list polish`. **PARE.**

## B8 — Painel do cliente (edição só no Pro)
- **Objetivo:** o cliente Pro edita preços, fotos, promoções, Pix e horários.
- **Arquivos:** `features/customer/*`: login por OTP/magic link do Supabase (supabase-js), lista dos próprios sites, formulário por seção (validado pelo schema), aviso de modo só leitura (atraso) ou "plano Pronto: alterações via suporte".
- **Pronto:** o cliente Pronto não edita; o Pro edita e a mudança aparece no site em ≤ 60 s.
- **Testes:** `SITE_NOT_EDITABLE` exibido; upload com tipo e tamanho validados.
- **Commit:** `feat(customer): self-service editing`. **PARE.**
