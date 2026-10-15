import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

export type WebhookProcessResult = 'PROCESSED' | 'FAILED' | 'RETRY';
export type WebhookProcessor = (
  webhookEventId: string,
) => Promise<WebhookProcessResult>;

const BACKOFF_MS = [200, 500, 1_000, 2_000, 5_000];

/**
 * In-process webhook queue with retry/backoff (pg-boss arrives with worker infra).
 * Accept path only enqueues; HTTP returns 200 immediately.
 */
@Injectable()
export class WebhookQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(WebhookQueueService.name);
  private readonly pending: string[] = [];
  private readonly timers = new Set<NodeJS.Timeout>();
  private pumping = false;
  private processor: WebhookProcessor | null = null;
  private readonly attemptHint = new Map<string, number>();

  /** Bound from AsaasWebhookService.onModuleInit (avoids circular DI). */
  bind(processor: WebhookProcessor): void {
    this.processor = processor;
  }

  enqueue(webhookEventId: string): void {
    this.pending.push(webhookEventId);
    void this.pump();
  }

  /** Test helper — process queue to idle (retries with zero delay). */
  async drain(maxSteps = 50): Promise<void> {
    let steps = 0;
    while (this.pending.length > 0 && steps < maxSteps) {
      steps += 1;
      const id = this.pending.shift();
      if (!id || !this.processor) {
        continue;
      }
      const result = await this.processor(id);
      if (result === 'RETRY') {
        this.pending.push(id);
      }
    }
  }

  /** Test helper — process a single id synchronously. */
  async processNow(webhookEventId: string): Promise<WebhookProcessResult> {
    if (!this.processor) {
      throw new Error('Webhook processor not bound');
    }
    return this.processor(webhookEventId);
  }

  onModuleDestroy(): void {
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  private async pump(): Promise<void> {
    if (this.pumping) {
      return;
    }
    this.pumping = true;
    try {
      while (this.pending.length > 0) {
        const id = this.pending.shift();
        if (!id || !this.processor) {
          continue;
        }
        try {
          const result = await this.processor(id);
          if (result === 'RETRY') {
            const n = (this.attemptHint.get(id) ?? 0) + 1;
            this.attemptHint.set(id, n);
            const delay = BACKOFF_MS[Math.min(n - 1, BACKOFF_MS.length - 1)] ?? 5_000;
            const timer = setTimeout(() => {
              this.timers.delete(timer);
              this.pending.push(id);
              void this.pump();
            }, delay);
            this.timers.add(timer);
          } else {
            this.attemptHint.delete(id);
          }
        } catch {
          this.logger.error({ id }, 'webhook queue item failed');
        }
      }
    } finally {
      this.pumping = false;
    }
  }
}
