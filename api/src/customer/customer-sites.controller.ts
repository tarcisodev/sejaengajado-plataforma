import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';

import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { CustomerCancelService } from './customer-cancel.service';
import { CustomerRequestsService } from './customer-requests.service';
import { CustomerSitesService } from './customer-sites.service';
import { UploadService } from '../reseller/sites/upload.service';

@Controller('customer')
@Roles('CUSTOMER')
export class CustomerSitesController {
  constructor(
    private readonly sites: CustomerSitesService,
    private readonly uploads: UploadService,
    private readonly cancel: CustomerCancelService,
    private readonly requests: CustomerRequestsService,
  ) {}

  @Get('sites')
  list(@CurrentUser() user: AuthUser) {
    return this.sites.listMine(user);
  }

  @Get('templates')
  templates() {
    return this.sites.listTemplates();
  }

  @Get('sites/:id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sites.getMine(user, id);
  }

  @Patch('sites/:id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.sites.updateContent(user, id, body);
  }

  @Post('sites/:id/publish')
  publish(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sites.publish(user, id);
  }

  @Get('sites/:id/plaque-penalty')
  plaquePenalty(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.cancel.quote(user, id);
  }

  @Post('sites/:id/cancel')
  cancelSite(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.cancel.cancel(user, id);
  }

  @Post('sites/:id/request-change')
  requestChange(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.requests.requestSiteChange(user, id, body);
  }

  @Post('sites/:id/request-monthly-plan')
  requestMonthly(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.requests.requestMonthlyPlan(user, id);
  }

  /** Same type/size rules as reseller uploads (JPEG/PNG/WebP ≤ 5 MB). */
  @Post('uploads/presign')
  presign(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const resellerId = user.resellerId;
    if (!resellerId) {
      return this.uploads.createPresignedUpload(body, 'customer');
    }
    return this.uploads.createPresignedUpload(body, resellerId);
  }
}
