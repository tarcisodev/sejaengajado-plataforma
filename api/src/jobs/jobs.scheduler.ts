import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { JobsService } from './jobs.service';

const HOUR_MS = 60 * 60 * 1000;

@Injectable()
export class JobsScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsScheduler.name);
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly jobs: JobsService) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    // MVP: in-process hourly tick + pg advisory lock (pg-boss ⏳P10 later).
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
      const result = await this.jobs.runOnce(new Date());
      if (!result.skippedLock) {
        this.logger.log(
          `jobs ok scanned=${result.scanned} transitioned=${result.transitioned} warned=${result.warned} renewals=${result.renewals}`,
        );
      }
    } catch (error) {
      this.logger.error(`jobs falhou: ${String(error)}`);
    }
  }
}
