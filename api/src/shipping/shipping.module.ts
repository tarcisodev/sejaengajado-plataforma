import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

import { ENV, type Env } from '../config/env';
import { FakeShippingProvider } from './fake-shipping.provider';
import { MelhorEnvioClient } from './melhor-envio.client';
import { MelhorEnvioProvider } from './melhor-envio.provider';
import { SHIPPING_PROVIDER, type ShippingProvider } from './shipping.port';
import { ShippingService } from './shipping.service';

export function resolveShippingProvider(
  env: Env,
  fake: FakeShippingProvider,
  logger?: Logger,
): ShippingProvider {
  if (env.MELHORENVIO_TOKEN) {
    const baseUrl = env.MELHORENVIO_BASE_URL ?? 'https://melhorenvio.com.br';
    const client = new MelhorEnvioClient({
      baseUrl,
      token: env.MELHORENVIO_TOKEN,
      logger: logger
        ? {
            warn: (obj, msg) => logger.warn(obj, msg),
            error: (obj, msg) => logger.error(obj, msg),
          }
        : undefined,
    });
    return new MelhorEnvioProvider(client);
  }

  if (env.NODE_ENV === 'production') {
    throw new Error('FakeShipping proibido em produção — defina MELHORENVIO_TOKEN_FILE');
  }

  return fake;
}

@Module({})
export class ShippingModule {
  static register(): DynamicModule {
    const providers: Provider[] = [
      FakeShippingProvider,
      {
        provide: SHIPPING_PROVIDER,
        useFactory: (env: Env, fake: FakeShippingProvider, logger?: Logger) =>
          resolveShippingProvider(env, fake, logger),
        inject: [ENV, FakeShippingProvider, { token: Logger, optional: true }],
      },
      ShippingService,
    ];

    return {
      module: ShippingModule,
      providers,
      exports: [ShippingService, SHIPPING_PROVIDER],
    };
  }
}
