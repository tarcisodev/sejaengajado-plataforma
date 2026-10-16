# Go-live — Seja Engajado (PRODUCAO-06 B8)

Checklist **ordenado**. Marque com evidência (link/print) em cada item.  
Deploy na VPS: **Tarciso** (Cursor não aplica).

Referências: Fase 0 (`infra/runbooks/fase0/`), auth dedicado (`infra/runbooks/se-auth.md`), wildcard (`infra/runbooks/06-cert-producao.md`), restore (`docs/runbooks/restore.md`), monitoramento (`docs/runbooks/monitoring.md`), secrets (`infra/secrets.md`), virar Asaas (`infra/runbooks/virar-asaas-producao.md`), CI (`.github/workflows/deploy.yml`).

---

## 1. Fundação (Fase 0)

- [ ] F0.1–F0.6 concluídos (RAM ≥ 1,2 GB livre ou KVM 4, swap, logs, hardening, Portainer fechado, `cfdns` staging ok).
- [ ] E-mail do domínio funcionando após troca de NS (MX/SPF intactos).
- [ ] Postgres **sem** porta publicada: `nc -zv <VPS_IP> 5432` falha.

## 2. Secrets e contas

- [ ] Secrets Swarm criados (`docker secret ls | grep se_`) conforme `infra/secrets.md` (cópia Passbolt + offsite).
- [ ] Auth: `se_auth_{jwt_secret,db_url,service_role_key,anon_key}_v1` (não usar `se_supabase_*` aposentados).
- [ ] Stack `se-auth` no ar: `docker stack deploy -c infra/auth/se-auth.yml se-auth` + `curl -fsS https://auth.sejaengajado.com.br/auth/v1/health`.
- [ ] App com `SUPABASE_URL=https://auth.sejaengajado.com.br` (stack `sejaengajado`).
- [ ] R2: `se-uploads` / `se-backup` (+ mídia); lifecycle 30d no backup.
- [ ] Healthchecks.io: `se-pg-backup-daily`, `se-restore-monthly`, `se-jobs`, `vps-host`.
- [ ] Sentry project + DSN em `se_sentry_dsn_v1`.
- [ ] UptimeRobot: raiz, `app.`, `auth.`, `app./api/health/ready` + alerta de certificado (sem `teste.*` até haver site).
- [ ] Asaas: sandbox e2e (05-B7) verde → conta produção aprovada; `se_asaas_api_key_v2` + runbook `virar-asaas-producao.md` (BASE_URL + webhook `/api/webhooks/asaas`).
- [ ] Melhor Envio: `se_melhorenvio_token_v1` montado; cotação no checkout sem mock.

## 3. Runner e CI

- [ ] GitHub Environment `production` com aprovador obrigatório.
- [ ] Runner self-hosted labels `[self-hosted, linux, vps]`.
- [ ] GHCR: imagens `sejaengajado-{api,web,backup}:<sha>` (sem `:latest` em prod).
- [ ] 1º deploy aprovado via `build-and-deploy` (ou ensaio equivalente).

## 4. Certificado wildcard (produção)

- [ ] Runbook `06-cert-producao.md` executado na janela ⏳P22 (sem alteração DNS neste passo).
- [ ] `openssl s_client -servername app.sejaengajado.com.br` → emissor produção, SAN `*.sejaengajado.com.br` + apex.
- [ ] Outros stacks Traefik (ts/painel/qr) ainda respondem.

## 5. Backup + restore (antes de dados reais)

- [ ] Backup manual: `docker exec … pg-backup.sh adhoc-golive`.
- [ ] Restore-test (Actions `restore-test` ou local) verde; `RESTORE_RTO_SECONDS` preenchido em `docs/runbooks/restore.md`.
- [ ] Cron host `host-check.sh` pingando `vps-host`.

## 6. Produto / compliance

- [ ] Matriz RBAC + A↔B + RLS verde no CI; jobs, multa e fatura testados.
- [ ] Valores reais em `PlatformConfig` e atacado inicial (⏳P6).
- [ ] SMTP (Auth + avisos) SPF/DKIM/DMARC; OTP, convite, reset e aviso entregando (⏳P16); GoTrue em `auth.sejaengajado.com.br`.
- [ ] `GOTRUE_JWT_EXP=3600` no `se-auth`; usuário não convidado = 403 (`GOTRUE_DISABLE_SIGNUP=true`).
- [ ] Termos, privacidade (LGPD) e contrato do revendedor publicados (⏳P25).
- [ ] Slugs reservados + blocklist; denúncia e suspensão admin testados.
- [ ] Monitores ativos (Sentry recebe evento de teste; Uptime + HC).

## 7. Smoke tests (adaptados — sem host `api.`)

```bash
curl -fsS https://app.sejaengajado.com.br/api/health
curl -fsS https://app.sejaengajado.com.br/api/health/ready
curl -sI https://sejaengajado.com.br | head -1
curl -sI https://app.sejaengajado.com.br | head -1
curl -sI http://sejaengajado.com.br | grep -i location   # redirect https
echo | openssl s_client -servername app.sejaengajado.com.br \
  -connect app.sejaengajado.com.br:443 2>/dev/null \
  | openssl x509 -noout -issuer -subject -dates -ext subjectAltName
docker service ls | grep sejaengajado
free -m
nc -zv <VPS_IP> 5432   # deve FALHAR
```

Mais: login via `auth.sejaengajado.com.br` → criar site → subdomínio sem DNS novo; site SUSPENDED; webhook sandbox.

- [ ] Smoke acima verde.

## 8. Ensaio de rollback por SHA (obrigatório)

Ordem sugerida:

1. Anotar SHA bom atual: `docker service inspect sejaengajado_api --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}'`.
2. **Automático:** deploy de SHA com health quebrado (ensaio) → Swarm/`failure_action: rollback` + passo do workflow volta sozinho.
3. **Manual Actions:** `workflow_dispatch` com `rollback_tag=<sha-bom>` (pula build/migrate).
4. **Manual Swarm:** `docker service rollback sejaengajado_api` e `sejaengajado_web-ssr`.
5. **Dados:** restore de `pre-deploy-*` em Postgres descartável (RTO).
6. **Traefik:** `docker service rollback traefik` documentado; outros stacks OK.

- [ ] Ensaio completo com evidência (logs Actions + `docker service ps`).

> Migrations expand/contract **não** têm down em produção — rollback de código não reverte schema.

## 9. Sites-modelo (showcase)

**Não** rode `npm run seed:demo` em produção — ele sobrescreve `platform_config`, products, plans e cria admin/revenda demo. Em produção use só `seed:showcase`.

Após deploy + migrate na VPS (Atlas), criar os 3 biosites de demonstração (idempotente; create-only — segunda execução não altera nada):

```bash
# Dentro do container api em execução (admin DB via secret):
cid=$(docker ps -q -f name=sejaengajado_api | head -1)
docker exec -u node "$cid" sh -c \
  'export DATABASE_URL="$(tr -d "\n\r" < /run/secrets/se_admin_database_url)" && node dist/prisma/seed-showcase.js'
# equivalente: … && npm run seed:showcase
```

Pré-requisitos: reseller `isPlatform` e pelo menos um `Plan` (ex.: PRONTO) já existentes. Abort se faltar o reseller plataforma.

| Slug | URL |
| --- | --- |
| `demo-forno` | https://demo-forno.sejaengajado.com.br |
| `demo-barbearia` | https://demo-barbearia.sejaengajado.com.br |
| `demo-estudio` | https://demo-estudio.sejaengajado.com.br |

Sites com `is_demo=true` (fora de cobrança e métricas). Cliente CRM: “Demonstração Seja Engajado” na revenda Plataforma. `seed:demo` fica só para dev/e2e (`ALLOW_DEMO_SEED=1` se precisar apontar ao DB `sejaengajado`).

## 10. Piloto

- [ ] 1 revendedor + 5 clientes reais em Uberaba.
- [ ] Checklist inteiro marcado com evidência → anunciar.

---

## Atalhos

| Ação | Como |
| --- | --- |
| Deploy | push `main` → approve `production` |
| Rollback SHA | Actions → `build-and-deploy` → `rollback_tag=<sha>` |
| Backup adhoc | `docker exec $(docker ps -q -f name=sejaengajado_backup) /usr/local/bin/pg-backup.sh adhoc` |
| Host check | `HC_HOST_URL_FILE=… bash infra/scripts/host-check.sh` |
