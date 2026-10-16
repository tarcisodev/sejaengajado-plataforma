import { Module } from '@nestjs/common';

import { SitesModule } from '../reseller/sites/sites.module';
import { CustomerSitesController } from './customer-sites.controller';
import { CustomerSitesService } from './customer-sites.service';

@Module({
  imports: [SitesModule],
  controllers: [CustomerSitesController],
  providers: [CustomerSitesService],
  exports: [CustomerSitesService],
})
export class CustomerModule {}
