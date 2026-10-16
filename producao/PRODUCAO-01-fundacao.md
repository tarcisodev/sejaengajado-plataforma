# PRODUÇÃO 01 — Fundação (Fase 0 VPS + base do código)
Leia antes `PRODUCAO-00-indice.md` (versões, arquitetura, regras e decisões ⏳P#). Formato de cada bloco: Objetivo, Arquivos, Pronto, Testes, Commit e **PARE**.

---
## 🛑 FASE 0 — Pré-requisitos na VPS (antes de qualquer deploy)
> **Quem executa:** Tarciso ou Atlas, com OK explícito em cada passo. **O Cursor só escreve os runbooks** em `infra/runbooks/fase0/*.md` e não roda nada na VPS. Valores (IP, tokens, e-mails) nunca vão para o repo: use `<VPS_IP>` e nomes de secrets.
> Base: levantamento de 03/10 (~390 MB livres, sem swap, SSH com senha, sem firewall, Portainer público, Traefik v3.5.3 com log DEBUG, sem backups).

### F0.1 — Levantamento read-only atualizado
- **Objetivo:** confirmar o estado real antes de mexer em qualquer coisa.
- **Arquivos:** `infra/runbooks/fase0/01-levantamento.md` (comandos: `free -m`, `swapon --show`, `df -h`, `docker stack ls`, `docker stats --no-stream`, `du -sh /var/lib/docker/containers`, args/secrets do Traefik, nome do resolver atual, provider swarm, `ufw status`, `ss -tlnp`, `sshd -T | grep -E "permitrootlogin|passwordauthentication"`).
- **Pronto:** a tabela de estado foi preenchida com a data; a versão do Traefik e o nome do resolver atual foram confirmados.
- **Testes:** nenhum comando altera estado (revisão do runbook).
- **Commit:** `docs(infra): fase0 survey runbook`. **PARE.**

### F0.2 — Folga de RAM (⏳P21)
- **Objetivo:** chegar a ≥ 1,2 GB de MemAvailable antes de subir o stack (orçamento do stack: ~460 MB reservados, ~1,4 GB de limite, com pico extra no start-first).
- **Arquivos:** `infra/runbooks/fase0/02-ram.md`: lista de stacks ociosos para escalar a 0 (decisão do Tarciso) **ou** o roteiro de upgrade para o KVM 4 no painel da Hostinger.
- **Pronto:** `free -m` mostra ≥ 1200 MB disponíveis, com evidência anotada.
- **Testes:** os outros stacks seguem respondendo (curl nos domínios deles).
- **Commit:** `docs(infra): fase0 ram plan`. **PARE.**

### F0.3 — Swap e rotação de logs
- **Objetivo:** evitar o OOM killer e o disco cheio.
- **Arquivos:** `infra/runbooks/fase0/03-swap-logs.md`: swapfile de 4 GB, `vm.swappiness=10` persistido em `/etc/sysctl.d`, `/etc/fstab`; `/etc/docker/daemon.json` com `max-size 10m` e `max-file 3`, limpeza dos ~7,5 GB e recriação gradual com `docker service update --force`.
- **Pronto:** `swapon --show` lista 4G; as configurações sobrevivem a um reboot; o disco ganhou espaço.
- **Testes:** reboot controlado na janela, com os stacks voltando.
- **Commit:** `docs(infra): fase0 swap and log rotation`. **PARE.**

### F0.4 — Hardening (SSH, firewall, Portainer)
- **Objetivo:** fechar as portas de entrada óbvias.
- **Arquivos:** `infra/runbooks/fase0/04-hardening.md`:
  - SSH só por chave: `PasswordAuthentication no`, `PermitRootLogin prohibit-password` (ou usuário sudo), fail2ban. **Testar numa 2ª sessão antes de fechar a atual.**
  - Firewall da Hostinger (ou regras em `DOCKER-USER`, porque o Docker ignora o ufw): liberar só 22 (de preferência por IP), 80 e 443; **fechar 2377, 7946 e 4789**.
  - **Portainer fechado:** sem router público; acesso por túnel SSH ou Tailscale.
  - Traefik em `--log.level=INFO`.
- **Pronto:** login por senha recusado; `nc -zv <VPS_IP> 2377/9443` falha de fora; o Portainer só abre pelo túnel.
- **Testes:** varredura externa de portas (nmap a partir de outra máquina).
- **Commit:** `docs(infra): fase0 hardening`. **PARE.**

### F0.5 — Zona na Cloudflare e token DNS (⏳P20)
- **Objetivo:** delegar o DNS sem derrubar o e-mail.
- **Arquivos:** `infra/runbooks/fase0/05-cloudflare.md`: importar e conferir MX/TXT **antes** de trocar os NS na Hostinger; registros A `@`, `*` e `app` → `<VPS_IP>` em DNS-only; SSL Full (strict); CAA opcional. Token custom com Zone:DNS:Edit + Zone:Read **só desta zona** → Docker secret `cf_dns_api_token_v1` (via stdin, sem histórico).
- **Pronto:** `dig NS` aponta para a Cloudflare; `dig A teste.sejaengajado.com.br` = IP da VPS; o e-mail continua funcionando; `docker secret ls` mostra `cf_dns_api_token_v1`.
- **Testes:** envio e recebimento de um e-mail de teste após a troca de NS.
- **Commit:** `docs(infra): fase0 cloudflare zone`. **PARE.**

### F0.6 — Certresolver `cfdns` no STAGING do Let's Encrypt (janela marcada ⏳P22)
- **Objetivo:** provar o wildcard DNS-01 sem quebrar os outros sites do Traefik compartilhado.
- **Arquivos:** `infra/runbooks/fase0/06-certresolver-staging.md` + o patch no stack do Traefik (só **acrescentar** args; o resolver atual não é tocado): `certificatesresolvers.cfdns.acme.*` com `dnschallenge.provider=cloudflare`, `storage=/letsencrypt/acme-cf.json` separado, `caserver` de **staging**, `CF_DNS_API_TOKEN_FILE=/run/secrets/cf_dns_api_token` e secret externo `cf_dns_api_token_v1`. Antes: backup do `acme.json` e `docker service inspect traefik > traefik-spec-<data>.json`; `docker service rollback traefik` pronto.
- **Pronto:** `curl -vk https://teste.sejaengajado.com.br` mostra issuer "(STAGING)" com SAN `*.sejaengajado.com.br`; **todos os outros domínios do Traefik respondem normalmente**; o resultado foi anotado no runbook. A troca para produção fica em PRODUCAO-06 B5.
- **Testes:** checklist de curl nos outros stacks antes e depois; logs `grep -i cfdns`.
- **Commit:** `docs(infra): fase0 dns-01 staging`. **PARE.**

> ✅ Só com F0.1–F0.6 concluídos o PRODUCAO-06 pode fazer deploy. Os blocos B1–B4 abaixo são locais e podem andar em paralelo.

---
## B1 — Repositório e alinhamento de versões
- **Objetivo:** monorepo `E:\dev\sejaengajado\plataforma` com `web/` (já existe), `api/` e `infra/`; padronizar as versões reais.
- **Arquivos:** `README.md`, `.editorconfig` (LF, UTF-8), `.gitattributes` (`* text=auto eol=lf`), `.gitignore` (`.env`, `dist`, `coverage`), `.nvmrc` (22), `docs/versions.md` (Angular 22.2, Tailwind 4.3, spartan 1.6.3, Angular SSR, NestJS 11, Prisma 6, Postgres 16).
- **Pronto:** `web/package.json` confere com `docs/versions.md`; grep sem "Angular 19", "Tailwind 3.4" nem "TypeORM" no repo (exceto no próprio aviso).
- **Testes:** `npm ci && npm run build` em `web/`.
- **Commit:** `chore: monorepo layout and version baseline`. **PARE.**

## B2 — Esqueleto da API NestJS (⏳P24)
- **Objetivo:** API de produção mínima.
- **Arquivos:** `api/` (Nest 11, TS strict), `src/config/` (zod; carregador `X_FILE` → `X` para Docker secrets; falha rápido), `nestjs-pino` com `requestId` e redact (`authorization`, `cookie`, `token`, `password`, `email`, `whatsapp`, `cpf/cnpj`, payload de webhook), filtro global `{code,message,fields?}` com mensagem em pt-BR, helmet, **sem CORS** (a API é servida em `app.sejaengajado.com.br/api`, mesma origem; `setGlobalPrefix('api')`), `ThrottlerModule`, `/api/health` (liveness) e `/api/health/ready` (DB + migrations + fila), shutdown gracioso, `src/common/money.ts` (centavos inteiros, arredondamento único), paginação por cursor `{items,nextCursor}`; `api/.env.example` com nomes apenas (`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_JWT_SECRET_FILE` (HS256, P2a), `SUPABASE_SERVICE_ROLE_KEY_FILE`, `SMTP_URL_FILE`, `ASAAS_API_KEY_FILE`, `ASAAS_WEBHOOK_TOKEN_FILE`, `S3_*`, `SENTRY_DSN`); `docker-compose.dev.yml` com `postgres:16-alpine` (só dev; em produção o banco é o `sejaengajado` no Postgres do Supabase self-hosted, P3).
- **Pronto:** `/api/health` 200; `/api/health/ready` 503 sem DB e 200 com DB; config inválida derruba a subida.
- **Testes:** formato de erro, paginação, `money.ts` (arredondamento) e log sem `authorization/password`.
- **Commit:** `feat(api): production skeleton`. **PARE.**

## B3 — Harness de testes
- **Objetivo:** testes com Postgres real.
- **Arquivos:** `api/test/setup/` (Testcontainers `postgres:16`, migrations aplicadas, truncate entre testes), factories, supertest e2e, helper `loginAs(role, resellerId?)`, `FakeGateway` registrado.
- **Pronto:** `npm run test` (unitários) e `npm run test:int` (integração) passam com um exemplo de cada.
- **Testes:** o próprio exemplo, mais um teste que falha se for usado SQLite ou mock do Prisma.
- **Commit:** `test(api): testcontainers harness`. **PARE.**

## B4 — CI de qualidade (sem deploy)
- **Objetivo:** barrar regressões em todo PR.
- **Arquivos:** `.github/workflows/ci.yml`: jobs `web` (lint, test, build SSR, format:check) e `api` (lint, test, test:int com service Postgres 16, `prisma validate`), `gitleaks`, `npm audit --audit-level=high`. Permissões mínimas (`contents: read`).
- **Pronto:** o CI fica verde num PR de teste e vermelho num PR com segredo falso de teste.
- **Testes:** os dois PRs de prova.
- **Commit:** `ci: quality gates`. **PARE.**
