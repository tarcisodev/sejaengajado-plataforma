import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';

import { Audit } from '../../audit/audit.interceptor';
import { Roles } from '../../auth/roles.decorator';
import { parseLimit } from '../../common/parse-limit';
import { AdminInvoicesService } from './admin-invoices.service';

@Controller('admin')
@Roles('ADMIN')
export class AdminInvoicesController {
  constructor(private readonly invoices: AdminInvoicesService) {}

  @Get('invoices')
  async list(@Query('limit') limitRaw?: string) {
    const limit = parseLimit(limitRaw, { defaultValue: 50 });
    const items = await this.invoices.list({ limit });
    return { items };
  }

  @Post('resellers/:id/invoices/close')
  @Audit({
    action: 'admin.invoice.close',
    entity: 'ResellerInvoice',
    entityId: (result) => (result as { id: string }).id,
  })
  close(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.invoices.close(id, body);
  }
}
