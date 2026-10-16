import { NotFoundException } from '@nestjs/common';

import { CouponsService } from './coupons.service';

describe('CouponsService.deactivate', () => {
  it('sets active=false', async () => {
    const db = {
      coupon: {
        findUnique: jest.fn().mockResolvedValue({ id: 'c1', code: 'X', active: true }),
        update: jest.fn().mockResolvedValue({ id: 'c1', active: false }),
      },
    };
    const service = new CouponsService(db as never);
    await service.deactivate('c1');
    expect(db.coupon.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { active: false },
    });
  });

  it('404 when missing', async () => {
    const db = {
      coupon: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
    };
    const service = new CouponsService(db as never);
    await expect(service.deactivate('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
