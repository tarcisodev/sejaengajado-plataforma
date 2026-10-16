import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { runWithTenantAsync } from '../tenant/tenant.context';
import { averageCostCents, StockService } from './stock.service';

const resellerId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const siteId = '33333333-3333-4333-8333-333333333333';
const actor = { userId: 'u1', role: 'RESELLER' as const, resellerId };

function txStub(overrides: Record<string, unknown> = {}) {
  return {
    $executeRaw: jest.fn().mockResolvedValue(undefined),
    $queryRaw: jest.fn().mockResolvedValue([{ qty: 10 }]),
    plaqueMovement: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'm1', resellerId }),
    },
    ...overrides,
  };
}

function appDbWithTx(tx: unknown = txStub()) {
  return {
    $transaction: jest.fn(async (fn: (client: unknown) => Promise<unknown>) => fn(tx)),
  };
}

function makeService(
  adminDb: unknown = {},
  db: unknown = {},
  appDb: unknown = {},
  ledger: unknown = {},
) {
  return new StockService(
    adminDb as never,
    db as never,
    appDb as never,
    ledger as never,
  );
}

describe('StockService helpers', () => {
  it('computes integer average cost', () => {
    expect(averageCostCents(1000, 3)).toBe(333);
    expect(averageCostCents(1000, 4)).toBe(250);
    expect(averageCostCents(0, 0)).toBe(0);
  });
});

describe('StockService', () => {
  it('listStock maps rows', async () => {
    const adminDb = {
      $queryRaw: jest.fn().mockResolvedValue([
        { plaque_type: 'QR', qty: 5, avg_cost_cents: 100 },
      ]),
    };
    const service = makeService(adminDb);
    await expect(service.listStock(resellerId)).resolves.toEqual({
      items: [{ plaqueType: 'QR', qty: 5, avgCostCents: 100 }],
    });
  });

  it('listStockForCurrent uses tenant transaction', async () => {
    const db = {
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          $queryRaw: jest
            .fn()
            .mockResolvedValue([{ plaque_type: 'NFC', qty: 2, avg_cost_cents: null }]),
        }),
      ),
    };
    const service = makeService({}, db);
    const result = await runWithTenantAsync(actor, () => service.listStockForCurrent());
    expect(result.items[0]).toMatchObject({ plaqueType: 'NFC', qty: 2, avgCostCents: null });
  });

  it('listMovements paginates', async () => {
    const rows = [
      { id: 'a', createdAt: new Date('2026-02-02T00:00:00.000Z') },
      { id: 'b', createdAt: new Date('2026-02-01T00:00:00.000Z') },
    ];
    const adminDb = {
      plaqueMovement: { findMany: jest.fn().mockResolvedValue(rows) },
    };
    const service = makeService(adminDb);
    const page = await service.listMovements(resellerId, { limit: 1 });
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeTruthy();
  });

  it('listMovementsForCurrent without cursor', async () => {
    const db = {
      plaqueMovement: {
        findMany: jest.fn().mockResolvedValue([{ id: 'm', createdAt: new Date() }]),
      },
    };
    const service = makeService({}, db);
    const page = await service.listMovementsForCurrent({ limit: 20 });
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
  });

  it('adminMove validates body and ADJUST reason', async () => {
    const service = makeService();
    await expect(service.adminMove({})).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.adminMove({
        resellerId,
        type: 'ADJUST',
        plaqueType: 'QR',
        qty: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('adminMove not found reseller', async () => {
    const adminDb = {
      reseller: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = makeService(adminDb);
    await expect(
      service.adminMove({
        resellerId,
        type: 'IN',
        plaqueType: 'QR',
        qty: 1,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('adminMove creates IN movement', async () => {
    const created = { id: 'm-in' };
    const adminDb = {
      reseller: { findUnique: jest.fn().mockResolvedValue({ id: resellerId }) },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(
          txStub({
            plaqueMovement: {
              findFirst: jest.fn().mockResolvedValue(null),
              create: jest.fn().mockResolvedValue(created),
            },
          }),
        ),
      ),
    };
    const service = makeService(adminDb);
    await expect(
      service.adminMove(
        { resellerId, type: 'IN', plaqueType: 'QR', qty: 2, unitCostCents: 50 },
        'k1',
      ),
    ).resolves.toEqual(created);
  });

  it('resellerMove IN under tenant', async () => {
    const created = { id: 'm-r' };
    const appDb = appDbWithTx(
      txStub({
        plaqueMovement: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue(created),
        },
      }),
    );
    const service = makeService({}, {}, appDb);
    await expect(
      runWithTenantAsync(actor, () =>
        service.resellerMove({ type: 'IN', plaqueType: 'NFC', qty: 1 }),
      ),
    ).resolves.toEqual(created);
  });

  it('resellerMove OUT gifts Pro site only', async () => {
    const db = {
      site: {
        findUnique: jest.fn().mockResolvedValue({
          id: siteId,
          plan: { code: 'SITE_BASIC' },
        }),
      },
    };
    const service = makeService({}, db);
    await expect(
      runWithTenantAsync(actor, () =>
        service.resellerMove({
          type: 'OUT',
          plaqueType: 'QR',
          qty: 1,
          reason: 'GIFT',
          siteId,
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('gift succeeds for ENGAJADO_PRO', async () => {
    const created = { id: 'gift' };
    const db = {
      site: {
        findUnique: jest.fn().mockResolvedValue({
          id: siteId,
          plan: { code: 'ENGAJADO_PRO' },
        }),
      },
    };
    const appDb = appDbWithTx(
      txStub({
        plaqueMovement: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue(created),
        },
      }),
    );
    const service = makeService({}, db, appDb);
    await expect(
      runWithTenantAsync(actor, () =>
        service.gift({ siteId, plaqueType: 'QR', qty: 1, idempotencyKey: 'g1' }),
      ),
    ).resolves.toEqual(created);
  });

  it('gift site not found', async () => {
    const db = { site: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = makeService({}, db);
    await expect(
      runWithTenantAsync(actor, () =>
        service.gift({ siteId, plaqueType: 'QR', qty: 1 }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('transfer validates and rejects invalid destination', async () => {
    const service = makeService();
    await expect(service.transfer({})).rejects.toBeInstanceOf(BadRequestException);

    const adminDb = {
      reseller: {
        findFirst: jest.fn().mockResolvedValue({ id: 'plat', isPlatform: true }),
        findUnique: jest.fn().mockResolvedValue({ id: otherId, isPlatform: true }),
      },
    };
    const service2 = makeService(adminDb);
    await expect(
      service2.transfer({ toResellerId: otherId, plaqueType: 'QR', qty: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('transfer reuses idempotent IN', async () => {
    const existing = { id: 'existing-in' };
    const adminDb = {
      reseller: {
        findFirst: jest.fn().mockResolvedValue({ id: 'plat', isPlatform: true }),
        findUnique: jest.fn().mockResolvedValue({ id: otherId, isPlatform: false }),
      },
      plaqueMovement: { findFirst: jest.fn().mockResolvedValue(existing) },
    };
    const service = makeService(adminDb);
    await expect(
      service.transfer(
        { toResellerId: otherId, plaqueType: 'QR', qty: 1 },
        'idem-1',
      ),
    ).resolves.toMatchObject({ resellerIn: existing, reused: true });
  });

  it('transfer moves platform OUT + reseller IN + ledger', async () => {
    const ledger = { appendForReseller: jest.fn().mockResolvedValue({ id: 'led1' }) };
    const adminDb = {
      reseller: {
        findFirst: jest.fn().mockResolvedValue({ id: 'plat', isPlatform: true }),
        findUnique: jest.fn().mockResolvedValue({ id: otherId, isPlatform: false }),
      },
      plaqueMovement: { findFirst: jest.fn().mockResolvedValue(null) },
      product: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'p1',
          code: 'PLAQUE_QR',
          baseWholesaleCents: 100,
        }),
      },
      wholesalePrice: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        let creates = 0;
        return fn(
          txStub({
            $queryRaw: jest.fn().mockImplementation(async () => {
              // qty then avg cost paths — OUT needs qty >= requested
              return [{ qty: 50 }, { avg: 100 }];
            }),
            plaqueMovement: {
              findFirst: jest.fn().mockResolvedValue(null),
              create: jest.fn().mockImplementation(async () => {
                creates += 1;
                return { id: creates === 1 ? 'out1' : 'in1' };
              }),
            },
          }),
        );
      }),
    };
    // qtyInTx called twice (OUT then IN); avgCost for OUT when unitCost provided skips avg
    // For OUT with unitCostCents set, only qty query runs.
    const service = makeService(adminDb, {}, {}, ledger);
    const result = await service.transfer({
      toResellerId: otherId,
      plaqueType: 'QR',
      qty: 2,
    });
    expect(result.reused).toBe(false);
    expect(result.ledgerEntryId).toBe('led1');
    expect(ledger.appendForReseller).toHaveBeenCalledWith(
      otherId,
      expect.objectContaining({
        category: 'PLAQUE_PURCHASE',
        amountCents: 200,
      }),
      expect.anything(),
    );
  });

  it('moveInTx throws STOCK_INSUFFICIENT on OUT', async () => {
    const service = makeService();
    const tx = txStub({
      $queryRaw: jest.fn().mockResolvedValue([{ qty: 0 }]),
    });
    await expect(
      service.moveInTx(tx as never, {
        resellerId,
        type: 'OUT',
        plaqueType: 'QR',
        qty: 1,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('moveInTx returns existing when idempotent reason matches', async () => {
    const existing = { id: 'dup' };
    const service = makeService();
    const tx = txStub({
      plaqueMovement: {
        findFirst: jest.fn().mockResolvedValue(existing),
        create: jest.fn(),
      },
    });
    await expect(
      service.moveInTx(tx as never, {
        resellerId,
        type: 'IN',
        plaqueType: 'QR',
        qty: 1,
        reason: 'IN|idemp:k',
        idempotencyKey: 'k',
      }),
    ).resolves.toEqual(existing);
    expect(tx.plaqueMovement.create).not.toHaveBeenCalled();
  });

  it('moveOut wraps tenant OUT', async () => {
    const created = { id: 'sale-out' };
    const appDb = appDbWithTx(
      txStub({
        plaqueMovement: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue(created),
        },
        $queryRaw: jest
          .fn()
          .mockResolvedValueOnce([{ qty: 9 }])
          .mockResolvedValueOnce([{ avg: 40 }]),
      }),
    );
    const service = makeService({}, {}, appDb);
    await expect(
      runWithTenantAsync(actor, () =>
        service.moveOut({ plaqueType: 'QR', qty: 1, saleItemId: 'si1' }),
      ),
    ).resolves.toEqual(created);
  });
});
