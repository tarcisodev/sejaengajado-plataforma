# Bloco FLUXO-FELIZ — Seja Engajado (execução em loop até tudo verde)

## Ordem de execução e marcos (obrigatório — revisão Alicerce)
Cada marco termina com: CI verde ANTES do push, push em master, e PARE para o Tarciso aprovar o deploy. Se o mesmo spec falhar 5 vezes seguidas, pare e reporte em vez de remendar.
- M0 (urgente, push separado): bugs 0.a e 0.b + publico.spec. Só isso.
- M1: admin-site.spec + editor único (seção 2) + bug 0.e + f5.spec + bugs 0.c/0.d.
- M2: revenda-site.spec (incluindo VENDA) + cliente.spec + isolamento.spec.
- M3: crud-admin.spec restante + cobranca.spec (só no dev/sandbox).
- M4 (fora do fluxo feliz, não fazer agora): impersonar, troca de plano pelo cliente, preço de venda sugerido, reenvio/fechamento de fatura do revendedor, cupom no checkout do cliente.

Ajustes:
- VENDA: o revendedor cria a venda ligando cliente + plano + placa, congelando custo de atacado e preço de venda no momento da venda. Coberta no revenda-site.spec.
- Upload: usar o storage S3 já configurado (Cloudflare R2, bucket se-uploads via S3_ENDPOINT/se_s3_*). Validar tipo real do arquivo (magic bytes), tamanho e nome gerado no servidor.
- Smoke de produção (gate do deploy) é SOMENTE LEITURA e sem login: 3 sites-modelo fixos (demo-forno, demo-barbearia, demo-estudio) 200 com nome do negócio, subdomínio inexistente 404 limpo, health da API, /entrar 200. Nunca cria cobrança, nunca usa OTP/MFA.
- Produção usa Asaas de produção; cobranca.spec roda só no ambiente de dev com sandbox.


Repo: tarcisodev/sejaengajado-plataforma (master). Regras: commits pequenos; só push em master; NUNCA deploy manual (deploy só pelo pipeline com aprovação do Tarciso). Não mexer no login dedicado (SUPABASE_URL https://auth.sejaengajado.com.br, secrets se_auth_*, --with-registry-auth, migrate --detach=true). Migrations expand-only (sem DROP/RENAME; nunca editar migration já aplicada). Não commitar segredos. Rode em loop: implementar -> testar -> corrigir, até TODOS os critérios de aceite passarem. Siga os marcos abaixo; em cada um, só pare quando o marco estiver verde e me devolva o relatório do marco.

## 0. Diagnóstico inicial (antes de codar)
- Ler o código atual e preencher docs/matriz-crud.md com a tabela da seção 1, marcando para cada célula: existe e funciona / existe parcial / não existe (com arquivo e rota).
- Bugs conhecidos em produção que DEVEM estar corrigidos no fim:
  a) Biosites (demo-forno, demo-barbearia, demo-estudio, todos PUBLISHED) respondem 404 "Negócio não encontrado" pelo domínio público, apesar de GET /api/public/sites/by-host?host=demo-forno.sejaengajado.com.br dar 200. Logo após o deploy 1d9390e chegou a dar 200 e minutos depois voltou a 404 — investigar cache (positivo/negativo), resolução de host (Host vs X-Forwarded-Host atrás de Traefik) e qualquer estado que mude após a primeira requisição.
  b) O SSR chama http://api:3000/api/customer/templates em rotas públicas/tenant, recebendo 401/404 em loop. Rotas públicas e de tenant não podem chamar endpoints autenticados no servidor.
  c) Sentry no web-ssr: "Cannot find package '@sentry/server-runtime-injection'" — corrigir dependência/config.
  d) web-ssr do 391a1dc morreu com exit 139 (segfault) — verificar se ainda ocorre.
  e) Site criado pelo admin fica DRAFT sem forma de editar nem publicar.

## 1. Matriz de papéis (o que cada um faz) — implementar 100%
Legenda: C criar, R listar/ver, U editar, D excluir/arquivar, P publicar/despublicar.

| Entidade | ADMIN | RESELLER (só os seus) | CUSTOMER (só o seu) |
|---|---|---|---|
| Revendedores | CRUD + bloquear/desbloquear + convidar + impersonar (leitura) | R/U do próprio perfil | — |
| Planos de revendedor | CRUD | R do próprio | — |
| Planos de cliente (Pronto, Engaja Pro) | CRUD | R | R do próprio + solicitar troca |
| Produtos/atacado e preços | CRUD | R (preço de atacado) + U preço de venda sugerido próprio | — |
| Clientes | CRUD de qualquer cliente (escolhendo o revendedor ou a Plataforma) | CRUD dos seus clientes + convite por e-mail | R/U dos próprios dados |
| Sites | C/R/U/D/P de qualquer site + editor completo | C/R/U/D/P dos sites dos seus clientes + editor completo (independe do plano do cliente) | U conforme plano (Pro edita; Pronto só leitura com CTA) |
| Templates | CRUD + ativar/desativar | R | R (no editor) |
| Cupons | CRUD | R (aplicar na venda) | aplicar no checkout |
| Placas (QR/NFC) e estoque | CRUD + movimentar + vincular a site | R estoque próprio + vincular a site do seu cliente | R placa do próprio site + cancelamento/multa |
| Vendas/pedidos | R todos + U status | C/R/U dos seus | R os seus |
| Cobranças/faturas (Asaas) | R todas + fechar fatura do revendedor + reenviar | R as suas + pagar | R as suas + pagar |
| Configurações da plataforma | U | — | — |

Regras: escopo por reseller/customer no backend (nunca só no front); toda escrita de admin/revenda com @Audit; zod em todo body; ParseUUIDPipe; select explícito; paginação com teto.

## 2. Editor de site (componente único)
- Extrair o editor do customer-studio para um componente compartilhado `site-editor`, usado por admin, revenda e cliente, com preview ao vivo do template.
- Campos: nome do negócio, descrição, logo, capa/galeria (upload), cores do template, WhatsApp, telefone, endereço/mapa, horários, Pix, links/redes, FAQ, faixa/motif, avaliação Google (Places), SEO (title/description).
- Endpoints: PATCH /api/admin/sites/:id/content, PATCH /api/reseller/sites/:id/content, (manter o do cliente). Mesma validação zod nos três.
- Publicar/Despublicar para admin e revenda. Ao criar site (admin ou revenda) abrir direto o editor com botão Publicar visível.
- Excluir = arquivar (soft), com confirmação.

## 3. Testes de aceite E2E (Playwright) — fonte da verdade
Criar e2e/fluxo-feliz/*.spec.ts rodando contra o docker-compose de dev (auth local + Mailpit) e parametrizável por BASE_URL para rodar contra produção em modo somente-leitura (smoke).
1. admin-site.spec: admin (MFA) cria cliente da Plataforma -> cria site com template -> edita no editor (nome, WhatsApp, imagem) -> publica -> abre https://<slug>.<domínio> e vê o nome -> despublica -> vê página de indisponível -> arquiva.
2. revenda-site.spec: admin convida revendedor (plano Fundador) -> revendedor entra por OTP -> cria cliente -> cria site -> edita -> publica -> site abre no subdomínio -> vincula placa.
3. cliente.spec: cliente convidado entra por OTP -> vê o site -> Pro edita e salva; Pronto vê só leitura + CTA.
4. isolamento.spec: revendedor A não vê/edita cliente, site, placa, venda de B (UI e API direta -> 403/404).
5. crud-admin.spec: CRUD de planos, cupons (validade só data), templates, produtos, placas, revendedores.
6. publico.spec: 3 sites-modelo abrem com 200 e o nome do negócio; subdomínio inexistente dá 404 limpo; nenhuma chamada a endpoint autenticado no SSR de tenant (checar logs/HTTP).
7. f5.spec: F5 em /admin, /revenda, /conta não mostra a landing.
8. cobranca.spec (sandbox no dev): venda gera cobrança Asaas, webhook marca pago (idempotente).

## 4. Deploy gate
deploy.yml deve, após o deploy, rodar o smoke de produção (publico.spec + health) e falhar se qualquer item quebrar. Manter o check de que nenhum serviço fez rollback.

## 5. Definição de pronto (só pare aqui)
- docs/matriz-crud.md 100% "funciona", com link para o teste que cobre cada célula.
- Todos os specs da seção 3 verdes localmente (rodar `npm run e2e:fluxo-feliz` e anexar resumo).
- Lint, unit, int e build verdes.
- Bugs 0.a–0.e corrigidos com teste de regressão.
- Push em master feito.

## 6. Relatório final
Commits; matriz final; resultado dos e2e; endpoints novos; o que exige ação do Atlas na VPS (seed, secrets, migrations) e o que exige o Tarciso (decisões de negócio).

## 7. Ações com ícone e confirmação (entra no M1, componente reutilizado em M2/M3)
- Nada já implementado é removido; só se acrescenta.
- Toda ação (botões e menus de linha) tem ícone, `aria-label` e tooltip.
- Componente único de confirmação (spartan/hlm alert-dialog) com: título da ação, efeito concreto (ex.: "o site sai do ar em X.sejaengajado.com.br"), se dá para desfazer, e botão com o verbo da ação. Destrutivas em vermelho.
- Obrigatório em: publicar/despublicar site, arquivar/excluir, bloquear/desbloquear revendedor, convidar, vincular/desvincular placa, mudar status de venda, fechar fatura, reenviar cobrança, alterar preço de atacado.
- E2E cobre ao menos publicar, arquivar e bloquear (confirmar executa; cancelar não altera nada).

## 8. Estratégia de build (prevalece sobre o push por marco)
- Implementar TODAS as alterações do plano (M0 a M3 e a seção 7) antes de qualquer build completo ou push.
- Durante o desenvolvimento: só typecheck/lint e testes unitários do que foi alterado; sem build de imagem nem deploy entre uma feature e outra.
- Ao final: um único build completo, depois toda a suíte e2e (os 8 specs e os da seção 7) e o smoke local.
- Corrigir até tudo ficar verde, com a mesma regra de parar após 5 falhas do mesmo spec. Então fazer um único push para master e parar, aguardando a aprovação do deploy.
- Exceção: se o M0 (biosites) ficar pronto antes, ele pode ir num push próprio, porque produção está quebrada.

## 9. Fluxo Git (novo padrão, substitui o push direto em master)
- Antes de começar: abrir uma issue no GitHub (tarcisodev/sejaengajado-plataforma) com o objetivo, o checklist dos marcos e a definição de pronto (seção 5). Se o M0 sair separado, ele ganha a sua própria issue.
- Trabalhar numa branch `feat/<numero-da-issue>-fluxo-feliz` (ou `fix/<n>-...`).
- Ao terminar (build único e e2e verdes): abrir um PR para master com "Closes #<n>" no corpo, o resumo, o checklist marcado e a evidência dos testes.
- Não fazer merge: o Tarciso revisa, faz o merge e aprova o deploy no environment production.
- Não colocar IP, token, e-mail nem senha na issue ou no PR.
