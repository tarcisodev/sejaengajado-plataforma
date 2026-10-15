import nock from 'nock';

import { runPaymentGatewayContract } from '../../domain/payment-gateway.contract';
import { AsaasClient } from './asaas.client';
import { AsaasGateway } from './asaas.gateway';
import { asaasValueToCents, centsToAsaasValue } from './asaas-money';
import { mapAsaasPaymentStatus, toAsaasBillingType } from './asaas-status';

const BASE = 'https://asaas.test/api/v3';
const KEY = 'test_asaas_key_not_for_prod';

function gateway(): AsaasGateway {
  return new AsaasGateway(
    new AsaasClient({
      baseUrl: BASE,
      apiKey: KEY,
      timeoutMs: 5_000,
    }),
  );
}

describe('asaas money/status helpers', () => {
  it('converts centavos without parseFloat', () => {
    expect(centsToAsaasValue(1990)).toBe(19.9);
    expect(centsToAsaasValue(100)).toBe(1);
    expect(centsToAsaasValue(1)).toBe(0.01);
    expect(asaasValueToCents(19.9)).toBe(1990);
    expect(asaasValueToCents(1)).toBe(100);
  });

  it('maps billing type and status', () => {
    expect(toAsaasBillingType('CARD')).toBe('CREDIT_CARD');
    expect(toAsaasBillingType('PIX')).toBe('PIX');
    expect(mapAsaasPaymentStatus('RECEIVED')).toBe('RECEIVED');
    expect(mapAsaasPaymentStatus('CONFIRMED')).toBe('CONFIRMED');
    expect(mapAsaasPaymentStatus('DELETED')).toBe('CANCELLED');
  });
});

describe('AsaasClient', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it('sends access_token; does not retry non-idempotent POST without key', async () => {
    const scope = nock(BASE, {
      reqheaders: {
        access_token: KEY,
      },
    })
      .post('/customers')
      .reply(500, { error: 'boom' });

    const client = new AsaasClient({ baseUrl: BASE, apiKey: KEY, timeoutMs: 2_000 });
    await expect(
      client.request('POST', '/customers', { body: { name: 'x' } }),
    ).rejects.toThrow(/500/);
    expect(scope.isDone()).toBe(true);
  });

  it('retries GET on 503', async () => {
    nock(BASE).get('/payments/p1').reply(503, { error: 'busy' });
    nock(BASE).get('/payments/p1').reply(200, {
      id: 'p1',
      status: 'PENDING',
      value: 10,
    });

    const client = new AsaasClient({ baseUrl: BASE, apiKey: KEY, timeoutMs: 2_000 });
    const payment = await client.request<{ id: string }>('GET', '/payments/p1');
    expect(payment.id).toBe('p1');
  });
});

describe('AsaasGateway nock fixtures', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  beforeEach(() => {
    const amounts = new Map<string, number>();
    let customerSeq = 0;
    let paySeq = 0;
    let subSeq = 0;

    nock(BASE)
      .persist()
      .post('/customers')
      .reply(200, () => {
        customerSeq += 1;
        return { id: `cus_${customerSeq}` };
      });

    nock(BASE)
      .persist()
      .post('/payments')
      .matchHeader('Idempotency-Key', /.*/)
      .reply(200, (_uri: string, body: unknown) => {
        const payload = body as { value: number; billingType: string };
        paySeq += 1;
        const id = `pay_${paySeq}`;
        amounts.set(id, payload.value);
        return {
          id,
          status: 'PENDING',
          value: payload.value,
          invoiceUrl: `https://asaas.test/i/${id}`,
          bankSlipUrl:
            payload.billingType === 'BOLETO' ? `https://asaas.test/b/${id}` : null,
        };
      });

    nock(BASE)
      .persist()
      .get(/\/payments\/[^/]+\/pixQrCode$/)
      .reply(200, {
        encodedImage: 'base64-qr',
        payload: '00020126pix',
      });

    nock(BASE)
      .persist()
      .get(/\/payments\/pay_[^/]+$/)
      .reply(200, (uri: string) => {
        const id = uri.split('/').pop()!;
        const value = amounts.get(id) ?? 19.9;
        return {
          id,
          status: 'PENDING',
          value,
          invoiceUrl: `https://asaas.test/i/${id}`,
        };
      });

    nock(BASE)
      .persist()
      .post('/subscriptions')
      .matchHeader('Idempotency-Key', /.*/)
      .reply(200, (_uri: string, body: unknown) => {
        expect((body as { value: number }).value).toBe(99);
        subSeq += 1;
        return { id: `sub_${subSeq}`, status: 'ACTIVE' };
      });

    nock(BASE)
      .persist()
      .delete(/\/subscriptions\//)
      .reply(200, {});

    nock(BASE)
      .persist()
      .post(/\/payments\/[^/]+\/refund$/)
      .matchHeader('Idempotency-Key', /.*/)
      .reply(200, (uri: string) => {
        const id = uri.split('/')[2]!;
        return { id, status: 'REFUNDED', value: amounts.get(id) ?? 5 };
      });
  });

  runPaymentGatewayContract('asaas+nock', () => gateway());

  it('creates PIX charge with QR payload', async () => {
    const gw = gateway();
    const customer = await gw.createCustomer({
      name: 'Pix',
      email: 'pix@example.com',
    });
    const charge = await gw.createCharge({
      gatewayCustomerId: customer.gatewayCustomerId,
      amountCents: 1990,
      method: 'PIX',
      dueDate: '2026-10-20',
      description: 'Pix',
      idempotencyKey: 'pix-extra-1',
    });
    expect(charge.pixCopyPaste).toBe('00020126pix');
    expect(charge.pixQrCode).toBe('base64-qr');
  });
});
