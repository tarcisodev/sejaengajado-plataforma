import { Body, Controller, Get, Headers, Param, Patch, Post } from '@nestjs/common';

import { Audit } from '../../audit/audit.interceptor';
import { Roles } from '../../auth/roles.decorator';
import { PlansService } from './plans.service';

@Controller('admin/plans')
@Roles('ADMIN')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  list() {
    return this.plans.list().then((items) => ({ items }));
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.plans.get(id);
  }

  @Post()
  @Audit({
    action: 'plan.create',
    entity: 'Plan',
    entityId: (result) => (result as { id: string }).id,
  })
  create(
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.plans.create(body, idempotencyKey);
  }

  @Patch(':id')
  @Audit({
    action: 'plan.update',
    entity: 'Plan',
    entityId: (_r, req) => req.params.id,
  })
  patch(@Param('id') id: string, @Body() body: unknown) {
    return this.plans.patch(id, body);
  }
}
