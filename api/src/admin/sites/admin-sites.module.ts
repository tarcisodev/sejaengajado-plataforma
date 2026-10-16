import { Module } from '@nestjs/common';

import { SitesModule } from '../../reseller/sites/sites.module';
import { AdminSitesController } from './admin-sites.controller';
import { AdminSitesService } from './admin-sites.service';

@Module({
  imports: [SitesModule],
  controllers: [AdminSitesController],
  providers: [AdminSitesService],
  exports: [AdminSitesService],
})
export class AdminSitesModule {}
