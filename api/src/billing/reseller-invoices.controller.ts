import { Controller, Get, Param } from '@nestjs/common';

import { Roles } from '../auth/roles.decorator';
import { BillingQueryService } from './billing-query.service';

@Controller('reseller/invoices')
@Roles('RESELLER')
export class ResellerInvoicesController {
  constructor(private readonly queries: BillingQueryService) {}

  @Get()
  list() {
    return this.queries.listResellerInvoices();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.queries.getResellerInvoice(id);
  }
}
