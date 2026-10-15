import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { runWithTenantAsync } from '../tenant/tenant.context';
import { predictedMarginCents, SalesService } from './sales.service';

const resellerId = '11111111-1111-4111-8111-111111111111';
const productId = '44444444-4444-4444-8444-444444444444';
const actor = { userId: 'u1', role: 'RESELLER' as const, resellerId };

const plaqueProduct = {
  id: productId,
  code: 'PLAQUE_QR' as const,
};

function operableDb(overrides: Record<string, unknown> = {}) {
  return {
    reseller: {
      findUnique: jest.fn().mockResolvedValue({ id: resellerId, status: 'ACTIVE' }),
    },
    product: {
      findUnique: jest.fn().mockResolvedValue(plaqueProduct),
    },
    sale: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    ...overrides,
  };
}

describe('SalesService margin', () => {
  it('computes predicted margin for mixed items including negative', () => {
    expect(
      predictedMarginCents([
        { qty: 2, unitPriceCents: 1000, unitCostCents: 400 },
        { qty: 1, unitPriceCents: 100, unitCostCents: 300 },
        { qty: 3, unitPriceCents: 500, unitCostCents: 500 },
      ]),
    ).toBe(2 * 600 + 1 * -200 + 0);
  });
});

describe('SalesService', () => {
  it('list presents margin and paginates', async () => {
    const sale = {
      id: 's1',
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      items: [{ qty: 1, unitPriceCents: 200, unitCostCents: 50 }],
    };
    const db = operableDb({
      sale: {
        findMany: jest.fn().mockResolvedValue([sale, { ...sale, id: 's2' }]),
      },
    });
    const service = new SalesService(
      db as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const page = await service.list({ limit: 1 });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]!.predictedMarginCents).toBe(150);
    expect(page.nextCursor).toBeTruthy();
  });

  it('get not found', async () => {
    const db = operableDb({
      sale: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    const service = new SalesService(
      db as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(service.get('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('record requires Idempotency-Key and valid body', async () => {
    const service = new SalesService(
      operableDb() as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(service.record({ items: [] }, undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.record({}, 'k')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('record returns existing when fingerprint matches', async () => {
    const existing = {
      id: 'sale1',
      items: [
        {
          productId,
          qty: 1,
          unitPriceCents: 1000,
          unitCostCents: 400,
          product: plaqueProduct,
        },
      ],
    };
    const db = operableDb({
      sale: {
        findFirst: jest.fn().mockResolvedValue(existing),
      },
    });
    const service = new SalesService(
      db as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const result = await runWithTenantAsync(actor, () =>
      service.record(
        { items: [{ productId, qty: 1, unitPriceCents: 1000 }] },
        'idem-1',
      ),
    );
    expect(result.id).toBe('sale1');
    expect(result.predictedMarginCents).toBe(600);
  });

  it('record conflicts when idempotency key reused with different body', async () => {
    const existing = {
      id: 'sale1',
      items: [
        {
          productId,
          qty: 1,
          unitPriceCents: 1000,
          unitCostCents: 400,
          product: plaqueProduct,
        },
      ],
    };
    const db = operableDb({
      sale: { findFirst: jest.fn().mockResolvedValue(existing) },
    });
    const service = new SalesService(
      db as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      runWithTenantAsync(actor, () =>
        service.record(
          { items: [{ productId, qty: 2, unitPriceCents: 1000 }] },
          'idem-1',
        ),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('record creates sale with ledger IN and stock OUT', async () => {
    const createdSale = {
      id: 'new-sale',
      items: [
        {
          id: 'si1',
          productId,
          qty: 2,
          unitPriceCents: 500,
          unitCostCents: 200,
          product: plaqueProduct,
        },
      ],
    };
    const db = operableDb();
    const appDb = {
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          $executeRaw: jest.fn().mockResolvedValue(undefined),
          sale: {
            create: jest.fn().mockResolvedValue({ id: 'new-sale' }),
            findUniqueOrThrow: jest.fn().mockResolvedValue(createdSale),
          },
          saleItem: { create: jest.fn().mockResolvedValue({}) },
        }),
      ),
    };
    const wholesale = {
      resolvePriceCents: jest.fn().mockResolvedValue({
        priceCents: 200,
        wholesalePriceId: null,
      }),
    };
    const ledger = { append: jest.fn().mockResolvedValue({ id: 'led' }) };
    const stock = { moveInTx: jest.fn().mockResolvedValue({ id: 'mov' }) };
    const service = new SalesService(
      db as never,
      appDb as never,
      wholesale as never,
      ledger as never,
      stock as never,
    );

    const result = await runWithTenantAsync(actor, () =>
      service.record(
        { items: [{ productId, qty: 2, unitPriceCents: 500 }] },
        'idem-new',
      ),
    );
    expect(result.predictedMarginCents).toBe(600);
    expect(ledger.append).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'IN',
        category: 'SALE',
        amountCents: 1000,
      }),
      expect.anything(),
    );
    expect(stock.moveInTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'OUT', plaqueType: 'QR', qty: 2 }),
    );
  });

  it('record recovers from P2002 race with matching fingerprint', async () => {
    const raced = {
      id: 'raced',
      items: [
        {
          productId,
          qty: 1,
          unitPriceCents: 100,
          unitCostCents: 40,
          product: plaqueProduct,
        },
      ],
    };
    const db = operableDb({
      sale: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(raced),
      },
    });
    const appDb = {
      $transaction: jest.fn().mockRejectedValue({ code: 'P2002' }),
    };
    const wholesale = {
      resolvePriceCents: jest.fn().mockResolvedValue({
        priceCents: 40,
        wholesalePriceId: null,
      }),
    };
    const service = new SalesService(
      db as never,
      appDb as never,
      wholesale as never,
      { append: jest.fn() } as never,
      { moveInTx: jest.fn() } as never,
    );
    const result = await runWithTenantAsync(actor, () =>
      service.record(
        { items: [{ productId, qty: 1, unitPriceCents: 100 }] },
        'race-key',
      ),
    );
    expect(result.id).toBe('raced');
  });

  it('void reverses ledger and restocks plaques', async () => {
    const sale = {
      id: 'sale-v',
      status: 'RECORDED',
      items: [
        {
          id: 'si1',
          productId,
          qty: 1,
          unitPriceCents: 300,
          unitCostCents: 100,
          product: plaqueProduct,
        },
      ],
    };
    const db = operableDb({
      sale: { findUnique: jest.fn().mockResolvedValue(sale) },
    });
    const ledger = { reverse: jest.fn().mockResolvedValue({ id: 'rev' }) };
    const stock = { moveInTx: jest.fn().mockResolvedValue({ id: 'restock' }) };
    const appDb = {
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          $executeRaw: jest.fn().mockResolvedValue(undefined),
          sale: {
            update: jest.fn().mockResolvedValue({ ...sale, status: 'VOIDED' }),
          },
          ledgerEntry: {
            findFirst: jest.fn().mockResolvedValue({ id: 'led-in' }),
          },
        }),
      ),
    };
    const service = new SalesService(
      db as never,
      appDb as never,
      {} as never,
      ledger as never,
      stock as never,
    );
    const result = await runWithTenantAsync(actor, () => service.void('sale-v'));
    expect(result.status).toBe('VOIDED');
    expect(ledger.reverse).toHaveBeenCalledWith('led-in', expect.anything());
    expect(stock.moveInTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'IN', reason: 'SALE_VOID' }),
    );
  });

  it('void rejects already voided', async () => {
    const db = operableDb({
      sale: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'x',
          status: 'VOIDED',
          items: [],
        }),
      },
    });
    const service = new SalesService(
      db as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      runWithTenantAsync(actor, () => service.void('x')),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('void not found', async () => {
    const db = operableDb({
      sale: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    const service = new SalesService(
      db as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      runWithTenantAsync(actor, () => service.void('missing')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('get returns presented sale', async () => {
    const db = operableDb({
      sale: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'g1',
          items: [{ qty: 1, unitPriceCents: 10, unitCostCents: 3 }],
        }),
      },
    });
    const service = new SalesService(
      db as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(service.get('g1')).resolves.toMatchObject({
      id: 'g1',
      predictedMarginCents: 7,
    });
  });

  it('record rejects when reseller missing', async () => {
    const db = operableDb({
      reseller: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    const service = new SalesService(
      db as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      runWithTenantAsync(actor, () =>
        service.record(
          { items: [{ productId, qty: 1, unitPriceCents: 1 }] },
          'k',
        ),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('record skips stock for non-plaque products and zero total', async () => {
    const nonPlaque = { id: productId, code: 'SITE_PRO' as const };
    const createdSale = {
      id: 'np',
      items: [
        {
          id: 'si1',
          productId,
          qty: 1,
          unitPriceCents: 0,
          unitCostCents: 0,
          product: nonPlaque,
        },
      ],
    };
    const db = operableDb({
      product: { findUnique: jest.fn().mockResolvedValue(nonPlaque) },
    });
    const stock = { moveInTx: jest.fn() };
    const ledger = { append: jest.fn() };
    const appDb = {
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          $executeRaw: jest.fn().mockResolvedValue(undefined),
          sale: {
            create: jest.fn().mockResolvedValue({ id: 'np' }),
            findUniqueOrThrow: jest.fn().mockResolvedValue(createdSale),
          },
          saleItem: { create: jest.fn().mockResolvedValue({}) },
        }),
      ),
    };
    const service = new SalesService(
      db as never,
      appDb as never,
      {
        resolvePriceCents: jest.fn().mockResolvedValue({
          priceCents: 0,
          wholesalePriceId: null,
        }),
      } as never,
      ledger as never,
      stock as never,
    );
    await runWithTenantAsync(actor, () =>
      service.record(
        { items: [{ productId, qty: 1, unitPriceCents: 0 }] },
        'zero',
      ),
    );
    expect(ledger.append).not.toHaveBeenCalled();
    expect(stock.moveInTx).not.toHaveBeenCalled();
  });

  it('record P2002 race with conflicting body throws', async () => {
    const raced = {
      id: 'raced',
      items: [
        {
          productId,
          qty: 9,
          unitPriceCents: 100,
          unitCostCents: 40,
          product: plaqueProduct,
        },
      ],
    };
    const db = operableDb({
      sale: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(raced),
      },
    });
    const service = new SalesService(
      db as never,
      { $transaction: jest.fn().mockRejectedValue({ code: 'P2002' }) } as never,
      {
        resolvePriceCents: jest.fn().mockResolvedValue({
          priceCents: 40,
          wholesalePriceId: null,
        }),
      } as never,
      { append: jest.fn() } as never,
      { moveInTx: jest.fn() } as never,
    );
    await expect(
      runWithTenantAsync(actor, () =>
        service.record(
          { items: [{ productId, qty: 1, unitPriceCents: 100 }] },
          'race-bad',
        ),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('record rethrows non-P2002 errors', async () => {
    const db = operableDb();
    const service = new SalesService(
      db as never,
      { $transaction: jest.fn().mockRejectedValue(new Error('boom')) } as never,
      {
        resolvePriceCents: jest.fn().mockResolvedValue({
          priceCents: 1,
          wholesalePriceId: null,
        }),
      } as never,
      { append: jest.fn() } as never,
      { moveInTx: jest.fn() } as never,
    );
    await expect(
      runWithTenantAsync(actor, () =>
        service.record(
          { items: [{ productId, qty: 1, unitPriceCents: 1 }] },
          'err',
        ),
      ),
    ).rejects.toThrow('boom');
  });

  it('record rejects unknown product', async () => {
    const db = operableDb({
      product: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    const service = new SalesService(
      db as never,
      {} as never,
      { resolvePriceCents: jest.fn() } as never,
      {} as never,
      {} as never,
    );
    await expect(
      runWithTenantAsync(actor, () =>
        service.record(
          { items: [{ productId, qty: 1, unitPriceCents: 1 }] },
          'k',
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
