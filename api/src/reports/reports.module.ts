import { Module } from '@nestjs/common';

import { LedgerModule } from '../ledger/ledger.module';
import { StockModule } from '../stock/stock.module';
import { AdminReportsController } from './admin-reports.controller';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [LedgerModule, StockModule],
  controllers: [ReportsController, AdminReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
