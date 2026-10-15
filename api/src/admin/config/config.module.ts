import { Module } from '@nestjs/common';

import { PlatformConfigController } from './config.controller';
import { PlatformConfigService } from './config.service';

@Module({
  controllers: [PlatformConfigController],
  providers: [PlatformConfigService],
  exports: [PlatformConfigService],
})
export class PlatformConfigModule {}
