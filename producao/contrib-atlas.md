# Seja Engajado — Bloco de Infra de Produção (contribuição do Atlas)

> **Só documentação.** Nada aqui foi aplicado: sem deploy, sem DNS, sem mudanças no VPS, sem contas novas. Cada passo que toca DNS, VPS, certificados ou produção precisa de **OK explícito do Tarciso** (ver `cursor-04-infra.md`).
> Legenda: ✅ verificado · ⚠️ **NÃO VERIFICADO** (vem do levantamento de 03/10 ou é suposição) · 🛑 bloqueador

## 0. Estado do VPS e divergências com o plano

| Item | Valor | Status |
|---|---|---|
| Host | 187.77.22.250, Hostinger KVM 2, 2 vCPU, 7,8 GiB, Ubuntu 24.04 | ⚠️ (03/10) |
| RAM disponível | ~390 MiB, **sem swap** | ⚠️ 🛑 |
| Disco livre | ~33 GB; logs Docker sem rotação (~7,5 GB) | ⚠️ |
| Swarm | 1 nó, ~16 stacks / 41 serviços | ⚠️ |
| Traefik | v3.5.3, LE (httpChallenge/tlsChallenge?), rede `TarcisoDevNet`, log DEBUG | ⚠️ |
| Segurança | SSH com senha + root, sem firewall, 2377/7946/4789 abertas, Portainer público | ⚠️ 🛑 |
| Backups de DB | nenhum | ⚠️ 🛑 |

**O levantamento read-only via SSH não rodou hoje (15/10):** a box do agente não tem cliente `ssh` instalado e não houve permissão de instalar. Tudo acima é de 03/10. Re-verificar com os comandos da §0.1 antes do go-live.

**Divergência com o plano:** o pedido fala em "web Angular, nginx estático", mas `00-plano.md` e `cursor-01` definem **Angular 19 com SSR (`@angular/ssr`)** para os sites dos tenants (o SSR lê o `Host` e chama `/public/sites/by-host`). Proposta:
- `web-ssr` (Node, `server.mjs`): apex + `*.sejaengajado.com.br` (sites dos tenants e a landing).
- `app.sejaengajado.com.br` (admin/cliente): build estático servido por **nginx** (barato em RAM), ou servido pelo mesmo `web-ssr` para economizar um serviço. **Decisão do Tarciso.**
- ORM: **Prisma** (`prisma migrate deploy`), não TypeORM.
- Auth: Supabase Auth (JWKS). ⚠️ Usar o Supabase self-hosted que já roda no VPS ou o Supabase Cloud? **Decisão.**

### 0.1 Levantamento read-only (só rodar com OK; não muda nada)
```bash
ssh -i ~/.ssh/qr_vps_key root@187.77.22.250 '
free -m; swapon --show; df -h / /var/lib/docker; uptime
docker stack ls; docker service ls --format "{{.Name}} {{.Replicas}} {{.Image}}"
docker stats --no-stream --format "{{.Name}} {{.MemUsage}}" | sort -k2 -h | tail -20
du -sh /var/lib/docker/containers; cat /etc/docker/daemon.json
docker service inspect $(docker service ls -q -f name=traefik) --format "{{json .Spec.TaskTemplate.ContainerSpec.Args}}" | tr , "\n"
docker service inspect $(docker service ls -q -f name=traefik) --format "{{json .Spec.TaskTemplate.ContainerSpec.Secrets}} {{json .Spec.TaskTemplate.ContainerSpec.Env}}"
docker network inspect TarcisoDevNet --format "{{.Driver}} {{.Attachable}}"
ufw status; ss -tlnp | grep -E ":(22|80|443|2377|7946|9000|9443)"
sshd -T | grep -E "permitrootlogin|passwordauthentication"'
```

---

## 1. DNS (Cloudflare) + certificado wildcard no Traefik

### 1.1 Registros na Cloudflare
| Tipo | Nome | Valor | Proxy |
|---|---|---|---|
| A | `@` | 187.77.22.250 | **DNS-only (cinza)** no início |
| A | `*` | 187.77.22.250 | DNS-only |
| A | `app` | 187.77.22.250 | DNS-only (explícito; facilita ligar o proxy só nele depois) |
| MX/TXT | (os de e-mail que já existem) | **conferir/importar antes de trocar os NS** | — |
| CAA (opcional) | `@` | `0 issue "letsencrypt.org"` e `0 issuewild "letsencrypt.org"` | — |

Nameservers: trocar no painel da Hostinger (o registro continua lá). Checar com `dig NS sejaengajado.com.br +short`.

**Proxy laranja vs DNS-only**
- Com o **dnsChallenge** a emissão funciona nos dois modos (o ACME não depende de chegar no VPS).
- **DNS-only (recomendado no MVP):** o Traefik vê o IP real, sem dupla camada de TLS, debug simples. O IP do VPS fica exposto.
- **Proxied (laranja):** WAF/DDoS/cache e IP escondido. Exige **SSL/TLS = Full (strict)** (nunca "Flexible": daria loop de redirect com o redirect HTTPS do Traefik). O wildcard no proxy funciona em todos os planos hoje ⚠️ (confirmar). Precisa do IP real via `CF-Connecting-IP` (forwardedHeaders.trustedIPs com os ranges da Cloudflare no entrypoint) para o rate limit e o hash de IP do ScanEvent funcionarem.
- Em qualquer modo: ativar **Full (strict)** já no início (o cert LE é válido) e "Always Use HTTPS".

### 1.2 Token da API Cloudflare
- Custom token: **Zone → DNS → Edit** + **Zone → Zone → Read**, Zone Resources = *Include → Specific zone → sejaengajado.com.br*. TTL/IP filtering opcionais (filtro de IP = 187.77.22.250 é um bom extra).
- Criar o secret **no VPS** e nunca no repo/arquivo:
```bash
printf '%s' "$TOKEN" | docker secret create cf_dns_api_token_v1 -   # lê do stdin; não deixar no histórico (export HISTCONTROL=ignorespace)
```

### 1.3 Segundo resolver no Traefik existente sem quebrar os outros stacks
Princípio: **adicionar**, nunca renomear/alterar o resolver atual (`letsencryptresolver`, ⚠️ confirmar o nome em §0.1). Os stacks que usam o resolver atual não são tocados. O novo resolver usa um **storage separado** (`acme-cf.json`).

Args a **acrescentar** ao serviço Traefik (no stack/compose dele, não via `docker service update` solto, para não divergir do arquivo):
```yaml
    command:
      # ... args atuais intactos ...
      - --certificatesresolvers.cfdns.acme.email=SEU_EMAIL
      - --certificatesresolvers.cfdns.acme.storage=/letsencrypt/acme-cf.json
      - --certificatesresolvers.cfdns.acme.dnschallenge=true
      - --certificatesresolvers.cfdns.acme.dnschallenge.provider=cloudflare
      - --certificatesresolvers.cfdns.acme.dnschallenge.resolvers=1.1.1.1:53,1.0.0.1:53
      # STAGING primeiro; remover a linha abaixo (e apagar acme-cf.json) para ir para produção
      - --certificatesresolvers.cfdns.acme.caserver=https://acme-staging-v02.api.letsencrypt.org/directory
      - --log.level=INFO        # hoje está DEBUG (⚠️)
    environment:
      - CF_DNS_API_TOKEN_FILE=/run/secrets/cf_dns_api_token   # lego aceita a variante _FILE
    secrets:
      - source: cf_dns_api_token_v1
        target: cf_dns_api_token
secrets:
  cf_dns_api_token_v1:
    external: true
```
Riscos/mitigação:
- O update do Traefik reinicia o proxy de **todos** os stacks (~segundos de indisponibilidade; com 1 nó não há start-first útil por causa das portas 80/443 em modo host/ingress). Fazer em janela de baixo tráfego e manter o `docker service rollback traefik` pronto.
- Backup antes: `cp acme.json acme.json.bak-$(date +%F)` e `docker service inspect traefik > traefik-spec-$(date +%F).json`.
- Validar: `docker service logs traefik 2>&1 | grep -i cfdns` e `curl -vk https://teste.sejaengajado.com.br 2>&1 | grep -i issuer` (staging = "(STAGING)").

### 1.4 Labels (Traefik v3 — sintaxe de regex v3)
```yaml
      labels:
        - traefik.enable=true
        - traefik.docker.network=TarcisoDevNet          # ⚠️ em Swarm: traefik.swarm.network no v3 (confirmar o provider usado: --providers.swarm)
        - traefik.http.routers.se-web.rule=Host(`sejaengajado.com.br`) || HostRegexp(`^[a-z0-9-]+\.sejaengajado\.com\.br$`)
        - traefik.http.routers.se-web.priority=1        # app./api. têm Host() exato → prioridade maior
        - traefik.http.routers.se-web.entrypoints=websecure
        - traefik.http.routers.se-web.tls.certresolver=cfdns
        - traefik.http.routers.se-web.tls.domains[0].main=sejaengajado.com.br
        - traefik.http.routers.se-web.tls.domains[0].sans=*.sejaengajado.com.br
        - traefik.http.routers.se-web.middlewares=se-headers,se-ratelimit
        - traefik.http.services.se-web.loadbalancer.server.port=4000
        - traefik.http.services.se-web.loadbalancer.healthcheck.path=/healthz
        - traefik.http.middlewares.se-headers.headers.stsSeconds=31536000
        - traefik.http.middlewares.se-headers.headers.stsIncludeSubdomains=true
        - traefik.http.middlewares.se-headers.headers.contentTypeNosniff=true
        - traefik.http.middlewares.se-headers.headers.frameDeny=true
        - traefik.http.middlewares.se-headers.headers.referrerPolicy=strict-origin-when-cross-origin
        - traefik.http.middlewares.se-ratelimit.ratelimit.average=50
        - traefik.http.middlewares.se-ratelimit.ratelimit.burst=100
```
Redirect HTTP→HTTPS: se o entrypoint `web` já redireciona globalmente (⚠️ conferir), não repetir. Só **um** router precisa de `tls.domains` para emitir o wildcard; os outros usam só `tls.certresolver=cfdns` (o Traefik reutiliza o cert que cobre o host).

---

## 2. Stack `sejaengajado` (Swarm)

### 2.1 Orçamento de RAM (o recurso escasso)
| Serviço | Réplicas | reservation | limit |
|---|---|---|---|
| web-ssr (Node) | 1 | 96M | 256M |
| app (nginx estático) — opcional | 1 | 16M | 48M |
| api (NestJS) | 1 | 128M | 320M |
| postgres 16 | 1 | 192M | 512M |
| redis 7 | 1 | 16M | 96M (maxmemory 64mb) |
| migrate (one-off) | 0 | — | 256M |
| backup (cron) | 1 | 16M | 128M (pico no dump) |
| **Total** | | **~460M** | **~1,4G** |

Com ~390 MiB livres e sem swap, **isso não cabe com segurança hoje** → 🛑 ver §7.1 (swap + liberar RAM). Com start-first, durante o deploy roda uma cópia extra de web/api por alguns segundos (+~0,5G de pico).

### 2.2 Imagens: MinIO existente vs Cloudflare R2
| | MinIO (já no VPS) | Cloudflare R2 |
|---|---|---|
| RAM extra | ~0 (já roda) mas cresce com uso | **0** no VPS |
| Disco | consome os ~33 GB | ilimitado/pago por uso, 10 GB grátis ⚠️ |
| Egress | banda do VPS | **sem custo de egress**, CDN junto ao domínio (`img.sejaengajado.com.br`) |
| Backup | precisa de backup próprio (hoje não tem) | durável, fora do VPS |
| Risco | um VPS = ponto único de falha | conta/token novo a criar |

**Recomendação: R2** (bucket `sejaengajado-media`, domínio custom `img.sejaengajado.com.br`, upload via URL pré-assinada da API → o arquivo nem passa pela RAM da API). O mesmo R2 (outro bucket) serve para os backups do Postgres. Alternativa sem conta nova: bucket no MinIO existente, aceitando os riscos acima. **Decisão.**

### 2.3 `infra/stack.yml` (pronto para adaptar)
```yaml
version: "3.8"

x-deploy-common: &deploy_common
  restart_policy: { condition: on-failure, delay: 5s, max_attempts: 5, window: 60s }
  update_config: { parallelism: 1, order: start-first, failure_action: rollback, monitor: 30s, delay: 5s }
  rollback_config: { parallelism: 1, order: start-first, failure_action: pause, monitor: 30s }
  placement: { constraints: [node.role == manager] }

x-logging: &logging
  driver: json-file
  options: { max-size: "10m", max-file: "3" }

services:
  web-ssr:
    image: ghcr.io/tarcisodev/sejaengajado-web:${IMAGE_TAG:?}
    environment:
      NODE_ENV: production
      PORT: "4000"
      API_INTERNAL_URL: http://api:3000
      NODE_OPTIONS: --max-old-space-size=192
    networks: [TarcisoDevNet, se_internal]
    logging: *logging
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:4000/healthz"]
      interval: 15s
      timeout: 3s
      retries: 3
      start_period: 20s
    deploy:
      <<: *deploy_common
      replicas: 1
      resources:
        reservations: { memory: 96M }
        limits: { memory: 256M, cpus: "0.50" }
      labels: [] # ver §1.4 (router se-web)

  api:
    image: ghcr.io/tarcisodev/sejaengajado-api:${IMAGE_TAG:?}
    environment:
      NODE_ENV: production
      PORT: "3000"
      NODE_OPTIONS: --max-old-space-size=256
      DATABASE_URL_FILE: /run/secrets/se_database_url
      REDIS_URL_FILE: /run/secrets/se_redis_url
      SUPABASE_URL: https://SUPABASE_HOST   # não é segredo
      S3_ENDPOINT: https://ACCOUNT.r2.cloudflarestorage.com
      S3_BUCKET: sejaengajado-media
    secrets: [se_database_url, se_redis_url, se_s3_access_key, se_s3_secret_key, se_payment_api_key, se_payment_webhook_secret]
    networks: [TarcisoDevNet, se_internal]
    logging: *logging
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/health"]
      interval: 15s
      timeout: 3s
      retries: 3
      start_period: 30s
    deploy:
      <<: *deploy_common
      replicas: 1
      resources:
        reservations: { memory: 128M }
        limits: { memory: 320M, cpus: "0.75" }
      labels:
        - traefik.enable=true
        - traefik.docker.network=TarcisoDevNet
        - traefik.http.routers.se-api.rule=Host(`api.sejaengajado.com.br`)
        - traefik.http.routers.se-api.priority=100
        - traefik.http.routers.se-api.entrypoints=websecure
        - traefik.http.routers.se-api.tls.certresolver=cfdns
        - traefik.http.routers.se-api.middlewares=se-headers,se-ratelimit
        - traefik.http.services.se-api.loadbalancer.server.port=3000

  migrate:            # one-off: replicas 0; o CI roda com `docker run` ou scale 1 (ver §3)
    image: ghcr.io/tarcisodev/sejaengajado-api:${IMAGE_TAG:?}
    command: ["sh", "-c", "export DATABASE_URL=$$(cat /run/secrets/se_database_url) && npx prisma migrate deploy"]
    secrets: [se_database_url]
    networks: [se_internal]
    deploy:
      replicas: 0
      restart_policy: { condition: none }
      resources: { limits: { memory: 256M } }

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: sejaengajado
      POSTGRES_USER: se_app
      POSTGRES_PASSWORD_FILE: /run/secrets/se_pg_password
    command: >
      postgres -c shared_buffers=96MB -c effective_cache_size=256MB -c work_mem=4MB
               -c maintenance_work_mem=32MB -c max_connections=40
    secrets: [se_pg_password]
    volumes: [se_pgdata:/var/lib/postgresql/data]
    networks: [se_internal]          # SEM ports: publicados
    logging: *logging
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U se_app -d sejaengajado"]
      interval: 10s
      timeout: 3s
      retries: 5
    deploy:
      replicas: 1
      update_config: { order: stop-first, failure_action: rollback }   # nunca 2 postgres no mesmo volume
      restart_policy: { condition: any }
      resources:
        reservations: { memory: 192M }
        limits: { memory: 512M }

  redis:
    image: redis:7-alpine
    command: ["sh", "-c", "exec redis-server --requirepass \"$$(cat /run/secrets/se_redis_password)\" --maxmemory 64mb --maxmemory-policy allkeys-lru --save '' --appendonly no"]
    secrets: [se_redis_password]
    networks: [se_internal]
    logging: *logging
    healthcheck:
      test: ["CMD-SHELL", "redis-cli -a \"$$(cat /run/secrets/se_redis_password)\" --no-auth-warning ping | grep PONG"]
      interval: 15s
      timeout: 3s
      retries: 3
    deploy:
      update_config: { order: stop-first, failure_action: rollback }
      resources:
        reservations: { memory: 16M }
        limits: { memory: 96M }

networks:
  TarcisoDevNet: { external: true }
  se_internal: { driver: overlay, internal: true, attachable: false }

volumes:
  se_pgdata: {}

secrets:
  se_database_url:           { external: true, name: se_database_url_v1 }
  se_redis_url:              { external: true, name: se_redis_url_v1 }
  se_redis_password:         { external: true, name: se_redis_password_v1 }
  se_pg_password:            { external: true, name: se_pg_password_v1 }
  se_s3_access_key:          { external: true, name: se_s3_access_key_v1 }
  se_s3_secret_key:          { external: true, name: se_s3_secret_key_v1 }
  se_payment_api_key:        { external: true, name: se_payment_api_key_v1 }
  se_payment_webhook_secret: { external: true, name: se_payment_webhook_secret_v1 }
```
Notas:
- A API precisa ler `*_FILE` (pequeno helper no bootstrap da config: se `X_FILE` existe, `X = readFile(X_FILE)`). Prisma não lê `_FILE` sozinho → montar `DATABASE_URL` no entrypoint.
- Redis é opcional no MVP (cache by-host 60 s cabe em memória com 1 réplica). Sem jobs em fila, dá para **não subir Redis** e economizar ~50 MB. **Decisão.**
- Worker de jobs (atraso/renovação, do plano): no MVP rodar como `@nestjs/schedule` dentro da `api` (1 réplica) para não gastar RAM com outro serviço; separar quando houver >1 réplica.
- `docker stack config -c infra/stack.yml` para validar (Docker ≥ 25 ⚠️).

---

## 3. CI/CD (padrão da casa: GHCR + runner self-hosted)
⚠️ O `DEPLOY.md` do `tarcisodev/ts-hairscience` **não foi lido nesta sessão**; o padrão abaixo segue a descrição recebida — alinhar nomes de labels do runner/caminhos com ele.

### 3.1 `.github/workflows/deploy.yml`
```yaml
name: build-and-deploy
on:
  push: { branches: [main] }
  workflow_dispatch:
    inputs:
      rollback_tag: { description: "SHA a re-implantar (rollback)", required: false }

concurrency: { group: deploy-prod, cancel-in-progress: false }
permissions: { contents: read, packages: write }
env:
  REGISTRY: ghcr.io/tarcisodev

jobs:
  build:
    if: ${{ !inputs.rollback_tag }}
    runs-on: ubuntu-latest
    strategy: { matrix: { app: [api, web] } }
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with: { registry: ghcr.io, username: ${{ github.actor }}, password: ${{ secrets.GITHUB_TOKEN }} }
      - uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/${{ matrix.app }}/Dockerfile
          push: true
          tags: ${{ env.REGISTRY }}/sejaengajado-${{ matrix.app }}:${{ github.sha }}
          cache-from: type=gha,scope=${{ matrix.app }}
          cache-to: type=gha,mode=max,scope=${{ matrix.app }}

  deploy:
    needs: [build]
    if: ${{ always() && (needs.build.result == 'success' || inputs.rollback_tag) }}
    runs-on: [self-hosted, linux, vps]       # ⚠️ labels do runner existente
    environment: production                   # exigir aprovação manual no GitHub (proteção)
    env:
      IMAGE_TAG: ${{ inputs.rollback_tag || github.sha }}
    steps:
      - uses: actions/checkout@v4
      - name: Login GHCR
        run: echo "${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u ${{ github.actor }} --password-stdin
      - name: Guarda de RAM
        run: |
          avail=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
          echo "MemAvailable=${avail}MiB"; [ "$avail" -gt 600 ] || { echo "RAM insuficiente para start-first"; exit 1; }
      - name: Registrar tag anterior
        run: |
          prev=$(docker service inspect sejaengajado_api --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}' 2>/dev/null | sed 's/.*://;s/@.*//' || true)
          echo "PREV_TAG=$prev" >> $GITHUB_ENV; echo "anterior: $prev"
      - name: Backup pré-migração
        if: ${{ !inputs.rollback_tag }}
        run: docker exec $(docker ps -q -f name=sejaengajado_backup) /usr/local/bin/pg-backup.sh pre-deploy-${IMAGE_TAG::7}
      - name: Migrations (one-off, antes de trocar)
        if: ${{ !inputs.rollback_tag }}   # rollback de código NÃO volta migration (expand/contract)
        run: |
          docker service update --detach=false --image ghcr.io/tarcisodev/sejaengajado-api:$IMAGE_TAG --replicas 1 sejaengajado_migrate \
            || docker stack deploy --with-registry-auth -c infra/stack.yml sejaengajado   # primeiro deploy
          ./infra/scripts/wait-oneoff.sh sejaengajado_migrate 180   # espera exit 0, senão falha (e mostra logs)
          docker service scale sejaengajado_migrate=0
      - name: Deploy
        run: docker stack deploy --with-registry-auth --prune=false -c infra/stack.yml sejaengajado
      - name: Gate de healthcheck
        run: |
          for i in $(seq 1 30); do
            curl -fsS https://api.sejaengajado.com.br/health && curl -fsS -o /dev/null https://teste.sejaengajado.com.br && exit 0
            sleep 5
          done
          echo "healthcheck falhou"; exit 1
      - name: Rollback automático
        if: failure() && env.PREV_TAG != ''
        run: |
          docker service rollback sejaengajado_api || true
          docker service rollback sejaengajado_web-ssr || true
          echo "::error::rollback para $PREV_TAG executado; migrations NÃO foram revertidas"
```
`infra/scripts/wait-oneoff.sh` (esboço):
```bash
#!/usr/bin/env bash
set -euo pipefail; svc=$1; timeout=${2:-180}; t=0
while [ $t -lt $timeout ]; do
  state=$(docker service ps "$svc" --no-trunc --format '{{.CurrentState}}|{{.Error}}' | head -1)
  case "$state" in Complete*) exit 0;; Failed*|Rejected*) docker service logs "$svc" --tail 100; exit 1;; esac
  sleep 3; t=$((t+3))
done; docker service logs "$svc" --tail 100; exit 1
```

### 3.2 Rollback
1. **Automático:** `update_config.failure_action: rollback` (Swarm volta sozinho se o healthcheck do container falhar no `monitor`) + passo `Rollback automático` do workflow.
2. **Manual rápido (no VPS):** `docker service rollback sejaengajado_api` (volta só 1 versão).
3. **Para qualquer SHA:** `workflow_dispatch` com `rollback_tag=<sha>` (pula build e migrations). As imagens GHCR são imutáveis por SHA → manter pelo menos as últimas 10 (não apagar tags velhas).
4. **Banco: expand/contract (sem migrations "down" em produção).**
   - *Expand* (release N): só adiciona colunas/tabelas/índices (`CREATE INDEX CONCURRENTLY` via SQL manual), colunas novas nullable ou com default. O código N-1 continua funcionando com o schema N → rollback de código é seguro.
   - *Contract* (release N+1 ou depois, quando N está estável): remove/renomeia o que é velho.
   - Renomear = adicionar nova + dual-write + backfill + trocar leitura + remover a antiga.
   - Desastre de dados: restaurar o dump `pre-deploy-<sha>` (§4) — decisão manual do Tarciso.
   - Revisão de PR: toda migration com `DROP`/`RENAME`/`NOT NULL` sem default é bloqueada no PR de expand.

---

## 4. Backup automático do Postgres

**Destino:** R2 (ou B2) num bucket só de backup `se-backups`, token com permissão de escrita **só nesse bucket** (ideal: sem delete; retenção por lifecycle rule do bucket). Criptografia com **age** (chave pública no VPS, chave privada **fora do VPS**, no Passbolt do Tarciso).
Retenção: 7 diários + 4 semanais + 6 mensais (lifecycle no bucket por prefixo ou limpeza no script).

### 4.1 `infra/backup/pg-backup.sh`
```bash
#!/usr/bin/env bash
# Roda dentro do serviço "backup" (imagem com postgres-client 16, age, rclone, curl).
set -euo pipefail
LABEL=${1:-daily}
TS=$(date -u +%Y%m%dT%H%M%SZ)
DOW=$(date -u +%u); DOM=$(date -u +%d)
PREFIX=daily; [ "$DOW" = 7 ] && PREFIX=weekly; [ "$DOM" = 01 ] && PREFIX=monthly
[ "$LABEL" != daily ] && PREFIX=adhoc
FILE="sejaengajado_${TS}_${LABEL}.dump.age"
HC_URL=$(cat /run/secrets/se_hc_backup_url)
export PGPASSWORD=$(cat /run/secrets/se_pg_password)

curl -fsS -m 10 --retry 3 "$HC_URL/start" >/dev/null || true
trap 'curl -fsS -m 10 --retry 3 "$HC_URL/fail" >/dev/null || true' ERR

pg_dump -h postgres -U se_app -d sejaengajado -Fc -Z 6 \
  | age -r "$(cat /run/secrets/se_backup_age_pubkey)" \
  | rclone rcat "r2:se-backups/${PREFIX}/${FILE}" --s3-no-check-bucket

size=$(rclone size "r2:se-backups/${PREFIX}/${FILE}" --json | sed 's/.*"bytes":\([0-9]*\).*/\1/')
[ "$size" -gt 1024 ] || { echo "dump suspeito: ${size} bytes"; false; }

# retenção (se não usar lifecycle do bucket)
rclone delete r2:se-backups/daily   --min-age 8d
rclone delete r2:se-backups/weekly  --min-age 29d
rclone delete r2:se-backups/monthly --min-age 190d
rclone delete r2:se-backups/adhoc   --min-age 30d

curl -fsS -m 10 --retry 3 "$HC_URL" >/dev/null
echo "ok ${PREFIX}/${FILE} ${size}B"
```
Serviço no stack (cron via `supercronic`, sem precisar de cron no host):
```yaml
  backup:
    image: ghcr.io/tarcisodev/sejaengajado-backup:${BACKUP_TAG:-1}   # Dockerfile: postgres:16-alpine + age rclone curl supercronic
    command: ["supercronic", "/etc/crontab"]       # "15 3 * * * /usr/local/bin/pg-backup.sh"  (03:15 UTC = 00:15 BRT)
    environment: { TZ: UTC, RCLONE_CONFIG: /run/secrets/se_rclone_conf }
    secrets: [se_pg_password, se_backup_age_pubkey, se_rclone_conf, se_hc_backup_url]
    networks: [se_internal, default_egress]       # precisa de saída p/ internet (a rede se_internal é internal)
    deploy: { resources: { reservations: { memory: 16M }, limits: { memory: 128M } } }
```
(⚠️ `se_internal` é `internal: true` → o serviço backup precisa de uma 2ª rede overlay não-internal para sair para o R2/Healthchecks; o mesmo vale para a `api`, que já está na `TarcisoDevNet`.)

**Monitoramento:** check no Healthchecks.io "se-pg-backup-daily", período 1 dia, grace 2 h, alerta por e-mail/Telegram. 🔐 A URL do ping é segredo (secret `se_hc_backup_url`).

### 4.2 Teste de restore mensal automático
`infra/backup/restore-test.sh` (cron `0 5 2 * *` no mesmo serviço, ou num runner fora do VPS para não gastar RAM — preferível):
```bash
#!/usr/bin/env bash
set -euo pipefail
HC=$(cat /run/secrets/se_hc_restore_url); curl -fsS "$HC/start" >/dev/null || true
trap 'curl -fsS "$HC/fail" >/dev/null || true; docker rm -f se-restore-test >/dev/null 2>&1 || true' ERR EXIT
LATEST=$(rclone lsf r2:se-backups/daily --files-only | sort | tail -1)
rclone cat "r2:se-backups/daily/$LATEST" | age -d -i /run/secrets/se_backup_age_privkey > /tmp/restore.dump   # só se rodar FORA do VPS
docker run -d --name se-restore-test -m 384m -e POSTGRES_PASSWORD=throwaway postgres:16-alpine
until docker exec se-restore-test pg_isready -U postgres; do sleep 2; done
docker exec -i se-restore-test pg_restore -U postgres -d postgres --create --no-owner < /tmp/restore.dump
# Query de verificação: tabelas-chave existem e têm dados recentes
docker exec se-restore-test psql -U postgres -d sejaengajado -tAc \
 "select (select count(*) from \"Site\") > 0 and (select max(\"createdAt\") from \"ScanEvent\") > now() - interval '3 days'" | grep -q t
rm -f /tmp/restore.dump
curl -fsS "$HC" >/dev/null
```
Observação: a chave privada `age` **não** deve morar no VPS. Por isso o restore-test idealmente roda num runner GitHub-hosted (workflow `schedule`) com a chave privada em GitHub Secret, ou na máquina do Tarciso. **Decisão.**

---

## 5. Monitoramento, uptime e logs
- **Uptime externo** (UptimeRobot free ou Better Stack): `https://sejaengajado.com.br`, `https://app.sejaengajado.com.br`, `https://api.sejaengajado.com.br/health` (keyword `"ok"`), `https://teste.sejaengajado.com.br` (wildcard). Intervalo 1–5 min. Alerta de **expiração de certificado** (≤14 dias) ligado.
- **Healthchecks:** Docker `healthcheck` em todos os serviços (acima) + `loadbalancer.healthcheck` no Traefik (o Traefik tira do balanceamento o container doente).
- **`/health` da API:** checa DB (`SELECT 1`) e Redis; `/healthz` do SSR: só processo vivo (não depender da API, para não derrubar o site em cascata).
- **Disco/RAM do host:** script cron no host (ou Netdata se a RAM permitir — **não** recomendado agora) que faz ping no Healthchecks.io só quando OK:
```bash
# /usr/local/bin/host-check.sh  (cron */5)
avail=$(awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo)
disk=$(df --output=pcent / | tail -1 | tr -dc 0-9)
[ "$avail" -gt 300 ] && [ "$disk" -lt 85 ] && curl -fsS -m 10 "$HC_HOST_URL" >/dev/null \
  || curl -fsS -m 10 --data "mem=${avail}MiB disk=${disk}%" "$HC_HOST_URL/fail" >/dev/null
```
- **Rotação de logs** (🛑 hoje 7,5 GB sem rotação): `/etc/docker/daemon.json` → `{"log-driver":"json-file","log-opts":{"max-size":"10m","max-file":"3"}}` + restart do Docker (afeta TODOS os stacks; vale só para containers novos → recriar com `docker service update --force` gradualmente). Até lá, o `logging:` por serviço no stack acima já protege o Seja Engajado.
- Traefik em `--log.level=INFO`, access log opcional com `--accesslog.filters.statuscodes=400-599`.
- Erros de app: Sentry (free) na API e no SSR — opcional.

---

## 6. Envs e segredos
| Tipo | Usar para | Exemplo |
|---|---|---|
| **Docker secret** (tmpfs `/run/secrets`, criptografado no raft) | tudo que é sensível | senha do PG, `DATABASE_URL`, tokens CF/R2, chave do gateway de pagamento, webhook secret, URLs de ping |
| **Docker config** | arquivos não sensíveis | `nginx.conf`, crontab do backup |
| `environment:` no stack | valores públicos | `NODE_ENV`, `PORT`, `SUPABASE_URL`, nome do bucket |

- **Nomes:** `se_<coisa>_v<N>` (prefixo do projeto evita colisão com os 16 stacks). No stack, o `target`/chave lógica fica sem versão (`se_pg_password`), o `name:` externo carrega a versão.
- **Rotação:** criar `se_x_v2` → mudar `name:` no stack → deploy (rolling) → validar → `docker secret rm se_x_v1`. Secrets são imutáveis no Swarm, por isso a versão no nome. Senha do Postgres: `ALTER ROLE` primeiro, depois o secret, depois `DATABASE_URL`.
- **Repo:** `.env.example` com placeholders (sem valores), `.env` no `.gitignore`, `gitleaks` no CI. Nada secreto no `stack.yml`.
```dotenv
# .env.example (dev local; em produção os sensíveis vêm de /run/secrets/*)
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://se_app:CHANGE_ME@localhost:5432/sejaengajado
REDIS_URL=redis://:CHANGE_ME@localhost:6379
SUPABASE_URL=https://your-project.supabase.co
S3_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com
S3_BUCKET=sejaengajado-media
S3_ACCESS_KEY=CHANGE_ME
S3_SECRET_KEY=CHANGE_ME
PAYMENT_API_KEY=CHANGE_ME
PAYMENT_WEBHOOK_SECRET=CHANGE_ME
```
- Criar secrets sem deixar rastro: `read -rs V && printf '%s' "$V" | docker secret create se_pg_password_v1 - && unset V`. Guardar cópia no **Passbolt** (já no VPS — ⚠️ e por isso também fazer backup dele; um cofre só dentro do mesmo VPS não é cópia de segurança).

---

## 7. Checklist de go-live

### 7.1 🛑 Pré-requisitos no VPS (bloqueadores — cada um com OK do Tarciso)
- [ ] **Swap 4 GB** (`fallocate -l 4G /swapfile`, `vm.swappiness=10`). Sem isso, um pico de deploy pode chamar o OOM killer em **qualquer** stack.
- [ ] **Folga de RAM ≥ 1,2 GB livre** antes de subir o stack: revisar stacks parados/pouco usados (`docker stats`), ou upgrade para KVM 4 (16 GB). **Decisão.**
- [ ] **Rotação de logs** do Docker + limpar os ~7,5 GB.
- [ ] **Firewall** (ufw ou firewall da Hostinger): liberar só 22 (idealmente por IP), 80, 443; **fechar 2377/7946/4789** (nó único não precisa delas expostas). ⚠️ Cuidado: Docker publica portas por iptables e ignora o ufw → usar o firewall do painel da Hostinger ou regras em `DOCKER-USER`.
- [ ] **SSH:** só chave, `PermitRootLogin prohibit-password` (ou usuário sudo), `PasswordAuthentication no`, fail2ban. Testar uma 2ª sessão antes de fechar a atual.
- [ ] **Portainer** fora da internet (só via túnel SSH/Tailscale) ou atrás de basic-auth + IP allowlist.
- [ ] Traefik `INFO`; backup do `acme.json` atual.
- [ ] Backup dos **outros** bancos (mysql, mongo, postgres14, supabase) — fora do escopo deste projeto, mas o risco é do mesmo VPS.

### 7.2 Contas/recursos (criar só com OK)
- [ ] Zona Cloudflare + NS trocados; MX conferidos.
- [ ] Token CF DNS (escopo da zona) → secret `cf_dns_api_token_v1`.
- [ ] R2: buckets `sejaengajado-media` e `se-backups`, tokens separados por bucket.
- [ ] Healthchecks.io: `se-pg-backup-daily`, `se-restore-monthly`, `vps-host`.
- [ ] UptimeRobot/Better Stack: 4 monitores + alerta de cert.
- [ ] GitHub: environment `production` com aprovação obrigatória; runner self-hosted com label `vps`.
- [ ] Par de chaves `age` (privada no Passbolt + fora do VPS).

### 7.3 Ordem de execução
1. DNS (cinza) → `dig A teste.sejaengajado.com.br +short` = 187.77.22.250.
2. Traefik + resolver `cfdns` em **staging** → cert "(STAGING)" no `teste.`.
3. Remover `caserver`, apagar `acme-cf.json` → cert de produção; conferir `*.` e apex no SANs.
4. Secrets criados (`docker secret ls | grep se_`).
5. 1º deploy pelo workflow (postgres+redis+migrate → api → web-ssr).
6. Backup manual + restore-test manual **antes** de dados reais.
7. Monitores ligados.

### 7.4 Smoke tests
```bash
curl -fsS https://api.sejaengajado.com.br/health
curl -sI https://sejaengajado.com.br | head -1
curl -s https://teste.sejaengajado.com.br | grep -i '<title>'                      # site do tenant via SSR
curl -s "https://api.sejaengajado.com.br/public/sites/by-host?host=naoexiste.sejaengajado.com.br" -o /dev/null -w '%{http_code}\n'  # 404
curl -sI http://sejaengajado.com.br | grep -i location                             # redirect https
echo | openssl s_client -connect 187.77.22.250:443 -servername x.sejaengajado.com.br 2>/dev/null | openssl x509 -noout -subject -ext subjectAltName -dates
docker service ls | grep sejaengajado ; free -m                                      # réplicas 1/1 e RAM após deploy
nc -zv 187.77.22.250 5432 ; nc -zv 187.77.22.250 6379                               # devem FALHAR (sem porta publicada)
```
Mais: login Supabase → criar site → aparece no subdomínio sem DNS novo; site SUSPENDED mostra "temporariamente indisponível"; webhook de pagamento em sandbox.

### 7.5 Ensaio de rollback (obrigatório antes de anunciar)
- [ ] Deploy de um SHA com `/health` quebrado de propósito → confirmar que o Swarm/workflow volta sozinho para o SHA anterior.
- [ ] `workflow_dispatch rollback_tag=<sha anterior>` funciona.
- [ ] `docker service rollback sejaengajado_api` manual funciona.
- [ ] Restore do dump `pre-deploy-*` num container descartável funciona (cronometrar o RTO).
- [ ] Rollback do Traefik (`docker service rollback traefik`) documentado e os outros stacks seguem OK.

---

## 8. Decisões pendentes do Tarciso
1. Folga de RAM: limpar stacks vs upgrade para KVM 4 (16 GB). Swap: ok para criar?
2. `app.` em nginx estático separado ou servido pelo `web-ssr`.
3. Imagens: **R2 (recomendado)** vs bucket no MinIO existente.
4. Destino do backup: R2 vs B2; onde roda o restore-test (GitHub-hosted vs VPS).
5. Redis no MVP: sim (cache compartilhado) ou não (economiza RAM).
6. Proxy Cloudflare: começar cinza (recomendado) e quando ligar o laranja.
7. Supabase Auth: self-hosted do VPS vs Cloud.
8. Janela para mexer no Traefik (afeta todos os stacks).
9. Uptime: UptimeRobot vs Better Stack.
