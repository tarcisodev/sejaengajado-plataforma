import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { encodeTimeIdCursor } from '../common/cursor';
import { runWithTenantAsync } from '../tenant/tenant.context';
import { LedgerService } from './ledger.service';

const actor = {
  userId: 'u1',
  role: 'RESELLER' as const,
  resellerId: 'r1',
};

describe('LedgerService', () => {
  it('computes balance as Σ IN − Σ OUT', async () => {
    const db = {
      ledgerEntry: {
        groupBy: jest.fn().mockResolvedValue([
          { type: 'IN', _sum: { amountCents: 1000 } },
          { type: 'OUT', _sum: { amountCents: 300 } },
        ]),
      },
    };
    const service = new LedgerService(db as never, {} as never, {} as never);
    await expect(service.balance()).resolves.toBe(700);
  });

  it('balance respects at filter', async () => {
    const at = new Date('2026-01-01T00:00:00.000Z');
    const db = {
      ledgerEntry: {
        groupBy: jest.fn().mockResolvedValue([{ type: 'IN', _sum: { amountCents: 50 } }]),
      },
    };
    const service = new LedgerService(db as never, {} as never, {} as never);
    await expect(service.balance(at)).resolves.toBe(50);
    expect(db.ledgerEntry.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { createdAt: { lte: at } } }),
    );
  });

  it('append rejects non-positive amounts', async () => {
    const service = new LedgerService({} as never, {} as never, {} as never);
    await expect(
      runWithTenantAsync(actor, () =>
        service.append({ type: 'IN', category: 'MANUAL', amountCents: 0 }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('append creates entry for tenant', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'e1' });
    const service = new LedgerService(
      { ledgerEntry: { create } } as never,
      {} as never,
      {} as never,
    );
    await runWithTenantAsync(actor, () =>
      service.append({ type: 'IN', category: 'SALE', amountCents: 100 }),
    );
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        resellerId: 'r1',
        type: 'IN',
        category: 'SALE',
        amountCents: 100,
      }),
    });
  });

  it('appendForReseller uses system client (not ADMIN proxy)', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'e2' });
    const service = new LedgerService(
      {} as never,
      {} as never,
      { ledgerEntry: { create } } as never,
    );
    await service.appendForReseller('r9', {
      type: 'OUT',
      category: 'PLAQUE_PURCHASE',
      amountCents: 200,
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ resellerId: 'r9', amountCents: 200 }),
    });
  });

  it('appendManual validates body', async () => {
    const service = new LedgerService({} as never, {} as never, {} as never);
    await expect(
      runWithTenantAsync(actor, () => service.appendManual({ type: 'IN' })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('appendManual appends MANUAL category', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'e3' });
    const service = new LedgerService(
      { ledgerEntry: { create } } as never,
      {} as never,
      {} as never,
    );
    await runWithTenantAsync(actor, () =>
      service.appendManual({ type: 'OUT', amountCents: 10, refType: 'note' }),
    );
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ category: 'MANUAL', type: 'OUT', amountCents: 10 }),
    });
  });

  it('reverse not found', async () => {
    const service = new LedgerService(
      { ledgerEntry: { findUnique: jest.fn().mockResolvedValue(null) } } as never,
      {} as never,
      {} as never,
    );
    await expect(
      runWithTenantAsync(actor, () => service.reverse('missing')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reverse rejects reversing a REVERSAL', async () => {
    const service = new LedgerService(
      {
        ledgerEntry: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'e1',
            type: 'OUT',
            category: 'REVERSAL',
            amountCents: 1,
          }),
        },
      } as never,
      {} as never,
      {} as never,
    );
    await expect(
      runWithTenantAsync(actor, () => service.reverse('e1')),
    ).rejects.toMatchObject({ response: { code: 'ALREADY_REVERSED' } });
  });

  it('reverse rejects when already reversed', async () => {
    const service = new LedgerService(
      {
        ledgerEntry: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'e1',
            type: 'IN',
            category: 'MANUAL',
            amountCents: 100,
            refType: null,
            refId: null,
          }),
          findFirst: jest.fn().mockResolvedValue({ id: 'rev' }),
        },
      } as never,
      {} as never,
      {} as never,
    );
    await expect(
      runWithTenantAsync(actor, () => service.reverse('e1')),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps unique violation on reverse to ALREADY_REVERSED', async () => {
    const db = {
      ledgerEntry: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'e1',
          type: 'IN',
          category: 'MANUAL',
          amountCents: 100,
          refType: null,
          refId: null,
        }),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('unique', {
            code: 'P2002',
            clientVersion: 'test',
          }),
        ),
        groupBy: jest.fn(),
      },
    };
    const service = new LedgerService(db as never, {} as never, {} as never);
    await expect(
      runWithTenantAsync(actor, () => service.reverse('e1')),
    ).rejects.toMatchObject({
      response: { code: 'ALREADY_REVERSED' },
    });
  });

  it('statement returns opening/closing and page', async () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-01-31T00:00:00.000Z');
    const row = {
      id: 'e1',
      createdAt: new Date('2026-01-15T00:00:00.000Z'),
      amountCents: 10,
    };
    const db = {
      ledgerEntry: {
        groupBy: jest
          .fn()
          .mockResolvedValueOnce([{ type: 'IN', _sum: { amountCents: 100 } }])
          .mockResolvedValueOnce([{ type: 'IN', _sum: { amountCents: 250 } }]),
        findMany: jest.fn().mockResolvedValue([row]),
      },
    };
    const service = new LedgerService(db as never, {} as never, {} as never);
    const page = await service.statement({ from, to, limit: 20 });
    expect(page.openingCents).toBe(100);
    expect(page.closingCents).toBe(250);
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
  });

  it('statement paginates with nextCursor', async () => {
    const rows = [
      { id: 'a', createdAt: new Date('2026-02-02T00:00:00.000Z') },
      { id: 'b', createdAt: new Date('2026-02-01T00:00:00.000Z') },
    ];
    const db = {
      ledgerEntry: {
        groupBy: jest.fn().mockResolvedValue([]),
        findMany: jest.fn().mockResolvedValue(rows),
      },
    };
    const service = new LedgerService(db as never, {} as never, {} as never);
    const page = await service.statement({ limit: 1 });
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBe(encodeTimeIdCursor(rows[0]!.createdAt, rows[0]!.id));
  });
});
