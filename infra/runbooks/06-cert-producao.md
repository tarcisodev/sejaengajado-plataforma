# PRODUCAO-06 B5 — Wildcard de produção (`cfdns`)

Quem executa: **Tarciso ou Atlas**, com OK e na janela ⏳P22. O Cursor **não** altera DNS, Traefik nem Cloudflare.

Objetivo: sair do Let's Encrypt **staging** e emitir certificado de **produção** com SAN `sejaengajado.com.br` + `*.sejaengajado.com.br` (cobre `app.` e subdomínios de tenant).

Certresolver deste produto: **`cfdns`** (DNS-01 Cloudflare).  
**Não** usar `letsencryptresolver` (HTTP-01) para o wildcard.

Este runbook **não muda registros DNS**. Assume F0.5/F0.6 ok (`teste.` resolve, token `cf_dns_api_token_v1` existe).

---

## 0. Pré-checagem (só leitura)

```bash
# Resolver em uso nos stacks (não renomear letsencryptresolver dos outros produtos)
docker service inspect traefik --format '{{json .Spec.TaskTemplate.ContainerSpec.Args}}' | tr ',' '\n' | grep -i certresolver

# Staging ainda presente?
docker service inspect traefik --format '{{json .Spec.TaskTemplate.ContainerSpec.Args}}' | tr ',' '\n' | grep -i caserver || true

# Domínios dos outros stacks — anote HTTP antes
for h in ts.tarciso.dev painel.tarciso.dev api-qr.tarciso.dev; do
  printf '%s ' "$h"; curl -fsS -o /dev/null -w '%{http_code}\n' "https://$h" || echo FAIL
done
```

Backup no host (fora do git):

```bash
docker service inspect traefik > /root/traefik-spec-prod-$(date +%F).json
# Copiar acme-cf.json do volume do Traefik para /root/acme-cf.json.bak-$(date +%F)
```

---

## 1. Janela — promover `cfdns` para produção

No compose/stack que define o Traefik (não neste repositório):

1. **Remover** a linha de staging, se existir:
   ```text
   --certificatesresolvers.cfdns.acme.caserver=https://acme-staging-v02.api.letsencrypt.org/directory
   ```
2. **Manter** DNS challenge Cloudflare + storage separado:
   ```text
   --certificatesresolvers.cfdns.acme.storage=/letsencrypt/acme-cf.json
   --certificatesresolvers.cfdns.acme.dnschallenge=true
   --certificatesresolvers.cfdns.acme.dnschallenge.provider=cloudflare
   ```
3. **Apagar** o `acme-cf.json` de staging no volume (força reemissão na CA de produção). Não apague o `acme.json` do `letsencryptresolver`.
4. Publicar o stack do Traefik de novo (indisponibilidade curta em nó único — janela de baixo tráfego).
5. Deixar os **outros** stacks intactos (continuam em `letsencryptresolver` se já usavam).

Cloudflare (painel — sem mudança de registros A/NS neste passo):

- DNS-only (cinza) nos hosts deste produto até estabilizar
- SSL/TLS = **Full (strict)**
- Always Use HTTPS = on

---

## 2. Checagem de certificado (produção)

Substitua `x` por um subdomínio real (ex.: `teste`):

```bash
echo | openssl s_client -servername x.sejaengajado.com.br -connect x.sejaengajado.com.br:443 2>/dev/null \
  | openssl x509 -noout -issuer -subject -dates -ext subjectAltName
```

Esperado:

- Issuer Let's Encrypt **de produção** (não contém `STAGING`)
- SAN inclui `DNS:sejaengajado.com.br` e `DNS:*.sejaengajado.com.br`

HTTP dos produtos Seja Engajado:

```bash
curl -fsS -o /dev/null -w '%{http_code}\n' https://sejaengajado.com.br
curl -fsS -o /dev/null -w '%{http_code}\n' https://app.sejaengajado.com.br
curl -fsS https://app.sejaengajado.com.br/api/health/ready
curl -fsS -o /dev/null -w '%{http_code}\n' https://teste.sejaengajado.com.br
```

HTTP dos **outros** stacks (não pode piorar):

```bash
for h in ts.tarciso.dev painel.tarciso.dev api-qr.tarciso.dev; do
  printf '%s ' "$h"; curl -fsS -o /dev/null -w '%{http_code}\n' "https://$h" || echo FAIL
done
```

---

## 3. Rollback do Traefik (se o cert falhar)

```bash
# Voltar args/compose anterior a partir do backup /root/traefik-spec-prod-*.json
# ou: docker service rollback traefik
# Restaurar acme-cf.json.bak se necessário
```

Não mexer em DNS para “consertar” certificado — o desafio é DNS-01 via API token, não via registro manual.

---

## 4. Alerta de expiração

Configurar monitor externo (UptimeRobot / similar) com alerta de certificado ≤14 dias em `sejaengajado.com.br` e `app.sejaengajado.com.br` (PRODUCAO-06 B7).
