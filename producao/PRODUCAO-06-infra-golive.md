# PRODUÇÃO 06 — Infra (Swarm/Traefik), CI/CD, backup e go-live
> 🛑 **Bloqueado até a Fase 0 (PRODUCAO-01, F0.1–F0.6) estar concluída:** RAM ≥ 1,2 GB livre ou KVM 4, swap, hardening, Portainer fechado e certresolver `cfdns` validado no staging.
> O Cursor **escreve** os arquivos de infra e os runbooks; **quem aplica** na VPS, no DNS e no Traefik é o Tarciso ou o Atlas, com OK e na janela marcada (⏳P22). Detalhe técnico: `contrib-atlas.md`. Nunca escreva valores de segredo; só nomes.
> Ajustes deste prompt sobre o Atlas: **sem host `api.`** (a API fica em `app.sejaengajado.com.br/api`, D17); prontidão em `/api/health/ready` (D10); Redis fora do MVP (⏳P11).

---
## B1 — Dockerfiles
- **Objetivo:** imagens pequenas e não-root.
- **Arquivos:** `api/Dockerfile` (multi-stage, Node 22 alpine, `prisma generate`, usuário `node`, entrypoint que lê `DATABASE_URL_FILE`), `web/Dockerfile` (build SSR, `node dist/web/server/server.mjs`, porta 4000), `infra/backup/Dockerfile` (postgres:16-alpine + age + rclone + curl + supercronic).
- **Pronto:** cada imagem roda localmente com `docker run` e responde ao healthcheck.
- **Testes:** `docker build` no CI; o processo não roda como root (`id -u` ≠ 0).
- **Commit:** `build: production dockerfiles`. **PARE.**

## B2 — `infra/stack.yml` (⏳P11 ⏳P17 ⏳P19)
- **Objetivo:** stack `sejaengajado` dentro do orçamento de RAM.
- **Arquivos:** `infra/stack.yml` baseado no Atlas §2.3: `web-ssr` (96M/256M), `api` (128M/320M), **sem serviço Postgres** (P3, decidido em 15/10/2026: banco `sejaengajado` no Postgres do Supabase self-hosted da VPS; `api`, `migrate` e `backup` entram na rede interna do Supabase, sem porta publicada), `SUPABASE_URL` como env pública, `migrate` (one-off, replicas 0), `backup`; sem Redis (⏳P11). Routers: `se-app` = `Host(app.sejaengajado.com.br) && PathPrefix(/api)` → api:3000 (prioridade 200); `se-web` = `Host(sejaengajado.com.br) || Host(app.…) || HostRegexp(^[a-z0-9-]+\.sejaengajado\.com\.br$)` → web-ssr:4000 (prioridade 1), com `tls.certresolver=cfdns` e `tls.domains` apex + `*`; middlewares de headers (HSTS, nosniff, frameDeny, referrer) e rate limit; `update_config: start-first` + rollback; healthchecks `/api/health/ready` e `/healthz`; rotação de log por serviço; `traefik.swarm.network=TarcisoDevNet` (v3, confirmar na F0.1).
- **Pronto:** `docker stack config -c infra/stack.yml` valida; a soma das reservas fica ≤ 500 MB.
- **Testes:** lint do YAML; grep sem nenhum valor de segredo.
- **Commit:** `feat(infra): swarm stack`. **PARE.**

## B3 — Secrets e envs (só nomes)
- **Objetivo:** inventário de segredos.
- **Arquivos:** `infra/secrets.md` com a tabela nome → uso → como criar (`read -rs V && printf '%s' "$V" | docker secret create <nome> - && unset V`) e o roteiro de rotação `_vN`. Nomes: `cf_dns_api_token_v1`, `se_database_url_v1`, `se_backup_database_url_v1`, `se_supabase_jwt_secret_v1` (HS256, o mesmo `GOTRUE_JWT_SECRET` do Supabase, P2a), `se_supabase_service_role_key_v1`, `se_smtp_url_v1`, `se_asaas_api_key_v1`, `se_asaas_webhook_token_v1`, `se_s3_access_key_v1`, `se_s3_secret_key_v1`, `se_backup_age_pubkey_v1`, `se_rclone_conf_v1`, `se_hc_backup_url_v1`, `se_hc_jobs_url_v1`, `se_sentry_dsn_v1`. GitHub Secrets (só no restore-test): `BACKUP_AGE_PRIVKEY`, `RCLONE_CONF_RESTORE`. Cópia de cada segredo no Passbolt e também fora da VPS.
- **Pronto:** `.env.example` (api e web) cobre todas as variáveis, só com placeholders.
- **Testes:** gitleaks verde.
- **Commit:** `docs(infra): secrets inventory`. **PARE.**

## B4 — CI/CD (GHCR + runner self-hosted)
- **Objetivo:** deploy com aprovação e rollback.
- **Arquivos:** `.github/workflows/deploy.yml` (Atlas §3.1): build matrix api/web → GHCR com tag = SHA; job `deploy` em `[self-hosted, linux, vps]` com `environment: production` (aprovação manual); guarda de RAM (> 600 MB); backup pré-migração; `migrate` one-off; `docker stack deploy`; gate de saúde (`https://app.sejaengajado.com.br/api/health/ready` e `https://teste.sejaengajado.com.br`); rollback automático; `workflow_dispatch rollback_tag`. `infra/scripts/wait-oneoff.sh`. Política expand/contract para migrations (PR com `DROP`/`RENAME` bloqueado).
- **Pronto:** pipeline verde num ambiente de ensaio; nenhum token além do `GITHUB_TOKEN`.
- **Testes:** `actionlint`; ensaio de rollback (B8).
- **Commit:** `ci: build and deploy pipeline`. **PARE.**

## B5 — Wildcard em produção e DNS final (⏳P20 ⏳P22)
- **Objetivo:** sair do staging.
- **Arquivos:** `infra/runbooks/06-cert-producao.md`: na janela marcada, remover o `caserver` de staging do `cfdns`, apagar `acme-cf.json`, reaplicar o stack do Traefik e conferir SAN apex + `*`; os outros stacks continuam intactos; Cloudflare em DNS-only, Full (strict) e Always HTTPS; alerta de expiração do certificado.
- **Pronto:** `openssl s_client -servername x.sejaengajado.com.br` mostra o emissor de produção com SAN `*.sejaengajado.com.br`; os outros domínios do Traefik respondem.
- **Testes:** curl antes e depois em todos os domínios do Traefik.
- **Commit:** `docs(infra): production wildcard runbook`. **PARE.**

## B6 — Backup no R2 e restore testado (⏳P18)
- **Objetivo:** dados recuperáveis fora da VPS.
- **Arquivos:** `infra/backup/pg-backup.sh` (pg_dump `-Fc` só do banco `sejaengajado` no Postgres do Supabase, com role de backup própria e só leitura (com `BYPASSRLS`, porque as tabelas usam `FORCE RLS`; nunca a role da app) → age → `rclone rcat r2:se-backups/...`; tamanho mínimo; retenção de 7 diários, 4 semanais e 6 mensais; ping no Healthchecks), crontab (03:15 UTC = 00:15 BRT), `infra/backup/restore-test.sh` + workflow `restore-test.yml` (schedule mensal, runner GitHub-hosted, chave privada só em GitHub Secret), backup das imagens (R2 `sejaengajado-media`, versionamento/lifecycle), `docs/runbooks/restore.md` com o RTO medido.
- **Pronto:** um backup manual e um restore manual feitos **antes de existirem dados reais**.
- **Testes:** o restore-test confere tabelas-chave e a contagem de linhas.
- **Commit:** `feat(infra): encrypted offsite backups`. **PARE.**

## B7 — Observabilidade (⏳P23)
- **Objetivo:** saber antes do cliente.
- **Arquivos:** Sentry (api, SSR e browser; release = SHA), logs pino JSON sem PII, UptimeRobot (raiz, `app.`, `app./api/health/ready`, `teste.`, alerta de certificado), Healthchecks.io (`se-pg-backup-daily`, `se-restore-monthly`, `se-jobs`, `vps-host`), `host-check.sh` (RAM < 300 MB ou disco > 85% → alerta), Traefik em INFO.
- **Pronto:** um alerta de teste chega ao Tarciso por cada canal.
- **Testes:** derrubar o `/health` num ensaio dispara o alerta.
- **Commit:** `feat(infra): monitoring`. **PARE.**

## B8 — Go-live (⏳P6 ⏳P16 ⏳P25)
- **Objetivo:** checklist final (Alicerce §10 + Atlas §7).
- **Arquivos:** `docs/GO-LIVE.md`:
  - [ ] Fase 0 completa; e-mail funcionando após a troca de NS.
  - [ ] Wildcard em produção; raiz, `app.` e `teste.` ok; Postgres do Supabase sem porta exposta (`nc -zv <VPS_IP> 5432` falha).
  - [ ] Matriz RBAC + A↔B + RLS verde no CI; jobs, multa e fatura testados.
  - [ ] E2E sandbox (05-B7) verde → conta Asaas de produção aprovada, secrets trocados, URL do webhook cadastrada.
  - [ ] Valores reais em `PlatformConfig` e atacado inicial cadastrados (⏳P6).
  - [ ] SMTP (o do Supabase Auth e o dos avisos) com SPF/DKIM/DMARC; OTP, convite, reset e aviso entregando (⏳P16); P2a conferido.
  - [ ] `GOTRUE_JWT_EXP` reduzido para 3600 (com OK do Tarciso, afeta o SaaS de QR); teste de usuário não convidado = 403.
  - [ ] Termos, privacidade (LGPD) e contrato do revendedor publicados (⏳P25).
  - [ ] Slugs reservados e blocklist carregados; botão "denunciar" e suspensão pelo admin testados.
  - [ ] Backup diário + restore testado; monitores ativos.
  - [ ] **Ensaio de rollback:** SHA quebrado volta sozinho; `rollback_tag` funciona; `docker service rollback` manual; restore do `pre-deploy-*`; rollback do Traefik documentado.
  - [ ] Piloto: 1 revendedor + 5 clientes reais em Uberaba.
- **Pronto:** todos os itens marcados, com evidência (link ou print) em cada um.
- **Testes:** smoke tests do Atlas §7.4 adaptados (sem `api.`).
- **Commit:** `docs: go-live checklist`. **PARE.**
