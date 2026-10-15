import { Module } from '@nestjs/common';

import { LedgerModule } from '../ledger/ledger.module';
import { BillingController } from './billing.controller';
import { BillingQueryService } from './billing-query.service';
import { BillingScheduler } from './billing.scheduler';
import { DirectBillingService } from './direct-billing.service';
import { ResellerDelinquencyJob } from './reseller-delinquency.job';
import { ResellerInvoiceJob } from './reseller-invoice.job';
import { ResellerInvoicesController } from './reseller-invoices.controller';

/** Relies on global PaymentsModule for PAYMENT_GATEWAY. */
@Module({
  imports: [LedgerModule],
  controllers: [BillingController, ResellerInvoicesController],
  providers: [
    ResellerInvoiceJob,
    ResellerDelinquencyJob,
    DirectBillingService,
    BillingQueryService,
    BillingScheduler,
  ],
  exports: [
    ResellerInvoiceJob,
    ResellerDelinquencyJob,
    DirectBillingService,
    BillingQueryService,
  ],
})
export class BillingModule {}
