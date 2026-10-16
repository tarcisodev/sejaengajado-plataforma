import { BadRequestException } from '@nestjs/common';

import { CouponsService } from './coupons.service';

describe('CouponsService create dates', () => {
  function setup() {
    const db = {
      coupon: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'c1',
          ...data,
        })),
      },
    };
    const service = new CouponsService(db as never);
    return { db, service };
  }

  it('accepts pure date validTo and stores end of day SP as Date', async () => {
    const { db, service } = setup();
    await service.create({
      code: 'PROMO10',
      type: 'PCT',
      value: 10,
      validTo: '2026-06-09',
    });
    expect(db.coupon.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: 'PROMO10',
        validTo: new Date('2026-06-10T02:59:59.000Z'),
      }),
    });
  });

  it('accepts ISO datetime validTo', async () => {
    const { db, service } = setup();
    await service.create({
      code: 'PROMO20',
      type: 'FIXED',
      value: 500,
      validTo: '2026-06-09T23:59:59-03:00',
    });
    expect(db.coupon.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        validTo: new Date('2026-06-10T02:59:59.000Z'),
      }),
    });
  });

  it('rejects invalid body', async () => {
    const { service } = setup();
    await expect(service.create({ code: 'X' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
