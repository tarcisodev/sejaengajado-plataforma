import { Module } from '@nestjs/common';

import { ByHostCache } from '../../public/sites/by-host.cache';
import { SitesController } from './sites.controller';
import { SitesService } from './sites.service';
import { UploadService } from './upload.service';

@Module({
  controllers: [SitesController],
  providers: [SitesService, UploadService, ByHostCache],
  exports: [SitesService, ByHostCache],
})
export class SitesModule {}
