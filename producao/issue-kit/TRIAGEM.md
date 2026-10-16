# Triagem de issues (padrão)
Toda issue tem **1 type**, **1 priority**, **≥1 area**, **1 status**. Entra como `status: triagem`; sai para `pronto` quando tipo+prioridade+aceite estão claros.

## Tipo
| Pergunta | Sim → |
|---|---|
| Algo existente quebrou / não faz o que deveria? | `type: bug` |
| Sem isso o fluxo principal (MVP/fluxo feliz) não fecha? | `type: core` |
| Senão (ideia, ajuste, conforto, nova capacidade) | `type: melhoria` |
Bug que quebra o fluxo feliz continua `bug` — a prioridade (P0) carrega a urgência.

## Prioridade = severidade × alcance
| Severidade \ Alcance | Fluxo feliz / todos os usuários | Parte dos usuários / fluxo secundário | Caso raro / interno |
|---|---|---|---|
| **Bloqueia** (sem contorno), ou toca **produção, segurança, dinheiro, dados de tenant** | **P0** | **P0** | P1 |
| **Atrapalha** (tem contorno) | P1 | P1 | P2 |
| **Incomoda** / importante sem bloquear | P2 | P2 | P3 |
| **Cosmético** / polimento | P3 | P3 | P3 |
Regra de ouro: vazamento entre tenants, segredo exposto, cálculo de dinheiro errado ou perda de dados = **P0 sempre**.

## Ordem de execução
1. `priority` (P0 → P3).
2. Mesma P: `core` > `bug` > `melhoria`.
3. Empate: maior impacto no fluxo feliz primeiro.
4. Empate: menor esforço primeiro.
`status: bloqueado` sai da fila até destravar (cite o motivo e quem decide).
Consulta: `gh issue list -l "priority: P0" -l "status: pronto"`.

## Como o agente/Cursor abre issue
- **Título:** `[tipo] área: resumo` — ex. `[bug] api: venda duplicada sem Idempotency-Key`.
- **Corrigir inline** se: está dentro do bloco/tarefa atual **e** é pequeno (≲ 15 min, sem mudar escopo). Senão **abrir issue** e seguir no bloco — não desviar.
- Abrir com o template (`gh issue create --template bug.yml` ou `--title … --label "type: bug,priority: P1,area: api,status: triagem" --body …`) preenchendo descrição, passos/aceite, impacto, área.
- Referenciar commit/PR no corpo (`Visto em abc1234`). Ao corrigir: commit/PR com `Closes #n` (ou `Refs #n` se parcial).
- Sem segredos, tokens ou dados reais de clientes em issues.
- Sem GitHub/gh disponível: registrar em `ISSUES.md` na raiz, mesma estrutura (veja `ISSUES.md.example`).
