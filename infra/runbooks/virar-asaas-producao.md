# Runbook — Virar Asaas para produção

**Quem executa:** Tarciso (Cursor não aprova deploy nem altera secrets na VPS).  
**Pré-requisitos:** conta Asaas produção aprovada; secret Swarm `se_asaas_api_key_v2` (produção) e `se_asaas_webhook_token_v1` já criados; stack `sejaengajado` no ar.

A chave de API já aponta para o secret de produção (`se_asaas_api_key` → `se_asaas_api_key_v2` em `infra/stack.yml`). O que falta para “virar” é a **URL base** e o **webhook** no painel Asaas.

## 1. Trocar `ASAAS_BASE_URL` no environment de deploy

No GitHub Environment `production` (ou no env usado pelo `deploy.yml` na VPS), defina:

```text
ASAAS_BASE_URL=https://api.asaas.com/v3
```

Default do stack (sem a var) continua sandbox: `https://sandbox.asaas.com/api/v3`.  
Redeploy do serviço `api` após alterar a var (aprovação manual no environment `production`).

Validar no container:

```bash
docker exec $(docker ps -q -f name=sejaengajado_api) printenv ASAAS_BASE_URL
# esperado: https://api.asaas.com/v3
```

## 2. Cadastrar webhook no painel Asaas (produção)

1. Asaas → Integrações → Webhooks (conta **produção**).
2. URL:

```text
https://app.sejaengajado.com.br/api/webhooks/asaas
```

   (path real da API; Traefik aplica rate-limit estrito em `/api/webhooks`.)

3. Token de autenticação: o **mesmo valor** gravado em `se_asaas_webhook_token_v1`.  
   A API compara o header `asaas-access-token` em tempo constante (`ASAAS_WEBHOOK_TOKEN_FILE`).
4. Eventos: pagamentos (RECEIVED / CONFIRMED / etc.) conforme já usado no sandbox.
5. Enviar um evento de teste; a API deve responder **200**. Token errado → **401** sem gravar.

## 3. Smoke pós-virada

- [ ] Cobrança PIX/boleto de teste pequeno na conta produção.
- [ ] Webhook chega e `WebhookEvent` não duplica no reenvio.
- [ ] Painel: status da cobrança atualiza via polling (`GET /api/billing/payments/:id`).
- [ ] Confirmar que **não** há `FakeGateway` (API sobe só com `ASAAS_API_KEY` / `*_FILE`).

## Rollback

1. Voltar `ASAAS_BASE_URL` para `https://sandbox.asaas.com/api/v3` e redeploy.
2. Desativar ou apontar o webhook de produção para uma URL de descartável até estabilizar.
3. Cobranças já criadas na conta produção ficam no Asaas — não apagar pelo app.

## Relacionado

- Secrets: `infra/secrets.md`
- E2E sandbox (antes de virar): `docs/e2e-sandbox.md`
- Go-live: `docs/GO-LIVE.md`
