import { Module } from '@nestjs/common';

import { CustomersModule } from './customers/customers.module';
import { ResellerProfileModule } from './profile/profile.module';
import { SitesModule } from './sites/sites.module';

@Module({
  imports: [CustomersModule, SitesModule, ResellerProfileModule],
  exports: [CustomersModule, SitesModule, ResellerProfileModule],
})
export class ResellerModule {}
