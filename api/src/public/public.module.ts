import { Module } from '@nestjs/common';

import { AvaliarRateLimit } from './sites/avaliar-rate-limit';
import { ByHostCache } from './sites/by-host.cache';
import { PublicSitesController } from './sites/public-sites.controller';
import { PublicSitesService } from './sites/public-sites.service';

@Module({
  controllers: [PublicSitesController],
  providers: [ByHostCache, AvaliarRateLimit, PublicSitesService],
  exports: [ByHostCache],
})
export class PublicModule {}
