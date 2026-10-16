import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { Audit } from '../../audit/audit.interceptor';
import { Roles } from '../../auth/roles.decorator';
import { parseLimit } from '../../common/parse-limit';
import { AdminSitesService } from './admin-sites.service';

@Controller('admin')
@Roles('ADMIN')
export class AdminSitesController {
  constructor(private readonly sites: AdminSitesService) {}

  @Get('sites')
  async list(@Query('limit') limitRaw?: string, @Query('cursor') cursor?: string) {
    const limit = parseLimit(limitRaw);
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

  @Get('sites/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.sites.get(id);
  }

  @Patch('sites/:id/status')
  @Audit({ action: 'admin.site.status', entity: 'Site', entityId: (_r, req) => req.params.id })
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.sites.setStatus(id, body);
  }

  @Patch('sites/:id/content')
  @Audit({ action: 'admin.site.content', entity: 'Site', entityId: (_r, req) => req.params.id })
  updateContent(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.sites.updateContent(id, body);
  }

  @Patch('sites/:id')
  @Audit({ action: 'admin.site.meta', entity: 'Site', entityId: (_r, req) => req.params.id })
  patchMeta(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.sites.patchMeta(id, body);
  }

  @Post('sites/:id/publish')
  @Audit({ action: 'admin.site.publish', entity: 'Site', entityId: (_r, req) => req.params.id })
  publish(@Param('id', ParseUUIDPipe) id: string) {
    return this.sites.publish(id);
  }

  @Post('sites/:id/unpublish')
  @Audit({ action: 'admin.site.unpublish', entity: 'Site', entityId: (_r, req) => req.params.id })
  unpublish(@Param('id', ParseUUIDPipe) id: string) {
    return this.sites.unpublish(id);
  }

  @Post('sites/:id/archive')
  @Audit({ action: 'admin.site.archive', entity: 'Site', entityId: (_r, req) => req.params.id })
  archive(@Param('id', ParseUUIDPipe) id: string) {
    return this.sites.archive(id);
  }

  @Get('templates')
  templates() {
    return this.sites.listTemplates().then((items) => ({ items }));
  }
}
