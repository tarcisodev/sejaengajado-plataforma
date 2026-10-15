import { Module } from '@nestjs/common';

import { LedgerModule } from '../ledger/ledger.module';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';

@Module({
  imports: [LedgerModule],
  controllers: [StockController],
  providers: [StockService],
  exports: [StockService],
})
export class StockModule {}
