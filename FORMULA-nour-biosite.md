# Fórmula do Bio Site (nourbiosite.com.br) — engenharia reversa para a Seja Engajado

Análise feita em 14/10/2026 só com páginas públicas (curl GET, sem exploits). Amostras brutas: `/workspace/nourbiosite-bios/html/` (8 bios + `_root.html` landing + `_app.html` + `_manifest.json`).

## 1. Arquitetura (o que é template × o que é dinâmico)
- **URL pública:** `https://nourbiosite.com.br/b/<slug>` (o slug na raiz dá 404). Outras rotas: `/a/<código>` (encurtador / agenda online), `/minha-agenda/#<hash>`, `/app/` (painel PWA, `Disallow` no robots), `/cliente/`, `/api/`, `/parceiros/`.
- **NÃO é SPA.** Cada bio é **HTML estático/SSR auto-contido** (~57–93 KB sem imagens): CSS inline num `<style>`, JS vanilla inline (4 scripts pequenos), **imagens embutidas como data-URI base64 (webp/png)** — por isso os arquivos têm de 68 KB a 750 KB. Não tem `__NEXT_DATA__`, bundle nem fetch de API: os dados ficam "assados" no HTML. A única embed JSON é o **JSON-LD do schema.org**.
- **sitemap.xml** lista todas as bios `/b/*` com `lastmod` → é gerado dinamicamente a partir do banco.
- O mesmo renderizador também roda no **preview do painel**: `bioCartInit(root, mode)`; com `mode !== 'export'` o envio chama `window.__bxPreviewSend(msg)`.
- **Template (igual em todas):** CSS base `.bx …`, keyframes, scripts (carrinho, contagem regressiva, carrossel arrastável, auto-rotação, favicon a partir do logo), rodapé da agência + termos/LGPD.
- **Dinâmico (por bio):** variáveis de tema, classes de variante, textos, links, itens, promo, avaliações, endereço/mapa, horário, vídeo, PIX/QR, SEO/JSON-LD, dados da agência.

## 2. Esqueleto da página
```html
<html lang="pt-BR"><head>
  title / description / canonical / robots(index,follow,max-image-preview:large)
  og:type,site_name,locale,title,description,url · twitter:card=summary   (sem og:image nas bios!)
  <script type="application/ld+json">{@graph:[LocalBusiness-subtipo, BreadcrumbList]}</script>
  Google Fonts (um link carregando ~14 famílias) · <style>CSS do template</style>
</head><body>
<div class="bxpage">                       <!-- max-width 480px centralizado -->
 <div class="bx [bx-simple] [bx-fN] [bx-tN]" data-tipo="unica|auto" data-zap="55DDDNUMERO"
      data-intro="Olá! Quero agendar:" style="--p1..;--p2..;--p3..;--on3..;--hi..;--fh..;--fb..;--fs..;--fi..;--tt..;--ts..;--tb..;--fimg:url(..);--fe..">
   HERO → TICKER → LINKS → [SERVIÇOS grade | PRODUTOS carrossel] → [PROMO] → [VÍDEO] → [AVALIAÇÕES]
   → SOBRE (bloco SEO) → MAPA → [PIX/extra <details>] → [CTA agenda online] → RODAPÉ → DOCK (FAB/carrinho)
 </div></div><script>…</script></body></html>
```

## 3. Mapa de componentes (classe → função → campos)
| Bloco | Classes | Campos |
|---|---|---|
| Hero | `bx-hero`, `bx-blob b1/b2/b3`, `bx-wave` (SVG) | gradiente animado p1→p2 |
| Avatar/logo | `bx-ring > .in.has > img` (anel conic-gradient girando) ou iniciais | `logo` (img) ou iniciais |
| Nome | `h1.bx-name` | `nome` |
| Slogan | `p.bx-tag` | `slogan` |
| Chips | `bx-chips` (spans + pontos) | `tags[]` (máx ~4) |
| Local | `span.bx-loc` | `cidade/UF` |
| Ticker | `bx-tick` (marquee girado) | `ticker[]` (frases, repetidas 3×) |
| Links | `bx-links > a.bx-lnk[.main]` com `bx-ico`, `b`, `small`, `bx-go`; opcional `bx-live` ("Atendimento rápido" com ponto pulsando), `bx-badge[.new]` | `links[]: {tipo, titulo, subtitulo, url, icone, destaque, badge}` — o 1º costuma ser WhatsApp `.main` com brilho |
| Serviços (grade) | `bx-svcgrid > a.bx-svc > .bx-pic.gN > img.bx-photo` | `servicos[]: {nome, foto}` → link `wa.me/?text=Tenho interesse em: X` |
| Produtos (carrossel) | `bx-rail > article.bx-item[data-i,data-n,data-p,data-lab]`, `bx-tagp`, `bx-meta`, `bx-price`, `bx-ap`, `bx-act`→`bx-want`/`bx-qty` | `produtos[]: {nome, preco(texto), rotulo_botao, tag, foto|silhueta}` |
| Carrinho | `bx-dock > .bx-cart[hidden]` `[data-ci][data-cv][data-send]` | gera mensagem de WhatsApp: "• 2x Nome (R$ x)… Total estimado… Pode confirmar?" |
| FAB WhatsApp | `a.bx-fab` (sticky dock) | `zap`, mensagem |
| Promo | `bx-promo`, `bx-stamp`, `bx-offer`, `bx-clock[data-cd] b[data-u=d/h/m/s]`, `bx-cta` | `promo: {titulo, texto, item, preco, fim(datetime), cta}` |
| Vídeo | `bx-vsec > .bx-video iframe` (YouTube embed 16:9) | `youtube_id` |
| Avaliações | `bx-rev`, `bx-stars`, `bx-rate`, `bx-gbtn` | `google: {nota, total, place_id}` → `search.google.com/local/writereview?placeid=` |
| Sobre/SEO | `section.bx-seo` | texto SEO gerado ("Procurando X em Cidade? …") + lista de serviços |
| Mapa | `bx-map iframe` (`google.com/maps?q=…&output=embed`), `bx-wbtns > bx-wb` (Como chegar / Ligar) | `endereco`, `maps_url`, `telefone` |
| PIX/extra | `details.bx-plus > .bx-pbox`, `bx-qrw img.bx-qr`, `bx-pn`, `bx-ph`, `bx-cpy` | `pix: {chave, nome, qr}` (copiar) |
| Rodapé | `bx-foot`, `bx-fring`, `bx-fname`, `bx-ftag`, `bx-info/bx-irow/bx-iic`, `bx-fls/bx-fl`, `bx-sep`, `bx-by` | endereço, tel, horário ("seg: Fechado · ter a sáb: 09:00–19:00"), redes; "Site criado por <agência>", e-mail, `<details>` Termos+LGPD com nomes interpolados |
| Ícones | sprite SVG `#i-*` (~50 de nichos: paw, bread, scissors, tooth, icecream…) + marcas `#b-wa/ig/yt/tg/gg` | `icone` por link/categoria |

## 4. Tema (CSS custom properties no root `.bx`)
- `--p1` primária, `--p2` secundária, `--p3` destaque, `--on3` texto sobre p3, `--hi` texto do hero.
- `--fh` fonte de títulos, `--fb` fonte do corpo, `--fs` escala do título (0.72 Orbitron … 1), `--fi` itálico do título.
- `--tt/--ts/--tb` escalas finas (título/subtítulo/corpo?), `--fimg` imagem de fundo/textura do hero (data-URI), `--fe` intensidade dessa imagem (0.29–0.31).
- Derivados com `color-mix(in srgb, var(--p1) X%, …)` para fundo, sombras, gradientes `.g1..g4` dos cards.
- Fontes disponíveis: Playfair Display, Outfit, Montserrat, Satisfy, Pacifico, Poppins, Lora, Nunito, Dancing Script, Raleway, Bodoni Moda, Inter, Bebas Neue, Orbitron.
- **Variantes de layout:** `bx-simple` (modo simples), `bx-f3`/`bx-f4` (hero pontilhado sem blobs), `bx-f7`, `bx-t4` (tema da promo) → "skins" sobre o mesmo DOM.

## 5. Data attributes / comportamento JS
- Root: `data-tipo="unica"` (lista estática) | `"auto"` (carrossel com auto-rotação a cada 3,5 s, pausa 7 s ao tocar; respeita `prefers-reduced-motion`), `data-zap` (número do WhatsApp), `data-intro` (abertura da mensagem do pedido).
- Item: `data-i` índice, `data-n` nome, `data-p` preço em texto pt-BR (parse por regex), `data-lab` rótulo do botão.
- Carrinho: `data-add/inc/dec/clear/send`, `data-ci/cv`. Contagem regressiva: `data-cd`, `data-u`.
- Extras: setas ‹ › de desktop + arrastar com mouse em `.bx-rail,.bx-ccirs,.bx-crail`; favicon/apple-touch-icon criados a partir de `.bx-ring img`. Algumas bios têm `gtag` (GA por cliente).

## 6. SEO
- `title`: "Nome | Serviço principal em Cidade"; `description` = slogan + serviços + cidade + "chame no WhatsApp".
- JSON-LD `@graph`: subtipo de LocalBusiness por nicho (HairSalon, IceCreamShop, PetStore, MedicalClinic, Bakery, ClothingStore, BeautySalon, ProfessionalService), com `telephone`, `PostalAddress`, `hasMap`, `sameAs`, `aggregateRating`, `makesOffer[]` + `BreadcrumbList` (Cidade-UF → Nome).
- Bloco "Sobre" com texto local-SEO gerado por template; sitemap com todas as bios.
- Lacunas que a Seja Engajado pode resolver melhor: **sem `og:image`** (preview fraco no WhatsApp), imagens base64 (sem cache/CDN, HTML pesado), uma única chamada de fontes trazendo 14 famílias.

## 7. PWA
- O PWA é **só o painel** (`/app/manifest.webmanifest`: standalone, portrait, scope `/app/`, tema `#050b17`, ícones 192/512/maskable). As bios públicas não têm manifest nem service worker.
- Login do cliente por e-mail + código (OTP), segundo os termos.

## 8. Diferenças entre as 8 bios
| slug | nicho (@type) | variante | tipo | blocos de destaque |
|---|---|---|---|---|
| riacho-modas-itatinga | ClothingStore | simple f7 | unica | serviços, avaliações, **vídeo YouTube**, `--fimg` |
| nour-bio-site-mini-site | ProfessionalService | f3 | auto | **produtos+carrinho**, promo+timer, ticker, gtag |
| juan-barber | HairSalon | simple f7 | unica | promo com contagem regressiva, link appbarber, CTA agenda `/a/` |
| gelatto-acaiteria-e-sorveteria | IceCreamShop | simple f7 | unica | serviços, avaliações, ticker, fonte Montserrat 0.84 |
| studio-bela | BeautySalon | simple (sem f) | unica | o mais enxuto: sem mapa, sem avaliações, 1 imagem |
| home-pet | PetStore | simple f7 | unica | 750 KB (fotos pesadas em base64) |
| padaria-tres-irmas-bebiano-dwnc | Bakery | simple f3 | unica | slug com sufixo aleatório (`-dwnc`) para evitar colisão |
| nutricionista-…-moema | MedicalClinic | f7 | auto | produtos-como-"Agendar" (preço vazio → "Valores a combinar"), badges, **PIX/QR**, gtag |

Conclusão: **um único template**; o que muda são tema, variante e quais seções estão ligadas/preenchidas.

## 9. Modelo de dados proposto (Seja Engajado)
```ts
Bio { id, tenantId, agenciaId, slug(unique, slugify(nome[-cidade]) + sufixo se colidir), status, publicadoEm, atualizadoEm,
  nicho: 'HairSalon'|'Bakery'|…   // define @type, ícones, textos SEO
  tema: { p1,p2,p3,on3,hi, fonteTitulo, fonteCorpo, escalaTitulo, italico, tt,ts,tb, bgImg?, bgIntensidade?, variante:'simple'|'f3'|'f4'|'f7', promoTema? },
  modo: 'unica'|'auto',
  perfil: { nome, slogan, logoUrl, tags[], cidade, uf },
  whatsapp: { numero, mensagemPadrao, introPedido },
  ticker: string[],
  links: [{ tipo:'whatsapp'|'url'|'maps'|'tel'|'instagram'|'agenda', titulo, subtitulo, url, icone, destaque, badge?, aoVivo? }],
  servicos: [{ nome, fotoUrl? }],
  produtos: [{ nome, precoTexto, rotuloBotao, tag?, fotoUrl?, silhueta? }],
  promo?: { titulo, texto, item, precoTexto, terminaEm, cta },
  video?: { youtubeId, titulo },
  google?: { nota, totalAvaliacoes, placeId, mapsUrl },
  endereco?: { logradouro, cidade, uf, cep?, lat?, lng? }, telefone?, horarios: [{ dias, abre?, fecha? | fechado }],
  redes: [{ tipo, url }], pix?: { chave, nome, qrUrl },
  seo: { title?, description?, sobreTexto? },   // auto-gerado, sobrescrevível
  analytics?: { gaId?, metaPixel? }, agendaOnline?: { ativo, shortCode } }
Agencia { nome, logo, whatsapp, instagram, email, termosTemplate }   // white-label no rodapé
```

## 10. Onde encaixar na plataforma (`E:\dev\sejaengajado\plataforma`, só leitura)
Encontrado: `web/` em **Angular 19 com SSR** (`main.server.ts`, `server.ts`, `app.config.server.ts`) + Tailwind 3; features `admin`, `customer`, `landing`, **`tenant-site`**; `core/models/domain.ts`, `core/api/api-port.ts`, `mocks/mock-api.service.ts`; planos `00-plano.md`, `cursor-01..04-*.md`.
Sugestão:
1. `core/models/domain.ts` → tipos `Bio`/`Agencia` acima; `api-port.ts` → `getBioBySlug`, `listBios`, `saveBio`; seed no `mock-api.service.ts`.
2. `features/tenant-site` → rota pública `/b/:slug` renderizada no **SSR** (essencial para SEO/OG), componentes `BioHero, BioTicker, BioLinks, BioServiceGrid, BioProductRail+CartDock, BioPromoCountdown, BioVideo, BioReviews, BioAbout, BioMap, BioPix, BioFooter`; tema via `[style]` com as CSS vars (manter `color-mix`).
3. `features/admin`/`customer` → editor com preview ao vivo (mesmo componente, `mode='preview'`), seletor de tema/fonte/variante, ligar/desligar seções.
4. `server.ts` → `sitemap.xml` dinâmico + JSON-LD por nicho + `og:image` gerada (melhoria sobre a Nour); imagens em CDN, não em base64.
