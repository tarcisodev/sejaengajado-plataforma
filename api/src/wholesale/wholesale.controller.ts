import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';

import { Audit } from '../audit/audit.interceptor';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { WholesaleService } from './wholesale.service';

@Controller()
export class WholesaleController {
  constructor(private readonly wholesale: WholesaleService) {}

  @Get('admin/resellers/:id/wholesale')
  @Roles('ADMIN')
  listWholesaleAdmin(@Param('id') resellerId: string, @Query('at') atRaw?: string) {
    if (!atRaw) {
      return this.wholesale.listForResellerAdmin(resellerId);
    }
    const at = new Date(atRaw);
    if (Number.isNaN(at.getTime())) {
      return this.wholesale.listForResellerAdmin(resellerId);
    }
    return this.wholesale.listForResellerAdmin(resellerId, at);
  }

  @Post('admin/resellers/:id/wholesale')
  @Roles('ADMIN')
  @Audit({
    action: 'wholesale.create',
    entity: 'WholesalePrice',
    entityId: (result) => (result as { id: string }).id,
  })
  setWholesale(@Param('id') resellerId: string, @Body() body: unknown) {
    return this.wholesale.setWholesale(resellerId, body);
  }

  @Get('reseller/wholesale')
  @Roles('RESELLER')
  listWholesale(@Query('at') atRaw?: string) {
    if (!atRaw) {
      return this.wholesale.listForCurrentReseller();
    }
    const at = new Date(atRaw);
    if (Number.isNaN(at.getTime())) {
      return this.wholesale.listForCurrentReseller();
    }
    return this.wholesale.listForCurrentReseller(at);
  }

  @Get('reseller/prices')
  @Roles('RESELLER')
  listPrices() {
    return this.wholesale.listSuggestedPrices();
  }

  @Put('reseller/prices')
  @Roles('RESELLER')
  putPrice(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.wholesale.upsertSuggestedPrice(user.resellerId!, body);
  }
}
