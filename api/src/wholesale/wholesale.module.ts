import { Module } from '@nestjs/common';

import { WholesaleController } from './wholesale.controller';
import { WholesaleService } from './wholesale.service';

@Module({
  controllers: [WholesaleController],
  providers: [WholesaleService],
  exports: [WholesaleService],
})
export class WholesaleModule {}
