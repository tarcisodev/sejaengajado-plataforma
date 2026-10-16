import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { BillingModule } from '../billing/billing.module';
import { SitesModule } from '../reseller/sites/sites.module';
import { CustomerCancelService } from './customer-cancel.service';
import { CustomerRequestsService } from './customer-requests.service';
import { CustomerSitesController } from './customer-sites.controller';
import { CustomerSitesService } from './customer-sites.service';

@Module({
  imports: [SitesModule, BillingModule, AuditModule],
  controllers: [CustomerSitesController],
  providers: [CustomerSitesService, CustomerCancelService, CustomerRequestsService],
  exports: [CustomerSitesService],
})
export class CustomerModule {}
