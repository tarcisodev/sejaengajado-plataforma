import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { loadEnv, type Env } from './config/env';

export async function boot(
  source: NodeJS.ProcessEnv,
  listen: (app: Awaited<ReturnType<typeof NestFactory.create>>, env: Env) => Promise<void>,
): Promise<void> {
  const env = loadEnv(source);
  const app = await NestFactory.create(AppModule.register(env), { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');
  app.use(helmet());
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
