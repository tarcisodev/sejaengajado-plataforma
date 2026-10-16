# PRODUÇÃO 05 — Pagamentos (Asaas, sandbox até o go-live)
Leia `PRODUCAO-00-indice.md` (regras de cobrança decididas) e `cursor-03-pagamentos.md`. **Só sandbox.** Secrets: `se_asaas_api_key` e `se_asaas_webhook_token` (lidos via `ASAAS_API_KEY_FILE` e `ASAAS_WEBHOOK_TOKEN_FILE`); a URL base do Asaas vai em `ASAAS_BASE_URL` (não é segredo). Na fase 1 o cliente final do revendedor é cobrado **por fora**: a plataforma só cobra o revendedor e os clientes diretos.

---
## B1 — Porta `PaymentGateway` + FakeGateway
- **Objetivo:** o domínio não conhece o Asaas.
- **Arquivos:** `src/payments/domain/payment-gateway.port.ts` (createCustomer, createCharge PIX/BOLETO/CARD, createSubscription, cancelSubscription, getPayment, refund), registry por nome, `fake-gateway.ts`.
- **Pronto:** a regra de lint de fronteira impede o domínio de importar `adapters/asaas`.
- **Testes:** contrato rodado contra o Fake.
- **Commit:** `feat(payments): gateway port`. **PARE.**

## B2 — Adapter Asaas (sandbox)
- **Objetivo:** implementação real.
- **Arquivos:** `src/payments/adapters/asaas/*`: cliente HTTP com timeout, retry com backoff só em GET e operações idempotentes, mapeamento de status, logs sem payload sensível.
- **Pronto:** cria cliente, cobrança Pix e assinatura no sandbox (teste manual com a chave do sandbox no `.env` local, nunca commitada).
- **Testes:** respostas gravadas (nock) e o mesmo contrato do B1.
- **Commit:** `feat(payments): asaas adapter`. **PARE.**

## B3 — Webhooks idempotentes e fila (⏳P10 ⏳P14 ⏳P26)
- **Objetivo:** confirmação segura de pagamento.
- **Arquivos:** `POST /api/webhooks/asaas`: compara `asaas-access-token` em tempo constante (inválido → 401 sem gravar) → `INSERT WebhookEvent ON CONFLICT DO NOTHING` → 200 → worker (pg-boss) **reconsulta o pagamento no Asaas** → máquina de estados tolerante a eventos fora de ordem; retries com backoff, `FAILED` após N tentativas, reprocesso pelo admin; chargeback ou estorno → lançamento inverso + fatura OVERDUE (⏳P14); throttle.
- **Pronto:** um webhook duplicado não duplica nada.
- **Testes:** token inválido; duplicado = 1 efeito; RECEIVED depois de CONFIRMED não regride; falha → retry → sucesso; reprocesso idempotente.
- **Commit:** `feat(payments): idempotent webhooks`. **PARE.**

## B4 — Fatura e inadimplência do revendedor (⏳P4 ⏳P5 ⏳P7 ⏳P9 ⏳P13)
- **Objetivo:** o Tarciso cobra o revendedor pelo Asaas.
- **Arquivos:** `src/billing/reseller-invoice.job.ts`: job mensal idempotente por `(resellerId, period)`; `InvoiceLine` = foto dos sites PUBLISHED + READ_ONLY no fechamento × atacado vigente congelado do produto (⏳P5), mais mensalidade do plano (⏳P4) e placas transferidas no mês (⏳P7); cobrança Asaas (Pix/boleto) com vencimento configurável; OUT `PLATFORM_INVOICE` no ledger quando o pagamento é confirmado (⏳P9). Job diário: fatura vencida → DELINQUENT (cria `LifecycleEvent`, bloqueia criação), sites no ar por `resellerGraceDays`=30, depois o caso fica elegível para migração no admin; pagamento → ACTIVE. Revendedor da Plataforma não é faturado.
- **Pronto:** o fluxo revendedor → sites → fatura → pagamento no sandbox → ACTIVE funciona.
- **Testes (relógio fixo, SP):** job rodado 2× não duplica; SUSPENDED fica fora da fatura e READ_ONLY dentro; vencida → DELINQUENT; dia 30 → ainda no ar; dia 31 → elegível; pagamento reativa.
- **Commit:** `feat(billing): reseller invoices and delinquency`. **PARE.**

## B5 — Cobrança do cliente direto (Pronto, Pro, renovação, multa)
- **Objetivo:** vendas diretas do Tarciso (revendedor `PLATAFORMA`).
- **Arquivos:** `src/billing/direct/*`: Pronto = cobrança única (1º ano incluso) + renovação anual (`prontoRenewalCents`) + placa como add-on; Pro = assinatura mensal com placa de brinde e fidelidade de 12 meses; cancelamento antes de 12 meses cobra a multa já gravada (02-B14); cupons aplicados (02-B13); reativação automática ao pagar.
- **Pronto:** pagar ativa e publica o site; o atraso segue as faixas 7/8/16/60.
- **Testes:** renovação gerada no vencimento; multa no cancelamento; cupom.
- **Commit:** `feat(billing): direct customer charges`. **PARE.**

## B6 — Checkout e faturas no front
- **Objetivo:** pagar de dentro do painel.
- **Arquivos:** `web`: tela de checkout do cliente direto (Pix com QR e copia-e-cola, boleto, cartão pelo link hospedado do Asaas, sem tocar em dados de cartão), página "Minhas faturas" do revendedor com status e link, polling até a confirmação.
- **Pronto:** nenhum dado de cartão passa pela plataforma.
- **Testes:** estados de pendente, pago e vencido; copiar código Pix.
- **Commit:** `feat(web): checkout and invoices`. **PARE.**

## B7 — E2E no sandbox
- **Objetivo:** provar o MVP de ponta a ponta.
- **Arquivos:** `api/test/e2e/mvp.sandbox.spec.ts` (só roda com `ASAAS_SANDBOX=1`) + roteiro manual em `docs/e2e-sandbox.md`.
- **Pronto:** admin cria revendedor → revendedor publica site e registra venda → painel mostra margem e estoque → fatura emitida → paga no sandbox → webhook → ACTIVE; webhook repetido sem efeito; atraso simulado → READ_ONLY → pagamento → reativação.
- **Testes:** o próprio e2e.
- **Commit:** `test(e2e): mvp sandbox flow`. **PARE.**
