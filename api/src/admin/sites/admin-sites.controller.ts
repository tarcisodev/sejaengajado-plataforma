import { Body, Controller, Get, Post, Query } from '@nestjs/common';

import { Audit } from '../../audit/audit.interceptor';
import { Roles } from '../../auth/roles.decorator';
import { AdminSitesService } from './admin-sites.service';

@Controller('admin/sites')
@Roles('ADMIN')
export class AdminSitesController {
  constructor(private readonly sites: AdminSitesService) {}

  @Get()
  async list(@Query('limit') limitRaw?: string, @Query('cursor') cursor?: string) {
    const limit = limitRaw ? Number(limitRaw) : 20;
    const page = await this.sites.list({ limit, cursor });
    return { items: page.items, nextCursor: page.nextCursor };
  }

  @Post()
  @Audit({
    action: 'admin.site.create',
    entity: 'Site',
    entityId: (result) => (result as { id: string }).id,
  })
  create(@Body() body: unknown) {
    return this.sites.create(body);
  }
}
