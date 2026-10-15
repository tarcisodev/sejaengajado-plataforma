import { Module } from '@nestjs/common';

import { LedgerModule } from '../ledger/ledger.module';
import { StockModule } from '../stock/stock.module';
import { WholesaleModule } from '../wholesale/wholesale.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [WholesaleModule, LedgerModule, StockModule],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
