import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { loadEnv, type Env } from './config/env';
import { setupOpenApi } from './openapi/openapi';

const BODY_LIMIT = '100kb';

export async function boot(
  source: NodeJS.ProcessEnv,
  listen: (
    app: NestExpressApplication,
    env: Env,
  ) => Promise<void>,
): Promise<void> {
  const env = loadEnv(source);
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.register(env),
    { bufferLogs: true },
  );
  app.useLogger(app.get(Logger));
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.useBodyParser('json', { limit: BODY_LIMIT });
  app.useBodyParser('urlencoded', { limit: BODY_LIMIT, extended: false });
  app.setGlobalPrefix('api');
  app.use(
    helmet({
      hsts: env.NODE_ENV === 'production' ? undefined : false,
    }),
  );
  setupOpenApi(app);
  app.enableShutdownHooks();
  await listen(app, env);
}

if (require.main === module) {
  void boot(process.env, async (app, env) => {
    await app.listen(env.PORT);
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Falha ao subir';
    console.error(message);
    process.exit(1);
  });
}
