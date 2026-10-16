import { BadRequestException } from '@nestjs/common';

import { AdminPaymentsService } from './admin-payments.service';

describe('AdminPaymentsService', () => {
  function setup() {
    const db = {
      payment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'p1',
            createdAt: new Date('2026-06-15T12:00:00.000Z'),
            paidAt: new Date('2026-06-15T12:00:00.000Z'),
            amountCents: 1000,
          },
        ]),
      },
    };
    const service = new AdminPaymentsService(db as never);
    return { db, service };
  }

  it('lists payments without period filter', async () => {
    const { db, service } = setup();
    const page = await service.list({ limit: 20 });
    expect(db.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      }),
    );
    expect(page.items).toHaveLength(1);
  });

  it('applies from/to on paidAt', async () => {
    const { db, service } = setup();
    await service.list({ from: '2026-06-01', to: '2026-06-30' });
    expect(db.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          paidAt: expect.objectContaining({
            gte: new Date('2026-06-01T00:00:00.000Z'),
            lte: new Date('2026-06-30T23:59:59.999Z'),
            not: null,
          }),
        }),
      }),
    );
  });

  it('rejects invalid from date', async () => {
    const { service } = setup();
    await expect(service.list({ from: 'not-a-date' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
