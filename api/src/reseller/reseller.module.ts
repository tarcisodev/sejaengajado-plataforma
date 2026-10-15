import { Module } from '@nestjs/common';

import { CustomersModule } from './customers/customers.module';
import { SitesModule } from './sites/sites.module';

@Module({
  imports: [CustomersModule, SitesModule],
  exports: [CustomersModule, SitesModule],
})
export class ResellerModule {}
