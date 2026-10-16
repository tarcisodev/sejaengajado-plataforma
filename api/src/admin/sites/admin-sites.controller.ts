import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { Audit } from '../../audit/audit.interceptor';
import { Roles } from '../../auth/roles.decorator';
import { AdminSitesService } from './admin-sites.service';

@Controller('admin')
@Roles('ADMIN')
export class AdminSitesController {
  constructor(private readonly sites: AdminSitesService) {}

  @Get('sites')
  async list(@Query('limit') limitRaw?: string, @Query('cursor') cursor?: string) {
    const limit = limitRaw ? Number(limitRaw) : 20;
    const page = await this.sites.list({ limit, cursor });
    return { items: page.items, nextCursor: page.nextCursor };
  }

  @Post('sites')
  @Audit({
    action: 'admin.site.create',
    entity: 'Site',
    entityId: (result) => (result as { id: string }).id,
  })
  create(@Body() body: unknown) {
    return this.sites.create(body);
  }

  @Patch('sites/:id/status')
  @Audit({ action: 'admin.site.status', entity: 'Site', entityId: (_r, req) => req.params.id })
  setStatus(@Param('id') id: string, @Body() body: unknown) {
    return this.sites.setStatus(id, body);
  }

  @Get('templates')
  templates() {
    return this.sites.listTemplates().then((items) => ({ items }));
  }
}
