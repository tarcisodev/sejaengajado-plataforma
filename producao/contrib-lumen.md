# Cursor — Contribuição Lumen: temas por nicho, divisores, faixa animada e biosite revisado (Angular 22.2 + Tailwind 4.3)
Contexto: Seja Engajado (sejaengajado.com.br), plataforma multi-tenant de biosites por subdomínio para negócios locais, vendida com placa de avaliação Google. Leia `../00-plano.md` e `cursor-01-frontend-mock.md` (Blocos 2, 3, 5 e 7). Projeto: `E:\dev\sejaengajado\plataforma\web`.

## Versões reais (verificado no package.json em 15/10/2026)
- Angular 22.2.x (core, router, ssr, cdk), TypeScript ~6.0.3, Karma/Jasmine, ESLint 9 (`angular-eslint` 22), Prettier 3.
- Tailwind **4.3** via `@tailwindcss/postcss` (CSS-first: `@import "tailwindcss"` + `@theme`; **sem** `tailwind.config.js`). `tw-animate-css`.
- spartan `@spartan-ng/brain` 1.6.3 + helm, `@ng-icons/lucide`, `class-variance-authority`, `tailwind-merge`, `clsx` — **só no painel** (`app.`).
- Ignore qualquer menção a "Angular 19 / Tailwind 3.4" em documentos antigos.

## Regras gerais (valem para todos os blocos)
- Execute **um bloco por vez**. No fim: critérios de pronto, commits pequenos (Conventional Commits) e **PARE** com resumo e o que testar. Só siga quando eu disser "continuar".
- Nenhum segredo no código; sem deploy; nada contra produção. UI em pt-BR, código em inglês.
- **Separação de temas:** o biosite do tenant (`features/tenant-site`: `site-page`, `site-notice`, `tenant-gate`) **não** importa helm/spartan nem os tokens do painel. Usa só tokens próprios por tenant, expostos como CSS variables (`--t-*`) no elemento raiz do site, calculados no servidor e válidos no SSR (sem `window`/`document` fora de `afterNextRender`/`isPlatformBrowser`).
- Preserve o roteamento atual (`resolve-host.ts`, `tenant-resolver`, `tenant-gate.component`, `?tenant=slug` e `*.localhost` em dev) e todos os seletores `data-*` usados nos testes.
- **Dados só mock e placeholders.** Nota Google, nº de avaliações, chave Pix, recebedor, endereço e telefone são fictícios e marcados como exemplo (ex.: `rating: null` → exibir "—" ou placeholder rotulado "exemplo"). Não invente dado como real.
- Referência de padrões (não copiar layout nem texto): biosites de concorrentes com categorias + botão WhatsApp, bloco "nota no Google + convite para avaliar", texto "Sobre" e FAQ com SEO local, horários e "Onde estamos".
- Ícones e motivos SVG: desenhos originais e simples, feitos no projeto. Nada de ícones de terceiros protegidos no biosite.

### Critérios de pronto padrão (aplicar em todo bloco, além dos específicos)
1. `npm run build`, `npm run lint`, `npm test -- --watch=false` e `npm run format:check` sem erro.
2. Click-through manual em **390×844** e **1440×900** (`?tenant=barbearia-do-ze`, `?tenant=pizzaria-forno-da-praca` e o painel quando aplicável): sem overflow horizontal, sem sobreposição.
3. Com `prefers-reduced-motion: reduce` emulado (DevTools): nenhuma animação contínua; transições ≤ 150 ms ou nenhuma.
4. Lighthouse (mobile, build de produção via `serve:ssr:web`): **Acessibilidade ≥ 95**, **Performance ≥ 90**, **SEO ≥ 95**, CLS < 0,05.
5. HTML do SSR (ver código-fonte) já contém as CSS variables do tema e o conteúdo principal (sem flash de tema).

## Diagnóstico atual (base do tapa de beleza)
Screenshots de 15/10/2026 (desktop 1366, mobile 420), em `shots/`.
- **Barbearia (desk/mob):** no desktop o site é uma coluna estreita de ~400 px centralizada, com o resto da tela vazio → B4 (container responsivo). Os botões de link são todos iguais e o WhatsApp não se destaca; Instagram, Ligar e Avaliar aparecem como linhas soltas → B4 (hero com CTAs). O catálogo é um carrossel cortado que vaza na borda esquerda ("Corte" e "R$" cortados) → B4 (grid). A galeria é um placeholder quadrado gigante → B4. No mobile o texto do Sobre e os cards estouram a largura (overflow horizontal) → B4 + critério 390. O contador da promoção mostra "225d" (data mock absurda) → B5 (mock). O mapa é uma caixa vazia só com o link "Maps", o rodapé fica colado à esquerda sem padding, os títulos de seção não têm margem e "seg: Fechado" vem antes do horário real sem o selo de aberto/fechado → B4.
- **Pizzaria (desk/mob):** mesmos problemas de layout. A onda do hero existe mas está isolada e a transição para o off-white não segue nenhum tema → B1/B2. O Pix está escondido num `<details>` "▶ Pix" no rodapé → B4 (bloco Pix visível). Não há bloco de nota Google nem FAQ, e "Avaliar no Google" é só um link de texto → B4. No mobile o título estoura ("Pizzaria Forno da Praç") → B4 (clamp/quebra do título).
- **Painel /sites (desk):** os badges de status estão em inglês (PUBLISHED, READ_ONLY…) → B6. As ações são inconsistentes ("Suspender" rosa claro com baixo contraste, falta de largura fixa) → B6. A coluna "Endereço" mostra só o slug, sem link para o site, e o rodapé "Sites da plataforma" está solto. Também faltam contagem, paginação e estado vazio → B6.
- **Painel /sites (mob 420):** a tabela transborda (Status, Plano e Ações ficam fora da tela) e o botão "Criar site" aparece cortado → B6 (lista em cards no mobile). As linhas têm alturas irregulares e a sidebar vira só um ícone, sem rótulo → B6.

## Bloco 1: Sistema de temas por nicho
- Em `core/theme/`: tipo `NicheThemeKey = 'barbearia' | 'restaurante' | 'moda' | 'beleza' | 'saude' | 'generico'` (pizzaria usa `restaurante`) e `NicheTheme` com tokens: `colors` (bg, surface, text, muted, primary, primaryContrast, accent, border), `gradients` (hero, cta), `fonts` (heading, body; fontes locais/self-host com `font-display: swap` e fallback de sistema), `radius` (sm, md, lg, pill), `shadows` (sm, md, lg), `spacing` (sectionY, gap, container), `motion` (duração/easing).
- Registro `NICHE_THEMES` com os 6 temas (paletas originais). Migrar o `SiteTheme` atual (`p1/p2/p3/on3/hi` em `mocks/site-bios.ts`) com um adaptador compatível; nada quebra nos sites existentes.
- `site.content.theme` passa a ter `{ niche, brandColor?, overrides? }`. `resolveTheme(content)` funde tema + overrides.
- **Contraste AA:** util puro `contrastRatio(a,b)` (WCAG 2.x, luminância relativa) e `pickTextColor(bg)` que escolhe texto claro/escuro com ≥ 4.5:1 (≥ 3:1 para texto grande). Se a `brandColor` do tenant não atingir AA contra `bg`, gerar variante escurecida/clareada para uso em texto e manter a original só em superfícies.
- `themeToCssVars(theme)` → `Record<string,string>` (`--t-bg`, `--t-primary`, `--t-on-primary`, `--t-radius-md`...) aplicado via `[style]` no host do `site-page` (funciona no SSR). Em `styles.css`, mapear com `@theme inline` utilitários exclusivos do tenant (ex.: `bg-t-primary`, `text-t-on-primary`, `rounded-t-md`) que leem `var(--t-*)`, sem colidir com os tokens do spartan.
**Pronto:** testes unitários de `contrastRatio` (pares conhecidos: preto/branco = 21), `pickTextColor`, fallback de brand color fora de AA e snapshot das variáveis de cada tema; todo par texto/fundo dos 6 temas passa AA em teste. Commit `feat(theme): niche theme tokens with AA contrast`. **PARE.**

## Bloco 2: Divisor de seção configurável
- `SectionDividerComponent` (standalone, OnPush, signals inputs): `shape: 'reta' | 'ondulada' | 'zigzag' | 'curva' | 'inclinada' | 'nuvem' | 'serrilhada'`, `height` (px, padrão 48, limite 16–120), `flip` (horizontal), `invert` (vertical), `fromColor` / `toColor` (cores das seções vizinhas; padrão = tokens).
- SVG inline com `viewBox` fixo e `preserveAspectRatio="none"`, `width:100%`, altura reservada por `height` (evita layout shift), `aria-hidden="true"`, `focusable="false"`, sem requisições externas. Paths gerados por funções puras (`dividerPath(shape)`).
- Referência visual para `ondulada`: header com gradiente terracota → laranja e borda inferior em onda suave sobre fundo off-white (cor do `fromColor` preenchendo a onda, `toColor` no fundo).
- `reta` = sem SVG (só troca de cor).
**Pronto:** teste de cada shape (path não vazio, `aria-hidden`, altura aplicada, flip inverte transform); página de demonstração em dev (`/dev/divisores`, só em `isDevMode`) mostrando todos; CLS 0 no Lighthouse. Commit `feat(site): configurable section divider`. **PARE.**

## Bloco 3: Faixa animada opcional
- `AnimatedStripComponent`: `motif: 'pizza' | 'tesoura' | 'circulos' | 'estrelas'` (+ extensível), `speed` (s por ciclo), `direction` (padrão direita → esquerda), `enabled`.
- Símbolos SVG originais e leves (`<symbol>` + `<use>`, < 2 KB no total por motivo); pizza = fatias/círculo com pontos; tesoura = traço simples. Leve ondulação vertical alternada (efeito "onda") via `transform` nos itens.
- Animação **somente CSS**: trilho duplicado (2 cópias lado a lado) com `@keyframes` em `transform: translate3d(-50%,0,0)` infinito; `will-change: transform`; sem `setInterval`/`requestAnimationFrame`.
- `@media (prefers-reduced-motion: reduce)` → estática. Pausa com `:hover` e `:focus-within` (`animation-play-state: paused`). `aria-hidden="true"`, fora da ordem de tab. Liga/desliga por `site.content.strip.enabled`.
**Pronto:** testes de render (trilho duplicado, aria-hidden, classe off quando desligado); verificação manual de reduced-motion e pausa; Performance sem regressão (sem long tasks no trace). Commit `feat(site): animated motif strip`. **PARE.**

## Bloco 4: Layout revisado do biosite
Em `features/tenant-site/site-page` (componentes por seção em `features/tenant-site/sections/`), ordem e divisores configuráveis por `site.content.sections[]`:
- **Container:** coluna centralizada com `max-width` responsivo (mobile cheio, ~1120 px no desktop, com seções em 2 colunas quando couber); nunca overflow horizontal; títulos com `clamp()` e `text-wrap: balance`; galeria em grid com proporção fixa (sem placeholder gigante).
- **Hero:** logo, nome, cidade/bairro, nota Google (placeholder), CTAs WhatsApp (principal), Ligar (`tel:`) e Rota (link do Maps). Alvos de toque ≥ 44 px.
- **Catálogo em GRID por padrão:** 2 colunas no mobile, 3 em `md`, 4 em `xl`; imagem visível em cada item (`NgOptimizedImage`, `width/height`, `loading="lazy"` exceto as 2 primeiras, placeholder neutro se não houver foto), nome, preço opcional ("consulte"). Chips de categoria com filtro (`aria-pressed`, rolagem horizontal no mobile). Botão WhatsApp por item com mensagem pré-preenchida (`https://wa.me/<num>?text=` + `encodeURIComponent("Olá! Vi no site: <item>")`).
- **Pix na página:** QR (gerado localmente a partir da chave mock), chave visível, botão copiar (Clipboard API com fallback; toast "Chave copiada" em `aria-live="polite"`), nome do recebedor e aviso "Confira o nome do recebedor antes de pagar".
- **Avaliações Google:** nota e nº de avaliações (placeholders rotulados), texto de convite e link para `/avaliar` (rota já existente).
- **FAQ:** acordeão acessível (`<details>/<summary>` ou botão com `aria-expanded`), perguntas por nicho a partir do mock + JSON-LD `FAQPage`.
- **Horários:** tabela semanal + selo "Aberto agora · Fecha às HH:mm" / "Fechado · Abre <dia> às HH:mm", calculado com `Intl.DateTimeFormat` no fuso do tenant (`site.content.timezone`, padrão `America/Sao_Paulo`). No SSR renderiza o cálculo do servidor; no cliente recalcula em `afterNextRender` sem mismatch de hidratação (mesmo markup, só o texto pode mudar).
- **Mapa:** imagem estática/placeholder com botão "Carregar mapa" que só então injeta o iframe (consentimento, sem cookies de terceiros no carregamento); link "Abrir no Maps" sempre visível.
- **Sobre / SEO local:** parágrafo curto gerado a partir de nicho + cidade (texto próprio, não copiado).
- **Rodapé:** endereço, telefone, redes, "feito por Seja Engajado".
- SEO: estender `site-seo.ts` — title/description/canonical/OG por tenant, JSON-LD `LocalBusiness` (subtipo por nicho: `BarberShop`, `Restaurant`, `ClothingStore`, `BeautySalon`, `MedicalBusiness`) com `openingHoursSpecification`, e `aggregateRating` **só** se houver dados reais (no mock, omitir).
**Pronto:** testes de grid (classes de coluna), mensagem WhatsApp codificada, copiar Pix (mock da Clipboard) e toast, "Aberto agora" com datas fixas em fusos diferentes (incluindo virada de dia), JSON-LD válido (`FAQPage` + `LocalBusiness`) no HTML do SSR, mapa sem iframe antes do clique. Lighthouse conforme padrão. Commit `feat(site): revised biosite layout`. **PARE.**

## Bloco 5: Editor no painel (spartan) e vitrines
- No painel do cliente (`/conta`, studio) e do revendedor (criar/editar site): aba "Aparência" com componentes helm/spartan (Select, RadioGroup, Switch, Tabs, Button, Sonner/Toast): escolher tema de nicho, cor da marca (com aviso e sugestão quando não passa AA), divisor por seção (shape, altura, flip), faixa animada liga/desliga + motivo.
- **Preview ao vivo** do biosite real (mesmos componentes do Bloco 4, isolado do tema do painel — wrapper com as `--t-*` e sem classes helm dentro), alternância desktop/mobile (larguras 1440/390 com escala), botões "Restaurar padrão do tema" e "Salvar" (grava no mock store via `ApiPort`; respeita `editable=false` e `READ_ONLY` com bloqueio já existente).
- Corrigir no mock as datas das promoções para que fiquem relativas a hoje (ex.: +7 dias), em vez de contadores de 200+ dias.
- Atualizar vitrines no mock (`mocks/site-bios.ts` / `uberaba-seed.ts`):
  - `barbearia-do-ze`: tema `barbearia`, divisor `serrilhada`/`inclinada`, faixa `tesoura`, catálogo de serviços com fotos placeholder, FAQ de barbearia.
  - `pizzaria-forno-da-praca`: tema `restaurante`, hero com gradiente terracota → laranja e divisor `ondulada` sobre off-white, faixa `pizza`, categorias (pizzas, bebidas, sobremesas), Pix mock.
**Pronto:** testes do editor (mudar tema/divisor/cor atualiza o preview; reset volta ao padrão; salvar persiste no mock; bloqueado quando não editável/READ_ONLY); nenhuma classe/estilo spartan no HTML do biosite (teste procurando `hlm`); click-through 390/1440 do painel e das 2 vitrines. Commit `feat(panel): appearance editor with live preview` e `chore(mocks): showcase tenants`. **PARE.**

## Bloco 6: Lista /sites do painel (spartan)
- Status em pt-BR com badge por variante (Publicado, Rascunho, Só leitura, Suspenso, Arquivado), sem depender só da cor; mantenha os valores do enum no `data-*`.
- Ações padronizadas (Button helm: "Prévia" outline, "Suspender" destructive com contraste AA e Dialog de confirmação, "Reativar" default) com largura consistente; em telas estreitas, menu de ações (DropdownMenu).
- Coluna de endereço com link para `slug.sejaengajado.com.br` (em dev, `?tenant=`), ícone de link externo; contagem de resultados, paginação simples, estado vazio e skeleton.
- **Mobile (< 768 px):** trocar a tabela por lista de cards (nome, slug, badge, plano, ações) sem overflow; toolbar com busca em largura total e "Criar site" visível (botão inteiro ou FAB); navegação com Sheet com rótulos.
**Pronto:** testes de mapeamento de status → rótulo pt-BR, filtro + contagem, confirmação de suspensão; click-through 390/1440 sem overflow horizontal; Lighthouse a11y ≥ 95 no painel. Commit `feat(panel): sites list polish`. **PARE.**
