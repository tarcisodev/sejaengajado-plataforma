import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { SUPABASE_ADMIN, type SupabaseAdminClient } from '../../src/auth/supabase-admin';
import { AppModule } from '../../src/app.module';
import { loadEnv } from '../../src/config/env';
import { FakeGateway } from '../../src/payments/fake-gateway';
import { getHarnessPostgres } from './postgres';

export interface TestAppOptions {
  supabaseAdmin?: SupabaseAdminClient;
}

export async function createTestApp(options: TestAppOptions = {}): Promise<{
  app: INestApplication;
  gateway: FakeGateway;
}> {
  const { appUrl } = getHarnessPostgres();
  const supabaseUrl =
    process.env.TEST_JWT_ISS?.replace(/\/auth\/v1\/?$/, '') ?? 'http://127.0.0.1';
  const env = loadEnv({
    NODE_ENV: 'test',
    PORT: '3000',
    DATABASE_URL: appUrl,
    SUPABASE_URL: supabaseUrl,
    SUPABASE_JWT_SECRET: process.env.TEST_JWT_SECRET ?? 'test-supabase-jwt-secret',
    SUPABASE_JWT_AUD: process.env.TEST_JWT_AUD ?? 'authenticated',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  });

  const builder = Test.createTestingModule({
    imports: [AppModule.register(env)],
  });

  if (options.supabaseAdmin) {
    builder.overrideProvider(SUPABASE_ADMIN).useValue(options.supabaseAdmin);
  }

  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  await app.init();

  return {
    app,
    gateway: app.get(FakeGateway),
  };
}
