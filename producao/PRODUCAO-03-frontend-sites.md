# PRODUÇÃO 03 — Frontend dos sites públicos (Angular 22.2 SSR + Tailwind 4.3)
Projeto `E:\dev\sejaengajado\plataforma\web`. Leia `PRODUCAO-00-indice.md` e `contrib-lumen.md` (diagnóstico com screenshots em `shots/`). Ignore "Angular 19 / Tailwind 3.4" nos docs antigos.

## Regras (todos os blocos)
- O biosite (`features/tenant-site`) **não importa spartan/helm** nem os tokens do painel: usa só as variáveis `--t-*` do tenant, calculadas no servidor e presentes no HTML do SSR. Spartan 1.6.3 fica só no painel.
- SSR-safe: nada de `window` ou `document` fora de `afterNextRender`/`isPlatformBrowser`. Preserve `resolve-host.ts`, `tenant-resolver`, `tenant-gate`, `?tenant=slug`, `*.localhost` e os seletores `data-*`.
- Só mocks e placeholders rotulados "exemplo" (nota Google, Pix, endereço e telefone fictícios). Ícones e SVG originais.
- **Pronto padrão de todo bloco:** `npm run build`, `lint`, `test -- --watch=false` e `format:check` verdes; click-through em 390×844 e 1440×900 (`?tenant=barbearia-do-ze`, `?tenant=pizzaria-forno-da-praca`) sem overflow horizontal; `prefers-reduced-motion` sem animação contínua; Lighthouse mobile (build SSR) com A11y ≥ 95, Perf ≥ 90, SEO ≥ 95 e CLS < 0,05; HTML do SSR já com as variáveis do tema.

---
## B1 — Alinhamento de stack (D18)
- **Objetivo:** base Tailwind 4.3 CSS-first e separação painel × biosite.
- **Arquivos:** `src/styles.css` (`@import "tailwindcss"`, `@theme` do painel, `@theme inline` com utilitários `bg-t-*`, `text-t-*`, `rounded-t-*` lendo `var(--t-*)`), `postcss.config` com `@tailwindcss/postcss`; remover qualquer `tailwind.config.js`; regra de lint que proíbe import de `@spartan-ng`/`hlm` em `features/tenant-site/**`.
- **Pronto:** o build não tem configuração Tailwind 3; o lint barra helm dentro do biosite.
- **Testes:** teste que procura `hlm` no HTML renderizado do biosite (espera zero).
- **Commit:** `chore(web): tailwind 4.3 css-first baseline`. **PARE.**

## B2 — Temas por nicho (Lumen B1)
- **Objetivo:** 6 temas (`barbearia`, `restaurante` (inclui pizzaria), `moda`, `beleza`, `saude`, `generico`) com contraste AA.
- **Arquivos:** `core/theme/niche-themes.ts` (colors, gradients, fonts self-hosted com `font-display: swap`, radius, shadows, spacing, motion), `resolve-theme.ts` (`{niche, brandColor?, overrides?}`), `contrast.ts` (`contrastRatio`, `pickTextColor`, variante AA da `brandColor`), `theme-to-css-vars.ts`, adaptador do `SiteTheme` antigo (`p1/p2/p3/on3/hi`).
- **Pronto:** todo par texto/fundo dos 6 temas passa AA; sites antigos continuam renderizando.
- **Testes:** preto/branco = 21; `pickTextColor`; fallback de `brandColor` fora do AA; snapshot das variáveis por tema.
- **Commit:** `feat(theme): niche theme tokens with AA contrast`. **PARE.**

## B3 — Divisores de seção, inclusive o ondulado (Lumen B2)
- **Objetivo:** transição entre seções configurável.
- **Arquivos:** `features/tenant-site/ui/section-divider.component.ts` (standalone, OnPush, inputs por signal): `shape` `reta|ondulada|zigzag|curva|inclinada|nuvem|serrilhada`, `height` (16–120, padrão 48), `flip`, `invert`, `fromColor`/`toColor`; SVG inline com `preserveAspectRatio="none"`, `aria-hidden`, altura reservada; `divider-path.ts` com funções puras; página `/dev/divisores` só em `isDevMode`. Referência do `ondulada`: hero em gradiente terracota → laranja com onda suave sobre off-white.
- **Pronto:** CLS 0; corrige a onda isolada da pizzaria (diagnóstico).
- **Testes:** cada shape gera path não vazio, aplica `aria-hidden` e a altura; `flip` inverte o transform; `reta` não gera SVG.
- **Commit:** `feat(site): configurable section divider`. **PARE.**

## B4 — Faixa animada (Lumen B3)
- **Objetivo:** faixa decorativa opcional.
- **Arquivos:** `features/tenant-site/ui/animated-strip.component.ts`: `motif` `pizza|tesoura|circulos|estrelas`, `speed`, `direction` (padrão **direita → esquerda**), `enabled`; `<symbol>` + `<use>` originais (< 2 KB por motivo; pizza = fatia/círculo com pontos; tesoura = traço simples) com leve ondulação; **loop infinito só em CSS** (trilho duplicado, `translate3d(-50%,0,0)`), sem JS de animação; pausa em `:hover`/`:focus-within`; estática com `prefers-reduced-motion`; `aria-hidden`; liga e desliga por `content.strip.enabled`.
- **Pronto:** nenhuma long task no trace de performance.
- **Testes:** trilho duplicado, `aria-hidden`, classe off quando desligada, direção padrão rtl.
- **Commit:** `feat(site): animated motif strip`. **PARE.**

## B5 — Layout revisado e correção do diagnóstico (Lumen B4)
- **Objetivo:** corrigir todos os problemas apontados nos screenshots.
- **Arquivos:** `features/tenant-site/site-page` + `sections/*` com ordem e divisores vindos de `content.sections[]`:
  - **Container** responsivo (cheio no mobile, ~1120 px no desktop, 2 colunas quando couber): resolve a coluna de 400 px e o overflow do Sobre e dos cards; título com `clamp()` + `text-wrap: balance` (resolve o corte de "Forno da Praç").
  - **Hero** com WhatsApp como CTA principal, Ligar e Rota (alvos ≥ 44 px).
  - **Catálogo em GRID por padrão** (2/3/4 colunas), `NgOptimizedImage`, chips de categoria com `aria-pressed` e WhatsApp por item (`encodeURIComponent`): substitui o carrossel cortado.
  - **Pix visível na página** (sem `<details>` no rodapé): QR gerado localmente, chave, botão copiar com toast `aria-live`, nome do recebedor e aviso "Confira o nome do recebedor antes de pagar".
  - **Bloco de avaliação do Google:** nota e nº de avaliações (placeholder "—" se `rating` for nulo), convite e botão para `/avaliar`.
  - FAQ acessível + JSON-LD `FAQPage`; horários com selo "Aberto agora · Fecha às HH:mm" no fuso do tenant e sem mismatch de hidratação (resolve o "seg: Fechado"); mapa com "Carregar mapa" (iframe só após o clique) + "Abrir no Maps"; galeria em grid com proporção fixa; margens de seção; rodapé com padding.
  - SEO: `site-seo.ts` com title, description, canonical, OG, JSON-LD `LocalBusiness` por nicho e `aggregateRating` só com dados reais.
- **Pronto:** todos os itens do diagnóstico de barbearia e pizzaria resolvidos e conferidos com novos screenshots em `shots/after/`.
- **Testes:** classes do grid; mensagem do WhatsApp codificada; copiar Pix (Clipboard mockado) + toast; "Aberto agora" em fusos e viradas de dia; JSON-LD válido no HTML do SSR; mapa sem iframe antes do clique.
- **Commit:** `feat(site): revised biosite layout`. **PARE.**

## B6 — SSR consumindo a API pelo Host (⏳P19)
- **Objetivo:** produção sem mock no site público.
- **Arquivos:** `core/api/http-api.service.ts` (implementa o `ApiPort`), `server.ts`: lê o `Host`, chama `API_INTERNAL_URL` (`http://api:3000/api/public/sites/by-host`), cache de 60 s; páginas "temporariamente indisponível" (SUSPENDED, `503` + `Retry-After`), 410 para arquivado e 404 próprio; `/healthz` que não depende da API; `app.` servido pelo mesmo servidor SSR, mas sem SSR de tenant (⏳P19); proxy `/api` → `api:3000` só em dev (em produção, o Traefik roteia `/api`).
- **Pronto:** com `environment.production`, nenhum mock entra no bundle (verificado no build).
- **Testes:** `server.ts` com host conhecido, desconhecido, suspenso e arquivado; nada de token no `TransferState`.
- **Commit:** `feat(ssr): host-based tenant rendering via api`. **PARE.**

## B7 — 3 templates e vitrines (Lumen B5, parte mock)
- **Objetivo:** templates prontos para venda.
- **Arquivos:** 3 templates (serviços/barbearia, restaurante/pizzaria, genérico) com schema compatível com o validador da API (02-B7); mocks: `barbearia-do-ze` (tema `barbearia`, divisor `serrilhada`/`inclinada`, faixa `tesoura`, serviços com foto placeholder, FAQ) e `pizzaria-forno-da-praca` (tema `restaurante`, hero terracota → laranja com `ondulada` sobre off-white, faixa `pizza`, categorias, Pix mock); promoções com data relativa (+7 dias), corrigindo o contador "225d".
- **Pronto:** as duas vitrines passam no pronto padrão.
- **Testes:** o schema de cada template valida os mocks; snapshot do SSR das vitrines.
- **Commit:** `chore(mocks): showcase tenants and templates`. **PARE.**
