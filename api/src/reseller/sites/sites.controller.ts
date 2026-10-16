import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import type { AuthUser } from '../../auth/auth-user';
import { CurrentUser } from '../../auth/current-user.decorator';
import { Roles } from '../../auth/roles.decorator';
import { SitesService } from './sites.service';
import { UploadService } from './upload.service';

@Controller('reseller')
@Roles('RESELLER')
export class SitesController {
  constructor(
    private readonly sites: SitesService,
    private readonly uploads: UploadService,
  ) {}

  @Get('slugs/check')
  checkSlug(@Query('slug') slug?: string) {
    return this.sites.checkSlug(slug ?? '');
  }

  @Get('site-options')
  siteOptions() {
    return this.sites.siteOptions();
  }

  @Get('sites')
  async list(@Query('limit') limitRaw?: string, @Query('cursor') cursor?: string) {
    const limit = limitRaw ? Number(limitRaw) : 20;
    const page = await this.sites.list({ limit, cursor });
    return { items: page.items, nextCursor: page.nextCursor };
  }

  @Get('sites/:id')
  get(@Param('id') id: string) {
    return this.sites.get(id);
  }

  @Post('sites')
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.sites.create(user.resellerId!, body);
  }

  @Patch('sites/:id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.sites.update(id, body);
  }

  @Delete('sites/:id')
  remove(@Param('id') id: string) {
    return this.sites.remove(id);
  }

  @Post('sites/:id/publish')
  publish(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sites.publish(user.resellerId!, id);
  }

  @Post('sites/:id/unpublish')
  unpublish(@Param('id') id: string) {
    return this.sites.unpublish(id);
  }

  @Post('uploads/presign')
  presign(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.uploads.createPresignedUpload(body, user.resellerId!);
  }
}
