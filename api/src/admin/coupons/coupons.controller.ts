import { Body, Controller, Delete, Get, Headers, Param, Post } from '@nestjs/common';

import { Audit } from '../../audit/audit.interceptor';
import { Roles } from '../../auth/roles.decorator';
import { CouponsService } from './coupons.service';

@Controller('admin/coupons')
@Roles('ADMIN')
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Get()
  list() {
    return this.coupons.list().then((items) => ({ items }));
  }

  @Delete(':id')
  @Audit({ action: 'coupon.deactivate', entity: 'Coupon', entityId: (_r, req) => req.params.id })
  deactivate(@Param('id') id: string) {
    return this.coupons.deactivate(id);
  }

  @Post('preview')
  preview(@Body() body: unknown) {
    return this.coupons.preview(body);
  }

  @Post('redeem')
  @Audit({
    action: 'coupon.redeem',
    entity: 'Coupon',
    entityId: (result) => (result as { code: string }).code,
  })
  redeem(
    @Body() body: unknown,
    @Headers('idempotency-key') _idempotencyKey?: string,
  ) {
    return this.coupons.redeem(body);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.coupons.get(id);
  }

  @Post()
  @Audit({
    action: 'coupon.create',
    entity: 'Coupon',
    entityId: (result) => (result as { id: string }).id,
  })
  create(
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.coupons.create(body, idempotencyKey);
  }
}
