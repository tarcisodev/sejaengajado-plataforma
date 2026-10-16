import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { SUPABASE_ADMIN, type SupabaseAdminClient } from '../../src/auth/supabase-admin';
import { AppModule } from '../../src/app.module';
import { loadEnv } from '../../src/config/env';
import { FakeJobMailer, JOB_MAILER } from '../../src/jobs/mailer';
import { FakeGateway } from '../../src/payments/domain/fake-gateway';
import { getHarnessPostgres } from './postgres';

export interface TestAppOptions {
  supabaseAdmin?: SupabaseAdminClient;
  jobMailer?: FakeJobMailer;
}

export async function createTestApp(options: TestAppOptions = {}): Promise<{
  app: INestApplication;
  gateway: FakeGateway;
  jobMailer: FakeJobMailer;
}> {
  const { appUrl, seAdminUrl } = getHarnessPostgres();
  const supabaseUrl =
    process.env.TEST_JWT_ISS?.replace(/\/auth\/v1\/?$/, '') ?? 'http://127.0.0.1';
  const env = loadEnv({
    NODE_ENV: 'test',
    PORT: '3000',
    DATABASE_URL: appUrl,
    ADMIN_DATABASE_URL: seAdminUrl,
    SUPABASE_URL: supabaseUrl,
    SUPABASE_JWT_SECRET: process.env.TEST_JWT_SECRET ?? 'test-supabase-jwt-secret',
    SUPABASE_JWT_AUD: process.env.TEST_JWT_AUD ?? 'authenticated',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  });

  const jobMailer = options.jobMailer ?? new FakeJobMailer();
  const supabaseAdmin: SupabaseAdminClient = options.supabaseAdmin ?? {
    inviteUserByEmail: async (email: string) => ({ id: randomUUID(), email }),
    generateRecoveryLink: async () => ({ actionLink: 'https://example.com/recovery' }),
    unenrollMfaFactors: async () => ({ removed: 0 }),
  };

  const builder = Test.createTestingModule({
    imports: [AppModule.register(env)],
  });

  builder.overrideProvider(SUPABASE_ADMIN).useValue(supabaseAdmin);
  builder.overrideProvider(JOB_MAILER).useValue(jobMailer);

  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  await app.init();

  return {
    app,
    gateway: app.get(FakeGateway),
    jobMailer,
  };
}
