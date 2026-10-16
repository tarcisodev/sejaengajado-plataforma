# Seja Engajado: pipeline CI/CD (issue + branch + PR "Closes #n", sem merge nem deploy pelo agente)
Não grave IP, token, e-mail nem senha no repo. Não mexa no login dedicado (SUPABASE_URL auth.sejaengajado.com.br, se_auth_*, --with-registry-auth, migrate --detach=true). Manter: aprovação manual em production, guarda de RAM, backup pré-migração, migration-guard expand-only, tag por SHA sem :latest, check de HostRegexp e do 404.

## PR A (P0, fazer primeiro)
1. pr-ci fora da VPS de produção: `runs-on: ubuntu-latest`, com Postgres/GoTrue em `services:` ou compose. Na VPS self-hosted fica só o deploy.
2. Docker build no PR (`build-push-action`, push:false, cache gha no mesmo scope) e smoke da imagem: `test -f dist/main.js` e `docker run --rm img node -e "require('/app/dist/main.js')"` com timeout, ou equivalente.
3. Rollback:
   - só roda se o `stack deploy` já tiver rodado (flag DEPLOYED=1);
   - sem `|| true`, e confere a tag depois do rollback;
   - `rollback_tag` faz checkout do SHA de destino;
   - remover o fallback `|| docker stack deploy` da migration;
   - `rollback_config.failure_action` deixa de ser pause.
4. `paths-ignore` no deploy: `**.md`, `docs/**`, `PROGRESS.md`, `.github/ISSUE_TEMPLATE/**`. No pr-ci, usar paths-filter mantendo o `pr-ci-ok` sempre reportando.
5. Concurrency do e2e por PR: `pr-e2e-${{ github.event.pull_request.number }}`. O deploy continua sem cancel-in-progress.

## PR B (P1)
6. Smoke pós-convergência em loop: 20 rodadas × 3 demos + slug inexistente 404, intervalo de 3 s, zero falhas, tempo < 2 s. Depois, janela de observação de 2 a 3 min. Falhou, rollback.
7. Healthcheck real no web-ssr (renderiza um demo). `update_config`: start-first, monitor 30s, failure_action rollback.
8. pr-ci mais rápido: reusar o artifact `web-dist` no e2e, cache do npm e de `~/.cache/ms-playwright`, job `typecheck` (`tsc --noEmit` na api e no web), e no web/Dockerfile copiar package*.json antes do `COPY . .`.
9. Segurança: actions pinadas por SHA com comentário da versão, gitleaks por digest, Dependabot para github-actions, `permissions` por job (`packages: write` só no build) e GITHUB_TOKEN via `env:`.

## PR C (P2)
10. Build único e promovido: a imagem testada no PR é a que vai pra produção (retag ou digest), deploy por `image@sha256:`, e provenance.
11. Lembrete ou timeout para aprovação parada no environment production.

Pronto quando: todos os checks verdes em cada PR, um PR de teste só com docs não dispara o deploy, e um PR com Dockerfile quebrado falha no CI do PR. Relatar o tempo do pr-ci antes e depois.

Depois do merge do PR A, o Tarciso liga a proteção do master: PR obrigatório, check `pr-ci-ok` required, up-to-date, sem force push nem push direto.
