import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { WebhookRecoveryService } from './webhook-recovery.service';

const FIVE_MIN_MS = 5 * 60 * 1000;

@Injectable()
export class WebhookRecoveryScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebhookRecoveryScheduler.name);
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly recovery: WebhookRecoveryService) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, FIVE_MIN_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async tick(): Promise<void> {
    try {
      const result = await this.recovery.recoverOnce(new Date());
      if (!result.skippedLock && (result.requeuedStuck || result.requeuedFailed || result.markedExhausted)) {
        this.logger.log(
          `webhook recovery stuck=${result.requeuedStuck} failed=${result.requeuedFailed} exhausted=${result.markedExhausted}`,
        );
      }
    } catch (error) {
      this.logger.error(`webhook recovery falhou: ${String(error)}`);
    }
  }
}
