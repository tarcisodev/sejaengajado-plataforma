import { Module } from '@nestjs/common';

import { ResellerProfileController } from './profile.controller';
import { ResellerProfileService } from './profile.service';

@Module({
  controllers: [ResellerProfileController],
  providers: [ResellerProfileService],
  exports: [ResellerProfileService],
})
export class ResellerProfileModule {}
