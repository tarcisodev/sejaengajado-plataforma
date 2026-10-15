import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

import { ENV, type Env } from '../config/env';
import { LedgerModule } from '../ledger/ledger.module';
import { AsaasClient } from './adapters/asaas/asaas.client';
import { AsaasGateway } from './adapters/asaas/asaas.gateway';
import { FakeGateway } from './domain/fake-gateway';
import { registerPaymentGateway } from './domain/gateway.registry';
import {
  PAYMENT_GATEWAY,
  type PaymentGateway,
} from './domain/payment-gateway.port';
import { AsaasWebhookController } from './webhooks/asaas-webhook.controller';
import { AsaasWebhookService } from './webhooks/asaas-webhook.service';
import { WebhookQueueService } from './webhooks/webhook-queue.service';
import { WebhookRateLimit } from './webhooks/webhook-rate-limit';
import { WebhookRecoveryScheduler } from './webhooks/webhook-recovery.scheduler';
import { WebhookRecoveryService } from './webhooks/webhook-recovery.service';

export function resolvePaymentGateway(
  env: Env,
  fake: FakeGateway,
  logger?: Logger,
): PaymentGateway {
  if (env.ASAAS_API_KEY) {
    const baseUrl = env.ASAAS_BASE_URL ?? 'https://sandbox.asaas.com/api/v3';
    const client = new AsaasClient({
      baseUrl,
      apiKey: env.ASAAS_API_KEY,
      logger: logger
        ? {
            warn: (obj, msg) => logger.warn(obj, msg),
            error: (obj, msg) => logger.error(obj, msg),
          }
        : undefined,
    });
    const gateway = new AsaasGateway(client);
    registerPaymentGateway(gateway);
    return gateway;
  }

  if (env.NODE_ENV === 'production') {
    throw new Error('FakeGateway proibido em produção');
  }

  registerPaymentGateway(fake);
  return fake;
}

@Module({})
export class PaymentsModule {
  static register(): DynamicModule {
    const providers: Provider[] = [
      FakeGateway,
      {
        provide: PAYMENT_GATEWAY,
        useFactory: (env: Env, fake: FakeGateway, logger?: Logger) =>
          resolvePaymentGateway(env, fake, logger),
        inject: [ENV, FakeGateway, { token: Logger, optional: true }],
      },
      WebhookQueueService,
      WebhookRateLimit,
      AsaasWebhookService,
      WebhookRecoveryService,
      WebhookRecoveryScheduler,
    ];

    return {
      module: PaymentsModule,
      global: true,
      imports: [LedgerModule],
      controllers: [AsaasWebhookController],
      providers,
      exports: [
        PAYMENT_GATEWAY,
        FakeGateway,
        AsaasWebhookService,
        WebhookQueueService,
        WebhookRecoveryService,
      ],
    };
  }
}
