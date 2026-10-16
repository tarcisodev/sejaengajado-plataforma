import { Controller, Get, Query } from '@nestjs/common';

import { Roles } from '../../auth/roles.decorator';
import { AdminPaymentsService } from './admin-payments.service';

@Controller('admin/payments')
@Roles('ADMIN')
export class AdminPaymentsController {
  constructor(private readonly payments: AdminPaymentsService) {}

  @Get()
  async list(
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : 20;
    const page = await this.payments.list({ limit, cursor, from, to });
    return { items: page.items, nextCursor: page.nextCursor };
  }
}
