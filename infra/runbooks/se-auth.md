# Runbook — Auth dedicado (`se-auth`)

GoTrue do Seja Engajado em `https://auth.sejaengajado.com.br` (stack Swarm `se-auth`, ADR-002).  
**Não** usa o Supabase compartilhado `supabase.tarciso.dev`. Deploy na VPS: Tarciso (manual).

## Pré-requisitos

1. Secrets criados (ver `infra/secrets.md`):
   - `se_auth_jwt_secret_v1`
   - `se_auth_db_url_v1` (role `se_auth`, schema `auth`, DB `sejaengajado`)
   - `se_auth_service_role_key_v1` / `se_auth_anon_key_v1` (Passbolt + env)
   - `se_smtp_url_v1` (Resend; também usado pelo GoTrue)
2. DNS: `auth.sejaengajado.com.br` → Traefik (mesmo wildcard/`cfdns` ou registro dedicado).
3. Rede externa `TarcisoDevNet` já existe.

## Deploy

Na raiz do repo (ou com os arquivos presentes na VPS):

```bash
cd /path/to/plataforma
docker stack deploy -c infra/auth/se-auth.yml se-auth
docker service ls | grep se-auth
docker service logs -f se-auth_gotrue
```

Arquivos: `infra/auth/se-auth.yml` + `infra/auth/templates/{otp,invite,recovery}.html` (configs Swarm; sem segredo).

## Smoke

```bash
curl -fsS https://auth.sejaengajado.com.br/auth/v1/health
# OTP / magic link a partir de app.sejaengajado.com.br (SUPABASE_URL apontando para auth.)
```

## App (`sejaengajado`)

- `SUPABASE_URL=https://auth.sejaengajado.com.br` em `web-ssr` e `api` (`infra/stack.yml`).
- Mounts internos `se_supabase_jwt_secret` / `se_supabase_service_role_key` → externos `se_auth_*_v1`.
- Deploy do app: `docker stack deploy -c infra/stack.yml sejaengajado` (CI ou manual).

## Rollback

```bash
docker service rollback se-auth_gotrue
# ou remover o stack (derruba login):
# docker stack rm se-auth
```

Após cutover estável, remover secrets aposentados `se_supabase_*_v1` se ainda existirem.
