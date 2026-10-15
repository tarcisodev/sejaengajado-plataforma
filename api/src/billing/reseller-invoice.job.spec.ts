import { FakeGateway } from '../payments/domain/fake-gateway';
import { ResellerInvoiceJob } from './reseller-invoice.job';

describe('ResellerInvoiceJob', () => {
  const resellerId = '11111111-1111-4111-8111-111111111111';
  const planId = '22222222-2222-4222-8222-222222222222';
  const productId = '33333333-3333-4333-8333-333333333333';

  function setup() {
    const gateway = new FakeGateway();
    const db = {
      $queryRaw: jest.fn().mockResolvedValue([{ ok: true }]),
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      reseller: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: resellerId,
            name: 'Revenda A',
            isPlatform: false,
            gatewayCustomerId: null,
            plan: { monthlyFeeCents: 1000 },
          },
        ]),
        update: jest.fn().mockResolvedValue({}),
      },
      resellerInvoice: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: 'inv-1',
          ...data,
          gatewayPaymentId: null,
          lines: [],
        })),
        update: jest.fn().mockResolvedValue({}),
      },
      site: {
        findMany: jest.fn().mockImplementation(async ({ where }) => {
          const all = [
            {
              id: 'site-1',
              slug: 'loja',
              status: 'PUBLISHED',
              plan: { type: 'ONE_TIME', code: 'PRONTO' },
            },
            {
              id: 'site-2',
              slug: 'off',
              status: 'SUSPENDED',
              plan: { type: 'ONE_TIME', code: 'PRONTO' },
            },
            {
              id: 'site-3',
              slug: 'ro',
              status: 'READ_ONLY',
              plan: { type: 'RECURRING', code: 'ENGAJADO_PRO' },
            },
          ];
          const allowed = where?.status?.in as string[] | undefined;
          if (!allowed) {
            return all;
          }
          return all.filter((s) => allowed.includes(s.status));
        }),
      },
      product: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: productId,
            code: 'SITE_ONE_TIME',
            baseWholesaleCents: 500,
          },
          {
            id: 'p-pro',
            code: 'SITE_PRO',
            baseWholesaleCents: 800,
          },
          {
            id: 'p-qr',
            code: 'PLAQUE_QR',
            baseWholesaleCents: 100,
          },
        ]),
        findUnique: jest.fn().mockImplementation(async ({ where: { id } }) => {
          const all = [
            { id: productId, code: 'SITE_ONE_TIME', baseWholesaleCents: 500 },
            { id: 'p-pro', code: 'SITE_PRO', baseWholesaleCents: 800 },
            { id: 'p-qr', code: 'PLAQUE_QR', baseWholesaleCents: 100 },
          ];
          return all.find((p) => p.id === id) ?? null;
        }),
      },
      wholesalePrice: { findFirst: jest.fn().mockResolvedValue(null) },
      plaqueMovement: { groupBy: jest.fn().mockResolvedValue([]) },
      plan: { findFirst: jest.fn().mockResolvedValue({ id: planId }) },
      order: {
        create: jest.fn().mockResolvedValue({
          id: 'ord-1',
          payment: { id: 'pay-1' },
        }),
      },
    };
    const job = new ResellerInvoiceJob(db as never, gateway);
    return { db, gateway, job };
  }

  it('creates invoice once; second run reuses (no duplicate charge key)', async () => {
    const { db, gateway, job } = setup();
    const now = new Date('2026-03-05T15:00:00.000Z');

    const first = await job.runOnce(now);
    expect(first.created).toBe(1);
    expect(first.charged).toBe(1);
    expect(gateway.charges).toHaveLength(1);
    expect(gateway.charges[0]!.idempotencyKey).toBe(
      `reseller-invoice:${resellerId}:2026-02`,
    );
    // SUSPENDED excluded; PUBLISHED + READ_ONLY + monthly fee
    expect(db.resellerInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          period: '2026-02',
          totalCents: 500 + 800 + 1000,
        }),
      }),
    );

    db.resellerInvoice.findUnique.mockResolvedValue({
      id: 'inv-1',
      period: '2026-02',
      totalCents: 2300,
      gatewayPaymentId: 'fake_pay_1',
      lines: [],
    });
    const second = await job.runOnce(now);
    expect(second.created).toBe(0);
    expect(second.reused).toBe(1);
    expect(gateway.charges).toHaveLength(1);
  });

  it('skips when advisory lock is held', async () => {
    const { db, job } = setup();
    db.$queryRaw.mockResolvedValue([{ ok: false }]);
    await expect(job.runOnce()).resolves.toMatchObject({ skippedLock: true });
  });
});
