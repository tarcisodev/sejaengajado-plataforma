import { Module } from '@nestjs/common';

import { PublicModule } from '../../public/public.module';
import { SitesModule } from '../../reseller/sites/sites.module';
import { AdminSitesController } from './admin-sites.controller';
import { AdminSitesService } from './admin-sites.service';

@Module({
  imports: [SitesModule, PublicModule],
  controllers: [AdminSitesController],
  providers: [AdminSitesService],
  exports: [AdminSitesService],
})
export class AdminSitesModule {}
