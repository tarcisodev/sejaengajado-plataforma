import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

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
    const service = new LedgerService(db as never);
    await expect(service.balance()).resolves.toBe(700);
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
    const service = new LedgerService(db as never);
    await expect(
      runWithTenantAsync(actor, () => service.reverse('e1')),
    ).rejects.toMatchObject({
      response: { code: 'ALREADY_REVERSED' },
    });
    await expect(
      runWithTenantAsync(actor, () => service.reverse('e1')),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
