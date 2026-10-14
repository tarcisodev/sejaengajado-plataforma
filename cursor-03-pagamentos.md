# Cursor — Fase 03: Pagamentos (Asaas no MVP; interface multi-gateway)
## Regras gerais (valem para todos os blocos)
- Execute **um bloco por vez**. No fim de cada bloco: rode os testes, faça commits pequenos (Conventional Commits) e **PARE**, mostrando um resumo e o que testar. Só siga quando eu disser "continuar".
- **Nenhum segredo no código.** Use `.env.example` com placeholders e leia de env/Docker secrets. Mantenha `.env` no `.gitignore`.
- **Sem deploy automático** e sem rodar comandos contra produção.
- Textos da UI em pt-BR. Código e nomes em inglês.
- Use **apenas sandbox**. As chaves vêm de env/secrets.

## Bloco 1: Porta de gateway
Interface `PaymentGateway`: `createCustomer`, `createCharge({method: PIX|CARD|BOLETO})`, `createSubscription`, `cancelSubscription`, `getPayment`, `parseWebhook(req) -> NormalizedEvent`, `verifySignature`. Registry por `code` e escolha por config/plano. Implementar um `FakeGateway` para testes.
**Pronto:** testes do domínio usando o fake. Commit. **PARE.**

## Bloco 2: Adapter Asaas
PIX (QR e copia-e-cola), cartão (tokenizado no gateway, **nunca** guardar o PAN) e assinatura mensal. Webhook com validação do header `asaas-access-token` (token configurado no painel Asaas, lido de secret). Base URL sandbox por env.
**Pronto:** testes com fixtures de payload. Teste manual no sandbox documentado. Commit. **PARE.**

## Bloco 3: Assinaturas e cobranças (cliente direto + revendedor)
- **Cliente direto — Pronto:** cobrança única Asaas (PIX/cartão); 1º ano de hospedagem incluso; job anual gera cobrança de renovação (`ANNUAL_HOSTING`, valor de `PlatformConfig.prontoRenewalCentavos`).
- **Cliente direto — Mensal (Engajado Pro):** assinatura Asaas; placa de brinde com `plaqueFidelityEndsAt = +12 meses`; cancelamento antecipado cobra a Order do `Cancellation.multaCentavos` já gravado (não recalcula com o config atual).
- **Revendedor → plataforma (fase 1):** assinatura Asaas mensal do `ResellerPlan` + cobrança do **atacado pela foto no fechamento** (`ResellerInvoice`, sites `PUBLISHED`|`READ_ONLY`, job mensal idempotente por `resellerId+mes`).
- **Cliente final do revendedor (fase 1):** o revendedor cobra **por fora** e fica com a margem; a plataforma **não** cobra esse cliente. Interface `SplitPort` (`configureWallet`, `splitRule`) definida e **não implementada**.
- **Fase 2:** cobrança automática opcional do cliente final via Asaas com split para o revendedor.
**Pronto:** testes do job mensal do revendedor (sem duplicar), da renovação anual do Pronto e do status do revendedor ao atrasar. Commit. **PARE.**

## Bloco 4: Webhooks idempotentes
`POST /webhooks/:gateway`: verificar a assinatura → inserir `WebhookEvent` (unique gateway+eventId; se duplicado, responder 200 sem efeito) → processar em uma transação/fila → **reconsultar o status no gateway** antes de mudar o estado. Máquina de estados de Payment e Subscription tolerante a eventos fora de ordem.
Pagamento aprovado de assinatura atrasada → **reativação automática** do site (SUSPENDED/READ_ONLY → PUBLISHED, editable conforme o plano) e, se for revendedor, DELINQUENT → ACTIVE (libera criar sites).
**Pronto:** testes de duplicata, fora de ordem, assinatura inválida (401), retry e reativação. Commit. **PARE.**

## Bloco 5: Regras de negócio
- Pagamento aprovado → publicar o site (Pronto: `editable=false`, setar `hostingRenewsAt=+1 ano`; mensal: `editable=true`, setar `plaqueFidelityEndsAt=+12 meses` se placa brinde).
- **Atraso do mensal** (`America/Sao_Paulo`, `diasAtraso >=` 1 / 8 / 16 / 60): avisos → READ_ONLY → SUSPENDED ("temporariamente indisponível") → ARCHIVED; aviso idempotente por `NoticeLog`; reativação no webhook.
- **Revendedor `DELINQUENT`:** sites dos clientes ficam 30 dias (`resellerGraceDays`) no ar; sem criar sites; após o grace o admin pode oferecer migração. **`BLOCKED`** não espera esses 30 dias: os sites indicados já foram suspensos na ação manual.
- **Cancelamento mensal com placa brinde** antes dos 12 meses → cobra o `multaCentavos` do `Cancellation`; alterar `plaqueValueCentavos` depois não muda essa Order.
- Cupom consumido só quando pago.
**Pronto:** testes e2e com o FakeGateway cobrindo atraso, reativação, multa da placa e bloqueio do revendedor. Commit. **PARE.**

## Bloco 6: Checkout no front
Tela de plano + cupom → quote → PIX (QR com polling de status) ou cartão (SDK/tokenização do gateway). No Pronto, deixar claro "1º ano de hospedagem incluso; renovação anual a partir de R$ …". No mensal, aviso da fidelidade da placa de brinde.
**Pronto:** fluxo no sandbox funcionando localmente. Commit. **PARE.**

> Mercado Pago: fora do MVP. Manter apenas a interface `PaymentGateway`; o adapter MP será uma fase futura.
> Split Asaas e cobrança automática do cliente do revendedor: fase 2.
