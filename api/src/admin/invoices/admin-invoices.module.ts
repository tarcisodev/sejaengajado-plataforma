import { Module } from '@nestjs/common';

import { AdminInvoicesController } from './admin-invoices.controller';
import { AdminInvoicesService } from './admin-invoices.service';

@Module({
  controllers: [AdminInvoicesController],
  providers: [AdminInvoicesService],
  exports: [AdminInvoicesService],
})
export class AdminInvoicesModule {}
