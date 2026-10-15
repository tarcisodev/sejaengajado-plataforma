import { Inject, Injectable, Logger } from '@nestjs/common';

import { SYSTEM_PRISMA, type SystemPrisma } from '../../tenant/prisma.module';
import { WEBHOOK_MAX_ATTEMPTS } from './asaas-webhook.service';
import { WebhookQueueService } from './webhook-queue.service';

export const WEBHOOK_RECOVERY_LOCK = 'webhooks:recovery';
/** PROCESSING older than this is treated as crashed mid-flight (restart). */
export const STUCK_PROCESSING_MS = 5 * 60 * 1000;

export interface WebhookRecoveryResult {
  skippedLock: boolean;
  requeuedStuck: number;
  requeuedFailed: number;
  markedExhausted: number;
}

@Injectable()
export class WebhookRecoveryService {
  private readonly logger = new Logger(WebhookRecoveryService.name);
  /** Alert counter for exhausted webhooks (ops / tests). */
  exhaustedAlertCount = 0;

  constructor(
    @Inject(SYSTEM_PRISMA) private readonly db: SystemPrisma,
    private readonly queue: WebhookQueueService,
  ) {}

  /**
   * Idempotent recovery pass (advisory lock):
   * - PROCESSING stuck > 5 min → RECEIVED + requeue (simulates process restart)
   * - FAILED with attempts < max → requeue
   * - FAILED with attempts >= max → ensure terminal FAILED + alert once
   */
  async recoverOnce(now = new Date()): Promise<WebhookRecoveryResult> {
    const locked = await this.db.$queryRaw<{ ok: boolean }[]>`
      SELECT pg_try_advisory_lock(hashtext(${WEBHOOK_RECOVERY_LOCK})) AS ok
    `;
    if (!locked[0]?.ok) {
      return {
        skippedLock: true,
        requeuedStuck: 0,
        requeuedFailed: 0,
        markedExhausted: 0,
      };
    }

    try {
      return await this.run(now);
    } finally {
      await this.db.$executeRaw`
        SELECT pg_advisory_unlock(hashtext(${WEBHOOK_RECOVERY_LOCK}))
      `;
    }
  }

  private async run(now: Date): Promise<WebhookRecoveryResult> {
    const stuckBefore = new Date(now.getTime() - STUCK_PROCESSING_MS);
    let requeuedStuck = 0;
    let requeuedFailed = 0;
    let markedExhausted = 0;

    const stuck = await this.db.webhookEvent.findMany({
      where: {
        status: 'PROCESSING',
        updatedAt: { lt: stuckBefore },
      },
      take: 100,
    });

    for (const event of stuck) {
      const reset = await this.db.webhookEvent.updateMany({
        where: { id: event.id, status: 'PROCESSING' },
        data: {
          status: 'RECEIVED',
          lastError: 'recovered_after_stuck_processing',
        },
      });
      if (reset.count === 1) {
        this.queue.enqueue(event.id);
        requeuedStuck += 1;
      }
    }

    const retryable = await this.db.webhookEvent.findMany({
      where: {
        status: 'FAILED',
        attempts: { lt: WEBHOOK_MAX_ATTEMPTS },
        processedAt: null,
      },
      take: 100,
    });

    for (const event of retryable) {
      const reset = await this.db.webhookEvent.updateMany({
        where: {
          id: event.id,
          status: 'FAILED',
          attempts: { lt: WEBHOOK_MAX_ATTEMPTS },
        },
        data: { status: 'RECEIVED' },
      });
      if (reset.count === 1) {
        this.queue.enqueue(event.id);
        requeuedFailed += 1;
      }
    }

    const exhausted = await this.db.webhookEvent.findMany({
      where: {
        status: 'FAILED',
        attempts: { gte: WEBHOOK_MAX_ATTEMPTS },
        processedAt: null,
      },
      take: 100,
    });

    for (const event of exhausted) {
      const marked = await this.db.webhookEvent.updateMany({
        where: {
          id: event.id,
          status: 'FAILED',
          attempts: { gte: WEBHOOK_MAX_ATTEMPTS },
        },
        data: {
          processedAt: now,
          lastError: `EXHAUSTED:${(event.lastError ?? 'max_attempts').slice(0, 480)}`,
        },
      });
      if (marked.count === 1) {
        this.exhaustedAlertCount += 1;
        markedExhausted += 1;
        this.logger.error(
          {
            webhookEventId: event.id,
            eventId: event.eventId,
            attempts: event.attempts,
            alertCount: this.exhaustedAlertCount,
          },
          'webhook retries exhausted',
        );
      }
    }

    return {
      skippedLock: false,
      requeuedStuck,
      requeuedFailed,
      markedExhausted,
    };
  }
}
