import { Module } from '@nestjs/common';

import { LedgerModule } from '../ledger/ledger.module';
import { BillingScheduler } from './billing.scheduler';
import { DirectBillingService } from './direct-billing.service';
import { ResellerDelinquencyJob } from './reseller-delinquency.job';
import { ResellerInvoiceJob } from './reseller-invoice.job';

/** Relies on global PaymentsModule for PAYMENT_GATEWAY. */
@Module({
  imports: [LedgerModule],
  providers: [
    ResellerInvoiceJob,
    ResellerDelinquencyJob,
    DirectBillingService,
    BillingScheduler,
  ],
  exports: [ResellerInvoiceJob, ResellerDelinquencyJob, DirectBillingService],
})
export class BillingModule {}
