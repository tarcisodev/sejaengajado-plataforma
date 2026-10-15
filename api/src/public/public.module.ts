import { Module } from '@nestjs/common';

import { ByHostCache } from './sites/by-host.cache';
import { PublicSitesController } from './sites/public-sites.controller';
import { PublicSitesService } from './sites/public-sites.service';

@Module({
  controllers: [PublicSitesController],
  providers: [ByHostCache, PublicSitesService],
  exports: [ByHostCache],
})
export class PublicModule {}
