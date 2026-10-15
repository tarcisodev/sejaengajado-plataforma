import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, type PaymentStatus as DbPaymentStatus } from '@prisma/client';

import { ENV, type Env } from '../../config/env';
import { LedgerService } from '../../ledger/ledger.service';
import { SYSTEM_PRISMA, type SystemPrisma } from '../../tenant/prisma.module';
import {
  PAYMENT_GATEWAY,
  type PaymentGateway,
} from '../domain/payment-gateway.port';
import { applyPaymentTransition } from './payment-state-machine';
import { sanitizeWebhookPayload } from './sanitize-webhook-payload';
import { tokensMatch } from './timing-safe-token';
import { WebhookQueueService } from './webhook-queue.service';

export const ASAAS_GATEWAY = 'asaas';
export const WEBHOOK_MAX_ATTEMPTS = 5;

@Injectable()
export class AsaasWebhookService implements OnModuleInit {
  private readonly logger = new Logger(AsaasWebhookService.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(SYSTEM_PRISMA) private readonly db: SystemPrisma,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    private readonly queue: WebhookQueueService,
    private readonly ledger: LedgerService,
  ) {}

  onModuleInit(): void {
    this.queue.bind((id) => this.processEvent(id));
  }

  /**
   * Verify token → insert WebhookEvent (unique) → enqueue → 200.
   * Duplicates and races return without re-enqueue.
   */
  async accept(
    accessToken: string | undefined,
    body: unknown,
  ): Promise<{ duplicate: boolean }> {
    if (!tokensMatch(accessToken, this.env.ASAAS_WEBHOOK_TOKEN)) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Não autenticado',
      });
    }

    const sanitized = sanitizeWebhookPayload(body);
    const eventId = extractEventId(body, sanitized.paymentId);
    if (!eventId) {
      this.logger.warn(
        { hasPayment: Boolean(sanitized.paymentId) },
        'webhook sem event id',
      );
      return { duplicate: false };
    }

    try {
      const created = await this.db.webhookEvent.create({
        data: {
          gateway: ASAAS_GATEWAY,
          eventId,
          status: 'RECEIVED',
          payload: sanitized,
          attempts: 0,
        },
      });
      this.queue.enqueue(created.id);
      return { duplicate: false };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return { duplicate: true };
      }
      throw error;
    }
  }

  /** Process one stored event: claim → reconsulta → state machine. */
  async processEvent(
    webhookEventId: string,
  ): Promise<'PROCESSED' | 'FAILED' | 'RETRY'> {
    const claimed = await this.db.webhookEvent.updateMany({
      where: {
        id: webhookEventId,
        status: { in: ['RECEIVED', 'FAILED'] },
        attempts: { lt: WEBHOOK_MAX_ATTEMPTS },
      },
      data: {
        status: 'PROCESSING',
        attempts: { increment: 1 },
        lastError: null,
      },
    });
    if (claimed.count === 0) {
      const existing = await this.db.webhookEvent.findUnique({
        where: { id: webhookEventId },
      });
      if (
        existing?.status === 'PROCESSED' ||
        existing?.status === 'PROCESSING'
      ) {
        return 'PROCESSED';
      }
      return 'FAILED';
    }

    const event = await this.db.webhookEvent.findUniqueOrThrow({
      where: { id: webhookEventId },
    });
    const payload = event.payload as { paymentId?: string; event?: string };
    const gatewayPaymentId = payload.paymentId;
    if (!gatewayPaymentId) {
      await this.markRetryOrFail(webhookEventId, 'missing paymentId', event.attempts);
      return event.attempts >= WEBHOOK_MAX_ATTEMPTS ? 'FAILED' : 'RETRY';
    }

    try {
      // Never trust webhook payload status — always reconsultar.
      const remote = await this.gateway.getPayment(gatewayPaymentId);
      const payment = await this.db.payment.findUnique({
        where: { gatewayPaymentId },
      });
      if (!payment) {
        await this.markRetryOrFail(
          webhookEventId,
          'payment not found',
          event.attempts,
        );
        return event.attempts >= WEBHOOK_MAX_ATTEMPTS ? 'FAILED' : 'RETRY';
      }

      const transition = applyPaymentTransition(payment.status, remote.status);
      if (!transition.ok) {
        this.logger.warn(
          {
            webhookEventId,
            from: payment.status,
            gatewayStatus: remote.status,
          },
          'webhook transição inválida',
        );
        await this.db.webhookEvent.update({
          where: { id: webhookEventId },
          data: {
            status: 'PROCESSED',
            processedAt: new Date(),
            lastError: 'INVALID_TRANSITION',
          },
        });
        return 'PROCESSED';
      }

      if (transition.changed) {
        await this.applySideEffects(payment, transition.next);
      }

      await this.db.webhookEvent.update({
        where: { id: webhookEventId },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
          lastError: null,
        },
      });
      return 'PROCESSED';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'process error';
      this.logger.error({ webhookEventId }, 'webhook process failed');
      await this.markRetryOrFail(webhookEventId, message, event.attempts);
      return event.attempts >= WEBHOOK_MAX_ATTEMPTS ? 'FAILED' : 'RETRY';
    }
  }

  private async applySideEffects(
    payment: {
      id: string;
      resellerId: string | null;
      status: DbPaymentStatus;
      amountCents: number;
      gatewayPaymentId: string | null;
    },
    next: DbPaymentStatus,
  ): Promise<void> {
    await this.db.payment.update({
      where: { id: payment.id },
      data: {
        status: next,
        ...(next === 'PAID' ? { paidAt: new Date() } : {}),
      },
    });

    if (next === 'REFUNDED') {
      await this.reverseLedgerForPayment(payment);
      if (payment.gatewayPaymentId) {
        const invoice = await this.db.resellerInvoice.findUnique({
          where: { gatewayPaymentId: payment.gatewayPaymentId },
        });
        if (invoice && (invoice.status === 'PAID' || invoice.status === 'OPEN')) {
          await this.db.resellerInvoice.update({
            where: { id: invoice.id },
            data: { status: 'OVERDUE' },
          });
        }
      }
    }

    if (next === 'PAID' && payment.gatewayPaymentId) {
      const invoice = await this.db.resellerInvoice.findUnique({
        where: { gatewayPaymentId: payment.gatewayPaymentId },
      });
      if (invoice && invoice.status !== 'PAID') {
        await this.db.resellerInvoice.update({
          where: { id: invoice.id },
          data: { status: 'PAID', closedAt: new Date() },
        });
      }
    }
  }

  private async reverseLedgerForPayment(payment: {
    id: string;
    resellerId: string | null;
  }): Promise<void> {
    if (!payment.resellerId) {
      return;
    }
    const entry = await this.db.ledgerEntry.findFirst({
      where: {
        resellerId: payment.resellerId,
        refType: 'Payment',
        refId: payment.id,
        category: { in: ['PLATFORM_INVOICE', 'SALE'] },
        type: 'OUT',
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!entry) {
      return;
    }
    const already = await this.db.ledgerEntry.findFirst({
      where: { reversalOfId: entry.id },
    });
    if (already) {
      return;
    }
    await this.ledger.appendForReseller(payment.resellerId, {
      type: 'IN',
      category: 'REVERSAL',
      amountCents: entry.amountCents,
      refType: entry.refType,
      refId: entry.refId,
      reversalOfId: entry.id,
    });
  }

  private async markRetryOrFail(
    id: string,
    lastError: string,
    attempts: number,
  ): Promise<void> {
    const terminal = attempts >= WEBHOOK_MAX_ATTEMPTS;
    await this.db.webhookEvent.update({
      where: { id },
      data: {
        status: 'FAILED',
        lastError: lastError.slice(0, 500),
        processedAt: terminal ? new Date() : null,
      },
    });
  }
}

function extractEventId(
  raw: unknown,
  paymentId: string | undefined,
): string | undefined {
  if (raw && typeof raw === 'object') {
    const body = raw as Record<string, unknown>;
    if (typeof body.id === 'string' && body.id.length > 0) {
      return body.id;
    }
    if (typeof body.event === 'string' && paymentId) {
      return `${body.event}:${paymentId}`;
    }
  }
  return paymentId ? `payment:${paymentId}` : undefined;
}
