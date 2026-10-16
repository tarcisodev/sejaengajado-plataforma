import { Controller, Get, Query } from '@nestjs/common';

import { Roles } from '../../auth/roles.decorator';
import { AdminCustomersService } from './admin-customers.service';

@Controller('admin/customers')
@Roles('ADMIN')
export class AdminCustomersController {
  constructor(private readonly customers: AdminCustomersService) {}

  @Get()
  async list(@Query('limit') limitRaw?: string, @Query('cursor') cursor?: string) {
    const limit = limitRaw ? Number(limitRaw) : 20;
    const page = await this.customers.list({ limit, cursor });
    return { items: page.items, nextCursor: page.nextCursor };
  }
}
