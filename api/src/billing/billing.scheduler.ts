import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { ResellerDelinquencyJob } from './reseller-delinquency.job';
import { ResellerInvoiceJob } from './reseller-invoice.job';

const HOUR_MS = 60 * 60 * 1000;

@Injectable()
export class BillingScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BillingScheduler.name);
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly invoices: ResellerInvoiceJob,
    private readonly delinquency: ResellerDelinquencyJob,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, HOUR_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async tick(): Promise<void> {
    try {
      const inv = await this.invoices.runOnce(new Date());
      const del = await this.delinquency.runOnce(new Date());
      if (!inv.skippedLock) {
        this.logger.log(
          `billing invoices created=${inv.created} reused=${inv.reused} charged=${inv.charged}`,
        );
      }
      if (!del.skippedLock) {
        this.logger.log(
          `billing delinquency marked=${del.markedDelinquent} migration=${del.migrationEligible}`,
        );
      }
    } catch (error) {
      this.logger.error(`billing jobs falhou: ${String(error)}`);
    }
  }
}
