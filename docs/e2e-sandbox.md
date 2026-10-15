# E2E sandbox (Asaas) — PRODUCAO-05 B7

Roteiro manual + comando automatizado. **Só sandbox.** Chaves nunca vão para o git.

## Pré-requisitos

1. Postgres do harness de integração disponível (`npm run test:int` já sobe o necessário).
2. Segredos locais via arquivo (nunca commitados):

```bash
# Exemplo local (fora do repo ou gitignored)
printf '%s' "$ASAAS_SANDBOX_KEY" > /tmp/asaas_api_key
printf '%s' "$ASAAS_WEBHOOK_TOKEN" > /tmp/asaas_webhook_token
export ASAAS_API_KEY_FILE=/tmp/asaas_api_key
export ASAAS_WEBHOOK_TOKEN_FILE=/tmp/asaas_webhook_token
export ASAAS_BASE_URL=https://sandbox.asaas.com/api/v3
export ASAAS_SANDBOX=1
```

Sem `ASAAS_API_KEY_FILE`, o teste usa o **FakeGateway** (mesmo fluxo de estados).

## Comando

```bash
cd api
npm run test:e2e:sandbox
```

O script força `ASAAS_SANDBOX=1` via `jest-e2e.env.cjs`. Sem esse config a suíte fica **skipped** no Jest unitário (pasta `test/e2e` ignorada).

## Cenários cobertos pelo spec

| Cenário | Esperado |
| --- | --- |
| Checkout PIX | `amountCents` da API; webhook + reconsulta → `PAID` / status gateway `RECEIVED` |
| Webhook duplicado | segundo `processEvent` sem efeito colateral |
| Boleto de fatura vencido | job de inadimplência → revendedor `DELINQUENT`; listagem `/api/reseller/invoices` |
| Estorno | ledger `REVERSAL` ligado ao pagamento |

## Roteiro manual (Asaas UI)

1. Admin cria revendedor (não plataforma) e publica site.
2. Revendedor registra venda; confere margem/estoque no painel.
3. Roda fechamento de fatura (job ou admin); gera cobrança boleto/Pix no sandbox.
4. Paga no Asaas sandbox → webhook → revendedor `ACTIVE`.
5. Reenviar o mesmo webhook → sem duplicar ledger.
6. Simular atraso (dueDate no passado) → `DELINQUENT` → pagar → reativação.
7. Estornar cobrança → lançamento `REVERSAL`.

## Front

- Checkout: `/conta/checkout` — valor só via API (centavos); cartão = link hospedado Asaas.
- Faturas: `/faturas` — status por polling em `GET /api/billing/payments/:id`, nunca pelo redirect.
