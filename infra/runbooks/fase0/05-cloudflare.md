# F0.5 — Zona na Cloudflare e token DNS (⏳P20)

Quem executa: Tarciso ou Atlas, com OK explícito. O Cursor não troca nameserver, não cria token e não grava segredo.

Placeholder ⏳P20: registros em DNS-only (nuvem cinza). SSL/TLS da Cloudflare em **Full (strict)** desde já. Nunca "Flexible": com o redirect HTTPS do Traefik isso vira loop.

O registro do domínio continua na Hostinger. A Cloudflare só passa a responder o DNS. O certresolver `cfdns` é o bloco F0.6; aqui o token só vira secret.

Use `<VPS_IP>`. Não cole token, e-mail nem IP neste repositório.

## 1. Copiar a zona atual antes de trocar os NS

No painel da Hostinger, exporte todos os registros de `sejaengajado.com.br`: A, AAAA, CNAME, MX, TXT, SRV. Inclua SPF, DKIM e DMARC.

Guarde a exportação fora do git. Sem essa cópia, a troca de NS apaga o que não foi recriado, inclusive o e-mail.

Confira na Cloudflare, lado a lado, antes de seguir:

| Tipo | Nome | Valor na Hostinger | Presente na Cloudflare |
|---|---|---|---|
| MX | | | sim / não |
| TXT (SPF) | | | sim / não |
| TXT (DKIM) | | | sim / não |
| TXT (DMARC) | | | sim / não |
| demais | | | sim / não |

Se alguma linha de e-mail estiver "não", pare. Não troque os NS.

## 2. Registros do Seja Engajado

Na zona da Cloudflare, nuvem cinza (DNS-only):

| Tipo | Nome | Valor | Proxy |
|---|---|---|---|
| A | `@` | `<VPS_IP>` | DNS-only |
| A | `*` | `<VPS_IP>` | DNS-only |
| A | `app` | `<VPS_IP>` | DNS-only |

`app` explícito evita que o curinga seja a única forma de achar o painel. CAA é opcional:

| Tipo | Nome | Valor |
|---|---|---|
| CAA | `@` | `0 issue "letsencrypt.org"` |
| CAA | `@` | `0 issuewild "letsencrypt.org"` |

Em SSL/TLS: **Full (strict)**. Ative "Always Use HTTPS".

## 3. Trocar os NS na Hostinger

Só com a tabela do passo 1 toda em "sim" e um e-mail de teste ainda funcionando no DNS antigo.

No painel da Hostinger, substitua os nameservers pelos dois que a Cloudflare mostrar para esta zona. Não transfira o registro.

Espere a propagação. Da sua máquina:

```bash
dig NS sejaengajado.com.br +short
dig A teste.sejaengajado.com.br +short
dig A app.sejaengajado.com.br +short
dig MX sejaengajado.com.br +short
```

O esperado: NS da Cloudflare; `teste` e `app` iguais a `<VPS_IP>`; MX igual ao de antes da troca.

Envie e receba um e-mail de teste nesse domínio. Se o MX sumiu ou o teste falhar, volte os NS da Hostinger para os anteriores e pare.

## 4. Token e secret

No painel da Cloudflare, token custom só desta zona:

- Zone → DNS → Edit
- Zone → Zone → Read
- Zone Resources: Include → Specific zone → `sejaengajado.com.br`

Não use o token global. Filtro de IP no token, restrito a `<VPS_IP>`, é opcional.

Na VPS, sem eco e sem histórico:

```bash
export HISTCONTROL=ignorespace
 read -rs TOKEN
 printf '%s' "$TOKEN" | docker secret create cf_dns_api_token_v1 -
 unset TOKEN
docker secret ls
```

O espaço antes de `read` evita a linha no histórico. `docker secret ls` precisa mostrar `cf_dns_api_token_v1`. Não imprima o valor. Não passe o token como argumento.

O secret fica criado e sem uso até o F0.6. Não faça deploy do Traefik neste bloco.

## Evidência

| Campo | Valor | Data |
|---|---|---|
| NS (`dig NS`) | | |
| `teste.sejaengajado.com.br` | | |
| `app.sejaengajado.com.br` | | |
| MX igual ao anterior | sim / não | |
| E-mail enviado e recebido | sim / não | |
| Proxy dos A | DNS-only | |
| SSL/TLS | Full (strict) | |
| `docker secret ls` contém `cf_dns_api_token_v1` | sim / não | |
