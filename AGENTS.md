Agente novo: leia docs/HANDOFF.md e docs/PLANO-FLUXO-FELIZ.md antes de começar.

# AGENTS — Seja Engajado

Stack: Angular 22.2 (standalone, SSR, Tailwind 4) em `web/`; NestJS 11 + Prisma 6 + Postgres 16 em `api/`. Loop de finalização: `PROGRESS.md` na raiz. Skills Angular: `.agents/skills/angular-developer/SKILL.md`.

Comandos úteis:
- `web/`: `npm run lint`, `npm test -- --watch=false --browsers=ChromeHeadless`, `npm run build`, `npm run format:check`
- `api/`: `npm run lint`, `npm run lint:money`, `npm test`, `npm run test:int`, `npm run build`

Regras da casa: dinheiro em centavos; ledger append-only; RLS fail-closed (entre tenants → 404); Idempotency-Key em POSTs de dinheiro; sem segredos no repo; UI pt-BR; código em inglês.

## Issues e triagem
- Siga `TRIAGEM.md`. Achou bug, lacuna ou ideia **fora da tarefa atual**? Abra issue classificada (type, priority, area, `status: triagem`) com título `[tipo] área: resumo` — não desvie do trabalho atual. Pequeno e dentro do escopo: corrija inline.
- Use `gh issue create` com os templates de `.github/ISSUE_TEMPLATE/`; sem gh/remote GitHub, use `ISSUES.md`.
- Próximo trabalho = ordem do TRIAGEM.md (P0→P3; core > bug > melhoria; impacto no fluxo feliz; menor esforço).
- Commits/PRs que resolvem: `Closes #n`. Nunca coloque segredos em issues.
