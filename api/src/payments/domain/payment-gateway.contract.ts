import type { PaymentGateway } from './payment-gateway.port';

/** Shared contract exercised by Fake (B1) and Asaas+nock (B2). */
export function runPaymentGatewayContract(
  label: string,
  createGateway: () => PaymentGateway,
): void {
  describe(`PaymentGateway contract (${label})`, () => {
    let gateway: PaymentGateway;

    beforeEach(() => {
      gateway = createGateway();
    });

    it('creates customer, charge with Idempotency-Key, reads payment', async () => {
      const customer = await gateway.createCustomer({
        name: 'Revendedor Teste',
        email: 'revenda@example.com',
        cpfCnpj: '24971563792',
      });
      expect(customer.gatewayCustomerId).toBeTruthy();

      const charge = await gateway.createCharge({
        gatewayCustomerId: customer.gatewayCustomerId,
        amountCents: 1990,
        method: 'PIX',
        dueDate: '2026-10-20',
        description: 'Fatura teste',
        idempotencyKey: 'contract-charge-1',
        externalReference: 'inv-1',
      });
      expect(charge.gatewayPaymentId).toBeTruthy();
      expect(charge.status).toBeTruthy();

      const payment = await gateway.getPayment(charge.gatewayPaymentId);
      expect(payment.gatewayPaymentId).toBe(charge.gatewayPaymentId);
      expect(payment.amountCents).toBe(1990);
    });

    it('rejects non-positive centavos on charge', async () => {
      await expect(
        gateway.createCharge({
          gatewayCustomerId: 'cus_x',
          amountCents: 0,
          method: 'BOLETO',
          dueDate: '2026-10-20',
          description: 'bad',
          idempotencyKey: 'bad-cents',
        }),
      ).rejects.toThrow(/positive integer/);
    });

    it('requires Idempotency-Key on charge', async () => {
      await expect(
        gateway.createCharge({
          gatewayCustomerId: 'cus_x',
          amountCents: 100,
          method: 'BOLETO',
          dueDate: '2026-10-20',
          description: 'bad',
          idempotencyKey: '  ',
        }),
      ).rejects.toThrow(/Idempotency-Key/);
    });

    it('creates and cancels subscription', async () => {
      const customer = await gateway.createCustomer({
        name: 'Assinante',
        email: 'sub@example.com',
      });
      const sub = await gateway.createSubscription({
        gatewayCustomerId: customer.gatewayCustomerId,
        amountCents: 9900,
        cycle: 'MONTHLY',
        nextDueDate: '2026-11-01',
        description: 'Plano mensal',
        idempotencyKey: 'contract-sub-1',
        billingType: 'BOLETO',
      });
      expect(sub.gatewaySubscriptionId).toBeTruthy();
      await expect(
        gateway.cancelSubscription(sub.gatewaySubscriptionId),
      ).resolves.toBeUndefined();
    });

    it('refunds with Idempotency-Key', async () => {
      const customer = await gateway.createCustomer({
        name: 'Refund',
        email: 'refund@example.com',
      });
      const charge = await gateway.createCharge({
        gatewayCustomerId: customer.gatewayCustomerId,
        amountCents: 500,
        method: 'BOLETO',
        dueDate: '2026-10-20',
        description: 'refundable',
        idempotencyKey: 'contract-refund-charge',
      });
      const refunded = await gateway.refund({
        gatewayPaymentId: charge.gatewayPaymentId,
        idempotencyKey: 'contract-refund-1',
      });
      expect(refunded.status).toBe('REFUNDED');
    });
  });
}
