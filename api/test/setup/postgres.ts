import { execSync } from 'node:child_process';
import { join } from 'node:path';

import { PrismaClient } from '@prisma/client';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';

export interface HarnessPostgres {
  container: StartedPostgreSqlContainer;
  prisma: PrismaClient;
  adminUrl: string;
  appUrl: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __SE_HARNESS_POSTGRES__: HarnessPostgres | undefined;
}

export async function startHarnessPostgres(): Promise<HarnessPostgres> {
  if (globalThis.__SE_HARNESS_POSTGRES__) {
    return globalThis.__SE_HARNESS_POSTGRES__;
  }

  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('sejaengajado')
    .withUsername('postgres')
    .withPassword('postgres')
    .start();

  const adminUrl = container.getConnectionUri();
  const appUrl = `postgresql://se_app:se_app@${container.getHost()}:${container.getMappedPort(5432)}/sejaengajado`;

  execSync('npx prisma migrate deploy', {
    cwd: join(__dirname, '../..'),
    env: { ...process.env, DATABASE_URL: adminUrl },
    stdio: 'inherit',
  });

  const prisma = new PrismaClient({
    datasources: { db: { url: appUrl } },
  });
  await prisma.$connect();

  process.env.DATABASE_URL = appUrl;
  process.env.TEST_JWT_SECRET = process.env.TEST_JWT_SECRET ?? 'test-supabase-jwt-secret';
  process.env.TEST_JWT_ISS = process.env.TEST_JWT_ISS ?? 'http://127.0.0.1/auth/v1';
  process.env.TEST_JWT_AUD = process.env.TEST_JWT_AUD ?? 'authenticated';

  const harness = { container, prisma, adminUrl, appUrl };
  globalThis.__SE_HARNESS_POSTGRES__ = harness;
  return harness;
}

export function getHarnessPostgres(): HarnessPostgres {
  const harness = globalThis.__SE_HARNESS_POSTGRES__;
  if (!harness) {
    throw new Error('Harness Postgres ainda não foi iniciado');
  }
  return harness;
}

export async function stopHarnessPostgres(): Promise<void> {
  const harness = globalThis.__SE_HARNESS_POSTGRES__;
  if (!harness) {
    return;
  }
  await harness.prisma.$disconnect();
  await harness.container.stop();
  globalThis.__SE_HARNESS_POSTGRES__ = undefined;
}
