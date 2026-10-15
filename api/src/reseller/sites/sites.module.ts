import { Module } from '@nestjs/common';

import { PublicModule } from '../../public/public.module';
import { SitesController } from './sites.controller';
import { SitesService } from './sites.service';
import { UploadService } from './upload.service';

@Module({
  imports: [PublicModule],
  controllers: [SitesController],
  providers: [SitesService, UploadService],
  exports: [SitesService],
})
export class SitesModule {}
