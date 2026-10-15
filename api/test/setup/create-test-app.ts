import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '../../src/app.module';
import { loadEnv } from '../../src/config/env';
import { FakeGateway } from '../../src/payments/fake-gateway';
import { getHarnessPostgres } from './postgres';

export async function createTestApp(): Promise<{
  app: INestApplication;
  gateway: FakeGateway;
}> {
  const { appUrl } = getHarnessPostgres();
  const env = loadEnv({
    NODE_ENV: 'test',
    PORT: '3000',
    DATABASE_URL: appUrl,
  });

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.register(env)],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  await app.init();

  return {
    app,
    gateway: app.get(FakeGateway),
  };
}
